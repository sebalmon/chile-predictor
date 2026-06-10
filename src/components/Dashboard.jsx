// src/components/Dashboard.jsx  — v3 (Corregido)
import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where, limit } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { hoyStr, ayerStr, diaNumero } from "../utils/helpers";

import PodioF1            from "./PodioF1";
import Ranking            from "./Ranking";
import Perfil             from "./Perfil";
import AdminPanel         from "./AdminPanel";
import OnboardingModal    from "./OnboardingModal";
import NotificacionCartas from "./NotificacionCartas";
import AvisoAdmin         from "./AvisoAdmin";
import TabPartidos        from "./TabPartidos";
import ModalPerfilCompleto from "./ModalPerfilCompleto";

const ADMIN_EMAILS = ["xtokesu@gmail.com"];

const PANTALLAS = {
  INICIO:   "inicio",
  PARTIDOS: "partidos",
  RANKING:  "ranking",
  PERFIL:   "perfil",
  ADMIN:    "admin",
};

export default function Dashboard() {
  const { firebaseUser, userProfile } = useAuth();
  const [pantalla, setPantalla]           = useState(PANTALLAS.INICIO);
  const [usuariosRanking, setUsuariosRanking] = useState([]);
  const [podioAyer, setPodioAyer]         = useState([]);
  const [cargando, setCargando]           = useState(true);
  
  // Estado para controlar la apertura manual del tutorial
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  const hoy  = hoyStr();
  const ayer = ayerStr();
  const diaLabel = `DÍA ${diaNumero()}`;
  const esAdmin = ADMIN_EMAILS.includes(firebaseUser?.email);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Ranking
      const qU = query(collection(db,"usuarios"), orderBy("puntosTotal","desc"), limit(10));
      const snapU = await getDocs(qU);
      setUsuariosRanking(snapU.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Podio de ayer
      try {
        const qA = query(
          collection(db,"puntosDelDia"),
          where("fecha","==",ayer),
          orderBy("puntos","desc"),
          limit(10)
        );
        const snapA = await getDocs(qA);
        if (!snapA.empty) setPodioAyer(snapA.docs.map((d) => ({ ...d.data() })));
      } catch(_) {}
    } finally {
      setCargando(false);
    }
  };

  const handleLogout = async () => { await signOut(auth); };
  const medallas = ["🥇","🥈","🥉"];

  // ── Pantallas secundarias ─────────────────────────────────
  if (pantalla === PANTALLAS.RANKING) return (
    <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
      onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
      esAdmin={esAdmin} diaLabel={diaLabel} mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
      <Ranking onVolver={() => setPantalla(PANTALLAS.INICIO)} />
    </WithShell>
  );

  if (pantalla === PANTALLAS.PERFIL) return (
    <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
      onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
      esAdmin={esAdmin} diaLabel={diaLabel} mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
      <Perfil onVolver={() => setPantalla(PANTALLAS.INICIO)} />
    </WithShell>
  );

  if (pantalla === PANTALLAS.ADMIN) return (
    <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
      onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
      esAdmin={esAdmin} diaLabel={diaLabel} mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
      <AdminPanel onVolver={() => setPantalla(PANTALLAS.INICIO)} />
    </WithShell>
  );

  if (pantalla === PANTALLAS.PARTIDOS) return (
    <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
      onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
      esAdmin={esAdmin} diaLabel={diaLabel} mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>
      <TabPartidos />
    </WithShell>
  );

  // ── Pantalla INICIO ──────────────────────────────────────
  return (
    <WithShell userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
      onLogout={handleLogout} pantalla={pantalla} setPantalla={setPantalla}
      esAdmin={esAdmin} diaLabel={diaLabel} mostrarTutorial={mostrarTutorial} setMostrarTutorial={setMostrarTutorial}>

      <div className="contenedor dashboard-wrapper">
        {cargando ? (
          <div className="loading-pantalla" style={{ minHeight:"200px" }}>
            <span className="spinner">⚙</span><p>CARGANDO...</p>
          </div>
        ) : (
          <>
            {/* PODIO F1 */}
            <div className="seccion-titulo">🏆 PODIO DEL DÍA ANTERIOR</div>
            <PodioF1 datos={podioAyer} />

            {/* RANKING TOP 4 */}
            <div className="seccion-titulo">📊 RANKING GENERAL</div>
            <div className="caja-pixel mb-16">
              <table className="ranking-tabla">
                <thead>
                  <tr><th>#</th><th>JUGADOR</th><th style={{textAlign:"right"}}>PTS</th></tr>
                </thead>
                <tbody>
                  {usuariosRanking.slice(0,4).map((u,i) => (
                    <tr key={u.id} className={u.uid===firebaseUser?.uid?"ranking-fila-yo":""} onClick={() => setUsuarioSeleccionado(u)} style={{ cursor: "pointer" }}>
                      <td className="ranking-pos">{i<3?medallas[i]:i+1}</td>
                      <td>
                        <img
  src={`/avatares/${u.avatarSlug || "default"}-1.png`}
  alt={u.nickname}
  style={{ width: "20px", height: "20px", imageRendering: "pixelated", marginRight: "6px" }}
  onError={(e) => { e.target.style.display = "none"; e.target.parentElement.innerHTML += "<span>?</span>"; }}
/>
                        <span style={{fontSize:"7px"}}>{u.nickname}</span>
                        {u.uid===firebaseUser?.uid&&(
                          <span style={{marginLeft:"6px",fontSize:"5px",
                            background:"var(--verde-claro)",color:"var(--negro)",padding:"1px 3px"}}>
                            TÚ
                          </span>
                        )}
                      </td>
                      <td style={{textAlign:"right"}}>
                        <span className="puntos-badge">{u.puntosTotal??0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-pixel btn-gris w-full"
                style={{marginTop:"12px",fontSize:"7px"}}
                onClick={() => setPantalla(PANTALLAS.RANKING)}>
                VER RANKING COMPLETO →
              </button>
            </div>

            {/* SISTEMA DE PUNTUACIÓN */}
            <div className="seccion-titulo">📋 SISTEMA DE PUNTUACIÓN</div>
            <SistemaPuntuacion />

            {/* BOTÓN REPASAR TUTORIAL */}
            <div style={{ marginTop: "8px", marginBottom: "24px" }}>
              <button 
                className="btn-pixel btn-gris w-full"
                style={{ 
                  fontSize: "7px", 
                  padding: "10px", 
                  borderColor: "var(--amarillo)",
                  color: "var(--amarillo)" 
                }}
                onClick={() => setMostrarTutorial(true)}
              >
                📖 LEER TUTORIAL DE INICIO OTRA VEZ
              </button>
            </div>
          </>
        )}
      </div>
      {/* Modal de perfil completo */}
{usuarioSeleccionado && (
  <ModalPerfilCompleto
    usuario={usuarioSeleccionado}
    onCerrar={() => setUsuarioSeleccionado(null)}
  />
)}
    </WithShell>
  );
}

// ── Sistema de puntuación ─────────────────────────────────────
function SistemaPuntuacion() {
  const grupos = [
    { pts:"+1", desc:"Ganador del partido (partido normal)" },
    { pts:"+2", desc:"Ganador + diferencia de goles" },
    { pts:"+3", desc:"Resultado exacto (partido destacado ⭐)" },
    { pts:"+1", desc:"Solo ganador en partido destacado" },
    { pts:"+2", desc:"Pregunta del día correcta" },
    { pts:"+3", desc:"Ganador del día (más puntos)" },
  ];
  const muere = [
    { pts:"+2", desc:"Acertar ganador en 90 min" },
    { pts:"+3", desc:"Ganador + diferencia en 90 min" },
    { pts:"+2", desc:"Acertar que se define en Alargue" },
    { pts:"+3", desc:"Alargue + diferencia en el alargue" },
    { pts:"+2", desc:"Acertar que se define en Penales" },
    { pts:"+3", desc:"Penales + quién gana la tanda" },
    { pts:"+4", desc:"Penales + diferencia exacta de la tanda" },
    { pts:"+2", desc:"Pregunta del día correcta" },
    { pts:"+3", desc:"Ganador del día (más puntos)" },
  ];

  const FilaPts = ({ pts, desc }) => (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"5px 8px", borderBottom:"1px solid var(--verde-campo)",
      fontSize:"6px",
    }}>
      <span style={{color:"var(--gris-claro)", lineHeight:1.8, flex:1}}>{desc}</span>
      <span style={{
        color:"var(--amarillo)", fontWeight:"bold", marginLeft:"8px",
        background:"rgba(244,208,63,0.1)", padding:"1px 6px",
        border:"1px solid var(--amarillo)", whiteSpace:"nowrap",
      }}>{pts}</span>
    </div>
  );

  return (
    <div className="mb-16">
      <div className="caja-pixel mb-8" style={{padding:"12px"}}>
        <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"8px"}}>
          FASE DE GRUPOS
        </p>
        {grupos.map((r,i) => <FilaPts key={i} {...r} />)}
      </div>
      <div className="caja-pixel" style={{padding:"12px",borderColor:"var(--rojo-chile)"}}>
        <p style={{fontSize:"7px",color:"var(--rojo-chile)",marginBottom:"8px"}}>
          💀 FASES MUERE-MUERE
        </p>
        {muere.map((r,i) => <FilaPts key={i} {...r} />)}
      </div>
    </div>
  );
}

