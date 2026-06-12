// src/components/VozHinchada.jsx  — v4 (Fase 1)
// ─────────────────────────────────────────────────────────────
// Sección "📢 LA VOZ DE LA HINCHADA" para la pantalla INICIO.
// • Muestra mensajes en scroll (orden cronológico inverso).
// • Separadores de fecha cuando cambia el día.
// • Colores de fondo rotativos con contraste garantizado.
// • Formulario para dejar mensaje (con URL opcional).
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { hoyStr } from "../utils/helpers";

// Paleta colorinche pixel-art con contraste garantizado
// [fondo, color de texto]
const COLORES_MSG = [
  ["#1a472a", "#52b788"], // verde oscuro / verde claro
  ["#9b1c1c", "#f4d03f"], // rojo oscuro / amarillo
  ["#1a1a5e", "#a8d8ea"], // azul marino / celeste
  ["#4a0e8f", "#e0c3fc"], // violeta / lavanda
  ["#1a3a00", "#b5e48c"], // verde hoja / verde lima
  ["#3d2b00", "#ffd166"], // marrón / amarillo dorado
  ["#003333", "#56cfe1"], // verde agua / cyan
  ["#3b0a0a", "#ff9a76"], // granate / salmón
];

function colorMensaje(idx) {
  return COLORES_MSG[idx % COLORES_MSG.length];
}

