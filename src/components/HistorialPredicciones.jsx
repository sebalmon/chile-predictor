// src/components/HistorialPredicciones.jsx  — v6 (Fase 3)
// ─────────────────────────────────────────────────────────────
// Historial agrupado por día. Por cada día muestra:
//   • Lista de partidos (pronóstico + resultado real + puntos)
//   • Pregunta del día (acierto + puntos)
//   • Bonus ganador del día (si aplica)
//   • Total del día resaltado
// Limitado a los últimos 15 días para no hacer demasiadas lecturas.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, where, doc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { diaNumero } from "../utils/helpers";

// ── Helpers de texto ─────────────────────────────────────────
function textoApuestaPartido(pred) {
  if (pred.estaDestacado && pred.golesLocalPred !== undefined && pred.golesLocalPred !== null) {
    return `Exacto: ${pred.golesLocalPred} - ${pred.golesVisitantePred}`;
  }
  if (pred.definicion === "normal") {
    const g = pred.ganador90 === "local" ? "Local" : "Visitante";
    return `90min: ${g}${pred.diferencia90 ? ` + dif (${pred.diferencia90} gol${pred.diferencia90==="1"?"":"es"})` : ""}`;
  }
  if (pred.definicion === "alargue") {
    const g = pred.ganadorAlargue === "local" ? "Local" : "Visitante";
    return `Alargue: ${g}${pred.diferenciaAlargue ? ` + dif (${pred.diferenciaAlargue} gol${pred.diferenciaAlargue==="1"?"":"es"})` : ""}`;
  }
  if (pred.definicion === "penales") {
    const g = pred.ganadorPenales === "local" ? "Local" : "Visitante";
    const marcador = pred.penalesLocal !== undefined ? ` (${pred.penalesLocal}-${pred.penalesVisitante})` : "";
    return `Penales: ${g} gana${marcador}`;
  }
  // Grupos normal
  const ganLabel = pred.ganador === "local" ? "Local" : pred.ganador === "visitante" ? "Visitante" : "Empate";
  const dif = pred.diferencia ? ` + dif (${pred.diferencia} gol${pred.diferencia==="1"?"":"es"})` : "";
  return `${ganLabel}${dif}`;
}

function textoResultadoReal(r) {
  if (!r) return "—";
  const base = `${r.golesLocal}-${r.golesVisitante}`;
  if (r.definicion === "penales") return `${base} (pen ${r.penalesLocal}-${r.penalesVisitante})`;
  if (r.definicion === "alargue") return `${base} (alargue)`;
  return base;
}

function desgloseDesglose(puntos, estaDestacado, pred, resultado) {
  if (!resultado || puntos === 0) return "";
  if (estaDestacado) {
    return puntos === 5 ? "(3+2)" : "";
  }
  if (pred.diferencia && pred.ganador !== "empate" && puntos === 3) return "(1+2)";
  return "";
}

// ── Número de día desde el inicio del mundial ────────────────
function diaNumDesde(fechaStr) {
  const inicio = new Date("2026-06-11T00:00:00");
  const [y,m,d] = fechaStr.split("-").map(Number);
  const target = new Date(y,m-1,d);
  target.setHours(0,0,0,0);
  const diff = Math.floor((target - inicio) / 86400000);
  return diff >= 0 ? diff + 1 : null;
}

function labelFecha(fechaStr) {
  const [y,m,d] = fechaStr.split("-").map(Number);
  const meses = ["enero","febrero","marzo","abril","mayo","junio",
                 "julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const nDia = diaNumDesde(fechaStr);
  const sufijo = nDia ? ` — Día ${nDia}` : "";
  return `${d} de ${meses[m-1]} de ${y}${sufijo}`;
}

// ── Bloque de un partido ─────────────────────────────────────
function FilaPartido({ pred, partido }) {
  if (!partido?.resultado) return null;
  const { resultado, estaDestacado, local, visitante, fase } = partido;
  const acertaste  = pred.esMaximo === true;
  const pts        = typeof pred.puntosGanados === "number" ? pred.puntosGanados : null;
  const desglose   = pts ? desgloseDesglose(pts, estaDestacado, pred, resultado) : "";
  const apuesta    = textoApuestaPartido(pred);
  const resReal    = textoResultadoReal(resultado);
  const nombrePart = `${local?.bandera??""} ${local?.nombre??""} vs ${visitante?.nombre??""} ${visitante?.bandera??""}`;

  return (
    <div style={{
      padding: "6px 8px",
      borderBottom: "1px solid rgba(82,183,136,0.2)",
      display: "flex", gap: "6px", alignItems: "flex-start",
    }}>
      <span style={{ fontSize: "10px", lineHeight: 1, flexShrink: 0, marginTop: "1px" }}>
        {acertaste ? "✅" : "❌"}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "6px", color: "var(--blanco)", lineHeight: 1.8 }}>
          {nombrePart}
          {estaDestacado && <span style={{ color:"var(--amarillo)", marginLeft:"4px" }}>⭐</span>}
        </p>
        <p style={{ fontSize: "5px", color: "var(--gris-claro)", lineHeight: 1.8 }}>
          Tu apuesta: <span style={{ color:"var(--blanco)" }}>{apuesta}</span>
          {" · "}Real: <span style={{ color:"var(--amarillo)" }}>{resReal}</span>
        </p>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        {pts !== null ? (
          <span style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
            color: pts > 0 ? "var(--verde-claro)" : "var(--gris)",
          }}>
            {pts > 0 ? `+${pts}` : "0"}
            {desglose && <span style={{ fontSize:"5px", color:"var(--gris-claro)" }}> {desglose}</span>}
          </span>
        ) : <span style={{ fontSize:"5px", color:"var(--gris)" }}>—</span>}
      </div>
    </div>
  );
}

