// src/components/AdminSuperDestacado.jsx  — v2
// ─────────────────────────────────────────────────────────────
// Panel COMPLETO de Super Destacado para el administrador:
//
//  SECCIÓN 1 — ACTIVAR/DESACTIVAR
//    • Lista todos los partidos.
//    • Botón 🔴/⚪ para marcar/desmarcar esSuperDestacado.
//    • Una vez marcado aparece en la sección de preguntas en vivo.
//
//  SECCIÓN 2 — PREGUNTAS EN VIVO
//    • Selecciona el partido super destacado activo.
//    • Crea preguntas: texto + opciones (2-5) + puntaje variable.
//    • Solo 1 pregunta abierta a la vez.
//    • Mientras está abierta: los usuarios la ven y responden en tiempo real.
//    • El admin selecciona la respuesta correcta y cierra → puntos automáticos.
//    • Historial de preguntas cerradas con resultado.
//
// Colecciones:
//   preguntasEnVivo/{partidoId}/preguntas/{id}
//     { texto, opciones, estado, respuestaCorrecta, creadaEn, puntosEnVivo }
//   preguntasEnVivo/{partidoId}/respuestasEnVivo/{uid}_{pregId}
//     { uid, preguntaId, respuesta, timestamp }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import {
  collection, getDocs, query, where, orderBy,
  doc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  increment, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminSuperDestacado({ partidos = [], onMensaje }) {
  // ── Sección 1: toggle super destacado ────────────────────
  const [toggling, setToggling] = useState(null);

  const toggleSD = async (p) => {
    setToggling(p.id);
    try {
      const nuevoValor = !p.esSuperDestacado;
      await updateDoc(doc(db, "partidos", p.id), { esSuperDestacado: nuevoValor });
      onMensaje("ok",
        nuevoValor
          ? `🔴 ${p.local?.nombre} vs ${p.visitante?.nombre} es ahora SUPER DESTACADO`
          : `⚪ ${p.local?.nombre} vs ${p.visitante?.nombre} ya no es Super Destacado`
      );
    } catch (e) { onMensaje("error", e.message); }
    finally { setToggling(null); }
  };

  // ── Sección 2: preguntas en vivo ─────────────────────────
  const superDestacados = partidos.filter(p => p.esSuperDestacado);
  const [partidoSel, setPartidoSel] = useState(null);
  const [preguntas,  setPreguntas]  = useState([]);
  const unsubRef = useRef(null);

  // Auto-seleccionar si hay solo uno super destacado
  useEffect(() => {
    if (superDestacados.length === 1 && !partidoSel) {
      seleccionar(superDestacados[0]);
    }
  }, [superDestacados.length]);

  // Limpiar listener al desmontar
  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const seleccionar = (p) => {
    if (unsubRef.current) unsubRef.current();
    setPartidoSel(p);
    setTextoNueva(""); setOpcionesNv(["",""]); setPuntosNv(3);

    const ref = collection(db, "preguntasEnVivo", p.id, "preguntas");
    const q   = query(ref, orderBy("creadaEn", "desc"));
    unsubRef.current = onSnapshot(q, snap => {
      setPreguntas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  // Form nueva pregunta
  const [textoNueva,  setTextoNueva]  = useState("");
  const [opcionesNv,  setOpcionesNv]  = useState(["",""]);
  const [puntosNv,    setPuntosNv]    = useState(3);
  const [creando,     setCreando]     = useState(false);

  // Estado cierre
  const [cerrando,    setCerrando]    = useState(null);
  const [respSels,    setRespSels]    = useState({}); // pregId → opcion elegida

  const abierta = preguntas.find(p => p.estado === "abierta");

  // ── Crear pregunta ────────────────────────────────────────
  const crear = async () => {
    const optsOk = opcionesNv.filter(o => o.trim()).length >= 2;
    if (!textoNueva.trim() || !optsOk) {
      onMensaje("error", "Necesitas texto y al menos 2 opciones.");
      return;
    }
    if (abierta) {
      onMensaje("error", "Hay una pregunta abierta. Ciérrala primero.");
      return;
    }
    if (puntosNv < 1 || puntosNv > 20) {
      onMensaje("error", "El puntaje debe ser entre 1 y 20.");
      return;
    }
    setCreando(true);
    try {
      const pregId = `pev_${Date.now()}`;
      await setDoc(doc(db, "preguntasEnVivo", partidoSel.id, "preguntas", pregId), {
        texto:             textoNueva.trim(),
        opciones:          opcionesNv.filter(o => o.trim()),
        estado:            "abierta",
        respuestaCorrecta: null,
        creadaEn:          serverTimestamp(),
        puntosEnVivo:      Number(puntosNv),
      });
      onMensaje("ok", `¡Pregunta publicada! Los usuarios ya pueden responder (+${puntosNv} pts).`);
      setTextoNueva(""); setOpcionesNv(["",""]); setPuntosNv(3);
    } catch (e) { onMensaje("error", e.message); }
    finally { setCreando(false); }
  };

  // ── Cerrar pregunta y dar puntos ──────────────────────────
  const cerrar = async (pregunta) => {
    const respCorrecta = respSels[pregunta.id];
    if (!respCorrecta) {
      onMensaje("error", "Selecciona la respuesta correcta antes de cerrar.");
      return;
    }
    setCerrando(pregunta.id);
    try {
      const pts = pregunta.puntosEnVivo || 3;

      // 1. Marcar pregunta cerrada
      await updateDoc(
        doc(db, "preguntasEnVivo", partidoSel.id, "preguntas", pregunta.id),
        { estado: "cerrada", respuestaCorrecta: respCorrecta }
      );

      // 2. Leer respuestas y dar puntos en batch
      const snapR = await getDocs(
        collection(db, "preguntasEnVivo", partidoSel.id, "respuestasEnVivo")
      );
      const respuestas = snapR.docs
        .map(d => d.data())
        .filter(r => r.preguntaId === pregunta.id);

      let acertaron = 0;
      const batch = writeBatch(db);
      for (const r of respuestas) {
        if (r.respuesta === respCorrecta) {
          batch.update(doc(db, "usuarios", r.uid), { puntosTotal: increment(pts) });
          acertaron++;
        }
      }
      await batch.commit();

      onMensaje("ok",
        `✅ Pregunta cerrada. ${acertaron} de ${respuestas.length} usuarios acertaron → +${pts} pts c/u.`
      );
    } catch (e) { onMensaje("error", e.message); }
    finally { setCerrando(null); }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      {/* ── SECCIÓN 1: Toggle Super Destacado ──────────────── */}
      <div style={{ marginBottom:"20px" }}>
        <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"4px" }}>
          🔴 ACTIVAR / DESACTIVAR SUPER DESTACADO
        </p>
        <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"10px", lineHeight:2 }}>
          Marca un partido como Super Destacado para habilitar las preguntas en vivo.
          Los usuarios ven las preguntas en tiempo real mientras juega el partido.
        </p>

        {partidos.length === 0 ? (
          <p style={{ fontSize:"6px", color:"var(--gris-claro)", padding:"12px",
            border:"1px solid var(--gris)", textAlign:"center" }}>
            No hay partidos cargados.
          </p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
            {partidos.map(p => (
              <div key={p.id} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"8px 10px",
                border:`2px solid ${p.esSuperDestacado ? "var(--rojo-chile)" : "rgba(255,255,255,0.1)"}`,
                background: p.esSuperDestacado ? "rgba(214,40,40,0.08)" : "transparent",
              }}>
                <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                  color:"var(--blanco)", lineHeight:1.8 }}>
                  {p.esSuperDestacado && <span style={{ color:"var(--rojo-chile)" }}>🔴 </span>}
                  {p.local?.bandera} {p.local?.nombre} vs {p.visitante?.nombre} {p.visitante?.bandera}
                  <span style={{ color:"var(--gris-claro)", marginLeft:"6px" }}>({p.fecha})</span>
                </span>
                <button
                  onClick={() => toggleSD(p)}
                  disabled={toggling === p.id}
                  style={{
                    fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                    padding:"4px 10px", cursor:"pointer", flexShrink:0, marginLeft:"8px",
                    background: p.esSuperDestacado ? "rgba(214,40,40,0.2)" : "transparent",
                    border:`2px solid ${p.esSuperDestacado ? "var(--rojo-chile)" : "var(--gris)"}`,
                    color: p.esSuperDestacado ? "var(--rojo-chile)" : "var(--gris-claro)",
                  }}>
                  {toggling === p.id ? "⚙" : p.esSuperDestacado ? "🔴 ACTIVO" : "⚪ INACTIVO"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECCIÓN 2: Preguntas en vivo ───────────────────── */}
      <div style={{ borderTop:"2px solid var(--rojo-chile)", paddingTop:"16px" }}>
        <p style={{ fontSize:"7px", color:"var(--rojo-chile)", marginBottom:"10px" }}>
          ❓ PREGUNTAS EN VIVO
        </p>

        {superDestacados.length === 0 ? (
          <p style={{ fontSize:"6px", color:"var(--gris-claro)", lineHeight:2,
            padding:"10px", border:"1px dashed var(--gris)", textAlign:"center" }}>
            Activa un partido como Super Destacado arriba para crear preguntas en vivo.
          </p>
        ) : (
          <>
            {/* Selector de partido (si hay más de uno) */}
            {superDestacados.length > 1 && (
              <div style={{ marginBottom:"12px" }}>
                <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"6px" }}>
                  SELECCIONA EL PARTIDO:
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                  {superDestacados.map(p => (
                    <button key={p.id} onClick={() => seleccionar(p)}
                      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                        padding:"6px 8px", cursor:"pointer", textAlign:"left",
                        border:`2px solid ${partidoSel?.id===p.id?"var(--rojo-chile)":"var(--gris)"}`,
                        background:partidoSel?.id===p.id?"rgba(214,40,40,0.1)":"var(--negro)",
                        color:"var(--blanco)" }}>
                      🔴 {p.local?.nombre} vs {p.visitante?.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {partidoSel && (
              <>
                <p style={{ fontSize:"6px", color:"var(--amarillo)", marginBottom:"12px" }}>
                  PARTIDO: 🔴 {partidoSel.local?.nombre} vs {partidoSel.visitante?.nombre}
                </p>

                {/* Pregunta actualmente abierta */}
                {abierta && (
                  <div style={{ marginBottom:"14px", padding:"12px",
                    border:"3px solid var(--rojo-chile)",
                    background:"rgba(214,40,40,0.06)",
                    boxShadow:"0 0 16px rgba(214,40,40,0.2)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", marginBottom:"10px" }}>
                      <span style={{ fontFamily:"'Press Start 2P',monospace",
                        fontSize:"6px", color:"var(--rojo-chile)" }}>
                        🔴 PREGUNTA ACTIVA
                      </span>
                      <span style={{ fontFamily:"'Press Start 2P',monospace",
                        fontSize:"5px", color:"var(--amarillo)",
                        border:"1px solid var(--amarillo)", padding:"2px 6px" }}>
                        +{abierta.puntosEnVivo || 3} PTS · RESPONDIENDO...
                      </span>
                    </div>

                    <p style={{ fontFamily:"'Press Start 2P',monospace",
                      fontSize:"8px", color:"var(--blanco)", lineHeight:2, marginBottom:"12px" }}>
                      {abierta.texto}
                    </p>

                    <p style={{ fontSize:"6px", color:"var(--verde-claro)", marginBottom:"6px" }}>
                      ¿CUÁL ES LA RESPUESTA CORRECTA?
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:"5px", marginBottom:"12px" }}>
                      {(abierta.opciones||[]).map((op, i) => (
                        <button key={i}
                          onClick={() => setRespSels(prev => ({ ...prev, [abierta.id]: op }))}
                          style={{
                            fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                            padding:"8px 10px", cursor:"pointer", textAlign:"left",
                            border:`2px solid ${respSels[abierta.id]===op?"var(--verde-claro)":"var(--gris)"}`,
                            background:respSels[abierta.id]===op?"rgba(82,183,136,0.15)":"transparent",
                            color:"var(--blanco)",
                          }}>
                          {respSels[abierta.id]===op ? "✅ " : ""}{op}
                        </button>
                      ))}
                    </div>

                    <button
                      className="btn-pixel btn-rojo w-full"
                      style={{ fontSize:"7px" }}
                      onClick={() => cerrar(abierta)}
                      disabled={!respSels[abierta.id] || cerrando === abierta.id}>
                      {cerrando === abierta.id
                        ? "⚙ PROCESANDO..."
                        : `🔒 CERRAR Y DAR +${abierta.puntosEnVivo||3} PTS A QUIENES ACERTARON`}
                    </button>
                  </div>
                )}

                {/* Formulario nueva pregunta */}
                {!abierta && (
                  <div style={{ padding:"12px", border:"2px solid var(--gris)",
                    marginBottom:"14px" }}>
                    <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>
                      + NUEVA PREGUNTA EN VIVO
                    </p>

                    {/* Texto */}
                    <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
                      PREGUNTA:
                    </p>
                    <textarea
                      value={textoNueva}
                      onChange={e => setTextoNueva(e.target.value)}
                      rows={2}
                      placeholder="Ej: ¿Habrá gol antes del minuto 60?"
                      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                        width:"100%", padding:"8px", border:"3px solid var(--negro)",
                        background:"var(--blanco)", color:"var(--negro)",
                        outline:"none", resize:"none", lineHeight:2, marginBottom:"10px" }}
                    />

                    {/* Opciones */}
                    <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                      OPCIONES DE RESPUESTA:
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:"5px", marginBottom:"10px" }}>
                      {opcionesNv.map((op, i) => (
                        <div key={i} style={{ display:"flex", gap:"5px" }}>
                          <input
                            value={op}
                            onChange={e => setOpcionesNv(prev =>
                              prev.map((o, idx) => idx===i ? e.target.value : o)
                            )}
                            placeholder={`Opción ${i+1}`}
                            style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                              flex:1, padding:"5px 8px", border:"2px solid var(--negro)",
                              background:"var(--blanco)", color:"var(--negro)", outline:"none" }}
                          />
                          {opcionesNv.length > 2 && (
                            <button
                              onClick={() => setOpcionesNv(prev => prev.filter((_,idx) => idx!==i))}
                              style={{ background:"var(--rojo-chile)", color:"var(--blanco)",
                                border:"none", cursor:"pointer", padding:"4px 8px",
                                fontFamily:"'Press Start 2P',monospace", fontSize:"8px" }}>
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {opcionesNv.length < 5 && (
                      <button
                        className="btn-pixel btn-gris w-full"
                        style={{ fontSize:"5px", marginBottom:"10px" }}
                        onClick={() => setOpcionesNv(prev => [...prev, ""])}>
                        + AGREGAR OPCIÓN
                      </button>
                    )}

                    {/* Puntaje variable */}
                    <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                      PUNTAJE POR ACERTAR:
                    </p>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
                      {[1,2,3,5,7,10].map(n => (
                        <button key={n}
                          onClick={() => setPuntosNv(n)}
                          style={{
                            fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                            width:"36px", height:"36px", cursor:"pointer",
                            border:`2px solid ${puntosNv===n?"var(--amarillo)":"var(--gris)"}`,
                            background: puntosNv===n?"rgba(244,208,63,0.2)":"transparent",
                            color: puntosNv===n?"var(--amarillo)":"var(--gris-claro)",
                          }}>
                          +{n}
                        </button>
                      ))}
                      {/* Input personalizado */}
                      <input
                        type="number" min="1" max="20"
                        value={puntosNv}
                        onChange={e => setPuntosNv(Math.max(1, Math.min(20, Number(e.target.value))))}
                        style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                          width:"50px", height:"36px", textAlign:"center",
                          border:`2px solid ${[1,2,3,5,7,10].includes(puntosNv)?"var(--gris)":"var(--amarillo)"}`,
                          background:"var(--negro)", color:"var(--amarillo)", outline:"none" }}
                      />
                    </div>

                    <button
                      className="btn-pixel btn-rojo w-full"
                      style={{ fontSize:"7px" }}
                      onClick={crear}
                      disabled={creando}>
                      {creando ? "⚙ PUBLICANDO..." : `🔴 PUBLICAR (+${puntosNv} pts)`}
                    </button>
                  </div>
                )}

                {/* Historial de preguntas cerradas */}
                {preguntas.filter(p => p.estado === "cerrada").length > 0 && (
                  <div>
                    <p style={{ fontSize:"5px", color:"var(--gris-claro)",
                      marginBottom:"6px", letterSpacing:"1px" }}>
                      HISTORIAL
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                      {preguntas
                        .filter(p => p.estado === "cerrada")
                        .map(pq => (
                          <div key={pq.id} style={{ padding:"8px 10px",
                            border:"1px solid rgba(82,183,136,0.2)",
                            background:"rgba(0,0,0,0.2)",
                            fontSize:"6px", lineHeight:2 }}>
                            <p style={{ color:"var(--blanco)", marginBottom:"2px" }}>{pq.texto}</p>
                            <p>
                              ✅ <span style={{ color:"var(--verde-claro)" }}>{pq.respuestaCorrecta}</span>
                              <span style={{ color:"var(--amarillo)", marginLeft:"8px" }}>
                                +{pq.puntosEnVivo||3} pts
                              </span>
                            </p>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
