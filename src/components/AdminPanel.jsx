// src/components/AdminPanel.jsx  — v4 (Fase 1)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v4:
//   • Tab "CERRAR DÍA" renombrado a "🃏 CARTAS Y BONUS"
//   • calcularGanadorDelDia ahora solo entrega bonus +2 y cartas
//   • Tab "📢 MENSAJES" nuevo: ver/eliminar mensajes de La Voz de la Hinchada
//   • Mensajes de confirmación claros en todas las acciones
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, doc,
  updateDoc, where, setDoc, deleteDoc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  procesarResultadoPartido, calcularGanadorDelDia,
  procesarPreguntaDelDia, publicarAvisoAdmin, cerrarAvisoAdmin,
} from "../utils/helpers";
import { FASES_ELIMINATORIAS, FASE_LABELS, BANCO_PREGUNTAS } from "../data/sampleData";

const ADMIN_EMAILS = ["xtokesu@gmail.com"];

export default function AdminPanel({ onVolver }) {
  const { firebaseUser } = useAuth();
  if (!ADMIN_EMAILS.includes(firebaseUser?.email)) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ color: "var(--rojo-chile)", fontSize: "8px" }}>🔒 ACCESO DENEGADO</p>
        <button className="btn-pixel btn-gris" onClick={onVolver} style={{ marginTop: "16px" }}>
          ← VOLVER
        </button>
      </div>
    );
  }
  return <AdminPanelInterno onVolver={onVolver} />;
}

function AdminPanelInterno({ onVolver }) {
  const [tab, setTab]           = useState("partidos");
  const [partidos, setPartidos] = useState([]);
  const [preguntas, setPreguntas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje]   = useState(null);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const snapP = await getDocs(query(collection(db, "partidos"), orderBy("fecha")));
      setPartidos(snapP.docs.map((d) => ({ id: d.id, ...d.data() })));
      const snapQ = await getDocs(query(collection(db, "preguntas"), orderBy("fecha")));
      setPreguntas(snapQ.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setCargando(false); }
  };

  const msg = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 8000);
  };

  const TABS = [
    { id: "partidos",  label: "⚽ PARTIDOS" },
    { id: "preguntas", label: "❓ PREGUNTAS" },
    { id: "cartas",    label: "🃏 CARTAS Y BONUS" },
    { id: "aviso",     label: "📢 AVISO" },
    { id: "mensajes",  label: "💬 MENSAJES" },
  ];

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <button className="btn-pixel btn-gris" onClick={onVolver}
          style={{ fontSize: "7px", padding: "6px 10px" }}>← VOLVER</button>
        <h2 style={{ color: "var(--rojo-chile)", fontSize: "9px" }}>⚙ PANEL ADMIN</h2>
      </div>

      {mensaje && (
        <div style={{
          padding: "10px 14px", marginBottom: "14px", fontSize: "7px",
          border: `2px solid ${mensaje.tipo === "ok" ? "var(--verde-claro)" : "var(--rojo-chile)"}`,
          color:  mensaje.tipo === "ok" ? "var(--verde-claro)" : "var(--rojo-chile)",
          background: mensaje.tipo === "ok" ? "rgba(82,183,136,0.1)" : "rgba(214,40,40,0.1)",
          lineHeight: 2,
        }}>
          {mensaje.tipo === "ok" ? "✅" : "❌"} {mensaje.texto}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "14px", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.id}
            className={`btn-pixel ${tab === t.id ? "btn-amarillo" : "btn-gris"}`}
            style={{ fontSize: "5px", padding: "5px 8px", flex: "1 0 auto" }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ textAlign: "center", padding: "30px", fontSize: "7px", color: "var(--verde-claro)" }}>
          <span className="spinner">⚙</span><br /><br />CARGANDO...
        </div>
      ) : (
        <>
          {tab === "partidos"  && <TabPartidosAdmin  partidos={partidos}   onActualizar={cargarDatos} onMensaje={msg} />}
          {tab === "preguntas" && <TabPreguntasAdmin preguntas={preguntas} onActualizar={cargarDatos} onMensaje={msg} />}
          {tab === "cartas"    && <TabCartasBonus    onMensaje={msg} />}
          {tab === "aviso"     && <TabAviso          onMensaje={msg} />}
          {tab === "mensajes"  && <TabMensajes        onMensaje={msg} />}
        </>
      )}
    </div>
  );
}

