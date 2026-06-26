// Tests de lógica pura de puntaje. Correr: node src/utils/scoring.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPuntosPartido, calcularPuntosPregunta,
  aplicarMultiplicadorCarta, cartaSeAplica,
} from "./scoring.js";

// ── Fase de grupos (no destacado) ────────────────────────────
test("grupos: ganador correcto + diferencia = 3 pts", () => {
  const pred = { ganador: "local", diferencia: "2+" };
  const res  = { golesLocal: 3, golesVisitante: 0 };
  assert.deepEqual(calcularPuntosPartido(pred, res, "grupos", false), { puntos: 3, esMaximo: true });
});

test("grupos: solo ganador (diferencia mal) = 1 pt", () => {
  const pred = { ganador: "local", diferencia: "2+" };
  const res  = { golesLocal: 2, golesVisitante: 1 }; // dif real = "1"
  assert.deepEqual(calcularPuntosPartido(pred, res, "grupos", false), { puntos: 1, esMaximo: true });
});

test("grupos: ganador equivocado = 0 pts", () => {
  const pred = { ganador: "visitante", diferencia: "1" };
  const res  = { golesLocal: 2, golesVisitante: 0 };
  assert.deepEqual(calcularPuntosPartido(pred, res, "grupos", false), { puntos: 0, esMaximo: false });
});

test("grupos: empate acertado = 1 pt (la diferencia no suma en empate)", () => {
  const pred = { ganador: "empate", diferencia: null };
  const res  = { golesLocal: 1, golesVisitante: 1 };
  assert.deepEqual(calcularPuntosPartido(pred, res, "grupos", false), { puntos: 1, esMaximo: true });
});

// ── Partido destacado ────────────────────────────────────────
test("destacado: marcador exacto = 5 pts", () => {
  const pred = { golesLocalPred: 2, golesVisitantePred: 1, ganador: "local" };
  const res  = { golesLocal: 2, golesVisitante: 1 };
  assert.deepEqual(calcularPuntosPartido(pred, res, "grupos", true), { puntos: 5, esMaximo: true });
});

test("destacado: solo ganador = 2 pts", () => {
  const pred = { golesLocalPred: 3, golesVisitantePred: 0, ganador: "local" };
  const res  = { golesLocal: 1, golesVisitante: 0 };
  assert.deepEqual(calcularPuntosPartido(pred, res, "grupos", true), { puntos: 2, esMaximo: true });
});

// ── Eliminatorias ────────────────────────────────────────────
test("elim normal: ganador90 + diferencia = 3 pts", () => {
  const pred = { definicion: "normal", ganador90: "local", diferencia90: "1" };
  const res  = { definicion: "normal", golesLocal: 1, golesVisitante: 0 };
  assert.deepEqual(calcularPuntosPartido(pred, res, "octavos", false), { puntos: 3, esMaximo: true });
});

test("elim penales: definición + marcador exacto de penales = 7 pts", () => {
  const pred = { definicion: "penales", penalesLocal: 4, penalesVisitante: 3, ganadorPenales: "local" };
  const res  = { definicion: "penales", golesLocal: 1, golesVisitante: 1,
    penalesLocal: 4, penalesVisitante: 3, ganadorFinal: "local" };
  assert.deepEqual(calcularPuntosPartido(pred, res, "final", false), { puntos: 7, esMaximo: true });
});

test("elim: predecir definición equivocada = 0 pts", () => {
  const pred = { definicion: "normal", ganador90: "local", diferencia90: "1" };
  const res  = { definicion: "penales", golesLocal: 1, golesVisitante: 1,
    penalesLocal: 4, penalesVisitante: 3, ganadorFinal: "local" };
  assert.deepEqual(calcularPuntosPartido(pred, res, "final", false), { puntos: 0, esMaximo: false });
});

// ── Pregunta del día ─────────────────────────────────────────
test("pregunta: correcta = 2 pts, incorrecta = 0", () => {
  assert.equal(calcularPuntosPregunta("A", "A"), 2);
  assert.equal(calcularPuntosPregunta("B", "A"), 0);
  assert.equal(calcularPuntosPregunta(null, "A"), 0);
});

// ── Multiplicador de carta ───────────────────────────────────
test("multiplicador: aplica x4 solo si esMaximo y hay puntos", () => {
  assert.equal(aplicarMultiplicadorCarta(3, true, "cx4-1"), 12);   // 3 x 4
  assert.equal(aplicarMultiplicadorCarta(3, false, "cx4-1"), 3);   // no esMaximo
  assert.equal(aplicarMultiplicadorCarta(0, true, "cx4-1"), 0);    // 0 puntos
  assert.equal(aplicarMultiplicadorCarta(3, true, null), 3);       // sin carta
  assert.equal(aplicarMultiplicadorCarta(3, true, "no-existe"), 3);// carta inexistente
});

// ── Gate de inventario (cartaSeAplica) ───────────────────────
test("gate: sin cartaId nunca aplica", () => {
  assert.equal(cartaSeAplica(false, false, 5), false);
});

test("gate: ya consumida respeta decisión previa (recálculo) aunque stock sea 0", () => {
  assert.equal(cartaSeAplica(true, true, 0), true);
});

test("gate: primera vez aplica solo con stock disponible", () => {
  assert.equal(cartaSeAplica(true, false, 1), true);  // hay stock
  assert.equal(cartaSeAplica(true, false, 0), false); // sin stock -> NO multiplica
});
