// src/components/FraseCinema.jsx
// ─────────────────────────────────────────────────────────────
// Pantalla cinematográfica de la frase del día.
// MODIFICADO: Se muestra SIEMPRE al iniciar/recargar la app.
// Tiempos extendidos para una mayor duración en pantalla.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { FRASES_DEL_DIA } from "../data/sampleData";
import { hoyStr } from "../utils/helpers";

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

// Forzamos a que siempre devuelva falso para que la App no se salte este componente
export function fraseCinemaYaVistahoy() {
  return false; 
}

// ── Componente ────────────────────────────────────────────────
export default function FraseCinema({ onTerminar }) {
  const [fase, setFase] = useState("fadein"); // "fadein" | "visible" | "fadeout"
  const frase = getFraseDelDia();

  useEffect(() => {
    // NUEVA CRONOLOGÍA EXTENDIDA:
    // 0.8s fade-in → 7.0s visible (Dura el doble) → 0.8s fade-out → callback final
    const t1 = setTimeout(() => setFase("visible"), 800);
    const t2 = setTimeout(() => setFase("fadeout"), 8800); // 800ms + 7000ms
    const t3 = setTimeout(() => {
      onTerminar();
    }, 9600); // 7800ms + 800ms de fadeout

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onTerminar]);

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
        cursor: "pointer"
      }}
      // Saltar al tocar en cualquier momento
      onClick={onTerminar}
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
          whiteSpace: "pre-line",
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