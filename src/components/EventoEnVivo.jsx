// src/components/EventoEnVivo.jsx
// ─────────────────────────────────────────────────────────────
// Vista del USUARIO para el evento en vivo independiente.
// • Escucha con onSnapshot (tiempo real, sin polling).
// • Ocupa pantalla completa cuando hay pregunta abierta.
// • Muestra banderas, imagen de fondo y pregunta.
// • Al cerrar el admin la pregunta, muestra el resultado.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  doc, onSnapshot, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const REF_EVENTO = () => doc(db, "eventoEnVivo", "actual");

export default function EventoEnVivo() {
  const { firebaseUser } = useAuth();
  const [evento,      setEvento]      = useState(null);
  const [miRespuesta, setMiRespuesta] = useState(null);
  const [enviando,    setEnviando]    = useState(false);
  const [cerrado,     setCerrado]     = useState(false); // usuario cerró el resultado

  // Escuchar evento en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(REF_EVENTO(), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setEvento(data);
        // Si cambió la pregunta (nuevo id), resetear respuesta
        setMiRespuesta(prev => {
          const pregId = data.pregunta?.id;
          // La respuesta se guarda en localStorage por preguntaId
          if (pregId) {
            const guardada = localStorage.getItem(`cp8b_ev_resp_${pregId}`);
            return guardada || null;
          }
          return null;
        });
      } else {
        setEvento(null);
      }
    });
    return () => unsub();
  }, []);

  // Resetear "cerrado" cuando llega pregunta nueva
  useEffect(() => {
    setCerrado(false);
  }, [evento?.pregunta?.id]);

  const responder = async (opcion) => {
    if (!firebaseUser || miRespuesta || enviando) return;
    const pregId = evento?.pregunta?.id;
    if (!pregId) return;
    setEnviando(true);
    try {
      await setDoc(
        doc(db, "eventoEnVivo", "actual", "respuestas", firebaseUser.uid),
        {
          uid:       firebaseUser.uid,
          respuesta: opcion,
          preguntaId: pregId,
          timestamp: serverTimestamp(),
        }
      );
      setMiRespuesta(opcion);
      localStorage.setItem(`cp8b_ev_resp_${pregId}`, opcion);
    } catch (e) { console.error(e); }
    finally { setEnviando(false); }
  };

  // No mostrar si evento inactivo o sin pregunta
  if (!evento?.activo) return null;
  const pregunta = evento.pregunta;
  if (!pregunta) return null;
  if (pregunta.estado !== "abierta" && pregunta.estado !== "cerrada") return null;
  if (pregunta.estado === "cerrada" && cerrado) return null;

  const localBandera     = evento.equipoLocal?.bandera     || "🏳️";
  const visitanteBandera = evento.equipoVisitante?.bandera || "🏳️";
  const localNombre      = evento.equipoLocal?.nombre      || "Local";
  const visitanteNombre  = evento.equipoVisitante?.nombre  || "Visitante";
  const imagenFondo      = evento.imagenFondo;
  const pts              = pregunta.puntosEnVivo || 3;
  const estaAbierta      = pregunta.estado === "abierta";
  const correcta         = pregunta.respuestaCorrecta;
  const acerte           = miRespuesta && miRespuesta === correcta;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:700,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Press Start 2P', monospace",
    }}>
      {/* Imagen de fondo */}
      {imagenFondo ? (
        <div style={{
          position:"absolute", inset:0,
          backgroundImage:`url(/${imagenFondo})`,
          backgroundSize:"cover", backgroundPosition:"center",
          filter:"brightness(0.3) saturate(1.3)",
        }} />
      ) : (
        <div style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse at center, #1a0030 0%, #060010 100%)",
        }} />
      )}
      {/* Overlay */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(180deg,rgba(0,0,0,0.4) 0%,rgba(0,0,0,0.88) 100%)",
      }} />

      {/* Contenido */}
      <div style={{
        position:"relative", zIndex:1,
        width:"100%", maxWidth:"440px", padding:"20px 16px",
        display:"flex", flexDirection:"column", alignItems:"center",
      }}>

        {/* Banderas grandes */}
        <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"8px" }}>
          <span style={{ fontSize:"56px", lineHeight:1,
            filter:"drop-shadow(0 0 10px rgba(255,255,255,0.25))" }}>
            {localBandera}
          </span>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.5)", marginBottom:"4px" }}>
              VS
            </p>
            {estaAbierta && (
              <span style={{
                background:"var(--rojo-chile)", color:"var(--blanco)",
                padding:"2px 8px", fontSize:"5px",
                animation:"parpadeo 1s ease-in-out infinite",
              }}>
                🔴 EN VIVO
              </span>
            )}
          </div>
          <span style={{ fontSize:"56px", lineHeight:1,
            filter:"drop-shadow(0 0 10px rgba(255,255,255,0.25))" }}>
            {visitanteBandera}
          </span>
        </div>

        {/* Nombres */}
        <p style={{ fontSize:"6px", color:"rgba(255,255,255,0.65)",
          marginBottom:"18px", textAlign:"center", lineHeight:2 }}>
          {localNombre} vs {visitanteNombre}
        </p>

        {/* ── PREGUNTA ABIERTA ── */}
        {estaAbierta && (
          <div style={{ width:"100%" }}>
            <div style={{ textAlign:"center", marginBottom:"12px" }}>
              <span style={{
                background:"rgba(244,208,63,0.15)",
                border:"2px solid var(--amarillo)",
                color:"var(--amarillo)", fontSize:"7px",
                padding:"4px 14px",
                boxShadow:"0 0 14px rgba(244,208,63,0.35)",
              }}>
                ¡RESPONDE Y GANA +{pts} PTS!
              </span>
            </div>

            <div style={{
              background:"rgba(0,0,0,0.65)",
              border:"2px solid rgba(255,255,255,0.12)",
              padding:"14px 12px", marginBottom:"12px",
              backdropFilter:"blur(4px)",
            }}>
              <p style={{ fontSize:"8px", color:"var(--blanco)",
                lineHeight:2, textAlign:"center" }}>
                {pregunta.texto}
              </p>
            </div>

            {!miRespuesta ? (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {(pregunta.opciones||[]).map((op,i) => (
                  <button key={i} onClick={() => responder(op)} disabled={enviando}
                    style={{
                      fontFamily:"'Press Start 2P',monospace",
                      fontSize:"7px", padding:"10px 12px",
                      background:"rgba(0,0,0,0.65)",
                      border:"2px solid rgba(255,255,255,0.2)",
                      color:"var(--blanco)", cursor:"pointer", textAlign:"left",
                      backdropFilter:"blur(4px)", transition:"all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "var(--amarillo)";
                      e.currentTarget.style.background  = "rgba(244,208,63,0.15)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                      e.currentTarget.style.background  = "rgba(0,0,0,0.65)";
                    }}>
                    {op}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                background:"rgba(82,183,136,0.12)",
                border:"2px solid var(--verde-claro)",
                padding:"14px", textAlign:"center",
              }}>
                <p style={{ fontSize:"7px", color:"var(--verde-claro)", lineHeight:2 }}>
                  ✅ Tu respuesta:
                </p>
                <p style={{ fontSize:"9px", color:"var(--amarillo)",
                  marginTop:"4px", lineHeight:2 }}>
                  {miRespuesta}
                </p>
                <p style={{ fontSize:"5px", color:"var(--gris-claro)",
                  marginTop:"6px", lineHeight:2 }}>
                  Esperando que el admin cierre la pregunta...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTADO ── */}
        {!estaAbierta && (
          <div style={{ width:"100%" }}>
            <div style={{
              background:"rgba(0,0,0,0.75)",
              border:`3px solid ${acerte?"var(--verde-claro)":"var(--gris)"}`,
              padding:"18px 14px", backdropFilter:"blur(4px)",
            }}>
              <p style={{ fontSize:"6px", color:"var(--gris-claro)",
                marginBottom:"10px", textAlign:"center" }}>
                RESULTADO DE LA PREGUNTA
              </p>
              <p style={{ fontSize:"8px", color:"var(--blanco)",
                lineHeight:2, marginBottom:"10px", textAlign:"center" }}>
                {pregunta.texto}
              </p>
              <p style={{ fontSize:"7px", color:"var(--amarillo)",
                marginBottom:"10px", textAlign:"center" }}>
                ✅ Correcta: <strong>{correcta}</strong>
              </p>
              {miRespuesta ? (
                <p style={{ fontSize:"9px", textAlign:"center",
                  color:acerte?"var(--verde-claro)":"var(--rojo-chile)",
                  marginBottom:"14px" }}>
                  {acerte
                    ? `🎉 ¡ACERTASTE! +${pts} PTS`
                    : `❌ Respondiste: ${miRespuesta}`}
                </p>
              ) : (
                <p style={{ fontSize:"6px", color:"var(--gris-claro)",
                  textAlign:"center", marginBottom:"14px" }}>
                  No respondiste esta pregunta.
                </p>
              )}
              <button className="btn-pixel btn-gris w-full"
                style={{ fontSize:"7px" }}
                onClick={() => setCerrado(true)}>
                CERRAR ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes parpadeo {
          0%,100%{ opacity:1; }
          50%    { opacity:0.55; }
        }
      `}</style>
    </div>
  );
}
