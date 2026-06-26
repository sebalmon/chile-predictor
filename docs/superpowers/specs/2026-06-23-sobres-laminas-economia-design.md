# Sobres de láminas + economía de cartas — Diseño (Fase 1)

Fecha: 2026-06-23
Branch: `reparaciones-urgencias`
Estado: aprobado para implementar

## Problema

Hoy las cartas multiplicadoras (las que se adjuntan a una predicción para multiplicar
puntos) salen **solo** de dos vías activas:

- **Cartas de podio** (`calcularGanadorDelDia` en `helpers.js`): liquidación diaria que
  dispara el admin; el top-3 del **día** recibe carta ×4 / ×3 / ×2 + bonus.
- **Canje** de láminas repetidas (`SeccionLaminas` → `CanjeLaminas`).

`cartaDiaria.js` (entrega por posición de `puntosTotal`) **está definida pero nunca se
invoca** — es código muerto. Resultado real: los puntos altos (podio) acumulan cartas y
la brecha con el resto crece.

## Objetivo

Democratizar la entrega: **todos** los jugadores reciben un **sobre diario** con láminas
coleccionables, y las cartas multiplicadoras pasan a repartirse **por puesto** dando
**más** a los puestos **más bajos**. Se mantiene el reconocimiento del podio diario.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Ranking que define el sobre | **TOTAL** (`puntosTotal`) |
| Cartas vs láminas | **Separadas**: cartas = set local de 18 (`sampleData.CARTAS`); láminas = API (`cards.json`, 61) |
| Monedas / tienda | **Fase 2** (spec aparte) |
| Canje de repetidas | **Duplicados mezclados**: 4→×2, 8→×3, 12→×4 |
| Cartas de podio (`calcularGanadorDelDia`) | **Se mantienen** sin cambios |
| `cartaDiaria.js` | **Se elimina** (muerto; el sobre lo reemplaza) |
| Dónde vive la lógica | **Cliente** (extiende `SeccionLaminas`), consistente con el modelo client-trust actual |

## Composición del sobre por puesto

`posicion` = índice (1-based) en `usuarios` ordenado por `puntosTotal` desc.

| Puesto | Láminas | Cartas |
|---|---|---|
| 1–3 | 4 | — |
| 4–7 | 3 | 1 × ×2 |
| 8–14 | 3 | 1 × ×3 |
| 15–22 | 3 | 1 × ×4 |
| 23–último | 2 | 2 × ×4 |
| sin ranking (default) | 4 | — |

- Láminas: sorteo **con reemplazo** (pueden salir repetidas, como un álbum de figuritas).
- Cartas: `cartaAleatoriaPorMultiplicador(mult)` del set local, una por cada `{mult,n}`.
- Con <23 jugadores los tiers altos simplemente no se alcanzan (no es error).

## Recompensas por completar (colección)

Incentivo a coleccionar:

- **Categoría completa** (tener ≥1 de **cada** lámina de esa categoría) → **1 carta ×2** al azar (set local).
- **Álbum completo** (las 61 / todo el catálogo) → **2 cartas ×4** al azar.

Reglas:
- Entrega por **botón RECLAMAR** en la Colección (no automático).
- **Una sola vez** por categoría y por álbum. Se marca en `usuarios.recompensas` (`cat_${KEY}` / `album`).
- Si el catálogo crece y una categoría reclamada queda incompleta, no se re-otorga (sigue marcada).
- Cartas con `origen:"recompensa"` en `cartasDelUsuario`.

## Arquitectura

### 1. `src/utils/sobre.js` (nuevo — lógica pura, testeable)

> **Restricción de testabilidad:** `sobre.js` NO importa firebase. Solo importa
> `sampleData` (puro). Así `node --test` corre sin config de firebase. La lectura de
> ranking (que sí usa `db`) vive aparte (ver §2).

