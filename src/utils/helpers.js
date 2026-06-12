// src/utils/helpers.js  — v4 (Fase 1)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v4:
//   • Nueva tabla de puntos (ítem j):
//       Partido normal: +1 ganador, +2 adicional si + diferencia (total 3)
//       Partido destacado: +2 ganador, +5 resultado exacto
//       Ganador del día: +2 (antes +3)
//       Eliminatorias: alargue +3/+6, penales +3/+5/+7
//   • procesarResultadoPartido: RECALCULA (soporta correcciones del admin)
//   • procesarPreguntaDelDia:   RECALCULA ídem
//   • calcularGanadorDelDia:    ahora es solo "ENTREGAR CARTAS Y BONUS"
//                                bonus = +2, no recalcula partidos/pregunta
// ─────────────────────────────────────────────────────────────
import {
  collection, getDocs, query, where, doc,
  updateDoc, setDoc, increment, getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { CARTAS, cartaAleatoriaPorMultiplicador } from "../data/sampleData";

// ──────────────────────────────────────────────────────────────
// FECHAS
// ──────────────────────────────────────────────────────────────
export function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function ayerStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function formatHora(h) { return `${h} hrs`; }

export function formatFecha(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long",
  });
}

/** Número de participación: 11/06/2026 = Día 1. Antes del mundial → 0. */
export function diaNumero() {
  const inicio = new Date("2026-06-11T00:00:00");
  const hoy    = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoy - inicio) / 86400000);
  return diff < 0 ? 0 : diff + 1;
}

/**
 * Determina si el partido sigue abierto para predicciones.
 * Soporta Timestamp de Firestore, {_seconds}, número y string.
 */
export function partidoAbierto(partido) {
  if (!partido || !partido.cierre) return true;
  let cierreDate;
  if (typeof partido.cierre.toDate === "function") {
    cierreDate = partido.cierre.toDate();
  } else if (partido.cierre._seconds !== undefined) {
    cierreDate = new Date(partido.cierre._seconds * 1000);
  } else if (typeof partido.cierre === "number") {
    cierreDate = new Date(partido.cierre * 1000);
  } else if (typeof partido.cierre === "string") {
    cierreDate = new Date(partido.cierre);
  } else {
    return true;
  }
  return new Date() < cierreDate;
}

// ──────────────────────────────────────────────────────────────
// CÁLCULO DE PUNTOS — NUEVA TABLA v4
// ──────────────────────────────────────────────────────────────
/**
 * calcularPuntosPartido(prediccion, resultado, fase, estaDestacado)
 *
 * FASE DE GRUPOS:
 *   Partido normal:
 *     +1  acertar ganador
 *     +2  adicional si también acierta diferencia  → total 3
 *   Partido destacado ⭐:
 *     +2  solo acertar ganador
 *     +5  resultado exacto (3 por exacto + 2 por ganador)
 *
 * ELIMINATORIAS (muere-muere):
 *   Definición en 90 min:
 *     +2  acertar ganador
 *     +1  adicional si también acierta diferencia  → total 3
 *   Definición en alargue:
 *     +3  acertar que se define en alargue
 *     +3  adicional si también acierta diferencia en alargue  → total 6
 *   Definición en penales:
 *     +3  acertar que se define en penales
 *     +2  adicional si aciertas quién gana los penales  → total 5
 *     +4  en lugar de +2 si aciertas la diferencia exacta → total 7
 *         (diferencia exacta implica ganador, no se acumulan +2 y +4)
 *
 * Retorna { puntos, esMaximo }.
 * esMaximo = true si el jugador acertó algo (activa multiplicador de carta).
 */
