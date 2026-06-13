// src/components/Ranking.jsx  — v6 (Fase 3)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v6:
//   • Flecha ▲▼ movida al lado DERECHO junto a los puntos,
//     con font-size aumentado (10px) para mayor visibilidad.
//     Formato: "45 pts ▲2" / "45 pts ▼1"
//   • HistorialPredicciones ahora usa la v6 (agrupado por día).
//   • Todo lo demás igual a v5.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { ayerStr } from "../utils/helpers";
import { AVATARES, avatarFrame, CARTAS } from "../data/sampleData";
import HistorialPredicciones from "./HistorialPredicciones";

function AvatarSmall({ avatarId }) {
  const av = AVATARES.find(a => a.id === avatarId);
  if (!av) return <span style={{ fontSize:"16px" }}>?</span>;
  return (
    <img src={`/avatares/${av.slug}-1.png`} alt={av.nombre}
      style={{ width:22,height:22,imageRendering:"pixelated" }}
      onError={e => (e.target.style.display="none")}
    />
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
        onClick={e => e.stopPropagation()}>

        <div style={{ padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px" }}>
          <img src={`/avatares/${jugador.avatarSlug||"default"}-1.png`} alt={jugador.nickname}
            style={{ width:60,height:60,imageRendering:"pixelated",border:"3px solid var(--negro)" }}
            onError={e => (e.target.style.display="none")} />
          <p style={{ fontSize:"10px",color:"var(--amarillo)",textAlign:"center" }}>{jugador.nickname}</p>
          <span className="puntos-badge" style={{ fontSize:"11px" }}>{jugador.puntosTotal??0} pts</span>
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
  const [rankingAyer, setRankingAyer] = useState({});
  const [cargando,    setCargando]    = useState(true);
  const [jugadorSel,  setJugadorSel]  = useState(null);
  const medallas = ["🥇","🥈","🥉"];

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const snapU = await getDocs(query(collection(db,"usuarios"), orderBy("puntosTotal","desc")));
      const lista = snapU.docs.map(d => ({ id:d.id, ...d.data() }));
      setUsuarios(lista);

      const ayer = ayerStr();
      const snapAyer = await getDocs(query(collection(db,"puntosDelDia"), where("fecha","==",ayer)));
      if (!snapAyer.empty) {
        const ayerOrd = snapAyer.docs.map(d => d.data()).sort((a,b) => b.puntos-a.puntos);
        const mapa = {};
        let pos = 1;
        for (let i=0; i<ayerOrd.length; i++) {
          if (i>0 && ayerOrd[i].puntos < ayerOrd[i-1].puntos) pos = i+1;
          mapa[ayerOrd[i].uid] = pos;
        }
        setRankingAyer(mapa);
      }
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  // Posiciones actuales (con empates)
  const posActuales = (() => {
    const m = {}; let pos = 1;
    for (let i=0; i<usuarios.length; i++) {
      if (i>0 && usuarios[i].puntosTotal < usuarios[i-1].puntosTotal) pos = i+1;
      m[usuarios[i].uid] = pos;
    }
    return m;
  })();

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
        <div className="caja-pixel">
          <table className="ranking-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>JUGADOR</th>
                <th style={{ textAlign:"right" }}>PUNTOS</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => {
                const posActual = posActuales[u.uid];
                const posAyer   = rankingAyer[u.uid];
                const diff      = posAyer && posActual ? posAyer - posActual : 0; // positivo = subió

                return (
                  <tr key={u.id}
                    className={u.uid === firebaseUser?.uid ? "ranking-fila-yo" : ""}
                    onClick={() => setJugadorSel(u)} style={{ cursor:"pointer" }}>
                    <td className="ranking-pos">{i < 3 ? medallas[i] : i+1}</td>
                    <td>
                      <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                        <AvatarSmall avatarId={u.avatarId} />
                        <div style={{ fontSize:"7px",color:"var(--blanco)" }}>
                          {u.nickname}
                          {u.uid === firebaseUser?.uid && (
                            <span style={{ marginLeft:"6px",fontSize:"5px",
                              background:"var(--verde-claro)",color:"var(--negro)",
                              padding:"1px 4px",border:"1px solid var(--negro)" }}>
                              TÚ
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign:"right" }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"5px" }}>
                        <span className="puntos-badge">{u.puntosTotal ?? 0}</span>
                        {diff !== 0 && (
                          <span style={{
                            fontFamily:"'Press Start 2P',monospace",
                            fontSize:"10px",
                            color: diff > 0 ? "#4ade80" : "var(--rojo-chile)",
                            lineHeight:1,
                          }}>
                            {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                          </span>
                        )}
                        {diff === 0 && posAyer && (
                          <span style={{ fontSize:"8px",color:"var(--gris)",lineHeight:1 }}>—</span>
                        )}
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
