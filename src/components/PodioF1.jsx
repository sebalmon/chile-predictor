// src/components/PodioF1.jsx  — v5 (Fase 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v5:
//   • Click en avatar del podio abre ModalPerfilConHistorial
//     (mismo que el ranking) con el historial de pronósticos.
//   • Confeti y lógica del podio idénticos a v3/v4.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import { AVATARES, avatarFrame, CARTAS } from "../data/sampleData";
import HistorialPredicciones from "./HistorialPredicciones";

// ── Avatar animado ────────────────────────────────────────────
function AvatarAnimado({ avatarId, size = 56 }) {
  const [frame, setFrame] = useState(1);
  const av = AVATARES.find((a) => a.id === avatarId);

  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => (f === 3 ? 1 : f + 1)), 200);
    return () => clearInterval(iv);
  }, []);

  if (!av) {
    return (
      <div style={{ width: size, height: size, background: "#333",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.5 }}>?</div>
    );
  }

  return (
    <img
      src={avatarFrame(av.slug, frame)}
      alt={av.nombre}
      style={{ width: size, height: size, imageRendering: "pixelated", objectFit: "cover" }}
      onError={(e) => {
        e.target.style.display = "none";
        if (e.target.parentElement) e.target.parentElement.innerHTML = "?";
      }}
    />
  );
}

// ── Confeti ───────────────────────────────────────────────────
function Confeti() {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    canvas.width  = dimensions.width;
    canvas.height = dimensions.height;

    const colors    = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#ff8800"];
    const particles = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 6 + 2,
      speedY: Math.random() * 3 + 2,
      speedX: (Math.random() - 0.5) * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
    }));

    let animId;
    const start    = performance.now();
    const duration = 3000;

    const animate = (now) => {
      if (now - start >= duration) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.speedY; p.x += p.speedX; p.rotation += p.rotSpeed;
        if (p.y > canvas.height) p.y = 0;
        if (p.x > canvas.width)  p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [dimensions]);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0,
      width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 200,
    }} />
  );
}

