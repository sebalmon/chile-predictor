// src/components/Dashboard.jsx  — v4 (Fase 1)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v4:
//   • Pantalla INICIO: eliminado el bloque "RANKING GENERAL"
//     (top 4 + botón "VER RANKING COMPLETO").
//   • Pantalla INICIO: añadida sección "LA VOZ DE LA HINCHADA"
//     (componente VozHinchada) justo después del podio.
//   • SistemaPuntuacion actualizado con nueva tabla de puntos v4:
//     - Partido normal: +1 ganador, +3 ganador+diferencia
//     - Partido destacado: +2 ganador, +5 resultado exacto
//     - Ganador del día: +2 (antes +3)
//     - Alargue: +3 acertar / +6 con diferencia
//     - Penales: +3 acertar / +5 con ganador / +7 con diferencia exacta
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  diaNumero, formatFecha, hoyStr,
} from "../utils/helpers";
import PodioF1 from "./PodioF1";
import TabPartidos from "./TabPartidos";
import Ranking from "./Ranking";
import Perfil from "./Perfil";
import AdminPanel from "./AdminPanel";
import OnboardingModal from "./OnboardingModal";
import NotificacionCartas from "./NotificacionCartas";
import AvisoAdmin from "./AvisoAdmin";
import ModalPerfilCompleto from "./ModalPerfilCompleto";
import VozHinchada from "./VozHinchada";

const PANTALLAS = {
  INICIO:   "inicio",
  PARTIDOS: "partidos",
  RANKING:  "ranking",
  PERFIL:   "perfil",
  ADMIN:    "admin",
};

const medallas = ["🥇", "🥈", "🥉"];

export default function Dashboard() {
  const { firebaseUser, userProfile, setUserProfile } = useAuth();
  const [pantalla, setPantalla] = useState(PANTALLAS.INICIO);
  const [podioAyer, setPodioAyer] = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  const esAdmin = firebaseUser?.email === "xtokesu@gmail.com";
  const diaNum  = diaNumero();
  const diaLabel = diaNum > 0 ? `DÍA ${diaNum}` : "MUNDIAL 2026";

  useEffect(() => {
    cargarInicio();
  }, []);

  const cargarInicio = async () => {
    setCargando(true);
    try {
      const ayer = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      })();

      // Podio del día anterior
      const snapPodio = await getDocs(
        query(collection(db, "puntosDelDia"), orderBy("puntos", "desc"))
      );
      const todosPodio = snapPodio.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.fecha === ayer);
      setPodioAyer(todosPodio);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  const handleLogout = async () => {
    const { auth } = await import("../firebase");
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  if (pantalla === PANTALLAS.PERFIL) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <Perfil onVolver={() => setPantalla(PANTALLAS.INICIO)} />
      </WithShell>
    );
  }

  if (pantalla === PANTALLAS.RANKING) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <Ranking />
      </WithShell>
    );
  }

  if (pantalla === PANTALLAS.PARTIDOS) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <TabPartidos />
      </WithShell>
    );
  }

  if (pantalla === PANTALLAS.ADMIN && esAdmin) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <AdminPanel onVolver={() => setPantalla(PANTALLAS.INICIO)} />
      </WithShell>
    );
  }

  // ── PANTALLA INICIO ──────────────────────────────────────────
  return (
    <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
      onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
      esAdmin={esAdmin} diaLabel={diaLabel}
      mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>

      <div className="contenedor dashboard-wrapper">
        {cargando ? (
          <div className="loading-pantalla" style={{ minHeight: "200px" }}>
            <span className="spinner">⚙</span><p>CARGANDO...</p>
          </div>
        ) : (
          <>
            {/* PODIO F1 */}
            <div className="seccion-titulo">🏆 PODIO DEL DÍA ANTERIOR</div>
            <PodioF1 datos={podioAyer} />

            {/* LA VOZ DE LA HINCHADA — reemplaza al ranking corto */}
            <VozHinchada />

            {/* SISTEMA DE PUNTUACIÓN */}
            <div className="seccion-titulo">📋 SISTEMA DE PUNTUACIÓN</div>
            <SistemaPuntuacion />

            {/* BOTÓN TUTORIAL */}
            <div style={{ marginTop: "8px", marginBottom: "24px" }}>
              <button
                className="btn-pixel btn-gris w-full"
                style={{
                  fontSize: "7px", padding: "10px",
                  borderColor: "var(--amarillo)", color: "var(--amarillo)",
                }}
                onClick={() => setMostrarTutorial(true)}
              >
                📖 LEER TUTORIAL DE INICIO OTRA VEZ
              </button>
            </div>
          </>
        )}
      </div>

      {usuarioSeleccionado && (
        <ModalPerfilCompleto
          usuario={usuarioSeleccionado}
          onCerrar={() => setUsuarioSeleccionado(null)}
        />
      )}
    </WithShell>
  );
}