// ── Bloque de un día ─────────────────────────────────────────
function BloqueDia({ fecha, predicciones, partidos, respuesta, pregunta, puntosDelDia }) {
  const [abierto, setAbierto] = useState(true);

  const ptsParts   = predicciones.reduce((s,p) => s + (p.puntosGanados??0), 0);
  const ptsPregunta = respuesta?.puntosGanados ?? 0;
  const bonusGanador = puntosDelDia?.esGanador ? (puntosDelDia.bonusGanador ?? 2) : 0;
  const totalDia   = (puntosDelDia?.puntos ?? (ptsParts + ptsPregunta + bonusGanador));

  return (
    <div style={{
      border: "2px solid var(--verde-campo)",
      marginBottom: "8px",
      background: "rgba(0,0,0,0.25)",
    }}>
      {/* Header colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        style={{
          width: "100%", textAlign: "left",
          fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
          padding:"8px 10px", background:"var(--verde-oscuro)",
          border:"none", cursor:"pointer",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          color:"var(--blanco)",
        }}
      >
        <span style={{ color:"var(--verde-claro)" }}>📅 {labelFecha(fecha)}</span>
        <span style={{ color:"var(--amarillo)", fontSize:"8px" }}>
          {totalDia}pts {abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div>
          {/* Partidos */}
          {predicciones.length > 0 && (
            <div>
              <p style={{ fontSize:"5px", color:"var(--gris-claro)", padding:"4px 8px",
                background:"rgba(0,0,0,0.3)", borderBottom:"1px solid var(--verde-campo)" }}>
                PARTIDOS
              </p>
              {predicciones.map(pred => {
                const partido = partidos[pred.partidoId];
                return partido?.resultado
                  ? <FilaPartido key={pred.predId} pred={pred} partido={partido} />
                  : null;
              })}
            </div>
          )}

          {/* Pregunta del día */}
          {respuesta && (
            <div style={{
              padding:"6px 8px", borderBottom:"1px solid rgba(82,183,136,0.2)",
              display:"flex", alignItems:"center", gap:"6px",
            }}>
              <span style={{ fontSize:"10px" }}>
                {respuesta.esCorrecta ? "✅" : "❌"}
              </span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:1.8 }}>
                  PREGUNTA DEL DÍA
                  {pregunta && <span style={{ color:"var(--blanco)", marginLeft:"4px" }}>
                    — {pregunta.texto?.slice(0,40)}{pregunta.texto?.length>40?"…":""}
                  </span>}
                </p>
                <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:1.8 }}>
                  Tu respuesta: <span style={{ color:"var(--blanco)" }}>{respuesta.respuesta}</span>
                  {respuesta.esCorrecta === false && pregunta?.respuestaCorrecta &&
                    <span style={{ color:"var(--amarillo)", marginLeft:"4px" }}>
                      (correcta: {pregunta.respuestaCorrecta})
                    </span>
                  }
                </p>
              </div>
              <span style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                color: ptsPregunta > 0 ? "var(--verde-claro)" : "var(--gris)",
              }}>
                {ptsPregunta > 0 ? `+${ptsPregunta}` : "0"}
              </span>
            </div>
          )}

          {/* Bonus ganador del día */}
          {bonusGanador > 0 && (
            <div style={{
              padding:"6px 8px", borderBottom:"1px solid rgba(82,183,136,0.2)",
              display:"flex", alignItems:"center", gap:"6px",
            }}>
              <span style={{ fontSize:"10px" }}>🏆</span>
              <p style={{ flex:1, fontSize:"5px", color:"var(--amarillo)", lineHeight:1.8 }}>
                BONUS GANADOR DEL DÍA
              </p>
              <span style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                color:"var(--amarillo)",
              }}>
                +{bonusGanador}
              </span>
            </div>
          )}

          {/* Total del día */}
          <div style={{
            padding:"6px 10px",
            background:"rgba(244,208,63,0.08)",
            borderTop:"2px solid var(--verde-campo)",
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span style={{ fontSize:"6px", color:"var(--gris-claro)" }}>TOTAL DEL DÍA</span>
            <span style={{
              fontFamily:"'Press Start 2P',monospace", fontSize:"10px",
              color:"var(--amarillo)",
            }}>
              {totalDia} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
const LIMITE_DIAS = 15;

export default function HistorialPredicciones({ userId }) {
  const [dias,     setDias]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!userId) return;
    cargar();
  }, [userId]);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      // 1. Predicciones del usuario
      const snapPreds = await getDocs(query(
        collection(db,"predicciones"), where("uid","==",userId)
      ));
      // 2. Respuestas del usuario
      const snapResps = await getDocs(query(
        collection(db,"respuestas"), where("uid","==",userId)
      ));
      // 3. puntosDelDia del usuario
      const snapPDia = await getDocs(query(
        collection(db,"puntosDelDia"), where("uid","==",userId)
      ));

      // Agrupar por fecha
      const porFecha = {};

      for (const pDoc of snapPreds.docs) {
        const pred = pDoc.data();
        if (!pred.fecha) continue;
        if (!porFecha[pred.fecha]) porFecha[pred.fecha] = { predicciones:[], respuesta:null, pregunta:null, puntosDelDia:null };
        porFecha[pred.fecha].predicciones.push({ predId: pDoc.id, ...pred });
      }
      for (const rDoc of snapResps.docs) {
        const resp = rDoc.data();
        if (!resp.preguntaId) continue;
        // Inferir fecha desde preguntaId (formato YYYY-MM-DD_xxx)
        const fechaInf = resp.preguntaId.split("_")[0];
        if (!fechaInf || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInf)) continue;
        if (!porFecha[fechaInf]) porFecha[fechaInf] = { predicciones:[], respuesta:null, pregunta:null, puntosDelDia:null };
        porFecha[fechaInf].respuesta = { respId: rDoc.id, ...resp };
      }
      for (const dDoc of snapPDia.docs) {
        const pdData = dDoc.data();
        if (!pdData.fecha) continue;
        if (!porFecha[pdData.fecha]) porFecha[pdData.fecha] = { predicciones:[], respuesta:null, pregunta:null, puntosDelDia:null };
        porFecha[pdData.fecha].puntosDelDia = pdData;
      }

      // Ordenar fechas desc y limitar
      const fechas = Object.keys(porFecha).sort((a,b) => b.localeCompare(a)).slice(0, LIMITE_DIAS);

      // Cargar partidos y preguntas necesarios (en batch de IDs únicos)
      const partidoIds = [...new Set(fechas.flatMap(f => porFecha[f].predicciones.map(p => p.partidoId)))];
      const preguntaIds = [...new Set(fechas
        .filter(f => porFecha[f].respuesta)
        .map(f => porFecha[f].respuesta.preguntaId)
        .filter(Boolean))];

      const partidosMap = {};
      for (const pid of partidoIds) {
        try {
          const ps = await getDoc(doc(db,"partidos",pid));
          if (ps.exists()) partidosMap[pid] = { id:pid, ...ps.data() };
        } catch(_) {}
      }

      const preguntasMap = {};
      for (const qid of preguntaIds) {
        try {
          const qs = await getDoc(doc(db,"preguntas",qid));
          if (qs.exists()) preguntasMap[qid] = { id:qid, ...qs.data() };
        } catch(_) {}
      }

      // Asignar preguntas a los días
      for (const fecha of fechas) {
        const d = porFecha[fecha];
        if (d.respuesta?.preguntaId) {
          d.pregunta = preguntasMap[d.respuesta.preguntaId] || null;
        }
        // Filtrar solo predicciones con partido que tiene resultado
        d.predicciones = d.predicciones.filter(p => partidosMap[p.partidoId]?.resultado);
      }

      // Construir lista final filtrando días sin datos útiles
      const listaFinal = fechas
        .filter(f => {
          const d = porFecha[f];
          return d.predicciones.length > 0 || d.respuesta || d.puntosDelDia;
        })
        .map(f => ({ fecha: f, ...porFecha[f], partidos: partidosMap }));

      setDias(listaFinal);
    } catch(e) {
      console.error(e);
      setError("No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  };

  if (cargando) return (
    <div style={{ padding:"16px", textAlign:"center" }}>
      <span className="spinner">⚙</span>
      <p style={{ fontSize:"6px", color:"var(--gris-claro)", marginTop:"6px" }}>Cargando historial...</p>
    </div>
  );
  if (error) return (
    <p style={{ fontSize:"6px", color:"var(--rojo-chile)", padding:"8px" }}>{error}</p>
  );
  if (dias.length === 0) return (
    <p style={{ fontSize:"6px", color:"var(--gris-claro)", padding:"12px", textAlign:"center", lineHeight:2 }}>
      Sin historial todavía.
    </p>
  );

  return (
    <div style={{ padding:"8px" }}>
      <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"8px", lineHeight:1.8 }}>
        Últimos {Math.min(dias.length, LIMITE_DIAS)} días · Clic en el día para desplegar/plegar
      </p>
      {dias.map(d => (
        <BloqueDia
          key={d.fecha}
          fecha={d.fecha}
          predicciones={d.predicciones}
          partidos={d.partidos}
          respuesta={d.respuesta}
          pregunta={d.pregunta}
          puntosDelDia={d.puntosDelDia}
        />
      ))}
    </div>
  );
}
