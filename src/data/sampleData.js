// src/data/sampleData.js  — v3
// ─────────────────────────────────────────────────────────────

export const PARTIDOS_EJEMPLO = [
  {
    id: "p1",
    fecha: "2026-06-11",
    horaInicio: "12:00",
    local:     { nombre: "Chile",    bandera: "🇨🇱" },
    visitante: { nombre: "España",   bandera: "🇪🇸" },
    fase: "grupos",
    estaDestacado: true,
    resultado: null,
  },
  {
    id: "p2",
    fecha: "2026-06-11",
    horaInicio: "15:00",
    local:     { nombre: "Brasil",   bandera: "🇧🇷" },
    visitante: { nombre: "Argentina",bandera: "🇦🇷" },
    fase: "grupos",
    estaDestacado: false,
    resultado: null,
  },
  {
    id: "p3",
    fecha: "2026-06-11",
    horaInicio: "18:00",
    local:     { nombre: "Francia",  bandera: "🇫🇷" },
    visitante: { nombre: "Alemania", bandera: "🇩🇪" },
    fase: "grupos",
    estaDestacado: false,
    resultado: null,
  },
];

export const PREGUNTAS_EJEMPLO = [
  {
    id: "q1",
    fecha: "2026-06-11",
    texto: "¿Cuántos goles se marcarán en el partido Chile vs España?",
    opciones: ["0-1 goles", "2-3 goles", "4-5 goles", "6 o más"],
    respuestaCorrecta: null,
  },
];

// ── FRASES DEL DÍA ─────────────────────────────────────────────
// Una por cada día del mundial (o más); se rotan cíclicamente.
export const FRASES_DEL_DIA = [
  "El lunes quieres cambiarlos a todos, el miércoles crees que se pueden salvar dos o tres, \n el viernes piensas que puedes recuperar a cinco o seis \n y el domingo juegan los mismo once cabrones de siempre. \n  J.B Toshack" ,
  "La prensa es muy mentirosa. <p> Dicen que me he acostado con 200 mujeres, \n pero solo fueron 100. \n George Best",
];

// ── AVATARES — 12 personajes con imágenes animadas ────────────
// Las imágenes se guardan en /public/avatares/
// Nombre de archivo: {slug}-1.png, {slug}-2.png, {slug}-3.png
export const AVATARES = [
  { id: "av1",  slug: "chancho-lorenzo",        nombre: "Chancho Lorenzo"         },
  { id: "av2",  slug: "azkargorta",             nombre: "Azkargorta"              },
  { id: "av3",  slug: "chinquihuin",            nombre: "Chinquihuin"             },
  { id: "av4",  slug: "julio-martinez",         nombre: "Julio Martínez"          },
  { id: "av5",  slug: "caszely",               nombre: "Caszely"                 },
  { id: "av6",  slug: "dr-orozco",             nombre: "Dr Orozco"               },
  { id: "av7",  slug: "peter-veneno",          nombre: "Peter Veneno"            },
  { id: "av8",  slug: "bielsa",               nombre: "Bielsa"                  },
  { id: "av9",  slug: "carcuro",              nombre: "Carcuro"                 },
  { id: "av10", slug: "el-sapo",              nombre: "El Sapo"                 },
  { id: "av11", slug: "el-hombre-del-maletin", nombre: "El Hombre del Maletín"   },
  { id: "av12", slug: "ff17",                 nombre: "FF17"                    },
];

// Helper: retorna la URL del fotograma N (1, 2 o 3) de un avatar
export function avatarFrame(slug, frame) {
  return `/avatares/${slug}-${frame}.png`;
}

