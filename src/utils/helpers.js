// src/utils/helpers.js  — v5 (Fase 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v5:
//   • procesarResultadoPartido: escribe notificación en
//     usuarios/{uid}/notificaciones/{autoId} por cada usuario afectado.
//   • procesarPreguntaDelDia: ídem para la pregunta.
//   • calcularGanadorDelDia: escribe notificación del bonus diario.
//   • Todo lo demás idéntico a v4.
// ─────────────────────────────────────────────────────────────
import {
  collection, getDocs, query, where, doc,
  updateDoc, setDoc, increment, getDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { CARTAS, cartaAleatoriaPorMultiplicador, FASE_LABELS } from "../data/sampleData";

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

export function diaNumero() {
  const inicio = new Date("2026-06-11T00:00:00");
  const hoy    = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoy - inicio) / 86400000);
  return diff < 0 ? 0 : diff + 1;
}

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
// CÁLCULO DE PUNTOS — TABLA v4/v5
// ──────────────────────────────────────────────────────────────
export function calcularPuntosPartido(prediccion, resultado, fase, estaDestacado) {
  if (!resultado || !prediccion) return { puntos: 0, esMaximo: false };

  const esEliminatoria = fase && fase !== "grupos";

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
      puntos += 3;
      const diffAlarg    = Math.abs((golesLocalAlargue ?? 0) - (golesVisitanteAlargue ?? 0));
      const difAlargReal = diffAlarg === 1 ? "1" : "2+";
      if (prediccion.ganadorAlargue === ganadorFinal &&
          prediccion.diferenciaAlargue === difAlargReal) puntos += 3;
    }
  } else if (definicion === "penales") {
    if (prediccion.definicion === "penales") {
      puntos += 3;
      const acertaExacta =
        Number(prediccion.penalesLocal)     === penalesLocal &&
        Number(prediccion.penalesVisitante) === penalesVisitante;
      const acertaGanador = prediccion.ganadorPenales === ganadorFinal;
      if (acertaExacta) puntos += 4;
      else if (acertaGanador) puntos += 2;
    }
  }

  return { puntos, esMaximo: puntos > 0 };
}

export function calcularPuntosPregunta(respuesta, correcta) {
  if (!correcta || !respuesta) return 0;
  return respuesta === correcta ? 2 : 0;
}

export function aplicarMultiplicadorCarta(puntos, esMaximo, cartaId) {
  if (!cartaId || !esMaximo || puntos === 0) return puntos;
  const carta = CARTAS.find((c) => c.id === cartaId);
  return carta ? puntos * carta.multiplicador : puntos;
}

// ──────────────────────────────────────────────────────────────
// HELPER INTERNO: escribir notificación
// ──────────────────────────────────────────────────────────────
async function _crearNotificacion(uid, datos) {
  try {
    await addDoc(
      collection(db, "usuarios", uid, "notificaciones"),
      {
        ...datos,
        leido:     false,
        timestamp: serverTimestamp(),
      }
    );
  } catch (e) {
    console.error("Error creando notificación para", uid, e);
  }
}

// ──────────────────────────────────────────────────────────────
// HELPER: texto legible de la predicción de un partido
// ──────────────────────────────────────────────────────────────
function _textoPrediccion(pred, estaDestacado) {
  if (estaDestacado) {
    return `${pred.golesLocalPred ?? "?"} - ${pred.golesVisitantePred ?? "?"}`;
  }
  const ganLabel = pred.ganador === "local" ? "Local" : pred.ganador === "visitante" ? "Visitante" : "Empate";
  const difLabel = pred.diferencia ? ` (dif. ${pred.diferencia})` : "";
  return `${ganLabel}${difLabel}`;
}

function _textoResultado(resultado, estaDestacado) {
  const base = `${resultado.golesLocal}-${resultado.golesVisitante}`;
  if (resultado.definicion && resultado.definicion !== "normal") {
    const ext = resultado.definicion === "penales"
      ? ` (penales ${resultado.penalesLocal}-${resultado.penalesVisitante})`
      : " (alargue)";
    return base + ext;
  }
  return base;
}