export function calcularPuntosPartido(prediccion, resultado, fase, estaDestacado) {
  if (!resultado || !prediccion) return { puntos: 0, esMaximo: false };

  const esEliminatoria = fase && fase !== "grupos";

  // ── GRUPOS ────────────────────────────────────────────────────
  if (!esEliminatoria) {
    const { golesLocal, golesVisitante } = resultado;
    const ganadorReal =
      golesLocal > golesVisitante ? "local" :
      golesVisitante > golesLocal ? "visitante" : "empate";
    const diff    = Math.abs(golesLocal - golesVisitante);
    const difReal = diff === 1 ? "1" : "2+";

    if (estaDestacado) {
      const exacto =
        Number(prediccion.golesLocalPred)     === golesLocal &&
        Number(prediccion.golesVisitantePred) === golesVisitante;
      if (exacto)                             return { puntos: 5, esMaximo: true };
      if (prediccion.ganador === ganadorReal) return { puntos: 2, esMaximo: true };
      return { puntos: 0, esMaximo: false };
    } else {
      let puntos = 0;
      if (prediccion.ganador === ganadorReal) {
        puntos += 1;
        if (ganadorReal !== "empate" && prediccion.diferencia === difReal) puntos += 2;
      }
      return { puntos, esMaximo: puntos > 0 };
    }
  }

  // ── ELIMINATORIAS ─────────────────────────────────────────────
  const {
    golesLocal, golesVisitante, definicion,
    golesLocalAlargue, golesVisitanteAlargue,
    penalesLocal, penalesVisitante, ganadorFinal,
  } = resultado;

  const ganador90Real =
    golesLocal > golesVisitante ? "local" :
    golesVisitante > golesLocal ? "visitante" : null;
  const diff90    = Math.abs(golesLocal - golesVisitante);
  const dif90Real = diff90 === 1 ? "1" : "2+";

  let puntos = 0;

  if (definicion === "normal") {
    if (prediccion.definicion === "normal" && prediccion.ganador90 === ganador90Real) {
      puntos += 2;
      if (prediccion.diferencia90 === dif90Real) puntos += 1;
    }

  } else if (definicion === "alargue") {
    if (prediccion.definicion === "alargue") {
      puntos += 3; // acertar alargue
      const diffAlarg    = Math.abs((golesLocalAlargue ?? 0) - (golesVisitanteAlargue ?? 0));
      const difAlargReal = diffAlarg === 1 ? "1" : "2+";
      if (prediccion.ganadorAlargue === ganadorFinal &&
          prediccion.diferenciaAlargue === difAlargReal) {
        puntos += 3; // también acertó diferencia en alargue
      }
    }

  } else if (definicion === "penales") {
    if (prediccion.definicion === "penales") {
      puntos += 3; // acertar penales
      const acertaExacta =
        Number(prediccion.penalesLocal)     === penalesLocal &&
        Number(prediccion.penalesVisitante) === penalesVisitante;
      const acertaGanador = prediccion.ganadorPenales === ganadorFinal;

      if (acertaExacta) {
        puntos += 4; // diferencia exacta (implica ganador)
      } else if (acertaGanador) {
        puntos += 2;
      }
    }
  }

  return { puntos, esMaximo: puntos > 0 };
}

export function calcularPuntosPregunta(respuesta, correcta) {
  if (!correcta || !respuesta) return 0;
  return respuesta === correcta ? 2 : 0;
}

/**
 * Aplica multiplicador de carta si esMaximo.
 */
export function aplicarMultiplicadorCarta(puntos, esMaximo, cartaId) {
  if (!cartaId || !esMaximo || puntos === 0) return puntos;
  const carta = CARTAS.find((c) => c.id === cartaId);
  return carta ? puntos * carta.multiplicador : puntos;
}

// ──────────────────────────────────────────────────────────────
// MOTOR AUTOMÁTICO — procesar resultado de partido (con recálculo)
// ──────────────────────────────────────────────────────────────
/**
 * procesarResultadoPartido(partidoId, resultado, fase, estaDestacado, fecha)
 *
 * ► Soporta RECÁLCULO: si ya había puntosGanados anteriores en la predicción,
 *   calcula la diferencia (nuevo − viejo) y solo aplica esa diferencia.
 *   Esto permite que el admin corrija resultados sin duplicar puntos.
 *
 * Flujo por predicción:
 *   1. Lee puntosGanados previo (null si nunca se procesó).
 *   2. Calcula puntosNuevos.
 *   3. delta = puntosNuevos − puntosViejos  (o puntosNuevos si es primera vez).
 *   4. Actualiza predicciones/{id}.
 *   5. Actualiza usuarios/{uid}.puntosTotal con increment(delta).
 *   6. Actualiza/crea puntosDelDia/{uid}_{fecha} con increment(delta).
 *
 * Retorna { procesados, errores }.
 */
