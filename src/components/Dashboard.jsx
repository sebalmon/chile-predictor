// src/components/Dashboard.jsx  — v8 (Patch 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v8:
//   Punto 1:  Bloqueo duro de navegación (todo excepto PARTIDOS)
//             cuando hay partidos abiertos sin predicción completada
//             o pregunta del día sin responder.
//   Punto 6:  Podio solo si existe puntosDelDia con esGanador:true
//             para ayer. Si no, muestra "El podio se generará al finalizar el día".
//   Punto 7:  Música global desde MusicaContext (ya montado en App.jsx).
//             El botón 🔊/🔇 de la topbar controla MusicaContext,
//             no el SonidosProvider interno.
//   Punto 14: Flecha ▲▼ calculada correctamente: compara posición
//             actual en ranking vs posición en puntosDelDia de ayer.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import {
  collection, getDocs, query, orderBy, where, doc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { diaNumero, hoyStr, ayerStr, partidoAbierto } from "../utils/helpers";
import { useMusica } from "../contexts/MusicaContext";
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

// ── Contexto de sonidos de UI (efectos, no música) ────────────
const SonidosCtx = createContext({ activado: true, playSound: () => {} });
export const useSonidos = () => useContext(SonidosCtx);

function SonidosProvider({ children }) {
  const audioCtxRef = useRef(null);
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback((tipo) => {
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (tipo === "guardar") {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
      } else if (tipo === "error") {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      }
    } catch (_) {}
  }, [getAudioCtx]);

  return (
    <SonidosCtx.Provider value={{ playSound }}>
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

// ── Hook: verificar si el usuario puede navegar ──────────────
// Retorna { bloqueado, razon } — solo bloquea si hay partidos abiertos hoy
function useBloqueNavegacion(uid) {
  const [bloqueado, setBloqueado] = useState(false);
  const [razon,     setRazon]     = useState("");

  useEffect(() => {
    if (!uid) return;
    verificar();
  }, [uid]);

  const verificar = async () => {
    try {
      const hoy = hoyStr();
      // 1. Partidos abiertos hoy
      const snapP = await getDocs(query(
        collection(db,"partidos"), where("fecha","==",hoy)
      ));
      const partidos = snapP.docs.map(d => ({ id:d.id, ...d.data() }));
      const abiertos = partidos.filter(p => !p.resultado && partidoAbierto(p));

      if (abiertos.length === 0) {
        // No hay partidos abiertos hoy → no bloquear
        setBloqueado(false); return;
      }

      // 2. ¿Ya predijo en todos los partidos abiertos?
      const pendientes = [];
      for (const p of abiertos) {
        const snap = await getDoc(doc(db,"predicciones",`${uid}_${p.id}`));
        if (!snap.exists()) pendientes.push(p);
      }

      // 3. ¿Ya respondió la pregunta del día?
      let preguntaPendiente = false;
      const snapQ = await getDocs(query(collection(db,"preguntas"), where("fecha","==",hoy)));
      if (!snapQ.empty) {
        const pregId = snapQ.docs[0].id;
        const snapR  = await getDoc(doc(db,"respuestas",`${uid}_${pregId}`));
        if (!snapR.exists()) preguntaPendiente = true;
      }

      if (pendientes.length > 0 || preguntaPendiente) {
        setBloqueado(true);
        const partes = [];
        if (pendientes.length > 0) partes.push(`${pendientes.length} partido${pendientes.length>1?"s":""} sin pronosticar`);
        if (preguntaPendiente)     partes.push("pregunta del día sin responder");
        setRazon(partes.join(" y "));
      } else {
        setBloqueado(false);
      }
    } catch (_) {
      setBloqueado(false);
    }
  };

  return { bloqueado, razon, reverificar: verificar };
}

// ── Modal de bloqueo ─────────────────────────────────────────
function ModalBloqueo({ razon, onIrAPartidos }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:700,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--rojo-chile)",
        boxShadow:"6px 6px 0 var(--rojo-oscuro)",padding:"28px 22px",
        maxWidth:"360px",width:"100%",display:"flex",flexDirection:"column",gap:"16px" }}>
        <p style={{ fontSize:"22px",textAlign:"center" }}>🔒</p>
        <p style={{ fontSize:"8px",color:"var(--rojo-chile)",textAlign:"center" }}>
          ACCESO RESTRINGIDO
        </p>
        <p style={{ fontSize:"7px",color:"var(--blanco)",textAlign:"center",lineHeight:2.2 }}>
          Tienes {razon}.
        </p>
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",lineHeight:2 }}>
          Completa todos tus pronósticos y la pregunta del día para acceder al ranking y al perfil.
        </p>
        <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"8px" }}
          onClick={onIrAPartidos}>
          ⚽ IR A PARTIDOS
        </button>
      </div>
    </div>
  );
}

