// src/utils/helpers.js  — v6 (Fase 3)
// CAMBIO v6: procesarResultadoPartido consume carta (decrement -1)
// usando flag cartaConsumida para evitar doble descuento en recálculo.
// Todo lo demás idéntico a v5.
import {
  collection, getDocs, query, where, doc,
  updateDoc, setDoc, increment, getDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";
import {
  calcularPuntosPartido, calcularPuntosPregunta,
  aplicarMultiplicadorCarta, cartaSeAplica,
} from "./scoring";

// Re-export para compatibilidad con quien importe desde helpers.
export { calcularPuntosPartido, calcularPuntosPregunta, aplicarMultiplicadorCarta };

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
  const [y,m,d] = fechaStr.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"});
}
export function diaNumero() {
  const inicio = new Date("2026-06-11T00:00:00");
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const diff = Math.floor((hoy - inicio) / 86400000);
  return diff < 0 ? 0 : diff + 1;
}
export function partidoAbierto(partido) {
  if (!partido || !partido.cierre) return true;
  let cd;
  if (typeof partido.cierre.toDate === "function") cd = partido.cierre.toDate();
  else if (partido.cierre._seconds !== undefined)  cd = new Date(partido.cierre._seconds * 1000);
  else if (typeof partido.cierre === "number")     cd = new Date(partido.cierre * 1000);
  else if (typeof partido.cierre === "string")     cd = new Date(partido.cierre);
  else return true;
  return new Date() < cd;
}

// ── Notificación interna ─────────────────────────────────────
async function _notif(uid, datos) {
  try {
    await addDoc(collection(db,"usuarios",uid,"notificaciones"),
      { ...datos, leido: false, timestamp: serverTimestamp() });
  } catch(e) { console.error("notif error", e); }
}
function _txtPred(pred, dest) {
  if (dest) return `${pred.golesLocalPred??'?'} - ${pred.golesVisitantePred??'?'}`;
  const g = pred.ganador === "local" ? "Local" : pred.ganador === "visitante" ? "Visitante" : "Empate";
  return g + (pred.diferencia ? ` (dif. ${pred.diferencia})` : "");
}
function _txtRes(res) {
  const b = `${res.golesLocal}-${res.golesVisitante}`;
  if (res.definicion === "penales") return `${b} (pen. ${res.penalesLocal}-${res.penalesVisitante})`;
  if (res.definicion === "alargue") return `${b} (alg.)`;
  return b;
}

