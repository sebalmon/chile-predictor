// src/components/ModalPerfilResumido.jsx (versión completa)
import React from "react";
import { AVATARES, avatarFrame, CARTAS } from "../data/sampleData";
import { cartaImg } from "../utils/sobre";

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
        if (e.target.parentElement) e.target.parentElement.innerHTML = "?";
      }}
    />
  );
}

export default function ModalPerfilResumido({ jugador, onCerrar }) {
  if (!jugador) return null;

  // Obtener las cartas desbloqueadas
  const cartasDesbloqueadas = jugador.cartasDesbloqueadas || [];
  const cartasInfo = CARTAS.filter(c => cartasDesbloqueadas.includes(c.id));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        zIndex: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        overflowY: "auto",
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          background: "var(--negro)",
          border: "4px solid var(--verde-claro)",
          boxShadow: "6px 6px 0 var(--verde-oscuro)",
          padding: "24px 20px",
          maxWidth: "380px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Avatar */}
        {jugador.avatarId ? (
          <AvatarAnimado avatarId={jugador.avatarId} size={80} />
        ) : (
          <span style={{ fontSize: "60px" }}>?</span>
        )}

        {/* Apodo */}
        <p style={{ fontSize: "12px", color: "var(--amarillo)", textAlign: "center" }}>
          {jugador.nickname}
        </p>

        {/* Nombre real */}
        {jugador.nombreReal && (
          <p style={{ fontSize: "8px", color: "var(--gris-claro)", textAlign: "center" }}>
            {jugador.nombreReal}
          </p>
        )}

        {/* Email */}
        {jugador.email && (
          <p style={{ fontSize: "7px", color: "var(--gris)", textAlign: "center" }}>
            {jugador.email}
          </p>
        )}

        {/* Puntos totales */}
        <div style={{ textAlign: "center", marginTop: "4px" }}>
          <p style={{ fontSize: "7px", color: "var(--verde-claro)" }}>PUNTOS TOTALES</p>
          <span className="puntos-badge" style={{ fontSize: "14px" }}>
            {jugador.puntosTotal ?? 0}
          </span>
        </div>

        {/* Cartas coleccionables */}
        {cartasInfo.length > 0 && (
          <div style={{ width: "100%", marginTop: "8px" }}>
            <p style={{ fontSize: "7px", color: "var(--amarillo)", textAlign: "center", marginBottom: "8px" }}>
              🃏 CARTAS ({cartasInfo.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" }}>
              {cartasInfo.map(carta => (
                <div key={carta.id} style={{ textAlign: "center", width: "60px" }}>
                  <img
                    src={cartaImg(carta.slug)}
                    alt={carta.nombre}
                    style={{ width: "50px", height: "50px", imageRendering: "pixelated", border: "2px solid var(--negro)" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "4px" }}>
                    {carta.nombre}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {cartasInfo.length === 0 && (
          <p style={{ fontSize: "6px", color: "var(--gris)", textAlign: "center" }}>
            Aún no tiene cartas coleccionables
          </p>
        )}

        <button
          className="btn-pixel btn-gris"
          style={{ fontSize: "8px", marginTop: "8px" }}
          onClick={onCerrar}
        >
          CERRAR ✕
        </button>
      </div>
    </div>
  );
}