```
composicionPorPuesto(pos) -> { laminas: number, cartas: [{mult, n}] }
  // pos null/0 => tier 1-3 (4 láminas, sin carta)

generarSobre(todasLaminas, comp) -> { laminas: [lamina...], cartas: [carta...] }
  // láminas: comp.laminas sorteos CON reemplazo sobre todasLaminas
  // cartas: por cada {mult,n} en comp.cartas, n llamadas a cartaAleatoriaPorMultiplicador(mult)

gastarDuplicados(laminasUsuario, n) -> { ok: boolean, decrementos: {file: -k} }
  // sobrante total = Σ max(0, copias-1); nunca baja una lámina de 1.
  // elige n copias sobrantes (greedy: de las que más copias tienen) y devuelve los decrementos.
  // ok=false si sobrante total < n.

cartaImg(slug) -> `/cartas/${slug}.jpg`   // centraliza la ruta (los archivos son .jpg)

// Recompensas por completar
categoriaCompleta(laminasUsuario, todasLaminas, catKey) -> boolean
albumCompleto(laminasUsuario, todasLaminas) -> boolean
recompensasPendientes(laminasUsuario, todasLaminas, reclamadas) -> [{tipo:"categoria"|"album", key, cartas:[{mult,n}]}]
  // tipo categoria => cartas:[{mult:2,n:1}]; tipo album => cartas:[{mult:4,n:2}]
  // excluye las que ya están en `reclamadas` (mapa {cat_KEY:true, album:true})
```

### 2. Posición — en `SeccionLaminas` (NO en `sobre.js`)

```
obtenerPosicionTotal(uid) -> { posicion: number|null, total: number }
  // query usuarios orderBy puntosTotal desc; findIndex(uid); posicion = idx+1 (o null)
```
Usa `db` (firebase) → vive en `SeccionLaminas.jsx` (o un `sobre.firestore.js` aparte),
nunca en `sobre.js`. Mismo patrón/costo de lectura que ya usan podio y `cartaDiaria` hoy.

### 3. `SeccionLaminas` (modificar tab SOBRE)

Reemplaza el efecto actual ("4 láminas random distintas") por:

1. Al montar (1 vez por `uid`): leer doc `sobresDelDia/{uid}_{hoy}`.
   - **Si existe** → restaurar `laminas`/`cartas` desde ahí (NO regenerar). Si
     `guardado:true`, mostrar en modo solo-lectura.
   - **Si no existe** → `obtenerPosicionTotal` → `composicionPorPuesto` →
     `generarSobre` → **escribir** `sobresDelDia/{uid}_{hoy}` = `{ laminas, cartas,
     guardado:false, fecha }` antes del reveal. Esto **fija el contenido** (anti re-roll).
2. Reveal con flip: muestra **láminas y cartas**. La carta se distingue (borde por
   `rareza`, etiqueta `×mult`, imagen `cartaImg(carta.slug)`).
3. **Guardar** (un solo `updateDoc` sobre `usuarios/{uid}` para todos los increments):
   - `laminas.{file} += 1` por cada lámina.
   - `cartas.{id} += 1` por cada carta.
   - `ultimoSobre = hoy`.
   - Por cada carta: `setDoc("cartasDelUsuario", "${uid}_${id}_${hoy}_sobre_${i}", {... origen:"sobre", visto:false})` (ID determinista → idempotente).
   - `updateDoc("sobresDelDia/{uid}_{hoy}", { guardado:true })`.
   - `localStorage` se mantiene como cache opcional, pero **Firestore es la fuente de verdad**.

Guard diario: la existencia de `sobresDelDia/{uid}_{hoy}` + `guardado` reemplaza al guard
basado solo en localStorage.

### 3b. `Coleccion` (modificar — botón RECLAMAR)

- Calcular `recompensasPendientes(laminasUsuario, todasLaminas, userProfile.recompensas||{})`.
- Por cada pendiente, mostrar un botón **RECLAMAR** (categoría: junto a su filtro/encabezado; álbum: arriba de la grilla).
- Al reclamar: `cartaAleatoriaPorMultiplicador(mult)` por cada carta de la recompensa →
  `cartas.{id} += 1` + doc `cartasDelUsuario` (`origen:"recompensa"`, ID determinista
  `${uid}_${id}_recompensa_${key}_${i}`) + `recompensas.{key} = true`, todo bajo `usuarios/{uid}`.
- `refreshProfile()` al terminar.

### 4. `CanjeLaminas` (modificar)

- Reglas nuevas: **4→×2, 8→×3, 12→×4**.
- "Duplicados mezclados": mostrar sobrante total `Σ max(0, copias-1)`; habilitar cada
  botón si `sobrante >= req`. Al canjear:
  - `gastarDuplicados(laminasUsuario, req)` → `updateDoc(usuarios)` con todos los
    decrementos en una sola llamada.
  - Entregar 1 carta del mult elegido: `cartas.{id} += 1` + doc en `cartasDelUsuario`
    (`origen:"canje"`, ID con `Date.now()` como hoy).
