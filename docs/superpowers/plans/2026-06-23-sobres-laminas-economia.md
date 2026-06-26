# Economía de sobres/láminas (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repartir un sobre diario a todos los jugadores con composición por puesto (láminas + cartas multiplicadoras), canje de duplicados mezclados, y contenido anti re-roll.

**Architecture:** Lógica pura en `src/utils/sobre.js` (sin firebase, testeable con `node --test`). `SeccionLaminas.jsx` consume esa lógica, calcula el puesto por `puntosTotal`, fija el contenido del sobre en `sobresDelDia/{uid}_{fecha}` y al guardar incrementa `laminas`/`cartas` en el doc del usuario. Modelo client-trust (igual que el resto del proyecto).

**Tech Stack:** React 18 + Vite, Firebase Firestore (modular SDK v10), `node --test` (Node 18, sin deps nuevas).

## Global Constraints

- `sobre.js` NO importa firebase; solo importa `../data/sampleData` (puro). Verbatim del spec.
- Cartas y láminas son universos separados: cartas = `sampleData.CARTAS` (18, mult 2/3/4); láminas = `cards.json` de la API (61).
- Composición por puesto (1-based sobre `puntosTotal` desc): 1-3 → 4 láminas, sin carta; 4-7 → 3 láminas + 1×(×2); 8-14 → 3 láminas + 1×(×3); 15-22 → 3 láminas + 1×(×4); 23+ → 2 láminas + 2×(×4); sin ranking → tier 1-3.
- Canje mezclado: 4→×2, 8→×3, 12→×4 (sobrante de una lámina = copias-1; nunca bajar de 1).
- Láminas del sobre: sorteo CON reemplazo (pueden repetirse).
- NO tocar `calcularGanadorDelDia` / `_asignarCarta` (cartas de podio).
- Imágenes de carta: `/cartas/${slug}.jpg` vía `cartaImg()`.
- Commits frecuentes, mensajes en español, sin co-author.

---

### Task 1: Lógica pura del sobre (`sobre.js`) — TDD

**Files:**
- Create: `src/utils/sobre.js`
- Test: `src/utils/sobre.test.mjs`

**Interfaces:**
- Consumes: `cartaAleatoriaPorMultiplicador(mult)` de `src/data/sampleData.js` → carta `{id,slug,nombre,multiplicador,rareza}` o `undefined`.
- Produces:
  - `composicionPorPuesto(pos: number|null) -> { laminas: number, cartas: {mult:number,n:number}[] }`
  - `generarSobre(todasLaminas: {file:string}[], comp, rnd=Math.random) -> { laminas: object[], cartas: object[] }`
  - `gastarDuplicados(laminasUsuario: Record<string,number>, n: number) -> { ok: boolean, decrementos: Record<string,number> }`
  - `cartaImg(slug: string) -> string`

- [ ] **Step 1: Write the failing test**