// ── Tab Partidos ──────────────────────────────────────────────
function TabPartidosAdmin({ partidos, onActualizar, onMensaje }) {
  const [sel, setSel]         = useState(null);
  const [procesando, setProc] = useState(false);
  const [gl, setGl]           = useState("");
  const [gv, setGv]           = useState("");
  const [def, setDef]         = useState("normal");
  const [glA, setGlA]         = useState("");
  const [gvA, setGvA]         = useState("");
  const [pL,  setPL]          = useState("");
  const [pV,  setPV]          = useState("");
  const [ganFin, setGanFin]   = useState("");

  const seleccionar = (p) => {
    setSel(p);
    const r = p.resultado;
    if (r) {
      setGl(String(r.golesLocal ?? ""));    setGv(String(r.golesVisitante ?? ""));
      setDef(r.definicion || "normal");
      setGlA(String(r.golesLocalAlargue ?? "")); setGvA(String(r.golesVisitanteAlargue ?? ""));
      setPL(String(r.penalesLocal ?? ""));  setPV(String(r.penalesVisitante ?? ""));
      setGanFin(r.ganadorFinal || "");
    } else {
      setGl(""); setGv(""); setDef("normal");
      setGlA(""); setGvA(""); setPL(""); setPV(""); setGanFin("");
    }
  };

  const esElim = sel && FASES_ELIMINATORIAS.includes(sel.fase);

  const guardar = async () => {
    if (!sel || gl === "" || gv === "") {
      onMensaje("error", "Ingresa los goles de 90 min antes de guardar.");
      return;
    }
    setProc(true);
    try {
      const resultado = {
        golesLocal: Number(gl), golesVisitante: Number(gv),
        definicion: esElim ? def : "normal",
      };
      if (esElim && def !== "normal") {
        resultado.golesLocalAlargue     = Number(glA || 0);
        resultado.golesVisitanteAlargue = Number(gvA || 0);
        if (def === "penales") {
          resultado.penalesLocal     = Number(pL);
          resultado.penalesVisitante = Number(pV);
        }
        resultado.ganadorFinal = ganFin;
      } else if (!esElim) {
        const glN = Number(gl), gvN = Number(gv);
        resultado.ganadorFinal = glN > gvN ? "local" : gvN > glN ? "visitante" : "empate";
      }

      await updateDoc(doc(db, "partidos", sel.id), { resultado });
      const { procesados, errores } = await procesarResultadoPartido(
        sel.id, resultado, sel.fase || "grupos", sel.estaDestacado || false, sel.fecha
      );

      const eraRecalculo = sel.resultado !== null && sel.resultado !== undefined;
      const msg = eraRecalculo
        ? `Resultado ACTUALIZADO. ${procesados} predicciones recalculadas.${errores > 0 ? ` (${errores} errores)` : ""} Los puntos de los usuarios se ajustaron automáticamente.`
        : `Resultado guardado. ${procesados} predicciones procesadas.${errores > 0 ? ` (${errores} errores)` : ""} Puntos sumados a los usuarios.`;

      onMensaje("ok", msg);
      onActualizar();
      setSel(null);
    } catch (e) {
      onMensaje("error", `Error: ${e.message}`);
    } finally {
      setProc(false);
    }
  };

  const inputNum = (val, setVal) => (
    <input
      type="number" min="0" max="20" value={val}
      onChange={(e) => setVal(e.target.value)} placeholder="0"
      style={{
        fontFamily: "'Press Start 2P',monospace", fontSize: "14px",
        width: "50px", height: "50px", textAlign: "center",
        border: "3px solid var(--negro)", background: "var(--blanco)",
        color: "var(--negro)", outline: "none",
      }}
    />
  );

  return (
    <div>
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "10px", lineHeight: 2 }}>
        Selecciona un partido e ingresa el resultado. Los puntos se calculan y suman
        inmediatamente. Si ya había un resultado, se <span style={{ color: "var(--verde-claro)" }}>recalcula</span> automáticamente.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {partidos.map((p) => (
          <React.Fragment key={p.id}>
            <button
              onClick={() => sel?.id === p.id ? setSel(null) : seleccionar(p)}
              style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: "7px",
                padding: "10px 12px",
                border: `2px solid ${sel?.id === p.id ? "var(--amarillo)" : p.resultado ? "var(--verde-campo)" : "var(--gris)"}`,
                background: sel?.id === p.id ? "rgba(244,208,63,0.1)" : "var(--negro)",
                color: "var(--blanco)", cursor: "pointer",
                textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span>
                {p.local?.bandera} vs {p.visitante?.bandera}{" "}
                <span style={{ color: "var(--gris-claro)" }}>({p.fecha})</span>
                {p.fase && p.fase !== "grupos" && (
                  <span style={{ color: "var(--rojo-chile)", marginLeft: "4px" }}>
                    [{FASE_LABELS[p.fase] || p.fase}]
                  </span>
                )}
              </span>
              {p.resultado
                ? <span style={{ color: "var(--verde-claro)" }}>
                    {p.resultado.golesLocal}-{p.resultado.golesVisitante} ✓
                  </span>
                : <span style={{ color: "var(--gris)" }}>Pendiente</span>
              }
            </button>

            {sel?.id === p.id && (
              <div className="caja-pixel" style={{ borderColor: "var(--amarillo)", marginBottom: "6px" }}>
                <p style={{ fontSize: "8px", color: "var(--amarillo)", marginBottom: "12px" }}>
                  {p.local?.bandera} {p.local?.nombre} vs {p.visitante?.nombre} {p.visitante?.bandera}
                </p>
                {p.resultado && (
                  <p style={{ fontSize: "6px", color: "var(--verde-claro)", marginBottom: "10px", lineHeight: 2 }}>
                    ⚠ Ya tiene resultado: {p.resultado.golesLocal}-{p.resultado.golesVisitante}.
                    Guardar de nuevo RECALCULAR todos los puntos.
                  </p>
                )}

                <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>GOLES 90 MIN</p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  {inputNum(gl, setGl)}
                  <span style={{ fontSize: "18px", color: "var(--amarillo)" }}>-</span>
                  {inputNum(gv, setGv)}
                </div>

                {esElim && (
                  <>
                    <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>¿CÓMO SE DEFINIÓ?</p>
                    <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                      {["normal", "alargue", "penales"].map((d) => (
                        <button key={d}
                          className={`pred-btn ${def === d ? "seleccionado" : ""}`}
                          onClick={() => setDef(d)}
                          style={{ flex: 1, fontSize: "6px" }}>
                          {d === "normal" ? "90MIN" : d.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {(def === "alargue" || def === "penales") && (
                      <>
                        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>GOLES EN ALARGUE</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          {inputNum(glA, setGlA)}
                          <span style={{ color: "var(--amarillo)" }}>-</span>
                          {inputNum(gvA, setGvA)}
                        </div>
                      </>
                    )}

                    {def === "penales" && (
                      <>
                        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>TANDA DE PENALES</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          {inputNum(pL, setPL)}
                          <span style={{ color: "var(--amarillo)" }}>-</span>
                          {inputNum(pV, setPV)}
                        </div>
                      </>
                    )}

                    {def !== "normal" && (
                      <>
                        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>¿QUIÉN GANÓ?</p>
                        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                          {["local", "visitante"].map((g) => (
                            <button key={g}
                              className={`pred-btn ${ganFin === g ? "seleccionado" : ""}`}
                              onClick={() => setGanFin(g)}
                              style={{ flex: 1, fontSize: "6px" }}>
                              {g === "local"
                                ? `${p.local?.bandera} ${p.local?.nombre}`
                                : `${p.visitante?.bandera} ${p.visitante?.nombre}`}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                <button className="btn-pixel btn-rojo w-full"
                  style={{ marginTop: "8px", fontSize: "7px" }}
                  onClick={guardar} disabled={procesando}>
                  {procesando ? "⚙ PROCESANDO..." : "⚡ GUARDAR Y CALCULAR PUNTOS"}
                </button>
                <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "8px", lineHeight: 2 }}>
                  ⚠ Guarda el resultado y suma puntos a todos los participantes. Si ya existía un resultado anterior, recalcula la diferencia.
                </p>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Tab Preguntas ─────────────────────────────────────────────
function TabPreguntasAdmin({ preguntas, onActualizar, onMensaje }) {
  const [pregSel, setPregSel]           = useState(null);
  const [respCorrecta, setResp]         = useState("");
  const [procesando, setProc]           = useState(false);
  const [bancoPregSel, setBancoPregSel] = useState(null);
  const [fechaNueva, setFechaNueva]     = useState(new Date().toISOString().split("T")[0]);

  const procesar = async () => {
    if (!pregSel || !respCorrecta) return;
    setProc(true);
    try {
      await updateDoc(doc(db, "preguntas", pregSel.id), { respuestaCorrecta: respCorrecta });
      const res = await procesarPreguntaDelDia(pregSel.id, respCorrecta, pregSel.fecha);
      if (res.ok) {
        const eraRecalculo = !!pregSel.respuestaCorrecta;
        const txt = eraRecalculo
          ? `Respuesta ACTUALIZADA a "${respCorrecta}". Se recalcularon los puntos: ${res.procesados} usuarios correctos ahora.`
          : `Respuesta marcada: "${respCorrecta}". ${res.procesados} usuarios acertaron → +2 pts c/u.`;
        onMensaje("ok", txt);
      } else {
        onMensaje("error", `Error: ${res.error}`);
      }
      onActualizar();
      setPregSel(null);
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setProc(false);
    }
  };

  const crearPreguntaDelBanco = async () => {
    if (!bancoPregSel) return;
    try {
      await setDoc(doc(db, "preguntas", `${fechaNueva}_${bancoPregSel.id}`), {
        ...bancoPregSel, fecha: fechaNueva, respuestaCorrecta: null,
      });
      onMensaje("ok", "Pregunta publicada para el día " + fechaNueva);
      onActualizar();
      setBancoPregSel(null);
    } catch (e) {
      onMensaje("error", e.message);
    }
  };

  return (
    <div>
      {/* Crear desde banco */}
      <div className="caja-pixel mb-16" style={{ borderColor: "var(--azul)" }}>
        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "10px" }}>
          PUBLICAR PREGUNTA DEL DÍA
        </p>
        <input type="date" value={fechaNueva}
          onChange={(e) => setFechaNueva(e.target.value)}
          style={{
            fontFamily: "'Press Start 2P',monospace", fontSize: "8px",
            padding: "6px 10px", border: "3px solid var(--negro)",
            background: "var(--blanco)", color: "var(--negro)", width: "100%",
            marginBottom: "8px", outline: "none",
          }}
        />
        <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
          {BANCO_PREGUNTAS.map((bq) => (
            <button key={bq.id}
              onClick={() => setBancoPregSel(bq)}
              style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: "6px",
                padding: "6px 8px",
                border: `2px solid ${bancoPregSel?.id === bq.id ? "var(--amarillo)" : "var(--gris)"}`,
                background: bancoPregSel?.id === bq.id ? "rgba(244,208,63,0.1)" : "var(--negro)",
                color: "var(--blanco)", cursor: "pointer", textAlign: "left", lineHeight: 1.8,
              }}>
              {bq.texto?.slice(0, 50)}...
            </button>
          ))}
        </div>
        {bancoPregSel && (
          <button className="btn-pixel btn-verde w-full"
            style={{ fontSize: "7px" }} onClick={crearPreguntaDelBanco}>
            ✅ PUBLICAR PARA {fechaNueva}
          </button>
        )}
      </div>

      {/* Marcar respuesta correcta */}
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "8px" }}>
        MARCAR RESPUESTA CORRECTA
      </p>
      <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginBottom: "10px", lineHeight: 2 }}>
        Si ya marcaste una respuesta antes, volver a guardar RECALCULA los puntos de todos los usuarios.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
        {preguntas.map((p) => (
          <React.Fragment key={p.id}>
            <button
              onClick={() => pregSel?.id === p.id ? setPregSel(null) : (setPregSel(p), setResp(p.respuestaCorrecta || ""))}
              style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: "6px",
                padding: "8px 10px",
                border: `2px solid ${pregSel?.id === p.id ? "var(--amarillo)" : p.respuestaCorrecta ? "var(--verde-campo)" : "var(--gris)"}`,
                background: pregSel?.id === p.id ? "rgba(244,208,63,0.1)" : "var(--negro)",
                color: "var(--blanco)", cursor: "pointer", textAlign: "left", lineHeight: 2,
              }}>
              <div>{p.fecha} — {p.texto?.slice(0, 45)}...</div>
              {p.respuestaCorrecta && (
                <span style={{ color: "var(--verde-claro)" }}>✓ {p.respuestaCorrecta}</span>
              )}
            </button>

            {pregSel?.id === p.id && (
              <div className="caja-pixel" style={{ borderColor: "var(--amarillo)", marginBottom: "6px" }}>
                <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "10px", lineHeight: 2 }}>
                  {p.texto}
                </p>
                {p.respuestaCorrecta && (
                  <p style={{ fontSize: "6px", color: "var(--verde-claro)", marginBottom: "8px", lineHeight: 2 }}>
                    ⚠ Respuesta anterior: "{p.respuestaCorrecta}". Cambiarla recalculará los puntos.
                  </p>
                )}
                <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px" }}>RESPUESTA CORRECTA:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                  {(p.opciones || []).map((op, i) => (
                    <button key={i}
                      className={`pred-btn ${respCorrecta === op ? "seleccionado" : ""}`}
                      onClick={() => setResp(op)}
                      style={{ fontSize: "7px", padding: "8px" }}>
                      {op}
                    </button>
                  ))}
                </div>
                <button className="btn-pixel btn-rojo w-full" style={{ fontSize: "7px" }}
                  onClick={procesar} disabled={!respCorrecta || procesando}>
                  {procesando ? "⚙ PROCESANDO..." : "⚡ MARCAR CORRECTA Y DAR PUNTOS"}
                </button>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Tab Cartas y Bonus (antes "Cerrar Día") ───────────────────
function TabCartasBonus({ onMensaje }) {
  const [fecha, setFecha]       = useState(new Date().toISOString().split("T")[0]);
  const [procesando, setProc]   = useState(false);
  const [resultado, setResultado] = useState(null);

  const entregar = async () => {
    setProc(true);
    setResultado(null);
    try {
      const res = await calcularGanadorDelDia(fecha);
      if (res.ok) {
        setResultado(res);
        onMensaje("ok",
          `✅ ¡Cartas y bonus entregados! Ganador(es) del día (${fecha}): ${res.ganador}. ` +
          `+2 pts bonus al 1° lugar. Cartas asignadas al podio.`
        );
      } else {
        onMensaje("error", res.mensaje || res.error || "Error al procesar.");
      }
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setProc(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "14px", lineHeight: 2 }}>
        Entrega el <span style={{ color: "var(--verde-claro)" }}>bonus diario (+2 pts)</span> al
        ganador del día y las cartas coleccionables a los del podio (x4, x3, x2).
      </p>
      <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginBottom: "14px", lineHeight: 2 }}>
        ℹ Los puntos de partidos y la pregunta ya se sumaron al guardar cada resultado.
        Este botón <strong style={{ color: "var(--blanco)" }}>solo entrega el bonus diario y las cartas</strong>,
        no vuelve a calcular nada más.
      </p>

      <div className="caja-pixel" style={{ borderColor: "var(--rojo-chile)" }}>
        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px" }}>FECHA DE LA JORNADA</p>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          style={{
            fontFamily: "'Press Start 2P',monospace", fontSize: "9px",
            padding: "8px 12px", border: "3px solid var(--negro)",
            background: "var(--blanco)", color: "var(--negro)", width: "100%",
            marginBottom: "14px", outline: "none",
          }}
        />
        <button className="btn-pixel btn-rojo w-full" style={{ fontSize: "7px" }}
          onClick={entregar} disabled={procesando}>
          {procesando ? "⚙ PROCESANDO..." : "🃏 ENTREGAR CARTAS Y BONUS"}
        </button>

        {resultado && (
          <div style={{ marginTop: "12px", fontSize: "6px", color: "var(--verde-claro)", lineHeight: 2.2 }}>
            <p>🥇 1°: {resultado.lugar1?.join(", ") || "-"} → carta x4 + bonus +2 pts</p>
            <p>🥈 2°: {resultado.lugar2?.join(", ") || "-"} → carta x3</p>
            <p>🥉 3°: {resultado.lugar3?.join(", ") || "-"} → carta x2</p>
            <p style={{ color: "var(--gris-claro)", marginTop: "4px" }}>
              Total participantes ese día: {resultado.totalJugadores}
            </p>
          </div>
        )}

        <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "10px", lineHeight: 2 }}>
          ⚠ Ejecuta UNA VEZ por jornada, después de ingresar TODOS los resultados del día.
          Si los partidos terminan pasada la medianoche, espera a que terminen antes de ejecutar.
        </p>
      </div>
    </div>
  );
}

