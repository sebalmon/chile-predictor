// src/components/SuperDestacado.jsx  — v1 (Fase 4)
// ─────────────────────────────────────────────────────────────
// Componente para USUARIOS durante un partido Super Destacado.
// • Escucha en tiempo real (onSnapshot) la colección
//   preguntasEnVivo/{partidoId}/preguntas
// • Si hay una pregunta abierta (estado:"abierta"), la muestra
//   como modal o banner flotante urgente.
// • El usuario responde una vez. Al cerrar el admin la pregunta,
//   aparece el resultado (quién acertó, puntos ganados).
// • Puntos: +3 si acierta la pregunta en vivo.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, onSnapshot, query, where, doc,
  setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const PTS_EN_VIVO = 3;

export default function SuperDestacado({ partidoId, nombrePartido }) {
  const { firebaseUser } = useAuth();
  const [preguntaActiva, setPreguntaActiva] = useState(null);
  const [miRespuesta,    setMiRespuesta]    = useState(null);
  const [enviando,       setEnviando]       = useState(false);
  const [resultado,      setResultado]      = useState(null); // cuando cierra el admin

  useEffect(() => {
    if (!partidoId) return;

    // Escuchar en tiempo real la única pregunta abierta
    const ref = collection(db, "preguntasEnVivo", partidoId, "preguntas");
    const q   = query(ref, where("estado", "==", "abierta"));

    const unsub = onSnapshot(q, async snap => {
      if (snap.empty) {
        setPreguntaActiva(null);
        return;
      }
      const pregData = { id: snap.docs[0].id, ...snap.docs[0].data() };
      setPreguntaActiva(pregData);

      // Verificar si ya respondí
      if (firebaseUser) {
        const respRef  = doc(db, "preguntasEnVivo", partidoId, "respuestasEnVivo",
          `${firebaseUser.uid}_${pregData.id}`);
        const respSnap = await getDoc(respRef);
        if (respSnap.exists()) setMiRespuesta(respSnap.data().respuesta);
        else setMiRespuesta(null);
      }
    });

    // También escuchar preguntas recién cerradas (para mostrar resultado)
    const qCerrada = query(ref, where("estado", "==", "cerrada"));
    const unsubCerrada = onSnapshot(qCerrada, snap => {
      if (snap.empty) { setResultado(null); return; }
      // Mostrar resultado de la más reciente
      const cerradas = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => (b.creadaEn?.seconds||0) - (a.creadaEn?.seconds||0));
      setResultado(cerradas[0]);
    });

    return () => { unsub(); unsubCerrada(); };
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

  // Sin pregunta activa ni resultado reciente → no renderizar nada
  if (!preguntaActiva && !resultado) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "80px", // sobre el menú inferior
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 24px)",
      maxWidth: "420px",
      zIndex: 500,
      fontFamily: "'Press Start 2P', monospace",
    }}>
      {/* ── Pregunta abierta ─────────────────────────────────── */}
      {preguntaActiva && (
        <div style={{
          background: "var(--negro)",
          border: "4px solid var(--rojo-chile)",
          boxShadow: "0 0 20px rgba(214,40,40,0.6), 4px 4px 0 var(--rojo-oscuro)",
          padding: "14px 14px 10px",
          animation: "pulseRojo 1.5s infinite",
        }}>
          {/* Cabecera parpadeante */}
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:"10px" }}>
            <span style={{ fontSize:"7px", color:"var(--rojo-chile)" }}>
              🔴 EN VIVO — {nombrePartido}
            </span>
            <span style={{ fontSize:"6px", color:"var(--amarillo)",
              background:"rgba(244,208,63,0.15)", padding:"2px 6px",
              border:"1px solid var(--amarillo)" }}>
              +{PTS_EN_VIVO} pts
            </span>
          </div>

          <p style={{ fontSize:"8px", color:"var(--blanco)", lineHeight:2, marginBottom:"12px" }}>
            {preguntaActiva.texto}
          </p>

          {!miRespuesta ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {(preguntaActiva.opciones || []).map((op, i) => (
                <button key={i}
                  onClick={() => responder(op)}
                  disabled={enviando}
                  style={{
                    fontFamily: "'Press Start 2P',monospace",
                    fontSize: "7px", padding: "8px 10px",
                    background: "rgba(255,255,255,0.05)",
                    border: "2px solid var(--gris)",
                    color: "var(--blanco)", cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.1s",
                  }}
                  onMouseEnter={e => e.target.style.borderColor = "var(--amarillo)"}
                  onMouseLeave={e => e.target.style.borderColor = "var(--gris)"}
                >
                  {op}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"8px" }}>
              <p style={{ fontSize:"7px", color:"var(--verde-claro)", lineHeight:2 }}>
                ✅ Respondiste: <strong style={{ color:"var(--amarillo)" }}>{miRespuesta}</strong>
              </p>
              <p style={{ fontSize:"6px", color:"var(--gris-claro)", marginTop:"4px" }}>
                Esperando que el admin cierre la pregunta...
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Resultado de pregunta recién cerrada ──────────────── */}
      {!preguntaActiva && resultado && (
        <ResultadoEnVivo resultado={resultado} miRespuesta={miRespuesta} />
      )}

      <style>{`
        @keyframes pulseRojo {
          0%,100% { box-shadow: 0 0 12px rgba(214,40,40,0.5), 4px 4px 0 var(--rojo-oscuro); }
          50%      { box-shadow: 0 0 28px rgba(214,40,40,0.9), 4px 4px 0 var(--rojo-oscuro); }
        }
      `}</style>
    </div>
  );
}

function ResultadoEnVivo({ resultado, miRespuesta }) {
  const [visible, setVisible] = useState(true);
  const correcta   = resultado.respuestaCorrecta;
  const acertaste  = miRespuesta === correcta;

  if (!visible) return null;

  return (
    <div style={{
      background: "var(--negro)",
      border: `4px solid ${acertaste ? "var(--verde-claro)" : "var(--gris)"}`,
      boxShadow: `4px 4px 0 ${acertaste ? "var(--verde-oscuro)" : "var(--negro)"}`,
      padding: "14px",
      fontFamily: "'Press Start 2P',monospace",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
        <span style={{ fontSize:"7px", color:"var(--gris-claro)" }}>
          RESULTADO EN VIVO
        </span>
        <button onClick={() => setVisible(false)}
          style={{ background:"none", border:"none", color:"var(--gris)",
            cursor:"pointer", fontSize:"10px" }}>✕</button>
      </div>
      <p style={{ fontSize:"7px", color:"var(--blanco)", lineHeight:2, marginBottom:"8px" }}>
        {resultado.texto}
      </p>
      <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"6px" }}>
        ✅ Respuesta correcta: <strong>{correcta}</strong>
      </p>
      {miRespuesta ? (
        <p style={{ fontSize:"7px",
          color: acertaste ? "var(--verde-claro)" : "var(--rojo-chile)" }}>
          {acertaste
            ? `🎉 ¡Acertaste! +${PTS_EN_VIVO} pts`
            : `❌ Tu respuesta: ${miRespuesta}`
          }
        </p>
      ) : (
        <p style={{ fontSize:"7px", color:"var(--gris-claro)" }}>
          No respondiste esta pregunta.
        </p>
      )}
    </div>
  );
}
