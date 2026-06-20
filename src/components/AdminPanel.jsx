// src/components/AdminPanel.jsx  — v7 (Patch 1)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v7:
//   Punto 4: Crear pregunta libre desde el panel (sin depender
//             del BANCO_PREGUNTAS). Opciones dinámicas (2-5).
//             Lista de preguntas viene de Firestore, no del banco.
//   Punto 5: "ENTREGAR CARTAS Y BONUS" bloqueado si la pregunta
//             del día tiene respuestaCorrecta === null.
//   Sonido diario: campo en config/sonidoDia → archivo MP3/OGG
//             que TabPartidos reproduce automáticamente.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, doc,
  updateDoc, where, setDoc, deleteDoc, getDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  procesarResultadoPartido, calcularGanadorDelDia,
  procesarPreguntaDelDia, publicarAvisoAdmin, cerrarAvisoAdmin,
} from "../utils/helpers";
import { FASES_ELIMINATORIAS, FASE_LABELS } from "../data/sampleData";

const ADMIN_EMAILS = ["xtokesu@gmail.com"];

export default function AdminPanel({ onVolver }) {
  const { firebaseUser } = useAuth();
  const [verificando, setVerificando] = React.useState(true);
  const [esAdmin,     setEsAdmin]     = React.useState(false);

  React.useEffect(() => {
    // firebaseUser empieza como null (Firebase Auth es async).
    // Esperamos a que AuthContext resuelva antes de decidir.
    if (firebaseUser === null) {
      // Damos 3 segundos por si todavía está cargando
      const t = setTimeout(() => setVerificando(false), 3000);
      return () => clearTimeout(t);
    }
    // firebaseUser ya llegó (puede ser usuario real o seguir null tras timeout)
    setEsAdmin(ADMIN_EMAILS.includes(firebaseUser.email));
    setVerificando(false);
  }, [firebaseUser]);

  if (verificando) {
    return (
      <div style={{ padding:"40px",textAlign:"center" }}>
        <span className="spinner" style={{ fontSize:"20px" }}>⚙</span>
        <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
          color:"var(--verde-claro)",marginTop:"12px" }}>
          Verificando acceso...
        </p>
      </div>
    );
  }
  if (!esAdmin) {
    return (
      <div style={{ padding:"20px",textAlign:"center" }}>
        <p style={{ color:"var(--rojo-chile)",fontSize:"8px" }}>🔒 ACCESO DENEGADO</p>
        <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
          color:"var(--gris-claro)",marginTop:"8px",lineHeight:2 }}>
          {firebaseUser?.email || "No autenticado"}
        </p>
        <button className="btn-pixel btn-gris" onClick={onVolver} style={{ marginTop:"16px" }}>
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
  const [preguntas, setPreguntas] = useState([]); // preguntas de Firestore
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje]   = useState(null);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const snapP = await getDocs(query(collection(db,"partidos"), orderBy("fecha")));
      setPartidos(snapP.docs.map(d => ({ id:d.id, ...d.data() })));
      // Cargar TODAS las preguntas de Firestore (banco + nuevas)
      const snapQ = await getDocs(query(collection(db,"preguntas"), orderBy("fecha","desc")));
      setPreguntas(snapQ.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  const msg = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 9000);
  };

  const TABS = [
    { id:"partidos",  label:"⚽ PARTIDOS" },
    { id:"preguntas", label:"❓ PREGUNTAS" },
    { id:"cartas",    label:"🃏 CARTAS Y BONUS" },
    { id:"aviso",     label:"📢 AVISO" },
    { id:"mensajes",  label:"💬 MENSAJES" },
    { id:"sonido",    label:"🎵 SONIDO" },
  ];

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px" }}>
        <button className="btn-pixel btn-gris" onClick={onVolver}
          style={{ fontSize:"7px",padding:"6px 10px" }}>← VOLVER</button>
        <h2 style={{ color:"var(--rojo-chile)",fontSize:"9px" }}>⚙ PANEL ADMIN</h2>
      </div>

      {mensaje && (
        <div style={{
          padding:"10px 14px",marginBottom:"14px",fontSize:"7px",lineHeight:2,
          border:`2px solid ${mensaje.tipo==="ok"?"var(--verde-claro)":"var(--rojo-chile)"}`,
          color:  mensaje.tipo==="ok"?"var(--verde-claro)":"var(--rojo-chile)",
          background: mensaje.tipo==="ok"?"rgba(82,183,136,0.1)":"rgba(214,40,40,0.1)",
        }}>
          {mensaje.tipo==="ok"?"✅":"❌"} {mensaje.texto}
        </div>
      )}

      <div style={{ display:"flex",gap:"4px",marginBottom:"14px",flexWrap:"wrap" }}>
        {TABS.map(t => (
          <button key={t.id}
            className={`btn-pixel ${tab===t.id?"btn-amarillo":"btn-gris"}`}
            style={{ fontSize:"5px",padding:"5px 8px",flex:"1 0 auto" }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ textAlign:"center",padding:"30px",fontSize:"7px",color:"var(--verde-claro)" }}>
          <span className="spinner">⚙</span><br/><br/>CARGANDO...
        </div>
      ) : (
        <>
          {tab==="partidos"  && <TabPartidosAdmin partidos={partidos} onActualizar={cargarDatos} onMensaje={msg} />}
          {tab==="preguntas" && <TabPreguntasAdmin preguntas={preguntas} onActualizar={cargarDatos} onMensaje={msg} />}
          {tab==="cartas"    && <TabCartasBonus preguntas={preguntas} onMensaje={msg} />}
          {tab==="aviso"     && <TabAviso onMensaje={msg} />}
          {tab==="mensajes"  && <TabMensajes onMensaje={msg} />}
          {tab==="sonido"    && <TabSonido onMensaje={msg} />}
        </>
      )}
    </div>
  );
}