function SeparadorFecha({ fecha }) {
  // Convierte "2026-06-12" → "12 de junio"
  const [, m, d] = fecha.split("-").map(Number);
  const meses = ["enero","febrero","marzo","abril","mayo","junio",
                 "julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const label = `${d} de ${meses[m - 1]}`;
  return (
    <div style={{
      display: "flex", alignItems: "center",
      gap: "6px", margin: "6px 0",
    }}>
      <div style={{ flex: 1, height: "1px", background: "var(--verde-campo)" }} />
      <span style={{
        fontFamily: "'Press Start 2P',monospace",
        fontSize: "5px", padding: "3px 8px",
        background: "#f4d03f", color: "#1a1a1a",
        border: "2px solid #d4ac0d",
        boxShadow: "2px 2px 0 #d4ac0d",
        whiteSpace: "nowrap",
      }}>
        📅 {label.toUpperCase()}
      </span>
      <div style={{ flex: 1, height: "1px", background: "var(--verde-campo)" }} />
    </div>
  );
}

function MensajeItem({ mensaje, colorIdx }) {
  const [fondo, texto] = colorMensaje(colorIdx);
  const tieneUrl = mensaje.url && mensaje.url.startsWith("http");

  return (
    <div style={{
      padding: "8px 10px",
      background: fondo,
      border: `2px solid ${texto}44`,
      marginBottom: "4px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "6px", color: texto, fontFamily: "'Press Start 2P',monospace" }}>
          {mensaje.autor}
        </span>
        <span style={{ fontSize: "5px", color: `${texto}99`, fontFamily: "'Press Start 2P',monospace" }}>
          {mensaje.hora}
        </span>
      </div>
      <p style={{
        fontSize: "6px", color: texto, lineHeight: 1.8,
        fontFamily: "'Press Start 2P',monospace",
        wordBreak: "break-word",
      }}>
        {mensaje.texto}
      </p>
      {tieneUrl && (
        <a
          href={mensaje.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", marginTop: "4px",
            fontSize: "5px", color: "#56cfe1",
            fontFamily: "'Press Start 2P',monospace",
            wordBreak: "break-all",
            textDecoration: "underline",
          }}
        >
          🔗 {mensaje.url.length > 40 ? mensaje.url.slice(0, 40) + "…" : mensaje.url}
        </a>
      )}
    </div>
  );
}

export default function VozHinchada() {
  const { firebaseUser, userProfile } = useAuth();
  const [mensajes,       setMensajes]       = useState([]);
  const [cargando,       setCargando]       = useState(true);
  const [mostrarForm,    setMostrarForm]    = useState(false);
  const [texto,          setTexto]          = useState("");
  const [url,            setUrl]            = useState("");
  const [enviando,       setEnviando]       = useState(false);
  const [enviado,        setEnviado]        = useState(false);

  const hoy = hoyStr();

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const snap = await getDocs(
        query(collection(db, "mensajesDia"), orderBy("timestamp", "desc"))
      );
      setMensajes(snap.docs.map((d) => ({ docId: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  const enviar = async () => {
    if (!texto.trim() || !firebaseUser) return;
    setEnviando(true);
    try {
      const ahora = new Date();
      const nuevoMsg = {
        autor:     userProfile?.nickname || firebaseUser.displayName?.split(" ")[0] || "Anónimo",
        texto:     texto.trim().slice(0, 200),
        url:       url.trim() || null,
        timestamp: serverTimestamp(),
        fecha:     hoy,
        hora:      `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`,
        uid:       firebaseUser.uid,
      };
      const ref = await addDoc(collection(db, "mensajesDia"), nuevoMsg);
      // Insertar al inicio (orden inverso)
      setMensajes((prev) => [{ docId: ref.id, ...nuevoMsg, timestamp: ahora }, ...prev]);
      setTexto("");
      setUrl("");
      setEnviado(true);
      setMostrarForm(false);
      setTimeout(() => setEnviado(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setEnviando(false);
    }
  };

  // Renderizar mensajes con separadores de fecha
  const renderMensajes = () => {
    let ultimaFecha = null;
    let colorIdx    = 0;
    const elementos = [];

    for (const m of mensajes) {
      const fechaMsg = m.fecha || hoy;
      if (fechaMsg !== ultimaFecha) {
        if (ultimaFecha !== null) {
          elementos.push(
            <SeparadorFecha key={`sep-${fechaMsg}`} fecha={fechaMsg} />
          );
        }
        ultimaFecha = fechaMsg;
      }
      elementos.push(
        <MensajeItem key={m.docId} mensaje={m} colorIdx={colorIdx} />
      );
      colorIdx++;
    }
    return elementos;
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "10px",
      }}>
        <div className="seccion-titulo" style={{ margin: 0 }}>
          📢 LA VOZ DE LA HINCHADA
        </div>
        <button
          className="btn-pixel btn-amarillo"
          style={{ fontSize: "6px", padding: "5px 10px" }}
          onClick={() => { setMostrarForm((v) => !v); setEnviado(false); }}
        >
          {mostrarForm ? "✕ CERRAR" : "✏ DEJAR MENSAJE"}
        </button>
      </div>

      {/* Formulario para nuevo mensaje */}
      {mostrarForm && (
        <div style={{
          background: "var(--negro)",
          border: "3px solid var(--amarillo)",
          boxShadow: "4px 4px 0 var(--amarillo-oscuro)",
          padding: "14px 12px",
          marginBottom: "10px",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <p style={{ fontSize: "6px", color: "var(--amarillo)" }}>
            📢 TU MENSAJE PARA LA HINCHADA
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 200))}
            placeholder="Escribe algo (máx 200 caracteres)..."
            rows={3}
            style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: "7px",
              width: "100%", padding: "8px",
              border: "2px solid var(--negro)", background: "var(--blanco)",
              color: "var(--negro)", outline: "none", resize: "none", lineHeight: 2,
            }}
          />
          <p style={{ fontSize: "5px", color: "var(--gris-claro)", textAlign: "right" }}>
            {texto.length}/200
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL opcional (ej. https://...)"
            style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: "6px",
              width: "100%", padding: "6px 8px",
              border: "2px solid var(--negro)", background: "var(--blanco)",
              color: "var(--negro)", outline: "none",
            }}
          />
          <p style={{ fontSize: "5px", color: "var(--gris-claro)", lineHeight: 1.8 }}>
            ⚠ Sin spam. Esto se ve en público.
          </p>
          <button
            className="btn-pixel btn-verde w-full"
            style={{ fontSize: "7px" }}
            onClick={enviar}
            disabled={enviando || !texto.trim()}
          >
            {enviando ? "⚙ ENVIANDO..." : "📣 PUBLICAR"}
          </button>
        </div>
      )}

      {enviado && (
        <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px", textAlign: "center" }}>
          ✅ ¡Mensaje publicado!
        </p>
      )}

      {/* Caja de mensajes con scroll */}
      <div style={{
        background: "var(--negro)",
        border: "3px solid var(--verde-campo)",
        boxShadow: "4px 4px 0 var(--verde-oscuro)",
        padding: "8px",
        maxHeight: "260px",
        overflowY: "auto",
        position: "relative",
      }}>
        {cargando ? (
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", textAlign: "center", padding: "16px" }}>
            Cargando mensajes...
          </p>
        ) : mensajes.length === 0 ? (
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", textAlign: "center", padding: "16px", lineHeight: 2 }}>
            Todavía no hay mensajes.<br />¡Sé el primero!
          </p>
        ) : (
          renderMensajes()
        )}
      </div>
    </div>
  );
}
