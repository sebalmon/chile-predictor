import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function Splash() {
  const navigate = useNavigate();
  const [imagenActual, setImagenActual] = useState(1); // 1,2,3,4
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const audioRef = useRef(null);

  // Reproducir sonido (si existe) - SOLO si el usuario ya interactuó.
  // Para autoplay en móviles, mejor usar un botón "Tocar para comenzar" pero eso arruina el splash.
  // Omitimos sonido por ahora, pero te explico después.
  useEffect(() => {
    // Secuencia de imágenes
    const timer1 = setTimeout(() => setImagenActual(2), 1000);   // 1s: imagen2 empieza fade
    const timer2 = setTimeout(() => setImagenActual(3), 1500);   // 1.5s: imagen3 barrido
    const timer3 = setTimeout(() => {
      setImagenActual(4); // 2s: imagen4 aparece
      setMostrarTexto(true);
    }, 2000);
    const timerEnd = setTimeout(() => {
      navigate("/login");
    }, 5000); // 5s total (desde inicio)

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timerEnd);
    };
  }, [navigate]);

  // Determinar clase CSS para animación de cada imagen
  const getImageClass = (num) => {
    if (imagenActual < num) return "splash-img-hidden";
    if (num === 2 && imagenActual >= 2) return "splash-img-fade";
    if (num === 3 && imagenActual >= 3) return "splash-img-slide";
    if (num === 4 && imagenActual >= 4) return "splash-img-static";
    return "splash-img-visible";
  };

  return (
    <div className="splash-container">
      {/* Capas de imágenes (una encima de otra) */}
      <img src="/inicio1.png" className={`splash-img ${getImageClass(1)}`} alt="" />
      <img src="/inicio2.png" className={`splash-img ${getImageClass(2)}`} alt="" />
      <img src="/inicio3.png" className={`splash-img ${getImageClass(3)}`} alt="" />
      <img src="/inicio4.png" className={`splash-img ${getImageClass(4)}`} alt="" />

      {/* Texto que aparece desde segundo 2 */}
      {mostrarTexto && (
        <div className="splash-texto">
          <p>©1995 KON AMIGOS</p>
          <p>TODOS LOS DERECHOS RESERVADOS A</p>
          <p>TUS GAMES FAVORITOS</p>
        </div>
      )}
    </div>
  );
}