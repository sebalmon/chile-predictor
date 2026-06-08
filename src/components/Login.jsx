import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export default function Login() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setCargando(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged en AuthContext manejará el resto
    } catch (e) {
      console.error(e);
      if (e.code === "auth/popup-closed-by-user") {
        setError("Cerraste la ventana. Intenta de nuevo.");
      } else if (e.code === "auth/popup-blocked") {
        setError("El navegador bloqueó el popup. Permite popups para este sitio.");
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="pantalla">
      <div className="login-box">
        {/* Logo */}
        <div style={{ fontSize: "40px", textAlign: "center" }}>⚽</div>

        <h2 style={{ textAlign: "center", color: "var(--verde-claro)", lineHeight: 2 }}>
          INTERNATIONAL
          <br />
          SUPERSTAR
          <br />
          POLLA
        </h2>

        <p style={{ fontSize: "7px", color: "var(--gris-claro)", textAlign: "center", lineHeight: 2 }}>
          Predice los partidos del
          <br />
          Mundial 2026 y compite
          <br />
          con tus amigos... y enemigos.
        </p>

        {error && <div className="error-msg">{error}</div>}

        <button
          className="btn-google"
          onClick={handleGoogle}
          disabled={cargando}
        >
          {/* SVG Google logo */}
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.8 29.3 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.9z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.8 29.3 5 24 5 16.3 5 9.7 9.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 45c5.2 0 9.9-1.8 13.5-4.7l-6.2-5.2C29.4 36.6 26.8 37.5 24 37.5c-5.2 0-9.6-3.3-11.3-8H6.4C9.8 37.8 16.4 45 24 45z" />
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C37 39 44 34.5 44 25c0-1.3-.1-2.5-.4-3.9z" />
          </svg>
          {cargando ? "CONECTANDO..." : "ENTRAR CON GOOGLE"}
        </button>

        <p style={{ fontSize: "6px", color: "var(--gris)", textAlign: "center" }}>
          ⚠ Solo para invitados del grupo
        </p>
      </div>
    </div>
  );
}
