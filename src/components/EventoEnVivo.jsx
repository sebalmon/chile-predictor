// src/components/EventoEnVivo.jsx  — v6 (con resumen de apuesta al responder)
import React, { useState, useEffect } from "react";
import {
  doc, getDoc, collection, onSnapshot, setDoc, serverTimestamp,
  query, where, getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const REF_EVENTO = () => doc(db, "eventoEnVivo", "actual");

export default function EventoEnVivo() {
  const { firebaseUser } = useAuth();
  const [evento,            setEvento]            = useState(null);
  const [misRespuestas,     setMisRespuestas]     = useState({});
  const [misRespuestasData, setMisRespuestasData] = useState({});
  const [apuestas,          setApuestas]          = useState({});
  const [enviando,          setEnviando]          = useState(null);
  const [minimizado,        setMinimizado]        = useState(false);
  const [imgError,          setImgError]          = useState(false);
  const [expandidaId,       setExpandidaId]       = useState(null);
  const [puntosVivos,       setPuntosVivos]       = useState(0);

  // Escuchar puntosTotal en tiempo real
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    const unsub = onSnapshot(doc(db,"usuarios",firebaseUser.uid), snap => {
      if (snap.exists()) setPuntosVivos(snap.data().puntosTotal ?? 0);
    });
    return () => unsub();
  }, [firebaseUser?.uid]);

  // Escuchar el evento en vivo
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

  // Cargar respuestas al inicio y escuchar cambios
  useEffect(() => {
    if (!firebaseUser?.uid) return;

    const cargarRespuestas = async () => {
      try {
        const respuestasRef = collection(db, "eventoEnVivo", "actual", "respuestas");
        const q = query(respuestasRef, where("uid", "==", firebaseUser.uid));
        const snapshot = await getDocs(q);
        const nuevasData = {};
        const nuevasResp = {};
        snapshot.docs.forEach(doc => {
          const r = doc.data();
          nuevasResp[r.preguntaId] = r.respuesta;
          nuevasData[r.preguntaId] = {
            apuesta:       r.apuesta || 0,
            puntosGanados: r.puntosGanados ?? null,
            correcta:      r.correcta ?? null,
          };
        });
        console.log("📩 Cargadas respuestas del usuario:", nuevasResp);
        console.log("📩 Datos completos:", nuevasData);
        setMisRespuestas(nuevasResp);
        setMisRespuestasData(nuevasData);
      } catch (error) {
        console.error("Error cargando respuestas:", error);
      }
    };

    cargarRespuestas();

    const respuestasRef = collection(db, "eventoEnVivo", "actual", "respuestas");
    const q = query(respuestasRef, where("uid", "==", firebaseUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const nuevasData = {};
      const nuevasResp = {};
      snapshot.docs.forEach(doc => {
        const r = doc.data();
        nuevasResp[r.preguntaId] = r.respuesta;
        nuevasData[r.preguntaId] = {
          apuesta:       r.apuesta || 0,
          puntosGanados: r.puntosGanados ?? null,
          correcta:      r.correcta ?? null,
        };
      });
      console.log("🔄 Actualización en tiempo real:", nuevasResp);
      setMisRespuestas(nuevasResp);
      setMisRespuestasData(nuevasData);
    });

    return () => unsub();
  }, [firebaseUser?.uid, evento]);

  const preguntas  = evento?.preguntas || [];
  const abiertas   = preguntas.filter(p => p.estado === "abierta").slice().reverse();
  const cerradas   = preguntas.filter(p => p.estado === "cerrada").slice().reverse();
  const ptsJugados = preguntas.reduce((s, p) => s + (p.modoApuesta === "apuesta" ? 0 : (p.puntosEnVivo || 0)), 0);

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
          apuesta:    apuestas[pregunta.id] || 0,
        }
      );
      setMisRespuestas(prev => ({ ...prev, [pregunta.id]: opcion }));
      localStorage.setItem(`cp8b_ev_resp_${pregunta.id}`, opcion);
      if (apuestas[pregunta.id]) {
        setMisRespuestasData(prev => ({ ...prev, [pregunta.id]: { apuesta: apuestas[pregunta.id] } }));
      }
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

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:700,
      display:"flex", flexDirection:"column",
      fontFamily:"'Press Start 2P', monospace",
      background:"#0a0510",
    }}>
      {/* IMAGEN PROTAGONISTA */}
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

        <div style={{
          position:"absolute", left:0, right:0, bottom:0, height:"50%",
          background:"linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%)",
        }} />

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
        >✕</button>

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

        {/* Banderas superpuestas */}
        <div style={{
          position:"absolute", left:0, right:0, bottom:0, zIndex:1,
          padding:"0 16px 14px",
          display:"flex", flexDirection:"column", alignItems:"center",
        }}>
          {/* Puntos en juego */}
          {ptsJugados > 0 && (
            <div style={{
              marginBottom:"8px",
              background:"rgba(0,0,0,0.6)",
              border:"2px solid var(--amarillo)",
              padding:"4px 14px",
              boxShadow:"0 0 12px rgba(244,208,63,0.3)",
            }}>
              <p style={{
                fontFamily:"'Press Start 2P',monospace",
                fontSize:"7px", color:"var(--amarillo)",
                lineHeight:1.8,
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

      {/* ZONA INFERIOR: preguntas */}
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
                apuesta={apuestas[preg.id] || 0}
                onApuesta={(v) => setApuestas(prev => ({ ...prev, [preg.id]: v }))}
                puntosDisponibles={puntosVivos}
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
                  miData={misRespuestasData[pq.id] || {}}
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

// ── Paleta de colores por pregunta ────────────────────────────
const PALETA = [
  { borde:"#f59e0b", fondo:"rgba(245,158,11,0.12)", texto:"#f59e0b" },
  { borde:"#60a5fa", fondo:"rgba(96,165,250,0.12)", texto:"#60a5fa" },
  { borde:"#a78bfa", fondo:"rgba(167,139,250,0.12)", texto:"#a78bfa" },
  { borde:"#34d399", fondo:"rgba(52,211,153,0.12)", texto:"#34d399" },
  { borde:"#f87171", fondo:"rgba(248,113,113,0.12)", texto:"#f87171" },
  { borde:"#fb923c", fondo:"rgba(251,146,60,0.12)", texto:"#fb923c" },
];
function colorPregunta(n) { return PALETA[((n||1)-1) % PALETA.length]; }

function useCountdown(pregunta) {
  const [secsLeft, setSecsLeft] = React.useState(null);
  React.useEffect(() => {
    const mins = pregunta.timerMinutos || 0;
    if (!mins || !pregunta.creadaEn) { setSecsLeft(null); return; }
    const inicio   = new Date(pregunta.creadaEn).getTime();
    const duracion = mins * 60 * 1000;
    const tick = () => {
      setSecsLeft(Math.max(0, Math.ceil((inicio + duracion - Date.now()) / 1000)));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [pregunta.id, pregunta.timerMinutos, pregunta.creadaEn]);
  return secsLeft;
}

// ── Componente PreguntaGrande (con resumen de apuesta) ──
function PreguntaGrande({ pregunta, miRespuesta, enviando, onResponder, apuesta, onApuesta, puntosDisponibles }) {
  const pts           = pregunta.puntosEnVivo || 3;
  const color         = colorPregunta(pregunta.numero);
  const letras        = ["A","B","C","D","E"];
  const secsLeft      = useCountdown(pregunta);
  const tiempoAgotado = secsLeft !== null && secsLeft <= 0;
  const fmtTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  // Calcular ganancia esperada si acierta
  const calcularGanancia = () => {
    const modo = pregunta.modoApuesta || "fijo";
    let total = 0;
    if (modo !== "apuesta") {
      total += pts; // puntos fijos
    }
    if (modo === "apuesta" || modo === "ambos") {
      const mult = pregunta.multiplicador || 1;
      total += apuesta * mult;
    }
    return total;
  };

  const gananciaEsperada = calcularGanancia();

  return (
    <div style={{
      border:`2px solid ${color.borde}`,
      background: color.fondo,
      backdropFilter:"blur(8px)",
      overflow:"hidden",
    }}>
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"8px 12px",
        background:`rgba(0,0,0,0.35)`,
        borderBottom:`1px solid ${color.borde}44`,
      }}>
        <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"9px",
          color: color.texto, letterSpacing:"1px" }}>
          PREGUNTA #{pregunta.numero}
        </span>
        {pregunta.modoApuesta !== "apuesta" && (
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color:"var(--amarillo)",
            background:"rgba(244,208,63,0.15)",
            border:"1px solid rgba(244,208,63,0.4)",
            padding:"2px 8px" }}>
            {pts > 0 ? `+${pts} PTS` : `×${pregunta.multiplicador?.toFixed(1) || ""}`}
          </span>
        )}
        {(pregunta.modoApuesta === "apuesta" || pregunta.modoApuesta === "ambos") && pregunta.multiplicador && (
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"12px",
            color:"var(--rojo-chile)",
            background:"rgba(214,40,40,0.15)",
            border:"2px solid var(--rojo-chile)",
            padding:"4px 12px" }}>
            ×{pregunta.multiplicador.toFixed(1)}
          </span>
        )}
      </div>

      <div style={{ padding: "4px 12px 10px" }}>
  <p style={{
    fontFamily: "'Press Start 2P', monospace",
    fontSize: "10px",
    color: "var(--blanco)",
    lineHeight: 2.2,
    textAlign: "center",
    background: "rgba(0, 0, 0, 0.6)",
    padding: "10px 14px",
    // Sin borderRadius y sin boxShadow
  }}>
    {pregunta.texto}
  </p>