// ── Tab Partidos ──────────────────────────────────────────────
function TabPartidosAdmin({ partidos, onActualizar, onMensaje }) {
  const [sel, setSel]         = useState(null);
  const [procesando, setProc] = useState(false);
  const [gl, setGl] = useState(""); const [gv, setGv] = useState("");
  const [def, setDef] = useState("normal");
  const [glA, setGlA] = useState(""); const [gvA, setGvA] = useState("");
  const [pL, setPL] = useState(""); const [pV, setPV] = useState("");
  const [ganFin, setGanFin] = useState("");

  const seleccionar = p => {
    setSel(p);
    const r = p.resultado;
    if (r) {
      setGl(String(r.golesLocal??"")); setGv(String(r.golesVisitante??""));
      setDef(r.definicion||"normal");
      setGlA(String(r.golesLocalAlargue??"")); setGvA(String(r.golesVisitanteAlargue??""));
      setPL(String(r.penalesLocal??"")); setPV(String(r.penalesVisitante??""));
      setGanFin(r.ganadorFinal||"");
    } else {
      setGl(""); setGv(""); setDef("normal"); setGlA(""); setGvA(""); setPL(""); setPV(""); setGanFin("");
    }
  };

  const esElim = sel && FASES_ELIMINATORIAS.includes(sel.fase);

  const guardar = async () => {
    if (!sel || gl==="" || gv==="") { onMensaje("error","Ingresa los goles de 90 min."); return; }
    setProc(true);
    try {
      const resultado = { golesLocal:Number(gl), golesVisitante:Number(gv), definicion:esElim?def:"normal" };
      if (esElim && def!=="normal") {
        resultado.golesLocalAlargue = Number(glA||0); resultado.golesVisitanteAlargue = Number(gvA||0);
        if (def==="penales") { resultado.penalesLocal=Number(pL); resultado.penalesVisitante=Number(pV); }
        resultado.ganadorFinal = ganFin;
      } else if (!esElim) {
        const glN=Number(gl),gvN=Number(gv);
        resultado.ganadorFinal = glN>gvN?"local":gvN>glN?"visitante":"empate";
      }
      await updateDoc(doc(db,"partidos",sel.id), { resultado });
      const { procesados, errores } = await procesarResultadoPartido(
        sel.id, resultado, sel.fase||"grupos", sel.estaDestacado||false, sel.fecha
      );
      const era = sel.resultado!==null&&sel.resultado!==undefined;
      onMensaje("ok", era
        ? `Resultado ACTUALIZADO. ${procesados} predicciones recalculadas.${errores>0?` (${errores} errores)`:""}`
        : `Resultado guardado. ${procesados} predicciones procesadas. Puntos sumados automáticamente.`
      );
      onActualizar(); setSel(null);
    } catch(e) { onMensaje("error",e.message); }
    finally { setProc(false); }
  };

  const inputNum = (val, setVal) => (
    <input type="number" min="0" max="20" value={val} onChange={e=>setVal(e.target.value)} placeholder="0"
      style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"14px",
        width:"50px",height:"50px",textAlign:"center",
        border:"3px solid var(--negro)",background:"var(--blanco)",color:"var(--negro)",outline:"none" }} />
  );

  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"10px",lineHeight:2 }}>
        Selecciona un partido e ingresa el resultado. Los puntos se calculan inmediatamente.
      </p>
      <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
        {partidos.map(p => (
          <React.Fragment key={p.id}>
            <button onClick={() => sel?.id===p.id ? setSel(null) : seleccionar(p)}
              style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",padding:"10px 12px",
                border:`2px solid ${sel?.id===p.id?"var(--amarillo)":p.resultado?"var(--verde-campo)":"var(--gris)"}`,
                background:sel?.id===p.id?"rgba(244,208,63,0.1)":"var(--negro)",
                color:"var(--blanco)",cursor:"pointer",textAlign:"left",
                display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span>
                {p.local?.bandera} vs {p.visitante?.bandera}{" "}
                <span style={{ color:"var(--gris-claro)" }}>({p.fecha})</span>
                {p.fase&&p.fase!=="grupos"&&(
                  <span style={{ color:"var(--rojo-chile)",marginLeft:"4px" }}>
                    [{FASE_LABELS[p.fase]||p.fase}]
                  </span>
                )}
              </span>
              {p.resultado
                ? <span style={{ color:"var(--verde-claro)" }}>{p.resultado.golesLocal}-{p.resultado.golesVisitante} ✓</span>
                : <span style={{ color:"var(--gris)" }}>Pendiente</span>
              }
            </button>

            {sel?.id===p.id && (
              <div className="caja-pixel" style={{ borderColor:"var(--amarillo)",marginBottom:"6px" }}>
                <p style={{ fontSize:"8px",color:"var(--amarillo)",marginBottom:"12px" }}>
                  {p.local?.bandera} {p.local?.nombre} vs {p.visitante?.nombre} {p.visitante?.bandera}
                </p>
                {p.resultado && (
                  <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"10px",lineHeight:2 }}>
                    ⚠ Ya tiene resultado. Guardar de nuevo RECALCULARÁ los puntos.
                  </p>
                )}
                <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>GOLES 90 MIN</p>
                <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px" }}>
                  {inputNum(gl,setGl)}<span style={{ fontSize:"18px",color:"var(--amarillo)" }}>-</span>{inputNum(gv,setGv)}
                </div>
                {esElim && (
                  <>
                    <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿CÓMO SE DEFINIÓ?</p>
                    <div style={{ display:"flex",gap:"6px",marginBottom:"10px" }}>
                      {["normal","alargue","penales"].map(d => (
                        <button key={d} className={`pred-btn ${def===d?"seleccionado":""}`}
                          onClick={() => setDef(d)} style={{ flex:1,fontSize:"6px" }}>
                          {d==="normal"?"90MIN":d.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {(def==="alargue"||def==="penales") && (
                      <>
                        <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>GOLES EN ALARGUE</p>
                        <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px" }}>
                          {inputNum(glA,setGlA)}<span style={{ color:"var(--amarillo)" }}>-</span>{inputNum(gvA,setGvA)}
                        </div>
                      </>
                    )}
                    {def==="penales" && (
                      <>
                        <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>TANDA DE PENALES</p>
                        <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px" }}>
                          {inputNum(pL,setPL)}<span style={{ color:"var(--amarillo)" }}>-</span>{inputNum(pV,setPV)}
                        </div>
                      </>
                    )}
                    {def!=="normal" && (
                      <>
                        <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px" }}>¿QUIÉN GANÓ?</p>
                        <div style={{ display:"flex",gap:"8px",marginBottom:"10px" }}>
                          {["local","visitante"].map(g => (
                            <button key={g} className={`pred-btn ${ganFin===g?"seleccionado":""}`}
                              onClick={() => setGanFin(g)} style={{ flex:1,fontSize:"6px" }}>
                              {g==="local"?`${p.local?.bandera} ${p.local?.nombre}`:`${p.visitante?.bandera} ${p.visitante?.nombre}`}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                <button className="btn-pixel btn-rojo w-full" style={{ marginTop:"8px",fontSize:"7px" }}
                  onClick={guardar} disabled={procesando}>
                  {procesando?"⚙ PROCESANDO...":"⚡ GUARDAR Y CALCULAR PUNTOS"}
                </button>
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
  const [modo, setModo] = useState("marcar"); // "marcar" | "crear"
  const [pregSel, setPregSel]   = useState(null);
  const [respCorrecta, setResp] = useState("");
  const [procesando, setProc]   = useState(false);
  const [fechaNueva, setFechaNueva] = useState(new Date().toISOString().split("T")[0]);

  // Formulario para crear pregunta nueva
  const [textoNueva, setTextoNueva]   = useState("");
  const [opcionesNueva, setOpcionesN] = useState(["",""]);
  const [creando, setCreando]         = useState(false);

  const agregarOpcion = () => {
    if (opcionesNueva.length < 5) setOpcionesN(prev => [...prev, ""]);
  };
  const quitarOpcion = (i) => {
    if (opcionesNueva.length > 2) setOpcionesN(prev => prev.filter((_,idx) => idx!==i));
  };
  const cambiarOpcion = (i, val) => {
    setOpcionesN(prev => prev.map((o,idx) => idx===i ? val : o));
  };

  const crearPregunta = async () => {
    const textOk  = textoNueva.trim().length >= 5;
    const optsOk  = opcionesNueva.filter(o => o.trim().length > 0).length >= 2;
    if (!textOk || !optsOk) {
      onMensaje("error","La pregunta necesita texto (mín 5 chars) y al menos 2 opciones.");
      return;
    }
    setCreando(true);
    try {
      const id = `${fechaNueva}_custom_${Date.now()}`;
      await setDoc(doc(db,"preguntas",id), {
        id,
        fecha:            fechaNueva,
        texto:            textoNueva.trim(),
        opciones:         opcionesNueva.filter(o => o.trim().length > 0),
        respuestaCorrecta: null,
      });
      onMensaje("ok",`Pregunta creada y publicada para el ${fechaNueva}.`);
      setTextoNueva(""); setOpcionesN(["",""]); setModo("marcar");
      onActualizar();
    } catch(e) { onMensaje("error",e.message); }
    finally { setCreando(false); }
  };

  const procesar = async () => {
    if (!pregSel || !respCorrecta) return;
    setProc(true);
    try {
      await updateDoc(doc(db,"preguntas",pregSel.id), { respuestaCorrecta: respCorrecta });
      const res = await procesarPreguntaDelDia(pregSel.id, respCorrecta, pregSel.fecha);
      if (res.ok) {
        const era = !!pregSel.respuestaCorrecta;
        onMensaje("ok", era
          ? `Respuesta ACTUALIZADA a "${respCorrecta}". ${res.procesados} usuarios correctos.`
          : `Respuesta marcada: "${respCorrecta}". ${res.procesados} usuarios acertaron → +2 pts c/u.`
        );
      } else { onMensaje("error",`Error: ${res.error}`); }
      onActualizar(); setPregSel(null);
    } catch(e) { onMensaje("error",e.message); }
    finally { setProc(false); }
  };

  return (
    <div>
      {/* Selector de modo */}
      <div style={{ display:"flex",gap:"6px",marginBottom:"14px" }}>
        {[
          {id:"marcar",label:"✅ MARCAR RESPUESTA"},
          {id:"crear", label:"✏ CREAR NUEVA"},
        ].map(m => (
          <button key={m.id}
            className={`btn-pixel ${modo===m.id?"btn-amarillo":"btn-gris"}`}
            style={{ flex:1,fontSize:"6px" }}
            onClick={() => setModo(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Crear pregunta nueva ─────────────────────────── */}
      {modo === "crear" && (
        <div className="caja-pixel" style={{ borderColor:"var(--amarillo)" }}>
          <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"12px" }}>
            CREAR NUEVA PREGUNTA
          </p>

          <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"4px" }}>FECHA DE PUBLICACIÓN</p>
          <input type="date" value={fechaNueva} onChange={e => setFechaNueva(e.target.value)}
            style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
              padding:"6px 10px",border:"3px solid var(--negro)",
              background:"var(--blanco)",color:"var(--negro)",width:"100%",
              marginBottom:"12px",outline:"none" }} />

          <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"4px" }}>TEXTO DE LA PREGUNTA</p>
          <textarea value={textoNueva} onChange={e => setTextoNueva(e.target.value)}
            placeholder="Escribe la pregunta aquí..." rows={3}
            style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
              width:"100%",padding:"8px",border:"3px solid var(--negro)",
              background:"var(--blanco)",color:"var(--negro)",
              outline:"none",resize:"vertical",lineHeight:2,marginBottom:"12px" }} />

          <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"6px" }}>
            OPCIONES DE RESPUESTA ({opcionesNueva.length}/5)
          </p>
          <div style={{ display:"flex",flexDirection:"column",gap:"6px",marginBottom:"10px" }}>
            {opcionesNueva.map((op, i) => (
              <div key={i} style={{ display:"flex",gap:"6px",alignItems:"center" }}>
                <input value={op} onChange={e => cambiarOpcion(i, e.target.value)}
                  placeholder={`Opción ${i+1}`}
                  style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                    flex:1,padding:"6px 8px",border:"2px solid var(--negro)",
                    background:"var(--blanco)",color:"var(--negro)",outline:"none" }} />
                {opcionesNueva.length > 2 && (
                  <button onClick={() => quitarOpcion(i)}
                    style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
                      background:"var(--rojo-chile)",color:"var(--blanco)",
                      border:"none",cursor:"pointer",padding:"4px 8px" }}>✕</button>
                )}
              </div>
            ))}
          </div>

          {opcionesNueva.length < 5 && (
            <button className="btn-pixel btn-gris w-full" style={{ fontSize:"6px",marginBottom:"12px" }}
              onClick={agregarOpcion}>
              + AGREGAR OPCIÓN
            </button>
          )}

          <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
            onClick={crearPregunta} disabled={creando}>
            {creando ? "⚙ GUARDANDO..." : "⚡ CREAR Y PUBLICAR EN FIRESTORE"}
          </button>
          <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginTop:"8px",lineHeight:2 }}>
            La pregunta se guardará en Firestore con respuestaCorrecta: null.
            Cuando termine el día, ve a "MARCAR RESPUESTA" para procesarla.
          </p>
        </div>
      )}

      {/* ── Marcar respuesta correcta ────────────────────── */}
      {modo === "marcar" && (
        <>
          <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"8px" }}>
            MARCAR RESPUESTA CORRECTA
          </p>
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"10px",lineHeight:2 }}>
            Si ya marcaste una respuesta antes, volver a guardar RECALCULA los puntos.
          </p>
          <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
            {preguntas.map(p => (
              <React.Fragment key={p.id}>
                <button
                  onClick={() => pregSel?.id===p.id ? setPregSel(null) : (setPregSel(p), setResp(p.respuestaCorrecta||""))}
                  style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                    padding:"8px 10px",
                    border:`2px solid ${pregSel?.id===p.id?"var(--amarillo)":p.respuestaCorrecta?"var(--verde-campo)":"var(--gris)"}`,
                    background:pregSel?.id===p.id?"rgba(244,208,63,0.1)":"var(--negro)",
                    color:"var(--blanco)",cursor:"pointer",textAlign:"left",lineHeight:2 }}>
                  <div>{p.fecha} — {p.texto?.slice(0,50)}{p.texto?.length>50?"...":""}</div>
                  {p.respuestaCorrecta && (
                    <span style={{ color:"var(--verde-claro)" }}>✓ {p.respuestaCorrecta}</span>
                  )}
                </button>

                {pregSel?.id===p.id && (
                  <div className="caja-pixel" style={{ borderColor:"var(--amarillo)",marginBottom:"6px" }}>
                    <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"10px",lineHeight:2 }}>
                      {p.texto}
                    </p>
                    {p.respuestaCorrecta && (
                      <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"8px",lineHeight:2 }}>
                        ⚠ Respuesta anterior: "{p.respuestaCorrecta}". Cambiarla recalculará los puntos.
                      </p>
                    )}
                    <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"8px" }}>RESPUESTA CORRECTA:</p>
                    <div style={{ display:"flex",flexDirection:"column",gap:"6px",marginBottom:"12px" }}>
                      {(p.opciones||[]).map((op,i) => (
                        <button key={i}
                          className={`pred-btn ${respCorrecta===op?"seleccionado":""}`}
                          onClick={() => setResp(op)} style={{ fontSize:"7px",padding:"8px" }}>
                          {op}
                        </button>
                      ))}
                    </div>
                    <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
                      onClick={procesar} disabled={!respCorrecta||procesando}>
                      {procesando?"⚙ PROCESANDO...":"⚡ MARCAR CORRECTA Y DAR PUNTOS"}
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
            {preguntas.length===0 && (
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
                No hay preguntas en Firestore todavía.<br/>Usa "CREAR NUEVA" para añadir una.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab Cartas y Bonus ────────────────────────────────────────
// Punto 5: bloquea si hay pregunta del día sin respuestaCorrecta
function TabCartasBonus({ preguntas, onMensaje }) {
  const [fecha, setFecha]       = useState(new Date().toISOString().split("T")[0]);
  const [procesando, setProc]   = useState(false);
  const [resultado, setResultado] = useState(null);

  // Verificar si la pregunta de esa fecha está pendiente
  const preguntaDelDia   = preguntas.find(p => p.fecha === fecha);
  const preguntaPendiente = preguntaDelDia && preguntaDelDia.respuestaCorrecta === null;

  const entregar = async () => {
    if (preguntaPendiente) return;
    setProc(true); setResultado(null);
    try {
      const res = await calcularGanadorDelDia(fecha);
      if (res.ok) {
        setResultado(res);
        onMensaje("ok",
          `✅ Cartas y bonus entregados para el ${fecha}. ` +
          `Ganador(es): ${res.ganador}. +2 pts bonus al 1° lugar.`
        );
        await setDoc(doc(db, "config", "ultimaActualizacion"), {
        fecha: new Date().toISOString(),
      });
      } else if (res.yaEntregado) {
        onMensaje("error", res.mensaje);
      } else {
        onMensaje("error", res.mensaje || res.error || "Error al procesar.");
      }
    } catch(e) { onMensaje("error",e.message); }
    finally { setProc(false); }
  };

  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"14px",lineHeight:2 }}>
        Entrega el <span style={{ color:"var(--verde-claro)" }}>bonus diario (+2 pts)</span> al
        ganador del día y las cartas al podio (×4, ×3, ×2).
      </p>
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"14px",lineHeight:2 }}>
        ℹ Los puntos de partidos y pregunta ya se sumaron al guardar cada resultado.
        Este botón <strong style={{ color:"var(--blanco)" }}>solo entrega el bonus y las cartas</strong>.
        No se puede ejecutar más de una vez por día.
      </p>

      <div className="caja-pixel" style={{ borderColor:"var(--rojo-chile)" }}>
        <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"8px" }}>FECHA DE LA JORNADA</p>
        <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setResultado(null); }}
          style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"9px",
            padding:"8px 12px",border:"3px solid var(--negro)",
            background:"var(--blanco)",color:"var(--negro)",width:"100%",
            marginBottom:"14px",outline:"none" }} />

        {/* Aviso de bloqueo */}
        {preguntaPendiente && (
          <div style={{ padding:"10px",marginBottom:"12px",
            border:"2px solid var(--rojo-chile)",background:"rgba(214,40,40,0.1)" }}>
            <p style={{ fontSize:"6px",color:"var(--rojo-chile)",lineHeight:2 }}>
              🔒 <strong>BLOQUEADO:</strong> Hay una pregunta del día para {fecha} sin respuesta correcta marcada.
              Ve a la pestaña ❓ PREGUNTAS y marca la respuesta antes de continuar.
            </p>
            {preguntaDelDia && (
              <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginTop:"4px",lineHeight:2 }}>
                Pregunta pendiente: "{preguntaDelDia.texto?.slice(0,60)}..."
              </p>
            )}
          </div>
        )}

        <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
          onClick={entregar}
          disabled={procesando || preguntaPendiente}>
          {procesando
            ? "⚙ PROCESANDO..."
            : preguntaPendiente
              ? "🔒 BLOQUEADO — MARCA LA PREGUNTA PRIMERO"
              : "🃏 ENTREGAR CARTAS Y BONUS"
          }
        </button>

        {resultado && (
          <div style={{ marginTop:"12px",fontSize:"6px",color:"var(--verde-claro)",lineHeight:2.2 }}>
            <p>🥇 1°: {resultado.lugar1?.join(", ")||"—"} → carta ×4 + bonus +2 pts</p>
            <p>🥈 2°: {resultado.lugar2?.join(", ")||"—"} → carta ×3</p>
            <p>🥉 3°: {resultado.lugar3?.join(", ")||"—"} → carta ×2</p>
            <p style={{ color:"var(--gris-claro)",marginTop:"4px" }}>
              Total participantes: {resultado.totalJugadores}
            </p>
          </div>
        )}

        <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginTop:"10px",lineHeight:2 }}>
          ⚠ Ejecutar UNA SOLA VEZ por jornada, después de ingresar TODOS los resultados.
        </p>
      </div>
    </div>
  );
}

