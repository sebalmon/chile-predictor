// src/components/EventoEnVivo.jsx  — v4
// ─────────────────────────────────────────────────────────────
// CAMBIOS v4:
//   • La imagen ahora ocupa 42% de la altura de pantalla (40vh-45vh)
//     en vez de un alto fijo pequeño — se ve grande y completa.
//   • Banderas y nombres se superponen SOBRE la imagen (parte
//     inferior, con degradado para legibilidad), no debajo de ella
//     compitiendo por espacio.
//   • Todo el contenido de preguntas va en una zona inferior con
//     scroll propio, dejando la imagen siempre visible y fija.
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
  const [misRespuestas, setMisRespuestas] = useState({});
  const [enviando,      setEnviando]      = useState(null);
  const [minimizado,    setMinimizado]    = useState(false);
  const [imgError,      setImgError]      = useState(false);
  const [expandidaId,   setExpandidaId]   = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(REF_EVENTO(), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setEvento(data);
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

  const preguntas = evento?.preguntas || [];
  // Pueden convivir varias preguntas abiertas a la vez.
  // Se invierte el orden: la pregunta más reciente aparece arriba.
  const abiertas   = preguntas.filter(p => p.estado === "abierta").slice().reverse();
  const cerradas   = preguntas.filter(p => p.estado === "cerrada").slice().reverse();
  // Suma de puntos de TODAS las preguntas del evento (abiertas + cerradas)
  const ptsJugados = preguntas.reduce((s, p) => s + (p.puntosEnVivo || 0), 0);

  // Cuando aparece una pregunta nueva abierta, des-minimizar
  const idsAbiertas = abiertas.map(p => p.id).join(",");
  useEffect(() => {
    if (abiertas.length > 0) setMinimizado(false);
  }, [idsAbiertas]);

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
    }}>
      {/* ═══ IMAGEN PROTAGONISTA (fija, 42% de la pantalla) ═══ */}
      <div style={{
        position:"relative", width:"100%", height:"42vh",
        minHeight:"260px", flexShrink:0, overflow:"hidden",
      }}>
        {imagenFondo && !imgError ? (
          <img
            src={`/${imagenFondo}`}
            alt="Imagen del partido"
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width:"100%", height:"100%",
            background:"radial-gradient(ellipse at center, #2a0050 0%, #0a0510 100%)",
          }} />
        )}

        {/* Degradado solo en la franja inferior, para legibilidad de banderas */}
        <div style={{
          position:"absolute", left:0, right:0, bottom:0, height:"50%",
          background:"linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)",
        }} />

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

        {/* Banderas y nombres SUPERPUESTOS sobre la franja inferior */}
        <div style={{
          position:"absolute", left:0, right:0, bottom:0, zIndex:1,
          padding:"0 16px 14px",
          display:"flex", flexDirection:"column", alignItems:"center",
        }}>
          {/* Puntos jugados en el EN VIVO */}
          {ptsJugados > 0 && (
            <div style={{
              marginBottom:"10px",
              background:"rgba(0,0,0,0.55)",
              border:"2px solid var(--amarillo)",
              padding:"6px 16px",
              textAlign:"center",
              boxShadow:"0 0 12px rgba(244,208,63,0.3)",
            }}>
              <p style={{
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"7px",
                color:"var(--amarillo)",
                lineHeight:1.8,
                textShadow:"0 0 8px rgba(244,208,63,0.6)",
              }}>
                🏆 {ptsJugados} PTS EN JUEGO
              </p>
            </div>
          )}

          <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"6px" }}>
            <span style={{ fontSize:"40px", lineHeight:1,
              filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.8))" }}>
              {localBandera}
            </span>
            <div style={{ textAlign:"center" }}>
              {abiertas.length > 0 && (
                <span style={{
                  background:"var(--rojo-chile)", color:"var(--blanco)",
                  padding:"2px 8px", fontSize:"5px",
                  animation:"parpadeo 1s ease-in-out infinite",
                  display:"inline-block",
                }}>
                  🔴 EN VIVO
                </span>
              )}
            </div>
            <span style={{ fontSize:"40px", lineHeight:1,
              filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.8))" }}>
              {visitanteBandera}
            </span>
          </div>
          <p style={{ fontSize:"6px", color:"var(--blanco)", textAlign:"center",
            lineHeight:1.8, textShadow:"0 2px 4px rgba(0,0,0,0.9)" }}>
            {localNombre} vs {visitanteNombre}
          </p>
        </div>
      </div>

      {/* ═══ ZONA INFERIOR: preguntas, con scroll propio ═══════ */}
      <div style={{
        flex:1, overflowY:"auto",
        width:"100%", maxWidth:"440px", margin:"0 auto",
        padding:"16px 16px 24px",
        display:"flex", flexDirection:"column", gap:"10px",
      }}>

        {abiertas.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            {abiertas.map(preg => (
              <PreguntaGrande
                key={preg.id}
                pregunta={preg}
                miRespuesta={misRespuestas[preg.id]}
                enviando={enviando === preg.id}
                onResponder={(op) => responder(preg, op)}
              />
            ))}
          </div>
        )}

        {cerradas.length > 0 && (
          <div>
            {abiertas.length > 0 && (
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

        {abiertas.length === 0 && (
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
// Paleta de colores por número de pregunta (para diferenciarlas visualmente)
const PALETA = [
  { borde:"#f59e0b", fondo:"rgba(245,158,11,0.12)", texto:"#f59e0b" }, // ámbar
  { borde:"#60a5fa", fondo:"rgba(96,165,250,0.12)", texto:"#60a5fa" }, // azul
  { borde:"#a78bfa", fondo:"rgba(167,139,250,0.12)", texto:"#a78bfa" }, // violeta
  { borde:"#34d399", fondo:"rgba(52,211,153,0.12)", texto:"#34d399" }, // verde
  { borde:"#f87171", fondo:"rgba(248,113,113,0.12)", texto:"#f87171" }, // rojo
  { borde:"#fb923c", fondo:"rgba(251,146,60,0.12)", texto:"#fb923c" }, // naranja
];
function colorPregunta(n) { return PALETA[((n||1)-1) % PALETA.length]; }

function PreguntaGrande({ pregunta, miRespuesta, enviando, onResponder }) {
  const pts    = pregunta.puntosEnVivo || 3;
  const color  = colorPregunta(pregunta.numero);
  const letras = ["A","B","C","D","E"];

  return (
    <div style={{
      border:`2px solid ${color.borde}`,
      background: color.fondo,
      backdropFilter:"blur(8px)",
      overflow:"hidden",
    }}>
      {/* Cabecera de la pregunta */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"8px 12px",
        background:`rgba(0,0,0,0.35)`,
        borderBottom:`1px solid ${color.borde}44`,
      }}>
        <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
          color: color.texto, letterSpacing:"1px" }}>
          PREGUNTA #{pregunta.numero}
        </span>
        <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
          color:"var(--amarillo)",
          background:"rgba(244,208,63,0.15)",
          border:"1px solid rgba(244,208,63,0.4)",
          padding:"2px 8px" }}>
          +{pts} PTS
        </span>
      </div>

      {/* Texto de la pregunta */}
      <div style={{ padding:"14px 12px 10px" }}>
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
          color:"var(--blanco)", lineHeight:2.2, textAlign:"center",
          textShadow:"0 1px 4px rgba(0,0,0,0.6)" }}>
          {pregunta.texto}
        </p>
      </div>

      {/* Opciones o confirmación */}
      <div style={{ padding:"0 12px 14px" }}>
        {!miRespuesta ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
            {(pregunta.opciones||[]).map((op,i) => (
              <button key={i} onClick={() => onResponder(op)} disabled={enviando}
                style={{
                  fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                  padding:"9px 12px",
                  background:"rgba(0,0,0,0.45)",
                  border:`2px solid rgba(255,255,255,0.15)`,
                  color:"var(--blanco)", cursor:"pointer",
                  textAlign:"left", display:"flex", alignItems:"center", gap:"10px",
                  transition:"all 0.12s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = color.borde;
                  e.currentTarget.style.background  = color.fondo;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                  e.currentTarget.style.background  = "rgba(0,0,0,0.45)";
                }}>
                <span style={{ color: color.texto, opacity:0.8, flexShrink:0 }}>
                  {letras[i]}.
                </span>
                {op}
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            background:"rgba(0,0,0,0.35)", border:`1px solid ${color.borde}88`,
            padding:"12px", textAlign:"center",
          }}>
            <p style={{ fontSize:"6px", color: color.texto, lineHeight:2 }}>
              ✅ Respondiste:
            </p>
            <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
              color:"var(--blanco)", marginTop:"4px", lineHeight:2 }}>
              {miRespuesta}
            </p>
            <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)",
              marginTop:"6px", lineHeight:2 }}>
              El admin cerrará la pregunta en breve...
            </p>
          </div>
        )}
      </div>
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
