// src/components/Splash.jsx
// ─────────────────────────────────────────────────────────────
// Splash cinematográfico con imágenes secuenciales.
// NUEVO: acepta prop `onFin` (callback cuando termina).
// NUEVO: al aparecer START, cualquier toque/clic lo salta.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from "react";

export default function Splash({ onFin }) {
  const [imagenesListas, setImagenesListas] = useState(false);
  const [mostrar1,   setMostrar1]   = useState(false);
  const [mostrar2,   setMostrar2]   = useState(false);
  const [mostrar3,   setMostrar3]   = useState(false);
  const [mostrar3b,  setMostrar3b]  = useState(false);
  const [mostrar4,   setMostrar4]   = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [mostrarStart, setMostrarStart] = useState(false);
  const [terminado,  setTerminado]  = useState(false);

  // Precargar imágenes
  useEffect(() => {
    const imagenes = [
      "/inicio1.jpg", "/inicio2.png",
      "/inicio3.png", "/inicio3b.png", "/inicio4.jpg",
    ];
    let cargadas = 0;
    imagenes.forEach((src) => {
      const img = new Image();
      img.onload  = img.onerror = () => {
        cargadas++;
        if (cargadas === imagenes.length) setImagenesListas(true);
      };
      img.src = src;
    });
  }, []);

  const terminar = useCallback(() => {
    if (terminado) return;
    setTerminado(true);
    onFin && onFin();
  }, [terminado, onFin]);

  // Secuencia de timers
  useEffect(() => {
    if (!imagenesListas) return;

    setMostrar1(true);
    const t2  = setTimeout(() => setMostrar2(true),    500);
    const t3  = setTimeout(() => setMostrar3(true),   1000);
    const t3b = setTimeout(() => setMostrar3b(true),  1500);
    const t4  = setTimeout(() => setMostrar4(true),   2400);
    const tOc = setTimeout(() => {
      setMostrar1(false); setMostrar2(false);
      setMostrar3(false); setMostrar3b(false);
      setMostrarTexto(true);
    }, 3000);
    const tS  = setTimeout(() => setMostrarStart(true), 4000);
    // Auto-terminar a los 8s si el usuario no toca
    const tFin = setTimeout(terminar, 8000);

    return () => {
      clearTimeout(t2); clearTimeout(t3); clearTimeout(t3b);
      clearTimeout(t4); clearTimeout(tOc); clearTimeout(tS);
      clearTimeout(tFin);
    };
  }, [imagenesListas, terminar]);

  // Handler de clic: solo funciona cuando START ya apareció
  const handleClick = () => {
    if (mostrarStart) terminar();
  };

  if (!imagenesListas) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgb(225,225,225)", zIndex: 9999,
      }} />
    );
  }

  return (
    <div
      className="splash-container-unificado"
      onClick={handleClick}
      style={{ cursor: mostrarStart ? "pointer" : "default" }}
    >
      {mostrar1  && <img src="/inicio1.jpg"  alt="" className="splash-fondo" />}
      {mostrar2  && <img src="/inicio2.png"  alt="" className="splash-fondo fade-in" />}
      {mostrar3  && <img src="/inicio3.png"  alt="" className="splash-fondo slide-in-right" />}
      {mostrar3b && <img src="/inicio3b.png" alt="" className="splash-fondo fade-in" />}
      {mostrar4  && <img src="/inicio4.jpg"  alt="" className="splash-fondo" />}

      {mostrarTexto && (
        <div className="splash-texto-final">
          <p>©1995 KONAMIGOS</p>
          <p>TODOS LOS DERECHOS RESERVADOS A</p>
          <p>TU APPWEB FAVORITA y ALVAROCK</p>
        </div>
      )}

      {mostrarStart && <div className="splash-start">START</div>}
    </div>
  );
}