// ── Sistema de puntuación ─────────────────────────────────────
function SistemaPuntuacion() {
  const grupos = [
    {pts:"+1",desc:"Acertar ganador (partido normal)"},
    {pts:"+3",desc:"Ganador + diferencia de goles"},
    {pts:"+2",desc:"Solo ganador (partido destacado ⭐)"},
    {pts:"+5",desc:"Resultado exacto (partido destacado ⭐)"},
    {pts:"+2",desc:"Pregunta del día correcta"},
    {pts:"+2",desc:"Ganador del día (bonus diario)"},
  ];
  const muere = [
    {pts:"+2",desc:"Acertar ganador en 90 min"},
    {pts:"+3",desc:"Ganador + diferencia en 90 min"},
    {pts:"+3",desc:"Acertar que se define en Alargue"},
    {pts:"+6",desc:"Alargue + diferencia en el alargue"},
    {pts:"+3",desc:"Acertar que se define en Penales"},
    {pts:"+5",desc:"Penales + quién gana la tanda"},
    {pts:"+7",desc:"Penales + diferencia exacta de la tanda"},
    {pts:"+2",desc:"Pregunta del día correcta"},
    {pts:"+2",desc:"Ganador del día (bonus diario)"},
  ];
  const FilaPts = ({pts,desc}) => (
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"5px 8px",borderBottom:"1px solid var(--verde-campo)",fontSize:"6px" }}>
      <span style={{ color:"var(--gris-claro)",lineHeight:1.8,flex:1 }}>{desc}</span>
      <span style={{ color:"var(--amarillo)",marginLeft:"8px",
        background:"rgba(244,208,63,0.1)",padding:"1px 6px",
        border:"1px solid var(--amarillo)",whiteSpace:"nowrap" }}>{pts}</span>
    </div>
  );
  return (
    <div className="mb-16">
      <div className="caja-pixel mb-8" style={{ padding:"12px" }}>
        <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"8px" }}>FASE DE GRUPOS</p>
        {grupos.map((r,i) => <FilaPts key={i} {...r} />)}
      </div>
      <div className="caja-pixel" style={{ padding:"12px",borderColor:"var(--rojo-chile)" }}>
        <p style={{ fontSize:"7px",color:"var(--rojo-chile)",marginBottom:"8px" }}>💀 FASES MUERE-MUERE</p>
        {muere.map((r,i) => <FilaPts key={i} {...r} />)}
      </div>
    </div>
  );
}

