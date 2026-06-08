import React, { useEffect, useState } from "react";

export default function Splash() {
  const [imagenesListas, setImagenesListas] = useState(false);
  const [mostrar1, setMostrar1] = useState(false);
  const [mostrar2, setMostrar2] = useState(false);
  const [mostrar3, setMostrar3] = useState(false);
  const [mostrar3b, setMostrar3b] = useState(false);
  const [mostrar4, setMostrar4] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [mostrarStart, setMostrarStart] = useState(false);

  // Precargar imágenes
  useEffect(() => {
    const imagenes = [
      "/inicio1.jpg",
      "/inicio2.png",
      "/inicio3.png",
      "/inicio3b.png",
      "/inicio4.jpg"
    ];
    let cargadas = 0;
    imagenes.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        cargadas++;
        if (cargadas === imagenes.length) setImagenesListas(true);
      };
      img.onerror = () => {
        cargadas++;
        if (cargadas === imagenes.length) setImagenesListas(true);
      };
      img.src = src;
    });
  }, []);

  // Secuencia con los nuevos tiempos
  useEffect(() => {
    if (!imagenesListas) return;

    // Mostrar inicio1 inmediatamente
    setMostrar1(true);

    const timerInicio2 = setTimeout(() => setMostrar2(true), 500);   // 0.5s
    const timerInicio3 = setTimeout(() => setMostrar3(true), 1000);  // 1.0s
    const timerInicio3b = setTimeout(() => setMostrar3b(true), 1500); // 1.5s
    const timerPreMostrar4 = setTimeout(() => setMostrar4(true), 2400); // 2.4s
    const timerOcultar = setTimeout(() => {
      setMostrar1(false);
      setMostrar2(false);
      setMostrar3(false);
      setMostrar3b(false);
      setMostrarTexto(true);
    }, 3000); // 3.0s – aparece inicio4 + texto
    const timerStart = setTimeout(() => setMostrarStart(true), 4000); // 4.0s – aparece START

    return () => {
      clearTimeout(timerInicio2);
      clearTimeout(timerInicio3);
      clearTimeout(timerInicio3b);
      clearTimeout(timerPreMostrar4);
      clearTimeout(timerOcultar);
      clearTimeout(timerStart);
    };
  }, [imagenesListas]);

  if (!imagenesListas) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "#1a2a1a", // ajusta según el fondo de tus imágenes
        }}
      />
    );
  }

  return (
    <div className="splash-container-unificado">
      {mostrar1 && <img src="/inicio1.jpg" alt="inicio1" className="splash-fondo" />}
      {mostrar2 && <img src="/inicio2.png" alt="inicio2" className="splash-fondo fade-in" />}
      {mostrar3 && <img src="/inicio3.png" alt="inicio3" className="splash-fondo slide-in-right" />}
      {mostrar3b && <img src="/inicio3b.png" alt="inicio3b" className="splash-fondo fade-in" />}
      {mostrar4 && <img src="/inicio4.jpg" alt="inicio4" className="splash-fondo" />}
      {mostrarTexto && (
        <div className="splash-texto-final">
          <p>©1995 KON AMIGOS</p>
          <p>TODOS LOS DERECHOS RESERVADOS A</p>
          <p>TUS GAMES FAVORITOS</p>
        </div>
      )}
      {mostrarStart && <div className="splash-start">START</div>}
    </div>
  );
}