// ── Sistema de puntuación (tabla actualizada v4) ──────────────
function SistemaPuntuacion() {
  const grupos = [
    { pts: "+1",  desc: "Acertar ganador (partido normal)" },
    { pts: "+3",  desc: "Ganador + diferencia de goles" },
    { pts: "+2",  desc: "Solo ganador (partido destacado ⭐)" },
    { pts: "+5",  desc: "Resultado exacto (partido destacado ⭐)" },
    { pts: "+2",  desc: "Pregunta del día correcta" },
    { pts: "+2",  desc: "Ganador del día (más puntos)" },
  ];
  const muere = [
    { pts: "+2",  desc: "Acertar ganador en 90 min" },
    { pts: "+3",  desc: "Ganador + diferencia en 90 min" },
    { pts: "+3",  desc: "Acertar que se define en Alargue" },
    { pts: "+6",  desc: "Alargue + diferencia en el alargue" },
    { pts: "+3",  desc: "Acertar que se define en Penales" },
    { pts: "+5",  desc: "Penales + quién gana la tanda" },
    { pts: "+7",  desc: "Penales + diferencia exacta de la tanda" },
    { pts: "+2",  desc: "Pregunta del día correcta" },
    { pts: "+2",  desc: "Ganador del día (más puntos)" },
  ];

  const FilaPts = ({ pts, desc }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 8px", borderBottom: "1px solid var(--verde-campo)",
      fontSize: "6px",
    }}>
      <span style={{ color: "var(--gris-claro)", lineHeight: 1.8, flex: 1 }}>{desc}</span>
      <span style={{
        color: "var(--amarillo)", fontWeight: "bold", marginLeft: "8px",
        background: "rgba(244,208,63,0.1)", padding: "1px 6px",
        border: "1px solid var(--amarillo)", whiteSpace: "nowrap",
      }}>{pts}</span>
    </div>
  );

  return (
    <div className="mb-16">
      <div className="caja-pixel mb-8" style={{ padding: "12px" }}>
        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px" }}>
          FASE DE GRUPOS
        </p>
        {grupos.map((r, i) => <FilaPts key={i} {...r} />)}
      </div>
      <div className="caja-pixel" style={{ padding: "12px", borderColor: "var(--rojo-chile)" }}>
        <p style={{ fontSize: "7px", color: "var(--rojo-chile)", marginBottom: "8px" }}>
          💀 FASES MUERE-MUERE
        </p>
        {muere.map((r, i) => <FilaPts key={i} {...r} />)}
      </div>
    </div>
  );
}

// ── Shell (topbar + menu + modales) ──────────────────────────
function WithShell({ children, userProfile, onPerfil, onLogout,
  pantalla, setPantalla, esAdmin, diaLabel, mostrarTutorial, setMostrarTutorial }) {
  return (
    <>
      <OnboardingModal isOpen={mostrarTutorial ? true : undefined} onClose={() => setMostrarTutorial(false)} />
      <NotificacionCartas />
      <AvisoAdmin />

      <TopBar userProfile={userProfile} onPerfil={onPerfil}
        onLogout={onLogout} diaLabel={diaLabel} />

      {children}

      <MenuInferior pantalla={pantalla} setPantalla={setPantalla} esAdmin={esAdmin} />
    </>
  );
}

function TopBar({ userProfile, onPerfil, onLogout, diaLabel }) {
  return (
    <div className="topbar">
      <span className="topbar-logo" style={{ color: "var(--amarillo)", fontSize: "8px" }}>
        ⚽ {diaLabel}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span className="nickname-topbar">{userProfile?.nickname}</span>
        <div className="avatar-topbar" onClick={onPerfil}>
          <img
            src={`/avatares/${userProfile?.avatarSlug || "default"}-1.png`}
            alt="avatar"
            style={{
              width: "28px", height: "28px",
              imageRendering: "pixelated",
              borderRadius: "0",
            }}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.innerHTML += "<span>?</span>";
            }}
          />
          <span className="avatar-tooltip">{userProfile?.nombreReal || "Usuario"}</span>
        </div>
        <button className="btn-pixel btn-rojo"
          style={{ fontSize: "6px", padding: "5px 8px" }} onClick={onLogout}>
          SALIR
        </button>
      </div>
    </div>
  );
}

function MenuInferior({ pantalla, setPantalla, esAdmin }) {
  const items = [
    { id: PANTALLAS.INICIO,   label: "INICIO",   icono: "🏠" },
    { id: PANTALLAS.PARTIDOS, label: "PARTIDOS", icono: "⚽" },
    { id: PANTALLAS.RANKING,  label: "RANKING",  icono: "📊" },
    { id: PANTALLAS.PERFIL,   label: "PERFIL",   icono: "👤" },
    ...(esAdmin ? [{ id: PANTALLAS.ADMIN, label: "ADMIN", icono: "⚙" }] : []),
  ];
  return (
    <nav className="menu-inferior">
      {items.map((item) => (
        <button key={item.id}
          className={`menu-item ${pantalla === item.id ? "activo" : ""}`}
          onClick={() => setPantalla(item.id)}
          style={item.id === PANTALLAS.ADMIN ? { color: "var(--rojo-chile)" } : {}}>
          <span className="menu-item-icono">{item.icono}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
