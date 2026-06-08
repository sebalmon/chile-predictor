import React, { useEffect, useState } from "react";

export default function Splash() {
  const [mostrar1, setMostrar1] = useState(true);
  const [mostrar2, setMostrar2] = useState(false);
  const [mostrar3, setMostrar3] = useState(false);
  const [mostrar4, setMostrar4] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);

  useEffect(() => {
    const timer2 = setTimeout(() => setMostrar2(true), 1000);   // aparece inicio2 a 1s
    const timer3 = setTimeout(() => setMostrar3(true), 1500);   // aparece inicio3 a 1.5s
    
    const timerFin = setTimeout(() => {
  // 1. Primero mostramos la imagen 4 (sin ocultar las anteriores)
  setMostrar4(true);
  // 2. Esperamos 50 milisegundos para que la imagen 4 ya esté pintada
  setTimeout(() => {
    setMostrar1(false);
    setMostrar2(false);
    setMostrar3(false);
    setMostrarTexto(true);
  }, 50);
}, 2000);

    return () => {
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timerFin);
    };
  }, []);

  return (
    <div className="splash-container-unificado">
      {/* Imagen 1 - fondo inicial (0s a 2s) */}
      {mostrar1 && (
        <img
          src="/inicio1.jpg"
          alt="inicio1"
          className="splash-fondo"
        />
      )}

      {/* Imagen 2 - fade a los 1s (se superpone a la 1) */}
      {mostrar2 && (
        <img
          src="/inicio2.png"
          alt="inicio2"
          className="splash-fondo fade-in"
        />
      )}

      {/* Imagen 3 - slide a los 1.5s */}
      {mostrar3 && (
        <img
          src="/inicio3.png"
          alt="inicio3"
          className="splash-fondo slide-in-right"
        />
      )}

      {/* Imagen 4 - aparece a los 2s y se queda */}
      {mostrar4 && (
        <img
          src="/inicio4.jpg"
          alt="inicio4"
          className="splash-fondo"
        />
      )}

      {/* Texto (aparece a los 2s, se queda hasta el final) */}
      {mostrarTexto && (
        <div className="splash-texto-final">
          <p>©1995 KON AMIGOS</p>
          <p>TODOS LOS DERECHOS RESERVADOS A</p>
          <p>TUS GAMES FAVORITOS</p>
        </div>
      )}
    </div>
  );
}