// ── CARTAS COLECCIONABLES ──────────────────────────────────────
// Imágenes en /public/cartas/{slug}.png
// multiplicador: 4 | 3 | 2
export const CARTAS = [
  // x4 — Legendarias
  { id: "cx4-1", slug: "vargas-elimina-espana",   nombre: "Vargas elimina a España",      multiplicador: 4, rareza: "legendaria" },
  { id: "cx4-2", slug: "penal-gato-silva",         nombre: "El Penal del Gato Silva",       multiplicador: 4, rareza: "legendaria" },
  { id: "cx4-3", slug: "maniobra-heimlich",         nombre: "La Maniobra de Heimlich",       multiplicador: 4, rareza: "legendaria" },
  { id: "cx4-4", slug: "el-perro-ron",             nombre: "El Perro Ron",                  multiplicador: 4, rareza: "legendaria" },
  { id: "cx4-5", slug: "el-maracanazo",            nombre: "El Maracanazo",                 multiplicador: 4, rareza: "legendaria" },
  { id: "cx4-6", slug: "el-dedo-de-jarita",        nombre: "El dedo de Jarita",             multiplicador: 4, rareza: "legendaria" },
  // x3 — Raras
  { id: "cx3-1", slug: "historico-orellana",       nombre: "El histórico de Orellana",      multiplicador: 3, rareza: "rara" },
  { id: "cx3-2", slug: "matador-en-wembley",       nombre: "El Matador en Wembley",          multiplicador: 3, rareza: "rara" },
  { id: "cx3-3", slug: "mi-familia-esta-bien",      nombre: "Mi familia está bien",           multiplicador: 3, rareza: "rara" },
  { id: "cx3-4", slug: "ahi-quedo-brasil",         nombre: "Ahí Quedó Brasil",              multiplicador: 3, rareza: "rara" },
  { id: "cx3-5", slug: "el-palo-de-pinilla",       nombre: "El Palo de Pinilla",             multiplicador: 3, rareza: "rara" },
  { id: "cx3-6", slug: "pero-con-respeto",         nombre: "Pero con Respeto",              multiplicador: 3, rareza: "rara" },
  // x2 — Comunes
  { id: "cx2-1", slug: "las-luces-rojas",          nombre: "Las Luces Rojas",               multiplicador: 2, rareza: "comun" },
  { id: "cx2-2", slug: "vargas-ataja-chilavert",   nombre: "Vargas ataja a Chilavert",      multiplicador: 2, rareza: "comun" },
  { id: "cx2-3", slug: "que-sucede",               nombre: "¿Qué sucede?",                  multiplicador: 2, rareza: "comun" },
  { id: "cx2-4", slug: "el-dublinazo",             nombre: "El dublinazo",                  multiplicador: 2, rareza: "comun" },
  { id: "cx2-5", slug: "lesion-a-francescoli",     nombre: "Lesión a Francescoli",          multiplicador: 2, rareza: "comun" },
  { id: "cx2-6", slug: "el-bautizazo",             nombre: "El Bautizazo",                  multiplicador: 2, rareza: "comun" },
];

// Helpers de cartas
export function getCarta(cartaId) {
  return CARTAS.find((c) => c.id === cartaId) || null;
}

export function cartasPorMultiplicador(multi) {
  return CARTAS.filter((c) => c.multiplicador === multi);
}

export function cartaAleatoriaPorMultiplicador(multi) {
  const pool = cartasPorMultiplicador(multi);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── FASES ──────────────────────────────────────────────────────
export const FASE_LABELS = {
  grupos:        "Fase de Grupos",
  dieciseisavos: "Dieciseisavos de Final",
  octavos:       "Octavos de Final",
  cuartos:       "Cuartos de Final",
  semifinal:     "Semifinal",
  tercer_lugar:  "Tercer y Cuarto Lugar",
  final:         "FINAL",
};

export const FASES_ELIMINATORIAS = [
  "dieciseisavos", "octavos", "cuartos",
  "semifinal", "tercer_lugar", "final",
];

// ── BANCO DE PREGUNTAS (estructura para el admin) ──────────────
// El admin elige una de estas para el día.
// Las opciones reales las pondrás tú; por ahora el array tiene
// la estructura correcta para 104 preguntas.
export const BANCO_PREGUNTAS = [
  {
    id: "bq1",
    texto: "¿Cuántos goles se marcarán en el primer partido de Chile?",
    opciones: ["0-1 goles", "2-3 goles", "4-5 goles", "6 o más"],
  },
  {
    id: "bq2",
    texto: "¿Quién será el jugador del partido en el Chile vs España?",
    opciones: ["Vargas", "Alexis", "Pulgar", "Otro"],
  },
  // → Agrega las 104 preguntas aquí con el mismo formato.
];
