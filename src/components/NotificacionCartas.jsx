// src/components/NotificacionCartas.jsx  — v2 (Patch 3)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v2:
//   • Detecta el origen de la carta (campo `origen`):
//       "cartaDiaria" → mensaje: "¡Tu carta del día!"
//       "sobre"       → mensaje: "¡Carta de tu sobre!"
//       sin origen    → mensaje: "¡Subiste al podio!" (comportamiento anterior)
//   • Agrupa las cartas por origen para mostrar mensajes distintos.
//   • Si hay cartas de varios orígenes, las muestra todas en el mismo modal
//     con un encabezado por grupo.
//   • Todo lo demás idéntico a v1.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, query, where, getDocs, updateDoc, doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const RAREZA_COLOR = {
  comun:      "var(--verde-claro)",
  rara:       "var(--amarillo)",
  legendaria: "var(--rojo-chile)",
};

// Título y subtítulo según origen de la carta
function origenInfo(origen) {
  switch (origen) {
    case "cartaDiaria":
      return {
        titulo:    "🎁 ¡CARTA DEL DÍA!",
        subtitulo: "Tu regalo diario por participar en Chile Predictor.",
      };
    case "sobre":
      return {
        titulo:    "🃏 ¡CARTA DE TU SOBRE!",
        subtitulo: "Obtuviste esta carta al abrir tu sobre de láminas.",
      };
    default:
      return {
        titulo:    "🏆 ¡GANASTE CARTAS!",
        subtitulo: "Subiste al podio del día anterior. Estas cartas se añaden a tu colección.",
      };
  }
}

export default function NotificacionCartas() {
  const { firebaseUser } = useAuth();
  const [grupos,  setGrupos]  = useState([]); // [{ origen, cartas[] }]
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const cargar = async () => {
      try {
        const q = query(
          collection(db, "cartasDelUsuario"),
          where("uid",   "==", firebaseUser.uid),
          where("visto", "==", false)
        );
        const snap = await getDocs(q);
        if (snap.empty) return;

        const cartas = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

        // Agrupar por origen (preserva orden: podio → cartaDiaria → sobre → resto)
        const ORDEN_ORIGEN = ["", "cartaDiaria", "sobre"];
        const mapaGrupos = {};
        for (const carta of cartas) {
          const origen = carta.origen || "";
          if (!mapaGrupos[origen]) mapaGrupos[origen] = [];
          mapaGrupos[origen].push(carta);
        }

        // Ordenar grupos
        const gruposOrdenados = Object.entries(mapaGrupos)
          .sort(([a], [b]) => {
            const ia = ORDEN_ORIGEN.indexOf(a);
            const ib = ORDEN_ORIGEN.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          })
          .map(([origen, cartas]) => ({ origen, cartas }));

        setGrupos(gruposOrdenados);
        setVisible(true);
      } catch(e) { console.error(e); }
    };
    cargar();
  }, [firebaseUser]);

  const handleCerrar = async () => {
    const todasCartas = grupos.flatMap(g => g.cartas);
    for (const c of todasCartas) {
      try {
        await updateDoc(doc(db, "cartasDelUsuario", c.docId), { visto: true });
      } catch(_) {}
    }
    setVisible(false);
  };

  if (!visible || grupos.length === 0) return null;

  const todasCartas = grupos.flatMap(g => g.cartas);

  // Si hay un único grupo, usar su título como encabezado principal
  // Si hay múltiples grupos, mostrar encabezado genérico y subtítulos por grupo
  const multiGrupo = grupos.length > 1;
  const infoGeneral = multiGrupo
    ? { titulo: "🃏 ¡NUEVAS CARTAS!", subtitulo: "Tienes cartas de varios orígenes." }
    : origenInfo(grupos[0].origen);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.95)", zIndex: 800,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "20px", overflowY: "auto",
    }}>
      {/* Partículas */}
      <div style={{ fontSize:"24px", marginBottom:"12px", letterSpacing:"8px" }}>
        🎉✨🃏✨🎉
      </div>

      <h2 style={{ color:"var(--amarillo)", fontSize:"10px", textAlign:"center",
        marginBottom:"6px" }}>
        {infoGeneral.titulo}
      </h2>
      <p style={{ fontSize:"6px", color:"var(--gris-claro)", marginBottom:"20px",
        textAlign:"center", lineHeight:2, maxWidth:"320px" }}>
        {infoGeneral.subtitulo}
      </p>

      {/* Grupos de cartas */}
      {multiGrupo
        ? grupos.map(({ origen, cartas }) => {
            const info = origenInfo(origen);
            return (
              <div key={origen} style={{ marginBottom:"20px", width:"100%", maxWidth:"420px" }}>
                <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                  color:"var(--amarillo)", textAlign:"center",
                  marginBottom:"10px", lineHeight:1.8 }}>
                  {info.titulo}
                </p>
                <CartasGrid cartas={cartas} />
              </div>
            );
          })
        : <CartasGrid cartas={todasCartas} />
      }

      <button
        className="btn-pixel btn-amarillo"
        style={{ fontSize:"8px", padding:"12px 24px", marginTop:"8px" }}
        onClick={handleCerrar}
      >
        ✅ ¡GENIAL! CERRAR
      </button>
    </div>
  );
}

function CartasGrid({ cartas }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: "12px",
      justifyContent: "center", maxWidth: "420px",
    }}>
      {cartas.map((c, i) => (
        <div key={i} style={{
          border:      `3px solid ${RAREZA_COLOR[c.rareza] || "var(--verde-claro)"}`,
          boxShadow:   `4px 4px 0 ${RAREZA_COLOR[c.rareza] || "var(--verde-claro)"}44`,
          padding:     "14px 12px",
          display:     "flex", flexDirection: "column",
          alignItems:  "center", gap: "8px",
          width:       "120px",
          background:  "var(--negro)",
        }}>
          <img
            src={`/cartas/${c.cartaSlug}.png`}
            alt={c.cartaNombre}
            style={{
              width: "80px", height: "80px",
              objectFit: "cover", imageRendering: "pixelated",
              border: "2px solid var(--negro)",
            }}
            onError={e => { e.target.style.display = "none"; }}
          />
          <p style={{ fontSize:"5px", color:"var(--blanco)",
            textAlign:"center", lineHeight:1.8 }}>
            {c.cartaNombre}
          </p>
          <span style={{
            fontFamily: "'Press Start 2P',monospace",
            fontSize:   "9px",
            color:       RAREZA_COLOR[c.rareza] || "var(--verde-claro)",
            padding:    "2px 8px",
            border:     `2px solid ${RAREZA_COLOR[c.rareza] || "var(--verde-claro)"}`,
          }}>
            ×{c.multiplicador}
          </span>
        </div>
      ))}
    </div>
  );
}
