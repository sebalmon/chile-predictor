// src/components/NotificacionCartas.jsx
// ─────────────────────────────────────────────────────────────
// Modal a pantalla completa que se muestra al usuario cuando
// tiene cartas nuevas sin ver (visto === false en cartasDelUsuario).
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, query, where, getDocs, updateDoc, doc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const RAREZA_COLOR = {
  comun:      "var(--verde-claro)",
  rara:       "var(--amarillo)",
  legendaria: "var(--rojo-chile)",
};

const RAREZA_LABEL = { comun: "x2", rara: "x3", legendaria: "x4" };

export default function NotificacionCartas() {
  const { firebaseUser } = useAuth();
  const [cartas, setCartas] = useState([]);
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
        if (!snap.empty) {
          setCartas(snap.docs.map((d) => ({ docId: d.id, ...d.data() })));
          setVisible(true);
        }
      } catch(e) { console.error(e); }
    };
    cargar();
  }, [firebaseUser]);

  const handleCerrar = async () => {
    // Marcar todas como vistas
    for (const c of cartas) {
      try {
        await updateDoc(doc(db,"cartasDelUsuario",c.docId), { visto: true });
      } catch(e) {}
    }
    setVisible(false);
  };

  if (!visible || cartas.length === 0) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.95)", zIndex: 800,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      {/* Partículas decorativas */}
      <div style={{ fontSize:"24px", marginBottom:"12px", letterSpacing:"8px" }}>
        🎉✨🃏✨🎉
      </div>

      <h2 style={{ color:"var(--amarillo)", fontSize:"11px", textAlign:"center",
        marginBottom:"6px" }}>
        ¡GANASTE CARTAS!
      </h2>
      <p style={{ fontSize:"7px", color:"var(--gris-claro)", marginBottom:"20px",
        textAlign:"center", lineHeight:2 }}>
        Subiste al podio del día anterior.
        Estas cartas han sido añadidas a tu colección.
      </p>

      <div style={{
        display:"flex", flexWrap:"wrap", gap:"12px",
        justifyContent:"center", maxWidth:"400px", marginBottom:"24px",
      }}>
        {cartas.map((c, i) => (
          <div key={i} style={{
            border: `3px solid ${RAREZA_COLOR[c.rareza]||"var(--verde-claro)"}`,
            boxShadow: `4px 4px 0 ${RAREZA_COLOR[c.rareza]||"var(--verde-claro)"}44`,
            padding:"14px 12px",
            display:"flex", flexDirection:"column",
            alignItems:"center", gap:"8px",
            width:"130px",
            background:"var(--negro)",
          }}>
            <img
              src={`/cartas/${c.cartaSlug}.png`}
              alt={c.cartaNombre}
              style={{
                width:"90px", height:"90px",
                objectFit:"cover",
                imageRendering:"pixelated",
                border:"2px solid var(--negro)",
              }}
              onError={(e)=>{ e.target.style.display="none"; }}
            />
            <p style={{ fontSize:"5px", color:"var(--blanco)", textAlign:"center", lineHeight:1.8 }}>
              {c.cartaNombre}
            </p>
            <span style={{
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"9px",
              color: RAREZA_COLOR[c.rareza]||"var(--verde-claro)",
              padding:"2px 8px",
              border:`2px solid ${RAREZA_COLOR[c.rareza]||"var(--verde-claro)"}`,
            }}>
              ×{c.multiplicador}
            </span>
          </div>
        ))}
      </div>

      <button
        className="btn-pixel btn-amarillo"
        style={{ fontSize:"8px", padding:"12px 24px" }}
        onClick={handleCerrar}
      >
        ✅ ¡GENIAL! CERRAR
      </button>
    </div>
  );
}