</div>

      {secsLeft !== null && (
        <div style={{ textAlign:"center", padding:"6px 12px 2px" }}>
          <span style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"9px",
            color: tiempoAgotado   ? "var(--rojo-chile)"
                 : secsLeft <= 30 ? "#f87171"
                 : secsLeft <= 60 ? "#fb923c"
                 : "var(--verde-claro)",
          }}>
            {tiempoAgotado
              ? "⏰ TIEMPO AGOTADO"
              : `⏱ Te quedan ${fmtTime(secsLeft)} para responder`}
          </span>
        </div>
      )}

      <div style={{ padding:"0 12px 14px" }}>
        {/* Apuesta propia (solo si no ha respondido) */}
        {!miRespuesta && (pregunta.modoApuesta === "apuesta" || pregunta.modoApuesta === "ambos") && (
          <div style={{ padding:"4px 12px 10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
              <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px", color:"var(--amarillo)" }}>
                💰 APUESTA: <strong>{apuesta} pts</strong>
              </span>
              <span style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)" }}>
                Tienes {puntosDisponibles} · máx 200
              </span>
            </div>
            <input type="range" min="0"
              max={Math.min(200, puntosDisponibles)}
              step="1" value={apuesta}
              onChange={e => onApuesta(Number(e.target.value))}
              style={{ width:"100%", accentColor: color.borde }} />
            {apuesta > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"6px" }}>
                <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px", color:"#34d399" }}>
                  ✅ Si aciertas → +{Math.round(apuesta * (pregunta.multiplicador || 1))} pts
                </span>
                <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px", color:"#f87171" }}>
                  ❌ Si fallas → -{apuesta} pts
                </span>
              </div>
            )}
          </div>
        )}

        {!miRespuesta && !tiempoAgotado ? (
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
          // --- BLOQUE CUANDO YA RESPONDIÓ (con resumen de apuesta) ---
          <div style={{
            background:"rgba(0,0,0,0.35)",
            border:`1px solid ${color.borde}88`,
            padding:"12px",
            textAlign:"center",
          }}>
            <p style={{ fontSize:"6px", color: color.texto, lineHeight:2 }}>
              ✅ Respondiste:
            </p>
            <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
              color:"var(--blanco)", marginTop:"4px", lineHeight:2 }}>
              {miRespuesta}
            </p>

            {/* Resumen de la apuesta (solo si modo no es "fijo") */}
            {pregunta.modoApuesta !== "fijo" && (
              <div style={{ marginTop: "10px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px" }}>
                <p style={{ fontSize:"6px", color:"var(--amarillo)" }}>
                  💰 Apuesta: <strong>{apuesta} pts</strong>
                </p>
                <div style={{ display: "flex", justifyContent: "space-around", marginTop: "6px", flexWrap: "wrap", gap: "4px" }}>
                  <span style={{ fontSize:"6px", color:"#34d399" }}>
                    ✅ Si aciertas: +{gananciaEsperada} pts
                  </span>
                  {apuesta > 0 && (
                    <span style={{ fontSize:"6px", color:"#f87171" }}>
                      ❌ Si fallas: -{apuesta} pts
                    </span>
                  )}
                </div>
              </div>
            )}

            {pregunta.modoApuesta === "fijo" && (
              <div style={{ marginTop: "8px" }}>
                <span style={{ fontSize:"6px", color:"var(--amarillo)" }}>
                  🎁 Puntos fijos: +{pts} pts si aciertas
                </span>
              </div>
            )}

            <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)",
              marginTop:"8px", lineHeight:2 }}>
              El admin cerrará la pregunta en breve...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente PreguntaMinimizada (sin cambios) ──