- Quitar la dependencia de "misma lámina"; el selector pasa a mostrar el total de
  duplicados disponibles, no una lámina concreta.

### 5. Limpieza / no tocar

- **Eliminar** `src/utils/cartaDiaria.js` (muerto). Quitar imports si los hubiera
  (no hay callers).
- **No tocar** `calcularGanadorDelDia` / `_asignarCarta` (cartas de podio).
- **Renombrar** 2 archivos para que matcheen su slug:
  - `public/cartas/orellana-historico1.jpg` → `historico-orellana.jpg`
  - `public/cartas/Lesión a Francescoli.jpg` → `lesion-a-francescoli.jpg`
- Reveal del sobre usa `cartaImg()` (`.jpg`). Los call-sites que aún piden `.png`
  (`NotificacionCartas`, `ModalPerfilResumido`) están rotos desde antes; corregirlos a
  `cartaImg()` es trivial y se incluye como fix oportunista (mismo helper).

### 6. Notificaciones

Cartas del sobre llevan `origen:"sobre"` y **no** se notifican aparte (el usuario ya las
ve al abrir el sobre). Sin cambios en el flujo de podio (`bonus_ganador`).

## Modelo de datos (Firestore)

- `usuarios/{uid}`: campos existentes `laminas{file:n}`, `cartas{id:n}`, `puntosTotal`,
  `ultimoSobre`. **Nuevo:** `recompensas{ cat_KEY:true, album:true }` (recompensas de
  colección ya reclamadas).
- `cartasDelUsuario/{detId}`: como hoy; nuevos docs con `origen:"sobre"`.
- **`sobresDelDia/{uid}_{fecha}`** (nuevo): `{ laminas:[...], cartas:[...], guardado:bool, fecha }`.

### Reglas (firestore.rules) — único cambio

```
match /sobresDelDia/{docId} {
  allow read, write: if request.auth != null;
}
```
(Consistente con `cartasDelUsuario` / `puntosDelDia`.)

## Edge cases

- <23 jugadores: tiers altos no se alcanzan; correcto.
- Usuario sin ranking: tier 1-3 (sin carta) — evita exploit de cuentas nuevas.
- Catálogo crece (se agregan láminas a la API): el sobre y la colección lo toman solo.
- Pool de cartas por mult = 6 c/u; random.
- Canje con sobrante insuficiente: botón deshabilitado.
- `gastarDuplicados` nunca baja una lámina de 1 (conserva la coleccionada).

## Integridad (techo conocido)

Modelo **client-trust**: el cliente calcula puesto, genera y escribe el sobre. Las reglas
ya permiten a cualquier auth escribir su doc (igual que podio/canje hoy). El doc
`sobresDelDia` fijo cierra el re-roll fácil, pero un cliente modificado sigue pudiendo
falsear contenido.

`// ponytail: integridad client-side; si aparece abuso, mover generación del sobre a una
Cloud Function (composición + escritura server-side) — no antes.`

## Testing (ponytail)

`src/utils/sobre.test.mjs`, ejecutable con `node --test` (sin runner ni deps nuevas):

- `composicionPorPuesto`: límites exactos (1,3,4,7,8,14,15,22,23, null).
- `generarSobre`: cuenta de láminas y cartas por tier; láminas pueden repetirse.
- `gastarDuplicados`: suma de sobrantes, nunca baja de 1, `ok=false` si falta, decrementos
  suman -n.
- `categoriaCompleta` / `albumCompleto`: true solo con todas las láminas (≥1) de la categoría/catálogo.
- `recompensasPendientes`: lista las completas no reclamadas con sus cartas; excluye las reclamadas.

## Fuera de scope (Fase 2)

Monedas para comprar sobres + tienda. Spec y plan aparte.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/utils/sobre.js` | nuevo (lógica pura + posición + `cartaImg`) |
| `src/utils/sobre.test.mjs` | nuevo (self-check) |
| `src/components/SeccionLaminas.jsx` | sobre por puesto + persistencia `sobresDelDia` + reveal de cartas; botón RECLAMAR en colección; canje 4/8/12 mezclado |
| `src/utils/cartaDiaria.js` | eliminar |
| `firestore.rules` | regla `sobresDelDia` |
| `public/cartas/*` | renombrar 2 archivos |
| `NotificacionCartas.jsx`, `ModalPerfilResumido.jsx` | fix oportunista `.png`→`cartaImg()` |
