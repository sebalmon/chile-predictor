// src/components/Dashboard.jsx  — v5 (Fase 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v5:
//   • Integra NotificacionesModal (modales de resultados al cargar).
//   • Sonidos opcionales: botón 🔊/🔇 en la topbar, preferencia
//     guardada en localStorage. SonidosContext exporta playSound().
//   • SistemaPuntuacion actualizado (idéntico a Dashboard v4).
//   • Todo lo demás igual a v4.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { diaNumero } from "../utils/helpers";
import PodioF1 from "./PodioF1";
import TabPartidos from "./TabPartidos";
import Ranking from "./Ranking";
import Perfil from "./Perfil";
import AdminPanel from "./AdminPanel";
import OnboardingModal from "./OnboardingModal";
import NotificacionCartas from "./NotificacionCartas";
import AvisoAdmin from "./AvisoAdmin";
import NotificacionesModal from "./NotificacionesModal";
import VozHinchada from "./VozHinchada";

// ── Contexto de sonidos ───────────────────────────────────────
const SonidosCtx = createContext({ activado: false, playSound: () => {} });
export const useSonidos = () => useContext(SonidosCtx);

const LS_SONIDOS_KEY = "cp8b_sonidos_activados";

function SonidosProvider({ children }) {
  const [activado, setActivado] = useState(
    () => localStorage.getItem(LS_SONIDOS_KEY) !== "0"
  );

  const toggle = () => {
    setActivado((v) => {
      const nuevo = !v;
      localStorage.setItem(LS_SONIDOS_KEY, nuevo ? "1" : "0");
      return nuevo;
    });
  };

  // Generador de sonidos con Web Audio API
  const audioCtxRef = useRef(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback((tipo) => {
    if (!activado) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (tipo) {
        case "guardar": {
          // Bip corto ascendente
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.2);
          break;
        }
        case "podio": {
          // Fanfarria corta: Do-Mi-Sol
          const notas = [261.63, 329.63, 392.00, 523.25];
          notas.forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = freq;
            o.type = "square";
            g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.15);
            o.start(ctx.currentTime + i * 0.12);
            o.stop(ctx.currentTime + i * 0.12 + 0.15);
          });
          break;
        }
        case "error": {
          osc.frequency.setValueAtTime(200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.25);
          break;
        }
        case "notificacion": {
          // Dos bips rápidos
          [0, 0.15].forEach((t) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 660;
            g.gain.setValueAtTime(0.15, ctx.currentTime + t);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.1);
            o.start(ctx.currentTime + t);
            o.stop(ctx.currentTime + t + 0.1);
          });
          break;
        }
        default:
          osc.start(); osc.stop(ctx.currentTime + 0.1);
      }
    } catch (e) {
      // Audio no disponible (modo silencioso del SO, etc.)
    }
  }, [activado, getAudioCtx]);

  return (
    <SonidosCtx.Provider value={{ activado, toggle, playSound }}>
      {children}
    </SonidosCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────

const PANTALLAS = {
  INICIO:   "inicio",
  PARTIDOS: "partidos",
  RANKING:  "ranking",
  PERFIL:   "perfil",
  ADMIN:    "admin",
};

const medallas = ["🥇", "🥈", "🥉"];

function DashboardInterno() {
  const { firebaseUser, userProfile } = useAuth();
  const { activado: sonidosOn, toggle: toggleSonidos, playSound } = useSonidos();
  const [pantalla, setPantalla]         = useState(PANTALLAS.INICIO);
  const [podioAyer, setPodioAyer]       = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [mostrarTutorial, setMostrarTutorial] = useState(false);

  const esAdmin  = firebaseUser?.email === "xtokesu@gmail.com";
  const diaNum   = diaNumero();
  const diaLabel = diaNum > 0 ? `DÍA ${diaNum}` : "MUNDIAL 2026";

  useEffect(() => { cargarInicio(); }, []);

  const cargarInicio = async () => {
    setCargando(true);
    try {
      const ayer = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      })();
      const snapPodio = await getDocs(query(collection(db, "puntosDelDia"), orderBy("puntos", "desc")));
      const todosPodio = snapPodio.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.fecha === ayer);
      setPodioAyer(todosPodio);
      if (todosPodio.length > 0) playSound("podio");
    } catch (e) { console.error(e); }
    finally { setCargando(false); }
  };

  const handleLogout = async () => {
    const { auth }    = await import("../firebase");
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  const cambiarPantalla = (p) => {
    playSound("guardar");
    setPantalla(p);
  };

  if (pantalla === PANTALLAS.PERFIL) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => cambiarPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={cambiarPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel} sonidosOn={sonidosOn} toggleSonidos={toggleSonidos}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <Perfil onVolver={() => cambiarPantalla(PANTALLAS.INICIO)} />
      </WithShell>
    );
  }
  if (pantalla === PANTALLAS.RANKING) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => cambiarPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={cambiarPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel} sonidosOn={sonidosOn} toggleSonidos={toggleSonidos}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <Ranking />
      </WithShell>
    );
  }
  if (pantalla === PANTALLAS.PARTIDOS) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => cambiarPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={cambiarPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel} sonidosOn={sonidosOn} toggleSonidos={toggleSonidos}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <TabPartidos />
      </WithShell>
    );
  }
  if (pantalla === PANTALLAS.ADMIN && esAdmin) {
    return (
      <WithShell userProfile={userProfile} onPerfil={() => cambiarPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout} pantalla={pantalla} setPantalla={cambiarPantalla}
        esAdmin={esAdmin} diaLabel={diaLabel} sonidosOn={sonidosOn} toggleSonidos={toggleSonidos}
        mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
        <AdminPanel onVolver={() => cambiarPantalla(PANTALLAS.INICIO)} />
      </WithShell>
    );
  }

  // ── INICIO ──────────────────────────────────────────────────
  return (
    <WithShell userProfile={userProfile} onPerfil={() => cambiarPantalla(PANTALLAS.PERFIL)}
      onLogout={handleLogout} pantalla={pantalla} setPantalla={cambiarPantalla}
      esAdmin={esAdmin} diaLabel={diaLabel} sonidosOn={sonidosOn} toggleSonidos={toggleSonidos}
      mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
      <div className="contenedor dashboard-wrapper">
        {cargando ? (
          <div className="loading-pantalla" style={{ minHeight: "200px" }}>
            <span className="spinner">⚙</span><p>CARGANDO...</p>
          </div>
        ) : (
          <>
            <div className="seccion-titulo">🏆 PODIO DEL DÍA ANTERIOR</div>
            <PodioF1 datos={podioAyer} />
            <VozHinchada />
            <div className="seccion-titulo">📋 SISTEMA DE PUNTUACIÓN</div>
            <SistemaPuntuacion />
            <div style={{ marginTop: "8px", marginBottom: "24px" }}>
              <button className="btn-pixel btn-gris w-full"
                style={{ fontSize: "7px", padding: "10px",
                  borderColor: "var(--amarillo)", color: "var(--amarillo)" }}
                onClick={() => setMostrarTutorial(true)}>
                📖 LEER TUTORIAL DE INICIO OTRA VEZ
              </button>
            </div>
          </>
        )}
      </div>
    </WithShell>
  );
}

