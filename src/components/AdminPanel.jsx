// src/components/AdminPanel.jsx  — v3
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, doc,
  updateDoc, where, setDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  procesarResultadoPartido, calcularGanadorDelDia,
  procesarPreguntaDelDia, publicarAvisoAdmin,
} from "../utils/helpers";
import { FASES_ELIMINATORIAS, FASE_LABELS, BANCO_PREGUNTAS } from "../data/sampleData";

const ADMIN_EMAILS = ["xtokesu@gmail.com"];

export default function AdminPanel({ onVolver }) {
  const { firebaseUser } = useAuth();
  if (!ADMIN_EMAILS.includes(firebaseUser?.email)) {
    return (
      <div style={{padding:"20px",textAlign:"center"}}>
        <p style={{color:"var(--rojo-chile)",fontSize:"8px"}}>🔒 ACCESO DENEGADO</p>
        <button className="btn-pixel btn-gris" onClick={onVolver} style={{marginTop:"16px"}}>
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
      const snapP = await getDocs(query(collection(db,"partidos"), orderBy("fecha")));
      setPartidos(snapP.docs.map((d) => ({ id: d.id, ...d.data() })));
      const snapQ = await getDocs(query(collection(db,"preguntas"), orderBy("fecha")));
      setPreguntas(snapQ.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  const msg = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 6000);
  };

  const TABS = [
    { id:"partidos",  label:"⚽ PARTIDOS" },
    { id:"preguntas", label:"❓ PREGUNTAS" },
    { id:"dia",       label:"🏆 CERRAR DÍA" },
    { id:"aviso",     label:"📢 AVISO" },
  ];

  return (
    <div style={{padding:"16px 16px 80px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px"}}>
        <button className="btn-pixel btn-gris" onClick={onVolver}
          style={{fontSize:"7px",padding:"6px 10px"}}>← VOLVER</button>
        <h2 style={{color:"var(--rojo-chile)",fontSize:"9px"}}>⚙ PANEL ADMIN</h2>
      </div>

      {mensaje && (
        <div style={{
          padding:"10px 14px", marginBottom:"14px", fontSize:"7px",
          border:`2px solid ${mensaje.tipo==="ok"?"var(--verde-claro)":"var(--rojo-chile)"}`,
          color: mensaje.tipo==="ok"?"var(--verde-claro)":"var(--rojo-chile)",
          background: mensaje.tipo==="ok"?"rgba(82,183,136,0.1)":"rgba(214,40,40,0.1)",
          lineHeight:2,
        }}>
          {mensaje.tipo==="ok"?"✅":"❌"} {mensaje.texto}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:"4px",marginBottom:"14px",flexWrap:"wrap"}}>
        {TABS.map((t) => (
          <button key={t.id}
            className={`btn-pixel ${tab===t.id?"btn-amarillo":"btn-gris"}`}
            style={{fontSize:"5px",padding:"5px 8px",flex:"1 0 auto"}}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{textAlign:"center",padding:"30px",fontSize:"7px",color:"var(--verde-claro)"}}>
          <span className="spinner">⚙</span><br/><br/>CARGANDO...
        </div>
      ) : (
        <>
          {tab==="partidos"  && <TabPartidosAdmin partidos={partidos} onActualizar={cargarDatos} onMensaje={msg} />}
          {tab==="preguntas" && <TabPreguntasAdmin preguntas={preguntas} onActualizar={cargarDatos} onMensaje={msg} />}
          {tab==="dia"       && <TabCerrarDia onMensaje={msg} />}
          {tab==="aviso"     && <TabAviso onMensaje={msg} />}
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
      setGl(String(r.golesLocal??"")); setGv(String(r.golesVisitante??""));
      setDef(r.definicion||"normal");
      setGlA(String(r.golesLocalAlargue??"")); setGvA(String(r.golesVisitanteAlargue??""));
      setPL(String(r.penalesLocal??"")); setPV(String(r.penalesVisitante??""));
      setGanFin(r.ganadorFinal||"");
    } else {
      setGl(""); setGv(""); setDef("normal");
      setGlA(""); setGvA(""); setPL(""); setPV(""); setGanFin("");
    }
  };

  const esElim = sel && FASES_ELIMINATORIAS.includes(sel.fase);

  const guardar = async () => {
    if (!sel || gl===""||gv==="") { onMensaje("error","Ingresa los goles 90 min."); return; }
    setProc(true);
    try {
      const resultado = {
        golesLocal: Number(gl), golesVisitante: Number(gv),
        definicion: esElim ? def : "normal",
      };
      if (esElim && def !== "normal") {
        resultado.golesLocalAlargue = Number(glA||0);
        resultado.golesVisitanteAlargue = Number(gvA||0);
        if (def==="penales") {
          resultado.penalesLocal = Number(pL);
          resultado.penalesVisitante = Number(pV);
        }
        resultado.ganadorFinal = ganFin;
      } else if (!esElim) {
        const glN=Number(gl),gvN=Number(gv);
        resultado.ganadorFinal = glN>gvN?"local":gvN>glN?"visitante":"empate";
      }
      await updateDoc(doc(db,"partidos",sel.id), { resultado });
      const { procesados, errores } = await procesarResultadoPartido(
        sel.id, resultado, sel.fase||"grupos", sel.estaDestacado||false, sel.fecha
      );
      onMensaje("ok",`Resultado guardado. ${procesados} predicciones procesadas.${errores>0?` ${errores} errores`:""}`);
      onActualizar();
      setSel(null);
    } catch(e) { onMensaje("error",e.message); }
    finally { setProc(false); }
  };

  const inputNum = (val, setVal) => (
    <input type="number" min="0" max="20" value={val}
      onChange={(e) => setVal(e.target.value)} placeholder="0"
      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"14px",
        width:"50px", height:"50px", textAlign:"center",
        border:"3px solid var(--negro)", background:"var(--blanco)", color:"var(--negro)", outline:"none" }}
    />
  );

  return (
    <div>
      <p style={{fontSize:"7px",color:"var(--amarillo)",marginBottom:"10px",lineHeight:2}}>
        Selecciona un partido e ingresa el resultado. El sistema calculará los puntos automáticamente.
      </p>

      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
        {partidos.map((p) => (
          <React.Fragment key={p.id}>
            <button
              onClick={() => sel?.id===p.id ? setSel(null) : seleccionar(p)}
              style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                padding:"10px 12px",
                border:`2px solid ${sel?.id===p.id?"var(--amarillo)":p.resultado?"var(--verde-campo)":"var(--gris)"}`,
                background: sel?.id===p.id?"rgba(244,208,63,0.1)":"var(--negro)",
                color:"var(--blanco)", cursor:"pointer",
                textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center",
              }}
            >
              <span>
                {p.local?.bandera} vs {p.visitante?.bandera}{" "}
                <span style={{color:"var(--gris-claro)"}}>({p.fecha})</span>
                {p.fase&&p.fase!=="grupos"&&(
                  <span style={{color:"var(--rojo-chile)",marginLeft:"4px"}}>
                    [{FASE_LABELS[p.fase]||p.fase}]
                  </span>
                )}
              </span>
              {p.resultado
                ? <span style={{color:"var(--verde-claro)"}}>
                    {p.resultado.golesLocal}-{p.resultado.golesVisitante} ✓
                  </span>
                : <span style={{color:"var(--gris)"}}>Pendiente</span>
              }
            </button>

            {/* Formulario inline debajo del partido seleccionado */}
            {sel?.id===p.id && (
              <div className="caja-pixel" style={{borderColor:"var(--amarillo)",marginBottom:"6px"}}>
                <p style={{fontSize:"8px",color:"var(--amarillo)",marginBottom:"12px"}}>
                  {p.local?.bandera} {p.local?.nombre} vs {p.visitante?.nombre} {p.visitante?.bandera}
                </p>

                <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px"}}>GOLES 90 MIN</p>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
                  {inputNum(gl,setGl)}
                  <span style={{fontSize:"18px",color:"var(--amarillo)"}}>-</span>
                  {inputNum(gv,setGv)}
                </div>

                {esElim && (
                  <>
                    <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px"}}>¿CÓMO SE DEFINIÓ?</p>
                    <div style={{display:"flex",gap:"6px",marginBottom:"10px"}}>
                      {["normal","alargue","penales"].map((d)=>(
                        <button key={d}
                          className={`pred-btn ${def===d?"seleccionado":""}`}
                          onClick={()=>setDef(d)}
                          style={{flex:1,fontSize:"6px"}}>
                          {d==="normal"?"90MIN":d.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {(def==="alargue"||def==="penales")&&(
                      <>
                        <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px"}}>
                          GOLES EN ALARGUE
                        </p>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                          {inputNum(glA,setGlA)}
                          <span style={{color:"var(--amarillo)"}}>-</span>
                          {inputNum(gvA,setGvA)}
                        </div>
                      </>
                    )}

                    {def==="penales"&&(
                      <>
                        <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px"}}>
                          TANDA DE PENALES
                        </p>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                          {inputNum(pL,setPL)}
                          <span style={{color:"var(--amarillo)"}}>-</span>
                          {inputNum(pV,setPV)}
                        </div>
                      </>
                    )}

                    {def!=="normal"&&(
                      <>
                        <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"6px"}}>¿QUIÉN GANÓ?</p>
                        <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                          {["local","visitante"].map((g)=>(
                            <button key={g}
                              className={`pred-btn ${ganFin===g?"seleccionado":""}`}
                              onClick={()=>setGanFin(g)}
                              style={{flex:1,fontSize:"6px"}}>
                              {g==="local"?`${p.local?.bandera} ${p.local?.nombre}`:`${p.visitante?.bandera} ${p.visitante?.nombre}`}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                <button className="btn-pixel btn-rojo w-full"
                  style={{marginTop:"8px",fontSize:"7px"}}
                  onClick={guardar} disabled={procesando}>
                  {procesando?"⚙ PROCESANDO...":"⚡ GUARDAR Y CALCULAR PUNTOS"}
                </button>
                <p style={{fontSize:"5px",color:"var(--gris-claro)",marginTop:"8px",lineHeight:2}}>
                  ⚠ Actualiza el resultado y recalcula puntos de todos los participantes.
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
  const [pregSel, setPregSel]       = useState(null);
  const [respCorrecta, setResp]     = useState("");
  const [procesando, setProc]       = useState(false);
  // Para crear nueva pregunta desde el banco
  const [bancoPregSel, setBancoPregSel] = useState(null);
  const [fechaNueva, setFechaNueva] = useState(new Date().toISOString().split("T")[0]);

  const procesar = async () => {
    if (!pregSel||!respCorrecta) return;
    setProc(true);
    try {
      await updateDoc(doc(db,"preguntas",pregSel.id),{ respuestaCorrecta: respCorrecta });
      const res = await procesarPreguntaDelDia(pregSel.id, respCorrecta, pregSel.fecha);
      if (res.ok) onMensaje("ok",`Procesada. ${res.procesados} usuarios acertaron (+2 pts c/u).`);
      else onMensaje("error",`Error: ${res.error}`);
      onActualizar(); setPregSel(null);
    } catch(e) { onMensaje("error",e.message); }
    finally { setProc(false); }
  };

  const crearPreguntaDelBanco = async () => {
    if (!bancoPregSel) return;
    try {
      await setDoc(doc(db,"preguntas",`${fechaNueva}_${bancoPregSel.id}`),{
        ...bancoPregSel, fecha: fechaNueva, respuestaCorrecta: null,
      });
      onMensaje("ok","Pregunta publicada para el día " + fechaNueva);
      onActualizar(); setBancoPregSel(null);
    } catch(e) { onMensaje("error",e.message); }
  };

  return (
    <div>
      {/* Crear desde banco */}
      <div className="caja-pixel mb-16" style={{borderColor:"var(--azul)"}}>
        <p style={{fontSize:"7px",color:"var(--azul)",marginBottom:"10px"}}>
          PUBLICAR PREGUNTA DEL DÍA
        </p>
        <p style={{fontSize:"6px",color:"var(--gris-claro)",marginBottom:"8px"}}>
          Selecciona una pregunta del banco y la fecha:
        </p>
        <input type="date" value={fechaNueva}
          onChange={(e) => setFechaNueva(e.target.value)}
          style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
            padding:"6px 10px", border:"3px solid var(--negro)",
            background:"var(--blanco)", color:"var(--negro)", width:"100%",
            marginBottom:"8px", outline:"none" }}
        />
        <div style={{maxHeight:"160px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"4px",marginBottom:"8px"}}>
          {BANCO_PREGUNTAS.map((bq) => (
            <button key={bq.id}
              onClick={() => setBancoPregSel(bq)}
              style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                padding:"6px 8px", border:`2px solid ${bancoPregSel?.id===bq.id?"var(--amarillo)":"var(--gris)"}`,
                background: bancoPregSel?.id===bq.id?"rgba(244,208,63,0.1)":"var(--negro)",
                color:"var(--blanco)", cursor:"pointer", textAlign:"left", lineHeight:1.8,
              }}>
              {bq.texto?.slice(0,50)}...
            </button>
          ))}
        </div>
        {bancoPregSel && (
          <button className="btn-pixel btn-verde w-full"
            style={{fontSize:"7px"}} onClick={crearPreguntaDelBanco}>
            ✅ PUBLICAR PARA {fechaNueva}
          </button>
        )}
      </div>

      {/* Preguntas existentes: marcar respuesta correcta */}
      <p style={{fontSize:"7px",color:"var(--amarillo)",marginBottom:"8px"}}>
        MARCAR RESPUESTA CORRECTA
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"14px"}}>
        {preguntas.map((p) => (
          <React.Fragment key={p.id}>
            <button
              onClick={() => pregSel?.id===p.id ? setPregSel(null) : (setPregSel(p), setResp(p.respuestaCorrecta||""))}
              style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                padding:"8px 10px",
                border:`2px solid ${pregSel?.id===p.id?"var(--amarillo)":p.respuestaCorrecta?"var(--verde-campo)":"var(--gris)"}`,
                background: pregSel?.id===p.id?"rgba(244,208,63,0.1)":"var(--negro)",
                color:"var(--blanco)", cursor:"pointer", textAlign:"left", lineHeight:2,
              }}>
              <div>{p.fecha} — {p.texto?.slice(0,45)}...</div>
              {p.respuestaCorrecta && (
                <span style={{color:"var(--verde-claro)"}}>✓ {p.respuestaCorrecta}</span>
              )}
            </button>

            {pregSel?.id===p.id && (
              <div className="caja-pixel" style={{borderColor:"var(--amarillo)",marginBottom:"6px"}}>
                <p style={{fontSize:"7px",color:"var(--amarillo)",marginBottom:"10px",lineHeight:2}}>
                  {p.texto}
                </p>
                <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"8px"}}>RESPUESTA CORRECTA:</p>
                <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"12px"}}>
                  {(p.opciones||[]).map((op,i)=>(
                    <button key={i}
                      className={`pred-btn ${respCorrecta===op?"seleccionado":""}`}
                      onClick={()=>setResp(op)}
                      style={{fontSize:"7px",padding:"8px"}}>
                      {op}
                    </button>
                  ))}
                </div>
                <button className="btn-pixel btn-rojo w-full" style={{fontSize:"7px"}}
                  onClick={procesar} disabled={!respCorrecta||procesando}>
                  {procesando?"⚙ PROCESANDO...":"⚡ MARCAR CORRECTA Y DAR PUNTOS"}
                </button>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Tab Cerrar Día ────────────────────────────────────────────
function TabCerrarDia({ onMensaje }) {
  const [fecha, setFecha]     = useState(new Date().toISOString().split("T")[0]);
  const [procesando, setProc] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cerrar = async () => {
    setProc(true); setResultado(null);
    try {
      const res = await calcularGanadorDelDia(fecha);
      if (res.ok) {
        setResultado(res);
        onMensaje("ok",
          `✅ Día cerrado. Ganador(es): ${res.ganador}. Cartas asignadas automáticamente.`
        );
      } else {
        onMensaje("error", res.mensaje || res.error);
      }
    } catch(e) { onMensaje("error",e.message); }
    finally { setProc(false); }
  };

  return (
    <div>
      <p style={{fontSize:"7px",color:"var(--amarillo)",marginBottom:"14px",lineHeight:2}}>
        Cierra el día para calcular el podio, otorgar +3 pts al ganador
        y <span style={{color:"var(--verde-claro)"}}>asignar cartas automáticamente</span> a los del podio.
      </p>
      <div className="caja-pixel" style={{borderColor:"var(--rojo-chile)"}}>
        <p style={{fontSize:"7px",color:"var(--verde-claro)",marginBottom:"8px"}}>FECHA A CERRAR</p>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"9px",
            padding:"8px 12px", border:"3px solid var(--negro)",
            background:"var(--blanco)", color:"var(--negro)", width:"100%",
            marginBottom:"14px", outline:"none" }}
        />
        <button className="btn-pixel btn-rojo w-full" style={{fontSize:"7px"}}
          onClick={cerrar} disabled={procesando}>
          {procesando?"⚙ PROCESANDO...":"🏆 CALCULAR GANADOR Y ASIGNAR CARTAS"}
        </button>

        {resultado && (
          <div style={{marginTop:"12px",fontSize:"6px",color:"var(--verde-claro)",lineHeight:2}}>
            <p>🥇 1°: {resultado.lugar1?.join(", ")||"-"} → carta x4</p>
            <p>🥈 2°: {resultado.lugar2?.join(", ")||"-"} → carta x3</p>
            <p>🥉 3°: {resultado.lugar3?.join(", ")||"-"} → carta x2</p>
          </div>
        )}

        <p style={{fontSize:"5px",color:"var(--gris-claro)",marginTop:"10px",lineHeight:2}}>
          ⚠ Ejecuta UNA VEZ por día, después de procesar todos los partidos y la pregunta.
        </p>
      </div>
    </div>
  );
}

// ── Tab Aviso ─────────────────────────────────────────────────
function TabAviso({ onMensaje }) {
  const [texto, setTexto]     = useState("");
  const [enviando, setEnv]    = useState(false);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnv(true);
    try {
      await publicarAvisoAdmin(texto.trim());
      onMensaje("ok","Aviso publicado. Todos los participantes lo verán al recargar.");
      setTexto("");
    } catch(e) { onMensaje("error",e.message); }
    finally { setEnv(false); }
  };

  return (
    <div>
      <p style={{fontSize:"7px",color:"var(--amarillo)",marginBottom:"12px",lineHeight:2}}>
        Escribe un mensaje para todos los participantes.
        Aparecerá como modal flotante en su próxima sesión.
      </p>
      <div className="caja-pixel" style={{borderColor:"var(--amarillo)"}}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="Escribe el aviso aquí..."
          style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
            padding:"10px", border:"3px solid var(--negro)",
            background:"var(--blanco)", color:"var(--negro)",
            width:"100%", resize:"vertical", outline:"none", lineHeight:2,
          }}
        />
        <button className="btn-pixel btn-amarillo w-full"
          style={{marginTop:"12px",fontSize:"7px"}}
          onClick={enviar} disabled={!texto.trim()||enviando}>
          {enviando?"ENVIANDO...":"📢 PUBLICAR AVISO"}
        </button>
      </div>
    </div>
  );
}
