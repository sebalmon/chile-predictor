// src/components/PartidoCard.jsx  — v6 (Fase 3)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v6:
//   • Muestra ciudad y país si existen en el documento del partido
//     (campos `ciudad` y `pais` editados desde Firebase Console).
//     Formato: "12 jun · 15:00 · Guadalajara, México"
//   • Botón 🃏 CARTA se desactiva cuando la predicción está guardada
//     y solo se reactiva al hacer clic en ✏ EDITAR.
//   • onGuardado callback para que TabPartidos sepa cuándo disparar el modal.
// ─────────────────────────────────────────────────────────────
import ModalPrediccionesAmigos from "./ModalPrediccionesAmigos";
import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { partidoAbierto, formatHora } from "../utils/helpers";
import { CARTAS, FASES_ELIMINATORIAS, FASE_LABELS } from "../data/sampleData";

// ── Estadísticas de apuestas (bug 2) ─────────────────────────
function EstadisticasApuestas({ partidoId, local, visitante }) {
  const [stats, setStats] = React.useState(null);
  React.useEffect(() => {
    if (!partidoId) return;
    const cargar = async () => {
      try {
        const { getDocs, query, collection, where } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        const snap = await getDocs(query(collection(db,"predicciones"),where("partidoId","==",partidoId)));
        if (snap.empty) return;
        const c = {local:0,empate:0,visitante:0};
        snap.docs.forEach(d => {
          const g = d.data().ganador;
          if (g==="local") c.local++; else if (g==="empate") c.empate++; else if (g==="visitante") c.visitante++;
        });
        const total = c.local+c.empate+c.visitante;
        if (total===0) return;
        setStats({
          total,
          local:     Math.round((c.local/total)*100),
          empate:    Math.round((c.empate/total)*100),
          visitante: Math.round((c.visitante/total)*100),
        });
      } catch(_) {}
    };
    cargar();
  }, [partidoId]);

  if (!stats) return null;
  const filas = [
    {key:"local",    label:local?.nombre||"Local",     pct:stats.local,    color:"#4ade80"},
    {key:"empate",   label:"Empate",                   pct:stats.empate,   color:"#facc15"},
    {key:"visitante",label:visitante?.nombre||"Visit.", pct:stats.visitante,color:"#f87171"},
  ];
  return (
    <div style={{ marginTop:"10px",padding:"8px 10px",
      border:"1px solid rgba(82,183,136,0.3)",background:"rgba(0,0,0,0.25)" }}>
      <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginBottom:"6px",letterSpacing:"1px" }}>
        PRONÓSTICOS DE LA HINCHADA ({stats.total} votos)
      </p>
      {filas.map(({key,label,pct,color}) => (
        <div key={key} style={{ marginBottom:"4px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"2px" }}>
            <span style={{ fontSize:"5px",color:"var(--gris-claro)" }}>{label}</span>
            <span style={{ fontSize:"5px",color,fontFamily:"'Press Start 2P',monospace" }}>{pct}%</span>
          </div>
          <div style={{ height:"5px",background:"rgba(255,255,255,0.1)" }}>
            <div style={{ height:"100%",width:`${pct}%`,background:color,transition:"width 0.4s" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Selector de cartas ────────────────────────────────────────
function SelectorCartas({ cartasDisponibles, cartaSeleccionada, onSeleccionar, onCerrar }) {
  const RAREZA_COLOR = { comun:"var(--verde-claro)", rara:"var(--amarillo)", legendaria:"var(--rojo-chile)" };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:500,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--amarillo)",
        boxShadow:"6px 6px 0 var(--amarillo-oscuro)",padding:"20px",
        maxWidth:"360px",width:"100%",maxHeight:"80vh",overflowY:"auto" }}>
        <p style={{ fontSize:"8px",color:"var(--amarillo)",marginBottom:"14px" }}>
          🃏 ELIGE UNA CARTA PARA ESTE PARTIDO
        </p>
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"14px",lineHeight:2 }}>
          La carta se consume al usar (cuando el partido termine). Una por partido.
        </p>

        {cartasDisponibles.length === 0 ? (
          <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"20px" }}>
            No tienes cartas. ¡Sube al podio del día!
          </p>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px" }}>
            <button onClick={() => onSeleccionar(null)}
              style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                padding:"8px 12px",cursor:"pointer",textAlign:"left",
                border:`2px solid ${cartaSeleccionada===null?"var(--verde-claro)":"var(--gris)"}`,
                background: cartaSeleccionada===null?"rgba(82,183,136,0.2)":"transparent",
                color:"var(--blanco)" }}>
              ✖ Sin carta (no arriesgar)
            </button>
            {cartasDisponibles.map(({ carta, cantidad }) => (
              <button key={carta.id} onClick={() => onSeleccionar(carta.id)}
                style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                  padding:"10px 12px",cursor:"pointer",textAlign:"left",
                  border:`2px solid ${cartaSeleccionada===carta.id?RAREZA_COLOR[carta.rareza]:"var(--gris)"}`,
                  background: cartaSeleccionada===carta.id
                    ? `rgba(${carta.rareza==="legendaria"?"214,40,40":carta.rareza==="rara"?"244,208,63":"82,183,136"},0.15)`
                    : "transparent",
                  color:"var(--blanco)",
                  display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div>
                  <div style={{ color:RAREZA_COLOR[carta.rareza] }}>{carta.nombre}</div>
                  <div style={{ color:"var(--gris-claro)",marginTop:"4px" }}>×{carta.multiplicador}</div>
                </div>
                <span style={{ fontSize:"7px",color:"var(--amarillo)" }}>x{cantidad}</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn-pixel btn-gris w-full" onClick={onCerrar} style={{ fontSize:"7px" }}>CERRAR</button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
function PartidoCard({ partido, onGuardado }) {
  const { firebaseUser, userProfile } = useAuth();
  const {
    id, fecha, horaInicio, local, visitante,
    fase = "grupos", estaDestacado, resultado,
    ciudad, pais,
  } = partido;

  const abierto      = partidoAbierto(partido);
  const esElim       = FASES_ELIMINATORIAS.includes(fase);
  const tieneRes     = resultado !== null && resultado !== undefined;
  const faseLabel    = FASE_LABELS[fase] || fase;

  // ── Estado grupos ─────────────────────────────────────────
  const [ganadorSel, setGanadorSel]       = useState(null);
  const [difSel, setDifSel]               = useState(null);
  const [golesLocalPred, setGolesLocalP]  = useState("");
  const [golesVisPred, setGolesVisP]      = useState("");

  // ── Estado eliminatoria ───────────────────────────────────
  const [defSel, setDefSel]               = useState(null);
  const [gan90, setGan90]                 = useState(null);
  const [dif90, setDif90]                 = useState(null);
  const [ganAlg, setGanAlg]               = useState(null);
  const [difAlg, setDifAlg]               = useState(null);
  const [penL, setPenL]                   = useState("");
  const [penV, setPenV]                   = useState("");

  // ── Carta ─────────────────────────────────────────────────
  const [cartaSel, setCartaSel]           = useState(null);
  const [mostrarSelector, setMostrarSel]  = useState(false);
  // Fix 5: leer cartas frescas de Firestore (evita stale userProfile)
  const [cartasConCantidad, setCartasConCantidad] = React.useState([]);
  React.useEffect(() => {
    const cargarCartas = async () => {
      if (!firebaseUser) return;
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        const snap = await getDoc(doc(db,"usuarios",firebaseUser.uid));
        const map  = snap.exists() ? (snap.data().cartas||{}) : (userProfile?.cartas||{});
        setCartasConCantidad(
          Object.entries(map)
            .filter(([,cnt]) => cnt > 0)
            .map(([cartaId, cantidad]) => ({ carta: CARTAS.find(c => c.id === cartaId), cantidad }))
            .filter(item => item.carta)
        );
      } catch(_) {
        // fallback
        setCartasConCantidad(
          Object.entries(userProfile?.cartas||{})
            .filter(([,cnt]) => cnt > 0)
            .map(([cartaId, cantidad]) => ({ carta: CARTAS.find(c => c.id === cartaId), cantidad }))
            .filter(item => item.carta)
        );
      }
    };
    cargarCartas();
  }, [firebaseUser, userProfile]);

  // ── Estado general ────────────────────────────────────────
  const [guardado,     setGuardado]     = useState(false);
  const [guardando,    setGuardando]    = useState(false);
  const [predExistente,setPredExistente]= useState(null);
  const [mostrarPreds, setMostrarPreds] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const cargar = async () => {
      const snap = await getDoc(doc(db,"predicciones",`${firebaseUser.uid}_${id}`));
      if (!snap.exists()) return;
      const d = snap.data();
      setPredExistente(d); setGuardado(true); setCartaSel(d.cartaId||null);
      if (esElim) {
        setDefSel(d.definicion||null); setGan90(d.ganador90||null); setDif90(d.diferencia90||null);
        setGanAlg(d.ganadorAlargue||null); setDifAlg(d.diferenciaAlargue||null);
        setPenL(String(d.penalesLocal??"")); setPenV(String(d.penalesVisitante??""));
      } else {
        setGanadorSel(d.ganador||null); setDifSel(d.diferencia||null);
        if (estaDestacado) { setGolesLocalP(String(d.golesLocalPred??"")); setGolesVisP(String(d.golesVisitantePred??"")); }
      }
    };
    cargar();
  }, [firebaseUser, id, esElim, estaDestacado]);

  const puedeGuardar = () => {
    if (esElim) {
      if (!defSel) return false;
      if (defSel === "normal")  return !!gan90 && !!dif90;
      if (defSel === "alargue") return !!ganAlg && !!difAlg;
      if (defSel === "penales") return penL !== "" && penV !== "";
      return false;
    }
    if (estaDestacado) return golesLocalPred !== "" && golesVisPred !== "";
    if (ganadorSel === "empate") return true;
    return !!ganadorSel && !!difSel;
  };

  const handleGuardar = async () => {
    if (!puedeGuardar()) return;
    setGuardando(true);
    try {
      const predData = {
        uid:firebaseUser.uid, partidoId:id, fecha, fase, estaDestacado,
        cartaId:cartaSel, guardadoEn:new Date().toISOString(),
      };
      if (esElim) {
        predData.definicion = defSel;
        if (defSel === "normal") {
          predData.ganador90 = gan90; predData.diferencia90 = dif90; predData.ganador = gan90;
        } else if (defSel === "alargue") {
          predData.ganadorAlargue = ganAlg; predData.diferenciaAlargue = difAlg; predData.ganador = ganAlg;
        } else if (defSel === "penales") {
          predData.penalesLocal = Number(penL); predData.penalesVisitante = Number(penV);
          predData.ganadorPenales = Number(penL) > Number(penV) ? "local" : "visitante";
          predData.ganador = predData.ganadorPenales;
        }
      } else {
        if (estaDestacado) {
          predData.golesLocalPred = Number(golesLocalPred);
          predData.golesVisitantePred = Number(golesVisPred);
          const gl = Number(golesLocalPred), gv = Number(golesVisPred);
          predData.ganador = gl > gv ? "local" : gv > gl ? "visitante" : "empate";
        } else {
          predData.ganador = ganadorSel;
          predData.diferencia = ganadorSel === "empate" ? null : difSel;
        }
      }
      await setDoc(doc(db,"predicciones",`${firebaseUser.uid}_${id}`), predData);
      setPredExistente(predData); setGuardado(true);
      if (onGuardado) onGuardado();
    } catch(e) { console.error(e); }
    finally { setGuardando(false); }
  };

  const handleEditar = () => setGuardado(false);

  const cartaAdjunta = cartaSel ? CARTAS.find(c => c.id === cartaSel) : null;

  // ── Label de ubicación/hora ───────────────────────────────
  const mesesCortos = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  let labelFechaHora = `🕐 ${formatHora(horaInicio)}`;
  if (fecha) {
    const [,m,d] = fecha.split("-").map(Number);
    labelFechaHora = `${d} ${mesesCortos[m-1]} · ${horaInicio}`;
  }
  if (ciudad || pais) {
    const ubicacion = [ciudad, pais].filter(Boolean).join(", ");
    labelFechaHora += ` · 📍${ubicacion}`;
  }

  // ── Render resultado real ─────────────────────────────────
  const renderResultado = () => {
    if (!tieneRes) return null;
    return (
      <div style={{ background:"var(--negro)",border:"2px solid var(--verde-claro)",
        padding:"10px",margin:"8px 0",textAlign:"center" }}>
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"4px" }}>RESULTADO FINAL</p>
        <p style={{ fontSize:"18px" }}>{resultado.golesLocal} - {resultado.golesVisitante}</p>
        {resultado.definicion && resultado.definicion !== "normal" && (
          <p style={{ fontSize:"6px",color:"var(--amarillo)",marginTop:"4px" }}>
            {resultado.definicion === "alargue" ? "⏱ ALARGUE" : "🎯 PENALES"}
            {resultado.penalesLocal !== undefined && ` (${resultado.penalesLocal}-${resultado.penalesVisitante})`}
          </p>
        )}
        {predExistente?.puntosGanados !== undefined && (
          <p style={{ fontSize:"7px",color:"var(--amarillo)",marginTop:"6px" }}>
            Ganaste: <span className="puntos-badge">{predExistente.puntosGanados} pts</span>
            {predExistente.cartaId && predExistente.esMaximo && (
              <span style={{ marginLeft:"6px",color:"var(--verde-claro)" }}>
                🃏 ×{CARTAS.find(c=>c.id===predExistente.cartaId)?.multiplicador}
              </span>
            )}
          </p>
        )}
      </div>
    );
  };

  // ── Render predicción grupos ──────────────────────────────
  const renderGrupos = () => (
    <div>
      {estaDestacado ? (
        <div>
          <p style={{ fontSize:"7px",color:"var(--amarillo)",textAlign:"center",marginBottom:"8px" }}>
            PREDICE EL MARCADOR EXACTO
          </p>
          <div className="resultado-exacto">
            <input type="number" min="0" max="20" value={golesLocalPred}
              onChange={e => setGolesLocalP(e.target.value)} placeholder="0" />
            <span style={{ fontSize:"18px",color:"var(--amarillo)" }}>-</span>
            <input type="number" min="0" max="20" value={golesVisPred}
              onChange={e => setGolesVisP(e.target.value)} placeholder="0" />
          </div>
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",marginTop:"6px" }}>
            Exacto: +5 pts | Solo ganador: +2 pts
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿QUIÉN GANA?</p>
          <div className="pred-opciones">
            <button className={`pred-btn ${ganadorSel==="local"?"seleccionado":""}`}
              onClick={() => { setGanadorSel("local"); setDifSel(null); }}>
              {local.bandera} {local.nombre}
            </button>
            <button className={`pred-btn ${ganadorSel==="empate"?"seleccionado":""}`}
              onClick={() => { setGanadorSel("empate"); setDifSel(null); }}>🤝 EMPATE</button>
            <button className={`pred-btn ${ganadorSel==="visitante"?"seleccionado":""}`}
              onClick={() => { setGanadorSel("visitante"); setDifSel(null); }}>
              {visitante.bandera} {visitante.nombre}
            </button>
          </div>
          {ganadorSel && ganadorSel !== "empate" && (
            <div style={{ marginTop:"8px" }}>
              <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿POR CUÁNTO?</p>
              <div className="pred-opciones">
                <button className={`pred-btn ${difSel==="1"?"seleccionado":""}`}
                  onClick={() => setDifSel("1")}>1 GOL</button>
                <button className={`pred-btn ${difSel==="2+"?"seleccionado":""}`}
                  onClick={() => setDifSel("2+")}>2+ GOLES</button>
              </div>
            </div>
          )}
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginTop:"6px" }}>
            Ganador: +1 pt | + diferencia: +2 pts extra (total +3)
          </p>
        </div>
      )}
    </div>
  );

  // ── Render predicción eliminatoria ────────────────────────
  const renderElim = () => (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"8px" }}>¿CÓMO SE DECIDE?</p>
      <div className="pred-opciones" style={{ flexWrap:"wrap" }}>
        {[
          {val:"normal", label:"⚽ 90 MIN", sub:"+4 pts"},
          {val:"alargue",label:"⏱ ALARGUE",sub:"+6 pts"},
          {val:"penales",label:"🎯 PENALES",sub:"+6/+10/+14 pts"},
        ].map(({val,label,sub}) => (
          <button key={val}
            className={`pred-btn ${defSel===val?"seleccionado":""}`}
            onClick={() => { setDefSel(val); setGan90(null); setDif90(null); setGanAlg(null); setDifAlg(null); setPenL(""); setPenV(""); }}
            style={{ flex:"1 0 28%",flexDirection:"column",gap:"4px" }}>
            <span>{label}</span>
            <span style={{ fontSize:"5px",color:"var(--amarillo)" }}>{sub}</span>
          </button>
        ))}
      </div>

      {defSel === "normal" && (
        <div style={{ marginTop:"10px" }}>
          <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿QUIÉN GANA EN 90 MIN?</p>
          <div className="pred-opciones">
            <button className={`pred-btn ${gan90==="local"?"seleccionado":""}`}
              onClick={() => { setGan90("local"); setDif90(null); }}>
              {local.bandera} {local.nombre}
            </button>
            <button className={`pred-btn ${gan90==="visitante"?"seleccionado":""}`}
              onClick={() => { setGan90("visitante"); setDif90(null); }}>
              {visitante.bandera} {visitante.nombre}
            </button>
          </div>
          {gan90 && (
            <div style={{ marginTop:"8px" }}>
              <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿DIFERENCIA?</p>
              <div className="pred-opciones">
                <button className={`pred-btn ${dif90==="1"?"seleccionado":""}`}
                  onClick={() => setDif90("1")}>1 GOL</button>
                <button className={`pred-btn ${dif90==="2+"?"seleccionado":""}`}
                  onClick={() => setDif90("2+")}>2+ GOLES</button>
              </div>
            </div>
          )}
        </div>
      )}

      {defSel === "alargue" && (
        <div style={{ marginTop:"10px" }}>
          <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿QUIÉN GANA EN ALARGUE?</p>
          <div className="pred-opciones">
            <button className={`pred-btn ${ganAlg==="local"?"seleccionado":""}`}
              onClick={() => { setGanAlg("local"); setDifAlg(null); }}>
              {local.bandera} {local.nombre}
            </button>
            <button className={`pred-btn ${ganAlg==="visitante"?"seleccionado":""}`}
              onClick={() => { setGanAlg("visitante"); setDifAlg(null); }}>
              {visitante.bandera} {visitante.nombre}
            </button>
          </div>
          {ganAlg && (
            <div style={{ marginTop:"8px" }}>
              <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿DIFERENCIA EN ALARGUE?</p>
              <div className="pred-opciones">
                <button className={`pred-btn ${difAlg==="1"?"seleccionado":""}`}
                  onClick={() => setDifAlg("1")}>1 GOL</button>
                <button className={`pred-btn ${difAlg==="2+"?"seleccionado":""}`}
                  onClick={() => setDifAlg("2+")}>2+ GOLES</button>
              </div>
            </div>
          )}
        </div>
      )}

      {defSel === "penales" && (
        <div style={{ marginTop:"10px" }}>
          <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"8px" }}>TANDA DE PENALES</p>
          <div className="resultado-exacto">
            <input type="number" min="0" max="20" value={penL}
              onChange={e => setPenL(e.target.value)} placeholder="0" />
            <span style={{ fontSize:"12px",color:"var(--gris-claro)",padding:"0 8px" }}>
              {local.bandera}PEN{visitante.bandera}
            </span>
            <input type="number" min="0" max="20" value={penV}
              onChange={e => setPenV(e.target.value)} placeholder="0" />
          </div>
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",marginTop:"6px" }}>
            Acertar penales: +3 | + ganador tanda: +2 | + diferencia exacta: +4
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {mostrarSelector && (
        <SelectorCartas
          cartasDisponibles={cartasConCantidad}
          cartaSeleccionada={cartaSel}
          onSeleccionar={id => { setCartaSel(id); setMostrarSel(false); }}
          onCerrar={() => setMostrarSel(false)}
        />
      )}

      <div className={`partido-card ${estaDestacado?"partido-destacado-card":""}`}
        style={esElim?{borderColor:"var(--rojo-chile)",boxShadow:"4px 4px 0 var(--rojo-oscuro)"}:{}}>

        {/* Badges */}
        <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"4px" }}>
          {estaDestacado && <span className="partido-badge" style={{ position:"static",transform:"none" }}>⭐ DESTACADO</span>}
          {esElim && (
            <span className="partido-badge" style={{ position:"static",transform:"none",
              background:"var(--rojo-chile)",color:"var(--blanco)" }}>
              💀 {faseLabel.toUpperCase()}
            </span>
          )}
        </div>

        {/* Fecha · hora · ciudad */}
        <div className="partido-hora" style={{ fontSize:"6px",lineHeight:2 }}>
          {labelFechaHora}
          {!abierto && !tieneRes && (
            <span style={{ color:"var(--rojo-chile)",marginLeft:"8px" }}>[CERRADO]</span>
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

        {/* Estadísticas de apuestas */}
        <EstadisticasApuestas partidoId={id} local={local} visitante={visitante} />

        {/* Resultado */}
        {renderResultado()}

        {/* Ver predicciones de rivales */}
        <button className="btn-pixel" style={{ fontSize:"6px",padding:"4px 8px",
          marginTop:"8px",display:"block",marginLeft:"auto",marginRight:"auto" }}
          onClick={() => setMostrarPreds(true)}>
          👁️ VER PREDICCIONES DE TUS ENEMIGOS
        </button>

        {/* Zona de predicción */}
        {abierto && !tieneRes && (
          <div>
            <div style={{ borderTop:"2px dashed var(--verde-campo)",paddingTop:"12px",marginTop:"4px" }}>
              {esElim ? renderElim() : renderGrupos()}
            </div>

            {/* Selector de carta — desactivado cuando guardado */}
            <div style={{ marginTop:"12px",borderTop:"1px solid var(--verde-campo)",
              paddingTop:"10px",display:"flex",alignItems:"center",
              justifyContent:"space-between",gap:"8px" }}>
              <div style={{ fontSize:"6px",color:"var(--gris-claro)" }}>
                {cartaAdjunta ? (
                  <span>
                    🃏 <span style={{ color:"var(--amarillo)" }}>{cartaAdjunta.nombre}</span>
                    <span style={{ color:"var(--verde-claro)",marginLeft:"4px" }}>×{cartaAdjunta.multiplicador}</span>
                  </span>
                ) : (
                  <span style={{ color:"var(--verde-claro)" }}>Sin carta adjunta</span>
                )}
              </div>
              <button
                className="btn-pixel"
                style={{
                  fontSize:"6px",padding:"5px 8px",
                  background: guardado
                    ? "var(--gris)"          // desactivado cuando guardado
                    : cartasConCantidad.length > 0 ? "var(--amarillo)" : "var(--gris)",
                  color: "var(--negro)",
                  border:"2px solid var(--negro)",boxShadow:"2px 2px 0 var(--negro)",
                  cursor: guardado ? "not-allowed" : "pointer",
                  opacity: guardado ? 0.5 : 1,
                }}
                onClick={() => !guardado && setMostrarSel(true)}
                disabled={guardado}
                title={guardado ? "Haz clic en EDITAR para cambiar la carta" : "Seleccionar carta"}
              >
                🃏 CARTA
              </button>
            </div>

            {/* Guardar */}
            <button className="btn-pixel btn-verde w-full" style={{ marginTop:"12px" }}
              onClick={handleGuardar} disabled={guardando||guardado||!puedeGuardar()}>
              {guardando ? "GUARDANDO..." : guardado ? "✅ GUARDADO" : "💾 GUARDAR PREDICCIÓN"}
            </button>

            {guardado && (
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"6px" }}>
                <p className="pred-guardado-ok">✓ Puedes cambiarla antes del cierre</p>
                <button
                  style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                    background:"none",border:"1px solid var(--gris)",
                    color:"var(--gris-claro)",padding:"3px 6px",cursor:"pointer" }}
                  onClick={handleEditar}>
                  ✏ EDITAR
                </button>
              </div>
            )}
          </div>
        )}

        {!abierto && !tieneRes && (
          <div className="partido-cerrado">🔒 PREDICCIONES CERRADAS</div>
        )}

        {mostrarPreds && (
          <ModalPrediccionesAmigos
            partidoId={id}
            onCerrar={() => setMostrarPreds(false)}
          />
        )}
      </div>
    </>
  );
}

// Memo: evita re-render de todas las cards cuando el padre cambia
// estado no relacionado (onGuardado va memorizado con useCallback).
export default React.memo(PartidoCard);