export default function Dashboard() {
  return (
    <SonidosProvider>
      <DashboardInterno />
    </SonidosProvider>
  );
}

// ── Sistema de puntuación (tabla v4/v5) ───────────────────────
function SistemaPuntuacion() {
  const grupos = [
    { pts: "+1", desc: "Acertar ganador (partido normal)" },
    { pts: "+3", desc: "Ganador + diferencia de goles" },
    { pts: "+2", desc: "Solo ganador (partido destacado ⭐)" },
    { pts: "+5", desc: "Resultado exacto (partido destacado ⭐)" },
    { pts: "+2", desc: "Pregunta del día correcta" },
    { pts: "+2", desc: "Ganador del día (más puntos)" },
  ];
  const muere = [
    { pts: "+2", desc: "Acertar ganador en 90 min" },
    { pts: "+3", desc: "Ganador + diferencia en 90 min" },
    { pts: "+3", desc: "Acertar que se define en Alargue" },
    { pts: "+6", desc: "Alargue + diferencia en el alargue" },
    { pts: "+3", desc: "Acertar que se define en Penales" },
    { pts: "+5", desc: "Penales + quién gana la tanda" },
    { pts: "+7", desc: "Penales + diferencia exacta de la tanda" },
    { pts: "+2", desc: "Pregunta del día correcta" },
    { pts: "+2", desc: "Ganador del día (más puntos)" },
  ];
  const FilaPts = ({ pts, desc }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 8px", borderBottom: "1px solid var(--verde-campo)", fontSize: "6px" }}>
      <span style={{ color: "var(--gris-claro)", lineHeight: 1.8, flex: 1 }}>{desc}</span>
      <span style={{ color: "var(--amarillo)", fontWeight: "bold", marginLeft: "8px",
        background: "rgba(244,208,63,0.1)", padding: "1px 6px",
        border: "1px solid var(--amarillo)", whiteSpace: "nowrap" }}>{pts}</span>
    </div>
  );
  return (
    <div className="mb-16">
      <div className="caja-pixel mb-8" style={{ padding: "12px" }}>
        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px" }}>FASE DE GRUPOS</p>
        {grupos.map((r, i) => <FilaPts key={i} {...r} />)}
      </div>
      <div className="caja-pixel" style={{ padding: "12px", borderColor: "var(--rojo-chile)" }}>
        <p style={{ fontSize: "7px", color: "var(--rojo-chile)", marginBottom: "8px" }}>💀 FASES MUERE-MUERE</p>
        {muere.map((r, i) => <FilaPts key={i} {...r} />)}
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────
function WithShell({ children, userProfile, onPerfil, onLogout,
  pantalla, setPantalla, esAdmin, diaLabel,
  sonidosOn, toggleSonidos, mostrarTutorial, setMostrarTutorial }) {
  return (
    <>
      <OnboardingModal isOpen={mostrarTutorial ? true : undefined} onClose={() => setMostrarTutorial(false)} />
      <NotificacionCartas />
      <AvisoAdmin />
      <NotificacionesModal />

      <TopBar userProfile={userProfile} onPerfil={onPerfil} onLogout={onLogout}
        diaLabel={diaLabel} sonidosOn={sonidosOn} toggleSonidos={toggleSonidos} />

      {children}

      <MenuInferior pantalla={pantalla} setPantalla={setPantalla} esAdmin={esAdmin} />
    </>
  );
}

function TopBar({ userProfile, onPerfil, onLogout, diaLabel, sonidosOn, toggleSonidos }) {
  return (
    <div className="topbar">
      <span className="topbar-logo" style={{ color: "var(--amarillo)", fontSize: "8px" }}>
        ⚽ {diaLabel}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Botón sonidos */}
        <button
          onClick={toggleSonidos}
          style={{
            fontFamily: "'Press Start 2P',monospace",
            fontSize: "10px", background: "none", border: "none",
            cursor: "pointer", padding: "2px 4px",
            opacity: sonidosOn ? 1 : 0.5,
          }}
          title={sonidosOn ? "Sonidos activados (clic para silenciar)" : "Sonidos desactivados"}
        >
          {sonidosOn ? "🔊" : "🔇"}
        </button>

        <span className="nickname-topbar">{userProfile?.nickname}</span>
        <div className="avatar-topbar" onClick={onPerfil}>
          <img
            src={`/avatares/${userProfile?.avatarSlug || "default"}-1.png`}
            alt="avatar"
            style={{ width: "28px", height: "28px", imageRendering: "pixelated", borderRadius: "0" }}
            onError={(e) => { e.target.style.display = "none"; e.target.parentElement.innerHTML += "<span>?</span>"; }}
          />
          <span className="avatar-tooltip">{userProfile?.nombreReal || "Usuario"}</span>
        </div>
        <button className="btn-pixel btn-rojo" style={{ fontSize: "6px", padding: "5px 8px" }} onClick={onLogout}>
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
