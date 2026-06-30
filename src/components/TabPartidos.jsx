// src/components/TabPartidos.jsx  — v8 (Fase 4)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v8:
//   Punto 10: Integra <SuperDestacado> para partidos con
//             esSuperDestacado:true. El componente escucha en
//             tiempo real (onSnapshot) y muestra la pregunta en vivo.
//   Todo lo demás idéntico a v7.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, getDocs, query, where, doc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { hoyStr, partidoAbierto } from "../utils/helpers";
import PartidoCard from "./PartidoCard";
import PreguntaCard from "./PreguntaCard";
import SuperDestacado from "./SuperDestacado";

const LS_HINCHADA_KEY = "cp8b_hinchada_preguntado_";

// ── Hook: sonido ambiental ────────────────────────────────────
function useSonidoAmbiental(activado) {
  const audioRef = useRef(null);
  useEffect(() => {
    let activo = true;
    const iniciar = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "sonidoDia"));
        if (!snap.exists() || !activo) return;
        const { archivo, volumen = 0.4 } = snap.data();
        if (!archivo || !activado) return;
        const audio = new Audio(`/sounds/${archivo}`);
        audio.loop = true; audio.volume = 0;
        audioRef.current = audio;
        await audio.play().catch(() => {});
        let vol = 0;
        const target = Math.min(1, Math.max(0, Number(volumen)));
        const fade = setInterval(() => {
          if (!activo) { clearInterval(fade); return; }
          vol = Math.min(target, vol + 0.02);
          if (audioRef.current) audioRef.current.volume = vol;
          if (vol >= target) clearInterval(fade);
        }, 80);
      } catch(_) {}
    };
    iniciar();
    return () => {
      activo = false;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [activado]);
  useEffect(() => {
    if (!audioRef.current) return;
    activado ? audioRef.current.play().catch(()=>{}) : audioRef.current.pause();
  }, [activado]);
}

