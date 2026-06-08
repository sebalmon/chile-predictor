import React, { useEffect, useState } from "react";

export default function Splash() {
  const [mostrar1, setMostrar1] = useState(true);
  const [mostrar2, setMostrar2] = useState(false);
  const [mostrar3, setMostrar3] = useState(false);
  const [mostrar4, setMostrar4] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [mostrarStart, setMostrarStart] = useState(false);

  useEffect(() => {
    // Temporizadores (todos en milisegundos)
    const timerInicio2 = setTimeout(() => setMostrar2(true), 1500);   // 1.5s
    const timerInicio3 = setTimeout(() => setMostrar3(true), 2500);   // 2.5s

    // Pre-cargar inicio4 antes de mostrarlo (evita parpadeo)
    const preload = new Image();
    preload.src = "/inicio4.jpg";

    const timerTransicion = setTimeout(() => {
      // Mostrar inicio4 primero (sin ocultar aún)
      setMostrar4(true);
      // Esperar 100ms para que se pinte
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
  }, []);

  return (
    <div className="splash-container-unificado">
      {/* Imagen 1 */}
      {mostrar1 && (
        <img src="/inicio1.jpg" alt="inicio1" className="splash-fondo" />
      )}

      {/* Imagen 2 (con fade) */}
      {mostrar2 && (
        <img src="/inicio2.png" alt="inicio2" className="splash-fondo fade-in" />
      )}

      {/* Imagen 3 (con slide) */}
      {mostrar3 && (
        <img src="/inicio3.png" alt="inicio3" className="splash-fondo slide-in-right" />
      )}

      {/* Imagen 4 */}
      {mostrar4 && (
        <img src="/inicio4.jpg" alt="inicio4" className="splash-fondo" />
      )}

      {/* Texto inferior (aparece a los 3.5s) */}
      {mostrarTexto && (
        <div className="splash-texto-final">
          <p>©1995 KON AMIGOS</p>
          <p>TODOS LOS DERECHOS RESERVADOS A</p>
          <p>TUS GAMES FAVORITOS</p>
        </div>
      )}

      {/* Texto parpadeante "START" en el centro */}
      {mostrarStart && (
        <div className="splash-start">START</div>
      )}
    </div>
  );
}