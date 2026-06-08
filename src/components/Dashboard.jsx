import React, { useEffect, useState } from "react";
import {
  collection, getDocs, orderBy, query, where, limit,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  PARTIDOS_EJEMPLO, PREGUNTAS_EJEMPLO, FRASES_DEL_DIA,
} from "../data/sampleData";
import { hoyStr, ayerStr, formatFecha } from "../utils/helpers";
import PartidoCard from "./PartidoCard";
import PreguntaCard from "./PreguntaCard";
import Ranking from "./Ranking";
import Perfil from "./Perfil";
import OnboardingModal from "./OnboardingModal";
import AdminPanel from "./AdminPanel";

// ── ADMIN emails (debe coincidir con AdminPanel.jsx) ─────────
const ADMIN_EMAILS = [
  "xtokesu@gmail.com", // ← reemplaza con tu email real
];

const PANTALLAS = {
  INICIO: "inicio",
  RANKING: "ranking",
  PERFIL: "perfil",
  ADMIN: "admin",
};

export default function Dashboard() {
  const { firebaseUser, userProfile } = useAuth();
  const [pantalla, setPantalla] = useState(PANTALLAS.INICIO);
  const [usuariosRanking, setUsuariosRanking] = useState([]);
  const [podioAyer, setPodioAyer] = useState([]);
  const [frase, setFrase] = useState("");
  const [partidosHoy, setPartidosHoy] = useState([]);
  const [preguntaHoy, setPreguntaHoy] = useState(null);
  const [cargando, setCargando] = useState(true);

  const hoy = hoyStr();
  const ayer = ayerStr();
  const esAdmin = ADMIN_EMAILS.includes(firebaseUser?.email);

  useEffect(() => {
    setFrase(FRASES_DEL_DIA[Math.floor(Math.random() * FRASES_DEL_DIA.length)]);
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Ranking top 10
      const qU = query(collection(db, "usuarios"), orderBy("puntosTotal", "desc"), limit(10));
      const snapU = await getDocs(qU);
      setUsuariosRanking(snapU.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Podio de ayer
      try {
        const qA = query(
          collection(db, "puntosDelDia"),
          where("fecha", "==", ayer),
          orderBy("puntos", "desc"),
          limit(3)
        );
        const snapA = await getDocs(qA);
        if (!snapA.empty) setPodioAyer(snapA.docs.map((d) => ({ ...d.data() })));
      } catch (_) {}

      // ── MODIFICADO: Partidos de hoy + Apuestas Anticipadas ──
      try {
        // 1. Traer partidos de hoy
        const qP = query(collection(db, "partidos"), where("fecha", "==", hoy));
        const snapP = await getDocs(qP);
        const partidosDeHoyDb = snapP.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 2. Traer partidos con apuesta anticipada habilitada
        const qAnticipados = query(collection(db, "partidos"), where("permitirApuestaAnticipada", "==", true));
        const snapAnticipados = await getDocs(qAnticipados);
        const partidosAnticipadosDb = snapAnticipados.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 3. Combinar y eliminar duplicados (por id)
        const combinados = [...partidosDeHoyDb, ...partidosAnticipadosDb];
        let unicos = combinados.filter(
          (partido, index, self) => self.findIndex((p) => p.id === partido.id) === index
        );

        // Si la base de datos está completamente vacía, usamos los de ejemplo filtrados por hoy
        if (unicos.length === 0) {
          unicos = PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy);
        }

        // 4. Ordenar por hora de inicio
        unicos.sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));
        
        setPartidosHoy(unicos);
      } catch (_) {
        setPartidosHoy(PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy));
      }

      // Pregunta de hoy
      try {
        const qQ = query(collection(db, "preguntas"), where("fecha", "==", hoy), limit(1));
        const snapQ = await getDocs(qQ);
        if (!snapQ.empty) {
          setPreguntaHoy({ id: snapQ.docs[0].id, ...snapQ.docs[0].data() });
        } else {
          const ej = PREGUNTAS_EJEMPLO.find((q) => q.fecha === hoy);
          if (ej) setPreguntaHoy(ej);
        }
      } catch (_) {
        const ej = PREGUNTAS_EJEMPLO.find((q) => q.fecha === hoy);
        if (ej) setPreguntaHoy(ej);
      }
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setCargando(false);
    }
  };

  const handleLogout = async () => { await signOut(auth); };

  const medallas = ["🥇", "🥈", "🥉"];

  // ── Pantallas secundarias ─────────────────────────────────
  if (pantalla === PANTALLAS.RANKING) return (
    <>
      <TopBar userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)} onLogout={handleLogout} />
      <Ranking onVolver={() => setPantalla(PANTALLAS.INICIO)} />
      <MenuInferior pantalla={pantalla} setPantalla={setPantalla} esAdmin={esAdmin} />
    </>
  );

  if (pantalla === PANTALLAS.PERFIL) return (
    <>
      <TopBar userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)} onLogout={handleLogout} />
      <Perfil onVolver={() => setPantalla(PANTALLAS.INICIO)} />
      <MenuInferior pantalla={pantalla} setPantalla={setPantalla} esAdmin={esAdmin} />
    </>
  );

  if (pantalla === PANTALLAS.ADMIN) return (
    <>
      <TopBar userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)} onLogout={handleLogout} />
      <AdminPanel onVolver={() => setPantalla(PANTALLAS.INICIO)} />
      <MenuInferior pantalla={pantalla} setPantalla={setPantalla} esAdmin={esAdmin} />
    </>
  );

  // ── Dashboard principal ──────────────────────────────────
  return (
    <>
      {/* Modal de bienvenida (se muestra solo la primera vez) */}
      <OnboardingModal />

      <TopBar userProfile={userProfile} onPerfil={() => setPantalla(PANTALLAS.PERFIL)} onLogout={handleLogout} />

      <div className="contenedor dashboard-wrapper">
        {/* FRASE DEL DÍA */}
        <div className="frase-dia">💬 "{frase}"</div>

        {cargando ? (
          <div className="loading-pantalla" style={{ minHeight: "200px" }}>
            <span className="spinner">⚙</span><p>CARGANDO...</p>
          </div>
        ) : (
          <>
            {/* PODIO DE AYER */}
            <div className="seccion-titulo">🏆 PODIO DEL DÍA ANTERIOR</div>
            {podioAyer.length > 0 ? (
              <div className="caja-pixel mb-16">
                <div className="podio">
                  {podioAyer[1] && (
                    <div className="podio-lugar podio-2">
                      <span className="podio-avatar">{podioAyer[1].avatarEmoji || "?"}</span>
                      <span className="podio-nickname">{podioAyer[1].nickname}</span>
                      <span className="podio-puntos">{podioAyer[1].puntos}pts</span>
                      <div className="podio-bloque">2</div>
                    </div>
                  )}
                  {podioAyer[0] && (
                    <div className="podio-lugar podio-1">
                      <span style={{ fontSize: "10px" }}>👑</span>
                      <span className="podio-avatar">{podioAyer[0].avatarEmoji || "?"}</span>
                      <span className="podio-nickname">{podioAyer[0].nickname}</span>
                      <span className="podio-puntos">{podioAyer[0].puntos}pts</span>
                      <div className="podio-bloque">1</div>
                    </div>
                  )}
                  {podioAyer[2] && (
                    <div className="podio-lugar podio-3">
                      <span className="podio-avatar">{podioAyer[2].avatarEmoji || "?"}</span>
                      <span className="podio-nickname">{podioAyer[2].nickname}</span>
                      <span className="podio-puntos">{podioAyer[2].puntos}pts</span>
                      <div className="podio-bloque">3</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="caja-pixel mb-16 text-center">
                <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>
                  Sin datos todavía. ¡El podio aparecerá mañana!
                </p>
              </div>
            )}

            {/* RANKING RÁPIDO */}
            <div className="seccion-titulo">📊 RANKING GENERAL</div>
            <div className="caja-pixel mb-16">
              <table className="ranking-tabla">
                <thead>
                  <tr><th>#</th><th>JUGADOR</th><th style={{ textAlign: "right" }}>PTS</th></tr>
                </thead>
                <tbody>
                  {usuariosRanking.slice(0, 5).map((u, i) => (
                    <tr key={u.id} className={u.uid === firebaseUser?.uid ? "ranking-fila-yo" : ""}>
                      <td className="ranking-pos">{i < 3 ? medallas[i] : i + 1}</td>
                      <td>
                        <span style={{ fontSize: "14px", marginRight: "6px" }}>{u.avatarEmoji}</span>
                        <span style={{ fontSize: "7px" }}>{u.nickname}</span>
                        {u.uid === firebaseUser?.uid && (
                          <span style={{ marginLeft: "6px", fontSize: "5px", background: "var(--verde-claro)", color: "var(--negro)", padding: "1px 3px" }}>TÚ</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="puntos-badge">{u.puntosTotal ?? 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                className="btn-pixel btn-gris w-full"
                style={{ marginTop: "12px", fontSize: "7px" }}
                onClick={() => setPantalla(PANTALLAS.RANKING)}
              >
                VER RANKING COMPLETO →
              </button>
            </div>

            {/* PARTIDOS DE HOY / PRÓXIMOS */}
<div className="seccion-titulo">⚽ PARTIDOS DISPONIBLES</div>
            {partidosHoy.length > 0 ? (
              partidosHoy.map((p) => <PartidoCard key={p.id} partido={p} />)
            ) : (
              <div className="caja-pixel mb-16 text-center">
                <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>
                  No hay partidos hoy. Agrégalos en Firebase Console.
                </p>
              </div>
            )}

            {/* PREGUNTA DEL DÍA */}
            {preguntaHoy && (
              <>
                <div className="seccion-titulo">❓ PREGUNTA DEL DÍA</div>
                <PreguntaCard pregunta={preguntaHoy} />
              </>
            )}
          </>
        )}
      </div>

      <MenuInferior pantalla={pantalla} setPantalla={setPantalla} esAdmin={esAdmin} />
    </>
  );
}

// ── Sub-componentes ──────────────────────────────────────────
function TopBar({ userProfile, onPerfil, onLogout }) {
  return (
    <div className="topbar">
      <span className="topbar-logo">⚽ CP8B</span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span className="nickname-topbar">{userProfile?.nickname}</span>
        <div className="avatar-topbar" onClick={onPerfil}>
          <span className="avatar-emoji">{userProfile?.avatarEmoji || "?"}</span>
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
    { id: PANTALLAS.INICIO, label: "INICIO", icono: "🏠" },
    { id: PANTALLAS.RANKING, label: "RANKING", icono: "📊" },
    { id: PANTALLAS.PERFIL, label: "PERFIL", icono: "👤" },
    ...(esAdmin ? [{ id: PANTALLAS.ADMIN, label: "ADMIN", icono: "⚙" }] : []),
  ];

  return (
    <nav className="menu-inferior">
      {items.map((item) => (
        <button
          key={item.id}
          className={`menu-item ${pantalla === item.id ? "activo" : ""}`}
          onClick={() => setPantalla(item.id)}
          style={item.id === PANTALLAS.ADMIN ? { color: "var(--rojo-chile)" } : {}}
        >
          <span className="menu-item-icono">{item.icono}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
