// src/components/Ranking.jsx  — v7 (Patch 1)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v7:
//   • Colores de fondo por posición: oro/plata/bronce (incluye empates).
//   • Flecha ▲▼ movida al lado IZQUIERDO de los puntos.
//   • Numeración con empates: solo el primer usuario del grupo
//     muestra el número; los siguientes muestran celda vacía.
//     El número siguiente al bloque continúa correctamente (dense rank).
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { ayerStr } from "../utils/helpers";
import { AVATARES, CARTAS } from "../data/sampleData";
import HistorialPredicciones from "./HistorialPredicciones";

// ── Colores de fondo por posición ────────────────────────────
const FONDO_POS = {
  1: { bg: "#FFD966", borde: "#D4A017", texto: "#000000" },   // amarillo sólido, texto negro
  2: { bg: "#D3D3D3", borde: "#A9A9A9", texto: "#000000" },   // gris plata, texto negro
  3: { bg: "#CD7F32", borde: "#8B5A2B", texto: "#000000" },   // bronce sólido, texto negro
};

function AvatarSmall({ avatarId, avatarSlug }) {
  const src = avatarSlug
    ? `/avatares/${avatarSlug}-1.png`
    : `/avatares/${(AVATARES.find(a => a.id === avatarId)?.slug || "default")}-1.png`;
  return (
    <img src={src} alt=""
      style={{ width:22, height:22, imageRendering:"pixelated", flexShrink:0 }}
      onError={e => (e.target.style.display = "none")}
    />
  );
}

