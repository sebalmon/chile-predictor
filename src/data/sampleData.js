// ============================================================
// DATOS DE EJEMPLO v2 — Incluye fases eliminatorias y cartas
// con multiplicadores. Reemplaza desde Firestore cuando tengas
// los partidos reales.
// ============================================================

// Fases válidas:
// "grupos" | "dieciseisavos" | "octavos" | "cuartos" | "semifinal" | "tercer_lugar" | "final"

export const PARTIDOS_EJEMPLO = [
  {
    id: "p1",
    fecha: "2026-06-11",
    horaInicio: "12:00",
    local: { nombre: "Chile", bandera: "🇨🇱" },
    visitante: { nombre: "España", bandera: "🇪🇸" },
    fase: "grupos",
    estaDestacado: true,
    resultado: null,
    // resultado real en grupos: { golesLocal: 2, golesVisitante: 1 }
    // resultado real en eliminatoria: {
    //   golesLocal: 1, golesVisitante: 1,    ← 90 min
    //   definicion: "penales",                ← "normal"|"alargue"|"penales"
    //   golesLocalAlargue: 0, golesVisitanteAlargue: 0,  ← solo si alargue/penales
    //   penalesLocal: 4, penalesVisitante: 3, ← solo si penales
    //   ganadorFinal: "local"                 ← quién ganó al final
    // }
  },
  {
    id: "p2",
    fecha: "2026-06-11",
    horaInicio: "15:00",
    local: { nombre: "Brasil", bandera: "🇧🇷" },
    visitante: { nombre: "Argentina", bandera: "🇦🇷" },
    fase: "grupos",
    estaDestacado: false,
    resultado: null,
  },
  {
    id: "p3",
    fecha: "2026-06-11",
    horaInicio: "18:00",
    local: { nombre: "Francia", bandera: "🇫🇷" },
    visitante: { nombre: "Alemania", bandera: "🇩🇪" },
    fase: "grupos",
    estaDestacado: false,
    resultado: null,
  },
  // ── EJEMPLO eliminatoria ──────────────────────────────────
  {
    id: "p5",
    fecha: "2026-07-04",
    horaInicio: "17:00",
    local: { nombre: "Chile", bandera: "🇨🇱" },
    visitante: { nombre: "Francia", bandera: "🇫🇷" },
    fase: "octavos",
    estaDestacado: true,
    resultado: null,
  },
];

// ============================================================
// PREGUNTAS DEL DÍA
// ============================================================
export const PREGUNTAS_EJEMPLO = [
  {
    id: "q1",
    fecha: "2026-06-11",
    texto: "¿Cuántos goles se marcarán en el partido Chile vs España?",
    opciones: ["0-1 goles", "2-3 goles", "4-5 goles", "6 o más"],
    respuestaCorrecta: null,
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
// FRASES DEL DÍA
// ============================================================
export const FRASES_DEL_DIA = [
  "La pelota no se mancha... ¡pero tus predicciones sí!",
  "El que no arriesga, no gana. ¡Predice con el corazón!",
  "En el fútbol y en la vida, nadie sabe nada.",
  "Hay dos tipos de personas: las que ven el partido y las que lo predicen.",
  "¡Arriba Chile! Aunque perdamos la polla...",
  "El fútbol es la única religión que no tiene ateos en los penales.",
  "Predecir el futuro es fácil. Lo difícil es acertar.",
  "Un alargue a tiempo vale más que mil certezas en grupos.",
];

// ============================================================
// AVATARES
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
// CARTAS COLECCIONABLES — con multiplicadores
// Las cartas se otorgan automáticamente al ganar el podio del día.
// El campo "multiplicador" define cuánto multiplican el puntaje
// máximo del partido al que se adjuntan.
//
// En Firestore, la colección es "cartas" con estos mismos campos.
// El campo cartasDesbloqueadas del usuario es un array de IDs.
// Para adjuntar la carta a una predicción, se guarda cartaId
// en el documento de predicciones.
// ============================================================
export const CARTAS = [
  {
    id: "c1",
    nombre: "Carta del Goleador",
    emoji: "⚽",
    multiplicador: 2,
    rareza: "comun",
    condicion: "Ganar el podio del día (1°, 2° o 3°)",
    descripcion: "Duplica tus puntos si aciertas todo en un partido",
  },
  {
    id: "c2",
    nombre: "Carta del Vidente",
    emoji: "🔮",
    multiplicador: 2,
    rareza: "comun",
    condicion: "Ganar el podio del día (1°, 2° o 3°)",
    descripcion: "Duplica tus puntos si aciertas todo en un partido",
  },
  {
    id: "c3",
    nombre: "Carta del Rey",
    emoji: "👑",
    multiplicador: 3,
    rareza: "rara",
    condicion: "Ser 1° del podio del día",
    descripcion: "Triplica tus puntos si aciertas todo en un partido",
  },
  {
    id: "c4",
    nombre: "Carta de la Racha",
    emoji: "🔥",
    multiplicador: 3,
    rareza: "rara",
    condicion: "Ser 1° del podio del día",
    descripcion: "Triplica tus puntos si aciertas todo en un partido",
  },
  {
    id: "c5",
    nombre: "Carta del Campeón",
    emoji: "🏆",
    multiplicador: 4,
    rareza: "legendaria",
    condicion: "Ganar el podio 3 veces consecutivas",
    descripcion: "¡Cuadruplica tus puntos si aciertas todo!",
  },
  {
    id: "c6",
    nombre: "Carta Legendaria",
    emoji: "⭐",
    multiplicador: 4,
    rareza: "legendaria",
    condicion: "Puntaje perfecto en un día completo",
    descripcion: "¡Cuadruplica tus puntos si aciertas todo!",
  },
];

// Helper para buscar una carta por ID
export function getCarta(cartaId) {
  return CARTAS.find((c) => c.id === cartaId) || null;
}

// Etiquetas de fase para mostrar en la UI
export const FASE_LABELS = {
  grupos: "Fase de Grupos",
  dieciseisavos: "Dieciseisavos de Final",
  octavos: "Octavos de Final",
  cuartos: "Cuartos de Final",
  semifinal: "Semifinal",
  tercer_lugar: "Tercer y Cuarto Lugar",
  final: "FINAL",
};

export const FASES_ELIMINATORIAS = [
  "dieciseisavos", "octavos", "cuartos", "semifinal", "tercer_lugar", "final"
];
