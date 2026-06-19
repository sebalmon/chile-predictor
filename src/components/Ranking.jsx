// src/components/Ranking.jsx  — v9 (Patch 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v9:
//   Punto 5:  Recarga los datos al montar el componente (getDocs).
//             Botón 🔄 manual para refrescar.
//   Punto 14: Flecha ▲▼ calculada CORRECTAMENTE:
//             posición ACTUAL en ranking total vs posición en
//             puntosDelDia de AYER ordenado por puntos del día.
//             diff = posAyer - posActual (positivo = subió).
//   Mantiene: colores oro/plata/bronce, numeración con empates,
//             modal de perfil + historial, número de fondo gigante.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { ayerStr } from "../utils/helpers";
import { AVATARES, CARTAS } from "../data/sampleData";
import HistorialPredicciones from "./HistorialPredicciones";

const FONDO_POS = {
  1: { bg:"rgba(212,175,55,0.22)", borde:"rgba(212,175,55,0.6)", texto:"#f4d03f" },
  2: { bg:"rgba(160,160,160,0.18)", borde:"rgba(160,160,160,0.5)", texto:"#c8c8c8" },
  3: { bg:"rgba(176,107,45,0.18)", borde:"rgba(176,107,45,0.5)", texto:"#cd7f32" },
};

function AvatarSmall({ avatarId, avatarSlug }) {
  const src = avatarSlug
    ? `/avatares/${avatarSlug}-1.png`
    : `/avatares/${(AVATARES.find(a=>a.id===avatarId)?.slug||"default")}-1.png`;
  return (
    <img src={src} alt="" style={{ width:22,height:22,imageRendering:"pixelated",flexShrink:0 }}
      onError={e=>(e.target.style.display="none")} />
  );
}

