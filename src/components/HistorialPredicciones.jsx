// src/components/HistorialPredicciones.jsx  — v7 (Patch 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v7:
//   Punto 3: Total del día calculado con fuente de verdad correcta:
//     se usa puntosDelDia.puntos cuando existe (ya incluye bonus);
//     si no, suma predicciones + pregunta + bonus localmente.
//     Se elimina el doble-conteo del bonus.
//   Punto 9: En FilaPartido, muestra "🃏 ×N" si pred.cartaId
//     y pred.cartaConsumida, junto al multiplicador utilizado.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, query, where, documentId, doc, getDoc,
} from "firebase/firestore";

// Trae docs por id en lotes de 30 (límite del operador "in" de Firestore),
// en una query por lote en vez de un getDoc por id (evita N+1).
async function traerPorIds(nombreColeccion, ids) {
  const mapa = {};
  const lotes = [];
  for (let i = 0; i < ids.length; i += 30) lotes.push(ids.slice(i, i + 30));
  await Promise.all(lotes.map(async lote => {
    if (lote.length === 0) return;
    const snap = await getDocs(query(collection(db, nombreColeccion), where(documentId(), "in", lote)));
    snap.forEach(d => { mapa[d.id] = { id: d.id, ...d.data() }; });
  }));
  return mapa;
}
import { db } from "../firebase";
import { CARTAS } from "../data/sampleData";

// ── Helpers de texto ──────────────────────────────────────────
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

function desgloseDesglose(puntos, estaDestacado, pred) {
  if (puntos === 0) return "";
  if (estaDestacado && puntos === 5) return "(3+2)";
  if (!estaDestacado && pred.diferencia && pred.ganador !== "empate" && puntos === 3) return "(1+2)";
  return "";
}

function diaNumDesde(fechaStr) {
  const inicio = new Date("2026-06-11T00:00:00");
  const [y,m,d] = fechaStr.split("-").map(Number);
  const target = new Date(y,m-1,d); target.setHours(0,0,0,0);
  const diff = Math.floor((target - inicio) / 86400000);
  return diff >= 0 ? diff + 1 : null;
}

function labelFecha(fechaStr) {
  const [y,m,d] = fechaStr.split("-").map(Number);
  const meses = ["enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const nDia = diaNumDesde(fechaStr);
  return `${d} de ${meses[m-1]} de ${y}${nDia ? ` — Día ${nDia}` : ""}`;
}

// ── Fila de un partido (punto 9: aviso de carta) ──────────────
function FilaPartido({ pred, partido }) {
  if (!partido?.resultado) return null;
  const { resultado, estaDestacado, local, visitante } = partido;
  const acertaste  = pred.esMaximo === true;
  const pts        = typeof pred.puntosGanados === "number" ? pred.puntosGanados : null;
  // Puntos BASE (sin multiplicar) para el desglose
  const ptsBase    = typeof pred.puntosBase === "number" ? pred.puntosBase : pts;
  const desglose   = ptsBase ? desgloseDesglose(ptsBase, estaDestacado, pred) : "";
  const apuesta    = textoApuestaPartido(pred);
  const resReal    = textoResultadoReal(resultado);
  const nombrePart = `${local?.bandera??""} ${local?.nombre??""} vs ${visitante?.nombre??""} ${visitante?.bandera??""}`;

  // Carta usada (punto 9)
  const cartaUsada = pred.cartaId && pred.cartaConsumida
    ? CARTAS.find(c => c.id === pred.cartaId)
    : null;

  return (
    <div style={{ padding:"6px 8px",borderBottom:"1px solid rgba(82,183,136,0.2)",
      display:"flex",gap:"6px",alignItems:"flex-start" }}>
      <span style={{ fontSize:"10px",lineHeight:1,flexShrink:0,marginTop:"1px" }}>
        {acertaste ? "✅" : "❌"}
      </span>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:"6px",color:"var(--blanco)",lineHeight:1.8 }}>
          {nombrePart}
          {estaDestacado && <span style={{ color:"var(--amarillo)",marginLeft:"4px" }}>⭐</span>}
        </p>
        <p style={{ fontSize:"5px",color:"var(--gris-claro)",lineHeight:1.8 }}>
          Tu apuesta: <span style={{ color:"var(--blanco)" }}>{apuesta}</span>
          {" · "}Real: <span style={{ color:"var(--amarillo)" }}>{resReal}</span>
        </p>
        {/* Aviso de carta (punto 9) */}
        {cartaUsada && (
          <p style={{ fontSize:"5px",color:"var(--amarillo)",lineHeight:1.8,marginTop:"2px" }}>
            🃏 Carta <strong>{cartaUsada.nombre}</strong> ×{cartaUsada.multiplicador} utilizada
          </p>
        )}
      </div>
      <div style={{ textAlign:"right",flexShrink:0 }}>
        {pts !== null ? (
          <div>
            <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
              color:pts>0?"var(--verde-claro)":"var(--gris)" }}>
              {pts>0?`+${pts}`:"0"}
            </span>
            {desglose && (
              <span style={{ fontSize:"5px",color:"var(--gris-claro)",display:"block" }}>{desglose}</span>
            )}
            {cartaUsada && pts > 0 && ptsBase && pts !== ptsBase && (
              <span style={{ fontSize:"5px",color:"var(--amarillo)",display:"block" }}>
                ×{cartaUsada.multiplicador}
              </span>
            )}
          </div>
        ) : <span style={{ fontSize:"5px",color:"var(--gris)" }}>—</span>}
      </div>
    </div>
  );
}

