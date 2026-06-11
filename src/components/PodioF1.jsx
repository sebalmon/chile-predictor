// src/components/PodioF1.jsx  — Podio estilo F1 con números grandes, avatares ampliados, sin bordes y confeti
import React, { useState, useEffect, useRef } from "react";
import { AVATARES, avatarFrame } from "../data/sampleData";
import ModalPerfilResumido from "./ModalPerfilResumido";

// ── Componente: avatar animado (sin bordes) ─────────────────
function AvatarAnimado({ avatarId, size = 56 }) {
  const [frame, setFrame] = useState(1);
  const av = AVATARES.find((a) => a.id === avatarId);

  useEffect(() => {
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
        objectFit: "cover",
      }}
      onError={(e) => {
        e.target.style.display = "none";
        if (e.target.parentElement) e.target.parentElement.innerHTML = "?";
      }}
    />
  );
}

// ── Componente confeti ──────────────────────────────────────
function Confeti() {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const particles = [];
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ff8800"];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 6 + 2,
        speedY: Math.random() * 3 + 2,
        speedX: (Math.random() - 0.5) * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let animationId;
    let startTime = performance.now();
    const duration = 3000; // 3 segundos

    const animate = (now) => {
      const elapsed = now - startTime;
      if (elapsed >= duration) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animationId);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let p of particles) {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height) p.y = 0;
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [dimensions]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 200,
      }}
    />
  );
}

// ── Escalón con números grandes y avatares más grandes ──────
function Escalon({ numero, jugadores, altura, colorMedal, onClickJugador }) {
  // Números grandes en lugar de medallas
  const numeroGrande = numero === 1 ? "1" : numero === 2 ? "2" : "3";
  const alturaEscalon = numero === 1 ? 90 : numero === 2 ? 70 : 50;
  const tamanioAvatar = numero === 1 ? 70 : numero === 2 ? 60 : 50;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "8px",
    }}>
      {/* Avatares apilados horizontalmente */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
        {jugadores.map((j, idx) => (
          <div key={idx}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: "pointer" }}
            onClick={() => onClickJugador(j)}
          >
            <AvatarAnimado avatarId={j.avatarId} size={tamanioAvatar} />
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "6px", color: "var(--blanco)",
              maxWidth: "70px", textOverflow: "ellipsis",
              overflow: "hidden", whiteSpace: "nowrap",
              textAlign: "center",
            }}>
              {j.nickname}
            </span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "6px", color: "var(--verde-claro)" }}>
              {j.puntos}pts
            </span>
          </div>
        ))}
      </div>

      {/* Bloque del escalón con número grande */}
      <div style={{
        width: "100%", minWidth: "70px",
        height: `${alturaEscalon}px`,
        background: colorMedal,
        border: "3px solid var(--negro)",
        boxShadow: "4px 4px 0 var(--negro)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "32px",
        fontWeight: "bold",
        color: "var(--negro)",
      }}>
        {numeroGrande}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function PodioF1({ datos }) {
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  const [mostrarConfeti, setMostrarConfeti] = useState(false);

  useEffect(() => {
    // Activar confeti solo si hay datos (podio visible)
    if (datos && datos.length > 0) {
      setMostrarConfeti(true);
      // Ocultar confeti después de 3 segundos (ya lo maneja el componente)
    }
  }, [datos]);

  if (!datos || datos.length === 0) {
    return (
      <div className="caja-pixel text-center mb-16">
        <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>
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
      {mostrarConfeti && <Confeti />}
      {perfilAbierto && (
        <ModalPerfilResumido
          jugador={perfilAbierto}
          onCerrar={() => setPerfilAbierto(null)}
        />
      )}

      <div className="caja-pixel mb-16" style={{ padding: "20px 8px" }}>
        <div style={{
          display: "flex", alignItems: "flex-end",
          justifyContent: "center", gap: "12px",
        }}>
          {/* 2° lugar */}
          {lugar2.length > 0 && (
            <Escalon numero={2} jugadores={lugar2} altura={70}
              colorMedal="var(--gris-claro)" onClickJugador={setPerfilAbierto} />
          )}

          {/* 1° lugar — más alto */}
          <Escalon numero={1} jugadores={lugar1} altura={90}
            colorMedal="var(--amarillo)" onClickJugador={setPerfilAbierto} />

          {/* 3° lugar */}
          {lugar3.length > 0 && (
            <Escalon numero={3} jugadores={lugar3} altura={50}
              colorMedal="#cd7f32" onClickJugador={setPerfilAbierto} />
          )}
        </div>

        {/* Base del podio */}
        <div style={{
          height: "8px", background: "var(--negro)",
          marginTop: "8px", border: "3px solid var(--negro)",
          boxShadow: "0 4px 0 var(--negro)",
        }} />
      </div>
    </>
  );
}