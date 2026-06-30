// src/components/AdminEventoEnVivo.jsx  — v2
// ─────────────────────────────────────────────────────────────
// CAMBIOS v2:
//   • Las preguntas ahora son un ARRAY dentro del evento
//     (campo `preguntas`), no un objeto único que se sobrescribe.
//     Cada pregunta tiene `numero` (1, 2, 3...) y se mantiene
//     en el historial aunque se cierre.
//   • Respuestas: clave compuesta {uid}_{preguntaId} para que
//     cada usuario pueda responder varias preguntas del mismo
//     evento sin pisarse.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import {
  doc, onSnapshot, setDoc, updateDoc,
  collection, getDocs, query, where, writeBatch, increment,
} from "firebase/firestore";
import { db } from "../firebase";

const REF_EVENTO = () => doc(db, "eventoEnVivo", "actual");
const REF_RESPS  = () => collection(db, "eventoEnVivo", "actual", "respuestas");

const BANDERAS = [
  "🇦🇷","🇧🇷","🇨🇱","🇺🇾","🇩🇪","🇫🇷","🇪🇸","🇵🇹","🇮🇹",
  "🇬🇧","🇳🇱","🇧🇪","🇨🇷","🇲🇽","🇨🇴","🇵🇪","🇵🇾","🇪🇨",
  "🇺🇸","🇯🇵","🇰🇷","🇲🇦","🇸🇳","🇬🇭","🇨🇲","🇨🇭","🇦🇹",
  "🇵🇱","🇭🇷","🇸🇪","🇩🇰","🇳🇴","🇦🇺","🇳🇿","🇸🇦","🇮🇷",
];