// ── procesarResultadoPartido v6 (consume carta) ──────────────
export async function procesarResultadoPartido(partidoId, resultado, fase, estaDestacado, fecha) {
  let procesados = 0, errores = 0;
  try {
    let nombrePartido = partidoId;
    try {
      const ps = await getDoc(doc(db,"partidos",partidoId));
      if (ps.exists()) {
        const pd = ps.data();
        nombrePartido = `${pd.local?.bandera??''}${pd.local?.nombre??''} vs ${pd.visitante?.nombre??''}${pd.visitante?.bandera??''}`;
      }
    } catch(_) {}

    const snap = await getDocs(query(collection(db,"predicciones"),where("partidoId","==",partidoId)));
    if (snap.empty) return { procesados:0, errores:0 };

    const deltasPorUid = {}, notifsPorUid = {};

    // Cache de inventario de cartas por uid: la carta solo multiplica si el
    // usuario tiene stock al momento de procesar (evita que una misma carta
    // multiplique varios partidos y que el contador quede negativo).
    const stockCartas = {};
    async function stockDisponible(uid, cartaId) {
      if (!(uid in stockCartas)) {
        try {
          const us = await getDoc(doc(db,"usuarios",uid));
          stockCartas[uid] = us.exists() ? (us.data().cartas || {}) : {};
        } catch { stockCartas[uid] = {}; }
      }
      return (stockCartas[uid][cartaId] || 0) > 0;
    }

    for (const pDoc of snap.docs) {
      try {
        const pred = pDoc.data();
        const uid  = pred.uid;
        const puntosViejos = typeof pred.puntosGanados === "number" ? pred.puntosGanados : null;
        const yaConsumio   = pred.cartaConsumida === true;

        // ¿La carta se aplica? (lógica pura en scoring.cartaSeAplica)
        const stock = pred.cartaId && !yaConsumio ? (await stockDisponible(uid, pred.cartaId) ? 1 : 0) : 0;
        const cartaAplica = cartaSeAplica(!!pred.cartaId, yaConsumio, stock);

        const { puntos: base, esMaximo } = calcularPuntosPartido(pred, resultado, fase, estaDestacado);
        const puntosNuevos = aplicarMultiplicadorCarta(base, esMaximo, cartaAplica ? pred.cartaId : null);
        const delta = puntosViejos !== null ? puntosNuevos - puntosViejos : puntosNuevos;

        // Actualizar predicción
        const upd = { puntosGanados: puntosNuevos, puntosBase: base, esMaximo, calculadoEn: new Date().toISOString() };
        if (cartaAplica && !yaConsumio) upd.cartaConsumida = true;
        await updateDoc(doc(db,"predicciones",pDoc.id), upd);

        // Consumir carta (solo primera vez y si había stock; descuenta del cache local)
        if (cartaAplica && !yaConsumio) {
          try {
            await updateDoc(doc(db,"usuarios",uid), { [`cartas.${pred.cartaId}`]: increment(-1) });
            stockCartas[uid][pred.cartaId] = (stockCartas[uid][pred.cartaId] || 0) - 1;
          } catch(e) { console.error("Error consumiendo carta:", e); }
        }

        if (delta !== 0) {
          await updateDoc(doc(db,"usuarios",uid), { puntosTotal: increment(delta) });
          deltasPorUid[uid] = (deltasPorUid[uid] || 0) + delta;
        }

        // Notificar solo en el primer procesamiento o si el puntaje cambió
        // (evita spam de notificaciones al re-guardar un resultado sin cambios).
        if (puntosViejos === null || delta !== 0) {
          notifsPorUid[uid] = {
            tipo:"resultado_partido", partidoId, nombrePartido,
            tuApuesta: _txtPred(pred, estaDestacado), resultado: _txtRes(resultado),
            acertaste: esMaximo, puntosGanados: puntosNuevos, fecha,
          };
        }
        procesados++;
      } catch(e) { console.error("Error pred:", pDoc.id, e); errores++; }
    }

    for (const [uid, delta] of Object.entries(deltasPorUid)) {
      if (delta === 0) continue;
      try {
        const diaRef  = doc(db,"puntosDelDia",`${uid}_${fecha}`);
        const diaSnap = await getDoc(diaRef);
        if (diaSnap.exists()) {
          await updateDoc(diaRef, { puntos: increment(delta) });
        } else {
          const uSnap = await getDoc(doc(db,"usuarios",uid));
          const ud = uSnap.exists() ? uSnap.data() : {};
          await setDoc(diaRef, { uid, fecha, puntos: delta>0?delta:0, nickname:ud.nickname||"", avatarId:ud.avatarId||"" });
        }
      } catch(e) { console.error("puntosDelDia error:", uid, e); }
    }

    for (const [uid, datos] of Object.entries(notifsPorUid)) await _notif(uid, datos);
    return { procesados, errores };
  } catch(e) {
    console.error("Error general procesarResultadoPartido:", e);
    return { procesados:0, errores:1 };
  }
}

// ── procesarPreguntaDelDia ────────────────────────────────────
export async function procesarPreguntaDelDia(preguntaId, respuestaCorrecta, fecha) {
  let procesados = 0;
  try {
    let textoPregunta = "Pregunta del día";
    try {
      const ps = await getDoc(doc(db,"preguntas",preguntaId));
      if (ps.exists()) textoPregunta = ps.data().texto || textoPregunta;
    } catch(_) {}

    const snap = await getDocs(query(collection(db,"respuestas"),where("preguntaId","==",preguntaId)));
    for (const rDoc of snap.docs) {
      try {
        const data = rDoc.data(); const uid = data.uid;
        const puntosViejos = typeof data.puntosGanados === "number" ? data.puntosGanados : null;
        const esCorrecta   = data.respuesta === respuestaCorrecta;
        const puntosNuevos = esCorrecta ? 2 : 0;
        const delta = puntosViejos !== null ? puntosNuevos - puntosViejos : puntosNuevos;

        await updateDoc(doc(db,"respuestas",rDoc.id), { esCorrecta, puntosGanados: puntosNuevos });

        if (delta !== 0) {
          await updateDoc(doc(db,"usuarios",uid), { puntosTotal: increment(delta) });
          const diaRef  = doc(db,"puntosDelDia",`${uid}_${fecha}`);
          const diaSnap = await getDoc(diaRef);
          if (diaSnap.exists()) {
            await updateDoc(diaRef, { puntos: increment(delta) });
          } else {
            const uSnap = await getDoc(doc(db,"usuarios",uid));
            const ud = uSnap.exists() ? uSnap.data() : {};
            await setDoc(diaRef, { uid, fecha, puntos:delta>0?delta:0, nickname:ud.nickname||"", avatarId:ud.avatarId||"" });
          }
        }

        await _notif(uid, {
          tipo:"resultado_pregunta", preguntaId, textoPregunta,
          tuRespuesta:data.respuesta, respuestaCorrecta,
          acertaste:esCorrecta, puntosGanados:puntosNuevos, fecha,
        });
        if (esCorrecta) procesados++;
      } catch(e) { console.error("Error resp:", rDoc.id, e); }
    }
    return { ok:true, procesados };
  } catch(e) {
    console.error("Error procesarPreguntaDelDia:", e);
    return { ok:false, error:e.message };
  }
}