// ── Modal perfil + historial ──────────────────────────────────
function ModalPerfilConHistorial({ jugador, onCerrar }) {
  const [tab, setTab] = useState("historial");
  if (!jugador) return null;
  const cartasMap     = jugador.cartas || {};
  const cartasDesbloq = CARTAS.filter(c => (cartasMap[c.id] || 0) > 0);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:600,
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:"20px",overflowY:"auto" }} onClick={onCerrar}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--verde-claro)",
        boxShadow:"6px 6px 0 var(--verde-oscuro)",maxWidth:"400px",width:"100%",
        maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px" }}>
          <img
            src={`/avatares/${jugador.avatarSlug || "default"}-1.png`}
            alt={jugador.nickname}
            style={{ width:60,height:60,imageRendering:"pixelated",border:"3px solid var(--negro)" }}
            onError={e => (e.target.style.display="none")}
          />
          <p style={{ fontSize:"10px",color:"var(--amarillo)",textAlign:"center" }}>{jugador.nickname}</p>
          <span className="puntos-badge" style={{ fontSize:"11px" }}>{jugador.puntosTotal ?? 0} pts</span>
        </div>

        <div style={{ display:"flex",borderTop:"2px solid var(--verde-campo)",borderBottom:"2px solid var(--verde-campo)" }}>
          {[{id:"historial",label:"🔮 PRONÓSTICOS"},{id:"perfil",label:"👤 INFO"}].map(t => (
            <button key={t.id}
              style={{ flex:1,fontFamily:"'Press Start 2P',monospace",fontSize:"5px",padding:"7px",
                background:tab===t.id?"var(--verde-campo)":"var(--negro)",
                color:tab===t.id?"var(--negro)":"var(--gris-claro)",
                border:"none",cursor:"pointer" }}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div style={{ flex:1,overflowY:"auto" }}>
          {tab === "historial" && <HistorialPredicciones userId={jugador.uid} />}
          {tab === "perfil" && (
            <div style={{ padding:"12px",fontSize:"7px",color:"var(--gris-claro)",lineHeight:2 }}>
              <p>🎯 Puntos: <span style={{ color:"var(--amarillo)" }}>{jugador.puntosTotal ?? 0}</span></p>
              <p>🃏 Cartas: <span style={{ color:"var(--amarillo)" }}>{cartasDesbloq.length}</span></p>
            </div>
          )}
        </div>

        <div style={{ padding:"10px",borderTop:"2px solid var(--verde-campo)" }}>
          <button className="btn-pixel btn-gris w-full" style={{ fontSize:"7px" }} onClick={onCerrar}>
            CERRAR ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function Ranking({ onVolver }) {
  const { firebaseUser } = useAuth();
  const [usuarios,    setUsuarios]    = useState([]);
  const [rankingAyer, setRankingAyer] = useState({});
  const [cargando,    setCargando]    = useState(true);
  const [jugadorSel,  setJugadorSel]  = useState(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const snapU = await getDocs(query(collection(db,"usuarios"), orderBy("puntosTotal","desc")));
      setUsuarios(snapU.docs.map(d => ({ id:d.id, ...d.data() })));

      const ayer = ayerStr();
      const snapAyer = await getDocs(query(collection(db,"puntosDelDia"), where("fecha","==",ayer)));
      if (!snapAyer.empty) {
        const ayerOrd = snapAyer.docs.map(d => d.data()).sort((a,b) => b.puntos - a.puntos);
        const mapa = {}; let pos = 1;
        for (let i = 0; i < ayerOrd.length; i++) {
          if (i > 0 && ayerOrd[i].puntos < ayerOrd[i-1].puntos) pos = i + 1;
          mapa[ayerOrd[i].uid] = pos;
        }
        setRankingAyer(mapa);
      }
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  // ── Dense rank con tracking del primer del grupo ──────────
  // Devuelve array de { posicion, esPrimeroDelGrupo }
  const filasMeta = (() => {
    const result = [];
    let posActual = 1;
    let contadorAcumulado = 0;

    for (let i = 0; i < usuarios.length; i++) {
      const u = usuarios[i];
      if (i === 0 || u.puntosTotal < usuarios[i-1].puntosTotal) {
        posActual = i + 1;           // posición real (standard competition ranking)
      }
      const esPrimero = (i === 0) || (u.puntosTotal < usuarios[i-1].puntosTotal);
      result.push({ posicion: posActual, esPrimero });
    }
    return result;
  })();

  const medallas = ["🥇","🥈","🥉"];

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px" }}>
        {onVolver && (
          <button className="btn-pixel btn-gris" onClick={onVolver}
            style={{ padding:"8px 12px",fontSize:"8px" }}>← VOLVER</button>
        )}
        <h2 className="text-amarillo">🏆 RANKING COMPLETO</h2>
      </div>

      {Object.keys(rankingAyer).length > 0 && (
        <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginBottom:"10px",lineHeight:2 }}>
          ▲▼ junto a los puntos = cambio respecto al ranking de ayer
        </p>
      )}

      {cargando ? (
        <div className="text-center" style={{ padding:"40px",fontSize:"8px",color:"var(--verde-claro)" }}>
          <span className="spinner">⚙</span><br/><br/>CARGANDO...
        </div>
      ) : (
        <div className="caja-pixel" style={{ padding:0, overflow:"hidden" }}>
          <table className="ranking-tabla" style={{ borderCollapse:"collapse", width:"100%" }}>
            <thead>
              <tr>
                <th style={{ width:"28px", textAlign:"center" }}>#</th>
                <th>JUGADOR</th>
                <th style={{ textAlign:"right", paddingRight:"10px" }}>PUNTOS</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => {
                const { posicion, esPrimero } = filasMeta[i];
                const estilo = FONDO_POS[posicion];
                const posAyer   = rankingAyer[u.uid];
                const posActual = posicion;
                const diff = posAyer && posActual ? posAyer - posActual : 0;

                return (
                  <tr
                    key={u.id}
                    onClick={() => setJugadorSel(u)}
                    style={{
                      cursor: "pointer",
                      background: estilo?.bg || (i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"),
                      borderLeft: estilo ? `3px solid ${estilo.borde}` : "3px solid transparent",
                      borderBottom: "1px solid rgba(82,183,136,0.15)",
                    }}
                  >
                    {/* Columna # */}
                    <td style={{ textAlign:"center", padding:"8px 4px", width:"28px",
                      fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                      color: estilo?.texto || "var(--gris-claro)" }}>
                      {esPrimero
                        ? (posicion <= 3 ? medallas[posicion - 1] : posicion)
                        : ""
                      }
                    </td>

                    {/* Columna jugador */}
                    <td style={{ padding:"8px 6px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                        <AvatarSmall avatarId={u.avatarId} avatarSlug={u.avatarSlug} />
                        <div style={{ fontSize:"7px", color:"var(--blanco)", lineHeight:1.6 }}>
                          {u.nickname}
                          {u.uid === firebaseUser?.uid && (
                            <span style={{ marginLeft:"6px",fontSize:"5px",
                              background:"var(--verde-claro)",color:"var(--negro)",
                              padding:"1px 4px",border:"1px solid var(--negro)" }}>TÚ</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Columna puntos + flecha */}
                    <td style={{ textAlign:"right", padding:"8px 10px 8px 4px" }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"6px" }}>
                        {/* Flecha a la IZQUIERDA de los puntos */}
                        {diff !== 0 ? (
                          <span style={{
                            fontFamily:"'Press Start 2P',monospace",
                            fontSize:"9px",
                            color: diff > 0 ? "#4ade80" : "var(--rojo-chile)",
                            lineHeight:1,
                          }}>
                            {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                          </span>
                        ) : posAyer ? (
                          <span style={{ fontSize:"8px",color:"var(--gris)",lineHeight:1 }}>—</span>
                        ) : null}
                        <span className="puntos-badge"
                          style={{ color: estilo?.texto || undefined }}>
                          {u.puntosTotal ?? 0}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign:"center",padding:"20px",
                  fontSize:"7px",color:"var(--gris-claro)" }}>Aún no hay jugadores</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {jugadorSel && (
        <ModalPerfilConHistorial jugador={jugadorSel} onCerrar={() => setJugadorSel(null)} />
      )}
    </div>
  );
}
