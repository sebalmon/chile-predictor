// src/components/NotificacionesModal.jsx  — v5 (Fase 2)
// ─────────────────────────────────────────────────────────────
// Lee notificaciones no leídas de usuarios/{uid}/notificaciones
// y las muestra en modales uno por uno, en orden cronológico.
// Al cerrar cada modal marca la notificación como leída.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, where, doc, updateDoc, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ── Íconos según tipo de notificación ────────────────────────
function iconoTipo(tipo) {
  switch (tipo) {
    case "resultado_partido": return "⚽";
    case "resultado_pregunta": return "❓";
    case "bonus_ganador": return "🏆";
    default: return "📣";
  }
}

// ── Colores según acierto ─────────────────────────────────────
function colorAcierto(acertaste) {
  return acertaste ? "var(--verde-claro)" : "var(--gris-claro)";
}

// ── Render del contenido de la notificación ───────────────────
function ContenidoNotif({ notif }) {
  const { tipo } = notif;

  if (tipo === "resultado_partido") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ fontSize: "8px", color: "var(--amarillo)", textAlign: "center" }}>
          {notif.nombrePartido}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FilaInfo label="TU APUESTA"  valor={notif.tuApuesta}  color="var(--blanco)" />
          <FilaInfo label="RESULTADO"   valor={notif.resultado}   color="var(--amarillo)" />
          <FilaInfo
            label="ACIERTO"
            valor={notif.acertaste ? "✅ ¡SÍ!" : "❌ No"}
            color={colorAcierto(notif.acertaste)}
          />
          <FilaInfo
            label="PUNTOS"
            valor={notif.puntosGanados !== undefined ? `+${notif.puntosGanados} pts` : "0 pts"}
            color={notif.puntosGanados > 0 ? "var(--verde-claro)" : "var(--gris-claro)"}
          />
        </div>
      </div>
    );
  }

  if (tipo === "resultado_pregunta") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p style={{ fontSize: "7px", color: "var(--amarillo)", textAlign: "center", lineHeight: 2 }}>
          {notif.textoPregunta}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FilaInfo label="TU RESPUESTA"   valor={notif.tuRespuesta}        color="var(--blanco)" />
          <FilaInfo label="RESP. CORRECTA" valor={notif.respuestaCorrecta}  color="var(--amarillo)" />
          <FilaInfo
            label="ACIERTO"
            valor={notif.acertaste ? "✅ ¡SÍ!" : "❌ No"}
            color={colorAcierto(notif.acertaste)}
          />
          <FilaInfo
            label="PUNTOS"
            valor={notif.puntosGanados > 0 ? `+${notif.puntosGanados} pts` : "0 pts"}
            color={notif.puntosGanados > 0 ? "var(--verde-claro)" : "var(--gris-claro)"}
          />
        </div>
      </div>
    );
  }

  if (tipo === "bonus_ganador") {
    return (
      <p style={{
        fontSize: "8px", color: "var(--verde-claro)",
        textAlign: "center", lineHeight: 2.2,
      }}>
        {notif.mensaje || "¡Recibiste un premio del podio!"}
      </p>
    );
  }

  // Genérico
  return (
    <p style={{ fontSize: "7px", color: "var(--blanco)", textAlign: "center", lineHeight: 2 }}>
      {notif.mensaje || "Tienes una notificación nueva."}
    </p>
  );
}

function FilaInfo({ label, valor, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 8px", borderBottom: "1px solid var(--verde-campo)",
    }}>
      <span style={{ fontSize: "6px", color: "var(--gris-claro)" }}>{label}</span>
      <span style={{ fontSize: "7px", color, fontFamily: "'Press Start 2P',monospace" }}>
        {valor}
      </span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function NotificacionesModal() {
  const { firebaseUser } = useAuth();
  const [cola,    setCola]    = useState([]); // notificaciones no leídas
  const [actual,  setActual]  = useState(0);  // índice actual
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    cargarNoLeidas();
  }, [firebaseUser]);

  const cargarNoLeidas = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, "usuarios", firebaseUser.uid, "notificaciones"),
        where("leido", "==", false),
        orderBy("timestamp", "asc")
      ));
      if (!snap.empty) {
        setCola(snap.docs.map((d) => ({ docId: d.id, ...d.data() })));
        setActual(0);
        setVisible(true);
      }
    } catch (e) {
      console.error("Error cargando notificaciones:", e);
    }
  };

  const marcarLeida = async (docId) => {
    try {
      await updateDoc(
        doc(db, "usuarios", firebaseUser.uid, "notificaciones", docId),
        { leido: true }
      );
    } catch (e) {
      console.error("Error marcando notificación como leída:", e);
    }
  };

  const handleCerrar = async () => {
    const notif = cola[actual];
    if (notif) await marcarLeida(notif.docId);

    if (actual < cola.length - 1) {
      setActual((i) => i + 1);
    } else {
      setVisible(false);
      setCola([]);
    }
  };

  if (!visible || cola.length === 0) return null;

  const notif = cola[actual];
  const icono = iconoTipo(notif.tipo);
  const esUltima = actual === cola.length - 1;

  // Color del borde según tipo
  const colorBorde =
    notif.tipo === "bonus_ganador"     ? "var(--amarillo)" :
    notif.acertaste                    ? "var(--verde-claro)" :
    "var(--gris)";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.88)",
      zIndex: 850,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background:  "var(--negro)",
        border:      `4px solid ${colorBorde}`,
        boxShadow:   `6px 6px 0 ${colorBorde}44`,
        padding:     "24px 20px",
        maxWidth:    "380px",
        width:       "100%",
        display:     "flex",
        flexDirection: "column",
        gap:         "16px",
      }}>
        {/* Contador */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "24px" }}>{icono}</span>
          {cola.length > 1 && (
            <span style={{ fontSize: "5px", color: "var(--gris-claro)" }}>
              {actual + 1} / {cola.length}
            </span>
          )}
        </div>

        {/* Título */}
        <p style={{ fontSize: "8px", color: colorBorde, textAlign: "center" }}>
          {notif.tipo === "resultado_partido" ? "RESULTADO DEL PARTIDO" :
           notif.tipo === "resultado_pregunta" ? "PREGUNTA DEL DÍA" :
           notif.tipo === "bonus_ganador" ? "🏆 PODIO DEL DÍA" :
           "NOTIFICACIÓN"}
        </p>

        {/* Fecha */}
        {notif.fecha && (
          <p style={{ fontSize: "5px", color: "var(--gris-claro)", textAlign: "center" }}>
            {notif.fecha}
          </p>
        )}

        {/* Contenido */}
        <ContenidoNotif notif={notif} />

        {/* Botón */}
        <button
          className="btn-pixel btn-amarillo w-full"
          style={{ fontSize: "8px", marginTop: "4px" }}
          onClick={handleCerrar}
        >
          {esUltima ? "✅ ENTENDIDO" : `SIGUIENTE (${cola.length - actual - 1} más) →`}
        </button>
      </div>
    </div>
  );
}