export async function procesarResultadoPartido(
  partidoId, resultado, fase, estaDestacado, fecha
) {
  let procesados = 0, errores = 0;
  try {
    const snap = await getDocs(query(
      collection(db, "predicciones"),
      where("partidoId", "==", partidoId)
    ));
    if (snap.empty) return { procesados: 0, errores: 0 };

    const deltasPorUid = {};

    for (const pDoc of snap.docs) {
      try {
        const pred       = pDoc.data();
        const uid        = pred.uid;
        const puntosViejos = typeof pred.puntosGanados === "number" ? pred.puntosGanados : null;

        const { puntos: base, esMaximo } = calcularPuntosPartido(
          pred, resultado, fase, estaDestacado
        );
        const puntosNuevos = aplicarMultiplicadorCarta(base, esMaximo, pred.cartaId || null);

        const delta = puntosViejos !== null
          ? puntosNuevos - puntosViejos
          : puntosNuevos;

        // Actualizar predicción
        await updateDoc(doc(db, "predicciones", pDoc.id), {
          puntosGanados: puntosNuevos,
          puntosBase:    base,
          esMaximo,
          calculadoEn:  new Date().toISOString(),
        });

        // Solo tocar usuarios/puntosDelDia si hay cambio real
        if (delta !== 0) {
          await updateDoc(doc(db, "usuarios", uid), {
            puntosTotal: increment(delta),
          });
          deltasPorUid[uid] = (deltasPorUid[uid] || 0) + delta;
        }

        procesados++;
      } catch (e) {
        console.error("Error procesando predicción:", pDoc.id, e);
        errores++;
      }
    }

    // Actualizar puntosDelDia
    for (const [uid, delta] of Object.entries(deltasPorUid)) {
      if (delta === 0) continue;
      try {
        const diaId   = `${uid}_${fecha}`;
        const diaRef  = doc(db, "puntosDelDia", diaId);
        const diaSnap = await getDoc(diaRef);

        if (diaSnap.exists()) {
          await updateDoc(diaRef, { puntos: increment(delta) });
        } else {
          const uSnap = await getDoc(doc(db, "usuarios", uid));
          const uData = uSnap.exists() ? uSnap.data() : {};
          await setDoc(diaRef, {
            uid, fecha,
            puntos:   delta > 0 ? delta : 0,
            nickname: uData.nickname || "",
            avatarId: uData.avatarId || "",
          });
        }
      } catch (e) {
        console.error("Error actualizando puntosDelDia para", uid, e);
      }
    }

    return { procesados, errores };
  } catch (e) {
    console.error("Error general en procesarResultadoPartido:", e);
    return { procesados: 0, errores: 1 };
  }
}

// ──────────────────────────────────────────────────────────────
// PROCESAR PREGUNTA DEL DÍA (con recálculo)
// ──────────────────────────────────────────────────────────────
/**
 * procesarPreguntaDelDia(preguntaId, respuestaCorrecta, fecha)
 *
 * ► Soporta RECÁLCULO: si el admin cambia la respuesta correcta,
 *   recalcula la diferencia y actualiza usuarios y puntosDelDia.
 *
 * Retorna { ok, procesados, error? }.
 */
export async function procesarPreguntaDelDia(preguntaId, respuestaCorrecta, fecha) {
  let procesados = 0;
  try {
    const snap = await getDocs(query(
      collection(db, "respuestas"),
      where("preguntaId", "==", preguntaId)
    ));

    for (const rDoc of snap.docs) {
      try {
        const data       = rDoc.data();
        const uid        = data.uid;
        const puntosViejos = typeof data.puntosGanados === "number" ? data.puntosGanados : null;

        const esCorrecta   = data.respuesta === respuestaCorrecta;
        const puntosNuevos = esCorrecta ? 2 : 0;
        const delta = puntosViejos !== null
          ? puntosNuevos - puntosViejos
          : puntosNuevos;

        // Actualizar respuesta
        await updateDoc(doc(db, "respuestas", rDoc.id), {
          esCorrecta,
          puntosGanados: puntosNuevos,
        });

        if (delta !== 0) {
          await updateDoc(doc(db, "usuarios", uid), {
            puntosTotal: increment(delta),
          });

          const diaId   = `${uid}_${fecha}`;
          const diaRef  = doc(db, "puntosDelDia", diaId);
          const diaSnap = await getDoc(diaRef);

          if (diaSnap.exists()) {
            await updateDoc(diaRef, { puntos: increment(delta) });
          } else {
            const uSnap = await getDoc(doc(db, "usuarios", uid));
            const uData = uSnap.exists() ? uSnap.data() : {};
            await setDoc(diaRef, {
              uid, fecha,
              puntos:   delta > 0 ? delta : 0,
              nickname: uData.nickname || "",
              avatarId: uData.avatarId || "",
            });
          }
        }

        if (esCorrecta) procesados++;
      } catch (e) {
        console.error("Error procesando respuesta:", rDoc.id, e);
      }
    }

    return { ok: true, procesados };
  } catch (e) {
    console.error("Error general en procesarPreguntaDelDia:", e);
    return { ok: false, error: e.message };
  }
}