// ── Tab Aviso ─────────────────────────────────────────────────
// Ítem i: dos tipos de aviso — "unaVez" y "permanente"
function TabAviso({ onMensaje }) {
  const [texto,    setTexto]   = useState("");
  const [tipo,     setTipo]    = useState("unaVez"); // "unaVez" | "permanente"
  const [enviando, setEnv]     = useState(false);
  const [cerrando, setCerr]    = useState(false);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnv(true);
    try {
      await setDoc(doc(db, "config", "avisoAdmin"), {
        texto:  texto.trim(),
        tipo,
        fecha:  new Date().toISOString(),
        activo: true,
      });
      const desc = tipo === "permanente"
        ? "Aviso PERMANENTE publicado. Aparecerá en cada sesión hasta que lo desactives."
        : "Aviso publicado. Cada usuario lo verá solo una vez.";
      onMensaje("ok", desc);
      setTexto("");
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setEnv(false);
    }
  };

  const desactivar = async () => {
    setCerr(true);
    try {
      await cerrarAvisoAdmin();
      onMensaje("ok", "Aviso desactivado. Ya no se mostrará a los usuarios.");
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setCerr(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "12px", lineHeight: 2 }}>
        Escribe un mensaje para todos los participantes.
      </p>

      <p style={{ fontSize: "6px", color: "var(--verde-claro)", marginBottom: "6px" }}>TIPO DE AVISO:</p>
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {[
          { val: "unaVez",     label: "📌 UNA SOLA VEZ",  desc: "Cada usuario lo ve una vez." },
          { val: "permanente", label: "🔒 PERMANENTE",    desc: "Aparece en cada sesión." },
        ].map((t) => (
          <button key={t.val}
            className={`pred-btn ${tipo === t.val ? "seleccionado" : ""}`}
            style={{ flex: 1, fontSize: "5px", padding: "8px 4px", lineHeight: 2 }}
            onClick={() => setTipo(t.val)}>
            {t.label}
            <br />
            <span style={{ fontSize: "4px", color: tipo === t.val ? "var(--negro)" : "var(--gris-claro)" }}>
              {t.desc}
            </span>
          </button>
        ))}
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe el mensaje aquí..."
        rows={5}
        style={{
          fontFamily: "'Press Start 2P',monospace", fontSize: "7px",
          width: "100%", padding: "10px 12px",
          border: "3px solid var(--negro)", background: "var(--blanco)",
          color: "var(--negro)", outline: "none", resize: "vertical",
          lineHeight: 2, marginBottom: "12px",
        }}
      />
      <button className="btn-pixel btn-rojo w-full" style={{ fontSize: "7px", marginBottom: "8px" }}
        onClick={enviar} disabled={enviando || !texto.trim()}>
        {enviando ? "⚙ ENVIANDO..." : `📢 PUBLICAR (${tipo === "permanente" ? "PERMANENTE" : "UNA VEZ"})`}
      </button>
      <button className="btn-pixel btn-gris w-full" style={{ fontSize: "7px" }}
        onClick={desactivar} disabled={cerrando}>
        {cerrando ? "⚙ ..." : "🔕 DESACTIVAR AVISO ACTUAL"}
      </button>
    </div>
  );
}

