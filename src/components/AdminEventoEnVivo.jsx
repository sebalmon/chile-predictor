// src/components/AdminEventoEnVivo.jsx
// ─────────────────────────────────────────────────────────────
// Panel de administración para EVENTO EN VIVO independiente.
// No depende de partidos — el admin configura todo manualmente.
//
// ESTRUCTURA en Firestore:
//   eventoEnVivo/actual  →  {
//     activo: true/false,
//     equipoLocal:    { nombre, bandera },
//     equipoVisitante:{ nombre, bandera },
//     imagenFondo:    "A_PAISES_MARRUECOS.jpg"  (en /public/)
//     pregunta: {
//       id, texto, opciones, estado:"abierta"|"cerrada"|null,
//       respuestaCorrecta, puntosEnVivo, creadaEn
//     }
//   }
//   eventoEnVivo/actual/respuestas/{uid} → { uid, respuesta, timestamp }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import {
  doc, onSnapshot, setDoc, updateDoc,
  collection, getDocs, writeBatch, increment, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const REF_EVENTO  = () => doc(db, "eventoEnVivo", "actual");
const REF_RESPS   = () => collection(db, "eventoEnVivo", "actual", "respuestas");

// Emojis de banderas más usados para selector rápido
const BANDERAS = [
  "🇦🇷","🇧🇷","🇨🇱","🇺🇾","🇩🇪","🇫🇷","🇪🇸","🇵🇹","🇮🇹",
  "🇬🇧","🇳🇱","🇧🇪","🇨🇷","🇲🇽","🇨🇴","🇵🇪","🇵🇾","🇪🇨",
  "🇺🇸","🇯🇵","🇰🇷","🇲🇦","🇸🇳","🇬🇭","🇨🇲","🇨🇭","🇦🇹",
  "🇵🇱","🇭🇷","🇸🇪","🇩🇰","🇳🇴","🇦🇺","🇳🇿","🇸🇦","🇮🇷",
];

