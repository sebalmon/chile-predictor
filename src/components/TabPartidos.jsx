// src/components/TabPartidos.jsx  — v4 (Fase 1)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v4:
//   • La pregunta del día es SIEMPRE visible en esta pestaña,
//     junto a los partidos. NO aparece solo después de completar todos.
//   • Muestra "✓ Respondida" si el usuario ya respondió.
//   • Mantiene el indicador de progreso de predicciones.
//   • Modal de "¿Mensaje a la hinchada?" al guardar (una vez por día,
//     controlado con localStorage).
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, query, where, doc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { PARTIDOS_EJEMPLO, PREGUNTAS_EJEMPLO } from "../data/sampleData";
import { hoyStr, partidoAbierto } from "../utils/helpers";
import PartidoCard from "./PartidoCard";
import PreguntaCard from "./PreguntaCard";

const LS_HINCHADA_KEY = "cp8b_hinchada_preguntado_";

export default function TabPartidos() {
  const { firebaseUser } = useAuth();
  const [partidos,    setPartidos]    = useState([]);
  const [pregunta,    setPregunta]    = useState(null);
  const [cargando,    setCargando]    = useState(true);
  const [prediccionesGuardadas, setPrediccionesGuardadas] = useState(new Set());
  const [respuestaUsuario, setRespuestaUsuario] = useState(null); // null | string

  // Modal "¿Mensaje a la hinchada?"
  const [mostrarModalHinchada, setMostrarModalHinchada] = useState(false);
  const [mostrarFormHinchada,  setMostrarFormHinchada]  = useState(false);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [urlMensaje,   setUrlMensaje]   = useState("");
  const [enviandoMsg,  setEnviandoMsg]  = useState(false);
  const [msgEnviado,   setMsgEnviado]   = useState(false);

  const hoy = hoyStr();

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (firebaseUser && partidos.length > 0) verificarPredicciones();
  }, [partidos, firebaseUser]);

  useEffect(() => {
    if (firebaseUser && pregunta) verificarRespuestaPregunta();
  }, [pregunta, firebaseUser]);

  const cargarDatos = async () => {
    setCargando(true);

    // Fecha límite: mostrar datos de ejemplo antes del mundial
    const fechaInicioMundial = new Date("2026-06-11T00:00:00");
    const hoyDate = new Date();
    hoyDate.setHours(0, 0, 0, 0);

    if (hoyDate < fechaInicioMundial) {
      setPartidos([
        {
          id: "partido_001",
          fecha: "2026-06-11",
          horaInicio: "15:00",
          local:     { nombre: "México",     bandera: "🇲🇽" },
          visitante: { nombre: "Sudáfrica",   bandera: "🇿🇦" },
          fase: "grupos", estaDestacado: false, resultado: null,
        },
        {
          id: "partido_002",
          fecha: "2026-06-11",
          horaInicio: "22:00",
          local:     { nombre: "Corea del Sur",    bandera: "🇰🇷" },
          visitante: { nombre: "República Checa",  bandera: "🇨🇿" },
          fase: "grupos", estaDestacado: true, resultado: null,
        },
      ]);
      setCargando(false);
      return;
    }

    try {
      // Partidos del día
      let lista = [];
      try {
        const q = query(collection(db, "partidos"), where("fecha", "==", hoy));
        const snap = await getDocs(q);
        lista = snap.empty
          ? PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy)
          : snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (_) {
        lista = PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy);
      }
      setPartidos(lista);

      // Pregunta del día
      try {
        const qP   = query(collection(db, "preguntas"), where("fecha", "==", hoy));
        const snapP = await getDocs(qP);
        if (!snapP.empty) {
          setPregunta({ id: snapP.docs[0].id, ...snapP.docs[0].data() });
        } else {
          const ej = PREGUNTAS_EJEMPLO.find((q) => q.fecha === hoy);
          if (ej) setPregunta(ej);
        }
      } catch (_) {
        const ej = PREGUNTAS_EJEMPLO.find((q) => q.fecha === hoy);
        if (ej) setPregunta(ej);
      }
    } finally {
      setCargando(false);
    }
  };

  const verificarPredicciones = async () => {
    if (!firebaseUser) return;
    const abiertos = partidos.filter((p) => !p.resultado && partidoAbierto(p));
    if (abiertos.length === 0) return;
    const nuevas = new Set();
    for (const p of abiertos) {
      const ref  = doc(db, "predicciones", `${firebaseUser.uid}_${p.id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) nuevas.add(p.id);
    }
    setPrediccionesGuardadas(nuevas);
  };

  const verificarRespuestaPregunta = async () => {
    if (!firebaseUser || !pregunta) return;
    try {
      const ref  = doc(db, "respuestas", `${firebaseUser.uid}_${pregunta.id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) setRespuestaUsuario(snap.data().respuesta || "✓");
    } catch (_) {}
  };

  // Cuando se guarda una predicción: re-verificar y mostrar modal de hinchada
  const handlePrediccionGuardada = useCallback(() => {
    setTimeout(verificarPredicciones, 500);

    // Modal de hinchada: solo una vez por día
    const lsKey = LS_HINCHADA_KEY + hoy;
    if (!localStorage.getItem(lsKey)) {
      setMostrarModalHinchada(true);
    }
  }, [partidos, firebaseUser, hoy]);

  const cerrarModalHinchada = () => {
    const lsKey = LS_HINCHADA_KEY + hoy;
    localStorage.setItem(lsKey, "1");
    setMostrarModalHinchada(false);
    setMostrarFormHinchada(false);
    setTextoMensaje("");
    setUrlMensaje("");
    setMsgEnviado(false);
  };

  const enviarMensajeHinchada = async () => {
    if (!textoMensaje.trim() || !firebaseUser) return;
    setEnviandoMsg(true);
    try {
      const { addDoc, collection: col, serverTimestamp } = await import("firebase/firestore");
      const ahora = new Date();
      await addDoc(col(db, "mensajesDia"), {
        autor:     firebaseUser.displayName?.split(" ")[0] || "Anónimo",
        texto:     textoMensaje.trim().slice(0, 200),
        url:       urlMensaje.trim() || null,
        timestamp: serverTimestamp(),
        fecha:     hoy,
        hora:      `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`,
        uid:       firebaseUser.uid,
      });
      setMsgEnviado(true);
      setTimeout(cerrarModalHinchada, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setEnviandoMsg(false);
    }
  };

  const abiertos = partidos.filter((p) => !p.resultado && partidoAbierto(p));
  const todosPredecidos = abiertos.length > 0 && abiertos.every((p) => prediccionesGuardadas.has(p.id));

  if (cargando) {
    return (
      <div className="loading-pantalla" style={{ minHeight: "200px" }}>
        <span className="spinner">⚙</span><p>CARGANDO...</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "80px" }}>

      {/* ── Modal "¿Mensaje a la hinchada?" ────────────────── */}
      {mostrarModalHinchada && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.88)", zIndex: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}>
          <div style={{
            background: "var(--negro)", border: "4px solid var(--amarillo)",
            boxShadow: "6px 6px 0 var(--amarillo-oscuro)",
            padding: "24px 20px", maxWidth: "360px", width: "100%",
            display: "flex", flexDirection: "column", gap: "14px",
          }}>
            {!mostrarFormHinchada ? (
              <>
                <p style={{ fontSize: "10px", color: "var(--amarillo)", textAlign: "center" }}>
                  📢
                </p>
                <p style={{ fontSize: "8px", color: "var(--blanco)", textAlign: "center", lineHeight: 2 }}>
                  ¿Algún mensaje<br />para la hinchada?
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn-pixel btn-verde w-full" style={{ fontSize: "8px" }}
                    onClick={() => setMostrarFormHinchada(true)}>
                    SÍ
                  </button>
                  <button className="btn-pixel btn-gris w-full" style={{ fontSize: "8px" }}
                    onClick={cerrarModalHinchada}>
                    NO
                  </button>
                </div>
              </>
            ) : msgEnviado ? (
              <p style={{ fontSize: "8px", color: "var(--verde-claro)", textAlign: "center", lineHeight: 2 }}>
                ✅ ¡Mensaje enviado!
              </p>
            ) : (
              <>
                <p style={{ fontSize: "7px", color: "var(--amarillo)" }}>📢 TU MENSAJE</p>
                <textarea
                  value={textoMensaje}
                  onChange={(e) => setTextoMensaje(e.target.value.slice(0, 200))}
                  placeholder="Escribe algo (máx 200 caracteres)..."
                  rows={3}
                  style={{
                    fontFamily: "'Press Start 2P',monospace", fontSize: "7px",
                    width: "100%", padding: "8px",
                    border: "2px solid var(--negro)", background: "var(--blanco)",
                    color: "var(--negro)", outline: "none", resize: "none", lineHeight: 2,
                  }}
                />
                <p style={{ fontSize: "5px", color: "var(--gris-claro)", textAlign: "right" }}>
                  {textoMensaje.length}/200
                </p>
                <input
                  value={urlMensaje}
                  onChange={(e) => setUrlMensaje(e.target.value)}
                  placeholder="URL opcional (ej. https://...)"
                  style={{
                    fontFamily: "'Press Start 2P',monospace", fontSize: "6px",
                    width: "100%", padding: "6px 8px",
                    border: "2px solid var(--negro)", background: "var(--blanco)",
                    color: "var(--negro)", outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn-pixel btn-verde w-full" style={{ fontSize: "7px" }}
                    onClick={enviarMensajeHinchada}
                    disabled={enviandoMsg || !textoMensaje.trim()}>
                    {enviandoMsg ? "⚙..." : "✅ ENVIAR"}
                  </button>
                  <button className="btn-pixel btn-gris" style={{ fontSize: "7px" }}
                    onClick={cerrarModalHinchada}>
                    ✕
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Contenido principal ─────────────────────────────── */}
      <div className="contenedor">

        {/* Partidos */}
        <div className="seccion-titulo" style={{ marginTop: "16px" }}>
          ⚽ PARTIDOS DE HOY
        </div>

        {partidos.length > 0 ? (
          partidos.map((p) => (
            <PartidoCard key={p.id} partido={p} onGuardado={handlePrediccionGuardada} />
          ))
        ) : (
          <div className="caja-pixel mb-16 text-center">
            <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>
              No hay partidos para hoy.
            </p>
          </div>
        )}

        {/* Indicador de progreso */}
        {abiertos.length > 0 && (
          <div style={{
            padding: "8px 12px", marginBottom: "12px",
            border: "2px solid var(--verde-campo)",
            background: "rgba(64,145,108,0.1)",
            fontFamily: "'Press Start 2P',monospace",
            fontSize: "6px", color: "var(--verde-claro)",
            textAlign: "center",
          }}>
            {todosPredecidos
              ? "✅ TODOS LOS PRONÓSTICOS GUARDADOS"
              : `📝 ${prediccionesGuardadas.size} / ${abiertos.length} PRONÓSTICOS GUARDADOS`
            }
          </div>
        )}

        {/* Pregunta del día — SIEMPRE visible si existe */}
        {pregunta && (
          <>
            <div className="seccion-titulo">
              ❓ PREGUNTA DEL DÍA
              {respuestaUsuario && (
                <span style={{
                  marginLeft: "8px", fontSize: "6px",
                  color: "var(--verde-claro)",
                  background: "rgba(82,183,136,0.15)",
                  border: "1px solid var(--verde-claro)",
                  padding: "2px 6px",
                }}>
                  ✓ RESPONDIDA
                </span>
              )}
            </div>
            <PreguntaCard pregunta={pregunta} />
          </>
        )}

      </div>
    </div>
  );
}
