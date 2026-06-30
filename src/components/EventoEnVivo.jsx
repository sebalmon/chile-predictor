// src/components/EventoEnVivo.jsx  — v3
// ─────────────────────────────────────────────────────────────
// CAMBIOS v3:
//   • Layout: imagen del partido arriba a todo lo ancho, banderas
//     y nombres debajo, pregunta y opciones abajo de todo.
//   • Preguntas como ARRAY: cada una numerada (#1, #2, #3...).
//     La pregunta abierta se muestra grande; las anteriores
//     (respondidas) aparecen MINIMIZADAS como tarjetas plegables
//     dentro del mismo modal — no desaparecen.
//   • Al acertar, muestra "+N PTS" de forma prominente.
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
  const [evento,        setEvento]        = useState(null);
  const [misRespuestas, setMisRespuestas] = useState({}); // preguntaId → opcion
  const [enviando,      setEnviando]      = useState(null); // preguntaId siendo enviado
  const [minimizado,    setMinimizado]    = useState(false);
  const [imgError,      setImgError]      = useState(false);
  const [expandidaId,   setExpandidaId]   = useState(null); // pregunta cerrada expandida manualmente

  useEffect(() => {
    const unsub = onSnapshot(REF_EVENTO(), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setEvento(data);
        // Cargar todas mis respuestas desde localStorage
        const preguntas = data.preguntas || [];
        const resp = {};
        preguntas.forEach(p => {
          const guardada = localStorage.getItem(`cp8b_ev_resp_${p.id}`);
          if (guardada) resp[p.id] = guardada;
        });
        setMisRespuestas(resp);
      } else {
        setEvento(null);
      }
    });
    return () => unsub();
  }, []);

  // Al activarse una nueva pregunta abierta, des-minimizar automáticamente
  const preguntas = evento?.preguntas || [];
  const abierta   = preguntas.find(p => p.estado === "abierta");
  const cerradas  = preguntas.filter(p => p.estado === "cerrada").slice().reverse();

  useEffect(() => {
    if (abierta) setMinimizado(false);
  }, [abierta?.id]);

  const responder = async (pregunta, opcion) => {
    if (!firebaseUser || misRespuestas[pregunta.id] || enviando) return;
    setEnviando(pregunta.id);
    try {
      await setDoc(
        doc(db, "eventoEnVivo", "actual", "respuestas", `${firebaseUser.uid}_${pregunta.id}`),
        {
          uid:        firebaseUser.uid,
          respuesta:  opcion,
          preguntaId: pregunta.id,
          timestamp:  serverTimestamp(),
        }
      );
      setMisRespuestas(prev => ({ ...prev, [pregunta.id]: opcion }));
      localStorage.setItem(`cp8b_ev_resp_${pregunta.id}`, opcion);
    } catch (e) { console.error(e); }
    finally { setEnviando(null); }
  };

  if (!evento?.activo) return null;
  if (preguntas.length === 0) return null;

  const localBandera     = evento.equipoLocal?.bandera     || "🏳️";
  const visitanteBandera = evento.equipoVisitante?.bandera || "🏳️";
  const localNombre      = evento.equipoLocal?.nombre      || "Local";
  const visitanteNombre  = evento.equipoVisitante?.nombre  || "Visitante";
  const imagenFondo      = evento.imagenFondo;

  // ── BURBUJA MINIMIZADA ──────────────────────────────────────
  if (minimizado) {
    return (
      <button
        onClick={() => setMinimizado(false)}
        style={{
          position:"fixed", bottom:"90px", right:"16px", zIndex:650,
          width:"56px", height:"56px", borderRadius:"50%",
          background:"var(--rojo-chile)",
          border:"3px solid var(--blanco)",
          boxShadow:"0 0 16px rgba(214,40,40,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"24px", cursor:"pointer",
          animation:"latido 1.4s ease-in-out infinite",
        }}
        title="Reabrir evento en vivo"
      >
        🔴
        <style>{`@keyframes latido{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
      </button>
    );
  }

  // ── MODAL FULLSCREEN ─────────────────────────────────────────
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:700,
      display:"flex", flexDirection:"column",
      fontFamily:"'Press Start 2P', monospace",
      background:"#0a0510",
      overflowY:"auto",
    }}>
      {/* ═══ ZONA SUPERIOR: imagen del partido a todo lo ancho ═══ */}
      <div style={{
        position:"relative", width:"100%", height:"180px",
        flexShrink:0, overflow:"hidden",
      }}>
        {imagenFondo && !imgError ? (
          <>
            <img
              src={`/${imagenFondo}`}
              alt="Imagen del partido"
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={() => setImgError(true)}
            />
            <div style={{
              position:"absolute", inset:0,
              background:"linear-gradient(180deg, rgba(0,0,0,0.1) 0%, #0a0510 100%)",
            }} />
          </>
        ) : (
          <div style={{
            width:"100%", height:"100%",
            background:"radial-gradient(ellipse at center, #2a0050 0%, #0a0510 100%)",
          }} />
        )}

        {/* Botón minimizar */}
        <button
          onClick={() => setMinimizado(true)}
          style={{
            position:"absolute", top:"14px", right:"14px", zIndex:2,
            width:"34px", height:"34px",
            background:"rgba(0,0,0,0.55)",
            border:"2px solid rgba(255,255,255,0.35)",
            color:"var(--blanco)", fontSize:"15px",
            cursor:"pointer", display:"flex",
            alignItems:"center", justifyContent:"center",
          }}
          title="Minimizar"
        >
          ✕
        </button>

        {/* Aviso si imagen no carga */}
        {imagenFondo && imgError && (
          <div style={{
            position:"absolute", top:"14px", left:"14px", zIndex:2,
            fontSize:"5px", color:"var(--amarillo)",
            background:"rgba(0,0,0,0.6)", padding:"4px 8px",
            border:"1px solid var(--amarillo)", maxWidth:"180px", lineHeight:2,
          }}>
            ⚠ No se encontró /{imagenFondo}
          </div>
        )}
      </div>

      {/* ═══ ZONA MEDIA: banderas y nombres ═══════════════════════ */}
      <div style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        padding:"16px 16px 8px", flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"8px" }}>
          <span style={{ fontSize:"48px", lineHeight:1 }}>{localBandera}</span>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.5)", marginBottom:"4px" }}>VS</p>
            {abierta && (
              <span style={{
                background:"var(--rojo-chile)", color:"var(--blanco)",
                padding:"2px 8px", fontSize:"5px",
                animation:"parpadeo 1s ease-in-out infinite",
              }}>
                🔴 EN VIVO
              </span>
            )}
          </div>
          <span style={{ fontSize:"48px", lineHeight:1 }}>{visitanteBandera}</span>
        </div>
        <p style={{ fontSize:"6px", color:"rgba(255,255,255,0.65)", textAlign:"center", lineHeight:2 }}>
          {localNombre} vs {visitanteNombre}
        </p>
      </div>

      {/* ═══ ZONA INFERIOR: preguntas ══════════════════════════════ */}
      <div style={{
        flex:1, width:"100%", maxWidth:"440px",
        margin:"0 auto", padding:"8px 16px 24px",
        display:"flex", flexDirection:"column", gap:"10px",
      }}>

        {/* ── Pregunta ABIERTA (grande) ── */}
        {abierta && (
          <PreguntaGrande
            pregunta={abierta}
            miRespuesta={misRespuestas[abierta.id]}
            enviando={enviando === abierta.id}
            onResponder={(op) => responder(abierta, op)}
          />
        )}

        {/* ── Preguntas cerradas (minimizadas, plegables) ── */}
        {cerradas.length > 0 && (
          <div>
            {abierta && (
              <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)",
                margin:"8px 0 6px", letterSpacing:"1px" }}>
                PREGUNTAS ANTERIORES
              </p>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {cerradas.map(pq => (
                <PreguntaMinimizada
                  key={pq.id}
                  pregunta={pq}
                  miRespuesta={misRespuestas[pq.id]}
                  expandida={expandidaId === pq.id}
                  onToggle={() => setExpandidaId(prev => prev===pq.id ? null : pq.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Si no hay pregunta abierta y solo hay 1 cerrada, sugerir minimizar */}
        {!abierta && (
          <button
            onClick={() => setMinimizado(true)}
            className="btn-pixel btn-gris w-full"
            style={{ fontSize:"6px", marginTop:"8px" }}>
            MINIMIZAR EVENTO
          </button>
        )}
      </div>

      <style>{`
        @keyframes parpadeo { 0%,100%{opacity:1} 50%{opacity:0.55} }
      `}</style>
    </div>
  );
}

// ── Pregunta abierta (vista grande) ──────────────────────────
function PreguntaGrande({ pregunta, miRespuesta, enviando, onResponder }) {
  const pts = pregunta.puntosEnVivo || 3;
  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:"10px" }}>
        <span style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
          color:"var(--rojo-chile)", background:"rgba(214,40,40,0.15)",
          border:"1px solid var(--rojo-chile)", padding:"3px 10px",
        }}>
          PREGUNTA #{pregunta.numero}
        </span>
      </div>

      <div style={{ textAlign:"center", marginBottom:"10px" }}>
        <span style={{
          background:"rgba(244,208,63,0.15)", border:"2px solid var(--amarillo)",
          color:"var(--amarillo)", fontSize:"7px", padding:"4px 14px",
          boxShadow:"0 0 14px rgba(244,208,63,0.35)",
        }}>
          ¡RESPONDE Y GANA +{pts} PTS!
        </span>
      </div>

      <div style={{
        background:"rgba(255,255,255,0.04)", border:"2px solid rgba(255,255,255,0.12)",
        padding:"14px 12px", marginBottom:"12px",
      }}>
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
          color:"var(--blanco)", lineHeight:2, textAlign:"center" }}>
          {pregunta.texto}
        </p>
      </div>

      {!miRespuesta ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {(pregunta.opciones||[]).map((op,i) => (
            <button key={i} onClick={() => onResponder(op)} disabled={enviando}
              style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                padding:"10px 12px", background:"rgba(255,255,255,0.05)",
                border:"2px solid rgba(255,255,255,0.2)",
                color:"var(--blanco)", cursor:"pointer", textAlign:"left",
                transition:"all 0.15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--amarillo)";
                e.currentTarget.style.background  = "rgba(244,208,63,0.12)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.background  = "rgba(255,255,255,0.05)";
              }}>
              {op}
            </button>
          ))}
        </div>
      ) : (
        <div style={{
          background:"rgba(82,183,136,0.1)", border:"2px solid var(--verde-claro)",
          padding:"14px", textAlign:"center",
        }}>
          <p style={{ fontSize:"7px", color:"var(--verde-claro)", lineHeight:2 }}>
            ✅ Tu respuesta:
          </p>
          <p style={{ fontSize:"9px", color:"var(--amarillo)", marginTop:"4px", lineHeight:2 }}>
            {miRespuesta}
          </p>
          <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginTop:"6px", lineHeight:2 }}>
            Esperando que el admin cierre la pregunta...
          </p>
        </div>
      )}
    </div>
  );
}

// ── Pregunta cerrada (vista minimizada/plegable) ─────────────
function PreguntaMinimizada({ pregunta, miRespuesta, expandida, onToggle }) {
  const correcta = pregunta.respuestaCorrecta;
  const acerte   = miRespuesta && miRespuesta === correcta;
  const pts      = pregunta.puntosEnVivo || 3;

  return (
    <div style={{
      background:"rgba(255,255,255,0.03)",
      border:`1px solid ${acerte ? "rgba(82,183,136,0.4)" : "rgba(255,255,255,0.1)"}`,
    }}>
      {/* Cabecera siempre visible */}
      <button
        onClick={onToggle}
        style={{
          width:"100%", display:"flex", justifyContent:"space-between",
          alignItems:"center", padding:"8px 10px",
          background:"transparent", border:"none", cursor:"pointer",
        }}>
        <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
          color:"rgba(255,255,255,0.6)", textAlign:"left" }}>
          PREGUNTA #{pregunta.numero}
        </span>

        {/* Puntos ganados, siempre visibles aunque esté plegada */}
        {miRespuesta ? (
          <span style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color: acerte ? "var(--verde-claro)" : "var(--rojo-chile)",
            display:"flex", alignItems:"center", gap:"4px",
          }}>
            {acerte ? `🎉 +${pts} PTS` : "❌ NO ACERTASTE"}
            <span style={{ color:"rgba(255,255,255,0.4)", fontSize:"8px" }}>
              {expandida ? "▲" : "▼"}
            </span>
          </span>
        ) : (
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
            color:"rgba(255,255,255,0.35)", display:"flex", alignItems:"center", gap:"4px" }}>
            SIN RESPONDER
            <span style={{ fontSize:"8px" }}>{expandida ? "▲" : "▼"}</span>
          </span>
        )}
      </button>

      {/* Contenido expandido */}
      {expandida && (
        <div style={{ padding:"0 10px 10px" }}>
          <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color:"var(--blanco)", lineHeight:2, marginBottom:"8px" }}>
            {pregunta.texto}
          </p>
          <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color:"var(--amarillo)", marginBottom:"4px" }}>
            ✅ Correcta: <strong>{correcta}</strong>
          </p>
          {miRespuesta && (
            <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
              color: acerte ? "var(--verde-claro)" : "var(--rojo-chile)" }}>
              Tu respuesta: {miRespuesta}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