Create `src/utils/sobre.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { composicionPorPuesto, generarSobre, gastarDuplicados, cartaImg } from "./sobre.js";

test("composicionPorPuesto: límites de cada tier", () => {
  assert.deepEqual(composicionPorPuesto(1),   { laminas:4, cartas:[] });
  assert.deepEqual(composicionPorPuesto(3),   { laminas:4, cartas:[] });
  assert.deepEqual(composicionPorPuesto(null),{ laminas:4, cartas:[] });
  assert.deepEqual(composicionPorPuesto(4),   { laminas:3, cartas:[{mult:2,n:1}] });
  assert.deepEqual(composicionPorPuesto(7),   { laminas:3, cartas:[{mult:2,n:1}] });
  assert.deepEqual(composicionPorPuesto(8),   { laminas:3, cartas:[{mult:3,n:1}] });
  assert.deepEqual(composicionPorPuesto(14),  { laminas:3, cartas:[{mult:3,n:1}] });
  assert.deepEqual(composicionPorPuesto(15),  { laminas:3, cartas:[{mult:4,n:1}] });
  assert.deepEqual(composicionPorPuesto(22),  { laminas:3, cartas:[{mult:4,n:1}] });
  assert.deepEqual(composicionPorPuesto(23),  { laminas:2, cartas:[{mult:4,n:2}] });
  assert.deepEqual(composicionPorPuesto(999), { laminas:2, cartas:[{mult:4,n:2}] });
});

test("generarSobre: cuenta láminas y permite repetidas", () => {
  const cat = [{file:"A"},{file:"B"}];
  const s = generarSobre(cat, { laminas:4, cartas:[] }, () => 0); // rnd=0 -> siempre A
  assert.equal(s.laminas.length, 4);
  assert.ok(s.laminas.every(l => l.file === "A")); // repetición permitida
  assert.equal(s.cartas.length, 0);
});

test("generarSobre: tier 23+ da 2 láminas y 2 cartas ×4", () => {
  const s = generarSobre([{file:"A"}], composicionPorPuesto(23));
  assert.equal(s.laminas.length, 2);
  assert.equal(s.cartas.length, 2);
  assert.ok(s.cartas.every(c => c.multiplicador === 4));
});

test("gastarDuplicados: respeta sobrante y nunca baja de 1", () => {
  const lu = { A:3, B:2, C:1 }; // sobrantes A2 B1 C0 = 3
  assert.equal(gastarDuplicados(lu, 4).ok, false);     // no alcanza
  const r = gastarDuplicados(lu, 3);
  assert.equal(r.ok, true);
  const suma = Object.values(r.decrementos).reduce((s,v)=>s+v,0);
  assert.equal(suma, -3);                               // gasta exactamente 3
  assert.ok((r.decrementos.A ?? 0) >= -2);              // A no baja de 1
  assert.ok(!("C" in r.decrementos));                  // C no tiene sobrante
});

test("cartaImg: ruta .jpg", () => {
  assert.equal(cartaImg("el-maracanazo"), "/cartas/el-maracanazo.jpg");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/utils/sobre.test.mjs`
Expected: FAIL — `Cannot find module './sobre.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/sobre.js`:

```js
// src/utils/sobre.js — lógica pura del sobre (SIN firebase; solo sampleData puro)
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/utils/sobre.test.mjs`
Expected: PASS — 5 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/utils/sobre.js src/utils/sobre.test.mjs
git commit -m "feat(sobre): lógica pura de composición/sorteo/canje + tests"
```

---

### Task 2: Infra — regla Firestore + renombre de imágenes de carta

**Files:**
- Modify: `firestore.rules` (agregar bloque `sobresDelDia`)
- Rename: `public/cartas/orellana-historico1.jpg` → `public/cartas/historico-orellana.jpg`
- Rename: `public/cartas/Lesión a Francescoli.jpg` → `public/cartas/lesion-a-francescoli.jpg`

**Interfaces:**
- Produces: colección `sobresDelDia` con escritura para usuarios autenticados; archivos de carta cuyos nombres matchean los `slug` de `sampleData.CARTAS`.

- [ ] **Step 1: Agregar regla** en `firestore.rules`, después del bloque `cartasDelUsuario` (línea ~41):

```
    // ── sobresDelDia ──────────────────────────────────────
    match /sobresDelDia/{docId} {
      allow read, write: if request.auth != null;
    }
```

- [ ] **Step 2: Renombrar los 2 archivos**

```bash
git mv "public/cartas/orellana-historico1.jpg" "public/cartas/historico-orellana.jpg"
git mv "public/cartas/Lesión a Francescoli.jpg" "public/cartas/lesion-a-francescoli.jpg"
```

- [ ] **Step 3: Verificar que todo slug de CARTAS tiene archivo**

Run:
```bash
for s in $(grep -oE 'slug: *"[^"]+"' src/data/sampleData.js | sed -E 's/slug: *"//;s/"//'); do
  case "$s" in cx*) ;; esac
  [ -f "public/cartas/$s.jpg" ] || echo "FALTA: $s"
done; echo "check done"
```
Expected: solo `check done` para los slugs de cartas cx2/cx3/cx4 (los slugs de avatares se ignoran; si aparecen "FALTA" de slugs de avatar, es esperado — solo importan los 18 de CARTAS). Confirmar que NINGÚN slug de carta multiplicadora (los 18 en el array `CARTAS`) falta.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules public/cartas
git commit -m "chore(cartas): regla sobresDelDia + renombrar imágenes a su slug"
```

