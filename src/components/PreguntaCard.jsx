import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function PreguntaCard({ pregunta }) {
  const { firebaseUser } = useAuth();
  const { id, texto, opciones, respuestaCorrecta } = pregunta;

  const [seleccion, setSeleccion] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const cargar = async () => {
      const ref = doc(db, "respuestas", `${firebaseUser.uid}_${id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setSeleccion(snap.data().respuesta);
        setGuardado(true);
      }
    };
    cargar();
  }, [firebaseUser, id]);

  const handleGuardar = async () => {
    if (!seleccion) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, "respuestas", `${firebaseUser.uid}_${id}`), {
        uid: firebaseUser.uid,
        preguntaId: id,
        respuesta: seleccion,
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
    // Si ya está guardado y hay respuesta correcta: mostrar feedback
    if (op === respuestaCorrecta) return "seleccionado"; // verde
    if (op === seleccion && seleccion !== respuestaCorrecta) return ""; // error
    return "";
  };

  return (
    <div className="pregunta-card">
      <p style={{ fontSize: "7px", color: "var(--amarillo)", marginBottom: "10px" }}>
        🎯 PREGUNTA DEL DÍA — 2 PUNTOS
      </p>
      <p className="pregunta-texto">{texto}</p>

      <div className="pregunta-opciones">
        {opciones.map((op, i) => (
          <button
            key={i}
            className={`pred-btn ${colorOpcion(op)}`}
            onClick={() => !guardado && setSeleccion(op)}
            disabled={guardado}
            style={{ padding: "8px", fontSize: "7px", lineHeight: 1.8 }}
          >
            {op}
          </button>
        ))}
      </div>

      {!guardado ? (
        <button
          className="btn-pixel btn-amarillo w-full"
          style={{ marginTop: "12px" }}
          onClick={handleGuardar}
          disabled={!seleccion || guardando}
        >
          {guardando ? "GUARDANDO..." : "RESPONDER"}
        </button>
      ) : (
        <div style={{
          marginTop: "10px",
          fontSize: "7px",
          color: respuestaCorrecta
            ? seleccion === respuestaCorrecta
              ? "var(--verde-claro)"
              : "var(--rojo-chile)"
            : "var(--gris-claro)",
          textAlign: "center",
          padding: "6px",
          border: `2px solid ${respuestaCorrecta
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
      )}
    </div>
  );
}
