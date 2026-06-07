// ============================================================
// DATOS DE EJEMPLO — Reemplaza con los de Firestore cuando tengas
// los partidos reales del mundial.
// En Firestore, la colección es "partidos" con estos campos.
// ============================================================

export const PARTIDOS_EJEMPLO = [
  {
    id: "p1",
    fecha: "2026-06-11", // YYYY-MM-DD
    horaInicio: "12:00",   // hora local Santiago (UTC-4)
    local: { nombre: "Chile", bandera: "🇨🇱" },
    visitante: { nombre: "España", bandera: "🇪🇸" },
    estaDestacado: true,   // partido donde se puede predecir resultado exacto
    resultado: null,       // { golesLocal: 2, golesVisitante: 1 }  ← lo pones tú
  },
  {
    id: "p2",
    fecha: "2026-06-11",
    horaInicio: "15:00",
    local: { nombre: "Brasil", bandera: "🇧🇷" },
    visitante: { nombre: "Argentina", bandera: "🇦🇷" },
    estaDestacado: false,
    resultado: null,
  },
  {
    id: "p3",
    fecha: "2026-06-11",
    horaInicio: "18:00",
    local: { nombre: "Francia", bandera: "🇫🇷" },
    visitante: { nombre: "Alemania", bandera: "🇩🇪" },
    estaDestacado: false,
    resultado: null,
  },
  {
    id: "p4",
    fecha: "2026-06-12",
    horaInicio: "12:00",
    local: { nombre: "México", bandera: "🇲🇽" },
    visitante: { nombre: "Uruguay", bandera: "🇺🇾" },
    estaDestacado: false,
    resultado: null,
  },
];

// ============================================================
// PREGUNTAS DEL DÍA — En Firestore, colección "preguntas"
// ============================================================
export const PREGUNTAS_EJEMPLO = [
  {
    id: "q1",
    fecha: "2026-06-11",
    texto: "¿Cuántos goles se marcarán en el partido Chile vs España?",
    opciones: ["0-1 goles", "2-3 goles", "4-5 goles", "6 o más"],
    respuestaCorrecta: null, // Tú la pones en Firebase Console
  },
  {
    id: "q2",
    fecha: "2026-06-12",
    texto: "¿Quién será el goleador del día?",
    opciones: ["Jugador A", "Jugador B", "Jugador C", "Otro"],
    respuestaCorrecta: null,
  },
];

// ============================================================
// FRASES DEL DÍA — Puedes editarlas aquí directamente
// ============================================================
export const FRASES_DEL_DIA = [
  "La pelota no se mancha... ¡pero tus predicciones sí!",
  "El que no arriesga, no gana. ¡Predice con el corazón!",
  "En el fútbol y en la vida, nadie sabe nada.",
  "Hay dos tipos de personas: las que ven el partido y las que lo predicen.",
  "¡Arriba Chile! Aunque perdamos la polla...",
  "Pon aquí tus frases favoritas editando el archivo data/sampleData.js",
  "El fútbol es la única religión que no tiene ateos en los penales.",
  "Predecir el futuro es fácil. Lo difícil es acertar.",
];

// ============================================================
// AVATARES DISPONIBLES (emoji temporales — reemplaza con imágenes)
// ============================================================
export const AVATARES = [
  { id: "av1", emoji: "🦁", nombre: "León" },
  { id: "av2", emoji: "🐺", nombre: "Lobo" },
  { id: "av3", emoji: "🦊", nombre: "Zorro" },
  { id: "av4", emoji: "🐻", nombre: "Oso" },
  { id: "av5", emoji: "🦅", nombre: "Águila" },
  { id: "av6", emoji: "🐉", nombre: "Dragón" },
  { id: "av7", emoji: "🦈", nombre: "Tiburón" },
  { id: "av8", emoji: "🐯", nombre: "Tigre" },
];

// ============================================================
// CARTAS COLECCIONABLES (placeholders)
// ============================================================
export const CARTAS = [
  { id: "c1", nombre: "Carta del Goleador", emoji: "⚽", condicion: "Acertar 5 goles exactos" },
  { id: "c2", nombre: "Carta del Vidente", emoji: "🔮", condicion: "Acertar 3 resultados exactos" },
  { id: "c3", nombre: "Carta del Rey", emoji: "👑", condicion: "Ser líder del ranking" },
  { id: "c4", nombre: "Carta de la Racha", emoji: "🔥", condicion: "5 días seguidos con puntos" },
  { id: "c5", nombre: "Carta del Campeón", emoji: "🏆", condicion: "Ganar el día 3 veces" },
  { id: "c6", nombre: "Carta Legendaria", emoji: "⭐", condicion: "Puntaje perfecto en un día" },
];