---

### Task 3: `SeccionLaminas` — sobre por puesto + persistencia + reveal de cartas

**Files:**
- Modify: `src/components/SeccionLaminas.jsx`

**Interfaces:**
- Consumes: `composicionPorPuesto`, `generarSobre`, `cartaImg` (Task 1); colección `sobresDelDia` (Task 2); `useAuth().firebaseUser/userProfile/refreshProfile`.
- Produces: sobre diario con contenido fijo en `sobresDelDia/{uid}_{fecha}`; al guardar, increments en `usuarios/{uid}.laminas` y `.cartas`, docs `cartasDelUsuario` con `origen:"sobre"`, y `ultimoSobre`.

> Esta tarea reescribe el flujo del tab SOBRE. La verificación es manual (`npm run dev`), porque depende de firebase + auth. La lógica sorteable ya está cubierta por Task 1.

- [ ] **Step 1: Actualizar imports** (cabecera del archivo)

Cambiar el import de firestore (línea 15-17) para incluir lo necesario y agregar el import de `sobre.js`:

```js
import {
  doc, getDoc, updateDoc, setDoc, increment as fbIncrement,
  collection, getDocs, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { composicionPorPuesto, generarSobre, cartaImg } from "../utils/sobre";
```

Eliminar el import `cartaAleatoriaPorMultiplicador` de `../data/sampleData` (ya no se usa en este archivo tras Task 4; si Task 4 aún no corrió, dejarlo hasta entonces).

- [ ] **Step 2: Agregar helper de ranking** (antes del componente principal, junto a `hoyStr`)

```js
async function obtenerPosicionTotal(uid) {
  try {
    const snap = await getDocs(query(
      collection(db, "usuarios"), orderBy("puntosTotal", "desc")
    ));
    const idx = snap.docs.findIndex(d => d.id === uid);
    return { posicion: idx >= 0 ? idx + 1 : null, total: snap.size };
  } catch (e) {
    console.error("posicionTotal:", e);
    return { posicion: null, total: 0 };
  }
}
```

- [ ] **Step 3: Reescribir el estado y la carga del sobre** en el componente `SeccionLaminas`

Reemplazar los efectos #2 y #3 (verificación + preparación, líneas ~527-589) por un único efecto que lee/crea `sobresDelDia`. El estado pasa a guardar `sobre = { laminas, cartas }`:

```js
// Estado del sobre (reemplaza laminasNuevas)
const [sobre, setSobre]                 = useState(null); // { laminas:[], cartas:[] }
const [sobreDisponible, setSobreDisponible] = useState(false);
const [sobreAbierto, setSobreAbierto]   = useState(false);
const [sobreGuardado, setSobreGuardado] = useState(false);
const [volteadas, setVolteadas]         = useState(0);
const [guardando, setGuardando]         = useState(false);
const [msgGuardado, setMsgGuardado]     = useState(null);
const iniciadoRef = useRef(false);

const sobreDocId = uid ? `${uid}_${hoy}` : null;

// Cargar/crear el sobre del día (fuente de verdad: Firestore sobresDelDia)
useEffect(() => {
  if (!uid || iniciadoRef.current || todasLaminas.length === 0) return;
  iniciadoRef.current = true;

  (async () => {
    // 1) ¿Ya existe el sobre de hoy? -> restaurar (anti re-roll)
    const ref = doc(db, "sobresDelDia", sobreDocId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      setSobre({ laminas: d.laminas || [], cartas: d.cartas || [] });
      setSobreGuardado(!!d.guardado);
      setSobreAbierto(true);
      setSobreDisponible(false);
      if (d.guardado) setVolteadas((d.laminas?.length || 0) + (d.cartas?.length || 0));
      return;
    }
    // 2) No existe -> generar por puesto y FIJAR en Firestore antes del reveal
    const { posicion } = await obtenerPosicionTotal(uid);
    const comp = composicionPorPuesto(posicion);
    const generado = generarSobre(todasLaminas, comp);
    await setDoc(ref, {
      uid, fecha: hoy, guardado: false,
      laminas: generado.laminas, cartas: generado.cartas,
    });
    setSobre(generado);
    setSobreDisponible(true);
  })();
}, [uid, hoy, sobreDocId, todasLaminas]);
```