export default function AdminEventoEnVivo({ onMensaje }) {
  const [evento,   setEvento]   = useState(null);
  const [cargando, setCargando] = useState(true);
  const unsubRef = useRef(null);

  // Form configuración
  const [nombreL,  setNombreL]  = useState("");
  const [banderaL, setBanderaL] = useState("🏳️");
  const [nombreV,  setNombreV]  = useState("");
  const [banderaV, setBanderaV] = useState("🏳️");
  const [imagen,   setImagen]   = useState("");
  const [selBand,  setSelBand]  = useState(null);

  // Form pregunta
  const [textoPrg, setTextoPrg] = useState("");
  const [opciones, setOpciones] = useState(["",""]);
  const [puntos,   setPuntos]   = useState(3);
  const [creando,  setCreando]  = useState(false);

  // Cierre
  const [respSel,  setRespSel]  = useState("");
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    unsubRef.current = onSnapshot(REF_EVENTO(), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setEvento(d);
        setNombreL(d.equipoLocal?.nombre   || "");
        setBanderaL(d.equipoLocal?.bandera || "🏳️");
        setNombreV(d.equipoVisitante?.nombre   || "");
        setBanderaV(d.equipoVisitante?.bandera || "🏳️");
        setImagen(d.imagenFondo || "");
      } else {
        setEvento(null);
      }
      setCargando(false);
    }, () => setCargando(false));
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  const preguntas = evento?.preguntas || [];
  const abierta   = preguntas.find(p => p.estado === "abierta");

  // ── Guardar configuración (NO toca el array de preguntas) ───
  const guardarConfig = async () => {
    if (!nombreL.trim() || !nombreV.trim()) {
      onMensaje("error", "Escribe el nombre de ambos equipos."); return;
    }
    try {
      await setDoc(REF_EVENTO(), {
        activo: true,
        equipoLocal:     { nombre: nombreL.trim(), bandera: banderaL },
        equipoVisitante: { nombre: nombreV.trim(), bandera: banderaV },
        imagenFondo:     imagen.trim() || null,
        preguntas:       evento?.preguntas || [], // preservar historial
      });
      onMensaje("ok", `✅ Evento configurado: ${banderaL} ${nombreL} vs ${nombreV} ${banderaV}`);
    } catch (e) { onMensaje("error", e.message); }
  };

  const desactivar = async () => {
    try {
      await updateDoc(REF_EVENTO(), { activo: false });
      onMensaje("ok", "Evento desactivado.");
    } catch (e) { onMensaje("error", e.message); }
  };

  // ── Publicar nueva pregunta (push al array) ─────────────────
  const publicarPregunta = async () => {
    const optsValidas = opciones.filter(o => o.trim());
    if (!textoPrg.trim()) { onMensaje("error", "Escribe la pregunta."); return; }
    if (optsValidas.length < 2) { onMensaje("error", "Agrega al menos 2 opciones."); return; }
    if (abierta) { onMensaje("error", "Hay una pregunta abierta. Ciérrala primero."); return; }

    setCreando(true);
    try {
      const numeroSiguiente = preguntas.length + 1;
      const pregNueva = {
        id:                `pev_${Date.now()}`,
        numero:            numeroSiguiente,
        texto:             textoPrg.trim(),
        opciones:          optsValidas,
        estado:            "abierta",
        respuestaCorrecta: null,
        puntosEnVivo:      Number(puntos),
        creadaEn:          new Date().toISOString(),
      };
      await updateDoc(REF_EVENTO(), {
        preguntas: [...preguntas, pregNueva],
      });
      onMensaje("ok", `🔴 Pregunta #${numeroSiguiente} publicada (+${puntos} pts)`);
      setTextoPrg(""); setOpciones(["",""]); setPuntos(3); setRespSel("");
    } catch (e) { onMensaje("error", e.message); }
    finally { setCreando(false); }
  };

  // ── Cerrar pregunta activa y dar puntos ─────────────────────
  const cerrarPregunta = async () => {
    if (!respSel || !abierta) { onMensaje("error", "Selecciona la respuesta correcta."); return; }
    setCerrando(true);
    try {
      const pts = abierta.puntosEnVivo || 3;

      // 1. Actualizar la pregunta dentro del array
      const nuevasPreguntas = preguntas.map(p =>
        p.id === abierta.id
          ? { ...p, estado: "cerrada", respuestaCorrecta: respSel }
          : p
      );
      await updateDoc(REF_EVENTO(), { preguntas: nuevasPreguntas });

      // 2. Leer respuestas SOLO de esta pregunta y dar puntos
      const snapR = await getDocs(query(
        REF_RESPS(), where("preguntaId", "==", abierta.id)
      ));
      const batch = writeBatch(db);
      let acertaron = 0;
      snapR.docs.forEach(d => {
        if (d.data().respuesta === respSel) {
          batch.update(doc(db, "usuarios", d.data().uid), {
            puntosTotal: increment(pts),
          });
          acertaron++;
        }
      });
      await batch.commit();

      onMensaje("ok",
        `✅ Pregunta #${abierta.numero} cerrada. ${acertaron} de ${snapR.size} acertaron → +${pts} pts c/u.`
      );
      setRespSel("");
    } catch (e) { onMensaje("error", e.message); }
    finally { setCerrando(false); }
  };

  if (cargando) return (
    <p style={{ fontSize:"6px", color:"var(--gris-claro)", padding:"16px" }}>⚙ Cargando...</p>
  );

  const estaActivo = evento?.activo === true;
  const cerradas   = preguntas.filter(p => p.estado === "cerrada").reverse();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

      {/* ═══ SECCIÓN 1: CONFIGURAR ══════════════════════════════ */}
      <div style={{ border:"2px solid var(--amarillo)", padding:"12px" }}>
        <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>
          ⚙ CONFIGURAR EVENTO EN VIVO
        </p>

        {estaActivo && (
          <div style={{ padding:"8px", marginBottom:"12px",
            background:"rgba(214,40,40,0.1)", border:"2px solid var(--rojo-chile)" }}>
            <p style={{ fontSize:"6px", color:"var(--rojo-chile)", lineHeight:2 }}>
              🔴 EVENTO ACTIVO: {evento.equipoLocal?.bandera} {evento.equipoLocal?.nombre}{" "}
              vs {evento.equipoVisitante?.nombre} {evento.equipoVisitante?.bandera}
            </p>
            <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginTop:"4px" }}>
              {preguntas.length} pregunta(s) publicadas en total.
            </p>
          </div>
        )}

        <div style={{ display:"flex", gap:"10px", marginBottom:"10px" }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
              EQUIPO LOCAL
            </p>
            <div style={{ display:"flex", gap:"4px", marginBottom:"4px" }}>
              <span style={{ fontSize:"20px", lineHeight:"32px" }}>{banderaL}</span>
              <button onClick={() => setSelBand(selBand==="L" ? null : "L")}
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                  padding:"3px 6px", cursor:"pointer",
                  border:`1px solid ${selBand==="L"?"var(--amarillo)":"var(--gris)"}`,
                  background: selBand==="L"?"rgba(244,208,63,0.15)":"transparent",
                  color:"var(--gris-claro)" }}>
                CAMBIAR
              </button>
            </div>
            <input value={nombreL} onChange={e => setNombreL(e.target.value)}
              placeholder="Marruecos"
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                width:"100%", padding:"5px 7px", border:"2px solid var(--negro)",
                background:"var(--blanco)", color:"var(--negro)", outline:"none" }} />
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
              EQUIPO VISITANTE
            </p>
            <div style={{ display:"flex", gap:"4px", marginBottom:"4px" }}>
              <span style={{ fontSize:"20px", lineHeight:"32px" }}>{banderaV}</span>
              <button onClick={() => setSelBand(selBand==="V" ? null : "V")}
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                  padding:"3px 6px", cursor:"pointer",
                  border:`1px solid ${selBand==="V"?"var(--amarillo)":"var(--gris)"}`,
                  background: selBand==="V"?"rgba(244,208,63,0.15)":"transparent",
                  color:"var(--gris-claro)" }}>
                CAMBIAR
              </button>
            </div>
            <input value={nombreV} onChange={e => setNombreV(e.target.value)}
              placeholder="Países Bajos"
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                width:"100%", padding:"5px 7px", border:"2px solid var(--negro)",
                background:"var(--blanco)", color:"var(--negro)", outline:"none" }} />
          </div>
        </div>

        {selBand && (
          <div style={{ marginBottom:"10px", padding:"8px",
            border:"1px solid var(--amarillo)", background:"rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize:"5px", color:"var(--amarillo)", marginBottom:"6px" }}>
              SELECCIONA BANDERA {selBand==="L" ? "LOCAL" : "VISITANTE"}:
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
              {BANDERAS.map(b => (
                <button key={b} onClick={() => {
                    if (selBand==="L") setBanderaL(b); else setBanderaV(b);
                    setSelBand(null);
                  }}
                  style={{ fontSize:"18px", padding:"3px", cursor:"pointer",
                    border:"1px solid transparent", background:"transparent" }}
                  onMouseEnter={e => e.target.style.background="rgba(255,255,255,0.1)"}
                  onMouseLeave={e => e.target.style.background="transparent"}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
          IMAGEN DE FONDO (archivo en /public/ — ej: A_PAISES_MARRUECOS.jpg)
        </p>
        <input value={imagen} onChange={e => setImagen(e.target.value)}
          placeholder="A_PAISES_MARRUECOS.jpg"
          style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            width:"100%", padding:"5px 7px", border:"2px solid var(--negro)",
            background:"var(--blanco)", color:"var(--negro)",
            outline:"none", marginBottom:"10px" }} />

        <div style={{ display:"flex", gap:"8px" }}>
          <button className="btn-pixel btn-rojo" style={{ flex:2, fontSize:"7px" }}
            onClick={guardarConfig}>
            🔴 {estaActivo ? "ACTUALIZAR EVENTO" : "ACTIVAR EVENTO"}
          </button>
          {estaActivo && (
            <button className="btn-pixel btn-gris" style={{ flex:1, fontSize:"6px" }}
              onClick={desactivar}>
              DESACTIVAR
            </button>
          )}
        </div>
      </div>

      {/* ═══ SECCIÓN 2: PREGUNTAS ══════════════════════════════ */}
      {estaActivo && (
        <div style={{ border:"2px solid var(--rojo-chile)", padding:"12px" }}>
          <p style={{ fontSize:"7px", color:"var(--rojo-chile)", marginBottom:"12px" }}>
            ❓ PREGUNTAS EN VIVO ({preguntas.length} en total)
          </p>

          {/* Pregunta abierta */}
          {abierta && (
            <div style={{ padding:"12px", marginBottom:"12px",
              background:"rgba(214,40,40,0.06)", border:"2px solid var(--rojo-chile)",
              boxShadow:"0 0 16px rgba(214,40,40,0.2)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
                <span style={{ fontSize:"6px", color:"var(--rojo-chile)" }}>
                  🔴 PREGUNTA #{abierta.numero} — ABIERTA
                </span>
                <span style={{ fontSize:"5px", color:"var(--amarillo)",
                  border:"1px solid var(--amarillo)", padding:"2px 6px" }}>
                  +{abierta.puntosEnVivo} PTS
                </span>
              </div>
              <p style={{ fontSize:"8px", color:"var(--blanco)", lineHeight:2, marginBottom:"12px" }}>
                {abierta.texto}
              </p>
              <p style={{ fontSize:"6px", color:"var(--verde-claro)", marginBottom:"6px" }}>
                MARCA LA RESPUESTA CORRECTA:
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"5px", marginBottom:"12px" }}>
                {(abierta.opciones||[]).map((op,i) => (
                  <button key={i} onClick={() => setRespSel(op)}
                    style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                      padding:"8px 10px", cursor:"pointer", textAlign:"left",
                      border:`2px solid ${respSel===op?"var(--verde-claro)":"var(--gris)"}`,
                      background:respSel===op?"rgba(82,183,136,0.15)":"transparent",
                      color:"var(--blanco)" }}>
                    {respSel===op ? "✅ " : ""}{op}
                  </button>
                ))}
              </div>
              <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
                onClick={cerrarPregunta} disabled={!respSel || cerrando}>
                {cerrando ? "⚙ PROCESANDO..." : `🔒 CERRAR Y DAR +${abierta.puntosEnVivo} PTS`}
              </button>
            </div>
          )}

          {/* Form nueva pregunta */}
          {!abierta && (
            <div style={{ padding:"12px", border:"2px solid rgba(255,255,255,0.1)",
              background:"rgba(0,0,0,0.2)", marginBottom:"14px" }}>
              <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>
                + PREGUNTA #{preguntas.length + 1}
              </p>

              <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
                PREGUNTA:
              </p>
              <textarea value={textoPrg} onChange={e => setTextoPrg(e.target.value)}
                rows={2} placeholder="Ej: ¿Habrá gol antes del minuto 60?"
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                  width:"100%", padding:"8px", border:"3px solid var(--negro)",
                  background:"var(--blanco)", color:"var(--negro)",
                  outline:"none", resize:"none", lineHeight:2, marginBottom:"10px" }} />

              <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                OPCIONES:
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"5px", marginBottom:"10px" }}>
                {opciones.map((op,i) => (
                  <div key={i} style={{ display:"flex", gap:"5px" }}>
                    <input value={op}
                      onChange={e => setOpciones(prev =>
                        prev.map((o,idx) => idx===i ? e.target.value : o))}
                      placeholder={`Opción ${i+1}`}
                      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                        flex:1, padding:"5px 8px", border:"2px solid var(--negro)",
                        background:"var(--blanco)", color:"var(--negro)", outline:"none" }} />
                    {opciones.length > 2 && (
                      <button onClick={() => setOpciones(prev => prev.filter((_,idx) => idx!==i))}
                        style={{ background:"var(--rojo-chile)", color:"var(--blanco)",
                          border:"none", cursor:"pointer", padding:"4px 8px",
                          fontFamily:"'Press Start 2P',monospace", fontSize:"8px" }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {opciones.length < 5 && (
                <button className="btn-pixel btn-gris w-full"
                  style={{ fontSize:"5px", marginBottom:"10px" }}
                  onClick={() => setOpciones(prev => [...prev,""])}>
                  + AGREGAR OPCIÓN
                </button>
              )}

              <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                PUNTAJE:
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:"5px",
                marginBottom:"12px", flexWrap:"wrap" }}>
                {[1,2,3,5,7,10].map(n => (
                  <button key={n} onClick={() => setPuntos(n)}
                    style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                      width:"33px", height:"33px", cursor:"pointer",
                      border:`2px solid ${puntos===n?"var(--amarillo)":"var(--gris)"}`,
                      background:puntos===n?"rgba(244,208,63,0.2)":"transparent",
                      color:puntos===n?"var(--amarillo)":"var(--gris-claro)" }}>
                    +{n}
                  </button>
                ))}
                <input type="number" min="1" max="99" value={puntos}
                  onChange={e => setPuntos(Math.max(1,Math.min(99,Number(e.target.value)||1)))}
                  style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                    width:"44px", height:"33px", textAlign:"center",
                    border:"2px solid var(--amarillo)",
                    background:"var(--negro)", color:"var(--amarillo)", outline:"none" }} />
              </div>

              <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
                onClick={publicarPregunta} disabled={creando}>
                {creando ? "⚙ PUBLICANDO..." : `🔴 PUBLICAR PREGUNTA #${preguntas.length+1} (+${puntos} pts)`}
              </button>
            </div>
          )}

          {/* Historial de preguntas cerradas */}
          {cerradas.length > 0 && (
            <div>
              <p style={{ fontSize:"5px", color:"var(--gris-claro)",
                marginBottom:"6px", letterSpacing:"1px" }}>
                HISTORIAL ({cerradas.length})
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                {cerradas.map(pq => (
                  <div key={pq.id} style={{ padding:"8px 10px",
                    border:"1px solid rgba(82,183,136,0.2)",
                    background:"rgba(0,0,0,0.2)", fontSize:"6px", lineHeight:2 }}>
                    <p style={{ color:"var(--amarillo)" }}>PREGUNTA #{pq.numero}</p>
                    <p style={{ color:"var(--blanco)" }}>{pq.texto}</p>
                    <p>✅ <span style={{ color:"var(--verde-claro)" }}>{pq.respuestaCorrecta}</span>
                      <span style={{ color:"var(--amarillo)", marginLeft:"8px" }}>
                        +{pq.puntosEnVivo} pts
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
