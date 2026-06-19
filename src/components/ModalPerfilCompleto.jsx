// src/components/ModalPerfilCompleto.jsx  — v7 (Patch 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v7 (punto 12):
//   • Muestra nombreReal del usuario pero NO el email (privacidad).
//   • Muestra cantidad de cartas correctamente desde usuarios.cartas (mapa).
//   • Integra HistorialPredicciones en una pestaña.
// ─────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { AVATARES, avatarFrame, CARTAS } from "../data/sampleData";
import HistorialPredicciones from "./HistorialPredicciones";

function AvatarAnimado({ avatarId, size = 72 }) {
  const [frame, setFrame] = React.useState(1);
  const av = AVATARES.find(a => a.id === avatarId);
  React.useEffect(() => {
    const iv = setInterval(() => setFrame(f => f===3?1:f+1), 200);
    return () => clearInterval(iv);
  }, []);
  if (!av) return (
    <div style={{ width:size,height:size,background:"#333",border:"2px solid #555",
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5 }}>?</div>
  );
  return (
    <img src={avatarFrame(av.slug,frame)} alt={av.nombre}
      style={{ width:size,height:size,imageRendering:"pixelated",
        border:"3px solid var(--negro)",boxShadow:"2px 2px 0 var(--negro)",objectFit:"cover" }}
      onError={e => { e.target.style.display="none"; if (e.target.parentElement) e.target.parentElement.innerHTML="?"; }}
    />
  );
}

export default function ModalPerfilCompleto({ usuario, onCerrar }) {
  const [tab, setTab] = useState("perfil");
  if (!usuario) return null;

  // Cartas: el mapa usuarios.cartas tiene { cartaId: cantidad }
  const cartasMap = usuario.cartas || {};
  const cartasInfo = CARTAS.filter(c => (cartasMap[c.id] || 0) > 0);
  const totalCartas = cartasInfo.reduce((s,c) => s + (cartasMap[c.id]||0), 0);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",overflowY:"auto" }}
      onClick={onCerrar}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--verde-claro)",
        boxShadow:"6px 6px 0 var(--verde-oscuro)",padding:0,maxWidth:"500px",width:"100%",
        maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"20px",textAlign:"center",borderBottom:"2px solid var(--verde-campo)" }}>
          {usuario.avatarId
            ? <AvatarAnimado avatarId={usuario.avatarId} size={80} />
            : <span style={{ fontSize:"70px" }}>?</span>
          }
          <p style={{ fontSize:"12px",color:"var(--amarillo)",marginTop:"10px",marginBottom:"6px" }}>
            {usuario.nickname}
          </p>
          {/* Punto 12: nombre real, SIN email */}
          {usuario.nombreReal && (
            <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginBottom:"4px" }}>
              👤 {usuario.nombreReal}
            </p>
          )}
          <div style={{ display:"flex",justifyContent:"center",gap:"20px",marginTop:"10px" }}>
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:"6px",color:"var(--gris-claro)" }}>PUNTOS TOTALES</p>
              <span className="puntos-badge" style={{ fontSize:"14px" }}>{usuario.puntosTotal??0}</span>
            </div>
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:"6px",color:"var(--gris-claro)" }}>CARTAS</p>
              <span className="puntos-badge" style={{ fontSize:"14px" }}>{totalCartas}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",borderBottom:"2px solid var(--verde-campo)" }}>
          {[{id:"perfil",label:"👤 PERFIL"},{id:"historial",label:"🔮 PRONÓSTICOS"}].map(t => (
            <button key={t.id}
              style={{ flex:1,fontFamily:"'Press Start 2P',monospace",fontSize:"6px",padding:"8px",
                background:tab===t.id?"var(--verde-campo)":"var(--negro)",
                color:tab===t.id?"var(--negro)":"var(--gris-claro)",
                border:"none",cursor:"pointer" }}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ flex:1,overflowY:"auto" }}>
          {tab === "historial" && <HistorialPredicciones userId={usuario.uid} />}
          {tab === "perfil" && (
            <div style={{ padding:"16px" }}>
              {cartasInfo.length === 0 ? (
                <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
                  No tiene cartas aún.
                </p>
              ) : (
                <>
                  <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"10px",textAlign:"center" }}>
                    🃏 CARTAS ({cartasInfo.length} tipos · {totalCartas} total)
                  </p>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"center" }}>
                    {cartasInfo.map(c => (
                      <div key={c.id} style={{ textAlign:"center",width:"70px" }}>
                        <img src={`/cartas/${c.slug}.jpg`} alt={c.nombre}
                          style={{ width:"50px",height:"50px",imageRendering:"pixelated",
                            border:"2px solid var(--amarillo)" }}
                          onError={e => { e.target.style.display="none"; e.target.parentElement.innerHTML="<span>🃏</span>"; }}
                        />
                        <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginTop:"3px" }}>
                          ×{c.multiplicador}
                        </p>
                        <p style={{ fontSize:"5px",color:"var(--amarillo)" }}>
                          x{cartasMap[c.id]}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ padding:"12px",borderTop:"2px solid var(--verde-campo)" }}>
          <button className="btn-pixel btn-gris w-full" style={{ fontSize:"7px" }} onClick={onCerrar}>
            CERRAR ✕
          </button>
        </div>
      </div>
    </div>
  );
}
