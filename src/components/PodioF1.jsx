// src/components/PodioF1.jsx  — v6 (Fase 3)
// ─────────────────────────────────────────────────────────────
// REDISEÑO COMPLETO (ítem l):
//   • Tres columnas horizontales: 1°, 2°, 3° (izq-centro-der)
//   • Cada columna: número grande, color distintivo (oro/plata/bronce)
//   • Si hay empate en un lugar → carrusel automático (cada 2s)
//     + puntos deslizables con swipe
//   • Fecha del día anterior arriba del podio
//   • Click en avatar → ModalPerfilConHistorial (igual que Fase 2)
//   • Confeti al cargar
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from "react";
import { AVATARES, avatarFrame, CARTAS } from "../data/sampleData";
// HistorialPredicciones import removed to avoid dependency issues

const COLORES = {
  1: { fondo: "#c9a227", borde: "#8a6e00", num: "#3d2e00" },
  2: { fondo: "#8e9196", borde: "#5a5d61", num: "#1a1a1a" },
  3: { fondo: "#9c6b2e", borde: "#6b4410", num: "#2a1a00" },
};
const ETIQUETAS = { 1: "🥇 1°", 2: "🥈 2°", 3: "🥉 3°" };

// ── Avatar animado ────────────────────────────────────────────
function AvatarAnimado({ avatarId, size = 64 }) {
  const [frame, setFrame] = useState(1);
  const av = AVATARES.find(a => a.id === avatarId);
  useEffect(() => {
    const iv = setInterval(() => setFrame(f => f === 3 ? 1 : f + 1), 200);
    return () => clearInterval(iv);
  }, []);
  if (!av) return <div style={{ width:size,height:size,background:"#333",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5 }}>?</div>;
  return (
    <img src={avatarFrame(av.slug, frame)} alt={av.nombre}
      style={{ width:size,height:size,imageRendering:"pixelated",objectFit:"cover",
        border:"3px solid var(--negro)",boxShadow:"2px 2px 0 var(--negro)" }}
      onError={e => { e.target.style.display="none"; }}
    />
  );
}