// ── Tab Aviso ─────────────────────────────────────────────────
function TabAviso({ onMensaje }) {
  const [texto,    setTexto]   = useState("");
  const [tipo,     setTipo]    = useState("unaVez");
  const [enviando, setEnv]     = useState(false);
  const [cerrando, setCerr]    = useState(false);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnv(true);
    try {
      await setDoc(doc(db,"config","avisoAdmin"), {
        texto:texto.trim(), tipo, fecha:new Date().toISOString(), activo:true,
      });
      onMensaje("ok", tipo==="permanente"
        ? "Aviso PERMANENTE publicado. Aparecerá en cada sesión."
        : "Aviso publicado. Cada usuario lo verá una vez.");
      setTexto("");
    } catch(e) { onMensaje("error",e.message); }
    finally { setEnv(false); }
  };

  const desactivar = async () => {
    setCerr(true);
    try { await cerrarAvisoAdmin(); onMensaje("ok","Aviso desactivado."); }
    catch(e) { onMensaje("error",e.message); }
    finally { setCerr(false); }
  };

  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"12px",lineHeight:2 }}>
        Mensaje para todos los participantes.
      </p>
      <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"6px" }}>TIPO:</p>
      <div style={{ display:"flex",gap:"6px",marginBottom:"12px" }}>
        {[
          {val:"unaVez",label:"📌 UNA SOLA VEZ"},
          {val:"permanente",label:"🔒 PERMANENTE"},
        ].map(t => (
          <button key={t.val}
            className={`pred-btn ${tipo===t.val?"seleccionado":""}`}
            style={{ flex:1,fontSize:"6px" }} onClick={() => setTipo(t.val)}>
            {t.label}
          </button>
        ))}
      </div>
      <textarea value={texto} onChange={e => setTexto(e.target.value)}
        placeholder="Escribe el mensaje..." rows={5}
        style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
          width:"100%",padding:"10px 12px",border:"3px solid var(--negro)",
          background:"var(--blanco)",color:"var(--negro)",
          outline:"none",resize:"vertical",lineHeight:2,marginBottom:"12px" }} />
      <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px",marginBottom:"8px" }}
        onClick={enviar} disabled={enviando||!texto.trim()}>
        {enviando?"⚙ ENVIANDO...":"📢 PUBLICAR AVISO"}
      </button>
      <button className="btn-pixel btn-gris w-full" style={{ fontSize:"7px" }}
        onClick={desactivar} disabled={cerrando}>
        {cerrando?"⚙ ...":"🔕 DESACTIVAR AVISO ACTUAL"}
      </button>
    </div>
  );
}