function ModalPerfilConHistorial({ jugador, onCerrar }) {
  const [tab, setTab] = useState("historial");
  if (!jugador) return null;
  const cartasMap     = jugador.cartas || {};
  const cartasDesbloq = CARTAS.filter(c => (cartasMap[c.id]||0) > 0);
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:600,
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:"20px",overflowY:"auto" }} onClick={onCerrar}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--verde-claro)",
        boxShadow:"6px 6px 0 var(--verde-oscuro)",maxWidth:"400px",width:"100%",
        maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px" }}>
          <img src={`/avatares/${jugador.avatarSlug||"default"}-1.png`} alt={jugador.nickname}
            style={{ width:60,height:60,imageRendering:"pixelated",border:"3px solid var(--negro)" }}
            onError={e=>(e.target.style.display="none")} />
          <p style={{ fontSize:"10px",color:"var(--amarillo)",textAlign:"center" }}>{jugador.nickname}</p>
          {jugador.nombreReal && (
            <p style={{ fontSize:"6px",color:"var(--gris-claro)" }}>👤 {jugador.nombreReal}</p>
          )}
          <span className="puntos-badge" style={{ fontSize:"11px" }}>{jugador.puntosTotal??0} pts</span>
        </div>
        <div style={{ display:"flex",borderTop:"2px solid var(--verde-campo)",borderBottom:"2px solid var(--verde-campo)" }}>
          {[{id:"historial",label:"🔮 PRONÓSTICOS"},{id:"perfil",label:"👤 INFO"}].map(t=>(
            <button key={t.id}
              style={{ flex:1,fontFamily:"'Press Start 2P',monospace",fontSize:"5px",padding:"7px",
                background:tab===t.id?"var(--verde-campo)":"var(--negro)",
                color:tab===t.id?"var(--negro)":"var(--gris-claro)",
                border:"none",cursor:"pointer" }}
              onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div style={{ flex:1,overflowY:"auto" }}>
          {tab==="historial" && <HistorialPredicciones userId={jugador.uid} />}
          {tab==="perfil" && (
            <div style={{ padding:"12px",fontSize:"7px",color:"var(--gris-claro)",lineHeight:2 }}>
              <p>🎯 Puntos: <span style={{ color:"var(--amarillo)" }}>{jugador.puntosTotal??0}</span></p>
              <p>🃏 Cartas: <span style={{ color:"var(--amarillo)" }}>{cartasDesbloq.length}</span></p>
            </div>
          )}
        </div>
        <div style={{ padding:"10px",borderTop:"2px solid var(--verde-campo)" }}>
          <button className="btn-pixel btn-gris w-full" style={{ fontSize:"7px" }} onClick={onCerrar}>CERRAR ✕</button>
        </div>
      </div>
    </div>
  );
}

export default function Ranking({ onVolver }) {
  const { firebaseUser } = useAuth();
  const [usuarios,    setUsuarios]    = useState([]);
  // Mapa uid → posición en ranking de AYER (según puntosDelDia)
  const [rankingAyer, setRankingAyer] = useState({});
  const [cargando,    setCargando]    = useState(true);
  const [jugadorSel,  setJugadorSel]  = useState(null);

  // Punto 5: recarga al montar
  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      // Ranking actual (puntosTotal desc)
      const snapU = await getDocs(query(collection(db,"usuarios"), orderBy("puntosTotal","desc")));
      const lista = snapU.docs.map(d => ({ id:d.id, ...d.data() }));
      setUsuarios(lista);

      // Punto 14: ranking de AYER usando puntosDelDia
      // Se ordena por puntos del DÍA (no por puntosTotal acumulado).
      const ayer     = ayerStr();
      const snapAyer = await getDocs(query(collection(db,"puntosDelDia"), where("fecha","==",ayer)));
      if (!snapAyer.empty) {
        // Ordenar por puntos del día desc → determinar posición de ayer
        const ayerOrd = snapAyer.docs.map(d=>d.data()).sort((a,b)=>b.puntos-a.puntos);
        const mapaAyer = {};
        let posAyer = 1;
        for (let i=0; i<ayerOrd.length; i++) {
          if (i>0 && ayerOrd[i].puntos < ayerOrd[i-1].puntos) posAyer = i+1;
          mapaAyer[ayerOrd[i].uid] = posAyer;
        }
        setRankingAyer(mapaAyer);
      }
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  // Dense rank para posición actual en ranking total
  const filasMeta = (() => {
    const result = [];
    for (let i=0; i<usuarios.length; i++) {
      const u = usuarios[i];
      let posicion;
      if (i===0 || u.puntosTotal < usuarios[i-1].puntosTotal) {
        posicion = i+1;
      } else {
        posicion = result[i-1].posicion;
      }
      const esPrimero = (i===0) || (u.puntosTotal < usuarios[i-1].puntosTotal);
      result.push({ posicion, esPrimero });
    }
    return result;
  })();

  const medallas = ["🥇","🥈","🥉"];
  const tengoAyer = Object.keys(rankingAyer).length > 0;

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px" }}>
        {onVolver && (
          <button className="btn-pixel btn-gris" onClick={onVolver}
            style={{ padding:"8px 12px",fontSize:"8px" }}>← VOLVER</button>
        )}
        <h2 className="text-amarillo">🏆 RANKING COMPLETO</h2>
        <button className="btn-pixel btn-gris" onClick={cargar}
          style={{ marginLeft:"auto",fontSize:"6px",padding:"5px 8px" }}>
          🔄
        </button>
      </div>

      {tengoAyer && (
        <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginBottom:"10px",lineHeight:2 }}>
          ▲▼ = cambio de posición en el ranking respecto al día de ayer
        </p>
      )}

      {cargando ? (
        <div className="text-center" style={{ padding:"40px",fontSize:"8px",color:"var(--verde-claro)" }}>
          <span className="spinner">⚙</span><br/><br/>CARGANDO...
        </div>
      ) : (
        <div className="caja-pixel" style={{ padding:0,overflow:"hidden" }}>
          <table className="ranking-tabla" style={{ borderCollapse:"collapse",width:"100%" }}>
            <thead>
              <tr>
                <th style={{ width:"28px",textAlign:"center" }}>#</th>
                <th>JUGADOR</th>
                <th style={{ textAlign:"right",paddingRight:"10px" }}>PUNTOS</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u,i) => {
                const { posicion, esPrimero } = filasMeta[i];
                const estilo   = FONDO_POS[posicion];
                const isTop    = posicion <= 3;
                // Punto 14: diff = posición de ayer - posición actual
                // positivo = subió puestos, negativo = bajó
                const posAyer  = rankingAyer[u.uid];
                const diff     = posAyer !== undefined ? posAyer - posicion : null;

                return (
                  <tr key={u.id} onClick={()=>setJugadorSel(u)}
                    style={{
                      cursor:"pointer",
                      background: estilo?.bg || (i%2===0?"rgba(255,255,255,0.03)":"transparent"),
                      borderLeft: estilo?`3px solid ${estilo.borde}`:"3px solid transparent",
                      borderBottom:"1px solid rgba(82,183,136,0.15)",
                    }}>

                    {/* # */}
                    <td style={{ position:"relative",textAlign:"center",
                      padding:isTop?"12px 4px":"8px 4px",width:"28px",
                      fontFamily:"'Press Start 2P',monospace",
                      fontSize:isTop?"10px":"7px",
                      color:estilo?.texto||"var(--gris-claro)" }}>
                      {isTop && esPrimero && (
                        <div style={{ position:"absolute",top:0,left:0,right:0,bottom:0,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:"48px",fontWeight:"bold",
                          color:estilo?.texto==="var(--gris-claro)"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.12)",
                          pointerEvents:"none",zIndex:0,
                          fontFamily:"'Press Start 2P',monospace" }}>
                          {posicion}
                        </div>
                      )}
                      <span style={{ position:"relative",zIndex:1 }}>
                        {esPrimero ? (posicion<=3?medallas[posicion-1]:posicion) : ""}
                      </span>
                    </td>

                    {/* Jugador */}
                    <td style={{ padding:isTop?"12px 6px":"8px 6px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:isTop?"10px":"6px" }}>
                        <AvatarSmall avatarId={u.avatarId} avatarSlug={u.avatarSlug} />
                        <div style={{ fontSize:isTop?"9px":"7px",color:"var(--blanco)",lineHeight:1.6 }}>
                          {u.nickname}
                          {u.uid===firebaseUser?.uid && (
                            <span style={{ marginLeft:"6px",fontSize:"5px",
                              background:"var(--verde-claro)",color:"var(--negro)",
                              padding:"1px 4px",border:"1px solid var(--negro)" }}>TÚ</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Puntos + flecha */}
                    <td style={{ textAlign:"right",padding:isTop?"12px 10px":"8px 10px 8px 4px" }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"6px" }}>
                        {/* Flecha a la izquierda de los puntos */}
                        {diff !== null && diff !== 0 ? (
                          <span style={{ fontFamily:"'Press Start 2P',monospace",
                            fontSize:isTop?"11px":"9px",lineHeight:1,
                            color:diff>0?"#4ade80":"var(--rojo-chile)" }}>
                            {diff>0?`▲${diff}`:`▼${Math.abs(diff)}`}
                          </span>
                        ) : diff === 0 ? (
                          <span style={{ fontSize:"8px",color:"var(--gris)",lineHeight:1 }}>—</span>
                        ) : null}
                        <span className="puntos-badge"
                          style={{ fontSize:isTop?"12px":"9px",
                            color:estilo?.texto||undefined }}>
                          {u.puntosTotal??0}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length===0 && (
                <tr><td colSpan={3} style={{ textAlign:"center",padding:"20px",
                  fontSize:"7px",color:"var(--gris-claro)" }}>Aún no hay jugadores</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {jugadorSel && (
        <ModalPerfilConHistorial jugador={jugadorSel} onCerrar={()=>setJugadorSel(null)} />
      )}
    </div>
  );
}
