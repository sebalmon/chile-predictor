# ⚽ Chile Predictor 8-Bit — Guía Completa de Instalación

## ESTRUCTURA DE ARCHIVOS

```
chile-predictor/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Splash.jsx
│   │   ├── Login.jsx
│   │   ├── Registro.jsx
│   │   ├── Dashboard.jsx
│   │   ├── PartidoCard.jsx
│   │   ├── PreguntaCard.jsx
│   │   ├── Ranking.jsx
│   │   └── Perfil.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── data/
│   │   └── sampleData.js
│   ├── styles/
│   │   └── global.css
│   ├── utils/
│   │   └── helpers.js
│   ├── firebase.js
│   ├── App.jsx
│   └── main.jsx
├── firestore.rules
├── index.html
├── package.json
└── vite.config.js
```

---

## PASO 1 — CREAR PROYECTO FIREBASE

### 1.1 Ir a Firebase Console
1. Abre https://console.firebase.google.com/
2. Haz clic en **"Agregar proyecto"**
3. Nombre del proyecto: `chile-predictor` (o el que quieras)
4. **Desactiva** Google Analytics (no es necesario)
5. Haz clic en **"Crear proyecto"**

### 1.2 Activar Authentication con Google
1. En el menú izquierdo → **"Authentication"**
2. Haz clic en **"Comenzar"**
3. Pestaña **"Sign-in method"**
4. Haz clic en **"Google"**
5. Activa el interruptor (Enable)
6. Pon tu email como correo de soporte del proyecto
7. Haz clic en **"Guardar"**

### 1.3 Crear base de datos Firestore
1. En el menú izquierdo → **"Firestore Database"**
2. Haz clic en **"Crear base de datos"**
3. Selecciona **"Iniciar en modo de prueba"** (luego cambiarás las reglas)
4. Elige la ubicación: **`us-central1`** (o la más cercana)
5. Haz clic en **"Habilitar"**

### 1.4 Obtener credenciales de la app
1. En la página principal del proyecto → ícono `</>`  (Web)
2. Nombre de la app: `chile-predictor-web`
3. **NO** actives Firebase Hosting (usarás Vercel)
4. Haz clic en **"Registrar app"**
5. Copia el objeto `firebaseConfig` que aparece:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "chile-predictor.firebaseapp.com",
  projectId: "chile-predictor",
  storageBucket: "chile-predictor.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

6. Pega esos valores en `src/firebase.js` reemplazando los `TU_...`

### 1.5 Configurar reglas de Firestore
1. En Firestore → pestaña **"Reglas"**
2. Borra lo que hay y pega el contenido de `firestore.rules`
3. Haz clic en **"Publicar"**

### 1.6 Agregar dominio de Vercel a Auth (después del deploy)
1. Ve a Authentication → Settings → **"Dominios autorizados"**
2. Haz clic en **"Agregar dominio"**
3. Escribe tu dominio de Vercel: `tu-app.vercel.app`
4. También agrega `localhost` si no está (para pruebas locales)

---

## PASO 2 — INSTALAR Y PROBAR LOCALMENTE

```bash
# 1. Crea la carpeta del proyecto y entra en ella
mkdir chile-predictor
cd chile-predictor

# 2. Copia todos los archivos (siguiendo la estructura de arriba)

# 3. Instala dependencias
npm install

# 4. Ejecuta en modo desarrollo
npm run dev

# 5. Abre en el navegador: http://localhost:5173
```

**⚠ Si ves error de Firebase:** Verifica que las credenciales en `src/firebase.js` sean correctas.

---

## PASO 3 — SUBIR A GITHUB

```bash
# 1. Inicializa git (si no lo has hecho)
git init

# 2. Agrega todos los archivos
git add .

# 3. Primer commit
git commit -m "Chile Predictor 8-bit - primera versión"

# 4. Crea un repositorio en GitHub.com
# Ve a github.com → New repository → Nombre: chile-predictor

# 5. Conecta y sube
git remote add origin https://github.com/TU_USUARIO/chile-predictor.git
git branch -M main
git push -u origin main
```

---

## PASO 4 — DESPLEGAR EN VERCEL

