import ModalPrediccionesAmigos from "./ModalPrediccionesAmigos";
import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { partidoAbierto, formatHora } from "../utils/helpers";
import { CARTAS, FASES_ELIMINATORIAS, FASE_LABELS } from "../data/sampleData";

// ── Mini-modal selector de cartas ────────────────────────────
function SelectorCartas({ cartasDesbloqueadas, cartaSeleccionada, onSeleccionar, onCerrar }) {
  const cartasDisponibles = CARTAS.filter((c) =>
    cartasDesbloqueadas.includes(c.id)
  );

  const RAREZA_COLOR = {
    comun: "var(--verde-claro)",
    rara: "var(--amarillo)",
    legendaria: "var(--rojo-chile)",
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.85)",
      zIndex: 500,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "var(--negro)",
        border: "4px solid var(--amarillo)",
        boxShadow: "6px 6px 0 var(--amarillo-oscuro)",
        padding: "20px",
        maxWidth: "360px",
        width: "100%",
        maxHeight: "80vh",
        overflowY: "auto",
      }}>
        <p style={{ fontSize: "8px", color: "var(--amarillo)", marginBottom: "14px" }}>
          🃏 ELIGE UNA CARTA PARA ESTE PARTIDO
        </p>
        <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginBottom: "14px", lineHeight: 2 }}>
          Si aciertas, cual sea el puntaje obtenido del partido donde pusiste la carta, se multiplica según la rareza de la carta. 
          Si fallas, la carta se consume igual.
        </p>

        {cartasDisponibles.length === 0 ? (
          <p style={{ fontSize: "7px", color: "var(--gris-claro)", textAlign: "center", padding: "20px" }}>
            No tienes cartas desbloqueadas todavía. ¡Sube al podio del día!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            {/* Opción: sin carta */}
            <button
              onClick={() => onSeleccionar(null)}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "7px",
                padding: "8px 12px",
                border: `2px solid ${cartaSeleccionada === null ? "var(--verde-claro)" : "var(--gris)"}`,
                background: cartaSeleccionada === null ? "rgba(82,183,136,0.2)" : "transparent",
                color: "var(--blanco)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              ✖ Sin carta (no arriesgar)
            </button>

            {cartasDisponibles.map((carta) => (
              <button
                key={carta.id}
                onClick={() => onSeleccionar(carta.id)}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "7px",
                  padding: "10px 12px",
                  border: `2px solid ${cartaSeleccionada === carta.id
                    ? RAREZA_COLOR[carta.rareza]
                    : "var(--gris)"}`,
                  background: cartaSeleccionada === carta.id
                    ? `rgba(${carta.rareza === "legendaria" ? "214,40,40" : carta.rareza === "rara" ? "244,208,63" : "82,183,136"},0.15)`
                    : "transparent",
                  color: "var(--blanco)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "20px" }}>{carta.emoji}</span>
                <div>
                  <div style={{ color: RAREZA_COLOR[carta.rareza] }}>{carta.nombre}</div>
                  <div style={{ color: "var(--gris-claro)", marginTop: "4px" }}>
                    x{carta.multiplicador} — {carta.descripcion}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          className="btn-pixel btn-gris w-full"
          onClick={onCerrar}
          style={{ fontSize: "7px" }}
        >
          CERRAR
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function PartidoCard({ partido }) {
  const { firebaseUser, userProfile } = useAuth();
  const {
    id, fecha, horaInicio, local, visitante,
    fase = "grupos", estaDestacado, resultado,
  } = partido;

  const abierto = partidoAbierto(partido);
  const esEliminatoria = FASES_ELIMINATORIAS.includes(fase);
  const tieneResultado = resultado !== null && resultado !== undefined;

  // ── Estado predicción grupos ──────────────────────────────
  const [ganadorSel, setGanadorSel] = useState(null);   // "local"|"empate"|"visitante"
  const [difSel, setDifSel] = useState(null);            // "1"|"2+"
  const [golesLocalPred, setGolesLocalPred] = useState("");
  const [golesVisPred, setGolesVisPred] = useState("");

  // ── Estado predicción eliminatoria ───────────────────────
  const [definicionSel, setDefinicionSel] = useState(null); // "normal"|"alargue"|"penales"
  const [ganador90Sel, setGanador90Sel] = useState(null);   // "local"|"visitante"
  const [dif90Sel, setDif90Sel] = useState(null);           // "1"|"2+"
  const [ganadorAlargueSel, setGanadorAlargueSel] = useState(null);
  const [difAlargueSel, setDifAlargueSel] = useState(null);
  const [penalesLocalSel, setPenalesLocalSel] = useState("");
  const [penalesVisSel, setPenalesVisSel] = useState("");

  // ── Cartas ───────────────────────────────────────────────
  const [cartaSeleccionada, setCartaSeleccionada] = useState(null); // cartaId o null
  const [mostrarSelectorCartas, setMostrarSelectorCartas] = useState(false);
  const cartasDesbloqueadas = userProfile?.cartasDesbloqueadas || [];

  // ── Estado general ────────────────────────────────────────
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [predExistente, setPredExistente] = useState(null);

  // ── Cargar predicción previa ──────────────────────────────
  useEffect(() => {
    if (!firebaseUser) return;
    const cargar = async () => {
      const ref = doc(db, "predicciones", `${firebaseUser.uid}_${id}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const data = snap.data();
      setPredExistente(data);
      setGuardado(true);
      setCartaSeleccionada(data.cartaId || null);

      if (esEliminatoria) {
        setDefinicionSel(data.definicion || null);
        setGanador90Sel(data.ganador90 || null);
        setDif90Sel(data.diferencia90 || null);
        setGanadorAlargueSel(data.ganadorAlargue || null);
        setDifAlargueSel(data.diferenciaAlargue || null);
        setPenalesLocalSel(String(data.penalesLocal ?? ""));
        setPenalesVisSel(String(data.penalesVisitante ?? ""));
      } else {
        setGanadorSel(data.ganador || null);
        setDifSel(data.diferencia || null);
        if (estaDestacado) {
          setGolesLocalPred(String(data.golesLocalPred ?? ""));
          setGolesVisPred(String(data.golesVisitantePred ?? ""));
        }
      }
    };
    cargar();
  }, [firebaseUser, id, esEliminatoria, estaDestacado]);

  // ── Validación antes de guardar ───────────────────────────
  const puedeGuardar = () => {
    if (esEliminatoria) {
      if (!definicionSel) return false;
      if (definicionSel === "normal") {
        return !!ganador90Sel && !!dif90Sel;
      }
      if (definicionSel === "alargue") {
        return !!ganadorAlargueSel && !!difAlargueSel;
      }
      if (definicionSel === "penales") {
        return penalesLocalSel !== "" && penalesVisSel !== "";
      }
      return false;
    } else {
      if (estaDestacado) {
        return golesLocalPred !== "" && golesVisPred !== "";
      }
      if (ganadorSel === "empate") return true;
      return !!ganadorSel && !!difSel;
    }
  };

  // ── Guardar predicción ────────────────────────────────────
  const handleGuardar = async () => {
    if (!puedeGuardar()) return;
    setGuardando(true);

    try {
      const predData = {
        uid: firebaseUser.uid,
        partidoId: id,
        fecha,
        fase,
        estaDestacado,
        cartaId: cartaSeleccionada,
        guardadoEn: new Date().toISOString(),
      };

      if (esEliminatoria) {
        predData.definicion = definicionSel;
        if (definicionSel === "normal") {
          predData.ganador90 = ganador90Sel;
          predData.diferencia90 = dif90Sel;
          predData.ganador = ganador90Sel; // alias para compatibilidad
        } else if (definicionSel === "alargue") {
          predData.ganadorAlargue = ganadorAlargueSel;
          predData.diferenciaAlargue = difAlargueSel;
          predData.ganador = ganadorAlargueSel;
        } else if (definicionSel === "penales") {
          predData.penalesLocal = Number(penalesLocalSel);
          predData.penalesVisitante = Number(penalesVisSel);
          // Inferir ganador de la tanda
          predData.ganadorPenales =
            Number(penalesLocalSel) > Number(penalesVisSel) ? "local" : "visitante";
          predData.ganador = predData.ganadorPenales;
        }
      } else {
        if (estaDestacado) {
          predData.golesLocalPred = Number(golesLocalPred);
          predData.golesVisitantePred = Number(golesVisPred);
          const gl = Number(golesLocalPred);
          const gv = Number(golesVisPred);
          predData.ganador = gl > gv ? "local" : gv > gl ? "visitante" : "empate";
        } else {
          predData.ganador = ganadorSel;
          predData.diferencia = ganadorSel === "empate" ? null : difSel;
        }
      }

      await setDoc(doc(db, "predicciones", `${firebaseUser.uid}_${id}`), predData);
      setPredExistente(predData);
      setGuardado(true);
    } catch (e) {
      console.error("Error guardando predicción:", e);
    } finally {
      setGuardando(false);
    }
  };

  const handleEditarPred = () => {
    setGuardado(false);
  };

  // ── Carta adjunta ─────────────────────────────────────────
  const cartaAdjunta = cartaSeleccionada
    ? CARTAS.find((c) => c.id === cartaSeleccionada)
    : null;

  // ── Render resultado real ─────────────────────────────────
  const renderResultadoReal = () => {
    if (!tieneResultado) return null;
    return (
      <div style={{
        background: "var(--negro)", border: "2px solid var(--verde-claro)",
        padding: "10px", margin: "8px 0", textAlign: "center",
      }}>
        <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginBottom: "4px" }}>
          RESULTADO FINAL
        </p>
        <p style={{ fontSize: "18px" }}>
          {resultado.golesLocal} - {resultado.golesVisitante}
        </p>
        {resultado.definicion && resultado.definicion !== "normal" && (
          <p style={{ fontSize: "6px", color: "var(--amarillo)", marginTop: "4px" }}>
            {resultado.definicion === "alargue" ? "⏱ Se fue a ALARGUE" : "🎯 Se fue a PENALES"}
            {resultado.penalesLocal !== undefined && (
              <span> ({resultado.penalesLocal}-{resultado.penalesVisitante})</span>
            )}
          </p>
        )}
        {predExistente && predExistente.puntosGanados !== undefined && (
          <p style={{ fontSize: "7px", color: "var(--amarillo)", marginTop: "6px" }}>
            Ganaste: <span className="puntos-badge">{predExistente.puntosGanados} pts</span>
            {predExistente.cartaId && predExistente.esMaximo && (
              <span style={{ marginLeft: "6px", color: "var(--verde-claro)" }}>
                🃏 ×{CARTAS.find(c => c.id === predExistente.cartaId)?.multiplicador}
              </span>
            )}
          </p>
        )}
      </div>
    );
  };

  // ── Render sección de predicción GRUPOS ──────────────────
  const renderPredGrupos = () => (
    <div>
      {estaDestacado ? (
        <div>
          <p style={{ fontSize: "7px", color: "var(--amarillo)", textAlign: "center", marginBottom: "8px" }}>
            PREDICE EL MARCADOR EXACTO
          </p>
          <div className="resultado-exacto">
            <input type="number" min="0" max="20"
              value={golesLocalPred}
              onChange={(e) => setGolesLocalPred(e.target.value)}
              placeholder="0" />
            <span style={{ fontSize: "18px", color: "var(--amarillo)" }}>-</span>
            <input type="number" min="0" max="20"
              value={golesVisPred}
              onChange={(e) => setGolesVisPred(e.target.value)}
              placeholder="0" />
          </div>
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", textAlign: "center", marginTop: "6px" }}>
            Exacto: 3 pts | Solo ganador: 1 pt
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>¿QUIÉN GANA?</p>
          <div className="pred-opciones">
            <button className={`pred-btn ${ganadorSel === "local" ? "seleccionado" : ""}`}
              onClick={() => { setGanadorSel("local"); setDifSel(null); }}>
              {local.bandera} {local.nombre}
            </button>
            <button className={`pred-btn ${ganadorSel === "empate" ? "seleccionado" : ""}`}
              onClick={() => { setGanadorSel("empate"); setDifSel(null); }}>
              🤝 EMPATE
            </button>
            <button className={`pred-btn ${ganadorSel === "visitante" ? "seleccionado" : ""}`}
              onClick={() => { setGanadorSel("visitante"); setDifSel(null); }}>
              {visitante.bandera} {visitante.nombre}
            </button>
          </div>
          {ganadorSel && ganadorSel !== "empate" && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>¿POR CUÁNTO?</p>
              <div className="pred-opciones">
                <button className={`pred-btn ${difSel === "1" ? "seleccionado" : ""}`}
                  onClick={() => setDifSel("1")}>1 GOL</button>
                <button className={`pred-btn ${difSel === "2+" ? "seleccionado" : ""}`}
                  onClick={() => setDifSel("2+")}>2+ GOLES</button>
              </div>
            </div>
          )}
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginTop: "6px" }}>
            Ganador: 1 pt | + diferencia: 1 pt extra
          </p>
        </div>
      )}
    </div>
  );

  // ── Render sección de predicción ELIMINATORIA ─────────────
  const renderPredEliminatoria = () => (
    <div>
      {/* Paso 1: ¿Cómo se decide? */}
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "8px" }}>
        ¿CÓMO SE DECIDE EL PARTIDO?
      </p>
      <div className="pred-opciones" style={{ flexWrap: "wrap" }}>
        {[
          { val: "normal", label: "⚽ 90 MIN", sub: "+2/+3 pts" },
          { val: "alargue", label: "⏱ ALARGUE", sub: "+2/+3 pts" },
          { val: "penales", label: "🎯 PENALES", sub: "+2/+3/+4 pts" },
        ].map(({ val, label, sub }) => (
          <button
            key={val}
            className={`pred-btn ${definicionSel === val ? "seleccionado" : ""}`}
            onClick={() => {
              setDefinicionSel(val);
              setGanador90Sel(null); setDif90Sel(null);
              setGanadorAlargueSel(null); setDifAlargueSel(null);
              setPenalesLocalSel(""); setPenalesVisSel("");
            }}
            style={{ flex: "1 0 28%", flexDirection: "column", gap: "4px" }}
          >
            <span>{label}</span>
            <span style={{ fontSize: "5px", color: "var(--amarillo)" }}>{sub}</span>
          </button>
        ))}
      </div>

      {/* Paso 2: Detalle según selección */}
      {definicionSel === "normal" && (
        <div style={{ marginTop: "10px" }}>
          <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
            ¿QUIÉN GANA EN 90 MIN?
          </p>
          <div className="pred-opciones">
            <button className={`pred-btn ${ganador90Sel === "local" ? "seleccionado" : ""}`}
              onClick={() => { setGanador90Sel("local"); setDif90Sel(null); }}>
              {local.bandera} {local.nombre}
            </button>
            <button className={`pred-btn ${ganador90Sel === "visitante" ? "seleccionado" : ""}`}
              onClick={() => { setGanador90Sel("visitante"); setDif90Sel(null); }}>
              {visitante.bandera} {visitante.nombre}
            </button>
          </div>
          {ganador90Sel && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                ¿DIFERENCIA EN 90 MIN?
              </p>
              <div className="pred-opciones">
                <button className={`pred-btn ${dif90Sel === "1" ? "seleccionado" : ""}`}
                  onClick={() => setDif90Sel("1")}>1 GOL</button>
                <button className={`pred-btn ${dif90Sel === "2+" ? "seleccionado" : ""}`}
                  onClick={() => setDif90Sel("2+")}>2+ GOLES</button>
              </div>
            </div>
          )}
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginTop: "6px" }}>
            Acierta ganador: +2 pts | + diferencia: +3 pts
          </p>
        </div>
      )}

      {definicionSel === "alargue" && (
        <div style={{ marginTop: "10px" }}>
          <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
            ¿QUIÉN GANA EN EL ALARGUE?
          </p>
          <div className="pred-opciones">
            <button className={`pred-btn ${ganadorAlargueSel === "local" ? "seleccionado" : ""}`}
              onClick={() => { setGanadorAlargueSel("local"); setDifAlargueSel(null); }}>
              {local.bandera} {local.nombre}
            </button>
            <button className={`pred-btn ${ganadorAlargueSel === "visitante" ? "seleccionado" : ""}`}
              onClick={() => { setGanadorAlargueSel("visitante"); setDifAlargueSel(null); }}>
              {visitante.bandera} {visitante.nombre}
            </button>
          </div>
          {ganadorAlargueSel && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                ¿DIFERENCIA EN EL ALARGUE?
              </p>
              <div className="pred-opciones">
                <button className={`pred-btn ${difAlargueSel === "1" ? "seleccionado" : ""}`}
                  onClick={() => setDifAlargueSel("1")}>1 GOL</button>
                <button className={`pred-btn ${difAlargueSel === "2+" ? "seleccionado" : ""}`}
                  onClick={() => setDifAlargueSel("2+")}>2+ GOLES</button>
              </div>
            </div>
          )}
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginTop: "6px" }}>
            Alargue: +2 pts | + diferencia: +3 pts
          </p>
        </div>
      )}

      {definicionSel === "penales" && (
        <div style={{ marginTop: "10px" }}>
          <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "8px" }}>
            PREDICE EL RESULTADO DE LA TANDA
          </p>
          <div className="resultado-exacto">
            <input type="number" min="0" max="20"
              value={penalesLocalSel}
              onChange={(e) => setPenalesLocalSel(e.target.value)}
              placeholder="0" />
            <span style={{ fontSize: "12px", color: "var(--gris-claro)", padding: "0 8px" }}>
              {local.bandera}PEN{visitante.bandera}
            </span>
            <input type="number" min="0" max="20"
              value={penalesVisSel}
              onChange={(e) => setPenalesVisSel(e.target.value)}
              placeholder="0" />
          </div>
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", textAlign: "center", marginTop: "6px" }}>
            Penales: +2 pts | + ganador tanda: +3 pts | + diferencia exacta: +4 pts
          </p>
        </div>
      )}
    </div>
  );
  const [mostrarPredicciones, setMostrarPredicciones] = useState(false);
  // ── Badge de fase ─────────────────────────────────────────
  const faseLabel = FASE_LABELS[fase] || fase;

  return (
    <>
      {mostrarSelectorCartas && (
        <SelectorCartas
          cartasDesbloqueadas={cartasDesbloqueadas}
          cartaSeleccionada={cartaSeleccionada}
          onSeleccionar={(id) => { setCartaSeleccionada(id); setMostrarSelectorCartas(false); }}
          onCerrar={() => setMostrarSelectorCartas(false)}
        />
      )}

      <div className={`partido-card ${estaDestacado ? "partido-destacado-card" : ""}`}
        style={esEliminatoria ? { borderColor: "var(--rojo-chile)", boxShadow: "4px 4px 0 var(--rojo-oscuro)" } : {}}>

        {/* Badges */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
          {estaDestacado && <span className="partido-badge" style={{ position: "static", transform: "none" }}>⭐ DESTACADO</span>}
          {esEliminatoria && (
            <span className="partido-badge"
              style={{ position: "static", transform: "none", background: "var(--rojo-chile)", color: "var(--blanco)" }}>
              💀 {faseLabel.toUpperCase()}
            </span>
          )}
        </div>

        {/* Hora */}
        <div className="partido-hora">
          🕐 {formatHora(horaInicio)}
          {!abierto && !tieneResultado && (
            <span style={{ color: "var(--rojo-chile)", marginLeft: "8px" }}>[CERRADO]</span>
          )}
        </div>

        {/* Equipos */}
        <div className="partido-equipos">
          <div className="partido-equipo">
            <span className="partido-bandera">{local.bandera}</span>
            <span className="partido-nombre">{local.nombre}</span>
          </div>
          <span className="partido-vs">VS</span>
          <div className="partido-equipo">
            <span className="partido-bandera">{visitante.bandera}</span>
            <span className="partido-nombre">{visitante.nombre}</span>
          </div>
        </div>

        {/* Resultado real */}
        {renderResultadoReal()}
        
        <button
  className="btn-pixel"
  style={{
  fontSize: "6px",
  padding: "4px 8px",
  marginTop: "8px",
  display: "block",
  marginLeft: "auto",
  marginRight: "auto"
}}
  onClick={() => setMostrarPredicciones(true)}
>
  👁️ VER PREDICCIONES
</button>

        {/* Zona de predicción (solo si está abierto y sin resultado) */}
        {abierto && !tieneResultado && (
          <div>
            <div style={{ borderTop: "2px dashed var(--verde-campo)", paddingTop: "12px", marginTop: "4px" }}>
              {esEliminatoria ? renderPredEliminatoria() : renderPredGrupos()}
            </div>

            {/* Selector de carta */}
            <div style={{
              marginTop: "12px",
              borderTop: "1px solid var(--verde-campo)",
              paddingTop: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}>
              <div style={{ fontSize: "6px", color: "var(--gris-claro)" }}>
                {cartaAdjunta ? (
                  <span>
                    🃏 <span style={{ color: "var(--amarillo)" }}>{cartaAdjunta.emoji} {cartaAdjunta.nombre}</span>
                    <span style={{ color: "var(--verde-claro)" }}>Sin carta adjunta</span>
                      ×{cartaAdjunta.multiplicador}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: "var(--gris)" }}>Sin carta adjunta</span>
                )}
              </div>
              <button
                className="btn-pixel"
                style={{
                  fontSize: "6px", padding: "5px 8px",
                  background: cartasDesbloqueadas.length > 0 ? "var(--amarillo)" : "var(--gris)",
                  color: "var(--negro)",
                  border: "2px solid var(--negro)",
                  boxShadow: "2px 2px 0 var(--negro)",
                }}
                onClick={() => setMostrarSelectorCartas(true)}
              >
                🃏 CARTA
              </button>
            </div>

            {/* Botón guardar */}
            <button
              className="btn-pixel btn-verde w-full"
              style={{ marginTop: "12px" }}
              onClick={handleGuardar}
              disabled={guardando || guardado || !puedeGuardar()}
            >
              {guardando ? "GUARDANDO..." : guardado ? "✅ GUARDADO" : "💾 GUARDAR PREDICCIÓN"}
            </button>

            {guardado && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                <p className="pred-guardado-ok">✓ Puedes cambiarla antes del cierre</p>
                <button
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: "6px",
                    background: "none",
                    border: "1px solid var(--gris)",
                    color: "var(--gris-claro)",
                    padding: "3px 6px",
                    cursor: "pointer",
                  }}
                  onClick={handleEditarPred}
                >
                  ✏ EDITAR
                </button>
              </div>
            )}
          </div>
        )}

        {!abierto && !tieneResultado && (
          <div className="partido-cerrado">🔒 PREDICCIONES CERRADAS</div>
        )}
        {mostrarPredicciones && (
  <ModalPrediccionesAmigos
    partidoId={id}
    onCerrar={() => setMostrarPredicciones(false)}
  />
)}
      </div>
    </>
  );
}
