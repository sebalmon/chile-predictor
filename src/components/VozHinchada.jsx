// src/components/VozHinchada.jsx  — v7 (Patch 2)
// ─────────────────────────────────────────────────────────────
// NUEVO (punto 4):
//   • Selector de 6 emoticones por mensaje: 😀 😡 😢 😂 👍 👎
//   • Cada usuario puede poner UNA reacción por mensaje.
//   • Las reacciones se guardan en mensajesDia/{docId}/reacciones/{uid}
//     como { emoji: "👍" }.
//   • Conteo visible debajo de cada mensaje (ej. "👍 3 😂 1").
//   • Clic en emoticon: si ya tenías ese, lo quita; si era otro, lo cambia.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
  doc, setDoc, deleteDoc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { hoyStr } from "../utils/helpers";

const COLORES_MSG = [
  ["#1a472a","#52b788"], ["#9b1c1c","#f4d03f"], ["#1a1a5e","#a8d8ea"],
  ["#4a0e8f","#e0c3fc"], ["#1a3a00","#b5e48c"], ["#3d2b00","#ffd166"],
  ["#003333","#56cfe1"], ["#3b0a0a","#ff9a76"],
];
const EMOJIS = ["😀","😡","😢","😂","👍","👎"];

function colorMsg(idx) { return COLORES_MSG[idx % COLORES_MSG.length]; }

function labelTiempo(fechaStr, horaStr) {
  const hoy = hoyStr();
  if (fechaStr === hoy) return `HOY · ${horaStr}`;
  const [, m, d] = (fechaStr || "").split("-");
  return m && d ? `${d}/${m} · ${horaStr}` : horaStr;
}

