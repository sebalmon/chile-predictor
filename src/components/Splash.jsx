import React, { useEffect, useState } from "react";

export default function Splash() {
  const [imagenActual, setImagenActual] = useState(1);
  const [mostrarTexto, setMostrarTexto] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setImagenActual(2), 1000);
    const timer2 = setTimeout(() => setImagenActual(3), 1500);
    const timer3 = setTimeout(() => {
      setImagenActual(4);
      setMostrarTexto(true);
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const getImagen = () => {
    switch (imagenActual) {
      case 1: return "/inicio1.png";
      case 2: return "/inicio2.png";
      case 3: return "/inicio3.png";
      default: return "/inicio4.png";
    }
  };

  const getClaseAnimacion = () => {
    if (imagenActual === 2) return "fade-in";
    if (imagenActual === 3) return "slide-in-right";
    return "";
  };

  return (
    <div className="splash">
      <img 
        src={getImagen()} 
        alt="splash" 
        className={getClaseAnimacion()}
        style={{ maxWidth: "100%", maxHeight: "80%", imageRendering: "pixelated" }}
      />
      {mostrarTexto && (
        <div className="texto-splash">
          ©1995 KON AMIGOS<br />
          TODOS LOS DERECHOS RESERVADOS A<br />
          TUS GAMES FAVORITOS
        </div>
      )}
    </div>
  );
}