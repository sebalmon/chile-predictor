// src/utils/sobre.js — v2
// Cambios: 7 láminas por sobre, prioriza láminas no poseídas
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData.js";

export function composicionPorPuesto(pos) {
  if (!pos || pos <= 3) return { laminas: 7, cartas: [] };
  if (pos <= 7)         return { laminas: 6, cartas: [{ mult: 2, n: 1 }] };
  if (pos <= 14)        return { laminas: 6, cartas: [{ mult: 3, n: 1 }] };
  if (pos <= 22)        return { laminas: 6, cartas: [{ mult: 4, n: 1 }] };
  return { laminas: 5, cartas: [{ mult: 4, n: 2 }] };
}

// Prioriza láminas no poseídas (o poco repetidas).
export function generarSobre(todasLaminas, comp, rnd = Math.random, laminasUsuario = {}) {
  const n = comp.laminas;

  const noPoseidas = todasLaminas.filter(l => !(laminasUsuario?.[l.file] > 0));
  const pocasVeces = todasLaminas.filter(l => (laminasUsuario?.[l.file] || 0) === 1);
  const poseidas   = todasLaminas.filter(l => (laminasUsuario?.[l.file] || 0) > 1);

  // Pool en orden de prioridad
  const pool = noPoseidas.length > 0
    ? [...noPoseidas, ...pocasVeces, ...poseidas]
    : todasLaminas;

  const laminas = [];
  const usados  = new Set();

  // Intentar sacar del pool priorizado (evitando repetir)
  let intentos = 0;
  while (laminas.length < n && intentos < pool.length * 4) {
    // Sesgar hacia el inicio del pool (no-poseídas)
    const maxIdx = Math.min(pool.length, Math.max(noPoseidas.length, 1));
    const idx = Math.floor(rnd() * maxIdx);
    const lam = pool[idx];
    if (lam && !usados.has(lam.file)) {
      laminas.push(lam);
      usados.add(lam.file);
    }
    intentos++;
  }

  // Completar con aleatorio si faltan
  intentos = 0;
  while (laminas.length < n && intentos < todasLaminas.length * 3) {
    const lam = todasLaminas[Math.floor(rnd() * todasLaminas.length)];
    if (lam && !usados.has(lam.file)) {
      laminas.push(lam);
      usados.add(lam.file);
    }
    intentos++;
    // Última instancia: admitir repetidas
    if (intentos > todasLaminas.length * 2 && laminas.length < n) {
      laminas.push(todasLaminas[Math.floor(rnd() * todasLaminas.length)]);
      break;
    }
  }

  const cartas = [];
  for (const { mult, n: nc } of comp.cartas) {
    for (let i = 0; i < nc; i++) {
      const c = cartaAleatoriaPorMultiplicador(mult);
      if (c) cartas.push(c);
    }
  }
  return { laminas, cartas };
}

export function gastarDuplicados(laminasUsuario, n) {
  const sobrantes = Object.entries(laminasUsuario || {})
    .map(([file, c]) => ({ file, sobra: Math.max(0, (c || 0) - 1) }))
    .filter(x => x.sobra > 0)
    .sort((a, b) => b.sobra - a.sobra);
  const total = sobrantes.reduce((s, x) => s + x.sobra, 0);
  if (total < n) return { ok: false, decrementos: {} };
  const decrementos = {};
  let restante = n;
  for (const { file, sobra } of sobrantes) {
    if (restante <= 0) break;
    const usar = Math.min(sobra, restante);
    decrementos[file] = -usar;
    restante -= usar;
  }
  return { ok: true, decrementos };
}

export function cartaImg(slug) { return `/cartas/${slug}.jpg`; }

export function categoriaCompleta(laminasUsuario, todasLaminas, catKey) {
  const dela = todasLaminas.filter(l => l.categoria === catKey);
  if (dela.length === 0) return false;
  return dela.every(l => (laminasUsuario?.[l.file] || 0) > 0);
}

export function albumCompleto(laminasUsuario, todasLaminas) {
  if (!todasLaminas || todasLaminas.length === 0) return false;
  return todasLaminas.every(l => (laminasUsuario?.[l.file] || 0) > 0);
}

export function recompensasPendientes(laminasUsuario, todasLaminas, reclamadas = {}, posicion = null) {
  const out = [];
  const keys = [...new Set(todasLaminas.map(l => l.categoria).filter(Boolean))];
  for (const key of keys) {
    if (reclamadas[`cat_${key}`]) continue;
    if (categoriaCompleta(laminasUsuario, todasLaminas, key)) {
      const mult = (!posicion || posicion <= 3) ? 2 : posicion <= 12 ? 3 : 4;
      out.push({ tipo: "categoria", key, cartas: [{ mult, n: 2 }] });
    }
  }
  if (!reclamadas.album && albumCompleto(laminasUsuario, todasLaminas)) {
    out.push({ tipo: "album", key: "album", cartas: [{ mult: 4, n: 2 }] });
  }
  return out;
}