// ── Columna de lugar con carrusel ─────────────────────────────
function ColumnaLugar({ lugar, jugadores, onClickJugador }) {
  const [idx, setIdx] = useState(0);
  const startXRef = useRef(null);
  const col = COLORES[lugar];

  // Carrusel automático cada 2s
  useEffect(() => {
    if (jugadores.length <= 1) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % jugadores.length), 2000);
    return () => clearInterval(iv);
  }, [jugadores.length]);

  const handleSwipeStart = e => { startXRef.current = e.touches?.[0]?.clientX ?? e.clientX; };
  const handleSwipeEnd = e => {
    if (startXRef.current === null) return;
    const endX = e.changedTouches?.[0]?.clientX ?? e.clientX;
    const diff = startXRef.current - endX;
    if (Math.abs(diff) > 30) {
      setIdx(i => diff > 0
        ? (i + 1) % jugadores.length
        : (i - 1 + jugadores.length) % jugadores.length
      );
    }
    startXRef.current = null;
  };

  const j = jugadores[idx];

  return (
    <div style={{
      flex: 1, display:"flex", flexDirection:"column", alignItems:"center", gap:"6px",
      padding: "10px 6px",
      background: `${col.fondo}22`,
      border: `3px solid ${col.borde}`,
      boxShadow: `3px 3px 0 ${col.borde}`,
      position:"relative",
    }}
      onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}
      onMouseDown={handleSwipeStart} onMouseUp={handleSwipeEnd}
    >
      {/* Número grande */}
      <div style={{
        fontFamily:"'Press Start 2P',monospace",
        fontSize:"28px", fontWeight:"bold",
        color: col.num,
        background: col.fondo,
        border: `3px solid ${col.borde}`,
        width:"48px", height:"48px",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow: `3px 3px 0 ${col.borde}`,
        flexShrink: 0,
      }}>
        {lugar}
      </div>

      {/* Avatar clicable */}
      <div
        style={{ cursor:"pointer", position:"relative" }}
        onClick={() => onClickJugador(j)}
      >
        <AvatarAnimado avatarId={j.avatarId} size={60} />
        {jugadores.length > 1 && (
          <div style={{
            position:"absolute", bottom:"-2px", right:"-2px",
            background:"var(--negro)", border:`1px solid ${col.borde}`,
            fontSize:"5px", fontFamily:"'Press Start 2P',monospace",
            color:col.fondo, padding:"1px 3px", lineHeight:1.5,
          }}>
            {idx+1}/{jugadores.length}
          </div>
        )}
      </div>

      {/* Nombre */}
      <p style={{
        fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
        color:"var(--blanco)", textAlign:"center",
        maxWidth:"80px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
      }}>
        {j.nickname}
      </p>

      {/* Puntos */}
      <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px", color:"var(--verde-claro)" }}>
        {j.puntos}pts
      </p>

      {/* Indicador de múltiples jugadores */}
      {jugadores.length > 1 && (
        <div style={{ display:"flex", gap:"3px" }}>
          {jugadores.map((_,i) => (
            <div key={i} style={{
              width:"5px", height:"5px",
              background: i === idx ? col.fondo : "var(--gris)",
              border:`1px solid ${col.borde}`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Confeti ───────────────────────────────────────────────────
function Confeti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff"];
    const parts  = Array.from({length:120}, () => ({
      x: Math.random()*canvas.width, y: Math.random()*canvas.height - canvas.height,
      size: Math.random()*6+2, speedY: Math.random()*3+2,
      speedX: (Math.random()-0.5)*2, color: colors[Math.floor(Math.random()*colors.length)],
      rot: Math.random()*360, rotS: (Math.random()-0.5)*10,
    }));
    const start = performance.now(); let animId;
    const draw = now => {
      if (now - start >= 3000) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (const p of parts) {
        p.y += p.speedY; p.x += p.speedX; p.rot += p.rotS;
        if (p.y > canvas.height) p.y = 0;
        if (p.x > canvas.width) p.x = 0; if (p.x < 0) p.x = canvas.width;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
        ctx.restore();
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:200 }} />;
}

// ── Modal perfil + historial ──────────────────────────────────
function ModalPerfilConHistorial({ jugador, onCerrar }) {
  const [tab, setTab] = useState("historial");
  const [frame, setFrame] = useState(1);
  const av = jugador?.avatarId ? AVATARES.find(a => a.id === jugador.avatarId) : null;
  useEffect(() => {
    const iv = setInterval(() => setFrame(f => f===3?1:f+1), 200);
    return () => clearInterval(iv);
  }, []);
  if (!jugador) return null;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:600,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",overflowY:"auto" }}
      onClick={onCerrar}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--verde-claro)",
        boxShadow:"6px 6px 0 var(--verde-oscuro)",maxWidth:"400px",width:"100%",
        maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px" }}>
          {av
            ? <img src={avatarFrame(av.slug,frame)} alt={av.nombre}
                style={{ width:64,height:64,imageRendering:"pixelated",objectFit:"cover",
                  border:"3px solid var(--negro)",boxShadow:"2px 2px 0 var(--negro)" }}
                onError={e => { e.target.style.display="none"; }} />
            : <div style={{ width:64,height:64,background:"#333",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32 }}>?</div>
          }
          <p style={{ fontSize:"10px",color:"var(--amarillo)",textAlign:"center" }}>{jugador.nickname}</p>
          <span className="puntos-badge" style={{ fontSize:"11px" }}>
            {jugador.puntos ?? jugador.puntosTotal ?? 0} pts
          </span>
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
          {tab === "historial" && (
            <div style={{ padding:"12px",textAlign:"center" }}>
              <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                Ve al RANKING y haz clic en el jugador<br/>para ver su historial completo.
              </p>
            </div>
          )}
          {tab === "perfil" && (
            <div style={{ padding:"12px",fontSize:"7px",color:"var(--gris-claro)",lineHeight:2 }}>
              <p>🎯 Puntos: <span style={{ color:"var(--amarillo)" }}>{jugador.puntos ?? jugador.puntosTotal ?? 0}</span></p>
              {Object.keys(jugador.cartas||{}).length > 0 && (
                <p>🃏 Cartas: <span style={{ color:"var(--amarillo)" }}>
                  {Object.values(jugador.cartas||{}).reduce((s,c)=>s+c,0)}
                </span></p>
              )}
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

// ── Componente principal ──────────────────────────────────────
export default function PodioF1({ datos }) {
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  const [mostrarConfeti, setMostrarConfeti] = useState(false);

  useEffect(() => {
    if (datos && datos.length > 0) setMostrarConfeti(true);
  }, [datos]);

  if (!datos || datos.length === 0) {
    return (
      <div className="caja-pixel text-center mb-16">
        <p style={{ fontSize:"7px",color:"var(--gris-claro)" }}>
          Sin podio todavía. ¡Juega hoy para aparecer mañana!
        </p>
      </div>
    );
  }

  // Construir lugares
  const pts1 = datos[0].puntos;
  const l1   = datos.filter(j => j.puntos === pts1);
  const r1   = datos.filter(j => j.puntos < pts1);
  const pts2 = r1[0]?.puntos;
  const l2   = pts2 !== undefined ? r1.filter(j => j.puntos === pts2) : [];
  const r2   = r1.filter(j => j.puntos < (pts2 ?? -Infinity));
  const pts3 = r2[0]?.puntos;
  const l3   = pts3 !== undefined ? r2.filter(j => j.puntos === pts3) : [];

  // Fecha del podio (fecha de los datos)
  const fechaPodio = datos[0]?.fecha;
  let labelPodio = "";
  if (fechaPodio) {
    const [y,m,d] = fechaPodio.split("-").map(Number);
    const meses = ["enero","febrero","marzo","abril","mayo","junio",
                   "julio","agosto","septiembre","octubre","noviembre","diciembre"];
    labelPodio = `${d} de ${meses[m-1]} de ${y}`;
  }

  return (
    <>
      {mostrarConfeti && <Confeti />}
      {perfilAbierto && (
        <ModalPerfilConHistorial jugador={perfilAbierto} onCerrar={() => setPerfilAbierto(null)} />
      )}

      <div className="caja-pixel mb-16" style={{ padding:"12px 8px" }}>
        {labelPodio && (
          <p style={{ fontSize:"5px",color:"var(--gris-claro)",textAlign:"center",marginBottom:"10px" }}>
            Podio del {labelPodio}
          </p>
        )}

        {/* Columnas del podio: 1°, 2°, 3° */}
        <div style={{ display:"flex",gap:"6px",alignItems:"stretch" }}>
          {l2.length > 0
            ? <ColumnaLugar lugar={2} jugadores={l2} onClickJugador={setPerfilAbierto} />
            : <div style={{ flex:1, border:"2px dashed var(--gris)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <p style={{ fontSize:"5px",color:"var(--gris)" }}>—</p>
              </div>
          }
          <ColumnaLugar lugar={1} jugadores={l1} onClickJugador={setPerfilAbierto} />
          {l3.length > 0
            ? <ColumnaLugar lugar={3} jugadores={l3} onClickJugador={setPerfilAbierto} />
            : <div style={{ flex:1, border:"2px dashed var(--gris)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <p style={{ fontSize:"5px",color:"var(--gris)" }}>—</p>
              </div>
          }
        </div>

        <p style={{ fontSize:"5px",color:"var(--gris-claro)",textAlign:"center",marginTop:"8px" }}>
          Toca un avatar para ver el perfil y pronósticos
        </p>
      </div>
    </>
  );
}
