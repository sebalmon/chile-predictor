import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  PARTIDOS_EJEMPLO,
  PREGUNTAS_EJEMPLO,
  FRASES_DEL_DIA,
} from "../data/sampleData";
import {
  hoyStr,
  ayerStr,
  formatFecha,
} from "../utils/helpers";
import PartidoCard from "./PartidoCard";
import PreguntaCard from "./PreguntaCard";
import Ranking from "./Ranking";
import Perfil from "./Perfil";

// ── Pantalla activa ──────────────────────────────────────────
const PANTALLAS = { INICIO: "inicio", RANKING: "ranking", PERFIL: "perfil" };

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

  useEffect(() => {
    // Frase aleatoria
    setFrase(FRASES_DEL_DIA[Math.floor(Math.random() * FRASES_DEL_DIA.length)]);
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // ── Ranking general (top 10 en dashboard) ────────────────
      const qUsuarios = query(
        collection(db, "usuarios"),
        orderBy("puntosTotal", "desc"),
        limit(10)
      );
      const snapUsuarios = await getDocs(qUsuarios);
      setUsuariosRanking(
        snapUsuarios.docs.map((d) => ({ id: d.id, ...d.data() }))
      );

      // ── Podio del día anterior ────────────────────────────────
      // Se guarda en colección "puntosDelDia" con { uid, fecha, puntos }
      // Admin debe calcularlos (o se puede hacer automáticamente)
      try {
        const qAyer = query(
          collection(db, "puntosDelDia"),
          where("fecha", "==", ayer),
          orderBy("puntos", "desc"),
          limit(3)
        );
        const snapAyer = await getDocs(qAyer);
        if (!snapAyer.empty) {
          const podio = await Promise.all(
            snapAyer.docs.map(async (d) => {
              const data = d.data();
              return { ...data };
            })
          );
          setPodioAyer(podio);
        }
      } catch (_) {
        // Sin podio todavía
      }

      // ── Partidos de hoy ───────────────────────────────────────
      // Intenta leer de Firestore; si falla, usa datos de ejemplo
      try {
        const qPartidos = query(
          collection(db, "partidos"),
          where("fecha", "==", hoy)
        );
        const snapPartidos = await getDocs(qPartidos);
        if (!snapPartidos.empty) {
          setPartidosHoy(
            snapPartidos.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
        } else {
          // Usar ejemplo si no hay datos reales aún
          setPartidosHoy(
            PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy)
          );
        }
      } catch (_) {
        setPartidosHoy(PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy));
      }

      // ── Pregunta del día ──────────────────────────────────────
      try {
        const qPregunta = query(
          collection(db, "preguntas"),
          where("fecha", "==", hoy),
          limit(1)
        );
        const snapPregunta = await getDocs(qPregunta);
        if (!snapPregunta.empty) {
          setPreguntaHoy({ id: snapPregunta.docs[0].id, ...snapPregunta.docs[0].data() });
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

  const handleLogout = async () => {
    await signOut(auth);
  };

  // ── Render pantallas secundarias ─────────────────────────────
  if (pantalla === PANTALLAS.RANKING) {
    return (
      <>
        <TopBar
          userProfile={userProfile}
          onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
          onLogout={handleLogout}
        />
        <Ranking onVolver={() => setPantalla(PANTALLAS.INICIO)} />
        <MenuInferior pantalla={pantalla} setPantalla={setPantalla} />
      </>
    );
  }

  if (pantalla === PANTALLAS.PERFIL) {
    return (
      <>
        <TopBar
          userProfile={userProfile}
          onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
          onLogout={handleLogout}
        />
        <Perfil onVolver={() => setPantalla(PANTALLAS.INICIO)} />
        <MenuInferior pantalla={pantalla} setPantalla={setPantalla} />
      </>
    );
  }

  // ── Dashboard principal ──────────────────────────────────────
  const medallas = ["🥇", "🥈", "🥉"];

  return (
    <>
      <TopBar
        userProfile={userProfile}
        onPerfil={() => setPantalla(PANTALLAS.PERFIL)}
        onLogout={handleLogout}
      />

      <div className="contenedor dashboard-wrapper">
        {/* FRASE DEL DÍA */}
        <div className="frase-dia">💬 "{frase}"</div>

        {cargando ? (
          <div className="loading-pantalla" style={{ minHeight: "200px" }}>
            <span className="spinner">⚙</span>
            <p>CARGANDO...</p>
          </div>
        ) : (
          <>
            {/* PODIO DE AYER */}
            <div className="seccion-titulo">🏆 PODIO DEL DÍA ANTERIOR</div>
            {podioAyer.length > 0 ? (
              <div className="caja-pixel mb-16">
                <div className="podio">
                  {/* 2do lugar */}
                  {podioAyer[1] && (
                    <div className="podio-lugar podio-2">
                      <span className="podio-avatar">{podioAyer[1].avatarEmoji || "?"}</span>
                      <span className="podio-nickname">{podioAyer[1].nickname}</span>
                      <span className="podio-puntos">{podioAyer[1].puntos}pts</span>
                      <div className="podio-bloque">2</div>
                    </div>
                  )}
                  {/* 1er lugar */}
                  {podioAyer[0] && (
                    <div className="podio-lugar podio-1">
                      <span style={{ fontSize: "10px" }}>👑</span>
                      <span className="podio-avatar">{podioAyer[0].avatarEmoji || "?"}</span>
                      <span className="podio-nickname">{podioAyer[0].nickname}</span>
                      <span className="podio-puntos">{podioAyer[0].puntos}pts</span>
                      <div className="podio-bloque">1</div>
                    </div>
                  )}
                  {/* 3er lugar */}
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
                  Sin datos todavía. ¡El podio aparecerá aquí mañana!
                </p>
              </div>
            )}

            {/* RANKING RÁPIDO */}
            <div className="seccion-titulo">📊 RANKING GENERAL</div>
            <div className="caja-pixel mb-16">
              <table className="ranking-tabla">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>JUGADOR</th>
                    <th style={{ textAlign: "right" }}>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosRanking.slice(0, 5).map((u, i) => (
                    <tr
                      key={u.id}
                      className={u.uid === firebaseUser?.uid ? "ranking-fila-yo" : ""}
                    >
                      <td className="ranking-pos">
                        {i < 3 ? medallas[i] : i + 1}
                      </td>
                      <td>
                        <span style={{ fontSize: "14px", marginRight: "6px" }}>
                          {u.avatarEmoji}
                        </span>
                        <span style={{ fontSize: "7px" }}>{u.nickname}</span>
                        {u.uid === firebaseUser?.uid && (
                          <span style={{
                            marginLeft: "6px",
                            fontSize: "5px",
                            background: "var(--verde-claro)",
                            color: "var(--negro)",
                            padding: "1px 3px",
                          }}>TÚ</span>
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

            {/* PARTIDOS DE HOY */}
            <div className="seccion-titulo">
              ⚽ PARTIDOS DE HOY — {formatFecha(hoy)}
            </div>
            {partidosHoy.length > 0 ? (
              partidosHoy.map((p) => (
                <PartidoCard key={p.id} partido={p} />
              ))
            ) : (
              <div className="caja-pixel mb-16 text-center">
                <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>
                  No hay partidos programados para hoy.
                  <br /><br />
                  Agrega partidos en Firebase Console en la
                  colección "partidos".
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

      <MenuInferior pantalla={pantalla} setPantalla={setPantalla} />
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
          <span className="avatar-tooltip">
            {userProfile?.nombreReal || "Usuario"}
          </span>
        </div>
        <button
          className="btn-pixel btn-rojo"
          style={{ fontSize: "6px", padding: "5px 8px" }}
          onClick={onLogout}
        >
          SALIR
        </button>
      </div>
    </div>
  );
}

function MenuInferior({ pantalla, setPantalla }) {
  const items = [
    { id: PANTALLAS.INICIO, label: "INICIO", icono: "🏠" },
    { id: PANTALLAS.RANKING, label: "RANKING", icono: "📊" },
    { id: PANTALLAS.PERFIL, label: "PERFIL", icono: "👤" },
  ];

  // Definir PANTALLAS aquí para que esté disponible
  const _PANTALLAS = { INICIO: "inicio", RANKING: "ranking", PERFIL: "perfil" };

  return (
    <nav className="menu-inferior">
      {items.map((item) => (
        <button
          key={item.id}
          className={`menu-item ${pantalla === item.id ? "activo" : ""}`}
          onClick={() => setPantalla(item.id)}
        >
          <span className="menu-item-icono">{item.icono}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
