// src/components/SuperDestacado.jsx  — v6 (Polling + diseño visual)
// ─────────────────────────────────────────────────────────────
// Usa polling (cada 15 segundos) en vez de onSnapshot para
// reducir lecturas y evitar bloqueos. Obtiene datos del partido
// desde Firestore para mostrar banderas y nombres.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, where, doc,
  setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const PTS_EN_VIVO = 3;
const LS_PREFIX = "cp8b_sd_visto_";

export default function SuperDestacado({ partidoId, nombrePartido }) {
  const { firebaseUser } = useAuth();
  const [preguntaActiva, setPreguntaActiva] = useState(null);
  const [miRespuesta,    setMiRespuesta]    = useState(null);
  const [enviando,       setEnviando]       = useState(false);
  const [resultado,      setResultado]      = useState(null);
  const [resultadoVisto, setResultadoVisto] = useState(false);
  const [partidoData,    setPartidoData]    = useState(null);
  const [cargando,       setCargando]       = useState(true);

  // Cargar datos del partido
  useEffect(() => {
    if (!partidoId) return;
    const cargarPartido = async () => {
      try {
        const snap = await getDoc(doc(db, "partidos", partidoId));
        if (snap.exists()) setPartidoData(snap.data());
      } catch (e) {
        console.error("Error cargando partido:", e);
      }
    };
    cargarPartido();
  }, [partidoId]);

  // Polling de preguntas en vivo
  useEffect(() => {
    if (!partidoId) return;
    let intervalo;

    const cargarPreguntas = async () => {
      try {
        setCargando(true);
        const ref = collection(db, "preguntasEnVivo", partidoId, "preguntas");

        // 1. Buscar pregunta abierta
        const qAbierta = query(ref, where("estado", "==", "abierta"));
        const snapAbierta = await getDocs(qAbierta);

        if (!snapAbierta.empty) {
          const pregData = { id: snapAbierta.docs[0].id, ...snapAbierta.docs[0].data() };
          setPreguntaActiva(pregData);
          setResultado(null); // limpiar resultado anterior

          // Verificar si ya respondí
          if (firebaseUser) {
            const respRef = doc(db, "preguntasEnVivo", partidoId, "respuestasEnVivo",
              `${firebaseUser.uid}_${pregData.id}`);
            const respSnap = await getDoc(respRef);
            if (respSnap.exists()) setMiRespuesta(respSnap.data().respuesta);
            else setMiRespuesta(null);
          }
        } else {
          // 2. Si no hay abierta, buscar cerrada (resultado)
          setPreguntaActiva(null);
          const qCerrada = query(ref, where("estado", "==", "cerrada"));
          const snapCerrada = await getDocs(qCerrada);
          if (!snapCerrada.empty) {
            const cerradas = snapCerrada.docs.map(d => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.creadaEn?.seconds || 0) - (a.creadaEn?.seconds || 0));
            const ultima = cerradas[0];
            const clave = `${LS_PREFIX}${partidoId}_${ultima.id}`;
            const yaVista = localStorage.getItem(clave) === "true";
            setResultado(ultima);
            setResultadoVisto(yaVista);
          } else {
            setResultado(null);
            setResultadoVisto(false);
          }
        }
        setCargando(false);
      } catch (e) {
        console.error("Error en polling de preguntas:", e);
        setCargando(false);
      }
    };

    // Ejecutar al montar y luego cada 15 segundos
    cargarPreguntas();
    intervalo = setInterval(cargarPreguntas, 15000);

    return () => clearInterval(intervalo);
  }, [partidoId, firebaseUser]);

  const responder = async (opcion) => {
    if (!firebaseUser || !preguntaActiva || miRespuesta) return;
    setEnviando(true);
    try {
      const respId = `${firebaseUser.uid}_${preguntaActiva.id}`;
      await setDoc(
        doc(db, "preguntasEnVivo", partidoId, "respuestasEnVivo", respId),
        {
          uid:        firebaseUser.uid,
          preguntaId: preguntaActiva.id,
          respuesta:  opcion,
          partidoId,
          timestamp:  serverTimestamp(),
        }
      );
      setMiRespuesta(opcion);
    } catch (e) { console.error(e); }
    finally { setEnviando(false); }
  };

  const ocultarResultado = () => {
    if (!resultado) return;
    const clave = `${LS_PREFIX}${partidoId}_${resultado.id}`;
    localStorage.setItem(clave, "true");
    setResultadoVisto(true);
  };

  // ── Si no hay partidoId, no renderizar nada ──────────────
  if (!partidoId) return null;

  // ── Si hay resultado y ya fue visto, ocultar ──────────────
  if (resultado && resultadoVisto) return null;

  // ── Si no hay pregunta activa ni resultado, no mostrar ────
  if (!preguntaActiva && !resultado) return null;

  // ── Datos para mostrar ─────────────────────────────────────
  const localBandera = partidoData?.local?.bandera || "🏳️";
  const visitanteBandera = partidoData?.visitante?.bandera || "🏳️";
  const localNombre = partidoData?.local?.nombre || "Local";
  const visitanteNombre = partidoData?.visitante?.nombre || "Visitante";
  const nombreMostrado = partidoData
    ? `${localNombre} vs ${visitanteNombre}`
    : nombrePartido || "Partido en vivo";
  const imgFondo = `/pvivo_${partidoId || '0'}.jpg`;

  // ── Renderizado ─────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed",
      bottom: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 24px)",
      maxWidth: "420px",
      zIndex: 500,
      fontFamily: "'Press Start 2P', monospace",
    }}>
      {/* Pregunta abierta */}
      {preguntaActiva && (
        <div style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px",
          border: "4px solid var(--rojo-chile)",
          boxShadow: "0 0 30px rgba(214,40,40,0.7), 4px 4px 0 var(--rojo-oscuro)",
          animation: "pulseRojo 2s infinite",
          background: "#0a0a0a",
        }}>
          {/* Fondo con imagen */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${imgFondo})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.25,
            filter: "brightness(0.6) saturate(1.2)",
          }} />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
          }} />

          <div style={{ position: "relative", padding: "16px 14px 14px", zIndex: 1 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "28px", lineHeight: 1 }}>{localBandera}</span>
                <span style={{ fontSize: "6px", color: "var(--gris-claro)" }}>vs</span>
                <span style={{ fontSize: "28px", lineHeight: 1 }}>{visitanteBandera}</span>
              </div>
              <span style={{
                fontSize: "6px",
                color: "var(--amarillo)",
                background: "rgba(244,208,63,0.15)",
                padding: "2px 6px",
                border: "1px solid var(--amarillo)",
              }}>
                +{PTS_EN_VIVO} pts
              </span>
            </div>

            <p style={{
              fontSize: "6px",
              color: "var(--blanco)",
              marginBottom: "8px",
              textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
            }}>
              🔴 EN VIVO — {nombreMostrado}
            </p>

            <p style={{
              fontSize: "8px",
              color: "var(--blanco)",
              lineHeight: 2,
              marginBottom: "12px",
              textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
              fontWeight: "bold",
            }}>
              {preguntaActiva.texto}
            </p>

            {!miRespuesta ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {(preguntaActiva.opciones || []).map((op, i) => (
                  <button key={i}
                    onClick={() => responder(op)}
                    disabled={enviando}
                    style={{
                      fontFamily: "'Press Start 2P',monospace",
                      fontSize: "7px",
                      padding: "8px 10px",
                      background: "rgba(0,0,0,0.6)",
                      border: "2px solid rgba(255,255,255,0.2)",
                      color: "var(--blanco)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.1s, background 0.1s",
                      backdropFilter: "blur(4px)",
                    }}
                    onMouseEnter={e => {
                      e.target.style.borderColor = "var(--amarillo)";
                      e.target.style.background = "rgba(244,208,63,0.15)";
                    }}
                    onMouseLeave={e => {
                      e.target.style.borderColor = "rgba(255,255,255,0.2)";
                      e.target.style.background = "rgba(0,0,0,0.6)";
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign:"center", padding:"8px", background:"rgba(0,0,0,0.5)", borderRadius:"4px" }}>
                <p style={{ fontSize:"7px", color:"var(--verde-claro)", lineHeight:2 }}>
                  ✅ Respondiste: <strong style={{ color:"var(--amarillo)" }}>{miRespuesta}</strong>
                </p>
                <p style={{ fontSize:"6px", color:"var(--gris-claro)", marginTop:"4px" }}>
                  Esperando que el admin cierre la pregunta...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resultado de pregunta cerrada */}
      {!preguntaActiva && resultado && !resultadoVisto && (
        <ResultadoEnVivo
          resultado={resultado}
          miRespuesta={miRespuesta}
          onCerrar={ocultarResultado}
          localBandera={localBandera}
          visitanteBandera={visitanteBandera}
          nombrePartido={nombreMostrado}
          imgFondo={imgFondo}
        />
      )}

      <style>{`
        @keyframes pulseRojo {
          0%,100% { box-shadow: 0 0 15px rgba(214,40,40,0.5), 4px 4px 0 var(--rojo-oscuro); }
          50%      { box-shadow: 0 0 40px rgba(214,40,40,0.9), 4px 4px 0 var(--rojo-oscuro); }
        }
      `}</style>
    </div>
  );
}

function ResultadoEnVivo({
  resultado,
  miRespuesta,
  onCerrar,
  localBandera,
  visitanteBandera,
  nombrePartido,
  imgFondo,
}) {
  const correcta   = resultado.respuestaCorrecta;
  const acertaste  = miRespuesta === correcta;

  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      borderRadius: "8px",
      border: `4px solid ${acertaste ? "var(--verde-claro)" : "var(--gris)"}`,
      boxShadow: `0 0 30px ${acertaste ? "rgba(82,183,136,0.5)" : "rgba(255,255,255,0.1)"}, 4px 4px 0 var(--negro)`,
      background: "#0a0a0a",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${imgFondo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.2,
        filter: "brightness(0.5) saturate(0.8)",
      }} />
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.8) 100%)",
      }} />

      <div style={{ position: "relative", padding: "14px", zIndex: 1 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "28px", lineHeight: 1 }}>{localBandera}</span>
            <span style={{ fontSize: "6px", color: "var(--gris-claro)" }}>vs</span>
            <span style={{ fontSize: "28px", lineHeight: 1 }}>{visitanteBandera}</span>
          </div>
          <button
            onClick={onCerrar}
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "var(--blanco)",
              cursor: "pointer",
              fontSize: "14px",
              padding: "2px 8px",
              borderRadius: "4px",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{
          fontSize: "6px",
          color: "var(--gris-claro)",
          marginBottom: "6px",
          textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
        }}>
          RESULTADO EN VIVO — {nombrePartido}
        </p>

        <p style={{
          fontSize: "7px",
          color: "var(--blanco)",
          lineHeight: 2,
          marginBottom: "6px",
          textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
        }}>
          {resultado.texto}
        </p>

        <p style={{
          fontSize: "7px",
          color: "var(--amarillo)",
          marginBottom: "6px",
          textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
        }}>
          ✅ Respuesta correcta: <strong>{correcta}</strong>
        </p>

        {miRespuesta ? (
          <p style={{
            fontSize: "7px",
            color: acertaste ? "var(--verde-claro)" : "var(--rojo-chile)",
            textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
          }}>
            {acertaste
              ? `🎉 ¡Acertaste! +${PTS_EN_VIVO} pts`
              : `❌ Tu respuesta: ${miRespuesta}`
            }
          </p>
        ) : (
          <p style={{
            fontSize: "7px",
            color: "var(--gris-claro)",
            textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
          }}>
            No respondiste esta pregunta.
          </p>
        )}
      </div>
    </div>
  );
}