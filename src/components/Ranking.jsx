// src/components/Ranking.jsx  — v5 (Fase 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v5:
//   • Flechas ▲▼ con número de puestos subidos/bajados respecto
//     al día anterior (lee puntosDelDia del día de ayer).
//   • Click en cualquier jugador abre ModalPerfilConHistorial
//     (perfil resumido + historial de pronósticos del jugador).
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, orderBy, query, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { ayerStr } from "../utils/helpers";
import { AVATARES, avatarFrame, CARTAS } from "../data/sampleData";
import HistorialPredicciones from "./HistorialPredicciones";

// ── Modal de perfil con historial de pronósticos ──────────────
function ModalPerfilConHistorial({ jugador, onCerrar }) {
  const [tab, setTab] = useState("perfil"); // "perfil" | "historial"

  if (!jugador) return null;

  const cartasMap = jugador.cartas || {};
  const cartasDesbloq = CARTAS.filter((c) => (cartasMap[c.id] || 0) > 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.95)", zIndex: 600,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px", overflowY: "auto",
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          background: "var(--negro)", border: "4px solid var(--verde-claro)",
          boxShadow: "6px 6px 0 var(--verde-oscuro)",
          padding: "0", maxWidth: "400px", width: "100%",
          maxHeight: "90vh", overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del perfil */}
        <div style={{ padding: "20px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          {/* Avatar animado */}
          <AvatarAnimadoSmall avatarId={jugador.avatarId} size={72} />
          <p style={{ fontSize: "11px", color: "var(--amarillo)", textAlign: "center" }}>
            {jugador.nickname}
          </p>
          {jugador.nombreReal && (
            <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>{jugador.nombreReal}</p>
          )}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "6px", color: "var(--verde-claro)" }}>PUNTOS TOTALES</p>
            <span className="puntos-badge" style={{ fontSize: "13px" }}>
              {jugador.puntosTotal ?? 0}
            </span>
          </div>

          {/* Cartas */}
          {cartasDesbloq.length > 0 && (
            <div style={{ width: "100%" }}>
              <p style={{ fontSize: "6px", color: "var(--amarillo)", textAlign: "center", marginBottom: "6px" }}>
                🃏 CARTAS ({cartasDesbloq.length})
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px" }}>
                {cartasDesbloq.map((c) => (
                  <div key={c.id} style={{ textAlign: "center", width: "55px" }}>
                    <img src={`/cartas/${c.slug}.jpg`} alt={c.nombre}
                      style={{ width: "44px", height: "44px", imageRendering: "pixelated",
                        border: "2px solid var(--negro)" }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "2px" }}>
                      ×{c.multiplicador} (x{cartasMap[c.id]})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderTop: "2px solid var(--verde-campo)" }}>
          {[
            { id: "perfil",    label: "👤 PERFIL" },
            { id: "historial", label: "🔮 PRONÓSTICOS" },
          ].map((t) => (
            <button key={t.id}
              style={{
                flex: 1, fontFamily: "'Press Start 2P',monospace",
                fontSize: "6px", padding: "8px",
                background: tab === t.id ? "var(--verde-campo)" : "var(--negro)",
                color: tab === t.id ? "var(--negro)" : "var(--gris-claro)",
                border: "none", borderBottom: tab === t.id ? "none" : "2px solid var(--verde-campo)",
                cursor: "pointer",
              }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido del tab */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "perfil" && (
            <div style={{ padding: "12px", fontSize: "7px", color: "var(--gris-claro)", lineHeight: 2 }}>
              {jugador.email && <p>📧 {jugador.email}</p>}
              <p>🎯 Puntos totales: <span style={{ color: "var(--amarillo)" }}>{jugador.puntosTotal ?? 0}</span></p>
              <p>🃏 Cartas: <span style={{ color: "var(--amarillo)" }}>{cartasDesbloq.length}</span></p>
            </div>
          )}
          {tab === "historial" && (
            <HistorialPredicciones userId={jugador.uid} />
          )}
        </div>

        <div style={{ padding: "12px", borderTop: "2px solid var(--verde-campo)" }}>
          <button className="btn-pixel btn-gris w-full" style={{ fontSize: "7px" }} onClick={onCerrar}>
            CERRAR ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarAnimadoSmall({ avatarId, size = 56 }) {
  const [frame, setFrame] = React.useState(1);
  const av = AVATARES.find((a) => a.id === avatarId);
  React.useEffect(() => {
    const iv = setInterval(() => setFrame((f) => f === 3 ? 1 : f + 1), 200);
    return () => clearInterval(iv);
  }, []);
  if (!av) return <div style={{ width: size, height: size, background: "#333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5 }}>?</div>;
  return (
    <img src={avatarFrame(av.slug, frame)} alt={av.nombre}
      style={{ width: size, height: size, imageRendering: "pixelated", objectFit: "cover",
        border: "3px solid var(--negro)", boxShadow: "2px 2px 0 var(--negro)" }}
      onError={(e) => { e.target.style.display = "none"; if (e.target.parentElement) e.target.parentElement.innerHTML = "?"; }}
    />
  );
}

// ── Componente principal ──────────────────────────────────────
export default function Ranking({ onVolver }) {
  const { firebaseUser } = useAuth();
  const [usuarios, setUsuarios]       = useState([]);
  const [rankingAyer, setRankingAyer] = useState({}); // uid → posición ayer
  const [cargando, setCargando]       = useState(true);
  const [jugadorSel, setJugadorSel]   = useState(null);

  const medallas = ["🥇", "🥈", "🥉"];

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      // Ranking actual
      const snapU = await getDocs(query(
        collection(db, "usuarios"), orderBy("puntosTotal", "desc")
      ));
      const lista = snapU.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsuarios(lista);

      // Ranking de ayer: leer puntosDelDia de ayer y construir mapa uid→posición
      const ayer = ayerStr();
      const snapAyer = await getDocs(query(
        collection(db, "puntosDelDia"), where("fecha", "==", ayer)
      ));

      if (!snapAyer.empty) {
        // Ordenar por puntos desc para determinar posición de ayer
        const ayerOrdenado = snapAyer.docs
          .map((d) => d.data())
          .sort((a, b) => b.puntos - a.puntos);

        // Asignar posición (con empates: misma posición)
        const mapaAyer = {};
        let pos = 1;
        for (let i = 0; i < ayerOrdenado.length; i++) {
          if (i > 0 && ayerOrdenado[i].puntos < ayerOrdenado[i - 1].puntos) {
            pos = i + 1;
          }
          mapaAyer[ayerOrdenado[i].uid] = pos;
        }
        setRankingAyer(mapaAyer);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  // Calcular posición actual (con empates)
  const posicionesActuales = (() => {
    const mapa = {};
    let pos = 1;
    for (let i = 0; i < usuarios.length; i++) {
      if (i > 0 && usuarios[i].puntosTotal < usuarios[i - 1].puntosTotal) {
        pos = i + 1;
      }
      mapa[usuarios[i].uid] = pos;
    }
    return mapa;
  })();

  // Flecha de cambio de posición
  const FlechaCambio = ({ uid }) => {
    const posActual = posicionesActuales[uid];
    const posAyer   = rankingAyer[uid];
    if (!posAyer || !posActual) return null;
    const diff = posAyer - posActual; // positivo = subió
    if (diff === 0) return (
      <span style={{ fontSize: "6px", color: "var(--gris)", marginLeft: "4px" }}>—</span>
    );
    if (diff > 0) return (
      <span style={{ fontSize: "6px", color: "#4ade80", marginLeft: "4px" }}>
        ▲{diff}
      </span>
    );
    return (
      <span style={{ fontSize: "6px", color: "var(--rojo-chile)", marginLeft: "4px" }}>
        ▼{Math.abs(diff)}
      </span>
    );
  };

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        {onVolver && (
          <button className="btn-pixel btn-gris" onClick={onVolver}
            style={{ padding: "8px 12px", fontSize: "8px" }}>
            ← VOLVER
          </button>
        )}
        <h2 className="text-amarillo">🏆 RANKING COMPLETO</h2>
      </div>

      {Object.keys(rankingAyer).length > 0 && (
        <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginBottom: "10px", lineHeight: 2 }}>
          ▲▼ Cambio respecto al ranking de ayer
        </p>
      )}

      {cargando ? (
        <div className="text-center" style={{ padding: "40px", fontSize: "8px", color: "var(--verde-claro)" }}>
          <span className="spinner">⚙</span><br /><br />CARGANDO...
        </div>
      ) : (
        <div className="caja-pixel">
          <table className="ranking-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>JUGADOR</th>
                <th style={{ textAlign: "right" }}>PUNTOS</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr
                  key={u.id}
                  className={u.uid === firebaseUser?.uid ? "ranking-fila-yo" : ""}
                  onClick={() => setJugadorSel(u)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="ranking-pos">
                    {i < 3 ? medallas[i] : i + 1}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <img
                        src={`/avatares/${u.avatarSlug || "default"}-1.png`}
                        alt={u.nickname}
                        style={{ width: "22px", height: "22px", imageRendering: "pixelated" }}
                        onError={(e) => (e.target.style.display = "none")}
                      />
                      <div>
                        <div style={{ fontSize: "7px", color: "var(--blanco)", display: "flex", alignItems: "center" }}>
                          {u.nickname}
                          {u.uid === firebaseUser?.uid && (
                            <span style={{ marginLeft: "6px", fontSize: "5px",
                              background: "var(--verde-claro)", color: "var(--negro)",
                              padding: "1px 4px", border: "1px solid var(--negro)" }}>
                              TÚ
                            </span>
                          )}
                          <FlechaCambio uid={u.uid} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="puntos-badge">{u.puntosTotal ?? 0}</span>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "20px",
                    fontSize: "7px", color: "var(--gris-claro)" }}>
                    Aún no hay jugadores
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {jugadorSel && (
        <ModalPerfilConHistorial
          jugador={jugadorSel}
          onCerrar={() => setJugadorSel(null)}
        />
      )}
    </div>
  );
}
