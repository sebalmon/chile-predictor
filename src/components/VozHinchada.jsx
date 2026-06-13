// src/components/VozHinchada.jsx  — v6 (Fase 3)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v6:
//   • En lugar de separadores de fecha entre mensajes, cada mensaje
//     muestra "Autor · HOY · HH:MM" si es de hoy, o
//     "Autor · DD/MM · HH:MM" si es de un día anterior.
//   • Elimina los separadores de fecha (que confundían a los usuarios).
//   • Todo lo demás igual a v4/v5.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { hoyStr } from "../utils/helpers";

const COLORES_MSG = [
  ["#1a472a", "#52b788"],
  ["#9b1c1c", "#f4d03f"],
  ["#1a1a5e", "#a8d8ea"],
  ["#4a0e8f", "#e0c3fc"],
  ["#1a3a00", "#b5e48c"],
  ["#3d2b00", "#ffd166"],
  ["#003333", "#56cfe1"],
  ["#3b0a0a", "#ff9a76"],
];

function colorMsg(idx) { return COLORES_MSG[idx % COLORES_MSG.length]; }

function labelTiempo(fechaStr, horaStr) {
  const hoy = hoyStr();
  if (fechaStr === hoy) return `HOY · ${horaStr}`;
  // Formato DD/MM para días anteriores
  const [, m, d] = (fechaStr || "").split("-");
  return m && d ? `${d}/${m} · ${horaStr}` : horaStr;
}

function MensajeItem({ mensaje, colorIdx }) {
  const [fondo, texto] = colorMsg(colorIdx);
  const tieneUrl = mensaje.url && mensaje.url.startsWith("http");
  const tiempo   = labelTiempo(mensaje.fecha, mensaje.hora);

  return (
    <div style={{
      padding:"8px 10px",
      background: fondo,
      border:`2px solid ${texto}44`,
      marginBottom:"4px",
    }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"3px",gap:"6px",flexWrap:"wrap" }}>
        <span style={{ fontSize:"6px",color:texto,fontFamily:"'Press Start 2P',monospace",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%" }}>
          {mensaje.autor}
        </span>
        <span style={{ fontSize:"5px",color:`${texto}bb`,fontFamily:"'Press Start 2P',monospace",
          whiteSpace:"nowrap" }}>
          {tiempo}
        </span>
      </div>
      <p style={{ fontSize:"6px",color:texto,lineHeight:1.8,
        fontFamily:"'Press Start 2P',monospace",wordBreak:"break-word" }}>
        {mensaje.texto}
      </p>
      {tieneUrl && (
        <a href={mensaje.url} target="_blank" rel="noopener noreferrer"
          style={{ display:"block",marginTop:"4px",fontSize:"5px",color:"#56cfe1",
            fontFamily:"'Press Start 2P',monospace",wordBreak:"break-all",textDecoration:"underline" }}>
          🔗 {mensaje.url.length > 40 ? mensaje.url.slice(0,40)+"…" : mensaje.url}
        </a>
      )}
    </div>
  );
}

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
      const snap = await getDocs(
        query(collection(db,"mensajesDia"), orderBy("timestamp","desc"))
      );
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
        <button className="btn-pixel btn-amarillo"
          style={{ fontSize:"6px",padding:"5px 10px" }}
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
              background:"var(--blanco)",color:"var(--negro)",
              outline:"none",resize:"none",lineHeight:2 }} />
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
        maxHeight:"260px",overflowY:"auto" }}>
        {cargando ? (
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>Cargando mensajes...</p>
        ) : mensajes.length === 0 ? (
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",textAlign:"center",padding:"16px",lineHeight:2 }}>
            Todavía no hay mensajes.<br />¡Sé el primero!
          </p>
        ) : (
          mensajes.map((m, i) => <MensajeItem key={m.docId} mensaje={m} colorIdx={i} />)
        )}
      </div>
    </div>
  );
}
