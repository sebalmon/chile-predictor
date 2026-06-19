// src/utils/cartaDiaria.js  — v1 (Fase 4)
// ─────────────────────────────────────────────────────────────
// Entrega automática de carta diaria según posición en el
// ranking ACUMULADO (puntosTotal) del día anterior.
//
// TABLA (corregida según brief):
//   Puestos 1-3:  Sin carta diaria (ya reciben carta del podio)
//   Puestos 4-6:  carta ×2
//   Puestos 7-12: carta ×3
//   Puestos 13-22:carta ×4
//   Puestos 23+:  2 cartas ×4
//
// Guarda en Firestore: cartaDiaria/{uid}_{fecha} → { uid, fecha, entregada:true }
// Retrocompatible: si ya existe ese documento, no entrega de nuevo.
// ─────────────────────────────────────────────────────────────
import {
  collection, getDocs, query, orderBy,
  doc, getDoc, setDoc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { hoyStr, ayerStr } from "./helpers";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";

/**
 * entregarCartaDiaria(uid)
 *
 * Llamar al montar Dashboard (una sola vez por sesión/día).
 * Retorna { ok, carta?, cantidad?, skip? }.
 */
export async function entregarCartaDiaria(uid) {
  if (!uid) return { ok: false, skip: true };

  const hoy = hoyStr();
  const diaId = `${uid}_${hoy}`;

  // 1. Verificar si ya recibió carta hoy
  try {
    const yaRef  = doc(db, "cartaDiaria", diaId);
    const yaSnap = await getDoc(yaRef);
    if (yaSnap.exists() && yaSnap.data().entregada) {
      return { ok: false, skip: true, mensaje: "Ya recibiste tu carta de hoy." };
    }
  } catch (_) {}

  // 2. Leer ranking acumulado actual (ordenado por puntosTotal desc)
  let posicion = null;
  try {
    const snapU = await getDocs(query(
      collection(db, "usuarios"), orderBy("puntosTotal", "desc")
    ));
    const lista = snapU.docs.map(d => d.id);
    const idx   = lista.indexOf(uid);
    posicion    = idx >= 0 ? idx + 1 : null; // posición base-1
  } catch (e) {
    console.error("cartaDiaria: error leyendo ranking", e);
    return { ok: false, error: e.message };
  }

  if (posicion === null) return { ok: false, skip: true };

  // 3. Determinar qué carta corresponde
  let multiplicador = null;
  let cantidad      = 1;

  if (posicion <= 3) {
    // Sin carta diaria (ya tienen la del podio)
    await _marcarEntregada(diaId, uid, hoy, null, 0);
    return { ok: false, skip: true, mensaje: "Estás en el podio, tu carta la recibirás al cerrar el día." };
  } else if (posicion <= 6) {
    multiplicador = 2; cantidad = 1;
  } else if (posicion <= 12) {
    multiplicador = 3; cantidad = 1;
  } else if (posicion <= 22) {
    multiplicador = 4; cantidad = 1;
  } else {
    multiplicador = 4; cantidad = 2;
  }

  // 4. Asignar carta(s)
  const cartasEntregadas = [];
  for (let i = 0; i < cantidad; i++) {
    const carta = cartaAleatoriaPorMultiplicador(multiplicador);
    if (!carta) continue;
    try {
      // Guardar en cartasDelUsuario
      const cartaDocId = `${uid}_${carta.id}_${hoy}_diaria_${i}`;
      await setDoc(doc(db, "cartasDelUsuario", cartaDocId), {
        uid,
        cartaId:       carta.id,
        cartaNombre:   carta.nombre,
        cartaSlug:     carta.slug,
        multiplicador: carta.multiplicador,
        rareza:        carta.rareza,
        fecha:         hoy,
        visto:         false,
        origen:        "cartaDiaria",
      });
      // Incrementar mapa cartas en usuario
      await updateDoc(doc(db, "usuarios", uid), {
        [`cartas.${carta.id}`]: increment(1),
      });
      cartasEntregadas.push(carta);
    } catch (e) {
      console.error("cartaDiaria: error asignando carta", e);
    }
  }

  // 5. Marcar como entregada
  await _marcarEntregada(diaId, uid, hoy, multiplicador, cantidad);

  return {
    ok:       cartasEntregadas.length > 0,
    cartas:   cartasEntregadas,
    posicion,
    multiplicador,
    cantidad,
  };
}

async function _marcarEntregada(diaId, uid, fecha, multiplicador, cantidad) {
  try {
    await setDoc(doc(db, "cartaDiaria", diaId), {
      uid, fecha,
      entregada:    true,
      multiplicador,
      cantidad,
      entregadaEn:  new Date().toISOString(),
    });
  } catch (e) {
    console.error("cartaDiaria: error marcando entregada", e);
  }
}
