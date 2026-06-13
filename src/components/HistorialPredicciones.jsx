// src/components/HistorialPredicciones.jsx  — v5 (Fase 2)
// ─────────────────────────────────────────────────────────────
// Componente reutilizable que muestra el historial de pronósticos
// de un userId dado. Se usa en:
//   • Perfil.jsx  → userId = firebaseUser.uid  (propio)
//   • ModalPerfilResumido / desde ranking/podio → userId ajeno
//
// Por cada predicción pasada muestra:
//   partido (nombre), tu apuesta, resultado real, acierto, puntos.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, where, doc, getDoc, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

// Texto legible de la predicción
function textoApuesta(pred) {
  if (pred.estaDestacado || (pred.golesLocalPred !== undefined && pred.golesLocalPred !== null)) {
    return `${pred.golesLocalPred ?? "?"} - ${pred.golesVisitantePred ?? "?"}`;
  }
  if (pred.definicion && pred.definicion !== "normal") {
    const def  = pred.definicion === "penales" ? "⚡ Penales" : "⏱ Alargue";
    const gan  = pred.ganadorPenales || pred.ganadorAlargue || pred.ganador90 || "";
    const ganL = gan === "local" ? "Local" : gan === "visitante" ? "Visitante" : gan;
    return `${def} → ${ganL}`;
  }
  const ganL =
    pred.ganador === "local"     ? "Local" :
    pred.ganador === "visitante" ? "Visitante" : "Empate";
  const dif = pred.diferencia ? ` (dif. ${pred.diferencia})` : "";
  return `${ganL}${dif}`;
}

// Texto legible del resultado real
function textoResultado(r) {
  if (!r) return "—";
  const base = `${r.golesLocal}-${r.golesVisitante}`;
  if (r.definicion === "penales") return `${base} (pen. ${r.penalesLocal}-${r.penalesVisitante})`;
  if (r.definicion === "alargue") return `${base} (alg.)`;
  return base;
}

export default function HistorialPredicciones({ userId }) {
  const [items,    setItems]    = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!userId) return;
    cargar();
  }, [userId]);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      // 1. Obtener todas las predicciones del usuario
      const snapPreds = await getDocs(query(
        collection(db, "predicciones"),
        where("uid", "==", userId)
      ));

      if (snapPreds.empty) {
        setItems([]);
        setCargando(false);
        return;
      }

      // 2. Para cada predicción, obtener datos del partido
      const partidosCache = {};
      const lista = [];

      for (const pDoc of snapPreds.docs) {
        const pred = pDoc.data();
        const pid  = pred.partidoId;

        // Cache de partidos para no hacer N lecturas iguales
        if (!partidosCache[pid]) {
          try {
            const pSnap = await getDoc(doc(db, "partidos", pid));
            partidosCache[pid] = pSnap.exists() ? pSnap.data() : null;
          } catch (_) {
            partidosCache[pid] = null;
          }
        }

        const partido = partidosCache[pid];
        if (!partido) continue; // partido no encontrado, saltar

        // Solo mostrar partidos que ya tienen resultado
        if (!partido.resultado) continue;

        lista.push({
          predId:       pDoc.id,
          partidoId:    pid,
          fecha:        pred.fecha || partido.fecha || "",
          nombrePartido: partido
            ? `${partido.local?.bandera ?? ""}${partido.local?.nombre ?? ""} vs ${partido.visitante?.nombre ?? ""}${partido.visitante?.bandera ?? ""}`
            : pid,
          estaDestacado: pred.estaDestacado || partido.estaDestacado || false,
          apuesta:      textoApuesta(pred),
          resultado:    textoResultado(partido.resultado),
          acertaste:    pred.esMaximo === true,
          puntosGanados: typeof pred.puntosGanados === "number" ? pred.puntosGanados : null,
          cartaId:      pred.cartaId || null,
        });
      }

      // Ordenar por fecha descendente
      lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setItems(lista);
    } catch (e) {
      console.error(e);
      setError("No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: "12px", textAlign: "center" }}>
        <span className="spinner" style={{ fontSize: "16px" }}>⚙</span>
        <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginTop: "6px" }}>
          Cargando historial...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p style={{ fontSize: "6px", color: "var(--rojo-chile)", padding: "8px" }}>{error}</p>
    );
  }

  if (items.length === 0) {
    return (
      <p style={{ fontSize: "6px", color: "var(--gris-claro)", padding: "8px", textAlign: "center", lineHeight: 2 }}>
        Sin pronósticos pasados todavía.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Cabecera */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 80px 80px 40px",
        gap: "4px",
        padding: "4px 6px",
        background: "var(--verde-oscuro)",
        borderBottom: "2px solid var(--verde-campo)",
      }}>
        {["PARTIDO", "TU APUESTA", "RESULTADO", "PTS"].map((h) => (
          <span key={h} style={{ fontSize: "5px", color: "var(--verde-claro)", lineHeight: 1.6 }}>{h}</span>
        ))}
      </div>

      {/* Filas */}
      {items.map((item, idx) => (
        <div key={item.predId} style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 80px 40px",
          gap: "4px",
          padding: "6px",
          background: idx % 2 === 0 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
          borderBottom: "1px solid var(--verde-campo)",
          alignItems: "center",
        }}>
          {/* Partido */}
          <div>
            <p style={{ fontSize: "5px", color: "var(--gris-claro)", lineHeight: 1.6 }}>
              {item.fecha}
            </p>
            <p style={{ fontSize: "6px", color: "var(--blanco)", lineHeight: 1.6 }}>
              {item.nombrePartido}
              {item.estaDestacado && (
                <span style={{ marginLeft: "4px", fontSize: "5px", color: "var(--amarillo)" }}>⭐</span>
              )}
            </p>
          </div>

          {/* Tu apuesta */}
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", lineHeight: 1.6 }}>
            {item.apuesta}
          </p>

          {/* Resultado real */}
          <p style={{ fontSize: "6px", color: "var(--blanco)", lineHeight: 1.6 }}>
            {item.resultado}
          </p>

          {/* Puntos */}
          <div style={{ textAlign: "right" }}>
            {item.puntosGanados !== null ? (
              <span style={{
                fontFamily: "'Press Start 2P',monospace",
                fontSize: "7px",
                color: item.acertaste ? "var(--verde-claro)" : "var(--gris)",
                display: "block",
              }}>
                {item.acertaste ? "+" : ""}{item.puntosGanados}
              </span>
            ) : (
              <span style={{ fontSize: "5px", color: "var(--gris)" }}>—</span>
            )}
            {item.acertaste && (
              <span style={{ fontSize: "5px", color: "var(--verde-claro)" }}>✓</span>
            )}
          </div>
        </div>
      ))}

      {/* Totales */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        padding: "6px 8px",
        background: "var(--negro)",
        borderTop: "2px solid var(--verde-campo)",
      }}>
        <span style={{ fontSize: "6px", color: "var(--gris-claro)" }}>
          {items.filter(i => i.acertaste).length}/{items.length} aciertos
        </span>
        <span style={{ fontSize: "6px", color: "var(--amarillo)" }}>
          {items.reduce((s, i) => s + (i.puntosGanados ?? 0), 0)} pts de partidos
        </span>
      </div>
    </div>
  );
}