// ──────────────────────────────────────────────────────────────
// ENTREGAR CARTAS Y BONUS DEL DÍA
// ──────────────────────────────────────────────────────────────
/**
 * calcularGanadorDelDia(fecha)
 *
 * ► NO recalcula puntos de partidos ni pregunta (ya se sumaron al guardar).
 * ► Solo:
 *   1. Lee puntosDelDia para la fecha.
 *   2. Determina podio (1°, 2°, 3°) con soporte de empates.
 *   3. Otorga +2 pts bonus al/los del 1° lugar.
 *   4. Asigna cartas: x4 → 1°, x3 → 2°, x2 → 3°.
 *   5. Marca esGanador: true, bonusGanador: 2 en puntosDelDia.
 *
 * Retorna { ok, ganador, lugar1, lugar2, lugar3, totalJugadores }.
 */
export async function calcularGanadorDelDia(fecha) {
  try {
    const snap = await getDocs(query(
      collection(db, "puntosDelDia"),
      where("fecha", "==", fecha)
    ));

    if (snap.empty) {
      return {
        ok: false,
        mensaje: "Sin datos de puntosDelDia para ese día. Asegúrate de haber guardado resultados de partidos o la pregunta del día primero.",
      };
    }

    const jugadores = snap.docs
      .map((d) => ({ docId: d.id, ...d.data() }))
      .sort((a, b) => b.puntos - a.puntos);

    const maxPts = jugadores[0].puntos;
    const lugar1 = jugadores.filter(j => j.puntos === maxPts);
    const resto  = jugadores.filter(j => j.puntos < maxPts);
    const pts2   = resto[0]?.puntos;
    const lugar2 = pts2 !== undefined ? resto.filter(j => j.puntos === pts2) : [];
    const resto2 = resto.filter(j => j.puntos < (pts2 ?? -Infinity));
    const pts3   = resto2[0]?.puntos;
    const lugar3 = pts3 !== undefined ? resto2.filter(j => j.puntos === pts3) : [];

    // Bonus +2 y carta x4 al 1° lugar
    for (const j of lugar1) {
      await updateDoc(doc(db, "puntosDelDia", j.docId), {
        esGanador:    true,
        bonusGanador: 2,
      });
      await updateDoc(doc(db, "usuarios", j.uid), {
        puntosTotal: increment(2),
      });
      await _asignarCarta(j.uid, 4, fecha);
    }

    // Carta x3 al 2° lugar
    for (const j of lugar2) {
      await _asignarCarta(j.uid, 3, fecha);
    }

    // Carta x2 al 3° lugar
    for (const j of lugar3) {
      await _asignarCarta(j.uid, 2, fecha);
    }

    return {
      ok: true,
      ganador:        lugar1.map(j => j.nickname).join(", "),
      totalJugadores: jugadores.length,
      lugar1:         lugar1.map(j => j.nickname),
      lugar2:         lugar2.map(j => j.nickname),
      lugar3:         lugar3.map(j => j.nickname),
    };
  } catch (e) {
    console.error("Error en calcularGanadorDelDia:", e);
    return { ok: false, error: e.message };
  }
}

async function _asignarCarta(uid, multiplicador, fecha) {
  const carta = cartaAleatoriaPorMultiplicador(multiplicador);
  if (!carta) return;

  await setDoc(doc(db, "cartasDelUsuario", `${uid}_${carta.id}_${fecha}`), {
    uid,
    cartaId:       carta.id,
    cartaNombre:   carta.nombre,
    cartaSlug:     carta.slug,
    multiplicador: carta.multiplicador,
    rareza:        carta.rareza,
    fecha,
    visto: false,
  });

  await updateDoc(doc(db, "usuarios", uid), {
    [`cartas.${carta.id}`]: increment(1),
  });
}

// ──────────────────────────────────────────────────────────────
// AVISO DEL ADMIN
// ──────────────────────────────────────────────────────────────
export async function publicarAvisoAdmin(texto) {
  await setDoc(doc(db, "config", "avisoAdmin"), {
    texto,
    fecha:  new Date().toISOString(),
    activo: true,
  });
}

export async function cerrarAvisoAdmin() {
  await updateDoc(doc(db, "config", "avisoAdmin"), { activo: false });
}