export default function AdminEventoEnVivo({ onMensaje }) {
  const [evento,    setEvento]    = useState(null);
  const [cargando,  setCargando]  = useState(true);
  const unsubRef = useRef(null);

  // Estados del formulario de configuración
  const [nombreL,   setNombreL]   = useState("");
  const [banderaL,  setBanderaL]  = useState("🏳️");
  const [nombreV,   setNombreV]   = useState("");
  const [banderaV,  setBanderaV]  = useState("🏳️");
  const [imagen,    setImagen]    = useState("");
  const [selBand,   setSelBand]   = useState(null); // "L" o "V"

  // Estados del formulario de pregunta
  const [textoPrg,  setTextoPrg]  = useState("");
  const [opciones,  setOpciones]  = useState(["",""]);
  const [puntos,    setPuntos]    = useState(3);
  const [creando,   setCreando]   = useState(false);

  // Estado de cierre
  const [respSel,   setRespSel]   = useState("");
  const [cerrando,  setCerrando]  = useState(false);

  // Escuchar evento en tiempo real
  useEffect(() => {
    unsubRef.current = onSnapshot(REF_EVENTO(), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setEvento(d);
        // Pre-rellenar formulario con datos existentes
        setNombreL(d.equipoLocal?.nombre   || "");
        setBanderaL(d.equipoLocal?.bandera || "🏳️");
        setNombreV(d.equipoVisitante?.nombre   || "");
        setBanderaV(d.equipoVisitante?.bandera || "🏳️");
        setImagen(d.imagenFondo || "");
      } else {
        setEvento(null);
      }
      setCargando(false);
    }, () => setCargando(false));
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // ── Guardar configuración del evento ────────────────────────
  const guardarConfig = async () => {
    if (!nombreL.trim() || !nombreV.trim()) {
      onMensaje("error", "Escribe el nombre de ambos equipos."); return;
    }
    try {
      const datos = {
        activo: true,
        equipoLocal:     { nombre: nombreL.trim(), bandera: banderaL },
        equipoVisitante: { nombre: nombreV.trim(), bandera: banderaV },
        imagenFondo:     imagen.trim() || null,
        // Mantener pregunta existente si la hay
        pregunta: evento?.pregunta || null,
      };
      await setDoc(REF_EVENTO(), datos);
      onMensaje("ok", `✅ Evento configurado: ${banderaL} ${nombreL} vs ${nombreV} ${banderaV}`);
    } catch (e) { onMensaje("error", e.message); }
  };

  // ── Desactivar evento ────────────────────────────────────────
  const desactivar = async () => {
    try {
      await updateDoc(REF_EVENTO(), { activo: false });
      onMensaje("ok", "Evento desactivado. Los usuarios ya no lo ven.");
    } catch (e) { onMensaje("error", e.message); }
  };

  // ── Publicar pregunta ────────────────────────────────────────
  const publicarPregunta = async () => {
    const optsValidas = opciones.filter(o => o.trim());
    if (!textoPrg.trim()) { onMensaje("error", "Escribe la pregunta."); return; }
    if (optsValidas.length < 2) { onMensaje("error", "Agrega al menos 2 opciones."); return; }
    if (evento?.pregunta?.estado === "abierta") {
      onMensaje("error", "Hay una pregunta abierta. Ciérrala primero."); return;
    }
    setCreando(true);
    try {
      const pregNueva = {
        id:                `pev_${Date.now()}`,
        texto:             textoPrg.trim(),
        opciones:          optsValidas,
        estado:            "abierta",
        respuestaCorrecta: null,
        puntosEnVivo:      Number(puntos),
        creadaEn:          new Date().toISOString(),
      };
      await updateDoc(REF_EVENTO(), { pregunta: pregNueva });
      // Limpiar respuestas anteriores
      const snapR = await getDocs(REF_RESPS());
      const batch = writeBatch(db);
      snapR.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      onMensaje("ok", `🔴 Pregunta publicada. Los usuarios la ven ahora. (+${puntos} pts)`);
      setTextoPrg(""); setOpciones(["",""]); setPuntos(3); setRespSel("");
    } catch (e) { onMensaje("error", e.message); }
    finally { setCreando(false); }
  };

  // ── Cerrar pregunta y dar puntos ────────────────────────────
  const cerrarPregunta = async () => {
    if (!respSel) { onMensaje("error", "Selecciona la respuesta correcta."); return; }
    setCerrando(true);
    try {
      const pts = evento?.pregunta?.puntosEnVivo || 3;

      // 1. Marcar cerrada
      await updateDoc(REF_EVENTO(), {
        "pregunta.estado":            "cerrada",
        "pregunta.respuestaCorrecta": respSel,
      });

      // 2. Leer respuestas y dar puntos en batch
      const snapR = await getDocs(REF_RESPS());
      const batch = writeBatch(db);
      let acertaron = 0;
      snapR.docs.forEach(d => {
        if (d.data().respuesta === respSel) {
          batch.update(doc(db, "usuarios", d.data().uid), {
            puntosTotal: increment(pts),
          });
          acertaron++;
        }
      });
      await batch.commit();

      onMensaje("ok",
        `✅ Cerrada. ${acertaron} de ${snapR.size} usuarios acertaron → +${pts} pts c/u.`
      );
      setRespSel("");
    } catch (e) { onMensaje("error", e.message); }
    finally { setCerrando(false); }
  };

  // ── Render ──────────────────────────────────────────────────
  if (cargando) return (
    <p style={{ fontSize:"6px", color:"var(--gris-claro)", padding:"16px" }}>
      ⚙ Cargando...
    </p>
  );

  const pregunta = evento?.pregunta;
  const estaActivo = evento?.activo === true;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

      {/* ═══ SECCIÓN 1: CONFIGURAR EVENTO ══════════════════════ */}
      <div style={{ border:"2px solid var(--amarillo)", padding:"12px" }}>
        <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>
          ⚙ CONFIGURAR EVENTO EN VIVO
        </p>

        {/* Estado actual */}
        {estaActivo && (
          <div style={{ padding:"8px", marginBottom:"12px",
            background:"rgba(214,40,40,0.1)", border:"2px solid var(--rojo-chile)" }}>
            <p style={{ fontSize:"6px", color:"var(--rojo-chile)", lineHeight:2 }}>
              🔴 EVENTO ACTIVO:{" "}
              {evento.equipoLocal?.bandera} {evento.equipoLocal?.nombre} vs{" "}
              {evento.equipoVisitante?.nombre} {evento.equipoVisitante?.bandera}
            </p>
          </div>
        )}

        {/* Equipos */}
        <div style={{ display:"flex", gap:"10px", marginBottom:"10px" }}>
          {/* Local */}
          <div style={{ flex:1 }}>
            <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
              EQUIPO LOCAL
            </p>
            <div style={{ display:"flex", gap:"4px", marginBottom:"4px" }}>
              <span style={{ fontSize:"20px", lineHeight:"32px" }}>{banderaL}</span>
              <button
                onClick={() => setSelBand(selBand==="L" ? null : "L")}
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                  padding:"3px 6px", cursor:"pointer",
                  border:`1px solid ${selBand==="L"?"var(--amarillo)":"var(--gris)"}`,
                  background: selBand==="L"?"rgba(244,208,63,0.15)":"transparent",
                  color:"var(--gris-claro)" }}>
                CAMBIAR
              </button>
            </div>
            <input value={nombreL} onChange={e => setNombreL(e.target.value)}
              placeholder="Marruecos"
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                width:"100%", padding:"5px 7px", border:"2px solid var(--negro)",
                background:"var(--blanco)", color:"var(--negro)", outline:"none" }} />
          </div>
          {/* Visitante */}
          <div style={{ flex:1 }}>
            <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
              EQUIPO VISITANTE
            </p>
            <div style={{ display:"flex", gap:"4px", marginBottom:"4px" }}>
              <span style={{ fontSize:"20px", lineHeight:"32px" }}>{banderaV}</span>
              <button
                onClick={() => setSelBand(selBand==="V" ? null : "V")}
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                  padding:"3px 6px", cursor:"pointer",
                  border:`1px solid ${selBand==="V"?"var(--amarillo)":"var(--gris)"}`,
                  background: selBand==="V"?"rgba(244,208,63,0.15)":"transparent",
                  color:"var(--gris-claro)" }}>
                CAMBIAR
              </button>
            </div>
            <input value={nombreV} onChange={e => setNombreV(e.target.value)}
              placeholder="Países Bajos"
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                width:"100%", padding:"5px 7px", border:"2px solid var(--negro)",
                background:"var(--blanco)", color:"var(--negro)", outline:"none" }} />
          </div>
        </div>

        {/* Selector de bandera */}
        {selBand && (
          <div style={{ marginBottom:"10px", padding:"8px",
            border:"1px solid var(--amarillo)", background:"rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize:"5px", color:"var(--amarillo)", marginBottom:"6px" }}>
              SELECCIONA BANDERA {selBand==="L" ? "LOCAL" : "VISITANTE"}:
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
              {BANDERAS.map(b => (
                <button key={b} onClick={() => {
                    if (selBand==="L") setBanderaL(b);
                    else setBanderaV(b);
                    setSelBand(null);
                  }}
                  style={{ fontSize:"18px", padding:"3px", cursor:"pointer",
                    border:"1px solid transparent", background:"transparent",
                    borderRadius:"2px" }}
                  onMouseEnter={e => e.target.style.background="rgba(255,255,255,0.1)"}
                  onMouseLeave={e => e.target.style.background="transparent"}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Imagen de fondo */}
        <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
          IMAGEN DE FONDO (archivo en /public/ — ej: A_PAISES_MARRUECOS.jpg)
        </p>
        <input value={imagen} onChange={e => setImagen(e.target.value)}
          placeholder="A_PAISES_MARRUECOS.jpg"
          style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            width:"100%", padding:"5px 7px", border:"2px solid var(--negro)",
            background:"var(--blanco)", color:"var(--negro)",
            outline:"none", marginBottom:"10px" }} />

        <div style={{ display:"flex", gap:"8px" }}>
          <button className="btn-pixel btn-rojo" style={{ flex:2, fontSize:"7px" }}
            onClick={guardarConfig}>
            🔴 ACTIVAR EVENTO
          </button>
          {estaActivo && (
            <button className="btn-pixel btn-gris" style={{ flex:1, fontSize:"6px" }}
              onClick={desactivar}>
              DESACTIVAR
            </button>
          )}
        </div>
      </div>

      {/* ═══ SECCIÓN 2: PREGUNTA EN VIVO ═══════════════════════ */}
      {estaActivo && (
        <div style={{ border:"2px solid var(--rojo-chile)", padding:"12px" }}>
          <p style={{ fontSize:"7px", color:"var(--rojo-chile)", marginBottom:"12px" }}>
            ❓ PREGUNTA EN VIVO
          </p>

          {/* Pregunta abierta actualmente */}
          {pregunta?.estado === "abierta" && (
            <div style={{ padding:"12px", marginBottom:"12px",
              background:"rgba(214,40,40,0.06)",
              border:"2px solid var(--rojo-chile)",
              boxShadow:"0 0 16px rgba(214,40,40,0.2)" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                marginBottom:"10px" }}>
                <span style={{ fontSize:"6px", color:"var(--rojo-chile)" }}>
                  🔴 ABIERTA — USUARIOS RESPONDIENDO
                </span>
                <span style={{ fontSize:"5px", color:"var(--amarillo)",
                  border:"1px solid var(--amarillo)", padding:"2px 6px" }}>
                  +{pregunta.puntosEnVivo} PTS
                </span>
              </div>
              <p style={{ fontSize:"8px", color:"var(--blanco)",
                lineHeight:2, marginBottom:"12px" }}>
                {pregunta.texto}
              </p>
              <p style={{ fontSize:"6px", color:"var(--verde-claro)", marginBottom:"6px" }}>
                MARCA LA RESPUESTA CORRECTA:
              </p>
              <div style={{ display:"flex", flexDirection:"column",
                gap:"5px", marginBottom:"12px" }}>
                {(pregunta.opciones||[]).map((op,i) => (
                  <button key={i} onClick={() => setRespSel(op)}
                    style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                      padding:"8px 10px", cursor:"pointer", textAlign:"left",
                      border:`2px solid ${respSel===op?"var(--verde-claro)":"var(--gris)"}`,
                      background:respSel===op?"rgba(82,183,136,0.15)":"transparent",
                      color:"var(--blanco)" }}>
                    {respSel===op ? "✅ " : ""}{op}
                  </button>
                ))}
              </div>
              <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
                onClick={cerrarPregunta}
                disabled={!respSel || cerrando}>
                {cerrando
                  ? "⚙ PROCESANDO..."
                  : `🔒 CERRAR Y DAR +${pregunta.puntosEnVivo} PTS`}
              </button>
            </div>
          )}

          {/* Resultado de la última pregunta cerrada */}
          {pregunta?.estado === "cerrada" && (
            <div style={{ padding:"10px", marginBottom:"12px",
              border:"1px solid var(--verde-campo)",
              background:"rgba(82,183,136,0.06)", fontSize:"6px", lineHeight:2 }}>
              <p style={{ color:"var(--verde-claro)" }}>✅ ÚLTIMA PREGUNTA CERRADA</p>
              <p style={{ color:"var(--blanco)" }}>{pregunta.texto}</p>
              <p>Correcta: <span style={{ color:"var(--amarillo)" }}>
                {pregunta.respuestaCorrecta}
              </span></p>
            </div>
          )}

          {/* Formulario nueva pregunta (solo si no hay abierta) */}
          {pregunta?.estado !== "abierta" && (
            <div style={{ padding:"12px", border:"2px solid rgba(255,255,255,0.1)",
              background:"rgba(0,0,0,0.2)" }}>
              <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>
                + NUEVA PREGUNTA
              </p>

              <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"4px" }}>
                PREGUNTA:
              </p>
              <textarea value={textoPrg} onChange={e => setTextoPrg(e.target.value)}
                rows={2} placeholder="Ej: ¿Habrá gol antes del minuto 60?"
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                  width:"100%", padding:"8px", border:"3px solid var(--negro)",
                  background:"var(--blanco)", color:"var(--negro)",
                  outline:"none", resize:"none", lineHeight:2,
                  marginBottom:"10px" }} />

              <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                OPCIONES:
              </p>
              <div style={{ display:"flex", flexDirection:"column",
                gap:"5px", marginBottom:"10px" }}>
                {opciones.map((op,i) => (
                  <div key={i} style={{ display:"flex", gap:"5px" }}>
                    <input value={op}
                      onChange={e => setOpciones(prev =>
                        prev.map((o,idx) => idx===i ? e.target.value : o))}
                      placeholder={`Opción ${i+1}`}
                      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
                        flex:1, padding:"5px 8px", border:"2px solid var(--negro)",
                        background:"var(--blanco)", color:"var(--negro)",
                        outline:"none" }} />
                    {opciones.length > 2 && (
                      <button onClick={() =>
                        setOpciones(prev => prev.filter((_,idx) => idx!==i))}
                        style={{ background:"var(--rojo-chile)", color:"var(--blanco)",
                          border:"none", cursor:"pointer", padding:"4px 8px",
                          fontFamily:"'Press Start 2P',monospace", fontSize:"8px" }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {opciones.length < 5 && (
                <button className="btn-pixel btn-gris w-full"
                  style={{ fontSize:"5px", marginBottom:"10px" }}
                  onClick={() => setOpciones(prev => [...prev,""])}>
                  + AGREGAR OPCIÓN
                </button>
              )}

              <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"5px" }}>
                PUNTAJE:
              </p>
              <div style={{ display:"flex", alignItems:"center",
                gap:"5px", marginBottom:"12px", flexWrap:"wrap" }}>
                {[1,2,3,5,7,10].map(n => (
                  <button key={n} onClick={() => setPuntos(n)}
                    style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                      width:"33px", height:"33px", cursor:"pointer",
                      border:`2px solid ${puntos===n?"var(--amarillo)":"var(--gris)"}`,
                      background:puntos===n?"rgba(244,208,63,0.2)":"transparent",
                      color:puntos===n?"var(--amarillo)":"var(--gris-claro)" }}>
                    +{n}
                  </button>
                ))}
                <input type="number" min="1" max="99" value={puntos}
                  onChange={e => setPuntos(Math.max(1,Math.min(99,Number(e.target.value)||1)))}
                  style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
                    width:"44px", height:"33px", textAlign:"center",
                    border:"2px solid var(--amarillo)",
                    background:"var(--negro)", color:"var(--amarillo)",
                    outline:"none" }} />
              </div>

              <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
                onClick={publicarPregunta} disabled={creando}>
                {creando ? "⚙ PUBLICANDO..." : `🔴 PUBLICAR (+${puntos} pts)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
