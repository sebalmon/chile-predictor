# INSTRUCCIONES DE ACTUALIZACIÓN — Chile Predictor v3

## QUÉ ARCHIVOS REEMPLAZAR / CREAR

### ARCHIVOS A REEMPLAZAR (copia el contenido nuevo sobre el viejo):

| Archivo en tu proyecto | Archivo entregado |
|---|---|
| `src/App.jsx` | `src/App.jsx` | listo
| `src/components/Splash.jsx` | `src/components/Splash.jsx` | listo
| `src/components/Dashboard.jsx` | `src/components/Dashboard.jsx` | listo
| `src/components/Perfil.jsx` | `src/components/Perfil.jsx` | listo
| `src/components/AdminPanel.jsx` | `src/components/AdminPanel.jsx` | listo
| `src/components/OnboardingModal.jsx` | `src/components/OnboardingModal.jsx` | listo
| `src/data/sampleData.js` | `src/data/sampleData.js` | listo
| `src/utils/helpers.js` | `src/utils/helpers.js` | listo
| `firestore.rules` | `firestore.rules` | listo

### ARCHIVOS NUEVOS A CREAR (no existen en tu proyecto):

| Nuevo archivo | Descripción |
|---|---|
| `src/components/FraseCinema.jsx` | Pantalla cinematográfica de frase del día | listo
| `src/components/PodioF1.jsx` | Podio estilo F1 con avatares animados | listo
| `src/components/NotificacionCartas.jsx` | Modal de cartas ganadas en el podio | listo
| `src/components/AvisoAdmin.jsx` | Modal flotante de avisos del admin | listo
| `src/components/TabPartidos.jsx` | Nueva pestaña PARTIDOS con pregunta condicional | listo

---

## CARPETAS DE IMÁGENES QUE DEBES CREAR EN /public/

### /public/avatares/
Crea 3 imágenes por cada avatar (fotogramas de animación):
```
chancho-lorenzo-1.png   chancho-lorenzo-2.png   chancho-lorenzo-3.png
azkargorta-1.png        azkargorta-2.png        azkargorta-3.png
chinquihuin-1.png       chinquihuin-2.png       chinquihuin-3.png
julio-martinez-1.png    julio-martinez-2.png    julio-martinez-3.png
caszely-1.png           caszely-2.png           caszely-3.png
dr-orozco-1.png         dr-orozco-2.png         dr-orozco-3.png
peter-veneno-1.png      peter-veneno-2.png      peter-veneno-3.png
bielsa-1.png            bielsa-2.png            bielsa-3.png
carcuro-1.png           carcuro-2.png           carcuro-3.png
el-sapo-1.png           el-sapo-2.png           el-sapo-3.png
el-hombre-del-maletin-1.png  ...                el-hombre-del-maletin-3.png
ff17-1.png              ff17-2.png              ff17-3.png
```

### /public/cartas/
Una imagen por carta (el slug es el nombre del archivo):
```
vargas-elimina-espana.png     penal-gato-silva.png       maniobra-heimlich.png
el-perro-ron.png              el-maracanazo.png          el-dedo-de-jarita.png
historico-orellana.png        matador-en-wembley.png     mi-familia-esta-bien.png
ahi-quedo-brasil.png          el-palo-de-pinilla.png     pero-con-respeto.png
las-luces-rojas.png           vargas-ataja-chilavert.png que-sucede.png
el-dublinazo.png              lesion-a-francescoli.png   el-bautizazo.png
```

---

## ACTUALIZACIONES EN FIREBASE CONSOLE

### 1. Reglas de Firestore
Copia el contenido de `firestore.rules` en Firebase Console → Firestore → Reglas./ listo

### 2. Nueva colección: `cartasDelUsuario`
Se crea automáticamente cuando el admin cierra el día. Estructura del documento: 
```
uid: "abc123"
cartaId: "cx4-1"
cartaNombre: "Vargas elimina a España"
cartaSlug: "vargas-elimina-espana"
multiplicador: 4
rareza: "legendaria"
fecha: "2026-06-11"
visto: false          ← se vuelve true cuando el usuario cierra el modal
```

### 3. Nueva colección: `config` (documento: `avisoAdmin`)
Se crea automáticamente desde el panel admin. Estructura:
```
texto: "Mensaje del admin aquí"
fecha: "2026-06-11T10:00:00.000Z"
activo: true          ← se puede desactivar
```

