// src/components/PreguntaCard.jsx  — v2 (Bugfix 3)
// ─────────────────────────────────────────────────────────────
// FIX 5: Añade estadísticas de votación por opción.
//   • Al cargar, consulta la colección `respuestas` filtrando
//     por preguntaId y muestra % por opción.
//   • Barras de porcentaje con colores distintos por opción.
//   • No muestra estadísticas hasta que el usuario ha guardado
//     su respuesta (para no influir antes de votar).
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// Colores por índice de opción (barra)
const COLORES_OPCIONES = ["#4ade80","#facc15","#f87171","#60a5fa","#c084fc"];

export default function PreguntaCard({ pregunta }) {
  const { firebaseUser } = useAuth();
  const { id, texto, opciones, respuestaCorrecta } = pregunta;

  const [seleccion,  setSeleccion]  = useState(null);
  const [guardado,   setGuardado]   = useState(false);
  const [guardando,  setGuardando]  = useState(false);
  const [stats,      setStats]      = useState(null); // Fix 5: estadísticas

  // Cargar respuesta existente del usuario
  useEffect(() => {
    if (!firebaseUser) return;
    const cargar = async () => {
      const ref  = doc(db, "respuestas", `${firebaseUser.uid}_${id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setSeleccion(snap.data().respuesta);
        setGuardado(true);
      }
    };
    cargar();
  }, [firebaseUser, id]);

  // Fix 5: cargar estadísticas cuando el usuario ya votó
  useEffect(() => {
    if (!guardado || !id) return;
    const cargarStats = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "respuestas"), where("preguntaId", "==", id)
        ));
        if (snap.empty) return;
        const conteo = {};
        for (const op of (opciones || [])) conteo[op] = 0;
        snap.docs.forEach(d => {
          const r = d.data().respuesta;
          if (r) conteo[r] = (conteo[r]||0) + 1;
        });
        const total = Object.values(conteo).reduce((s,n)=>s+n,0);
        if (total === 0) return;
        const pcts = {};
        for (const [op, n] of Object.entries(conteo)) {
          pcts[op] = Math.round((n/total)*100);
        }
        setStats({ total, pcts });
      } catch(e) { console.error(e); }
    };
    cargarStats();
  }, [guardado, id, opciones]);

  const handleGuardar = async () => {
    if (!seleccion) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, "respuestas", `${firebaseUser.uid}_${id}`), {
        uid:       firebaseUser.uid,
        preguntaId: id,
        respuesta:  seleccion,
        guardadoEn: new Date().toISOString(),
      });
      setGuardado(true);
    } catch (e) {
      console.error("Error guardando respuesta:", e);
    } finally {
      setGuardando(false);
    }
  };

  const colorOpcion = (op) => {
    if (!guardado || !respuestaCorrecta) {
      return seleccion === op ? "seleccionado" : "";
    }
    if (op === respuestaCorrecta)    return "seleccionado";
    if (op === seleccion && seleccion !== respuestaCorrecta) return "";
    return "";
  };

  return (
    <div className="pregunta-card">
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"10px" }}>
        🎯 PREGUNTA DEL DÍA — 2 PUNTOS
      </p>
      <p className="pregunta-texto">{texto}</p>

      <div className="pregunta-opciones">
        {(opciones||[]).map((op, i) => (
          <button
            key={i}
            className={`pred-btn ${colorOpcion(op)}`}
            onClick={() => !guardado && setSeleccion(op)}
            disabled={guardado}
            style={{ padding:"8px",fontSize:"7px",lineHeight:1.8 }}
          >
            {op}
          </button>
        ))}
      </div>

      {!guardado ? (
        <button
          className="btn-pixel btn-amarillo w-full"
          style={{ marginTop:"12px" }}
          onClick={handleGuardar}
          disabled={!seleccion || guardando}
        >
          {guardando ? "GUARDANDO..." : "RESPONDER"}
        </button>
      ) : (
        <>
          <div style={{
            marginTop:"10px",
            fontSize:"7px",
            color: respuestaCorrecta
              ? seleccion === respuestaCorrecta
                ? "var(--verde-claro)"
                : "var(--rojo-chile)"
              : "var(--gris-claro)",
            textAlign:"center",
            padding:"6px",
            border:`2px solid ${respuestaCorrecta
              ? seleccion === respuestaCorrecta
                ? "var(--verde-claro)"
                : "var(--rojo-chile)"
              : "var(--gris)"}`,
          }}>
            {respuestaCorrecta
              ? seleccion === respuestaCorrecta
                ? "✅ ¡CORRECTO! +2 PUNTOS"
                : `❌ INCORRECTO. Era: ${respuestaCorrecta}`
              : "✓ Respuesta guardada"}
          </div>

          {/* Fix 5: estadísticas de votación */}
          {stats && (
            <div style={{ marginTop:"10px",padding:"8px 10px",
              border:"1px solid rgba(82,183,136,0.3)",
              background:"rgba(0,0,0,0.25)" }}>
              <p style={{ fontSize:"5px",color:"var(--gris-claro)",
                marginBottom:"6px",letterSpacing:"1px" }}>
                CÓMO VOTÓ LA HINCHADA ({stats.total} votos)
              </p>
              {(opciones||[]).map((op,i) => {
                const pct = stats.pcts[op] ?? 0;
                const color = COLORES_OPCIONES[i % COLORES_OPCIONES.length];
                const esCorrecta = op === respuestaCorrecta;
                return (
                  <div key={i} style={{ marginBottom:"5px" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",
                      marginBottom:"2px",alignItems:"center" }}>
                      <span style={{ fontSize:"5px",color:"var(--gris-claro)",
                        maxWidth:"75%",overflow:"hidden",textOverflow:"ellipsis",
                        whiteSpace:"nowrap" }}>
                        {esCorrecta && "✅ "}{op}
                      </span>
                      <span style={{ fontSize:"5px",color,
                        fontFamily:"'Press Start 2P',monospace",
                        flexShrink:0,marginLeft:"6px" }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ height:"5px",background:"rgba(255,255,255,0.1)" }}>
                      <div style={{ height:"100%",
                        width:`${pct}%`,background:color,
                        transition:"width 0.5s ease",
                        border:esCorrecta?"1px solid rgba(255,255,255,0.3)":"none" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
