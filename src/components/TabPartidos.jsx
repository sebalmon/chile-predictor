// src/components/TabPartidos.jsx
// ─────────────────────────────────────────────────────────────
// Pestaña PARTIDOS: lista de partidos del día.
// La pregunta del día aparece en modal solo cuando el usuario
// haya guardado predicción en TODOS los partidos abiertos.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { PARTIDOS_EJEMPLO, PREGUNTAS_EJEMPLO } from "../data/sampleData";
import { hoyStr, partidoAbierto } from "../utils/helpers";
import PartidoCard from "./PartidoCard";
import PreguntaCard from "./PreguntaCard";

export default function TabPartidos() {
  const { firebaseUser } = useAuth();
  const [partidos,    setPartidos]    = useState([]);
  const [pregunta,    setPregunta]    = useState(null);
  const [mostrarPregModal, setMostrarPregModal] = useState(false);
  const [cargando,    setCargando]    = useState(true);
  const [prediccionesGuardadas, setPrediccionesGuardadas] = useState(new Set());

  const hoy = hoyStr();

  useEffect(() => {
    cargarDatos();
  }, []);

  // Refrescar estado de predicciones cada vez que la pantalla está activa
  useEffect(() => {
    if (firebaseUser && partidos.length > 0) verificarPrediccionesTodas();
  }, [partidos, firebaseUser]);

  const cargarDatos = async () => {
    setCargando(true);
    // Fecha límite: 11 de junio de 2026
const fechaInicioMundial = new Date("2026-06-11T00:00:00");
const hoyDate = new Date();
hoyDate.setHours(0,0,0,0);

if (hoyDate < fechaInicioMundial) {
  // Antes del mundial: mostrar los dos primeros partidos del día 11
  const dosPrimerosPartidos = [
    {
      id: "partido_001",  // Asegúrate que este ID exista en Firestore o usa uno temporal
      fecha: "2026-06-11",
      horaInicio: "15:00",
      local: { nombre: "México", bandera: "🇲🇽" },
      visitante: { nombre: "Sudáfrica", bandera: "🇿🇦" },
      fase: "grupos",
      estaDestacado: true,
      resultado: null,
    },
    {
      id: "partido_002",
      fecha: "2026-06-11",
      horaInicio: "22:00",
      local: { nombre: "Corea del Sur", bandera: "🇰🇷" },
      visitante: { nombre: "República Checa", bandera: "🇨🇿" },
      fase: "grupos",
      estaDestacado: false,
      resultado: null,
    },
  ];
  setPartidos(dosPrimerosPartidos);
  setCargando(false);
  return; // Salimos de la función, no seguimos a Firestore
}
    try {
      // Partidos
      let lista = [];
      try {
        const q = query(collection(db,"partidos"), where("fecha","==",hoy));
        const snap = await getDocs(q);
        if (!snap.empty) {
          lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } else {
          lista = PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy);
        }
      } catch(_) {
        lista = PARTIDOS_EJEMPLO.filter((p) => p.fecha === hoy);
      }
      setPartidos(lista);

      // Pregunta
      try {
        const qP = query(collection(db,"preguntas"), where("fecha","==",hoy));
        const snapP = await getDocs(qP);
        if (!snapP.empty) {
          setPregunta({ id: snapP.docs[0].id, ...snapP.docs[0].data() });
        } else {
          const ej = PREGUNTAS_EJEMPLO.find((q) => q.fecha === hoy);
          if (ej) setPregunta(ej);
        }
      } catch(_) {
        const ej = PREGUNTAS_EJEMPLO.find((q) => q.fecha === hoy);
        if (ej) setPregunta(ej);
      }
    } finally {
      setCargando(false);
    }
  };

  const verificarPrediccionesTodas = async () => {
    if (!firebaseUser) return;
    const partidosAbiertos = partidos.filter(
    (p) => !p.resultado && partidoAbierto(p)
     );
    if (partidosAbiertos.length === 0) return;

    const nuevasGuardadas = new Set();
    for (const p of partidosAbiertos) {
      const ref = doc(db,"predicciones",`${firebaseUser.uid}_${p.id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) nuevasGuardadas.add(p.id);
    }
    setPrediccionesGuardadas(nuevasGuardadas);

    // Si completó todos, mostrar pregunta en modal (solo si hay pregunta y no la respondió)
    if (nuevasGuardadas.size === partidosAbiertos.length && pregunta) {
      const respRef = doc(db,"respuestas",`${firebaseUser.uid}_${pregunta.id}`);
      const respSnap = await getDoc(respRef);
      if (!respSnap.exists()) {
        setMostrarPregModal(true);
      }
    }
  };

  // Cuando se guarda una predicción, re-verificar
  const handlePrediccionGuardada = () => {
    setTimeout(verificarPrediccionesTodas, 500);
  };

  const todosPredecidos = (() => {
    const abiertos = partidos.filter(
  (p) => !p.resultado && partidoAbierto(p)
   );
    return abiertos.length > 0 && abiertos.every((p) => prediccionesGuardadas.has(p.id));
  })();

  if (cargando) {
    return (
      <div className="loading-pantalla" style={{ minHeight:"200px" }}>
        <span className="spinner">⚙</span><p>CARGANDO...</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom:"80px" }}>
      {/* Modal: Pregunta del día */}
      {mostrarPregModal && pregunta && (
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(0,0,0,0.92)", zIndex:700,
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:"20px",
        }}>
          <div style={{ maxWidth:"400px", width:"100%" }}>
            <p style={{
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"8px", color:"var(--amarillo)",
              textAlign:"center", marginBottom:"16px",
            }}>
              🎯 ¡COMPLETASTE TODOS LOS PRONÓSTICOS!
            </p>
            <p style={{
              fontFamily:"'Press Start 2P',monospace",
              fontSize:"7px", color:"var(--gris-claro)",
              textAlign:"center", marginBottom:"16px", lineHeight:2,
            }}>
              Ahora responde la pregunta del día para ganar +2 pts extra:
            </p>
            <PreguntaCard
              pregunta={pregunta}
              onResponder={() => setMostrarPregModal(false)}
            />
            <button
              className="btn-pixel btn-gris w-full"
              style={{ marginTop:"10px", fontSize:"7px" }}
              onClick={() => setMostrarPregModal(false)}
            >
              RESPONDER DESPUÉS
            </button>
          </div>
        </div>
      )}

      <div className="contenedor">
        <div className="seccion-titulo" style={{ marginTop:"16px" }}>
          ⚽ PARTIDOS DE HOY
        </div>

        {partidos.length > 0 ? (
          partidos.map((p) => (
            <PartidoCard
              key={p.id}
              partido={p}
              onGuardado={handlePrediccionGuardada}
            />
          ))
        ) : (
          <div className="caja-pixel mb-16 text-center">
            <p style={{ fontSize:"7px", color:"var(--gris-claro)" }}>
              No hay partidos para hoy.
            </p>
          </div>
        )}

        {/* Indicador de progreso */}
        {partidos.filter(p => !p.resultado && partidoAbierto(p)).length > 0 && (
          <div style={{
            padding:"8px 12px", marginBottom:"12px",
            border:"2px solid var(--verde-campo)",
            background:"rgba(64,145,108,0.1)",
            fontFamily:"'Press Start 2P',monospace",
            fontSize:"6px", color:"var(--verde-claro)",
            textAlign:"center",
          }}>
            {todosPredecidos
              ? "✅ TODOS LOS PRONÓSTICOS GUARDADOS"
              : `📝 ${prediccionesGuardadas.size} / ${
                  partidos.filter(p => !p.resultado && partidoAbierto(p.fecha,p.horaInicio)).length
                } PRONÓSTICOS GUARDADOS`
            }
          </div>
        )}

        {/* Pregunta del día (visible inline si ya respondió o cerró modal) */}
        {pregunta && todosPredecidos && (
          <>
            <div className="seccion-titulo">❓ PREGUNTA DEL DÍA</div>
            <PreguntaCard pregunta={pregunta} />
          </>
        )}
      </div>
    </div>
  );
}
