import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Splash from "./components/Splash";
import Login from "./components/Login";
import Registro from "./components/Registro";
import Dashboard from "./components/Dashboard";

// ── Núcleo de la app (usa el contexto de auth) ───────────────
function AppCore() {
  const { firebaseUser, userProfile, loadingProfile } = useAuth();
  const [mostrarSplash, setMostrarSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMostrarSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // 1. Splash inicial (2 segundos)
  if (mostrarSplash) return <Splash />;

  // 2. Cargando estado de auth
  if (firebaseUser === undefined || loadingProfile) {
    return (
      <div className="loading-pantalla">
        <span className="spinner">⚙</span>
        <p>CARGANDO...</p>
      </div>
    );
  }

  // 3. No autenticado → Login
  if (!firebaseUser) return <Login />;

  // 4. Autenticado pero sin perfil → Registro
  if (!userProfile) return <Registro />;

  // 5. Usuario completo → Dashboard
  return <Dashboard />;
}

// ── Wrapper con Provider ─────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppCore />
    </AuthProvider>
  );
}
