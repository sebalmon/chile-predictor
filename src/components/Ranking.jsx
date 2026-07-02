// src/components/Ranking.jsx  — v8 (Números de fondo en podio, corregido)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v8:
//   • Número de fondo gigante (1,2,3) en primera celda para los primeros puestos,
//     solo en la primera fila de cada grupo de empate.
//   • Corregida estructura de tabla (celdas duplicadas, sintaxis).
//   • Variable isTop para resaltar los tres primeros puestos.
//   • Botón VOLVER corregido.
//   • Fecha de última actualización mostrada correctamente.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query, where, doc, getDoc } from "firebase/firestore";
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
          {jugador.nombreReal && (
            <p style={{ fontSize:"6px",color:"var(--gris-claro)" }}>👤 {jugador.nombreReal}</p>
          )}
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
  const [fechaActualizacion, setFechaActualizacion] = useState(null);

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    const cargarFecha = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "ultimaActualizacion"));
        if (snap.exists()) {
          setFechaActualizacion(snap.data().fecha);
        }
      } catch (e) {
        console.error("Error cargando fecha de actualización", e);
      }
    };
    cargarFecha();
  }, []);

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
  // Memorizado: solo se recalcula cuando cambia la lista de usuarios.
  const filasMeta = useMemo(() => {
    const result = [];
    for (let i = 0; i < usuarios.length; i++) {
      const u = usuarios[i];
      const esPrimero = (i === 0) || (u.puntosTotal < usuarios[i-1].puntosTotal);
      let posicion = i + 1;
      if (i > 0 && u.puntosTotal === usuarios[i-1].puntosTotal) {
        posicion = result[i-1].posicion;
      } else {
        posicion = i + 1;
      }
      result.push({ posicion, esPrimero });
    }
    return result;
  }, [usuarios]);

  const medallas = ["🥇","🥈","🥉"];

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
        {onVolver && (
          <button
            className="btn-pixel btn-gris"
            onClick={onVolver}
            style={{ padding:"8px 12px", fontSize:"8px" }}
          >
            ← VOLVER
          </button>
        )}
        <h2 className="text-amarillo">🏆 RANKING COMPLETO</h2>
      </div>
      {fechaActualizacion && (
        <p style={{
          fontSize: "6px",
          color: "var(--gris-claro)",
          textAlign: "center",
          marginTop: "4px",
          marginBottom: "12px",
          lineHeight: 1.5
        }}>
          🕒 Última actualización: {new Date(fechaActualizacion).toLocaleString()}
        </p>
      )}

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
                const diff = posAyer ? posAyer - posicion : 0;
                const isTop = i < 3; // primeras tres filas (resalte visual)

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
                    {/* Columna # con número de fondo gigante */}
                    <td
                      style={{
                        position: 'relative',
                        textAlign: "center",
                        padding: isTop ? "12px 4px" : "8px 4px",
                        width: "28px",
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: isTop ? "10px" : "7px",
                        color: estilo?.texto || "var(--gris-claro)"
                      }}
                    >
                      {/* Número de fondo (solo para puestos 1,2,3 y primera fila del grupo) */}
                      {posicion <= 3 && esPrimero && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '48px',
                          fontWeight: 'bold',
                          color: estilo?.texto === "#000000" ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)",
                          pointerEvents: 'none',
                          zIndex: 0,
                          fontFamily: "'Press Start 2P', monospace",
                        }}>
                          {posicion}
                        </div>
                      )}
                      <span style={{ position: 'relative', zIndex: 1 }}>
                        {esPrimero ? (posicion <= 3 ? medallas[posicion - 1] : posicion) : ""}
                      </span>
                    </td>

                    {/* Columna jugador */}
                    <td style={{ padding: isTop ? "12px 6px" : "8px 6px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap: isTop ? "10px" : "6px" }}>
                        <AvatarSmall avatarId={u.avatarId} avatarSlug={u.avatarSlug} />
                        <div style={{ fontSize: isTop ? "9px" : "7px", color:"var(--blanco)", lineHeight:1.6 }}>
                          {u.nickname}
                          {u.uid === firebaseUser?.uid && (
                            <span style={{
                              marginLeft:"6px",
                              fontSize:"5px",
                              background:"var(--verde-claro)",
                              color:"var(--negro)",
                              padding:"1px 4px",
                              border:"1px solid var(--negro)"
                            }}>TÚ</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Columna puntos + flecha */}
                    <td style={{ textAlign:"right", padding: isTop ? "12px 10px" : "8px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:"6px" }}>
                        {diff !== 0 && (
                          <span style={{
                            fontFamily:"'Press Start 2P',monospace",
                            fontSize: isTop ? "10px" : "8px",
                            color: diff > 0 ? "#4ade80" : "var(--rojo-chile)",
                          }}>
                            {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                          </span>
                        )}
                        <span style={{
                          fontFamily:"'Press Start 2P',monospace",
                          fontSize: isTop ? "12px" : "9px",
                          display:"inline-block",
                          background: "var(--negro)",
                          color: "#f4d03f",
                          border: "2px solid var(--amarillo)",
                          padding: "2px 8px",
                          boxShadow: "2px 2px 0 rgba(0,0,0,0.4)",
                          minWidth: "32px",
                          textAlign: "center",
                        }}>
                          {u.puntosTotal ?? 0}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign:"center",padding:"20px",
                    fontSize:"7px",color:"var(--gris-claro)" }}>Aún no hay jugadores</td>
                </tr>
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