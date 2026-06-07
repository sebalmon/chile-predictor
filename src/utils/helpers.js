// ============================================================
// UTILIDADES v2 — Cálculo AUTOMÁTICO de puntajes
// Soporta fase de grupos y eliminatorias (alargue / penales)
// + multiplicadores de cartas coleccionables
// ============================================================
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  increment,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { CARTAS } from "../data/sampleData";

// ──────────────────────────────────────────────────────────────
// HELPERS DE FECHA
// ──────────────────────────────────────────────────────────────
export function partidoAbierto(fecha, horaInicio) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [hora, min] = horaInicio.split(":").map(Number);
  const inicio = new Date(anio, mes - 1, dia, hora, min, 0);
  const cierre = new Date(inicio.getTime() - 60 * 60 * 1000);
  return new Date() < cierre;
}

export function hoyStr() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ayerStr() {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const y = ayer.getFullYear();
  const m = String(ayer.getMonth() + 1).padStart(2, "0");
  const d = String(ayer.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatHora(horaStr) {
  return `${horaStr} hrs`;
}

export function formatFecha(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ──────────────────────────────────────────────────────────────
// CÁLCULO DE PUNTOS (solo retorna número, sin escribir a Firebase)
// ──────────────────────────────────────────────────────────────

/**
 * Calcula puntos de UNA predicción dado un resultado real.
 *
 * FASE GRUPOS (fase === "grupos"):
 *   resultado: { golesLocal, golesVisitante }
 *   prediccion: { ganador: "local"|"empate"|"visitante", diferencia: "1"|"2+" }
 *   estaDestacado (true): prediccion tiene { golesLocalPred, golesVisitantePred }
 *
 * FASES ELIMINATORIAS (cualquier otra fase):
 *   resultado: {
 *     golesLocal, golesVisitante,         ← 90 min
 *     definicion: "normal"|"alargue"|"penales",
 *     golesLocalAlargue, golesVisitanteAlargue,  ← si alargue o penales
 *     penalesLocal, penalesVisitante,     ← si penales
 *     ganadorFinal: "local"|"visitante"   ← quién ganó al final
 *   }
 *   prediccion: {
 *     ganador90: "local"|"visitante",
 *     diferencia90: "1"|"2+",
 *     definicion: "normal"|"alargue"|"penales",
 *     // si alargue:
 *     ganadorAlargue: "local"|"visitante",
 *     diferenciaAlargue: "1"|"2+",
 *     // si penales:
 *     penalesLocal: number, penalesVisitante: number
 *   }
 *
 * @returns { puntos: number, esMaximo: boolean }
 *   esMaximo: true si obtuvo el puntaje máximo posible para ese tipo de partido
 */
export function calcularPuntosPartido(prediccion, resultado, fase, estaDestacado) {
  if (!resultado || !prediccion) return { puntos: 0, esMaximo: false };

  const esEliminatoria = fase && fase !== "grupos";

  // ── FASE DE GRUPOS ────────────────────────────────────────
  if (!esEliminatoria) {
    const { golesLocal, golesVisitante } = resultado;
    const diff = Math.abs(golesLocal - golesVisitante);
    let ganadorReal =
      golesLocal > golesVisitante ? "local" :
      golesVisitante > golesLocal ? "visitante" : "empate";
    const diferenciaReal = diff === 1 ? "1" : "2+";

    if (estaDestacado) {
      // Partido destacado: marcador exacto → 3 pts, solo ganador → 1 pt
      const exacto =
        Number(prediccion.golesLocalPred) === golesLocal &&
        Number(prediccion.golesVisitantePred) === golesVisitante;
      if (exacto) return { puntos: 3, esMaximo: true };
      if (prediccion.ganador === ganadorReal) return { puntos: 1, esMaximo: false };
      return { puntos: 0, esMaximo: false };
    } else {
      // Partido normal: ganador → 1, ganador+diferencia → 2
      let puntos = 0;
      if (prediccion.ganador === ganadorReal) {
        puntos += 1;
        if (ganadorReal !== "empate" && prediccion.diferencia === diferenciaReal) {
          puntos += 1;
        }
      }
      const esMaximo = puntos === (ganadorReal === "empate" ? 1 : 2);
      return { puntos, esMaximo };
    }
  }

  // ── FASES ELIMINATORIAS ───────────────────────────────────
  const {
    golesLocal, golesVisitante,
    definicion,                    // "normal"|"alargue"|"penales"
    golesLocalAlargue, golesVisitanteAlargue,
    penalesLocal, penalesVisitante,
    ganadorFinal,
  } = resultado;

  // Ganador en 90 min
  let ganador90Real = null;
  if (golesLocal !== golesVisitante) {
    ganador90Real = golesLocal > golesVisitante ? "local" : "visitante";
  }
  const diff90 = Math.abs(golesLocal - golesVisitante);
  const diferencia90Real = diff90 === 1 ? "1" : "2+";

  let puntos = 0;
  let maxPosible = 0;

  if (definicion === "normal") {
    // Se decidió en 90 min (hubo ganador claro)
    maxPosible = 3; // ganador(2) + diferencia(1)
    if (prediccion.definicion === "normal") {
      if (prediccion.ganador90 === ganador90Real) {
        puntos += 2; // acertó ganador
        if (prediccion.diferencia90 === diferencia90Real) {
          puntos += 1; // acertó diferencia
        }
      }
    }
  } else if (definicion === "alargue") {
    maxPosible = 3; // alargue(2) + diferencia alargue(1)
    if (prediccion.definicion === "alargue") {
      puntos += 2; // acertó que hubo alargue
      // Ganador y diferencia en alargue
      const diffAlargue = Math.abs(
        (golesLocalAlargue ?? 0) - (golesVisitanteAlargue ?? 0)
      );
      const difAlargueReal = diffAlargue === 1 ? "1" : "2+";
      if (
        prediccion.ganadorAlargue === ganadorFinal &&
        prediccion.diferenciaAlargue === difAlargueReal
      ) {
        puntos += 1;
      }
    }
  } else if (definicion === "penales") {
    maxPosible = 4; // penales(2) + ganador tanda(1) + diferencia exacta(1)
    if (prediccion.definicion === "penales") {
      puntos += 2; // acertó que hubo penales
      if (prediccion.ganadorPenales === ganadorFinal) {
        puntos += 1; // acertó ganador de la tanda
        // Diferencia exacta en penales
        if (
          Number(prediccion.penalesLocal) === penalesLocal &&
          Number(prediccion.penalesVisitante) === penalesVisitante
        ) {
          puntos += 1;
        }
      }
    }
  }

  return { puntos, esMaximo: puntos === maxPosible };
}

/**
 * Calcula puntos de la pregunta del día.
 */
export function calcularPuntosPregunta(respuestaUsuario, respuestaCorrecta) {
  if (!respuestaCorrecta || !respuestaUsuario) return 0;
  return respuestaUsuario === respuestaCorrecta ? 2 : 0;
}

/**
 * Aplica multiplicador de carta si el usuario sacó puntaje máximo.
 * Si no fue máximo, la carta se consume sin efecto (retorna puntos sin cambio).
 */
export function aplicarMultiplicadorCarta(puntos, esMaximo, cartaId) {
  if (!cartaId || !esMaximo) return puntos;
  const carta = CARTAS.find((c) => c.id === cartaId);
  if (!carta) return puntos;
  return puntos * carta.multiplicador;
}

// ──────────────────────────────────────────────────────────────
// MOTOR DE CÓMPUTO AUTOMÁTICO
// Llama esto cuando el admin guarda el resultado de un partido.
// Lee todas las predicciones, calcula puntos, actualiza usuarios
// y construye/actualiza el podio del día.
// ──────────────────────────────────────────────────────────────

/**
 * procesarResultadoPartido(partidoId, resultado, fase, estaDestacado, fecha)
 *
 * @param {string} partidoId   - ID del partido en Firestore
 * @param {object} resultado   - Objeto resultado real (ver formato arriba)
 * @param {string} fase        - Fase del torneo
 * @param {boolean} estaDestacado
 * @param {string} fecha       - "YYYY-MM-DD"
 * @returns {Promise<{ procesados: number, errores: number }>}
 */
export async function procesarResultadoPartido(
  partidoId, resultado, fase, estaDestacado, fecha
) {
  let procesados = 0;
  let errores = 0;

  try {
    // 1. Obtener todas las predicciones para este partido
    const predQuery = query(
      collection(db, "predicciones"),
      where("partidoId", "==", partidoId)
    );
    const predSnap = await getDocs(predQuery);

    if (predSnap.empty) {
      return { procesados: 0, errores: 0 };
    }

    // 2. Calcular puntos para cada usuario
    const puntajesPorUsuario = {}; // uid → puntos ganados en este partido

    for (const predDoc of predSnap.docs) {
      try {
        const prediccion = predDoc.data();
        const uid = prediccion.uid;

        const { puntos: puntosBase, esMaximo } = calcularPuntosPartido(
          prediccion, resultado, fase, estaDestacado
        );

        // Aplicar multiplicador si adjuntó carta
        const puntosFinales = aplicarMultiplicadorCarta(
          puntosBase, esMaximo, prediccion.cartaId || null
        );

        // Actualizar documento de predicción con puntos calculados
        await updateDoc(doc(db, "predicciones", predDoc.id), {
          puntosGanados: puntosFinales,
          puntosBase,
          esMaximo,
          calculadoEn: new Date().toISOString(),
        });

        // Actualizar puntosTotal del usuario
        await updateDoc(doc(db, "usuarios", uid), {
          puntosTotal: increment(puntosFinales),
        });

        puntajesPorUsuario[uid] = (puntajesPorUsuario[uid] || 0) + puntosFinales;
        procesados++;
      } catch (e) {
        console.error(`Error procesando predicción ${predDoc.id}:`, e);
        errores++;
      }
    }

    // 3. Actualizar/crear registro en puntosDelDia para cada usuario
    //    (acumula todos los partidos del día)
    for (const [uid, puntosDia] of Object.entries(puntajesPorUsuario)) {
      try {
        const diaDocId = `${uid}_${fecha}`;
        const diaRef = doc(db, "puntosDelDia", diaDocId);
        const diaSnap = await getDoc(diaRef);

        // Obtener perfil del usuario para nickname/avatar
        const userSnap = await getDoc(doc(db, "usuarios", uid));
        const userProfile = userSnap.exists() ? userSnap.data() : {};

        if (diaSnap.exists()) {
          await updateDoc(diaRef, {
            puntos: increment(puntosDia),
          });
        } else {
          await setDoc(diaRef, {
            uid,
            fecha,
            puntos: puntosDia,
            nickname: userProfile.nickname || "",
            avatarEmoji: userProfile.avatarEmoji || "❓",
          });
        }
      } catch (e) {
        console.error(`Error actualizando puntosDelDia para ${uid}:`, e);
      }
    }

    // 4. Determinar ganador del día y darle +3 bonus
    //    (Solo ejecutar cuando se procesa el ÚLTIMO partido del día)
    //    → El admin debe llamar a calcularGanadorDelDia() separadamente
    //      desde la función de admin.

    return { procesados, errores };
  } catch (e) {
    console.error("Error en procesarResultadoPartido:", e);
    return { procesados: 0, errores: 1 };
  }
}

/**
 * calcularGanadorDelDia(fecha)
 * Llama DESPUÉS de procesar todos los partidos del día.
 * Ordena puntosDelDia por puntos, da +3 al primero,
 * y marca el podio para mostrarlo al día siguiente.
 *
 * @param {string} fecha - "YYYY-MM-DD"
 */
export async function calcularGanadorDelDia(fecha) {
  try {
    const q = query(
      collection(db, "puntosDelDia"),
      where("fecha", "==", fecha)
    );
    const snap = await getDocs(q);
    if (snap.empty) return { ok: false, mensaje: "Sin datos para ese día" };

    const jugadores = snap.docs
      .map((d) => ({ docId: d.id, ...d.data() }))
      .sort((a, b) => b.puntos - a.puntos);

    // Ganador del día: +3 puntos extra
    const ganador = jugadores[0];
    await updateDoc(doc(db, "puntosDelDia", ganador.docId), {
      esGanadorDelDia: true,
      bonusGanador: 3,
    });
    await updateDoc(doc(db, "usuarios", ganador.uid), {
      puntosTotal: increment(3),
    });

    return {
      ok: true,
      ganador: ganador.nickname,
      totalJugadores: jugadores.length,
    };
  } catch (e) {
    console.error("Error en calcularGanadorDelDia:", e);
    return { ok: false, error: e.message };
  }
}

/**
 * procesarPreguntaDelDia(preguntaId, respuestaCorrecta, fecha)
 * Recorre todas las respuestas a la pregunta, da +2 a quien acertó
 * y actualiza puntosDelDia y puntosTotal del usuario.
 */
export async function procesarPreguntaDelDia(preguntaId, respuestaCorrecta, fecha) {
  let procesados = 0;
  try {
    const q = query(
      collection(db, "respuestas"),
      where("preguntaId", "==", preguntaId)
    );
    const snap = await getDocs(q);

    for (const rDoc of snap.docs) {
      const data = rDoc.data();
      if (data.respuesta === respuestaCorrecta) {
        const uid = data.uid;
        await updateDoc(doc(db, "usuarios", uid), {
          puntosTotal: increment(2),
        });

        // Actualizar puntosDelDia
        const diaDocId = `${uid}_${fecha}`;
        const diaRef = doc(db, "puntosDelDia", diaDocId);
        const diaSnap = await getDoc(diaRef);
        const userSnap = await getDoc(doc(db, "usuarios", uid));
        const userProfile = userSnap.exists() ? userSnap.data() : {};

        if (diaSnap.exists()) {
          await updateDoc(diaRef, { puntos: increment(2) });
        } else {
          await setDoc(diaRef, {
            uid,
            fecha,
            puntos: 2,
            nickname: userProfile.nickname || "",
            avatarEmoji: userProfile.avatarEmoji || "❓",
          });
        }

        // Marcar respuesta como correcta/procesada
        await updateDoc(doc(db, "respuestas", rDoc.id), {
          esCorrecta: true,
          puntosGanados: 2,
        });

        procesados++;
      } else {
        await updateDoc(doc(db, "respuestas", rDoc.id), {
          esCorrecta: false,
          puntosGanados: 0,
        });
      }
    }
    return { ok: true, procesados };
  } catch (e) {
    console.error("Error procesarPreguntaDelDia:", e);
    return { ok: false, error: e.message };
  }
}
