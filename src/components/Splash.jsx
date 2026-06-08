import React, { useEffect, useState } from "react";

export default function Splash() {
  const [imagenesListas, setImagenesListas] = useState(false);
  const [mostrar1, setMostrar1] = useState(false);
  const [mostrar2, setMostrar2] = useState(false);
  const [mostrar3, setMostrar3] = useState(false);
  const [mostrar4, setMostrar4] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [mostrarStart, setMostrarStart] = useState(false);

  // Precargar todas las imágenes antes de mostrar el splash
  useEffect(() => {
    const imagenes = [
      "/inicio1.jpg",
      "/inicio2.png",
      "/inicio3.png",
      "/inicio4.jpg"
    ];
    let cargadas = 0;
    imagenes.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        cargadas++;
        if (cargadas === imagenes.length) {
          setImagenesListas(true);
        }
      };
      img.src = src;
    });
  }, []);

  // Una vez precargadas, comenzar la secuencia
  useEffect(() => {
    if (!imagenesListas) return;

    // Mostrar la primera imagen inmediatamente
    setMostrar1(true);

    const timerInicio2 = setTimeout(() => setMostrar2(true), 1500);   // 1.5s
    const timerInicio3 = setTimeout(() => setMostrar3(true), 2500);   // 2.5s
    const timerTransicion = setTimeout(() => {
      setMostrar4(true);
      setTimeout(() => {
        setMostrar1(false);
        setMostrar2(false);
        setMostrar3(false);
        setMostrarTexto(true);
        setMostrarStart(true);
      }, 100);
    }, 3400); // 3.4s

    return () => {
      clearTimeout(timerInicio2);
      clearTimeout(timerInicio3);
      clearTimeout(timerTransicion);
    };
  }, [imagenesListas]);

  if (!imagenesListas) {
    // Mientras precarga, mostrar un color sólido (el mismo fondo de inicio1.jpg)
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgb(225, 225, 225)", // Ajusta este color al de tus imágenes
        }}
      />
    );
  }

  return (
    <div className="splash-container-unificado">
      {mostrar1 && <img src="/inicio1.jpg" alt="inicio1" className="splash-fondo" />}
      {mostrar2 && <img src="/inicio2.png" alt="inicio2" className="splash-fondo fade-in" />}
      {mostrar3 && <img src="/inicio3.png" alt="inicio3" className="splash-fondo slide-in-right" />}
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