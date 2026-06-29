// src/utils/sobre.js — lógica pura del sobre (SIN firebase; solo sampleData puro)
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData.js";

// Composición por puesto (1-based). pos null/0 => tier 1-3.
export function composicionPorPuesto(pos) {
  if (!pos || pos <= 3) return { laminas: 4, cartas: [] };
  if (pos <= 7)         return { laminas: 3, cartas: [{ mult: 2, n: 1 }] };
  if (pos <= 14)        return { laminas: 3, cartas: [{ mult: 3, n: 1 }] };
  if (pos <= 22)        return { laminas: 3, cartas: [{ mult: 4, n: 1 }] };
  return { laminas: 2, cartas: [{ mult: 4, n: 2 }] };
}

// Sorteo CON reemplazo de láminas + cartas. rnd inyectable para testear.
export function generarSobre(todasLaminas, comp, rnd = Math.random) {
  const laminas = [];
  for (let i = 0; i < comp.laminas; i++) {
    laminas.push(todasLaminas[Math.floor(rnd() * todasLaminas.length)]);
  }
  const cartas = [];
  for (const { mult, n } of comp.cartas) {
    for (let i = 0; i < n; i++) {
      const c = cartaAleatoriaPorMultiplicador(mult);
      if (c) cartas.push(c);
    }
  }
  return { laminas, cartas };
}

// Gasta n copias sobrantes (sobrante de cada lámina = copias-1). Nunca baja de 1.
export function gastarDuplicados(laminasUsuario, n) {
  const sobrantes = Object.entries(laminasUsuario || {})
    .map(([file, c]) => ({ file, sobra: Math.max(0, (c || 0) - 1) }))
    .filter(x => x.sobra > 0)
    .sort((a, b) => b.sobra - a.sobra); // greedy: las que más copias tienen
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

export function cartaImg(slug) {
  return `/cartas/${slug}.jpg`;
}

// ── Recompensas por completar ──────────────────────────────────
export function categoriaCompleta(laminasUsuario, todasLaminas, catKey) {
  const dela = todasLaminas.filter(l => l.categoria === catKey);
  if (dela.length === 0) return false;
  return dela.every(l => (laminasUsuario?.[l.file] || 0) > 0);
}

export function albumCompleto(laminasUsuario, todasLaminas) {
  if (!todasLaminas || todasLaminas.length === 0) return false;
  return todasLaminas.every(l => (laminasUsuario?.[l.file] || 0) > 0);
}

// Lista recompensas completas y NO reclamadas. reclamadas = {cat_KEY:true, album:true}
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
