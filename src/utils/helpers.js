// src/utils/helpers.js  — v3
import {
  collection, getDocs, query, where, doc,
  updateDoc, setDoc, increment, getDoc, arrayUnion,
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

export function formatHora(h)  { return `${h} hrs`; }
export function formatFecha(fechaStr) {
  const [y,m,d] = fechaStr.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"});
}

/**
 * Número de participación: 11/06/2026 = Día 1.
 * Para fechas anteriores al mundial → Día 0.
 */
export function diaNumero() {
  const inicio = new Date("2026-06-11T00:00:00");
  const hoy    = new Date();
  hoy.setHours(0,0,0,0);
  const diff = Math.floor((hoy - inicio) / 86400000);
  return diff < 0 ? 0 : diff + 1;
}

export function partidoAbierto(fecha, horaInicio) {
  const [y,m,d]   = fecha.split("-").map(Number);
  const [h,min]   = horaInicio.split(":").map(Number);
  const inicio    = new Date(y, m-1, d, h, min, 0);
  const cierre    = new Date(inicio.getTime() - 3600000);
  return new Date() < cierre;
}

// ──────────────────────────────────────────────────────────────
// CÁLCULO DE PUNTOS
// ──────────────────────────────────────────────────────────────

/**
 * Retorna { puntos, esMaximo }.
 * NUEVO: cualquier acierto positivo activa la carta (esMaximo = puntos > 0).
 */
export function calcularPuntosPartido(prediccion, resultado, fase, estaDestacado) {
  if (!resultado || !prediccion) return { puntos: 0, esMaximo: false };

  const esEliminatoria = fase && fase !== "grupos";

  // ── Grupos ────────────────────────────────────────────────
  if (!esEliminatoria) {
    const { golesLocal, golesVisitante } = resultado;
    const diff = Math.abs(golesLocal - golesVisitante);
    const ganadorReal =
      golesLocal > golesVisitante ? "local" :
      golesVisitante > golesLocal ? "visitante" : "empate";
    const difReal = diff === 1 ? "1" : "2+";

    if (estaDestacado) {
      const exacto =
        Number(prediccion.golesLocalPred)     === golesLocal &&
        Number(prediccion.golesVisitantePred) === golesVisitante;
      if (exacto)                            return { puntos: 3, esMaximo: true };
      if (prediccion.ganador === ganadorReal) return { puntos: 1, esMaximo: true };
      return { puntos: 0, esMaximo: false };
    } else {
      let puntos = 0;
      if (prediccion.ganador === ganadorReal) {
        puntos += 1;
        if (ganadorReal !== "empate" && prediccion.diferencia === difReal) puntos += 1;
      }
      return { puntos, esMaximo: puntos > 0 };
    }
  }

  // ── Eliminatorias ─────────────────────────────────────────
  const { golesLocal, golesVisitante, definicion,
          golesLocalAlargue, golesVisitanteAlargue,
          penalesLocal, penalesVisitante, ganadorFinal } = resultado;

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
      puntos += 2;
      const diffAlarg = Math.abs((golesLocalAlargue??0)-(golesVisitanteAlargue??0));
      const difAlargReal = diffAlarg === 1 ? "1" : "2+";
      if (prediccion.ganadorAlargue === ganadorFinal &&
          prediccion.diferenciaAlargue === difAlargReal) puntos += 1;
    }
  } else if (definicion === "penales") {
    if (prediccion.definicion === "penales") {
      puntos += 2;
      if (prediccion.ganadorPenales === ganadorFinal) {
        puntos += 1;
        if (Number(prediccion.penalesLocal) === penalesLocal &&
            Number(prediccion.penalesVisitante) === penalesVisitante) puntos += 1;
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
 * Aplica multiplicador si esMaximo (cualquier acierto positivo).
 */
export function aplicarMultiplicadorCarta(puntos, esMaximo, cartaId) {
  if (!cartaId || !esMaximo || puntos === 0) return puntos;
  const carta = CARTAS.find((c) => c.id === cartaId);
  return carta ? puntos * carta.multiplicador : puntos;
}

// ──────────────────────────────────────────────────────────────
// MOTOR AUTOMÁTICO — procesar resultado de partido
// ──────────────────────────────────────────────────────────────
export async function procesarResultadoPartido(
  partidoId, resultado, fase, estaDestacado, fecha
) {
  let procesados = 0, errores = 0;
  try {
    const snap = await getDocs(query(
      collection(db, "predicciones"),
      where("partidoId","==", partidoId)
    ));
    if (snap.empty) return { procesados: 0, errores: 0 };

    const puntajesPorUid = {};

    for (const pDoc of snap.docs) {
      try {
        const pred = pDoc.data();
        const uid  = pred.uid;
        const { puntos: base, esMaximo } = calcularPuntosPartido(
          pred, resultado, fase, estaDestacado
        );
        const final = aplicarMultiplicadorCarta(base, esMaximo, pred.cartaId||null);

        await updateDoc(doc(db,"predicciones",pDoc.id), {
          puntosGanados: final, puntosBase: base, esMaximo,
          calculadoEn: new Date().toISOString(),
        });
        await updateDoc(doc(db,"usuarios",uid), { puntosTotal: increment(final) });

        puntajesPorUid[uid] = (puntajesPorUid[uid]||0) + final;
        procesados++;
      } catch(e) { console.error(e); errores++; }
    }

    for (const [uid, pts] of Object.entries(puntajesPorUid)) {
      try {
        const diaId  = `${uid}_${fecha}`;
        const diaRef = doc(db,"puntosDelDia",diaId);
        const diaSnap = await getDoc(diaRef);
        const uSnap   = await getDoc(doc(db,"usuarios",uid));
        const uData   = uSnap.exists() ? uSnap.data() : {};

        if (diaSnap.exists()) {
          await updateDoc(diaRef, { puntos: increment(pts) });
        } else {
          await setDoc(diaRef, {
            uid, fecha, puntos: pts,
            nickname: uData.nickname||"",
            avatarId: uData.avatarId||"",
          });
        }
      } catch(e) { console.error(e); }
    }

    return { procesados, errores };
  } catch(e) {
    console.error(e);
    return { procesados: 0, errores: 1 };
  }
}

// ──────────────────────────────────────────────────────────────
// CERRAR DÍA: ganador + bonus + asignación automática de cartas
// ──────────────────────────────────────────────────────────────
/**
 * calcularGanadorDelDia(fecha)
 *
 * 1. Ordena puntosDelDia por puntos desc.
 * 2. Detecta empates en 1°, 2° y 3° lugar.
 * 3. Otorga +3 pts al/los 1°.
 * 4. Asigna cartas automáticamente (x4 → 1°, x3 → 2°, x2 → 3°).
 * 5. Guarda la carta en cartasDelUsuario (array en Firestore).
 * 6. Registra qué cartas se ganaron para el modal de notificación.
 */
export async function calcularGanadorDelDia(fecha) {
  try {
    const snap = await getDocs(query(
      collection(db,"puntosDelDia"), where("fecha","==",fecha)
    ));
    if (snap.empty) return { ok: false, mensaje: "Sin datos para ese día" };

    const jugadores = snap.docs
      .map((d) => ({ docId: d.id, ...d.data() }))
      .sort((a,b) => b.puntos - a.puntos);

    const maxPts = jugadores[0].puntos;

    // Construir podio con empates
    const lugar1 = jugadores.filter(j => j.puntos === maxPts);
    const resto  = jugadores.filter(j => j.puntos < maxPts);
    const pts2   = resto[0]?.puntos;
    const lugar2 = pts2 !== undefined ? resto.filter(j => j.puntos === pts2) : [];
    const resto2 = resto.filter(j => j.puntos < pts2);
    const pts3   = resto2[0]?.puntos;
    const lugar3 = pts3 !== undefined ? resto2.filter(j => j.puntos === pts3) : [];

    // Otorgar bonus +3 y carta x4 a los del 1° lugar
    for (const j of lugar1) {
      await updateDoc(doc(db,"puntosDelDia",j.docId), { esGanador: true, bonusGanador: 3 });
      await updateDoc(doc(db,"usuarios",j.uid), { puntosTotal: increment(3) });
      await _asignarCarta(j.uid, 4, fecha);
    }
    // Carta x3 a los del 2° lugar
    for (const j of lugar2) {
      await _asignarCarta(j.uid, 3, fecha);
    }
    // Carta x2 a los del 3° lugar
    for (const j of lugar3) {
      await _asignarCarta(j.uid, 2, fecha);
    }

    return {
      ok: true,
      ganador: lugar1.map(j=>j.nickname).join(", "),
      totalJugadores: jugadores.length,
      lugar1: lugar1.map(j=>j.nickname),
      lugar2: lugar2.map(j=>j.nickname),
      lugar3: lugar3.map(j=>j.nickname),
    };
  } catch(e) {
    console.error(e);
    return { ok: false, error: e.message };
  }
}

async function _asignarCarta(uid, multiplicador, fecha) {
  const carta = cartaAleatoriaPorMultiplicador(multiplicador);
  if (!carta) return;
  // Guardar en subcolección cartasDelUsuario (para historial/notificación)
  await setDoc(doc(db, "cartasDelUsuario", `${uid}_${carta.id}_${fecha}`), {
    uid,
    cartaId: carta.id,
    cartaNombre: carta.nombre,
    cartaSlug: carta.slug,
    multiplicador: carta.multiplicador,
    rareza: carta.rareza,
    fecha,
    visto: false, // para el modal de notificación
  });
  // Agregar al array cartasDesbloqueadas del usuario
  await updateDoc(doc(db,"usuarios",uid), {
    cartasDesbloqueadas: arrayUnion(carta.id),
  });
}

// ──────────────────────────────────────────────────────────────
// PROCESAR PREGUNTA DEL DÍA
// ──────────────────────────────────────────────────────────────
export async function procesarPreguntaDelDia(preguntaId, respuestaCorrecta, fecha) {
  let procesados = 0;
  try {
    const snap = await getDocs(query(
      collection(db,"respuestas"), where("preguntaId","==",preguntaId)
    ));
    for (const rDoc of snap.docs) {
      const data = rDoc.data();
      const uid  = data.uid;
      if (data.respuesta === respuestaCorrecta) {
        await updateDoc(doc(db,"usuarios",uid), { puntosTotal: increment(2) });
        const diaId  = `${uid}_${fecha}`;
        const diaRef = doc(db,"puntosDelDia",diaId);
        const diaSnap = await getDoc(diaRef);
        const uSnap  = await getDoc(doc(db,"usuarios",uid));
        const uData  = uSnap.exists() ? uSnap.data() : {};
        if (diaSnap.exists()) {
          await updateDoc(diaRef, { puntos: increment(2) });
        } else {
          await setDoc(diaRef,{ uid, fecha, puntos: 2,
            nickname: uData.nickname||"", avatarId: uData.avatarId||"" });
        }
        await updateDoc(doc(db,"respuestas",rDoc.id),{ esCorrecta:true, puntosGanados:2 });
        procesados++;
      } else {
        await updateDoc(doc(db,"respuestas",rDoc.id),{ esCorrecta:false, puntosGanados:0 });
      }
    }
    return { ok: true, procesados };
  } catch(e) {
    console.error(e);
    return { ok: false, error: e.message };
  }
}

// ──────────────────────────────────────────────────────────────
// AVISO DEL ADMIN a participantes
// Guarda el mensaje en Firestore; cada cliente lo lee al iniciar.
// ──────────────────────────────────────────────────────────────
export async function publicarAvisoAdmin(texto) {
  await setDoc(doc(db,"config","avisoAdmin"), {
    texto,
    fecha: new Date().toISOString(),
    activo: true,
  });
}

export async function cerrarAvisoAdmin() {
  await updateDoc(doc(db,"config","avisoAdmin"), { activo: false });
}