function PreguntaMinimizada({ pregunta, miRespuesta, miData, expandida, onToggle }) {
  const correcta  = pregunta.respuestaCorrecta;
  const acerte    = miRespuesta && miRespuesta === correcta;
  const pts       = pregunta.modoApuesta === "apuesta" ? 0 : (pregunta.puntosEnVivo || 0);
  const apuesta   = miData?.apuesta || 0;
  const ptsReales = miData?.puntosGanados ??
    (acerte
      ? pts + (apuesta > 0 ? Math.round(apuesta * (pregunta.multiplicador || 1)) : 0)
      : 0);

  return (
    <div style={{
      background:"rgba(255,255,255,0.03)",
      border:`1px solid ${acerte ? "rgba(82,183,136,0.4)" : "rgba(255,255,255,0.1)"}`,
    }}>
      <button onClick={onToggle}
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
            {acerte
              ? `🎉 +${ptsReales} PTS`
              : apuesta > 0
                ? `❌ -${apuesta} pts`
                : "❌ NO ACERTASTE"}
            <span style={{ color:"rgba(255,255,255,0.4)", fontSize:"8px" }}>
              {expandida ? "▲" : "▼"}
            </span>
          </span>
        ) : (
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
            color:"rgba(255,255,255,0.35)", display:"flex", alignItems:"center", gap:"4px" }}>
            NO PARTICIPÓ
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