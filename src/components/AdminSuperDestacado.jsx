// src/components/AdminSuperDestacado.jsx  — v1 (Fase 4)
// ─────────────────────────────────────────────────────────────
// Panel de administración de preguntas en vivo (Punto 10).
// • El admin elige un partido Super Destacado.
// • Crea preguntas con texto + opciones.
// • Solo 1 pregunta abierta a la vez.
// • Al cerrar una pregunta: marca respuestaCorrecta, calcula
//   puntos (+3) y actualiza puntosTotal de los usuarios.
// • Retrocompatible: no toca colecciones existentes.
//
// COLECCIONES NUEVAS:
//   preguntasEnVivo/{partidoId}/preguntas/{preguntaId}
//     { texto, opciones, estado:"abierta"|"cerrada", respuestaCorrecta, creadaEn }
//   preguntasEnVivo/{partidoId}/respuestasEnVivo/{uid}_{preguntaId}
//     { uid, preguntaId, respuesta, timestamp }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, where, orderBy,
  doc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  increment, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const PTS_EN_VIVO = 3;

export default function AdminSuperDestacado({ onMensaje }) {
  const [partidos,       setPartidos]       = useState([]);
  const [partidoSel,     setPartidoSel]     = useState(null);
  const [preguntas,      setPreguntas]      = useState([]);
  const [unsubPreguntas, setUnsubPreguntas] = useState(null);

  // Form nueva pregunta
  const [textoNueva,  setTextoNueva]  = useState("");
  const [opcionesNv,  setOpcionesNv]  = useState(["",""]);
  const [creando,     setCreando]     = useState(false);

  // Cerrar pregunta
  const [cerrando,    setCerrando]    = useState(null);

  useEffect(() => {
    cargarPartidos();
    return () => { if (unsubPreguntas) unsubPreguntas(); };
  }, []);

  const cargarPartidos = async () => {
    try {
      const snap = await getDocs(query(
        collection(db,"partidos"),
        where("esSuperDestacado","==",true)
      ));
      setPartidos(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch (_) {}
  };

  const seleccionar = (p) => {
    if (unsubPreguntas) unsubPreguntas();
    setPartidoSel(p);

    // Escuchar preguntas en vivo en tiempo real
    const ref = collection(db,"preguntasEnVivo",p.id,"preguntas");
    const q   = query(ref, orderBy("creadaEn","desc"));
    const unsub = onSnapshot(q, snap => {
      setPreguntas(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
    setUnsubPreguntas(() => unsub);
  };

  const abierta = preguntas.find(p => p.estado === "abierta");

  // ── Crear nueva pregunta ──────────────────────────────────
  const crear = async () => {
    if (!textoNueva.trim() || opcionesNv.filter(o=>o.trim()).length < 2) {
      onMensaje("error","Necesitas texto y al menos 2 opciones.");
      return;
    }
    if (abierta) {
      onMensaje("error","Ya hay una pregunta abierta. Ciérrala primero.");
      return;
    }
    setCreando(true);
    try {
      const pregId = `pev_${Date.now()}`;
      await setDoc(
        doc(db,"preguntasEnVivo",partidoSel.id,"preguntas",pregId),
        {
          texto:            textoNueva.trim(),
          opciones:         opcionesNv.filter(o=>o.trim()),
          estado:           "abierta",
          respuestaCorrecta: null,
          creadaEn:         serverTimestamp(),
          puntosEnVivo:     PTS_EN_VIVO,
        }
      );
      onMensaje("ok","¡Pregunta publicada! Los usuarios ya pueden responder.");
      setTextoNueva(""); setOpcionesNv(["",""]);
    } catch (e) { onMensaje("error",e.message); }
    finally { setCreando(false); }
  };

  // ── Cerrar pregunta y dar puntos ──────────────────────────
  const cerrar = async (pregunta, respCorrecta) => {
    if (!respCorrecta) { onMensaje("error","Selecciona la respuesta correcta."); return; }
    setCerrando(pregunta.id);
    try {
      // 1. Marcar cerrada
      await updateDoc(
        doc(db,"preguntasEnVivo",partidoSel.id,"preguntas",pregunta.id),
        { estado:"cerrada", respuestaCorrecta: respCorrecta }
      );

      // 2. Leer todas las respuestas
      const snapR = await getDocs(
        collection(db,"preguntasEnVivo",partidoSel.id,"respuestasEnVivo")
      );
      const respuestasDe = snapR.docs
        .map(d => d.data())
        .filter(r => r.preguntaId === pregunta.id);

      let acertaron = 0;
      for (const r of respuestasDe) {
        if (r.respuesta === respCorrecta) {
          // +3 pts al usuario
          await updateDoc(doc(db,"usuarios",r.uid), {
            puntosTotal: increment(PTS_EN_VIVO),
          });
          acertaron++;
        }
      }

      onMensaje("ok",`Pregunta cerrada. ${acertaron} usuario(s) acertaron → +${PTS_EN_VIVO} pts c/u.`);
    } catch (e) { onMensaje("error",e.message); }
    finally { setCerrando(null); }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"12px",lineHeight:2 }}>
        🔴 PREGUNTAS EN VIVO
      </p>
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"12px",lineHeight:2 }}>
        Solo los partidos marcados como <code>esSuperDestacado: true</code> en Firestore
        aparecen aquí. Las preguntas se muestran a los usuarios en tiempo real.
      </p>

      {/* Selector de partido */}
      {partidos.length === 0 ? (
        <div style={{ padding:"16px",border:"2px solid var(--gris)",textAlign:"center" }}>
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
            No hay partidos super destacados.<br/>
            En Firestore, agrega el campo <code>esSuperDestacado: true</code>
            al documento del partido.
          </p>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:"4px",marginBottom:"14px" }}>
          {partidos.map(p => (
            <button key={p.id}
              onClick={() => seleccionar(p)}
              style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                padding:"8px 10px",cursor:"pointer",textAlign:"left",
                border:`2px solid ${partidoSel?.id===p.id?"var(--rojo-chile)":"var(--gris)"}`,
                background:partidoSel?.id===p.id?"rgba(214,40,40,0.1)":"var(--negro)",
                color:"var(--blanco)" }}>
              🔴 {p.local?.bandera} {p.local?.nombre} vs {p.visitante?.nombre} {p.visitante?.bandera}
              <span style={{ color:"var(--gris-claro)",marginLeft:"8px" }}>({p.fecha})</span>
            </button>
          ))}
        </div>
      )}

      {partidoSel && (
        <>
          {/* Pregunta activa */}
          {abierta && (
            <PreguntaAbierta
              pregunta={abierta}
              onCerrar={(resp) => cerrar(abierta, resp)}
              cerrando={cerrando === abierta.id}
            />
          )}

          {/* Crear nueva */}
          {!abierta && (
            <div className="caja-pixel" style={{ borderColor:"var(--rojo-chile)",marginBottom:"14px" }}>
              <p style={{ fontSize:"7px",color:"var(--rojo-chile)",marginBottom:"10px" }}>
                CREAR PREGUNTA EN VIVO
              </p>
              <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"4px" }}>PREGUNTA</p>
              <textarea value={textoNueva} onChange={e=>setTextoNueva(e.target.value)} rows={2}
                placeholder="Ej: ¿Habrá gol en los próximos 10 minutos?"
                style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                  width:"100%",padding:"8px",border:"3px solid var(--negro)",
                  background:"var(--blanco)",color:"var(--negro)",
                  outline:"none",resize:"none",lineHeight:2,marginBottom:"10px" }} />

              <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"6px" }}>OPCIONES</p>
              <div style={{ display:"flex",flexDirection:"column",gap:"5px",marginBottom:"10px" }}>
                {opcionesNv.map((op,i) => (
                  <div key={i} style={{ display:"flex",gap:"6px" }}>
                    <input value={op} onChange={e=>setOpcionesNv(prev=>prev.map((o,idx)=>idx===i?e.target.value:o))}
                      placeholder={`Opción ${i+1}`}
                      style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                        flex:1,padding:"5px 8px",border:"2px solid var(--negro)",
                        background:"var(--blanco)",color:"var(--negro)",outline:"none" }} />
                    {opcionesNv.length>2 && (
                      <button onClick={()=>setOpcionesNv(prev=>prev.filter((_,idx)=>idx!==i))}
                        style={{ background:"var(--rojo-chile)",color:"var(--blanco)",
                          border:"none",cursor:"pointer",padding:"4px 8px",
                          fontFamily:"'Press Start 2P',monospace",fontSize:"8px" }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              {opcionesNv.length < 5 && (
                <button className="btn-pixel btn-gris w-full"
                  style={{ fontSize:"6px",marginBottom:"10px" }}
                  onClick={()=>setOpcionesNv(prev=>[...prev,""])}>
                  + AGREGAR OPCIÓN
                </button>
              )}
              <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
                onClick={crear} disabled={creando}>
                {creando?"⚙ PUBLICANDO...":"🔴 PUBLICAR PREGUNTA EN VIVO"}
              </button>
            </div>
          )}

          {/* Historial de preguntas cerradas */}
          {preguntas.filter(p=>p.estado==="cerrada").length > 0 && (
            <div>
              <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"8px" }}>
                HISTORIAL DE PREGUNTAS
              </p>
              {preguntas.filter(p=>p.estado==="cerrada").map(pq => (
                <div key={pq.id} style={{ padding:"8px",border:"1px solid var(--verde-campo)",
                  marginBottom:"4px",fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                  <p style={{ color:"var(--blanco)" }}>{pq.texto}</p>
                  <p>✅ Correcta: <span style={{ color:"var(--verde-claro)" }}>{pq.respuestaCorrecta}</span></p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PreguntaAbierta({ pregunta, onCerrar, cerrando }) {
  const [respSel, setRespSel] = useState("");

  return (
    <div className="caja-pixel" style={{ borderColor:"var(--rojo-chile)",marginBottom:"14px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px" }}>
        <p style={{ fontSize:"7px",color:"var(--rojo-chile)" }}>🔴 PREGUNTA ACTIVA</p>
        <span style={{ fontSize:"6px",color:"var(--amarillo)",
          border:"1px solid var(--amarillo)",padding:"2px 6px" }}>
          USUARIOS RESPONDIENDO...
        </span>
      </div>
      <p style={{ fontSize:"8px",color:"var(--blanco)",lineHeight:2,marginBottom:"12px" }}>
        {pregunta.texto}
      </p>
      <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"8px" }}>
        MARCAR RESPUESTA CORRECTA:
      </p>
      <div style={{ display:"flex",flexDirection:"column",gap:"6px",marginBottom:"12px" }}>
        {(pregunta.opciones||[]).map((op,i) => (
          <button key={i}
            className={`pred-btn ${respSel===op?"seleccionado":""}`}
            onClick={()=>setRespSel(op)}
            style={{ fontSize:"7px",padding:"8px" }}>
            {op}
          </button>
        ))}
      </div>
      <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
        onClick={()=>onCerrar(respSel)} disabled={!respSel||cerrando}>
        {cerrando?"⚙ CERRANDO...":"🔒 CERRAR Y DAR PUNTOS"}
      </button>
    </div>
  );
}