1. Ve a https://vercel.com/ e inicia sesión con GitHub
2. Haz clic en **"New Project"**
3. Importa el repositorio `chile-predictor`
4. Configuración (Vercel lo detecta automáticamente):
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Haz clic en **"Deploy"**
6. Espera ~1 minuto. Vercel te da una URL como `chile-predictor.vercel.app`

### Variables de entorno en Vercel (opcional pero recomendado)
En vez de poner las credenciales directamente en firebase.js, puedes usar variables de entorno:

1. En Vercel → Tu proyecto → **Settings → Environment Variables**
2. Agrega cada variable:
   - `VITE_FIREBASE_API_KEY` = tu apiKey
   - `VITE_FIREBASE_AUTH_DOMAIN` = tu authDomain
   - (etc. para cada valor)
3. En `src/firebase.js` usa `import.meta.env.VITE_FIREBASE_API_KEY` en vez del valor directo

---

## PASO 5 — AGREGAR DATOS COMO ADMIN

### Agregar partidos (en Firebase Console)
1. Ve a Firestore → **"partidos"** → **"Agregar documento"**
2. ID del documento: cualquier cosa (ej: `partido_001`)
3. Campos:
   ```
   fecha: "2026-06-11"     (string)
   horaInicio: "15:00"     (string, hora Santiago)
   local: {
     nombre: "Chile",
     bandera: "🇨🇱"
   }
   visitante: {
     nombre: "España",
     bandera: "🇪🇸"
   }
   estaDestacado: true      (boolean)
   resultado: null           (dejar en null hasta que se juegue)
   ```

### Ingresar resultado real (después del partido)
1. Ve al documento del partido en Firestore
2. Edita el campo `resultado`:
   ```
   resultado: {
     golesLocal: 2,
     golesVisitante: 1
   }
   ```
3. ¡La app calculará los puntos automáticamente al leer este dato!

### Agregar pregunta del día
Colección: `preguntas`, nuevo documento:
```
fecha: "2026-06-11"
texto: "¿Quién marcará el primer gol?"
opciones: ["Alexis Sánchez", "Vidal", "Vargas", "Otro"]
respuestaCorrecta: null   (llénalo después)
```

### Actualizar puntajes totales
La app muestra `puntosTotal` del documento de usuario.
Debes actualizarlo manualmente en Firestore (o escribir una Cloud Function).

Forma manual:
1. Ve a `usuarios` → encuentra al usuario
2. Edita el campo `puntosTotal` con el nuevo valor

### Actualizar podio del día anterior
Colección: `puntosDelDia`, nuevo documento (ID: `uid_fecha`):
```
uid: "abc123..."
fecha: "2026-06-11"
nickname: "ElPibe10"
avatarEmoji: "🦁"
puntos: 8
```

---

## SISTEMA DE PUNTUACIÓN — RESUMEN

| Situación | Puntos |
|-----------|--------|
| Acertar ganador (partido normal) | +1 |
| Acertar ganador + diferencia | +2 |
| Resultado exacto (partido destacado ⭐) | +3 |
| Solo ganador en partido destacado | +1 |
| Pregunta del día correcta | +2 |
| Ser el ganador del día (más puntos) | +3 extra |

---

## PREGUNTAS FRECUENTES

**¿Puedo cambiar los emojis de avatares por imágenes?**
Sí. En `src/data/sampleData.js`, en el array `AVATARES`, cambia el campo `emoji` por la URL de una imagen. Luego actualiza los componentes para usar `<img>` en vez de `<span>`.

**¿Cómo cambio las frases del día?**
Edita el array `FRASES_DEL_DIA` en `src/data/sampleData.js`.

**¿Puedo tener más de 8 avatares?**
Sí, agrega más objetos al array `AVATARES` en `sampleData.js`.

**¿Cómo desbloqueo cartas coleccionables?**
Manualmente desde Firebase Console: edita el campo `cartasDesbloqueadas` del usuario (es un array de IDs de carta, ej: `["c1", "c3"]`).

**El login con Google no funciona en local**
Asegúrate de que `localhost` esté en la lista de dominios autorizados en Firebase → Authentication → Settings.

**Error "Missing or insufficient permissions"**
Las reglas de Firestore no están bien configuradas. Pega el contenido de `firestore.rules` en la consola de Firebase.