// ── Bloque de un día ──────────────────────────────────────────
function BloqueDia({ fecha, predicciones, partidos, respuesta, pregunta, puntosDelDia }) {
  const [abierto, setAbierto] = useState(true);

  // Punto 3: Total del día con fuente correcta
  // puntosDelDia.puntos ya es la suma definitiva guardada por helpers.js
  // (incluye partidos + pregunta + bonus diario).
  // Solo calculamos localmente si no hay ese documento.
  const ptsParts    = predicciones.reduce((s,p) => s + (p.puntosGanados??0), 0);
  const ptsPregunta = respuesta?.puntosGanados ?? 0;
  const bonusGanador = puntosDelDia?.esGanador ? (puntosDelDia.bonusGanador ?? 2) : 0;

  // Fuente de verdad: puntosDelDia.puntos si existe, calculado si no
  const totalDia = puntosDelDia?.puntos !== undefined && puntosDelDia?.puntos !== null
    ? puntosDelDia.puntos
    : ptsParts + ptsPregunta + bonusGanador;

  return (
    <div style={{ border:"2px solid var(--verde-campo)",marginBottom:"8px",background:"rgba(0,0,0,0.25)" }}>
      <button onClick={() => setAbierto(v => !v)}
        style={{ width:"100%",textAlign:"left",fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
          padding:"8px 10px",background:"var(--verde-oscuro)",border:"none",cursor:"pointer",
          display:"flex",justifyContent:"space-between",alignItems:"center",color:"var(--blanco)" }}>
        <span style={{ color:"var(--verde-claro)" }}>📅 {labelFecha(fecha)}</span>
        <span style={{ color:"var(--amarillo)",fontSize:"8px" }}>
          {totalDia}pts {abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div>
          {predicciones.length > 0 && (
            <div>
              <p style={{ fontSize:"5px",color:"var(--gris-claro)",padding:"4px 8px",
                background:"rgba(0,0,0,0.3)",borderBottom:"1px solid var(--verde-campo)" }}>
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

          {respuesta && (
            <div style={{ padding:"6px 8px",borderBottom:"1px solid rgba(82,183,136,0.2)",
              display:"flex",alignItems:"center",gap:"6px" }}>
              <span style={{ fontSize:"10px" }}>{respuesta.esCorrecta ? "✅" : "❌"}</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:"5px",color:"var(--gris-claro)",lineHeight:1.8 }}>
                  PREGUNTA DEL DÍA
                  {pregunta && <span style={{ color:"var(--blanco)",marginLeft:"4px" }}>
                    — {pregunta.texto?.slice(0,40)}{pregunta.texto?.length>40?"…":""}
                  </span>}
                </p>
                <p style={{ fontSize:"5px",color:"var(--gris-claro)",lineHeight:1.8 }}>
                  Tu respuesta: <span style={{ color:"var(--blanco)" }}>{respuesta.respuesta}</span>
                  {respuesta.esCorrecta === false && pregunta?.respuestaCorrecta &&
                    <span style={{ color:"var(--amarillo)",marginLeft:"4px" }}>
                      (correcta: {pregunta.respuestaCorrecta})
                    </span>
                  }
                </p>
              </div>
              <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
                color:ptsPregunta>0?"var(--verde-claro)":"var(--gris)" }}>
                {ptsPregunta>0?`+${ptsPregunta}`:"0"}
              </span>
            </div>
          )}

          {bonusGanador > 0 && (
            <div style={{ padding:"6px 8px",borderBottom:"1px solid rgba(82,183,136,0.2)",
              display:"flex",alignItems:"center",gap:"6px" }}>
              <span style={{ fontSize:"10px" }}>🏆</span>
              <p style={{ flex:1,fontSize:"5px",color:"var(--amarillo)",lineHeight:1.8 }}>
                BONUS GANADOR DEL DÍA
              </p>
              <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",color:"var(--amarillo)" }}>
                +{bonusGanador}
              </span>
            </div>
          )}

          <div style={{ padding:"6px 10px",background:"rgba(244,208,63,0.08)",
            borderTop:"2px solid var(--verde-campo)",
            display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:"6px",color:"var(--gris-claro)" }}>TOTAL DEL DÍA</span>
            <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"10px",color:"var(--amarillo)" }}>
              {totalDia} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bloque: preguntas del EN VIVO respondidas por el usuario ──
