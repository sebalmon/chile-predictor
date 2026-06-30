// src/components/AdminSuperDestacado.jsx  — v3
// ─────────────────────────────────────────────────────────────
// FIX v3:
//   • Carga los partidos ÉL MISMO (no depende de la prop).
//     Así puede refrescarlos inmediatamente tras el toggle.
//   • Toggle activa/desactiva esSuperDestacado y recarga.
//   • Sección 2 aparece automáticamente al activar.
//   • Puntaje variable por pregunta.
//   • La imagen de fondo para el usuario se configura con el
//     campo `imagenFondo` del partido en Firestore.
//     Ejemplo: imagenFondo = "A_PAISES_MARRUECOS.jpg"
//     La imagen debe estar en /public/A_PAISES_MARRUECOS.jpg
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, getDocs, query, orderBy,
  doc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  increment, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminSuperDestacado({ onMensaje }) {
  // ── Partidos: carga propia (no prop) ─────────────────────
  const [partidos,  setPartidos]  = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [toggling,  setToggling]  = useState(null);

  const cargarPartidos = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "partidos"), orderBy("fecha"))
      );
      setPartidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error cargando partidos:", e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarPartidos(); }, [cargarPartidos]);

  // ── Toggle Super Destacado ────────────────────────────────
  const toggleSD = async (p) => {
    setToggling(p.id);
    try {
      const nuevo = !p.esSuperDestacado;
      await updateDoc(doc(db, "partidos", p.id), { esSuperDestacado: nuevo });
      // Refrescar lista localmente para respuesta inmediata
      setPartidos(prev =>
        prev.map(x => x.id === p.id ? { ...x, esSuperDestacado: nuevo } : x)
      );
      onMensaje("ok",
        nuevo
          ? `🔴 ${p.local?.nombre} vs ${p.visitante?.nombre} → SUPER DESTACADO ACTIVADO`
          : `⚪ ${p.local?.nombre} vs ${p.visitante?.nombre} → desactivado`
      );
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setToggling(null);
    }
  };

  // ── Sección 2: preguntas en vivo ─────────────────────────
  const superDestacados = partidos.filter(p => p.esSuperDestacado);
  const [partidoSel,  setPartidoSel]  = useState(null);
  const [preguntas,   setPreguntas]   = useState([]);
  const unsubRef = useRef(null);

  // Auto-seleccionar cuando hay solo uno
  useEffect(() => {
    if (superDestacados.length === 1) {
      seleccionar(superDestacados[0]);
    } else if (superDestacados.length === 0) {
      setPartidoSel(null);
      setPreguntas([]);
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    }
  }, [JSON.stringify(superDestacados.map(p => p.id))]);

  useEffect(() => () => {
    if (unsubRef.current) unsubRef.current();
  }, []);

  const seleccionar = (p) => {
    if (unsubRef.current) unsubRef.current();
    setPartidoSel(p);
    setTextoNueva(""); setOpcionesNv(["",""]); setPuntosNv(3); setRespSels({});

    const ref = collection(db, "preguntasEnVivo", p.id, "preguntas");
    const q   = query(ref, orderBy("creadaEn", "desc"));
    unsubRef.current = onSnapshot(q,
      snap => setPreguntas(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.error("onSnapshot error:", err)
    );
  };

  // ── Form nueva pregunta ───────────────────────────────────
  const [textoNueva, setTextoNueva] = useState("");
  const [opcionesNv, setOpcionesNv] = useState(["",""]);
  const [puntosNv,   setPuntosNv]   = useState(3);
  const [creando,    setCreando]    = useState(false);
  const [cerrando,   setCerrando]   = useState(null);
  const [respSels,   setRespSels]   = useState({});

  const abierta = preguntas.find(p => p.estado === "abierta");

  const crear = async () => {
    if (!textoNueva.trim() || opcionesNv.filter(o => o.trim()).length < 2) {
      onMensaje("error", "Escribe la pregunta y al menos 2 opciones."); return;
    }
    if (abierta) {
      onMensaje("error", "Cierra la pregunta activa antes de crear una nueva."); return;
    }
    setCreando(true);
    try {
      const pregId = `pev_${Date.now()}`;
      await setDoc(
        doc(db, "preguntasEnVivo", partidoSel.id, "preguntas", pregId),
        {
          texto:             textoNueva.trim(),
          opciones:          opcionesNv.filter(o => o.trim()),
          estado:            "abierta",
          respuestaCorrecta: null,
          creadaEn:          serverTimestamp(),
          puntosEnVivo:      Number(puntosNv),
          // Guardar también la imagen de fondo si el partido la tiene
          imagenFondo:       partidoSel.imagenFondo || null,
        }
      );
      onMensaje("ok", `🔴 Pregunta publicada. Los usuarios la ven ahora. (+${puntosNv} pts)`);
      setTextoNueva(""); setOpcionesNv(["",""]); setPuntosNv(3);
    } catch (e) { onMensaje("error", e.message); }
    finally { setCreando(false); }
  };

  const cerrar = async (pregunta) => {
    const respCorrecta = respSels[pregunta.id];
    if (!respCorrecta) {
      onMensaje("error", "Selecciona la respuesta correcta."); return;
    }
    setCerrando(pregunta.id);
    try {
      const pts = pregunta.puntosEnVivo || 3;
      await updateDoc(
        doc(db, "preguntasEnVivo", partidoSel.id, "preguntas", pregunta.id),
        { estado: "cerrada", respuestaCorrecta: respCorrecta }
      );
      const snapR = await getDocs(
        collection(db, "preguntasEnVivo", partidoSel.id, "respuestasEnVivo")
      );
      const batch = writeBatch(db);
      let acertaron = 0;
      snapR.docs
        .map(d => d.data())
        .filter(r => r.preguntaId === pregunta.id && r.respuesta === respCorrecta)
        .forEach(r => {
          batch.update(doc(db, "usuarios", r.uid), { puntosTotal: increment(pts) });
          acertaron++;
        });
      await batch.commit();
      onMensaje("ok", `✅ Cerrada. ${acertaron} usuarios acertaron → +${pts} pts c/u.`);
    } catch (e) { onMensaje("error", e.message); }
    finally { setCerrando(null); }
  };

  // ── Configuración de imagen de fondo ─────────────────────
  const [editandoImagen, setEditandoImagen] = useState(null);
  const [imagenInput,    setImagenInput]    = useState("");

  const guardarImagen = async (p) => {
    try {
      await updateDoc(doc(db, "partidos", p.id), { imagenFondo: imagenInput.trim() });
      setPartidos(prev =>
        prev.map(x => x.id === p.id ? { ...x, imagenFondo: imagenInput.trim() } : x)
      );
      onMensaje("ok", `Imagen "${imagenInput.trim()}" guardada para este partido.`);
      setEditandoImagen(null);
      setImagenInput("");
    } catch (e) { onMensaje("error", e.message); }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      {/* ═══ SECCIÓN 1: ACTIVAR / DESACTIVAR ══════════════════ */}
      <div style={{ marginBottom:"20px" }}>
        <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"4px" }}>
          🔴 ACTIVAR / DESACTIVAR SUPER DESTACADO
        </p>
        <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:2, marginBottom:"10px" }}>
          Al activar, los usuarios ven las preguntas en vivo mientras juega el partido.
          Puedes también configurar la imagen de fondo que se muestra en su pantalla.
        </p>

        {cargando ? (
          <p style={{ fontSize:"6px", color:"var(--gris-claro)", textAlign:"center", padding:"12px" }}>
            ⚙ Cargando partidos...
          </p>
        ) : partidos.length === 0 ? (
          <p style={{ fontSize:"6px", color:"var(--gris-claro)", padding:"12px",
            border:"1px solid var(--gris)", textAlign:"center" }}>
            No hay partidos en Firestore.
          </p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {partidos.map(p => (
              <div key={p.id}>
                <div style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"8px 10px",
                  border:`2px solid ${p.esSuperDestacado ? "var(--rojo-chile)" : "rgba(255,255,255,0.1)"}`,
                  background: p.esSuperDestacado ? "rgba(214,40,40,0.08)" : "transparent",
                }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                      color:"var(--blanco)", lineHeight:1.8 }}>
                      {p.esSuperDestacado && <span style={{ color:"var(--rojo-chile)" }}>🔴 </span>}
                      {p.local?.bandera} {p.local?.nombre} vs {p.visitante?.nombre} {p.visitante?.bandera}
                    </p>
                    <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                      color:"var(--gris-claro)", marginTop:"2px" }}>
                      {p.fecha}
                      {p.imagenFondo && (
                        <span style={{ color:"var(--verde-claro)", marginLeft:"6px" }}>
                          📷 {p.imagenFondo}
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
                    {/* Botón imagen de fondo */}
                    <button
                      onClick={() => {
                        setEditandoImagen(editandoImagen===p.id ? null : p.id);
                        setImagenInput(p.imagenFondo || "");
                      }}
                      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                        padding:"4px 6px", cursor:"pointer",
                        border:"1px solid var(--gris)", background:"transparent",
                        color:"var(--gris-claro)" }}>
                      📷
                    </button>
                    {/* Botón toggle */}
                    <button
                      onClick={() => toggleSD(p)}
                      disabled={toggling === p.id}
                      style={{
                        fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                        padding:"4px 10px", cursor:"pointer",
                        background: p.esSuperDestacado ? "rgba(214,40,40,0.2)" : "transparent",
                        border:`2px solid ${p.esSuperDestacado ? "var(--rojo-chile)" : "var(--gris)"}`,
                        color: p.esSuperDestacado ? "var(--rojo-chile)" : "var(--gris-claro)",
                      }}>
                      {toggling===p.id ? "⚙" : p.esSuperDestacado ? "🔴 ACTIVO" : "⚪ INACTIVO"}
                    </button>
                  </div>
                </div>

                {/* Campo imagen de fondo */}
                {editandoImagen === p.id && (
                  <div style={{ padding:"8px 10px", background:"rgba(0,0,0,0.3)",
                    border:"1px solid var(--gris)", borderTop:"none" }}>
                    <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:2, marginBottom:"6px" }}>
                      Nombre del archivo en /public/ (ej: A_PAISES_MARRUECOS.jpg)
                    </p>
                    <div style={{ display:"flex", gap:"6px" }}>
                      <input
                        value={imagenInput}
                        onChange={e => setImagenInput(e.target.value)}
                        placeholder="A_PAISES_MARRUECOS.jpg"
                        style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                          flex:1, padding:"5px 8px", border:"2px solid var(--negro)",
                          background:"var(--blanco)", color:"var(--negro)", outline:"none" }}
                      />
                      <button
                        onClick={() => guardarImagen(p)}
                        className="btn-pixel btn-verde"
                        style={{ fontSize:"6px" }}>
                        💾
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SECCIÓN 2: PREGUNTAS EN VIVO ══════════════════════ */}
      <div style={{ borderTop:"2px solid var(--rojo-chile)", paddingTop:"16px" }}>
        <p style={{ fontSize:"7px", color:"var(--rojo-chile)", marginBottom:"10px" }}>
          ❓ PREGUNTAS EN VIVO
        </p>

        {superDestacados.length === 0 ? (
          <div style={{ padding:"14px", border:"1px dashed var(--gris)",
            textAlign:"center", background:"rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize:"6px", color:"var(--gris-claro)", lineHeight:2 }}>
              Activa un partido arriba (⚪ → 🔴) para crear preguntas en vivo.
            </p>
          </div>
        ) : (
          <>
            {/* Selector si hay más de 1 */}
            {superDestacados.length > 1 && (
              <div style={{ marginBottom:"12px" }}>
                <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"6px" }}>
                  PARTIDO:
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
                  🔴 {partidoSel.local?.nombre} vs {partidoSel.visitante?.nombre}
                </p>

                {/* ── Pregunta activa ──────────────────────── */}
                {abierta && (
                  <div style={{ marginBottom:"14px", padding:"12px",
                    border:"3px solid var(--rojo-chile)",
                    background:"rgba(214,40,40,0.06)",
                    boxShadow:"0 0 16px rgba(214,40,40,0.25)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", marginBottom:"10px" }}>
                      <span style={{ fontFamily:"'Press Start 2P',monospace",
                        fontSize:"6px", color:"var(--rojo-chile)" }}>
                        🔴 ABIERTA — USUARIOS RESPONDIENDO
                      </span>
                      <span style={{ fontFamily:"'Press Start 2P',monospace",
                        fontSize:"5px", color:"var(--amarillo)",
                        border:"1px solid var(--amarillo)", padding:"2px 6px" }}>
                        +{abierta.puntosEnVivo||3} PTS
                      </span>
                    </div>

                    <p style={{ fontFamily:"'Press Start 2P',monospace",
                      fontSize:"8px", color:"var(--blanco)", lineHeight:2,
                      marginBottom:"12px" }}>
                      {abierta.texto}
                    </p>

                    <p style={{ fontSize:"6px", color:"var(--verde-claro)", marginBottom:"6px" }}>
                      MARCA LA RESPUESTA CORRECTA:
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:"5px",
                      marginBottom:"12px" }}>
                      {(abierta.opciones||[]).map((op, i) => (
                        <button key={i}
                          onClick={() => setRespSels(prev => ({ ...prev, [abierta.id]: op }))}
                          style={{
                            fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                            padding:"8px 10px", cursor:"pointer", textAlign:"left",
                            border:`2px solid ${respSels[abierta.id]===op?"var(--verde-claro)":"var(--gris)"}`,
                            background:respSels[abierta.id]===op
                              ?"rgba(82,183,136,0.15)":"transparent",
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
                      disabled={!respSels[abierta.id] || cerrando===abierta.id}>
                      {cerrando===abierta.id
                        ? "⚙ PROCESANDO..."
                        : `🔒 CERRAR Y DAR +${abierta.puntosEnVivo||3} PTS`}
                    </button>
                  </div>
                )}

                {/* ── Nueva pregunta ───────────────────────── */}
                {!abierta && (
                  <div style={{ padding:"12px", border:"2px solid rgba(255,255,255,0.15)",
                    marginBottom:"14px", background:"rgba(0,0,0,0.2)" }}>
                    <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>
                      + NUEVA PREGUNTA
                    </p>

                    <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
                      PREGUNTA:
                    </p>
                    <textarea
                      value={textoNueva}
                      onChange={e => setTextoNueva(e.target.value)}
                      rows={2}
                      placeholder="Ej: ¿Habrá gol antes del min 60?"
                      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                        width:"100%", padding:"8px", border:"3px solid var(--negro)",
                        background:"var(--blanco)", color:"var(--negro)",
                        outline:"none", resize:"none", lineHeight:2, marginBottom:"10px" }}
                    />

                    <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                      OPCIONES:
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:"5px",
                      marginBottom:"10px" }}>
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
                              background:"var(--blanco)", color:"var(--negro)",
                              outline:"none" }}
                          />
                          {opcionesNv.length > 2 && (
                            <button
                              onClick={() => setOpcionesNv(
                                prev => prev.filter((_,idx) => idx!==i)
                              )}
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

                    <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                      PUNTAJE:
                    </p>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px",
                      marginBottom:"12px", flexWrap:"wrap" }}>
                      {[1,2,3,5,7,10].map(n => (
                        <button key={n} onClick={() => setPuntosNv(n)}
                          style={{
                            fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                            width:"34px", height:"34px", cursor:"pointer",
                            border:`2px solid ${puntosNv===n?"var(--amarillo)":"var(--gris)"}`,
                            background:puntosNv===n?"rgba(244,208,63,0.2)":"transparent",
                            color:puntosNv===n?"var(--amarillo)":"var(--gris-claro)",
                          }}>
                          +{n}
                        </button>
                      ))}
                      <input
                        type="number" min="1" max="99"
                        value={puntosNv}
                        onChange={e => setPuntosNv(Math.max(1,
                          Math.min(99, Number(e.target.value) || 1)))}
                        style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                          width:"46px", height:"34px", textAlign:"center",
                          border:`2px solid var(--amarillo)`,
                          background:"var(--negro)", color:"var(--amarillo)",
                          outline:"none" }}
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

                {/* ── Historial ────────────────────────────── */}
                {preguntas.filter(p => p.estado==="cerrada").length > 0 && (
                  <div>
                    <p style={{ fontSize:"5px", color:"var(--gris-claro)",
                      marginBottom:"6px", letterSpacing:"1px" }}>
                      HISTORIAL
                    </p>
                    {preguntas
                      .filter(p => p.estado==="cerrada")
                      .map(pq => (
                        <div key={pq.id} style={{ padding:"8px 10px",
                          border:"1px solid rgba(82,183,136,0.2)",
                          background:"rgba(0,0,0,0.2)", marginBottom:"4px",
                          fontSize:"6px", lineHeight:2 }}>
                          <p style={{ color:"var(--blanco)" }}>{pq.texto}</p>
                          <p>
                            ✅ <span style={{ color:"var(--verde-claro)" }}>
                              {pq.respuestaCorrecta}
                            </span>
                            <span style={{ color:"var(--amarillo)", marginLeft:"8px" }}>
                              +{pq.puntosEnVivo||3} pts
                            </span>
                          </p>
                        </div>
                      ))
                    }
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