### 4. Campo nuevo en `usuarios`
Agrega soporte para `cartasDesbloqueadas` (array de IDs de carta).
Ya era parte del código anterior, pero ahora los IDs cambiaron al formato
`cx4-1`, `cx3-1`, `cx2-1`, etc. Si tenías cartas previas con IDs antiguos,
actualiza manualmente en Firestore Console.

### 5. Campo nuevo en `puntosDelDia`
El campo `avatarId` (en vez de `avatarEmoji`) ahora se usa para el PodioF1.
Si tienes documentos existentes en `puntosDelDia`, asegúrate de que tengan
el campo `avatarId` (el ID del avatar, ej: "av1").

---

## CAMBIO IMPORTANTE EN SAMPLEDATA.JS

Los avatares ahora usan `slug` en vez de `emoji`. En `src/components/Registro.jsx`
necesitas actualizar la pantalla de selección de avatar para mostrar la imagen
en vez del emoji. Aquí el JSX actualizado para el selector de avatar en Registro:

```jsx
// En Registro.jsx, reemplaza la sección del avatar-grid por:
<div className="avatar-grid">
  {AVATARES.map((av) => (
    <button
      key={av.id}
      className={`avatar-opcion ${avatarId === av.id ? "seleccionado" : ""}`}
      onClick={() => setAvatarId(av.id)}
      type="button"
    >
      <img
        src={`/avatares/${av.slug}-1.png`}
        alt={av.nombre}
        style={{ width: "40px", height: "40px", imageRendering: "pixelated" }}
        onError={(e) => { e.target.style.display="none"; }}
      />
      <span className="avatar-opcion-nombre">{av.nombre}</span>
    </button>
  ))}
</div>
```

Y en el campo que se guarda en Firestore (función `handleRegistro`), actualiza:
```js
// Antes guardabas avatarEmoji; ahora guarda avatarId y slug:
avatarId:   avatarElegido.id,
avatarSlug: avatarElegido.slug,
avatarNombre: avatarElegido.nombre,
// Elimina avatarEmoji si lo tenías
```

---

## FLUJO COMPLETO DE LA APP (v3)

```
[Splash] → (skip con toque al aparecer START)
    ↓
[Login con Google]
    ↓
[Registro] (solo primera vez)
    ↓
[Onboarding] (solo primera vez, modal)
    ↓
[FraseCinema] (una vez al día, fade in/out)
    ↓
[Dashboard]
  ├─ INICIO: Podio F1 + Ranking top 4 + Sistema de puntuación
  ├─ PARTIDOS: PartidoCards del día + Pregunta (modal cuando completas todos)
  ├─ RANKING: Tabla completa
  ├─ PERFIL: Avatar + cartas (lightbox) + historial
  └─ ADMIN: (solo admin) Partidos / Preguntas / Cerrar día / Aviso
```

---

## RESUMEN DE CAMBIOS POR REQUERIMIENTO

| # | Requerimiento | Archivos |
|---|---|---|
| 1 | Frase cinematográfica | `FraseCinema.jsx` (nuevo), `App.jsx` |
| 2 | Podio F1 animado | `PodioF1.jsx` (nuevo), `Dashboard.jsx` |
| 3 | Splash saltable desde START | `Splash.jsx` |
| 4 | Reorganización INICIO + pestaña PARTIDOS | `Dashboard.jsx`, `TabPartidos.jsx` (nuevo) |
| 5 | DÍA N en topbar | `Dashboard.jsx`, `helpers.js` |
| 6 | Cartas: nueva lógica + asignación auto | `helpers.js`, `sampleData.js`, `NotificacionCartas.jsx` (nuevo) |
| 7 | Pregunta en PARTIDOS (condicional) | `TabPartidos.jsx` (nuevo) |
| 8 | Historial en Perfil | `Perfil.jsx` |
| 9 | Admin mejorado + Aviso | `AdminPanel.jsx`, `AvisoAdmin.jsx` (nuevo) |
| 10 | Tutorial actualizado | `OnboardingModal.jsx` |
| 11 | Ver perfil ajeno (click en podio/ranking) | `PodioF1.jsx` (modal incluido) |