function BloqueEnVivo({ respuestasEnVivo }) {
  const [abierto, setAbierto] = useState(true);
  if (!respuestasEnVivo || respuestasEnVivo.length === 0) return null;

  const totalPts = respuestasEnVivo.reduce((s, r) => s + (r.puntosGanados ?? 0), 0);

  return (
    <div style={{ border:"2px solid var(--rojo-chile)", marginBottom:"8px", background:"rgba(0,0,0,0.25)" }}>
      <button onClick={() => setAbierto(v => !v)}
        style={{ width:"100%", textAlign:"left", fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
          padding:"8px 10px", background:"rgba(214,40,40,0.25)", border:"none", cursor:"pointer",
          display:"flex", justifyContent:"space-between", alignItems:"center", color:"var(--blanco)" }}>
        <span style={{ color:"var(--rojo-chile)" }}>🔴 PREGUNTAS DEL EN VIVO</span>
        <span style={{ color:"var(--amarillo)", fontSize:"8px" }}>
          {totalPts}pts {abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div>
          {respuestasEnVivo.map(r => {
            const pendiente = r.estado !== "cerrada";
            const pts = r.puntosGanados ?? 0;
            return (
              <div key={r.id} style={{ padding:"6px 8px", borderBottom:"1px solid rgba(214,40,40,0.2)",
                display:"flex", gap:"6px", alignItems:"flex-start" }}>
                <span style={{ fontSize:"10px", lineHeight:1, flexShrink:0, marginTop:"1px" }}>
                  {pendiente ? "⏳" : (r.correcta ? "✅" : "❌")}
                </span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:"6px", color:"var(--blanco)", lineHeight:1.8 }}>
                    {r.numero ? `#${r.numero} — ` : ""}{r.texto || "Pregunta del en vivo"}
                  </p>
                  <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:1.8 }}>
                    Tu respuesta: <span style={{ color:"var(--blanco)" }}>{r.respuesta}</span>
                    {!pendiente && r.respuestaCorrecta &&
                      <span style={{ color:"var(--amarillo)", marginLeft:"4px" }}>
                        (correcta: {r.respuestaCorrecta})
                      </span>}
                  </p>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  {pendiente ? (
                    <span style={{ fontSize:"5px", color:"var(--gris)" }}>abierta</span>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"2px" }}>
                      <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                        color:pts>0?"var(--verde-claro)":"var(--rojo-chile)" }}>
                        {pts>0 ? `✅ +${pts}pts` : "❌ Falló"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
const LIMITE_DIAS = 15;

export default function HistorialPredicciones({ userId }) {
  const [dias,     setDias]     = useState([]);
  const [respuestasEnVivo, setRespuestasEnVivo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => { if (userId) cargar(); }, [userId]);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [snapPreds, snapResps, snapPDia, snapEV, snapEventoDoc] = await Promise.all([
        getDocs(query(collection(db,"predicciones"), where("uid","==",userId))),
        getDocs(query(collection(db,"respuestas"),   where("uid","==",userId))),
        getDocs(query(collection(db,"puntosDelDia"), where("uid","==",userId))),
        getDocs(query(collection(db,"eventoEnVivo","actual","respuestas"), where("uid","==",userId))),
        getDoc(doc(db,"eventoEnVivo","actual")),
      ]);

      // ── Preguntas del EN VIVO: cruzar cada respuesta con la
      // pregunta correspondiente (texto, número, estado) guardada
      // en el array `preguntas` del documento del evento.
      const preguntasEvento = snapEventoDoc.exists() ? (snapEventoDoc.data().preguntas || []) : [];
      const respsEV = snapEV.docs
        .map(d => {
          const data = d.data();
          const preg = preguntasEvento.find(p => p.id === data.preguntaId);
          return {
            id: d.id,
            ...data,
            texto: preg?.texto,
            numero: preg?.numero,
            estado: preg?.estado,
            respuestaCorrecta: preg?.respuestaCorrecta,
            // Compatibilidad con respuestas antiguas que no tenían
            // guardado puntosGanados/correcta directamente:
            correcta: data.correcta ?? (preg?.estado === "cerrada" ? data.respuesta === preg?.respuestaCorrecta : undefined),
            puntosGanados: data.puntosGanados ?? (
              preg?.estado === "cerrada"
                ? (data.respuesta === preg?.respuestaCorrecta ? (preg?.puntosEnVivo || 3) : 0)
                : undefined
            ),
          };
        })
        .sort((a,b) => (a.numero ?? 0) - (b.numero ?? 0));
      setRespuestasEnVivo(respsEV);

      const porFecha = {};

      for (const pDoc of snapPreds.docs) {
        const pred = pDoc.data();
        if (!pred.fecha) continue;
        if (!porFecha[pred.fecha]) porFecha[pred.fecha] = { predicciones:[],respuesta:null,pregunta:null,puntosDelDia:null };
        porFecha[pred.fecha].predicciones.push({ predId:pDoc.id, ...pred });
      }
      for (const rDoc of snapResps.docs) {
        const resp = rDoc.data();
        if (!resp.preguntaId) continue;
        const fechaInf = resp.fecha || resp.preguntaId.split("_")[0];
        if (!fechaInf || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInf)) continue;
        if (!porFecha[fechaInf]) porFecha[fechaInf] = { predicciones:[],respuesta:null,pregunta:null,puntosDelDia:null };
        porFecha[fechaInf].respuesta = { respId:rDoc.id, ...resp };
      }
      for (const dDoc of snapPDia.docs) {
        const pd = dDoc.data();
        if (!pd.fecha) continue;
        if (!porFecha[pd.fecha]) porFecha[pd.fecha] = { predicciones:[],respuesta:null,pregunta:null,puntosDelDia:null };
        porFecha[pd.fecha].puntosDelDia = pd;
      }

      const fechas = Object.keys(porFecha).sort((a,b)=>b.localeCompare(a)).slice(0, LIMITE_DIAS);

      const partidoIds  = [...new Set(fechas.flatMap(f => porFecha[f].predicciones.map(p => p.partidoId)))];
      const preguntaIds = [...new Set(fechas.filter(f=>porFecha[f].respuesta).map(f=>porFecha[f].respuesta.preguntaId).filter(Boolean))];

      const [partidosMap, preguntasMap] = await Promise.all([
        traerPorIds("partidos", partidoIds),
        traerPorIds("preguntas", preguntaIds),
      ]);

      for (const fecha of fechas) {
        const d = porFecha[fecha];
        if (d.respuesta?.preguntaId) d.pregunta = preguntasMap[d.respuesta.preguntaId] || null;
        d.predicciones = d.predicciones.filter(p => partidosMap[p.partidoId]?.resultado);
      }

      setDias(fechas
        .filter(f => { const d=porFecha[f]; return d.predicciones.length>0||d.respuesta||d.puntosDelDia; })
        .map(f => ({ fecha:f, ...porFecha[f], partidos:partidosMap }))
      );
    } catch(e) {
      console.error(e); setError("No se pudo cargar el historial.");
    } finally { setCargando(false); }
  };

  if (cargando) return (
    <div style={{ padding:"16px",textAlign:"center" }}>
      <span className="spinner">⚙</span>
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginTop:"6px" }}>Cargando historial...</p>
    </div>
  );
  if (error) return <p style={{ fontSize:"6px",color:"var(--rojo-chile)",padding:"8px" }}>{error}</p>;
  if (dias.length === 0 && respuestasEnVivo.length === 0) return (
    <p style={{ fontSize:"6px",color:"var(--gris-claro)",padding:"12px",textAlign:"center",lineHeight:2 }}>
      Sin historial todavía.
    </p>
  );

  return (
    <div style={{ padding:"8px" }}>
      <BloqueEnVivo respuestasEnVivo={respuestasEnVivo} />

      {dias.length > 0 && (
        <>
          <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginBottom:"8px",lineHeight:1.8 }}>
            Últimos {Math.min(dias.length, LIMITE_DIAS)} días · Clic para desplegar/plegar
          </p>
          {dias.map(d => (
            <BloqueDia key={d.fecha} fecha={d.fecha} predicciones={d.predicciones}
              partidos={d.partidos} respuesta={d.respuesta} pregunta={d.pregunta}
              puntosDelDia={d.puntosDelDia} />
          ))}
        </>
      )}
    </div>
  );
}