Eliminar las claves `lsKeyOver`/`lsKeyLams` y toda la lógica basada en localStorage para el sobre (ya no es la fuente de verdad).

- [ ] **Step 4: Actualizar `guardarLaminas`** (líneas ~592-611) para incluir cartas y marcar el doc:

```js
const guardarLaminas = async () => {
  if (!uid || !sobre || guardando || sobreGuardado) return;
  setGuardando(true);
  setMsgGuardado(null);
  try {
    const updates = { ultimoSobre: hoy };
    for (const lam of sobre.laminas) updates[`laminas.${lam.file}`] = fbIncrement(1);
    for (const c of sobre.cartas)    updates[`cartas.${c.id}`]      = fbIncrement(1);
    await updateDoc(doc(db, "usuarios", uid), updates);

    // docs detalle de cartas (ID determinista -> idempotente), origen "sobre"
    for (let i = 0; i < sobre.cartas.length; i++) {
      const c = sobre.cartas[i];
      await setDoc(doc(db, "cartasDelUsuario", `${uid}_${c.id}_${hoy}_sobre_${i}`), {
        uid, cartaId: c.id, cartaNombre: c.nombre, cartaSlug: c.slug,
        multiplicador: c.multiplicador, rareza: c.rareza,
        fecha: hoy, visto: false, origen: "sobre",
      });
    }
    await updateDoc(doc(db, "sobresDelDia", sobreDocId), { guardado: true });

    setSobreGuardado(true);
    setMsgGuardado("✅ ¡Guardado en tu colección!");
    if (refreshProfile) await refreshProfile();
  } catch (e) {
    setMsgGuardado(`❌ Error: ${e.message}`);
  } finally {
    setGuardando(false);
  }
};
```

- [ ] **Step 5: Renderizar cartas en el reveal**

En el bloque del reveal (tab SOBRE, donde hoy mapea `laminasNuevas` con `LaminaFlip`), mapear `sobre.laminas` para las láminas y agregar debajo las cartas con `cartaImg`. Reemplazar el contador de volteadas por el total (láminas + cartas). Render de cartas:

```jsx
{sobre.cartas.length > 0 && (
  <>
    <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
      color:"var(--amarillo)", textAlign:"center", margin:"10px 0" }}>
      ¡CARTAS MULTIPLICADORAS!
    </p>
    <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"10px" }}>
      {sobre.cartas.map((c, i) => (
        <div key={c.id+"_"+i} style={{ width:"80px", textAlign:"center" }}>
          <div style={{ width:"80px", height:"110px", border:"3px solid var(--amarillo)",
            boxShadow:"3px 3px 0 var(--negro)", overflow:"hidden" }}>
            <img src={cartaImg(c.slug)} alt={c.nombre}
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={e => { e.target.style.opacity = 0.2; }} />
          </div>
          <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color:"var(--verde-claro)", marginTop:"3px" }}>×{c.multiplicador}</p>
        </div>
      ))}
    </div>
  </>
)}
```

El botón GUARDAR aparece cuando `volteadas >= sobre.laminas.length` (las cartas se muestran directas, no requieren flip).

- [ ] **Step 6: Verificación manual**

Run: `npm install && npm run dev`
Con un usuario logueado, abrir la sección Láminas → tab SOBRE:
- Aparece el sobre; al abrir, se ven N láminas (según puesto) y, si corresponde, las cartas ×N.
- GUARDAR escribe en Firestore; recargar la página muestra el sobre en modo solo-lectura (no se regenera → anti re-roll).
- En Firestore: `sobresDelDia/{uid}_{fecha}` con `guardado:true`; `usuarios/{uid}.laminas` y `.cartas` incrementados.
Expected: comportamiento descrito; sin errores en consola.

- [ ] **Step 7: Commit**

