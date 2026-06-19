// src/App.jsx
import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { MusicaProvider } from "./contexts/MusicaContext";
import Splash      from "./components/Splash";
import Login       from "./components/Login";
import Registro    from "./components/Registro";
import Dashboard   from "./components/Dashboard";
import FraseCinema, { fraseCinemaYaVistahoy } from "./components/FraseCinema";

function AppCore() {
  const { firebaseUser, userProfile, loadingProfile } = useAuth();
  const [mostrarSplash,  setMostrarSplash]  = useState(true);
  const [splashListo,    setSplashListo]    = useState(false); // Splash notificó que terminó
  const [mostrarFrase,   setMostrarFrase]   = useState(false);

  useEffect(() => {
    document.title = "INTERNATIONAL SUPERSTAR POLLA";
  }, []);

  // El Splash llama a setSplashListo(true) cuando termina (ver Splash.jsx)
  const handleSplashFin = () => {
    setMostrarSplash(false);
    setSplashListo(true);
  };

  // Cuando el perfil esté disponible y el splash haya terminado,
  // decidir si mostrar la frase cinematográfica
  useEffect(() => {
    if (!splashListo) return;
    if (!firebaseUser || !userProfile) return; // aún cargando o sin perfil
    if (!fraseCinemaYaVistahoy()) {
      setMostrarFrase(true);
    }
  }, [splashListo, firebaseUser, userProfile]);

  // 1. Splash
  if (mostrarSplash) return <Splash onFin={handleSplashFin} />;

  // 2. Cargando auth
  if (firebaseUser === undefined || loadingProfile) {
    return (
      <div className="loading-pantalla">
        <span className="spinner">⚙</span>
        <p>CARGANDO...</p>
      </div>
    );
  }

  // 3. No autenticado
  if (!firebaseUser) return <Login />;

  // 4. Sin perfil → Registro (primera vez)
  if (!userProfile) return <Registro />;

  // 5. Frase cinematográfica (una vez al día)
  if (mostrarFrase) {
    return <FraseCinema onTerminar={() => setMostrarFrase(false)} />;
  }

  // 6. Dashboard principal
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <MusicaProvider>
        <AppCore />
      </MusicaProvider>
    </AuthProvider>
  );
}
