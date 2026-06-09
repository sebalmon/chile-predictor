// src/components/PodioF1.jsx
// ─────────────────────────────────────────────────────────────
// Podio estilo Fórmula 1 con:
// - Escalinata estática (1°, 2°, 3°) con soporte de empates
// - Avatares animados (3 fotogramas de pixel art en bucle)
// - Click en avatar abre modal de perfil resumido
// ─────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { AVATARES, avatarFrame } from "../data/sampleData";

// ── Componente: avatar animado ────────────────────────────────
function AvatarAnimado({ avatarId, size = 56, style = {} }) {
  const [frame, setFrame] = React.useState(1);
  const av = AVATARES.find((a) => a.id === avatarId);

  React.useEffect(() => {
    const iv = setInterval(() => {
      setFrame((f) => (f === 3 ? 1 : f + 1));
    }, 200);
    return () => clearInterval(iv);
  }, []);

  if (!av) return (
    <div style={{ width: size, height: size, background: "#333",
      border: "2px solid #555", display:"flex",alignItems:"center",
      justifyContent:"center", fontSize: size*0.5, ...style }}>
      ?
    </div>
  );

  return (
    <img
      src={avatarFrame(av.slug, frame)}
      alt={av.nombre}
      style={{
        width: size, height: size,
        imageRendering: "pixelated",
        border: "3px solid var(--negro)",
        boxShadow: "2px 2px 0 var(--negro)",
        objectFit: "cover",
        ...style,
      }}
      onError={(e) => {
        // Fallback si la imagen no existe aún
        e.target.style.display = "none";
        e.target.parentElement.style.fontSize = `${size*0.5}px`;
        e.target.parentElement.innerHTML = "?";
      }}
    />
  );
}

// ── Modal: perfil resumido ────────────────────────────────────
function ModalPerfilResumido({ jugador, onCerrar }) {
  if (!jugador) return null;
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.85)", zIndex: 600,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}
      onClick={onCerrar}
    >
      <div
        style={{
          background: "var(--negro)", border: "4px solid var(--verde-claro)",
          boxShadow: "6px 6px 0 var(--verde-oscuro)",
          padding: "24px 20px", maxWidth: "320px", width: "100%",
          display: "flex", flexDirection: "column", gap: "14px",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {jugador.avatarId
          ? <AvatarAnimado avatarId={jugador.avatarId} size={72} />
          : <span style={{ fontSize: "60px" }}>?</span>
        }
        <p style={{ fontSize: "10px", color: "var(--amarillo)", textAlign: "center" }}>
          {jugador.nickname}
        </p>
        <div style={{ display:"flex", gap:"16px" }}>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:"6px", color:"var(--gris-claro)" }}>PUNTOS HOY</p>
            <span className="puntos-badge" style={{ fontSize:"10px" }}>{jugador.puntos}</span>
          </div>
        </div>
        <button className="btn-pixel btn-gris" style={{ fontSize:"7px" }} onClick={onCerrar}>
          CERRAR ✕
        </button>
      </div>
    </div>
  );
}

// ── Escalón con lista de jugadores ────────────────────────────
function Escalon({ numero, jugadores, altura, colorMedal, onClickJugador }) {
  const medallas = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "4px",
    }}>
      {/* avatares apilados horizontalmente */}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "center" }}>
        {jugadores.map((j, i) => (
          <div key={i}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"3px",
              cursor:"pointer" }}
            onClick={() => onClickJugador(j)}
          >
            <AvatarAnimado avatarId={j.avatarId} size={numero === 1 ? 52 : 42} />
            <span style={{
              fontFamily:"'Press Start 2P',monospace",
              fontSize: "5px", color:"var(--blanco)",
              maxWidth:"60px", textOverflow:"ellipsis",
              overflow:"hidden", whiteSpace:"nowrap",
              textAlign:"center",
            }}>
              {j.nickname}
            </span>
            <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px", color:"var(--verde-claro)" }}>
              {j.puntos}pts
            </span>
          </div>
        ))}
      </div>

      {/* Bloque del escalón */}
      <div style={{
        width: "100%", minWidth: "64px",
        height: `${altura}px`,
        background: colorMedal,
        border: "3px solid var(--negro)",
        boxShadow: "4px 4px 0 var(--negro)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily:"'Press Start 2P',monospace",
        fontSize: "14px",
      }}>
        {medallas[numero]}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function PodioF1({ datos }) {
  // datos: array de { uid, nickname, avatarId, puntos } ordenado desc
  const [perfilAbierto, setPerfilAbierto] = useState(null);

  if (!datos || datos.length === 0) {
    return (
      <div className="caja-pixel text-center mb-16">
        <p style={{ fontSize:"7px", color:"var(--gris-claro)" }}>
          Sin podio todavía. ¡Juega hoy para aparecer mañana!
        </p>
      </div>
    );
  }

  // Construir grupos por lugar considerando empates
  const pts1 = datos[0].puntos;
  const lugar1 = datos.filter(j => j.puntos === pts1);
  const r1     = datos.filter(j => j.puntos < pts1);
  const pts2   = r1[0]?.puntos;
  const lugar2 = pts2 !== undefined ? r1.filter(j => j.puntos === pts2) : [];
  const r2     = r1.filter(j => j.puntos < pts2);
  const pts3   = r2[0]?.puntos;
  const lugar3 = pts3 !== undefined ? r2.filter(j => j.puntos === pts3) : [];

  return (
    <>
      {perfilAbierto && (
        <ModalPerfilResumido
          jugador={perfilAbierto}
          onCerrar={() => setPerfilAbierto(null)}
        />
      )}

      <div className="caja-pixel mb-16" style={{ padding:"16px 8px" }}>
        <div style={{
          display: "flex", alignItems: "flex-end",
          justifyContent: "center", gap: "4px",
        }}>
          {/* 2° lugar */}
          {lugar2.length > 0 && (
            <Escalon numero={2} jugadores={lugar2} altura={52}
              colorMedal="var(--gris-claro)" onClickJugador={setPerfilAbierto} />
          )}

          {/* 1° lugar — más alto */}
          <Escalon numero={1} jugadores={lugar1} altura={72}
            colorMedal="var(--amarillo)" onClickJugador={setPerfilAbierto} />

          {/* 3° lugar */}
          {lugar3.length > 0 && (
            <Escalon numero={3} jugadores={lugar3} altura={36}
              colorMedal="#cd7f32" onClickJugador={setPerfilAbierto} />
          )}
        </div>

        {/* Base del podio */}
        <div style={{
          height:"6px", background:"var(--negro)",
          marginTop:"0", border:"3px solid var(--negro)",
          boxShadow:"0 4px 0 var(--negro)",
        }} />
      </div>
    </>
  );
}
