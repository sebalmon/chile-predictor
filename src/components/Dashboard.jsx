// src/components/Dashboard.jsx  — v9 (Fase 4)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v9:
//   Punto 11: llama a entregarCartaDiaria() al montar.
//             Muestra modal si recibe carta.
//   Punto 13: nueva pestaña LÁMINAS 🃏 en el menú inferior.
//   Mantiene v8: bloqueo nav, podio condicional, música global.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import {
  collection, getDocs, query, orderBy, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { diaNumero, hoyStr, ayerStr, partidoAbierto } from "../utils/helpers";
import { entregarCartaDiaria } from "../utils/cartaDiaria";
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
import SeccionLaminas from "./SeccionLaminas";

// ── Contexto de sonidos de UI ────────────────────────────────
const SonidosCtx = createContext({ playSound: () => {} });
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
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (tipo === "guardar") {
        osc.frequency.setValueAtTime(440,ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+0.15);
        gain.gain.setValueAtTime(0.15,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.2);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.2);
      } else { osc.start(); osc.stop(ctx.currentTime+0.1); }
    } catch(_) {}
  }, [getAudioCtx]);
  return <SonidosCtx.Provider value={{ playSound }}>{children}</SonidosCtx.Provider>;
}

// ─────────────────────────────────────────────────────────────
const PANTALLAS = {
  INICIO:   "inicio",
  PARTIDOS: "partidos",
  RANKING:  "ranking",
  PERFIL:   "perfil",
  LAMINAS:  "laminas",
  ADMIN:    "admin",
};

// ── Bloqueo de navegación ────────────────────────────────────
function useBloqueNavegacion(uid) {
  const [bloqueado, setBloqueado] = useState(false);
  const [razon,     setRazon]     = useState("");
  useEffect(() => { if (uid) verificar(); }, [uid]);

  const verificar = async () => {
    try {
      const hoy = hoyStr();
      const snapP = await getDocs(query(collection(db,"partidos"), where("fecha","==",hoy)));
      const partidos = snapP.docs.map(d=>({id:d.id,...d.data()}));
      const abiertos = partidos.filter(p=>!p.resultado&&partidoAbierto(p));
      if (abiertos.length===0) { setBloqueado(false); return; }
      const pendientes = [];
      for (const p of abiertos) {
        const { getDoc, doc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db,"predicciones",`${uid}_${p.id}`));
        if (!snap.exists()) pendientes.push(p);
      }
      let preguntaPendiente = false;
      const snapQ = await getDocs(query(collection(db,"preguntas"),where("fecha","==",hoy)));
      if (!snapQ.empty) {
        const { getDoc, doc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db,"respuestas",`${uid}_${snapQ.docs[0].id}`));
        if (!snap.exists()) preguntaPendiente = true;
      }
      if (pendientes.length>0||preguntaPendiente) {
        setBloqueado(true);
        const partes=[];
        if (pendientes.length>0) partes.push(`${pendientes.length} partido${pendientes.length>1?"s":""} sin pronosticar`);
        if (preguntaPendiente) partes.push("pregunta del día sin responder");
        setRazon(partes.join(" y "));
      } else { setBloqueado(false); }
    } catch(_) { setBloqueado(false); }
  };
  return { bloqueado, razon, reverificar:verificar };
}

function ModalBloqueo({ razon, onIrAPartidos }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:700,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--rojo-chile)",
        boxShadow:"6px 6px 0 var(--rojo-oscuro)",padding:"28px 22px",
        maxWidth:"360px",width:"100%",display:"flex",flexDirection:"column",gap:"16px" }}>
        <p style={{ fontSize:"22px",textAlign:"center" }}>🔒</p>
        <p style={{ fontSize:"8px",color:"var(--rojo-chile)",textAlign:"center" }}>ACCESO RESTRINGIDO</p>
        <p style={{ fontSize:"7px",color:"var(--blanco)",textAlign:"center",lineHeight:2.2 }}>
          Tienes {razon}.
        </p>
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",lineHeight:2 }}>
          Completa todos tus pronósticos y la pregunta del día para acceder a otras secciones.
        </p>
        <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"8px" }} onClick={onIrAPartidos}>
          ⚽ IR A PARTIDOS
        </button>
      </div>
    </div>
  );
}

// ── Modal carta diaria ────────────────────────────────────────
function ModalCartaDiaria({ resultado, onCerrar }) {
  if (!resultado?.ok) return null;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:850,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--amarillo)",
        boxShadow:"6px 6px 0 var(--amarillo-oscuro)",padding:"24px 20px",
        maxWidth:"360px",width:"100%",textAlign:"center",
        display:"flex",flexDirection:"column",gap:"14px" }}>
        <p style={{ fontSize:"20px" }}>🃏</p>
        <p style={{ fontSize:"8px",color:"var(--amarillo)" }}>
          ¡CARTA DEL DÍA!
        </p>
        <p style={{ fontSize:"7px",color:"var(--blanco)",lineHeight:2 }}>
          Eres el puesto <span style={{ color:"var(--amarillo)" }}>#{resultado.posicion}</span>
          {" "}en el ranking. Hoy recibes:
        </p>
        {(resultado.cartas||[]).map((c,i) => (
          <div key={i} style={{ padding:"8px",border:"2px solid var(--verde-claro)" }}>
            <p style={{ fontSize:"7px",color:"var(--verde-claro)" }}>
              {c.nombre} <span style={{ color:"var(--amarillo)" }}>×{c.multiplicador}</span>
            </p>
          </div>
        ))}
        <button className="btn-pixel btn-amarillo w-full" style={{ fontSize:"8px" }} onClick={onCerrar}>
          ¡GENIAL! ✓
        </button>
      </div>
    </div>
  );
}