export default function TabPartidos({ onGuardado }) {
  const { firebaseUser } = useAuth();
  const sonidosActivados = localStorage.getItem("cp8b_sonidos_activados") !== "0";
  useSonidoAmbiental(sonidosActivados);

  const [partidos,    setPartidos]    = useState([]);
  const [pregunta,    setPregunta]    = useState(null);
  const [cargando,    setCargando]    = useState(true);
  const [prediccionesGuardadas, setPrediccionesGuardadas] = useState(new Set());
  const [respuestaUsuario, setRespuestaUsuario] = useState(null);

  // Partido super destacado activo (para preguntas en vivo)
  const [superDestacado, setSuperDestacado] = useState(null);

  const [mostrarModalHinchada, setMostrarModalHinchada] = useState(false);
  const [mostrarFormHinchada,  setMostrarFormHinchada]  = useState(false);
  const [textoMensaje, setTextoMensaje] = useState("");
  const [urlMensaje,   setUrlMensaje]   = useState("");
  const [enviandoMsg,  setEnviandoMsg]  = useState(false);
  const [msgEnviado,   setMsgEnviado]   = useState(false);
  const hoy = hoyStr();

  useEffect(() => { cargarDatos(); }, []);
  useEffect(() => { if (firebaseUser && partidos.length>0) verificarPredicciones(); }, [partidos, firebaseUser]);
  useEffect(() => { if (firebaseUser && pregunta) verificarRespuestaPregunta(); }, [pregunta, firebaseUser]);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      let lista = [];
      try {
        // Partidos de hoy
        const snapHoy = await getDocs(query(collection(db,"partidos"), where("fecha","==",hoy)));
        const hoyLista = snapHoy.docs.map(d => ({ id:d.id, ...d.data() }));

        // Dieciseisavos sin resultado (pueden ser de cualquier fecha)
        let d16Lista = [];
        try {
          const snapD16 = await getDocs(query(collection(db,"partidos"), where("fase","==","dieciseisavos")));
          d16Lista = snapD16.docs.map(d => ({ id:d.id, ...d.data() })).filter(p => !p.resultado);
        } catch(_) {}

        // Combinar sin duplicados
        const idsHoy = new Set(hoyLista.map(p => p.id));
        lista = [...hoyLista, ...d16Lista.filter(p => !idsHoy.has(p.id))];
      } catch(_) {}
      setPartidos(lista);

      // Detectar partido super destacado — búsqueda separada (sin filtro de fecha)
      // para que funcione aunque el partido no sea de hoy
            let sd = lista.find(p => p.esSuperDestacado && !p.resultado);
      if (!sd) {
        try {
          const snapSD = await getDocs(query(
            collection(db,"partidos"), where("esSuperDestacado","==",true)
          ));
          sd = snapSD.docs
            .map(d => ({ id:d.id, ...d.data() }))
            .find(p => !p.resultado) || null;
        } catch(_) {}
      }
      setSuperDestacado(sd || null);

      try {
        const snapP = await getDocs(query(collection(db,"preguntas"), where("fecha","==",hoy)));
        if (!snapP.empty) setPregunta({ id:snapP.docs[0].id, ...snapP.docs[0].data() });
      } catch(_) {}
    } finally { setCargando(false); }
  };

  const verificarPredicciones = async () => {
    if (!firebaseUser) return;
    const abiertos = partidos.filter(p => !p.resultado && partidoAbierto(p));
    if (abiertos.length === 0) return;
    // Una sola query por uid en vez de un getDoc por partido (evita N+1).
    // Se filtra a los partidos abiertos en cliente; índice de campo único (uid) basta.
    const idsAbiertos = new Set(abiertos.map(p => p.id));
    const snap = await getDocs(query(collection(db,"predicciones"), where("uid","==",firebaseUser.uid)));
    const nuevas = new Set();
    snap.forEach(d => { if (idsAbiertos.has(d.data().partidoId)) nuevas.add(d.data().partidoId); });
    setPrediccionesGuardadas(nuevas);
  };

  const verificarRespuestaPregunta = async () => {
    if (!firebaseUser || !pregunta) return;
    try {
      const snap = await getDoc(doc(db,"respuestas",`${firebaseUser.uid}_${pregunta.id}`));
      if (snap.exists()) setRespuestaUsuario(snap.data().respuesta || "✓");
    } catch(_) {}
  };

  const handlePrediccionGuardada = useCallback(() => {
    setTimeout(verificarPredicciones, 500);
    if (onGuardado) onGuardado();
    const lsKey = LS_HINCHADA_KEY + hoy;
    if (!localStorage.getItem(lsKey)) setMostrarModalHinchada(true);
  }, [partidos, firebaseUser, hoy]);

  const cerrarModalHinchada = () => {
    localStorage.setItem(LS_HINCHADA_KEY + hoy, "1");
    setMostrarModalHinchada(false); setMostrarFormHinchada(false);
    setTextoMensaje(""); setUrlMensaje(""); setMsgEnviado(false);
  };

  const enviarMensajeHinchada = async () => {
    if (!textoMensaje.trim() || !firebaseUser) return;
    setEnviandoMsg(true);
    try {
      const { addDoc, collection:col, serverTimestamp } = await import("firebase/firestore");
      const ahora = new Date();
      await addDoc(col(db,"mensajesDia"), {
        autor:firebaseUser.displayName?.split(" ")[0]||"Anónimo",
        texto:textoMensaje.trim().slice(0,200), url:urlMensaje.trim()||null,
        timestamp:serverTimestamp(), fecha:hoy,
        hora:`${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`,
        uid:firebaseUser.uid,
      });
      setMsgEnviado(true); setTimeout(cerrarModalHinchada,1500);
    } catch(e) { console.error(e); }
    finally { setEnviandoMsg(false); }
  };

  const abiertos = partidos.filter(p=>!p.resultado&&partidoAbierto(p));
  const todosPredecidos = abiertos.length>0 && abiertos.every(p=>prediccionesGuardadas.has(p.id));

  if (cargando) return (
    <div className="loading-pantalla" style={{ minHeight:"200px" }}>
      <span className="spinner">⚙</span><p>CARGANDO...</p>
    </div>
  );

  return (
    <div style={{ paddingBottom:"80px" }}>
      {/* ── SuperDestacado flotante (preguntas en vivo) ─── */}
      {superDestacado && (
  <SuperDestacado
    partidoId={superDestacado.id}
    nombrePartido={`${superDestacado.local?.nombre} vs ${superDestacado.visitante?.nombre}`}
  />
)}

      {/* Modal hinchada */}
      {mostrarModalHinchada && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:800,
          display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
          <div style={{ background:"var(--negro)",border:"4px solid var(--amarillo)",
            boxShadow:"6px 6px 0 var(--amarillo-oscuro)",
            padding:"24px 20px",maxWidth:"360px",width:"100%",
            display:"flex",flexDirection:"column",gap:"14px" }}>
            {!mostrarFormHinchada ? (
              <>
                <p style={{ fontSize:"24px",textAlign:"center" }}>📢</p>
                <p style={{ fontSize:"8px",color:"var(--blanco)",textAlign:"center",lineHeight:2 }}>
                  ¿Algún mensaje<br/>para la hinchada?
                </p>
                <div style={{ display:"flex",gap:"8px" }}>
                  <button className="btn-pixel btn-verde w-full" style={{ fontSize:"8px" }}
                    onClick={()=>setMostrarFormHinchada(true)}>SÍ</button>
                  <button className="btn-pixel btn-gris w-full" style={{ fontSize:"8px" }}
                    onClick={cerrarModalHinchada}>NO</button>
                </div>
              </>
            ) : msgEnviado ? (
              <p style={{ fontSize:"8px",color:"var(--verde-claro)",textAlign:"center",lineHeight:2 }}>✅ ¡Mensaje enviado!</p>
            ) : (
              <>
                <p style={{ fontSize:"7px",color:"var(--amarillo)" }}>📢 TU MENSAJE</p>
                <textarea value={textoMensaje} onChange={e=>setTextoMensaje(e.target.value.slice(0,200))}
                  placeholder="Escribe algo (máx 200 caracteres)..." rows={3}
                  style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                    width:"100%",padding:"8px",border:"2px solid var(--negro)",
                    background:"var(--blanco)",color:"var(--negro)",
                    outline:"none",resize:"none",lineHeight:2 }} />
                <p style={{ fontSize:"5px",color:"var(--gris-claro)",textAlign:"right" }}>{textoMensaje.length}/200</p>
                <input value={urlMensaje} onChange={e=>setUrlMensaje(e.target.value)}
                  placeholder="URL opcional"
                  style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                    width:"100%",padding:"6px 8px",border:"2px solid var(--negro)",
                    background:"var(--blanco)",color:"var(--negro)",outline:"none" }} />
                <div style={{ display:"flex",gap:"8px" }}>
                  <button className="btn-pixel btn-verde w-full" style={{ fontSize:"7px" }}
                    onClick={enviarMensajeHinchada}
                    disabled={enviandoMsg||!textoMensaje.trim()}>
                    {enviandoMsg?"⚙...":"✅ ENVIAR"}
                  </button>
                  <button className="btn-pixel btn-gris" style={{ fontSize:"7px" }}
                    onClick={cerrarModalHinchada}>✕</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="contenedor">
        <div className="seccion-titulo" style={{ marginTop:"16px" }}>⚽ PARTIDOS DE HOY</div>
        {partidos.length>0 ? (
          partidos.map(p => (
            <PartidoCard key={p.id} partido={p} onGuardado={handlePrediccionGuardada} />
          ))
        ) : (
          <div className="caja-pixel mb-16 text-center">
            <p style={{ fontSize:"7px",color:"var(--gris-claro)" }}>No hay partidos para hoy.</p>
          </div>
        )}
        {abiertos.length>0 && (
          <div style={{ padding:"8px 12px",marginBottom:"12px",
            border:"2px solid var(--verde-campo)",background:"rgba(64,145,108,0.1)",
            fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
            color:"var(--verde-claro)",textAlign:"center" }}>
            {todosPredecidos
              ? "✅ TODOS LOS PRONÓSTICOS GUARDADOS"
              : `📝 ${prediccionesGuardadas.size} / ${abiertos.length} PRONÓSTICOS GUARDADOS`
            }
          </div>
        )}
        {pregunta && (
          <>
            <div className="seccion-titulo">
              ❓ PREGUNTA DEL DÍA
              {respuestaUsuario && (
                <span style={{ marginLeft:"8px",fontSize:"6px",color:"var(--verde-claro)",
                  background:"rgba(82,183,136,0.15)",border:"1px solid var(--verde-claro)",
                  padding:"2px 6px" }}>✓ RESPONDIDA</span>
              )}
            </div>
            <PreguntaCard pregunta={pregunta} />
          </>
        )}
      </div>
    </div>
  );
}
