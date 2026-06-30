// src/components/SuperDestacado.jsx  — v7
// ─────────────────────────────────────────────────────────────
// Vista del USUARIO durante un partido Super Destacado.
// • Polling cada 8 segundos (más rápido que v6).
// • La imagen de fondo viene del campo `imagenFondo` del partido
//   en Firestore. Ejemplo: imagenFondo = "A_PAISES_MARRUECOS.jpg"
//   → la imagen debe estar en /public/A_PAISES_MARRUECOS.jpg
// • Si no hay imagenFondo definida, usa gradiente por defecto.
// • Ocupa PANTALLA COMPLETA como modal (fullscreen overlay).
// • Muestra banderas grandes de ambos equipos.
// • Puntaje variable (lee puntosEnVivo de cada pregunta).
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, where, doc,
  setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const LS_PREFIX = "cp8b_sd_visto_";

export default function SuperDestacado({ partidoId, nombrePartido }) {
  const { firebaseUser } = useAuth();
  const [preguntaActiva, setPreguntaActiva] = useState(null);
  const [miRespuesta,    setMiRespuesta]    = useState(null);
  const [enviando,       setEnviando]       = useState(false);
  const [resultado,      setResultado]      = useState(null);
  const [resultadoVisto, setResultadoVisto] = useState(false);
  const [partidoData,    setPartidoData]    = useState(null);

  // Cargar datos del partido una vez
  useEffect(() => {
    if (!partidoId) return;
    getDoc(doc(db, "partidos", partidoId))
      .then(snap => { if (snap.exists()) setPartidoData(snap.data()); })
      .catch(() => {});
  }, [partidoId]);

  // Polling cada 8 segundos
  useEffect(() => {
    if (!partidoId) return;
    let cancelado = false;

    const poll = async () => {
      try {
        const ref = collection(db, "preguntasEnVivo", partidoId, "preguntas");

        // 1. Buscar pregunta abierta
        const snapA = await getDocs(query(ref, where("estado","==","abierta")));
        if (cancelado) return;

        if (!snapA.empty) {
          const preg = { id: snapA.docs[0].id, ...snapA.docs[0].data() };
          setPreguntaActiva(preg);
          setResultado(null);

          // ¿Ya respondí?
          if (firebaseUser) {
            const rSnap = await getDoc(
              doc(db, "preguntasEnVivo", partidoId, "respuestasEnVivo",
                  `${firebaseUser.uid}_${preg.id}`)
            );
            if (!cancelado)
              setMiRespuesta(rSnap.exists() ? rSnap.data().respuesta : null);
          }
        } else {
          // 2. Buscar la más reciente cerrada
          setPreguntaActiva(null);
          const snapC = await getDocs(query(ref, where("estado","==","cerrada")));
          if (cancelado) return;

          if (!snapC.empty) {
            const cerradas = snapC.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .sort((a,b) => (b.creadaEn?.seconds||0) - (a.creadaEn?.seconds||0));
            const ultima = cerradas[0];
            const clave  = `${LS_PREFIX}${partidoId}_${ultima.id}`;
            setResultado(ultima);
            setResultadoVisto(localStorage.getItem(clave) === "true");
          } else {
            setResultado(null);
          }
        }
      } catch (_) {}
    };

    poll();
    const iv = setInterval(poll, 8000);
    return () => { cancelado = true; clearInterval(iv); };
  }, [partidoId, firebaseUser]);

  const responder = async (opcion) => {
    if (!firebaseUser || !preguntaActiva || miRespuesta || enviando) return;
    setEnviando(true);
    try {
      await setDoc(
        doc(db, "preguntasEnVivo", partidoId, "respuestasEnVivo",
            `${firebaseUser.uid}_${preguntaActiva.id}`),
        {
          uid:        firebaseUser.uid,
          preguntaId: preguntaActiva.id,
          respuesta:  opcion,
          partidoId,
          timestamp:  serverTimestamp(),
        }
      );
      setMiRespuesta(opcion);
    } catch (_) {}
    finally { setEnviando(false); }
  };

  const ocultarResultado = () => {
    if (!resultado) return;
    localStorage.setItem(`${LS_PREFIX}${partidoId}_${resultado.id}`, "true");
    setResultadoVisto(true);
  };

  if (!partidoId) return null;
  if (!preguntaActiva && !resultado) return null;
  if (resultado && resultadoVisto) return null;

  // Datos visuales
  const localBandera     = partidoData?.local?.bandera     || "🏳️";
  const visitanteBandera = partidoData?.visitante?.bandera || "🏳️";
  const localNombre      = partidoData?.local?.nombre      || "Local";
  const visitanteNombre  = partidoData?.visitante?.nombre  || "Visitante";
  const imagenFondo      = partidoData?.imagenFondo;
  const pts              = preguntaActiva?.puntosEnVivo || resultado?.puntosEnVivo || 3;

  // ── MODAL FULLSCREEN ────────────────────────────────────────
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:700,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Press Start 2P', monospace",
    }}>
      {/* Capa de imagen de fondo */}
      {imagenFondo ? (
        <div style={{
          position:"absolute", inset:0,
          backgroundImage:`url(/${imagenFondo})`,
          backgroundSize:"cover", backgroundPosition:"center",
          filter:"brightness(0.35) saturate(1.3)",
        }} />
      ) : (
        <div style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse at center, #1a0a2e 0%, #0a0510 100%)",
        }} />
      )}

      {/* Overlay oscuro degradado */}
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.85) 100%)",
      }} />

      {/* Contenido */}
      <div style={{
        position:"relative", zIndex:1,
        width:"100%", maxWidth:"440px",
        padding:"20px 16px",
        display:"flex", flexDirection:"column", alignItems:"center",
      }}>

        {/* Banderas grandes */}
        <div style={{
          display:"flex", alignItems:"center", gap:"16px",
          marginBottom:"12px",
        }}>
          <span style={{ fontSize:"52px", lineHeight:1,
            filter:"drop-shadow(0 0 8px rgba(255,255,255,0.3))" }}>
            {localBandera}
          </span>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:"6px", color:"rgba(255,255,255,0.6)", lineHeight:2 }}>VS</p>
            <div style={{
              background:"var(--rojo-chile)", color:"var(--blanco)",
              padding:"2px 8px", fontSize:"5px",
              border:"1px solid rgba(255,255,255,0.3)",
              animation:"parpadeo 1s ease-in-out infinite",
            }}>
              🔴 EN VIVO
            </div>
          </div>
          <span style={{ fontSize:"52px", lineHeight:1,
            filter:"drop-shadow(0 0 8px rgba(255,255,255,0.3))" }}>
            {visitanteBandera}
          </span>
        </div>

        {/* Nombres */}
        <p style={{ fontSize:"6px", color:"rgba(255,255,255,0.7)",
          marginBottom:"16px", textAlign:"center", lineHeight:2 }}>
          {localNombre} vs {visitanteNombre}
        </p>

        {/* ── PREGUNTA ACTIVA ─────────────────────────────── */}
        {preguntaActiva && (
          <div style={{ width:"100%" }}>
            {/* Badge de puntos */}
            <div style={{ textAlign:"center", marginBottom:"12px" }}>
              <span style={{
                background:"rgba(244,208,63,0.2)",
                border:"2px solid var(--amarillo)",
                color:"var(--amarillo)",
                fontSize:"7px", padding:"4px 12px",
                boxShadow:"0 0 12px rgba(244,208,63,0.4)",
              }}>
                ¡RESPONDE Y GANA +{pts} PTS!
              </span>
            </div>

            {/* Texto de la pregunta */}
            <div style={{
              background:"rgba(0,0,0,0.6)",
              border:"2px solid rgba(255,255,255,0.15)",
              padding:"14px 12px", marginBottom:"12px",
              backdropFilter:"blur(4px)",
            }}>
              <p style={{ fontSize:"8px", color:"var(--blanco)",
                lineHeight:2, textAlign:"center",
                textShadow:"2px 2px 4px rgba(0,0,0,0.8)" }}>
                {preguntaActiva.texto}
              </p>
            </div>

            {/* Opciones o confirmación */}
            {!miRespuesta ? (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {(preguntaActiva.opciones||[]).map((op, i) => (
                  <button key={i}
                    onClick={() => responder(op)}
                    disabled={enviando}
                    style={{
                      fontFamily:"'Press Start 2P',monospace",
                      fontSize:"7px", padding:"10px 12px",
                      background:"rgba(0,0,0,0.65)",
                      border:"2px solid rgba(255,255,255,0.25)",
                      color:"var(--blanco)", cursor:"pointer",
                      textAlign:"left",
                      backdropFilter:"blur(4px)",
                      transition:"all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "var(--amarillo)";
                      e.currentTarget.style.background  = "rgba(244,208,63,0.18)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                      e.currentTarget.style.background  = "rgba(0,0,0,0.65)";
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                background:"rgba(82,183,136,0.15)",
                border:"2px solid var(--verde-claro)",
                padding:"14px", textAlign:"center",
              }}>
                <p style={{ fontSize:"7px", color:"var(--verde-claro)", lineHeight:2 }}>
                  ✅ Tu respuesta:
                </p>
                <p style={{ fontSize:"8px", color:"var(--amarillo)",
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

        {/* ── RESULTADO ───────────────────────────────────── */}
        {!preguntaActiva && resultado && !resultadoVisto && (
          <div style={{ width:"100%" }}>
            <div style={{
              background:"rgba(0,0,0,0.7)",
              border:`3px solid ${miRespuesta===resultado.respuestaCorrecta
                ? "var(--verde-claro)" : "var(--gris)"}`,
              padding:"16px 14px",
              backdropFilter:"blur(4px)",
            }}>
              <p style={{ fontSize:"6px", color:"var(--gris-claro)",
                marginBottom:"8px", textAlign:"center" }}>
                RESULTADO DE LA PREGUNTA
              </p>
              <p style={{ fontSize:"7px", color:"var(--blanco)",
                lineHeight:2, marginBottom:"10px", textAlign:"center" }}>
                {resultado.texto}
              </p>
              <p style={{ fontSize:"7px", color:"var(--amarillo)",
                marginBottom:"8px", textAlign:"center" }}>
                ✅ Correcta: <strong>{resultado.respuestaCorrecta}</strong>
              </p>
              {miRespuesta ? (
                <p style={{ fontSize:"8px", textAlign:"center",
                  color: miRespuesta===resultado.respuestaCorrecta
                    ? "var(--verde-claro)" : "var(--rojo-chile)" }}>
                  {miRespuesta===resultado.respuestaCorrecta
                    ? `🎉 ¡ACERTASTE! +${resultado.puntosEnVivo||3} PTS`
                    : `❌ Respondiste: ${miRespuesta}`}
                </p>
              ) : (
                <p style={{ fontSize:"6px", color:"var(--gris-claro)",
                  textAlign:"center" }}>
                  No respondiste esta pregunta.
                </p>
              )}
              <button
                onClick={ocultarResultado}
                className="btn-pixel btn-gris w-full"
                style={{ fontSize:"7px", marginTop:"14px" }}>
                CERRAR ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes parpadeo {
          0%,100% { opacity:1; }
          50%      { opacity:0.6; }
        }
      `}</style>
    </div>
  );
}