// ── Shell (topbar + menu + modales) ──────────────────────────
function WithShell({ children, userProfile, onPerfil, onLogout,
  pantalla, setPantalla, esAdmin, diaLabel, mostrarTutorial, setMostrarTutorial }) {
  return (
    <>
      {/* Pasamos los estados del botón manual aquí */}
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
      <span className="topbar-logo"
        style={{ color:"var(--amarillo)", fontSize:"8px" }}>
        ⚽ {diaLabel}
      </span>
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <span className="nickname-topbar">{userProfile?.nickname}</span>
        <div className="avatar-topbar" onClick={onPerfil}>
  <img
    src={`/avatares/${userProfile?.avatarSlug || "default"}-1.png`}
    alt="avatar"
    style={{
      width: "28px",
      height: "28px",
      imageRendering: "pixelated",
      borderRadius: "0",
    }}
    onError={(e) => { e.target.style.display = "none"; e.target.parentElement.innerHTML += "<span>?</span>"; }}
  />
  <span className="avatar-tooltip">{userProfile?.nombreReal || "Usuario"}</span>
</div>
        <button className="btn-pixel btn-rojo"
          style={{fontSize:"6px",padding:"5px 8px"}} onClick={onLogout}>
          SALIR
        </button>
      </div>
    </div>
  );
}

function MenuInferior({ pantalla, setPantalla, esAdmin }) {
  const items = [
    { id: PANTALLAS.INICIO,   label:"INICIO",  icono:"🏠" },
    { id: PANTALLAS.PARTIDOS, label:"PARTIDOS",  icono:"⚽" },
    { id: PANTALLAS.RANKING,  label:"RANKING",   icono:"📊" },
    { id: PANTALLAS.PERFIL,   label:"PERFIL",    icono:"👤" },
    ...(esAdmin ? [{ id: PANTALLAS.ADMIN, label:"ADMIN", icono:"⚙" }] : []),
  ];
  return (
    <nav className="menu-inferior">
      {items.map((item) => (
        <button key={item.id}
          className={`menu-item ${pantalla===item.id?"activo":""}`}
          onClick={() => setPantalla(item.id)}
          style={item.id===PANTALLAS.ADMIN?{color:"var(--rojo-chile)"}:{}}>
          <span className="menu-item-icono">{item.icono}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}