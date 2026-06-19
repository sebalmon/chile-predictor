// src/utils/cartaDiaria.js  — v2 (Bugfix 1)
// ─────────────────────────────────────────────────────────────
// BUG 5 CORREGIDO: protección triple contra duplicados
//   1. Singleton en memoria (evita doble llamada en StrictMode)
//   2. localStorage (evita repetición al refrescar)
//   3. Firestore (fuente de verdad entre dispositivos)
//   + Escritura optimista: marca en Firestore ANTES de dar cartas
// ─────────────────────────────────────────────────────────────
import {
  collection, getDocs, query, orderBy,
  doc, getDoc, setDoc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { hoyStr } from "./helpers";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";

// Singleton por sesión JS — previene doble ejecución en StrictMode/re-renders
const _ejecutadoEnSesion = new Set();

export async function entregarCartaDiaria(uid) {
  if (!uid) return { ok: false, skip: true };

  const hoy   = hoyStr();
  const key   = `${uid}_${hoy}`;
  const lsKey = `cp8b_cartadiaria_${key}`;

  // Capa 1: memoria
  if (_ejecutadoEnSesion.has(key)) return { ok: false, skip: true };
  _ejecutadoEnSesion.add(key);

  // Capa 2: localStorage
  if (localStorage.getItem(lsKey)) return { ok: false, skip: true };

  // Capa 3: Firestore
  try {
    const snap = await getDoc(doc(db, "cartaDiaria", key));
    if (snap.exists() && snap.data().entregada) {
      localStorage.setItem(lsKey, "1");
      return { ok: false, skip: true };
    }
  } catch (e) {
    console.error("cartaDiaria: verificación fallida", e);
    return { ok: false, skip: true };
  }

  // Obtener posición en ranking
  let posicion = null;
  try {
    const snapU = await getDocs(query(
      collection(db, "usuarios"), orderBy("puntosTotal", "desc")
    ));
    const idx = snapU.docs.findIndex(d => d.id === uid);
    posicion  = idx >= 0 ? idx + 1 : null;
  } catch (e) {
    console.error("cartaDiaria: error ranking", e);
    _ejecutadoEnSesion.delete(key);
    return { ok: false, skip: true };
  }

  if (posicion === null) {
    _ejecutadoEnSesion.delete(key);
    return { ok: false, skip: true };
  }

  // Tabla de cartas por posición
  // 1-3: sin carta diaria (ya tienen la del podio)
  // 4-6: ×2 | 7-12: ×3 | 13-22: ×4 | 23+: 2×4
  let multiplicador = null, cantidad = 1;
  if      (posicion <= 3)  {
    await _marcarEntregada(key, uid, hoy, null, 0);
    localStorage.setItem(lsKey, "1");
    return { ok: false, skip: true };
  }
  else if (posicion <= 6)  { multiplicador = 2; cantidad = 1; }
  else if (posicion <= 12) { multiplicador = 3; cantidad = 1; }
  else if (posicion <= 22) { multiplicador = 4; cantidad = 1; }
  else                     { multiplicador = 4; cantidad = 2; }

  // Escritura optimista en Firestore ANTES de dar las cartas
  try {
    await _marcarEntregada(key, uid, hoy, multiplicador, cantidad);
    localStorage.setItem(lsKey, "1");
  } catch (e) {
    console.error("cartaDiaria: error marcando", e);
    _ejecutadoEnSesion.delete(key);
    return { ok: false, error: e.message };
  }

  // Asignar carta(s)
  const cartasEntregadas = [];
  for (let i = 0; i < cantidad; i++) {
    const carta = cartaAleatoriaPorMultiplicador(multiplicador);
    if (!carta) continue;
    try {
      await setDoc(doc(db, "cartasDelUsuario",
        `${uid}_${carta.id}_${hoy}_diaria_${i}`), {
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
      await updateDoc(doc(db, "usuarios", uid), {
        [`cartas.${carta.id}`]: increment(1),
      });
      cartasEntregadas.push(carta);
    } catch (e) {
      console.error("cartaDiaria: error asignando carta", e);
    }
  }

  return {
    ok: cartasEntregadas.length > 0,
    cartas: cartasEntregadas,
    posicion, multiplicador, cantidad,
  };
}

async function _marcarEntregada(diaId, uid, fecha, multiplicador, cantidad) {
  await setDoc(doc(db, "cartaDiaria", diaId), {
    uid, fecha, entregada: true,
    multiplicador, cantidad,
    entregadaEn: new Date().toISOString(),
  });
}