// ── Modal perfil con historial (desde podio) ──────────────────
function ModalPerfilConHistorial({ jugador, onCerrar }) {
  const [tab, setTab] = useState("perfil");
  const [frame, setFrame] = useState(1);
  const av = jugador?.avatarId ? AVATARES.find((a) => a.id === jugador.avatarId) : null;

  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => (f === 3 ? 1 : f + 1)), 200);
    return () => clearInterval(iv);
  }, []);

  if (!jugador) return null;

  const cartasMap     = jugador.cartas || {};
  const cartasDesbloq = CARTAS.filter((c) => (cartasMap[c.id] || 0) > 0);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.95)", zIndex: 600,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", overflowY: "auto",
    }} onClick={onCerrar}>
      <div style={{
        background: "var(--negro)", border: "4px solid var(--verde-claro)",
        boxShadow: "6px 6px 0 var(--verde-oscuro)",
        maxWidth: "400px", width: "100%", maxHeight: "90vh",
        overflowY: "auto", display: "flex", flexDirection: "column",
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          {av ? (
            <img src={avatarFrame(av.slug, frame)} alt={av.nombre}
              style={{ width: 72, height: 72, imageRendering: "pixelated", objectFit: "cover",
                border: "3px solid var(--negro)", boxShadow: "2px 2px 0 var(--negro)" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : <div style={{ width: 72, height: 72, background: "#333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>?</div>}

          <p style={{ fontSize: "11px", color: "var(--amarillo)", textAlign: "center" }}>
            {jugador.nickname}
          </p>
          <p style={{ fontSize: "6px", color: "var(--verde-claro)" }}>PUNTOS</p>
          <span className="puntos-badge" style={{ fontSize: "13px" }}>
            {jugador.puntos ?? jugador.puntosTotal ?? 0}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderTop: "2px solid var(--verde-campo)", borderBottom: "2px solid var(--verde-campo)" }}>
          {[
            { id: "perfil",    label: "👤 PERFIL" },
            { id: "historial", label: "🔮 PRONÓSTICOS" },
          ].map((t) => (
            <button key={t.id}
              style={{
                flex: 1, fontFamily: "'Press Start 2P',monospace",
                fontSize: "6px", padding: "8px",
                background: tab === t.id ? "var(--verde-campo)" : "var(--negro)",
                color: tab === t.id ? "var(--negro)" : "var(--gris-claro)",
                border: "none", cursor: "pointer",
              }}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "perfil" && (
            <div style={{ padding: "12px", fontSize: "7px", color: "var(--gris-claro)", lineHeight: 2 }}>
              {jugador.nombreReal && <p>👤 {jugador.nombreReal}</p>}
              <p>🎯 Puntos: <span style={{ color: "var(--amarillo)" }}>{jugador.puntos ?? jugador.puntosTotal ?? 0}</span></p>
              <p>🃏 Cartas: <span style={{ color: "var(--amarillo)" }}>{cartasDesbloq.length}</span></p>
              {cartasDesbloq.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {cartasDesbloq.map((c) => (
                    <div key={c.id} style={{ textAlign: "center", width: "50px" }}>
                      <img src={`/cartas/${c.slug}.jpg`} alt={c.nombre}
                        style={{ width: "40px", height: "40px", imageRendering: "pixelated",
                          border: "2px solid var(--negro)" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "2px" }}>
                        ×{c.multiplicador}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "historial" && (
            <HistorialPredicciones userId={jugador.uid} />
          )}
        </div>

        <div style={{ padding: "12px", borderTop: "2px solid var(--verde-campo)" }}>
          <button className="btn-pixel btn-gris w-full" style={{ fontSize: "7px" }} onClick={onCerrar}>
            CERRAR ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Escalón del podio ─────────────────────────────────────────
function Escalon({ numero, jugadores, colorMedal, onClickJugador }) {
  const alturas    = { 1: 90, 2: 70, 3: 50 };
  const tamAvatar  = { 1: 70, 2: 60, 3: 50 };
  const alturaEsc  = alturas[numero]   || 50;
  const tamAv      = tamAvatar[numero] || 50;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
        {jugadores.map((j, idx) => (
          <div key={idx}
            style={{ display: "flex", flexDirection: "column", alignItems: "center",
              gap: "4px", cursor: "pointer" }}
            onClick={() => onClickJugador(j)}>
            <AvatarAnimado avatarId={j.avatarId} size={tamAv} />
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "6px",
              color: "var(--blanco)", maxWidth: "70px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
              {j.nickname}
            </span>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "6px",
              color: "var(--verde-claro)" }}>
              {j.puntos}pts
            </span>
          </div>
        ))}
      </div>

      <div style={{
        width: "100%", minWidth: "70px", height: `${alturaEsc}px`,
        background: colorMedal, border: "3px solid var(--negro)",
        boxShadow: "4px 4px 0 var(--negro)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Press Start 2P',monospace", fontSize: "32px",
        fontWeight: "bold", color: "var(--negro)",
      }}>
        {numero}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function PodioF1({ datos }) {
  const [perfilAbierto,   setPerfilAbierto]   = useState(null);
  const [mostrarConfeti, setMostrarConfeti] = useState(false);

  useEffect(() => {
    if (datos && datos.length > 0) setMostrarConfeti(true);
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

  const pts1   = datos[0].puntos;
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
        <ModalPerfilConHistorial
          jugador={perfilAbierto}
          onCerrar={() => setPerfilAbierto(null)}
        />
      )}

      <div className="caja-pixel mb-16" style={{ padding: "20px 8px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "12px" }}>
          {lugar2.length > 0 && (
            <Escalon numero={2} jugadores={lugar2} altura={70}
              colorMedal="var(--gris-claro)" onClickJugador={setPerfilAbierto} />
          )}
          <Escalon numero={1} jugadores={lugar1} altura={90}
            colorMedal="var(--amarillo)" onClickJugador={setPerfilAbierto} />
          {lugar3.length > 0 && (
            <Escalon numero={3} jugadores={lugar3} altura={50}
              colorMedal="#cd7f32" onClickJugador={setPerfilAbierto} />
          )}
        </div>
        <div style={{ height: "8px", background: "var(--negro)", marginTop: "8px",
          border: "3px solid var(--negro)", boxShadow: "0 4px 0 var(--negro)" }} />
      </div>
    </>
  );
}