```bash
git add src/components/SeccionLaminas.jsx
git commit -m "feat(sobre): composición por puesto + persistencia anti re-roll + reveal de cartas"
```

---

### Task 4: `SeccionLaminas` — canje de duplicados mezclados (4/8/12)

**Files:**
- Modify: `src/components/SeccionLaminas.jsx` (componente `CanjeLaminas`)

**Interfaces:**
- Consumes: `gastarDuplicados`, `cartaImg` (Task 1); `cartaAleatoriaPorMultiplicador` de `sampleData`.
- Produces: canje que gasta duplicados mezclados y entrega 1 carta del mult elegido.

- [ ] **Step 1: Imports del componente**

Asegurar en la cabecera del archivo:
```js
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";
import { gastarDuplicados, cartaImg } from "../utils/sobre";
```

- [ ] **Step 2: Reescribir `CanjeLaminas`** (líneas ~351-478). Nueva lógica basada en sobrante total, sin selección de lámina concreta:

```jsx
function CanjeLaminas({ laminasUsuario, uid, onCanje }) {
  const [canjeando, setCanjeando] = useState(false);
  const [msg, setMsg] = useState(null);

  const REGLAS = [
    { cantidad: 4,  mult: 2, label: "4 repetidas → carta ×2" },
    { cantidad: 8,  mult: 3, label: "8 repetidas → carta ×3" },
    { cantidad: 12, mult: 4, label: "12 repetidas → carta ×4" },
  ];

  const sobranteTotal = Object.values(laminasUsuario || {})
    .reduce((s, c) => s + Math.max(0, (c || 0) - 1), 0);

  const canjear = async (regla) => {
    const { ok, decrementos } = gastarDuplicados(laminasUsuario, regla.cantidad);
    if (!ok) { setMsg({ tipo:"error", texto:`Te faltan repetidas (tenés ${sobranteTotal}).` }); return; }
    setCanjeando(true);
    try {
      const updates = {};
      for (const [file, d] of Object.entries(decrementos)) updates[`laminas.${file}`] = fbIncrement(d);
      await updateDoc(doc(db, "usuarios", uid), updates);

      const carta = cartaAleatoriaPorMultiplicador(regla.mult);
      if (carta) {
        await setDoc(doc(db, "cartasDelUsuario", `${uid}_${carta.id}_canje_${Date.now()}`), {
          uid, cartaId:carta.id, cartaNombre:carta.nombre, cartaSlug:carta.slug,
          multiplicador:carta.multiplicador, rareza:carta.rareza,
          fecha:hoyStr(), visto:false, origen:"canje",
        });
        await updateDoc(doc(db, "usuarios", uid), { [`cartas.${carta.id}`]: fbIncrement(1) });
      }
      setMsg({ tipo:"ok", texto:`✅ ${regla.cantidad} repetidas → carta ×${regla.mult}!` });
      onCanje();
    } catch (e) {
      setMsg({ tipo:"error", texto:e.message });
    } finally {
      setCanjeando(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"10px" }}>
        CANJE DE LÁMINAS REPETIDAS
      </p>
      {msg && (
        <p style={{ fontSize:"6px", lineHeight:2, marginBottom:"10px",
          color: msg.tipo==="ok" ? "var(--verde-claro)" : "var(--rojo-chile)" }}>
          {msg.texto}
        </p>
      )}
      <p style={{ fontSize:"6px", color:"var(--gris-claro)", marginBottom:"12px", lineHeight:2 }}>
        Repetidas disponibles: <span style={{ color:"var(--amarillo)" }}>{sobranteTotal}</span>
        <br/>(cada copia extra de cualquier lámina cuenta)
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
        {REGLAS.map(r => (
          <button key={r.mult} className="btn-pixel btn-verde w-full" style={{ fontSize:"6px" }}
            onClick={() => canjear(r)} disabled={canjeando || sobranteTotal < r.cantidad}>
            {canjeando ? "⚙ ..." : r.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop:"14px", padding:"10px",
        border:"1px solid var(--verde-campo)", background:"rgba(0,0,0,0.2)" }}>
        <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:2 }}>
          4 → ×2 &nbsp;|&nbsp; 8 → ×3 &nbsp;|&nbsp; 12 → ×4
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Actualizar el call-site** del tab CANJE (eliminar prop `todasLaminas`):

```jsx
<CanjeLaminas laminasUsuario={laminasUsuario} uid={uid} onCanje={refreshProfile} />
```

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`
Con un usuario que tenga láminas repetidas: el tab CANJEAR muestra el total de repetidas; los botones se habilitan según el umbral; canjear descuenta duplicados (sin bajar ninguna lámina de 1) y agrega una carta.
Expected: descuento correcto y carta entregada; consola sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/SeccionLaminas.jsx
git commit -m "feat(canje): duplicados mezclados 4/8/12 → cartas"
```

---

### Task 5: Limpieza — eliminar `cartaDiaria.js` y arreglar rutas `.png`

**Files:**
- Delete: `src/utils/cartaDiaria.js`
- Modify: `src/components/NotificacionCartas.jsx:164`
- Modify: `src/components/ModalPerfilResumido.jsx:138`

**Interfaces:**
- Consumes: `cartaImg` (Task 1).
- Produces: imágenes de carta que cargan (`.jpg`) en notificaciones y perfil resumido; código muerto eliminado.

- [ ] **Step 1: Confirmar que `cartaDiaria.js` no se importa en ningún lado**

Run: `grep -rn "cartaDiaria" src --include=*.jsx --include=*.js | grep -v "src/utils/cartaDiaria.js"`
Expected: solo comentarios en `NotificacionCartas.jsx` (no imports/llamadas reales). Si aparece un import o llamada a `entregarCartaDiaria`, DETENER y reportar.

- [ ] **Step 2: Eliminar el archivo**

```bash
git rm src/utils/cartaDiaria.js
```

- [ ] **Step 3: Arreglar la ruta de imagen en `NotificacionCartas.jsx`**

Agregar `import { cartaImg } from "../utils/sobre";` en la cabecera y cambiar línea ~164:

```jsx
// antes:  src={`/cartas/${c.cartaSlug}.png`}
src={cartaImg(c.cartaSlug)}
```

- [ ] **Step 4: Arreglar la ruta en `ModalPerfilResumido.jsx`**

Agregar `import { cartaImg } from "../utils/sobre";` y cambiar línea ~138:

```jsx
// antes:  src={`/cartas/${carta.slug}.png`}
src={cartaImg(carta.slug)}
```

- [ ] **Step 5: Verificación**

Run: `node --test src/utils/sobre.test.mjs && npm run build`
Expected: tests PASS y build sin errores (sin referencias rotas a `cartaDiaria`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: eliminar cartaDiaria muerto y arreglar rutas de imagen de carta"
```