// ── Dashboard interno ─────────────────────────────────────────
function DashboardInterno() {
  const { firebaseUser, userProfile } = useAuth();
  const { musicaOn, toggleMusica }    = useMusica();
  const { playSound }                 = useSonidos();

  const [pantalla,       setPantalla]       = useState(PANTALLAS.INICIO);
  const [podioAyer,      setPodioAyer]      = useState([]);
  const [podioGenerado,  setPodioGenerado]  = useState(false);
  const [cargando,       setCargando]       = useState(true);
  const [mostrarTutorial,setMostrarTutorial]= useState(false);
  const [intentoPantalla,setIntentoPantalla]= useState(null);

  const esAdmin  = firebaseUser?.email === "xtokesu@gmail.com";
  const diaNum   = diaNumero();
  const diaLabel = diaNum > 0 ? `DÍA ${diaNum}` : "MUNDIAL 2026";

  const { bloqueado, razon, reverificar } = useBloqueNavegacion(firebaseUser?.uid);

  useEffect(() => { cargarInicio(); }, []);

  const cargarInicio = async () => {
    setCargando(true);
    try {
      const ayer = ayerStr();
      // Punto 6: podio solo si hay al menos un doc con esGanador:true
      const snapPodio = await getDocs(query(
        collection(db,"puntosDelDia"),
        where("fecha","==",ayer),
        orderBy("puntos","desc")
      ));
      const todosPodio = snapPodio.docs.map(d => ({ id:d.id, ...d.data() }));
      const hayGanador = todosPodio.some(p => p.esGanador === true);
      setPodioAyer(todosPodio);
      setPodioGenerado(hayGanador);
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  const handleLogout = async () => {
    const { auth }    = await import("../firebase");
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  // Punto 1: interceptar navegación
  const cambiarPantalla = (p) => {
    playSound("guardar");
    const pantallasBloqueadas = [PANTALLAS.RANKING, PANTALLAS.PERFIL, PANTALLAS.ADMIN];
    if (bloqueado && pantallasBloqueadas.includes(p) && !esAdmin) {
      setIntentoPantalla(p);
      return;
    }
    setPantalla(p);
  };

  const handleGuardadoPartido = () => {
    // Re-verificar bloqueo tras guardar una predicción
    setTimeout(reverificar, 800);
  };

  if (pantalla === PANTALLAS.PERFIL) return (
    <WithShell {...{userProfile,esAdmin,diaLabel,musicaOn,toggleMusica,pantalla,cambiarPantalla,handleLogout,mostrarTutorial,setMostrarTutorial}}>
      <Perfil onVolver={() => cambiarPantalla(PANTALLAS.INICIO)} />
    </WithShell>
  );
  if (pantalla === PANTALLAS.RANKING) return (
    <WithShell {...{userProfile,esAdmin,diaLabel,musicaOn,toggleMusica,pantalla,cambiarPantalla,handleLogout,mostrarTutorial,setMostrarTutorial}}>
      <Ranking />
    </WithShell>
  );
  if (pantalla === PANTALLAS.PARTIDOS) return (
    <WithShell {...{userProfile,esAdmin,diaLabel,musicaOn,toggleMusica,pantalla,cambiarPantalla,handleLogout,mostrarTutorial,setMostrarTutorial}}>
      <TabPartidos onGuardado={handleGuardadoPartido} />
    </WithShell>
  );
  if (pantalla === PANTALLAS.ADMIN && esAdmin) return (
    <WithShell {...{userProfile,esAdmin,diaLabel,musicaOn,toggleMusica,pantalla,cambiarPantalla,handleLogout,mostrarTutorial,setMostrarTutorial}}>
      <AdminPanel onVolver={() => cambiarPantalla(PANTALLAS.INICIO)} />
    </WithShell>
  );

  // ── INICIO ──────────────────────────────────────────────────
  return (
    <WithShell {...{userProfile,esAdmin,diaLabel,musicaOn,toggleMusica,pantalla,cambiarPantalla,handleLogout,mostrarTutorial,setMostrarTutorial}}>
      {/* Modal de bloqueo (punto 1) */}
      {intentoPantalla && bloqueado && (
        <ModalBloqueo razon={razon} onIrAPartidos={() => {
          setIntentoPantalla(null);
          setPantalla(PANTALLAS.PARTIDOS);
        }} />
      )}

      <div className="contenedor dashboard-wrapper">
        {cargando ? (
          <div className="loading-pantalla" style={{ minHeight:"200px" }}>
            <span className="spinner">⚙</span><p>CARGANDO...</p>
          </div>
        ) : (
          <>
            {/* Punto 6: podio condicional */}
            <div className="seccion-titulo">🏆 PODIO DEL DÍA ANTERIOR</div>
            {podioGenerado ? (
              <PodioF1 datos={podioAyer} />
            ) : (
              <div className="caja-pixel text-center mb-16">
                <p style={{ fontSize:"7px",color:"var(--gris-claro)",lineHeight:2 }}>
                  ⏳ El podio se generará al finalizar el día
                  <br/>cuando el admin entregue las cartas y bonus.
                </p>
              </div>
            )}

            <VozHinchada />

            <div className="seccion-titulo">📋 SISTEMA DE PUNTUACIÓN</div>
            <SistemaPuntuacion />

            <div style={{ marginTop:"8px",marginBottom:"24px" }}>
              <button className="btn-pixel btn-gris w-full"
                style={{ fontSize:"7px",padding:"10px",borderColor:"var(--amarillo)",color:"var(--amarillo)" }}
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

// ── Shell ─────────────────────────────────────────────────────
function WithShell({ children, userProfile, esAdmin, diaLabel, musicaOn, toggleMusica,
  pantalla, cambiarPantalla, handleLogout, mostrarTutorial, setMostrarTutorial }) {
  return (
    <>
      <OnboardingModal isOpen={mostrarTutorial?true:undefined} onClose={()=>setMostrarTutorial(false)} />
      <NotificacionCartas />
      <AvisoAdmin />
      <NotificacionesModal />
      <TopBar userProfile={userProfile} onPerfil={() => cambiarPantalla("perfil")}
        onLogout={handleLogout} diaLabel={diaLabel} musicaOn={musicaOn} toggleMusica={toggleMusica} />
      {children}
      <MenuInferior pantalla={pantalla} setPantalla={cambiarPantalla} esAdmin={esAdmin} />
    </>
  );
}

function TopBar({ userProfile, onPerfil, onLogout, diaLabel, musicaOn, toggleMusica }) {
  return (
    <div className="topbar">
      <span className="topbar-logo" style={{ color:"var(--amarillo)",fontSize:"8px" }}>
        ⚽ {diaLabel}
      </span>
      <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
        {/* Punto 7: botón de música global */}
        <button onClick={toggleMusica}
          style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"12px",
            background:"none",border:"none",cursor:"pointer",padding:"2px 4px",
            opacity:musicaOn?1:0.5 }}
          title={musicaOn?"Música activada (clic para silenciar)":"Música desactivada"}>
          {musicaOn ? "🔊" : "🔇"}
        </button>
        <span className="nickname-topbar">{userProfile?.nickname}</span>
        <div className="avatar-topbar" onClick={onPerfil}>
          <img src={`/avatares/${userProfile?.avatarSlug||"default"}-1.png`} alt="avatar"
            style={{ width:"28px",height:"28px",imageRendering:"pixelated",borderRadius:"0" }}
            onError={e => { e.target.style.display="none"; e.target.parentElement.innerHTML+="<span>?</span>"; }} />
          <span className="avatar-tooltip">{userProfile?.nombreReal||"Usuario"}</span>
        </div>
        <button className="btn-pixel btn-rojo" style={{ fontSize:"6px",padding:"5px 8px" }} onClick={onLogout}>
          SALIR
        </button>
      </div>
    </div>
  );
}

function MenuInferior({ pantalla, setPantalla, esAdmin }) {
  const items = [
    {id:"inicio",   label:"INICIO",   icono:"🏠"},
    {id:"partidos", label:"PARTIDOS", icono:"⚽"},
    {id:"ranking",  label:"RANKING",  icono:"📊"},
    {id:"perfil",   label:"PERFIL",   icono:"👤"},
    ...(esAdmin ? [{id:"admin",label:"ADMIN",icono:"⚙"}] : []),
  ];
  return (
    <nav className="menu-inferior">
      {items.map(item => (
        <button key={item.id}
          className={`menu-item ${pantalla===item.id?"activo":""}`}
          onClick={() => setPantalla(item.id)}
          style={item.id==="admin"?{color:"var(--rojo-chile)"}:{}}>
          <span className="menu-item-icono">{item.icono}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
