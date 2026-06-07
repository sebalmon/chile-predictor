import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, doc, updateDoc, where
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  procesarResultadoPartido,
  calcularGanadorDelDia,
  procesarPreguntaDelDia,
} from "../utils/helpers";
import { FASES_ELIMINATORIAS, FASE_LABELS } from "../data/sampleData";

// ── IMPORTANTE: Define aquí los emails que son admin ──────────
// Cámbialos por tu(s) email(s) real(es) de Google
const ADMIN_EMAILS = [
  "xtokesu@gmail.com",   // ← reemplaza con tu email real
];

export default function AdminPanel({ onVolver }) {
  const { firebaseUser } = useAuth();

  // Verificar que el usuario sea admin
  const esAdmin = ADMIN_EMAILS.includes(firebaseUser?.email);

  if (!esAdmin) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ color: "var(--rojo-chile)", fontSize: "8px" }}>
          🔒 ACCESO DENEGADO
        </p>
        <button className="btn-pixel btn-gris" onClick={onVolver} style={{ marginTop: "16px" }}>
          ← VOLVER
        </button>
      </div>
    );
  }

  return <AdminPanelInterno onVolver={onVolver} />;
}

function AdminPanelInterno({ onVolver }) {
  const [tab, setTab] = useState("partidos"); // "partidos" | "preguntas" | "dia"
  const [partidos, setPartidos] = useState([]);
  const [preguntas, setPreguntas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null); // { tipo: "ok"|"error", texto }

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const snapP = await getDocs(query(collection(db, "partidos"), orderBy("fecha")));
      setPartidos(snapP.docs.map((d) => ({ id: d.id, ...d.data() })));

      const snapQ = await getDocs(query(collection(db, "preguntas"), orderBy("fecha")));
      setPreguntas(snapQ.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  };

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <button className="btn-pixel btn-gris" onClick={onVolver} style={{ fontSize: "7px", padding: "6px 10px" }}>
          ← VOLVER
        </button>
        <h2 style={{ color: "var(--rojo-chile)", fontSize: "9px" }}>⚙ PANEL ADMIN</h2>
      </div>

      {mensaje && (
        <div style={{
          padding: "10px 14px", marginBottom: "14px", fontSize: "7px",
          border: `2px solid ${mensaje.tipo === "ok" ? "var(--verde-claro)" : "var(--rojo-chile)"}`,
          color: mensaje.tipo === "ok" ? "var(--verde-claro)" : "var(--rojo-chile)",
          background: mensaje.tipo === "ok" ? "rgba(82,183,136,0.1)" : "rgba(214,40,40,0.1)",
        }}>
          {mensaje.tipo === "ok" ? "✅" : "❌"} {mensaje.texto}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        {[
          { id: "partidos", label: "⚽ PARTIDOS" },
          { id: "preguntas", label: "❓ PREGUNTAS" },
          { id: "dia", label: "🏆 CERRAR DÍA" },
        ].map((t) => (
          <button
            key={t.id}
            className={`btn-pixel ${tab === t.id ? "btn-amarillo" : "btn-gris"}`}
            style={{ fontSize: "6px", padding: "6px 10px", flex: 1 }}
            onClick={() => setTab(t.id)}
          >
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
          {tab === "partidos" && (
            <TabPartidos
              partidos={partidos}
              onActualizar={cargarDatos}
              onMensaje={mostrarMensaje}
            />
          )}
          {tab === "preguntas" && (
            <TabPreguntas
              preguntas={preguntas}
              onActualizar={cargarDatos}
              onMensaje={mostrarMensaje}
            />
          )}
          {tab === "dia" && (
            <TabCerrarDia onMensaje={mostrarMensaje} />
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: Resultados de partidos ──────────────────────────────
function TabPartidos({ partidos, onActualizar, onMensaje }) {
  const [partidoSel, setPartidoSel] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Estado del formulario de resultado
  const [golesLocal, setGolesLocal] = useState("");
  const [golesVis, setGolesVis] = useState("");
  const [definicion, setDefinicion] = useState("normal");
  const [golesLocalAlargue, setGolesLocalAlargue] = useState("");
  const [golesVisAlargue, setGolesVisAlargue] = useState("");
  const [penalesLocal, setPenalesLocal] = useState("");
  const [penalesVis, setPenalesVis] = useState("");
  const [ganadorFinal, setGanadorFinal] = useState("");

  const seleccionarPartido = (p) => {
    setPartidoSel(p);
    // Pre-rellenar si ya tiene resultado
    if (p.resultado) {
      const r = p.resultado;
      setGolesLocal(String(r.golesLocal ?? ""));
      setGolesVis(String(r.golesVisitante ?? ""));
      setDefinicion(r.definicion || "normal");
      setGolesLocalAlargue(String(r.golesLocalAlargue ?? ""));
      setGolesVisAlargue(String(r.golesVisitanteAlargue ?? ""));
      setPenalesLocal(String(r.penalesLocal ?? ""));
      setPenalesVis(String(r.penalesVisitante ?? ""));
      setGanadorFinal(r.ganadorFinal || "");
    } else {
      setGolesLocal(""); setGolesVis("");
      setDefinicion("normal");
      setGolesLocalAlargue(""); setGolesVisAlargue("");
      setPenalesLocal(""); setPenalesVis("");
      setGanadorFinal("");
    }
  };

  const esEliminatoria = partidoSel && FASES_ELIMINATORIAS.includes(partidoSel.fase);

  const handleGuardarResultado = async () => {
    if (!partidoSel) return;
    if (golesLocal === "" || golesVis === "") {
      onMensaje("error", "Ingresa los goles de los 90 min.");
      return;
    }

    setProcesando(true);
    try {
      const resultado = {
        golesLocal: Number(golesLocal),
        golesVisitante: Number(golesVis),
        definicion: esEliminatoria ? definicion : "normal",
      };

      if (esEliminatoria && definicion !== "normal") {
        resultado.golesLocalAlargue = Number(golesLocalAlargue || 0);
        resultado.golesVisitanteAlargue = Number(golesVisAlargue || 0);
        if (definicion === "penales") {
          resultado.penalesLocal = Number(penalesLocal);
          resultado.penalesVisitante = Number(penalesVis);
        }
        resultado.ganadorFinal = ganadorFinal;
      } else if (!esEliminatoria) {
        // Para grupos, el ganador se infiere de los goles
        const gl = Number(golesLocal);
        const gv = Number(golesVis);
        resultado.ganadorFinal = gl > gv ? "local" : gv > gl ? "visitante" : "empate";
      }

      // 1. Guardar resultado en el partido
      await updateDoc(doc(db, "partidos", partidoSel.id), { resultado });

      // 2. Procesar predicciones automáticamente
      const { procesados, errores } = await procesarResultadoPartido(
        partidoSel.id,
        resultado,
        partidoSel.fase || "grupos",
        partidoSel.estaDestacado || false,
        partidoSel.fecha
      );

      onMensaje("ok",
        `Resultado guardado. ${procesados} predicciones procesadas.${errores > 0 ? ` ${errores} errores.` : ""}`
      );
      onActualizar();
      setPartidoSel(null);
    } catch (e) {
      console.error(e);
      onMensaje("error", `Error: ${e.message}`);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "10px" }}>
        Selecciona un partido para ingresar el resultado real.
        El sistema calculará los puntos automáticamente.
      </p>

      {/* Lista de partidos */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
        {partidos.map((p) => (
          <button
            key={p.id}
            onClick={() => seleccionarPartido(p)}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "7px",
              padding: "10px 12px",
              border: `2px solid ${partidoSel?.id === p.id
                ? "var(--amarillo)"
                : p.resultado
                  ? "var(--verde-campo)"
                  : "var(--gris)"}`,
              background: partidoSel?.id === p.id ? "rgba(244,208,63,0.1)" : "var(--negro)",
              color: "var(--blanco)",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              {p.local?.bandera} vs {p.visitante?.bandera}{" "}
              <span style={{ color: "var(--gris-claro)" }}>({p.fecha})</span>
            </span>
            {p.resultado ? (
              <span style={{ color: "var(--verde-claro)" }}>
                {p.resultado.golesLocal}-{p.resultado.golesVisitante} ✓
              </span>
            ) : (
              <span style={{ color: "var(--gris)" }}>Pendiente</span>
            )}
          </button>
        ))}
      </div>

      {/* Formulario de resultado */}
      {partidoSel && (
        <div className="caja-pixel" style={{ borderColor: "var(--amarillo)" }}>
          <p style={{ fontSize: "8px", color: "var(--amarillo)", marginBottom: "12px" }}>
            {partidoSel.local?.bandera} {partidoSel.local?.nombre} vs {partidoSel.visitante?.nombre} {partidoSel.visitante?.bandera}
          </p>
          {esEliminatoria && (
            <p style={{ fontSize: "6px", color: "var(--rojo-chile)", marginBottom: "10px" }}>
              💀 {FASE_LABELS[partidoSel.fase]}
            </p>
          )}

          {/* Goles 90 min */}
          <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
            GOLES (90 MIN)
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <input type="number" min="0" max="20"
              value={golesLocal} onChange={(e) => setGolesLocal(e.target.value)}
              placeholder="0"
              style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "14px", width: "50px", height: "50px", textAlign: "center", border: "3px solid var(--negro)", background: "var(--blanco)", color: "var(--negro)", outline: "none" }}
            />
            <span style={{ fontSize: "18px", color: "var(--amarillo)" }}>-</span>
            <input type="number" min="0" max="20"
              value={golesVis} onChange={(e) => setGolesVis(e.target.value)}
              placeholder="0"
              style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "14px", width: "50px", height: "50px", textAlign: "center", border: "3px solid var(--negro)", background: "var(--blanco)", color: "var(--negro)", outline: "none" }}
            />
          </div>

          {/* Definición (solo eliminatorias) */}
          {esEliminatoria && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                ¿CÓMO SE DEFINIÓ?
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                {["normal", "alargue", "penales"].map((d) => (
                  <button
                    key={d}
                    className={`pred-btn ${definicion === d ? "seleccionado" : ""}`}
                    onClick={() => setDefinicion(d)}
                    style={{ flex: 1, fontSize: "6px" }}
                  >
                    {d === "normal" ? "90 MIN" : d === "alargue" ? "ALARGUE" : "PENALES"}
                  </button>
                ))}
              </div>

              {(definicion === "alargue" || definicion === "penales") && (
                <div style={{ marginTop: "10px" }}>
                  <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                    GOLES EN ALARGUE
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <input type="number" min="0" max="10"
                      value={golesLocalAlargue} onChange={(e) => setGolesLocalAlargue(e.target.value)}
                      placeholder="0"
                      style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "14px", width: "50px", height: "50px", textAlign: "center", border: "3px solid var(--negro)", background: "var(--blanco)", color: "var(--negro)", outline: "none" }}
                    />
                    <span style={{ color: "var(--amarillo)" }}>-</span>
                    <input type="number" min="0" max="10"
                      value={golesVisAlargue} onChange={(e) => setGolesVisAlargue(e.target.value)}
                      placeholder="0"
                      style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "14px", width: "50px", height: "50px", textAlign: "center", border: "3px solid var(--negro)", background: "var(--blanco)", color: "var(--negro)", outline: "none" }}
                    />
                  </div>
                </div>
              )}

              {definicion === "penales" && (
                <div style={{ marginTop: "4px" }}>
                  <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                    RESULTADO TANDA DE PENALES
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <input type="number" min="0" max="20"
                      value={penalesLocal} onChange={(e) => setPenalesLocal(e.target.value)}
                      placeholder="0"
                      style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "14px", width: "50px", height: "50px", textAlign: "center", border: "3px solid var(--negro)", background: "var(--blanco)", color: "var(--negro)", outline: "none" }}
                    />
                    <span style={{ color: "var(--amarillo)" }}>-</span>
                    <input type="number" min="0" max="20"
                      value={penalesVis} onChange={(e) => setPenalesVis(e.target.value)}
                      placeholder="0"
                      style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "14px", width: "50px", height: "50px", textAlign: "center", border: "3px solid var(--negro)", background: "var(--blanco)", color: "var(--negro)", outline: "none" }}
                    />
                  </div>
                </div>
              )}

              {definicion !== "normal" && (
                <div style={{ marginTop: "4px" }}>
                  <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                    ¿QUIÉN GANÓ FINALMENTE?
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className={`pred-btn ${ganadorFinal === "local" ? "seleccionado" : ""}`}
                      onClick={() => setGanadorFinal("local")}
                      style={{ flex: 1, fontSize: "7px" }}
                    >
                      {partidoSel.local?.bandera} {partidoSel.local?.nombre}
                    </button>
                    <button
                      className={`pred-btn ${ganadorFinal === "visitante" ? "seleccionado" : ""}`}
                      onClick={() => setGanadorFinal("visitante")}
                      style={{ flex: 1, fontSize: "7px" }}
                    >
                      {partidoSel.visitante?.bandera} {partidoSel.visitante?.nombre}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            className="btn-pixel btn-rojo w-full"
            style={{ marginTop: "12px", fontSize: "7px" }}
            onClick={handleGuardarResultado}
            disabled={procesando}
          >
            {procesando ? "⚙ PROCESANDO..." : "⚡ GUARDAR Y CALCULAR PUNTOS"}
          </button>
          <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "8px", lineHeight: 2 }}>
            ⚠ Esto guardará el resultado Y calculará automáticamente los puntos
            de TODOS los participantes que hayan predicho este partido.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Preguntas del día ────────────────────────────────────
function TabPreguntas({ preguntas, onActualizar, onMensaje }) {
  const [pregSel, setPregSel] = useState(null);
  const [respCorrecta, setRespCorrecta] = useState("");
  const [procesando, setProcesando] = useState(false);

  const handleProcesar = async () => {
    if (!pregSel || !respCorrecta) return;
    setProcesando(true);
    try {
      // 1. Guardar respuesta correcta en Firestore
      await updateDoc(doc(db, "preguntas", pregSel.id), {
        respuestaCorrecta: respCorrecta,
      });

      // 2. Procesar y dar puntos
      const resultado = await procesarPreguntaDelDia(
        pregSel.id, respCorrecta, pregSel.fecha
      );

      if (resultado.ok) {
        onMensaje("ok", `Pregunta procesada. ${resultado.procesados} usuarios acertaron (+2 pts c/u).`);
      } else {
        onMensaje("error", `Error: ${resultado.error}`);
      }
      onActualizar();
      setPregSel(null);
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "10px" }}>
        Selecciona una pregunta, elige la respuesta correcta y el sistema
        dará +2 pts automáticamente a quienes acertaron.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
        {preguntas.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPregSel(p); setRespCorrecta(p.respuestaCorrecta || ""); }}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "6px",
              padding: "10px 12px",
              border: `2px solid ${pregSel?.id === p.id ? "var(--amarillo)" : p.respuestaCorrecta ? "var(--verde-campo)" : "var(--gris)"}`,
              background: pregSel?.id === p.id ? "rgba(244,208,63,0.1)" : "var(--negro)",
              color: "var(--blanco)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "4px" }}>{p.fecha} — {p.texto?.slice(0, 40)}...</div>
            {p.respuestaCorrecta && (
              <span style={{ color: "var(--verde-claro)" }}>✓ Procesada: {p.respuestaCorrecta}</span>
            )}
          </button>
        ))}
      </div>

      {pregSel && (
        <div className="caja-pixel" style={{ borderColor: "var(--amarillo)" }}>
          <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "10px", lineHeight: 2 }}>
            {pregSel.texto}
          </p>
          <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px" }}>
            RESPUESTA CORRECTA:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
            {(pregSel.opciones || []).map((op, i) => (
              <button
                key={i}
                className={`pred-btn ${respCorrecta === op ? "seleccionado" : ""}`}
                onClick={() => setRespCorrecta(op)}
                style={{ fontSize: "7px", padding: "8px" }}
              >
                {op}
              </button>
            ))}
          </div>
          <button
            className="btn-pixel btn-rojo w-full"
            style={{ fontSize: "7px" }}
            onClick={handleProcesar}
            disabled={!respCorrecta || procesando}
          >
            {procesando ? "⚙ PROCESANDO..." : "⚡ MARCAR CORRECTA Y DAR PUNTOS"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab: Cerrar día (ganador del día) ─────────────────────────
function TabCerrarDia({ onMensaje }) {
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [procesando, setProcesando] = useState(false);

  const handleCerrarDia = async () => {
    setProcesando(true);
    try {
      const resultado = await calcularGanadorDelDia(fecha);
      if (resultado.ok) {
        onMensaje("ok",
          `Día cerrado. Ganador: ${resultado.ganador} (+3 pts). Total jugadores: ${resultado.totalJugadores}`
        );
      } else {
        onMensaje("error", resultado.mensaje || resultado.error);
      }
    } catch (e) {
      onMensaje("error", e.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "14px", lineHeight: 2 }}>
        Al cerrar el día se determina el ganador (jugador con más puntos
        acumulados en puntosDelDia), se le otorgan <span style={{ color: "var(--verde-claro)" }}>+3 puntos bonus</span>,
        y el podio queda listo para mostrarse al día siguiente.
      </p>

      <div className="caja-pixel" style={{ borderColor: "var(--rojo-chile)" }}>
        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px" }}>
          FECHA DEL DÍA A CERRAR
        </p>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "9px",
            padding: "8px 12px",
            border: "3px solid var(--negro)",
            background: "var(--blanco)",
            color: "var(--negro)",
            width: "100%",
            marginBottom: "14px",
            outline: "none",
          }}
        />
        <button
          className="btn-pixel btn-rojo w-full"
          style={{ fontSize: "7px" }}
          onClick={handleCerrarDia}
          disabled={procesando}
        >
          {procesando ? "⚙ PROCESANDO..." : "🏆 CALCULAR GANADOR DEL DÍA"}
        </button>
        <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "10px", lineHeight: 2 }}>
          ⚠ Ejecuta esto UNA SOLA VEZ al final del día, después de haber
          procesado todos los partidos y la pregunta del día.
          No se puede deshacer.
        </p>
      </div>
    </div>
  );
}