// ── Tab Mensajes ──────────────────────────────────────────────
function TabMensajes({ onMensaje }) {
  const [mensajes, setMensajes]     = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [eliminando, setEliminando] = useState(null);
  const [limpiando, setLimpiando]   = useState(false);
  const LIMITE = 500;

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const snap = await getDocs(query(collection(db,"mensajesDia"), orderBy("timestamp","desc")));
      setMensajes(snap.docs.map(d => ({ docId:d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  const eliminarUno = async (docId) => {
    setEliminando(docId);
    try {
      await deleteDoc(doc(db,"mensajesDia",docId));
      setMensajes(prev => prev.filter(m => m.docId!==docId));
      onMensaje("ok","Mensaje eliminado.");
    } catch(e) { onMensaje("error",e.message); }
    finally { setEliminando(null); }
  };

  const limpiarTodo = async () => {
    if (!window.confirm("¿Eliminar TODOS los mensajes?")) return;
    setLimpiando(true);
    try {
      const snap = await getDocs(collection(db,"mensajesDia"));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db,"mensajesDia",d.id))));
      setMensajes([]);
      onMensaje("ok",`${snap.docs.length} mensajes eliminados.`);
    } catch(e) { onMensaje("error",e.message); }
    finally { setLimpiando(false); }
  };

  const total   = mensajes.length;
  const supera  = total >= LIMITE;

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px" }}>
        <p style={{ fontSize:"7px",color:"var(--amarillo)" }}>📢 LA VOZ DE LA HINCHADA</p>
        <span style={{ fontSize:"6px",padding:"3px 8px",
          border:`2px solid ${supera?"var(--rojo-chile)":"var(--verde-campo)"}`,
          color:supera?"var(--rojo-chile)":"var(--gris-claro)" }}>
          {total}/{LIMITE}
        </span>
      </div>
      {supera && (
        <p style={{ fontSize:"6px",color:"var(--rojo-chile)",marginBottom:"10px",lineHeight:2 }}>
          ⚠ Límite recomendado superado. Considera limpiar.
        </p>
      )}
      <div style={{ display:"flex",gap:"8px",marginBottom:"14px" }}>
        <button className="btn-pixel btn-gris" style={{ fontSize:"6px",flex:1 }} onClick={cargar}>🔄 RECARGAR</button>
        <button className="btn-pixel btn-rojo" style={{ fontSize:"6px",flex:1 }}
          onClick={limpiarTodo} disabled={limpiando||total===0}>
          {limpiando?"⚙ ...":"🗑 LIMPIAR TODO"}
        </button>
      </div>
      {cargando ? (
        <p style={{ fontSize:"7px",color:"var(--gris-claro)" }}>Cargando...</p>
      ) : mensajes.length===0 ? (
        <p style={{ fontSize:"7px",color:"var(--gris-claro)" }}>No hay mensajes.</p>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:"6px",maxHeight:"60vh",overflowY:"auto" }}>
          {mensajes.map(m => (
            <div key={m.docId} style={{ padding:"8px 10px",border:"1px solid var(--verde-campo)",
              display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px" }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:"6px",color:"var(--amarillo)",marginBottom:"3px" }}>
                  {m.autor} <span style={{ color:"var(--gris-claro)" }}>— {m.fecha} {m.hora}</span>
                </p>
                <p style={{ fontSize:"6px",color:"var(--blanco)",lineHeight:1.8,wordBreak:"break-word" }}>{m.texto}</p>
                {m.url && <p style={{ fontSize:"5px",color:"var(--azul)",marginTop:"3px",wordBreak:"break-all" }}>🔗 {m.url}</p>}
              </div>
              <button className="btn-pixel btn-rojo" style={{ fontSize:"5px",padding:"4px 6px" }}
                onClick={() => eliminarUno(m.docId)} disabled={eliminando===m.docId}>
                {eliminando===m.docId?"...":"✕"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab Sonido diario ─────────────────────────────────────────
function TabSonido({ onMensaje }) {
  const [archivo,   setArchivo]   = useState("");
  const [volumen,   setVolumen]   = useState(0.4);
  const [cargando,  setCargando]  = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDoc(doc(db,"config","sonidoDia"));
        if (snap.exists()) {
          setArchivo(snap.data().archivo || "");
          setVolumen(snap.data().volumen ?? 0.4);
        }
      } catch(e) { console.error(e); }
      finally { setCargando(false); }
    };
    cargar();
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      await setDoc(doc(db,"config","sonidoDia"), {
        archivo:  archivo.trim(),
        volumen:  Number(volumen),
        fecha:    new Date().toISOString(),
      });
      onMensaje("ok", archivo.trim()
        ? `Sonido "${archivo.trim()}" activado. Se reproducirá en la pestaña PARTIDOS.`
        : "Sonido desactivado. La pestaña PARTIDOS no reproducirá nada.");
    } catch(e) { onMensaje("error",e.message); }
    finally { setGuardando(false); }
  };

  const probar = () => {
    if (!archivo.trim()) return;
    try {
      const audio = new Audio(`/sounds/${archivo.trim()}`);
      audio.volume = Number(volumen);
      audio.play().catch(e => onMensaje("error",`No se pudo reproducir: ${e.message}`));
    } catch(e) { onMensaje("error", e.message); }
  };

  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"14px",lineHeight:2 }}>
        🎵 SONIDO AMBIENTAL DE LA PESTAÑA PARTIDOS
      </p>
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"14px",lineHeight:2 }}>
        Sube tu archivo de audio a la carpeta <code style={{ color:"var(--verde-claro)" }}>public/sounds/</code> de tu proyecto
        y escribe aquí el nombre exacto del archivo (ej. <code style={{ color:"var(--amarillo)" }}>samba.mp3</code>).
        Si dejas el campo vacío, no suena nada.
      </p>

      {cargando ? (
        <p style={{ fontSize:"7px",color:"var(--gris-claro)" }}>Cargando configuración...</p>
      ) : (
        <div className="caja-pixel" style={{ borderColor:"var(--verde-campo)" }}>
          <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"6px" }}>
            ARCHIVO DE AUDIO (en public/sounds/)
          </p>
          <input
            value={archivo}
            onChange={e => setArchivo(e.target.value)}
            placeholder="ej: samba.mp3"
            style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
              width:"100%",padding:"8px 10px",border:"3px solid var(--negro)",
              background:"var(--blanco)",color:"var(--negro)",
              outline:"none",marginBottom:"14px" }}
          />

          <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"6px" }}>
            VOLUMEN ({Math.round(Number(volumen)*100)}%)
          </p>
          <input type="range" min="0" max="1" step="0.05"
            value={volumen} onChange={e => setVolumen(e.target.value)}
            style={{ width:"100%",marginBottom:"14px",accentColor:"var(--amarillo)" }} />

          <div style={{ display:"flex",gap:"8px" }}>
            <button className="btn-pixel btn-gris" style={{ fontSize:"7px",flex:1 }}
              onClick={probar} disabled={!archivo.trim()}>
              ▶ PROBAR
            </button>
            <button className="btn-pixel btn-rojo" style={{ fontSize:"7px",flex:2 }}
              onClick={guardar} disabled={guardando}>
              {guardando ? "⚙ GUARDANDO..." : "💾 GUARDAR CONFIGURACIÓN"}
            </button>
          </div>

          <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginTop:"10px",lineHeight:2 }}>
            ⚠ Formatos recomendados: MP3, OGG. El sonido se reproduce en bucle con fade-in al entrar
            a la pestaña PARTIDOS. El usuario puede silenciarlo con el botón 🔊/🔇 de la topbar.
          </p>
        </div>
      )}
    </div>
  );
}