// ── Reacciones de un mensaje ──────────────────────────────────
function Reacciones({ docId, miUid }) {
  const [conteo,    setConteo]    = useState({}); // { "👍": 3, ... }
  const [miReaccion,setMiReaccion]= useState(null);
  const [cargando,  setCargando]  = useState(true);

  useEffect(() => { cargar(); }, [docId]);

  const cargar = async () => {
    try {
      const snap = await getDocs(collection(db,"mensajesDia",docId,"reacciones"));
      const c = {};
      let mia = null;
      snap.docs.forEach(d => {
        const { emoji } = d.data();
        c[emoji] = (c[emoji] || 0) + 1;
        if (d.id === miUid) mia = emoji;
      });
      setConteo(c); setMiReaccion(mia);
    } catch(_) {}
    finally { setCargando(false); }
  };

  const reaccionar = async (emoji) => {
    if (!miUid) return;
    const ref = doc(db,"mensajesDia",docId,"reacciones",miUid);
    if (miReaccion === emoji) {
      // Quitar reacción
      await deleteDoc(ref);
      setConteo(prev => {
        const n = { ...prev };
        n[emoji] = Math.max(0, (n[emoji]||0) - 1);
        if (n[emoji] === 0) delete n[emoji];
        return n;
      });
      setMiReaccion(null);
    } else {
      // Agregar o cambiar
      if (miReaccion) {
        setConteo(prev => {
          const n = { ...prev };
          n[miReaccion] = Math.max(0, (n[miReaccion]||0) - 1);
          if (n[miReaccion] === 0) delete n[miReaccion];
          return n;
        });
      }
      await setDoc(ref, { emoji, uid: miUid });
      setConteo(prev => ({ ...prev, [emoji]: (prev[emoji]||0) + 1 }));
      setMiReaccion(emoji);
    }
  };

  const tieneReacciones = Object.keys(conteo).some(k => conteo[k] > 0);

  return (
    <div style={{ marginTop:"6px" }}>
      {/* Selector */}
      <div style={{ display:"flex",gap:"3px",flexWrap:"wrap" }}>
        {EMOJIS.map(e => (
          <button key={e} onClick={() => reaccionar(e)}
            style={{
              fontSize:"11px", padding:"2px 4px", cursor:"pointer",
              background: miReaccion===e ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)",
              border: miReaccion===e ? "1px solid rgba(255,255,255,0.5)" : "1px solid transparent",
              borderRadius:"3px", lineHeight:1,
            }}>
            {e}
          </button>
        ))}
      </div>
      {/* Conteo */}
      {tieneReacciones && (
        <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"4px" }}>
          {Object.entries(conteo).filter(([,n])=>n>0).map(([e,n]) => (
            <span key={e} style={{
              fontSize:"9px", background:"rgba(0,0,0,0.25)",
              padding:"1px 5px", border:"1px solid rgba(255,255,255,0.15)",
            }}>
              {e} {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Item de mensaje ───────────────────────────────────────────
function MensajeItem({ mensaje, colorIdx, miUid }) {
  const [fondo, texto] = colorMsg(colorIdx);
  const tieneUrl = mensaje.url && mensaje.url.startsWith("http");
  const tiempo   = labelTiempo(mensaje.fecha, mensaje.hora);

  return (
    <div style={{ padding:"8px 10px",background:fondo,border:`2px solid ${texto}44`,marginBottom:"4px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"3px",gap:"6px",flexWrap:"wrap" }}>
        <span style={{ fontSize:"6px",color:texto,fontFamily:"'Press Start 2P',monospace",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%" }}>
          {mensaje.autor}
        </span>
        <span style={{ fontSize:"5px",color:`${texto}bb`,fontFamily:"'Press Start 2P',monospace",whiteSpace:"nowrap" }}>
          {tiempo}
        </span>
      </div>
      <p style={{ fontSize:"6px",color:texto,lineHeight:1.8,fontFamily:"'Press Start 2P',monospace",wordBreak:"break-word" }}>
        {mensaje.texto}
      </p>
      {tieneUrl && (
        <a href={mensaje.url} target="_blank" rel="noopener noreferrer"
          style={{ display:"block",marginTop:"4px",fontSize:"5px",color:"#56cfe1",
            fontFamily:"'Press Start 2P',monospace",wordBreak:"break-all",textDecoration:"underline" }}>
          🔗 {mensaje.url.length > 40 ? mensaje.url.slice(0,40)+"…" : mensaje.url}
        </a>
      )}
      {/* Reacciones */}
      <Reacciones docId={mensaje.docId} miUid={miUid} />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function VozHinchada() {
  const { firebaseUser, userProfile } = useAuth();
  const [mensajes,    setMensajes]    = useState([]);
  const [cargando,    setCargando]    = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [texto,       setTexto]       = useState("");
  const [url,         setUrl]         = useState("");
  const [enviando,    setEnviando]    = useState(false);
  const [enviado,     setEnviado]     = useState(false);
  const hoy = hoyStr();

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const snap = await getDocs(query(collection(db,"mensajesDia"), orderBy("timestamp","desc")));
      setMensajes(snap.docs.map(d => ({ docId:d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    finally { setCargando(false); }
  };

  const enviar = async () => {
    if (!texto.trim() || !firebaseUser) return;
    setEnviando(true);
    try {
      const ahora = new Date();
      const nuevoMsg = {
        autor:     userProfile?.nickname || firebaseUser.displayName?.split(" ")[0] || "Anónimo",
        texto:     texto.trim().slice(0,200),
        url:       url.trim() || null,
        timestamp: serverTimestamp(),
        fecha:     hoy,
        hora:      `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`,
        uid:       firebaseUser.uid,
      };
      const ref = await addDoc(collection(db,"mensajesDia"), nuevoMsg);
      setMensajes(prev => [{ docId:ref.id, ...nuevoMsg, timestamp:ahora }, ...prev]);
      setTexto(""); setUrl(""); setEnviado(true); setMostrarForm(false);
      setTimeout(() => setEnviado(false), 3000);
    } catch(e) { console.error(e); }
    finally { setEnviando(false); }
  };

  return (
    <div style={{ marginBottom:"16px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px" }}>
        <div className="seccion-titulo" style={{ margin:0 }}>📢 LA VOZ DE LA HINCHADA</div>
        <button className="btn-pixel btn-amarillo" style={{ fontSize:"6px",padding:"5px 10px" }}
          onClick={() => { setMostrarForm(v=>!v); setEnviado(false); }}>
          {mostrarForm ? "✕ CERRAR" : "✏ DEJAR MENSAJE"}
        </button>
      </div>

      {mostrarForm && (
        <div style={{ background:"var(--negro)",border:"3px solid var(--amarillo)",
          boxShadow:"4px 4px 0 var(--amarillo-oscuro)",padding:"14px 12px",
          marginBottom:"10px",display:"flex",flexDirection:"column",gap:"8px" }}>
          <p style={{ fontSize:"6px",color:"var(--amarillo)" }}>📢 TU MENSAJE PARA LA HINCHADA</p>
          <textarea value={texto} onChange={e => setTexto(e.target.value.slice(0,200))}
            placeholder="Escribe algo (máx 200 caracteres)..." rows={3}
            style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
              width:"100%",padding:"8px",border:"2px solid var(--negro)",
              background:"var(--blanco)",color:"var(--negro)",outline:"none",resize:"none",lineHeight:2 }} />
          <p style={{ fontSize:"5px",color:"var(--gris-claro)",textAlign:"right" }}>{texto.length}/200</p>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="URL opcional (ej. https://...)"
            style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
              width:"100%",padding:"6px 8px",border:"2px solid var(--negro)",
              background:"var(--blanco)",color:"var(--negro)",outline:"none" }} />
          <p style={{ fontSize:"5px",color:"var(--gris-claro)",lineHeight:1.8 }}>⚠ Sin spam. Visible para todos.</p>
          <button className="btn-pixel btn-verde w-full" style={{ fontSize:"7px" }}
            onClick={enviar} disabled={enviando||!texto.trim()}>
            {enviando ? "⚙ ENVIANDO..." : "📣 PUBLICAR"}
          </button>
        </div>
      )}

      {enviado && (
        <p style={{ fontSize:"7px",color:"var(--verde-claro)",marginBottom:"8px",textAlign:"center" }}>✅ ¡Mensaje publicado!</p>
      )}

      <div style={{ background:"var(--negro)",border:"3px solid var(--verde-campo)",
        boxShadow:"4px 4px 0 var(--verde-oscuro)",padding:"8px",
        maxHeight:"280px",overflowY:"auto" }}>
        {cargando ? (
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>Cargando mensajes...</p>
        ) : mensajes.length === 0 ? (
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",padding:"16px",lineHeight:2 }}>
            Todavía no hay mensajes.<br/>¡Sé el primero!
          </p>
        ) : (
          mensajes.map((m, i) => (
            <MensajeItem key={m.docId} mensaje={m} colorIdx={i} miUid={firebaseUser?.uid} />
          ))
        )}
      </div>
    </div>
  );
}