// ──────────────────────────────────────────────────────────────
// PROCESAR RESULTADO DE PARTIDO (con recálculo + notificaciones)
// ──────────────────────────────────────────────────────────────
export async function procesarResultadoPartido(
  partidoId, resultado, fase, estaDestacado, fecha
) {
  let procesados = 0, errores = 0;
  try {
    // Leer datos del partido para el mensaje
    let nombrePartido = partidoId;
    try {
      const pSnap = await getDoc(doc(db, "partidos", partidoId));
      if (pSnap.exists()) {
        const pd = pSnap.data();
        nombrePartido = `${pd.local?.bandera ?? ""}${pd.local?.nombre ?? ""} vs ${pd.visitante?.nombre ?? ""}${pd.visitante?.bandera ?? ""}`;
      }
    } catch (_) {}

    const snap = await getDocs(query(
      collection(db, "predicciones"),
      where("partidoId", "==", partidoId)
    ));
    if (snap.empty) return { procesados: 0, errores: 0 };

    const deltasPorUid  = {};
    const notifsPorUid  = {};

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

        await updateDoc(doc(db, "predicciones", pDoc.id), {
          puntosGanados: puntosNuevos,
          puntosBase:    base,
          esMaximo,
          calculadoEn:  new Date().toISOString(),
        });

        if (delta !== 0) {
          await updateDoc(doc(db, "usuarios", uid), {
            puntosTotal: increment(delta),
          });
          deltasPorUid[uid] = (deltasPorUid[uid] || 0) + delta;
        }

        // Datos para la notificación
        notifsPorUid[uid] = {
          tipo:         "resultado_partido",
          partidoId,
          nombrePartido,
          tuApuesta:    _textoPrediccion(pred, estaDestacado),
          resultado:    _textoResultado(resultado, estaDestacado),
          acertaste:    esMaximo,
          puntosGanados: puntosNuevos,
          fecha,
        };

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
        console.error("Error actualizando puntosDelDia:", uid, e);
      }
    }

    // Escribir notificaciones (solo a quienes tenían predicción)
    for (const [uid, datos] of Object.entries(notifsPorUid)) {
      await _crearNotificacion(uid, datos);
    }

    return { procesados, errores };
  } catch (e) {
    console.error("Error general en procesarResultadoPartido:", e);
    return { procesados: 0, errores: 1 };
  }
}

// ──────────────────────────────────────────────────────────────
// PROCESAR PREGUNTA DEL DÍA (con recálculo + notificaciones)
// ──────────────────────────────────────────────────────────────
export async function procesarPreguntaDelDia(preguntaId, respuestaCorrecta, fecha) {
  let procesados = 0;
  try {
    // Leer texto de la pregunta
    let textoPregunta = "Pregunta del día";
    try {
      const pSnap = await getDoc(doc(db, "preguntas", preguntaId));
      if (pSnap.exists()) textoPregunta = pSnap.data().texto || textoPregunta;
    } catch (_) {}

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

        // Notificación
        await _crearNotificacion(uid, {
          tipo:            "resultado_pregunta",
          preguntaId,
          textoPregunta,
          tuRespuesta:     data.respuesta,
          respuestaCorrecta,
          acertaste:       esCorrecta,
          puntosGanados:   puntosNuevos,
          fecha,
        });

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

    for (const j of lugar1) {
      await updateDoc(doc(db, "puntosDelDia", j.docId), {
        esGanador: true, bonusGanador: 2,
      });
      await updateDoc(doc(db, "usuarios", j.uid), { puntosTotal: increment(2) });
      await _asignarCarta(j.uid, 4, fecha);
      await _crearNotificacion(j.uid, {
        tipo:    "bonus_ganador",
        lugar:   1,
        bonus:   2,
        fecha,
        mensaje: `🥇 ¡Ganaste el día ${fecha}! +2 pts bonus y una carta x4.`,
      });
    }

    for (const j of lugar2) {
      await _asignarCarta(j.uid, 3, fecha);
      await _crearNotificacion(j.uid, {
        tipo:    "bonus_ganador",
        lugar:   2,
        bonus:   0,
        fecha,
        mensaje: `🥈 Quedaste 2° el día ${fecha}. ¡Recibiste una carta x3!`,
      });
    }

    for (const j of lugar3) {
      await _asignarCarta(j.uid, 2, fecha);
      await _crearNotificacion(j.uid, {
        tipo:    "bonus_ganador",
        lugar:   3,
        bonus:   0,
        fecha,
        mensaje: `🥉 Quedaste 3° el día ${fecha}. ¡Recibiste una carta x2!`,
      });
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
    uid, cartaId: carta.id, cartaNombre: carta.nombre,
    cartaSlug: carta.slug, multiplicador: carta.multiplicador,
    rareza: carta.rareza, fecha, visto: false,
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
    texto, fecha: new Date().toISOString(), activo: true,
  });
}

export async function cerrarAvisoAdmin() {
  await updateDoc(doc(db, "config", "avisoAdmin"), { activo: false });
}
