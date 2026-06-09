// src/components/FraseCinema.jsx
// ─────────────────────────────────────────────────────────────
// Pantalla cinematográfica de la frase del día.
// Se muestra UNA VEZ POR DÍA, justo después del login
// (antes del Dashboard). Fade-in → espera → fade-out → callback.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { FRASES_DEL_DIA } from "../data/sampleData";
import { hoyStr } from "../utils/helpers";

// LocalStorage key: guarda la fecha en que se vio la frase
const LS_KEY = "cp8b_frase_fecha";

// Elige la frase del día de forma determinista según la fecha
function getFraseDelDia() {
  const hoy = hoyStr();
  // Índice basado en el día del año (0-based), cíclico sobre el array
  const inicio = new Date("2026-06-11");
  const ahora  = new Date();
  const diffDias = Math.max(0, Math.floor((ahora - inicio) / 86400000));
  const idx = diffDias % FRASES_DEL_DIA.length;
  return FRASES_DEL_DIA[idx];
}

// Verifica si ya se mostró hoy
export function fraseCinemaYaVistahoy() {
  return localStorage.getItem(LS_KEY) === hoyStr();
}

// Marca que ya se mostró hoy
function marcarVistaHoy() {
  localStorage.setItem(LS_KEY, hoyStr());
}

// ── Componente ────────────────────────────────────────────────
export default function FraseCinema({ onTerminar }) {
  const [fase, setFase] = useState("fadein"); // "fadein" | "visible" | "fadeout"
  const frase = getFraseDelDia();

  useEffect(() => {
    // 0.8s fade-in → 3.5s visible → 0.8s fade-out → callback
    const t1 = setTimeout(() => setFase("visible"),  800);
    const t2 = setTimeout(() => setFase("fadeout"), 4300);
    const t3 = setTimeout(() => {
      marcarVistaHoy();
      onTerminar();
    }, 5100);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const opacity =
    fase === "fadein"   ? 0   :
    fase === "visible"  ? 1   : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "32px",
      }}
      // Saltar al tocar
      onClick={() => { marcarVistaHoy(); onTerminar(); }}
    >
      <div
        style={{
          opacity,
          transition: "opacity 0.8s ease",
          textAlign: "center",
          maxWidth: "460px",
        }}
      >
        {/* Línea decorativa superior */}
        <div style={{
          width: "60px", height: "3px",
          background: "linear-gradient(90deg, transparent, #f4d03f, transparent)",
          margin: "0 auto 28px",
        }} />

        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "clamp(8px, 2.5vw, 11px)",
          color: "#f4d03f",
          lineHeight: 2.4,
          letterSpacing: "1px",
          textShadow: "0 0 20px rgba(244,208,63,0.4)",
        }}>
          "{frase}"
        </p>

        {/* Línea decorativa inferior */}
        <div style={{
          width: "60px", height: "3px",
          background: "linear-gradient(90deg, transparent, #f4d03f, transparent)",
          margin: "28px auto 0",
        }} />

        <p style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "6px",
          color: "rgba(255,255,255,0.25)",
          marginTop: "20px",
        }}>
          toca para continuar
        </p>
      </div>
    </div>
  );
}