// ── Sistema de puntuación ────────────────────────────────────
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
    {pts:"+6",desc:"Alargue + diferencia"},
    {pts:"+3",desc:"Acertar que se define en Penales"},
    {pts:"+5",desc:"Penales + quién gana la tanda"},
    {pts:"+7",desc:"Penales + diferencia exacta"},
    {pts:"+2",desc:"Pregunta del día correcta"},
    {pts:"+2",desc:"Ganador del día (bonus diario)"},
  ];
  const FilaPts=({pts,desc})=>(
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
        {grupos.map((r,i)=><FilaPts key={i} {...r}/>)}
      </div>
      <div className="caja-pixel" style={{ padding:"12px",borderColor:"var(--rojo-chile)" }}>
        <p style={{ fontSize:"7px",color:"var(--rojo-chile)",marginBottom:"8px" }}>💀 FASES MUERE-MUERE</p>
        {muere.map((r,i)=><FilaPts key={i} {...r}/>)}
      </div>
    </div>
  );
}

// ── Dashboard interno ────────────────────────────────────────
function DashboardInterno() {
  const { firebaseUser, userProfile } = useAuth();
  const { musicaOn, toggleMusica }    = useMusica();
  const { playSound }                 = useSonidos();

  const [pantalla,         setPantalla]         = useState(PANTALLAS.INICIO);
  const [podioAyer,        setPodioAyer]         = useState([]);
  const [podioGenerado,    setPodioGenerado]     = useState(false);
  const [cargando,         setCargando]          = useState(true);
  const [mostrarTutorial,  setMostrarTutorial]   = useState(false);
  const [intentoPantalla,  setIntentoPantalla]   = useState(null);
  const [resultadoCarta,   setResultadoCarta]    = useState(null); // modal carta diaria

  const esAdmin  = firebaseUser?.email === "xtokesu@gmail.com";
  const diaNum   = diaNumero();
  const diaLabel = diaNum>0?`DÍA ${diaNum}`:"MUNDIAL 2026";

  const { bloqueado, razon, reverificar } = useBloqueNavegacion(firebaseUser?.uid);

  useEffect(() => { cargarInicio(); }, []);

  // Punto 11: carta diaria automática al montar
  useEffect(() => {
    if (!firebaseUser) return;
    entregarCartaDiaria(firebaseUser.uid).then(res => {
      if (res?.ok) setResultadoCarta(res);
    });
  }, [firebaseUser]);

  const cargarInicio = async () => {
    setCargando(true);
    try {
      const ayer = ayerStr();
      const snapPodio = await getDocs(query(
        collection(db,"puntosDelDia"), where("fecha","==",ayer), orderBy("puntos","desc")
      ));
      const todosPodio = snapPodio.docs.map(d=>({id:d.id,...d.data()}));
      setPodioAyer(todosPodio);
      setPodioGenerado(todosPodio.some(p=>p.esGanador===true));
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  const handleLogout = async () => {
    const { auth }    = await import("../firebase");
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  const cambiarPantalla = (p) => {
    playSound("guardar");
    const bloqueadas = [PANTALLAS.RANKING,PANTALLAS.PERFIL,PANTALLAS.LAMINAS];
    if (bloqueado && bloqueadas.includes(p) && !esAdmin) {
      setIntentoPantalla(p); return;
    }
    setPantalla(p);
  };

  // Render pantallas
  const shellProps = {
    userProfile,esAdmin,diaLabel,musicaOn,toggleMusica,
    pantalla,cambiarPantalla,handleLogout,mostrarTutorial,setMostrarTutorial,
  };

  if (pantalla===PANTALLAS.PERFIL) return (
    <WithShell {...shellProps}>
      <Perfil onVolver={()=>cambiarPantalla(PANTALLAS.INICIO)} />
    </WithShell>
  );
  if (pantalla===PANTALLAS.RANKING) return (
    <WithShell {...shellProps}><Ranking /></WithShell>
  );
  if (pantalla===PANTALLAS.PARTIDOS) return (
    <WithShell {...shellProps}>
      <TabPartidos onGuardado={()=>setTimeout(reverificar,800)} />
    </WithShell>
  );
  if (pantalla===PANTALLAS.LAMINAS) return (
    <WithShell {...shellProps}><SeccionLaminas /></WithShell>
  );
  if (pantalla===PANTALLAS.ADMIN&&esAdmin) return (
    <WithShell {...shellProps}>
      <AdminPanel onVolver={()=>cambiarPantalla(PANTALLAS.INICIO)} />
    </WithShell>
  );

  // ── INICIO ───────────────────────────────────────────────
  return (
    <WithShell {...shellProps}>
      {intentoPantalla&&bloqueado&&(
        <ModalBloqueo razon={razon} onIrAPartidos={()=>{setIntentoPantalla(null);setPantalla(PANTALLAS.PARTIDOS);}} />
      )}
      {resultadoCarta&&(
        <ModalCartaDiaria resultado={resultadoCarta} onCerrar={()=>setResultadoCarta(null)} />
      )}
      <div className="contenedor dashboard-wrapper">
        {cargando ? (
          <div className="loading-pantalla" style={{ minHeight:"200px" }}>
            <span className="spinner">⚙</span><p>CARGANDO...</p>
          </div>
        ) : (
          <>
            <div className="seccion-titulo">🏆 PODIO DEL DÍA ANTERIOR</div>
            {podioGenerado
              ? <PodioF1 datos={podioAyer} />
              : <div className="caja-pixel text-center mb-16">
                  <p style={{ fontSize:"7px",color:"var(--gris-claro)",lineHeight:2 }}>
                    ⏳ El podio se generará al finalizar el día<br/>cuando el admin entregue cartas y bonus.
                  </p>
                </div>
            }
            <VozHinchada />
            <div className="seccion-titulo">📋 SISTEMA DE PUNTUACIÓN</div>
            <SistemaPuntuacion />
            <div style={{ marginTop:"8px",marginBottom:"24px" }}>
              <button className="btn-pixel btn-gris w-full"
                style={{ fontSize:"7px",padding:"10px",borderColor:"var(--amarillo)",color:"var(--amarillo)" }}
                onClick={()=>setMostrarTutorial(true)}>
                📖 LEER TUTORIAL OTRA VEZ
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

function WithShell({ children, userProfile, esAdmin, diaLabel, musicaOn, toggleMusica,
  pantalla, cambiarPantalla, handleLogout, mostrarTutorial, setMostrarTutorial }) {
  return (
    <>
      <OnboardingModal isOpen={mostrarTutorial?true:undefined} onClose={()=>setMostrarTutorial(false)} />
      <NotificacionCartas />
      <AvisoAdmin />
      <NotificacionesModal />
      <TopBar userProfile={userProfile} onPerfil={()=>cambiarPantalla("perfil")}
        onLogout={handleLogout} diaLabel={diaLabel} musicaOn={musicaOn} toggleMusica={toggleMusica} />
      {children}
      <MenuInferior pantalla={pantalla} setPantalla={cambiarPantalla} esAdmin={esAdmin} />
    </>
  );
}

function TopBar({ userProfile, onPerfil, onLogout, diaLabel, musicaOn, toggleMusica }) {
  return (
    <div className="topbar">
      <span className="topbar-logo" style={{ color:"var(--amarillo)",fontSize:"8px" }}>⚽ {diaLabel}</span>
      <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
        <button onClick={toggleMusica}
          style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"12px",
            background:"none",border:"none",cursor:"pointer",padding:"2px 4px",opacity:musicaOn?1:0.5 }}
          title={musicaOn?"Música activada":"Música desactivada"}>
          {musicaOn?"🔊":"🔇"}
        </button>
        <span className="nickname-topbar">{userProfile?.nickname}</span>
        <div className="avatar-topbar" onClick={onPerfil}>
          <img src={`/avatares/${userProfile?.avatarSlug||"default"}-1.png`} alt="avatar"
            style={{ width:"28px",height:"28px",imageRendering:"pixelated",borderRadius:"0" }}
            onError={e=>{e.target.style.display="none";e.target.parentElement.innerHTML+="<span>?</span>";}} />
          <span className="avatar-tooltip">{userProfile?.nombreReal||"Usuario"}</span>
        </div>
        <button className="btn-pixel btn-rojo" style={{ fontSize:"6px",padding:"5px 8px" }} onClick={onLogout}>SALIR</button>
      </div>
    </div>
  );
}

function MenuInferior({ pantalla, setPantalla, esAdmin }) {
  const items = [
    {id:"inicio",   label:"INICIO",   icono:"🏠"},
    {id:"partidos", label:"PARTIDOS", icono:"⚽"},
    {id:"ranking",  label:"RANKING",  icono:"📊"},
    {id:"laminas",  label:"LÁMINAS",  icono:"🃏"},
    {id:"perfil",   label:"PERFIL",   icono:"👤"},
    ...(esAdmin?[{id:"admin",label:"ADMIN",icono:"⚙"}]:[]),
  ];
  return (
    <nav className="menu-inferior">
      {items.map(item=>(
        <button key={item.id}
          className={`menu-item ${pantalla===item.id?"activo":""}`}
          onClick={()=>setPantalla(item.id)}
          style={item.id==="admin"?{color:"var(--rojo-chile)"}:{}}>
          <span className="menu-item-icono">{item.icono}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