---

## Self-Review

**Spec coverage:**
- Sobre por puesto → Task 1 (`composicionPorPuesto`) + Task 3.
- Láminas con reemplazo → Task 1 (`generarSobre`).
- Canje 4/8/12 mezclado → Task 1 (`gastarDuplicados`) + Task 4.
- Anti re-roll (`sobresDelDia`) → Task 2 (regla) + Task 3 (fijar/restaurar).
- Cartas en sobre (increment + `cartasDelUsuario` origen "sobre" + idempotencia) → Task 3.
- Eliminar `cartaDiaria.js`, no tocar podio → Task 5.
- Imágenes de carta (`.jpg`, renombres, helper, fix `.png`) → Task 2 + Task 5.
- Test pura `node --test` → Task 1.
- Default sin ranking (tier 1-3) → Task 1 (`composicionPorPuesto(null)`) + Task 3 (posicion null).
- Monedas → fuera de scope (Fase 2). Correcto, sin tarea.

**Placeholder scan:** sin TBD/TODO; todos los steps tienen código o comando concreto.

**Type consistency:** `composicionPorPuesto/generarSobre/gastarDuplicados/cartaImg` usados con las mismas firmas en Tasks 3-5. `sobre={laminas,cartas}` consistente. `sobresDelDia/{uid}_{fecha}` con campos `{uid,fecha,guardado,laminas,cartas}` consistente entre Task 2 (regla) y Task 3 (lectura/escritura).