// ── Tab Mensajes (La Voz de la Hinchada) ─────────────────────
function TabMensajes({ onMensaje }) {
  const [mensajes, setMensajes]       = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [eliminando, setEliminando]   = useState(null);
  const [limpiando, setLimpiando]     = useState(false);
  const LIMITE_RECOMENDADO            = 500;

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const snap = await getDocs(
        query(collection(db, "mensajesDia"), orderBy("timestamp", "desc"))
      );
      setMensajes(snap.docs.map((d) => ({ docId: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  const eliminarUno = async (docId) => {
    setEliminando(docId);
    try {
      await deleteDoc(doc(db, "mensajesDia", docId));
      setMensajes((prev) => prev.filter((m) => m.docId !== docId));
      onMensaje("ok", "Mensaje eliminado.");
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setEliminando(null);
    }
  };

  const limpiarTodo = async () => {
    if (!window.confirm("¿Eliminar TODOS los mensajes de La Voz de la Hinchada? Esta acción no se puede deshacer.")) return;
    setLimpiando(true);
    try {
      const snap = await getDocs(collection(db, "mensajesDia"));
      const borrar = snap.docs.map((d) => deleteDoc(doc(db, "mensajesDia", d.id)));
      await Promise.all(borrar);
      setMensajes([]);
      onMensaje("ok", `Se eliminaron ${snap.docs.length} mensajes.`);
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setLimpiando(false);
    }
  };

  const total = mensajes.length;
  const supera = total >= LIMITE_RECOMENDADO;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <p style={{ fontSize: "7px", color: "var(--amarillo)" }}>
          📢 LA VOZ DE LA HINCHADA
        </p>
        <span style={{
          fontSize: "6px", padding: "3px 8px",
          border: `2px solid ${supera ? "var(--rojo-chile)" : "var(--verde-campo)"}`,
          color:  supera ? "var(--rojo-chile)" : "var(--gris-claro)",
        }}>
          {total}/{LIMITE_RECOMENDADO}
        </span>
      </div>

      {supera && (
        <p style={{ fontSize: "6px", color: "var(--rojo-chile)", marginBottom: "10px", lineHeight: 2 }}>
          ⚠ Se superó el límite recomendado. Considera limpiar el muro.
        </p>
      )}

      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <button className="btn-pixel btn-gris" style={{ fontSize: "6px", flex: 1 }}
          onClick={cargar}>
          🔄 RECARGAR
        </button>
        <button className="btn-pixel btn-rojo" style={{ fontSize: "6px", flex: 1 }}
          onClick={limpiarTodo} disabled={limpiando || total === 0}>
          {limpiando ? "⚙ ..." : "🗑 LIMPIAR TODO"}
        </button>
      </div>

      {cargando ? (
        <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>Cargando...</p>
      ) : mensajes.length === 0 ? (
        <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>No hay mensajes todavía.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "60vh", overflowY: "auto" }}>
          {mensajes.map((m) => (
            <div key={m.docId} style={{
              padding: "8px 10px", border: "1px solid var(--verde-campo)",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px",
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "6px", color: "var(--amarillo)", marginBottom: "3px" }}>
                  {m.autor} <span style={{ color: "var(--gris-claro)" }}>— {m.fecha} {m.hora}</span>
                </p>
                <p style={{ fontSize: "6px", color: "var(--blanco)", lineHeight: 1.8, wordBreak: "break-word" }}>
                  {m.texto}
                </p>
                {m.url && (
                  <p style={{ fontSize: "5px", color: "var(--azul)", marginTop: "3px", wordBreak: "break-all" }}>
                    🔗 {m.url}
                  </p>
                )}
              </div>
              <button
                className="btn-pixel btn-rojo"
                style={{ fontSize: "5px", padding: "4px 6px", whiteSpace: "nowrap" }}
                onClick={() => eliminarUno(m.docId)}
                disabled={eliminando === m.docId}>
                {eliminando === m.docId ? "..." : "✕"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