// ── calcularGanadorDelDia ─────────────────────────────────────
export async function calcularGanadorDelDia(fecha) {
  try {
    const snap = await getDocs(query(collection(db,"puntosDelDia"),where("fecha","==",fecha)));
    if (snap.empty) return { ok:false, mensaje:"Sin datos de puntosDelDia para ese día." };

    const jug = snap.docs.map(d=>({docId:d.id,...d.data()})).sort((a,b)=>b.puntos-a.puntos);

    // ── Protección: si ya se entregaron bonus y cartas, no repetir ────
    if (jug.some(j => j.esGanador === true)) {
      return {
        ok: false,
        yaEntregado: true,
        mensaje: `Las cartas y bonus del día ${fecha} ya fueron entregados. Para revertir, elimina el campo esGanador desde Firebase Console.`,
      };
    }
    const maxPts = jug[0].puntos;
    // No premiar si nadie sumó puntos ese día (evita carta x4 + bonus a un "líder" con 0 pts).
    if (maxPts <= 0) return { ok:false, mensaje:`Nadie sumó puntos el día ${fecha}; no se entregan cartas ni bonus.` };
    const l1 = jug.filter(j=>j.puntos===maxPts);
    const r1 = jug.filter(j=>j.puntos<maxPts);
    const p2 = r1[0]?.puntos;
    const l2 = p2!==undefined ? r1.filter(j=>j.puntos===p2) : [];
    const r2 = r1.filter(j=>j.puntos<(p2??-Infinity));
    const p3 = r2[0]?.puntos;
    const l3 = p3!==undefined ? r2.filter(j=>j.puntos===p3) : [];

    for (const j of l1) {
      await updateDoc(doc(db,"puntosDelDia",j.docId),{esGanador:true,bonusGanador:2});
      await updateDoc(doc(db,"usuarios",j.uid),{puntosTotal:increment(2)});
      await _asignarCarta(j.uid,4,fecha);
      await _notif(j.uid,{tipo:"bonus_ganador",lugar:1,bonus:2,fecha,mensaje:`🥇 ¡Ganaste el día ${fecha}! +2 pts bonus y una carta x4.`});
    }
    for (const j of l2) { await _asignarCarta(j.uid,3,fecha); await _notif(j.uid,{tipo:"bonus_ganador",lugar:2,bonus:0,fecha,mensaje:`🥈 Quedaste 2° el día ${fecha}. ¡Carta x3!`}); }
    for (const j of l3) { await _asignarCarta(j.uid,2,fecha); await _notif(j.uid,{tipo:"bonus_ganador",lugar:3,bonus:0,fecha,mensaje:`🥉 Quedaste 3° el día ${fecha}. ¡Carta x2!`}); }

    return { ok:true, ganador:l1.map(j=>j.nickname).join(", "), totalJugadores:jug.length,
      lugar1:l1.map(j=>j.nickname), lugar2:l2.map(j=>j.nickname), lugar3:l3.map(j=>j.nickname) };
  } catch(e) {
    console.error("Error calcularGanadorDelDia:", e);
    return { ok:false, error:e.message };
  }
}

async function _asignarCarta(uid, mult, fecha) {
  const carta = cartaAleatoriaPorMultiplicador(mult);
  if (!carta) return;
  await setDoc(doc(db,"cartasDelUsuario",`${uid}_${carta.id}_${fecha}`),{
    uid, cartaId:carta.id, cartaNombre:carta.nombre, cartaSlug:carta.slug,
    multiplicador:carta.multiplicador, rareza:carta.rareza, fecha, visto:false,
  });
  await updateDoc(doc(db,"usuarios",uid),{[`cartas.${carta.id}`]:increment(1)});
}

export async function publicarAvisoAdmin(texto) {
  await setDoc(doc(db,"config","avisoAdmin"),{texto,fecha:new Date().toISOString(),activo:true});
}
export async function cerrarAvisoAdmin() {
  await updateDoc(doc(db,"config","avisoAdmin"),{activo:false});
}
