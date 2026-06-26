// src/components/NotificacionCartas.jsx  — v3 (Bugfix 1)
// ─────────────────────────────────────────────────────────────
// BUG 6 CORREGIDO:
//   Las cartas con origen:"sobre" NO deben aparecer aquí
//   automáticamente — solo se muestran cuando el usuario
//   abre su sobre en la pestaña LÁMINAS y presiona GUARDAR.
//   Solo aparecen aquí: cartas del podio (sin origen) y cartaDiaria.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, query, where, getDocs, updateDoc, doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { cartaImg } from "../utils/sobre";

const RAREZA_COLOR = {
  comun:      "var(--verde-claro)",
  rara:       "var(--amarillo)",
  legendaria: "var(--rojo-chile)",
};

// Orígenes que SÍ se notifican automáticamente al entrar
const ORIGENES_NOTIFICABLES = ["", undefined, null, "cartaDiaria"];

function origenInfo(origen) {
  if (origen === "cartaDiaria") {
    return {
      titulo:    "🎁 ¡CARTA DEL DÍA!",
      subtitulo: "Tu regalo diario por participar en Chile Predictor.",
    };
  }
  return {
    titulo:    "🏆 ¡GANASTE CARTAS!",
    subtitulo: "Subiste al podio del día anterior. Estas cartas se añaden a tu colección.",
  };
}

export default function NotificacionCartas() {
  const { firebaseUser } = useAuth();
  const [grupos,  setGrupos]  = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    cargar();
  }, [firebaseUser]);

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

      // Bug 6 fix: filtrar SOLO los orígenes notificables (excluir "sobre")
      const cartasFiltradas = cartas.filter(
        c => ORIGENES_NOTIFICABLES.includes(c.origen)
      );
      if (cartasFiltradas.length === 0) return;

      // Agrupar por origen
      const mapaGrupos = {};
      for (const carta of cartasFiltradas) {
        const origen = carta.origen || "";
        if (!mapaGrupos[origen]) mapaGrupos[origen] = [];
        mapaGrupos[origen].push(carta);
      }

      // Orden: podio primero, cartaDiaria después
      const gruposOrdenados = Object.entries(mapaGrupos)
        .sort(([a], [b]) => {
          const orden = ["", "cartaDiaria"];
          const ia = orden.indexOf(a); const ib = orden.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
        .map(([origen, cartas]) => ({ origen, cartas }));

      setGrupos(gruposOrdenados);
      setVisible(true);
    } catch (e) { console.error(e); }
  };

  const handleCerrar = async () => {
    const todas = grupos.flatMap(g => g.cartas);
    for (const c of todas) {
      try {
        await updateDoc(doc(db, "cartasDelUsuario", c.docId), { visto: true });
      } catch (_) {}
    }
    setVisible(false);
  };

  if (!visible || grupos.length === 0) return null;

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
      <div style={{ fontSize:"24px",marginBottom:"12px",letterSpacing:"8px" }}>
        🎉✨🃏✨🎉
      </div>
      <h2 style={{ color:"var(--amarillo)",fontSize:"10px",textAlign:"center",marginBottom:"6px" }}>
        {infoGeneral.titulo}
      </h2>
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"20px",
        textAlign:"center",lineHeight:2,maxWidth:"320px" }}>
        {infoGeneral.subtitulo}
      </p>

      {multiGrupo
        ? grupos.map(({ origen, cartas }) => {
            const info = origenInfo(origen);
            return (
              <div key={origen} style={{ marginBottom:"20px",width:"100%",maxWidth:"420px" }}>
                <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                  color:"var(--amarillo)",textAlign:"center",marginBottom:"10px",lineHeight:1.8 }}>
                  {info.titulo}
                </p>
                <CartasGrid cartas={cartas} />
              </div>
            );
          })
        : <CartasGrid cartas={grupos[0].cartas} />
      }

      <button className="btn-pixel btn-amarillo"
        style={{ fontSize:"8px",padding:"12px 24px",marginTop:"8px" }}
        onClick={handleCerrar}>
        ✅ ¡GENIAL! CERRAR
      </button>
    </div>
  );
}

function CartasGrid({ cartas }) {
  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:"12px",
      justifyContent:"center",maxWidth:"420px" }}>
      {cartas.map((c, i) => (
        <div key={i} style={{
          border:     `3px solid ${RAREZA_COLOR[c.rareza] || "var(--verde-claro)"}`,
          boxShadow:  `4px 4px 0 ${RAREZA_COLOR[c.rareza] || "var(--verde-claro)"}44`,
          padding:    "14px 12px",
          display:    "flex", flexDirection:"column",
          alignItems: "center", gap:"8px",
          width:      "120px",
          background: "var(--negro)",
        }}>
          <img
            src={cartaImg(c.cartaSlug)}
            alt={c.cartaNombre}
            style={{ width:"80px",height:"80px",objectFit:"cover",
              imageRendering:"pixelated",border:"2px solid var(--negro)" }}
            onError={e => { e.target.style.display="none"; }}
          />
          <p style={{ fontSize:"5px",color:"var(--blanco)",
            textAlign:"center",lineHeight:1.8 }}>
            {c.cartaNombre}
          </p>
          <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"9px",
            color:RAREZA_COLOR[c.rareza]||"var(--verde-claro)",
            padding:"2px 8px",
            border:`2px solid ${RAREZA_COLOR[c.rareza]||"var(--verde-claro)"}` }}>
            ×{c.multiplicador}
          </span>
        </div>
      ))}
    </div>
  );
}
