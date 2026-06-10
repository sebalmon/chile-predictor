// src/components/ModalPerfilResumido.jsx
import React from "react";
import { AVATARES, avatarFrame } from "../data/sampleData";

function AvatarAnimado({ avatarId, size = 56 }) {
  const [frame, setFrame] = React.useState(1);
  const av = AVATARES.find((a) => a.id === avatarId);

  React.useEffect(() => {
    const iv = setInterval(() => {
      setFrame((f) => (f === 3 ? 1 : f + 1));
    }, 200);
    return () => clearInterval(iv);
  }, []);

  if (!av) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: "#333",
          border: "2px solid #555",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.5,
        }}
      >
        ?
      </div>
    );
  }

  return (
    <img
      src={avatarFrame(av.slug, frame)}
      alt={av.nombre}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        border: "3px solid var(--negro)",
        boxShadow: "2px 2px 0 var(--negro)",
        objectFit: "cover",
      }}
      onError={(e) => {
        e.target.style.display = "none";
        if (e.target.parentElement) {
          e.target.parentElement.innerHTML = "?";
        }
      }}
    />
  );
}

export default function ModalPerfilResumido({ jugador, onCerrar }) {
  if (!jugador) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          background: "var(--negro)",
          border: "4px solid var(--verde-claro)",
          boxShadow: "6px 6px 0 var(--verde-oscuro)",
          padding: "24px 20px",
          maxWidth: "320px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {jugador.avatarId ? (
          <AvatarAnimado avatarId={jugador.avatarId} size={72} />
        ) : (
          <span style={{ fontSize: "60px" }}>?</span>
        )}
        <p style={{ fontSize: "10px", color: "var(--amarillo)", textAlign: "center" }}>
          {jugador.nickname}
        </p>
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "6px", color: "var(--gris-claro)" }}>PUNTOS HOY</p>
            <span className="puntos-badge" style={{ fontSize: "10px" }}>
              {jugador.puntos}
            </span>
          </div>
        </div>
        <button className="btn-pixel btn-gris" style={{ fontSize: "7px" }} onClick={onCerrar}>
          CERRAR ✕
        </button>
      </div>
    </div>
  );
}