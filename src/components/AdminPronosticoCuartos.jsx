// src/components/AdminPronosticoCuartos.jsx
// ─────────────────────────────────────────────────────────────
// Panel admin para el módulo de Pronóstico Cuartos de Final.
//
//  SECCIÓN 1: Activar/desactivar el módulo
//  SECCIÓN 2: Cargar los 8 partidos de octavos (equipos + fecha)
//  SECCIÓN 3: Cerrar partidos manualmente
//  SECCIÓN 4: Confirmar los 8 clasificados reales y dar puntos
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  doc, onSnapshot, setDoc, updateDoc,
  collection, getDocs, writeBatch, increment,
} from "firebase/firestore";
import { db } from "../firebase";

const REF_CONFIG = () => doc(db, "pronosticoCuartos", "config");
const REF_VOTOS  = () => collection(db, "pronosticoCuartos_votos");

const TABLA_PUNTOS = [0, 100, 200, 250, 300, 350, 400, 450, 500];

// Equipos de octavos para selector rápido
const EQUIPOS_OCTAVOS = [
  { nombre:"Argentina",    bandera:"🇦🇷" },
  { nombre:"Ecuador",      bandera:"🇪🇨" },
  { nombre:"Brasil",       bandera:"🇧🇷" },
  { nombre:"México",       bandera:"🇲🇽" },
  { nombre:"Francia",      bandera:"🇫🇷" },
  { nombre:"España",       bandera:"🇪🇸" },
  { nombre:"Alemania",     bandera:"🇩🇪" },
  { nombre:"Portugal",     bandera:"🇵🇹" },
  { nombre:"Marruecos",    bandera:"🇲🇦" },
  { nombre:"Países Bajos", bandera:"🇳🇱" },
  { nombre:"Inglaterra",   bandera:"🇬🇧" },
  { nombre:"Colombia",     bandera:"🇨🇴" },
  { nombre:"Uruguay",      bandera:"🇺🇾" },
  { nombre:"Chile",        bandera:"🇨🇱" },
  { nombre:"Japón",        bandera:"🇯🇵" },
  { nombre:"Estados Unidos", bandera:"🇺🇸" },
  { nombre:"Canadá", bandera:"🇨🇦" },
  { nombre:"Paraguay", bandera:"🇵🇾"},
  { nombre:"Noruega", bandera:"🇳🇴"},
  { nombre:"Bélgica", bandera:"🇧🇪"},
];

export default function AdminPronosticoCuartos({ onMensaje }) {
  const [config,    setConfig]    = useState(null);
  const [cargando,  setCargando]  = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [calculando, setCalculando] = useState(false);

  // Form partidos
  const [partidos, setPartidos] = useState(
    Array.from({ length:8 }, (_,i) => ({
      id: `oct_${i+1}`,
      local:     { nombre:"", bandera:"🏳️" },
      visitante: { nombre:"", bandera:"🏳️" },
      fecha:     "",
      cerrado:   false,
    }))
  );

  // Clasificados confirmados
  const [clasificados, setClasificados] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(REF_CONFIG(), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setConfig(d);
        if (d.partidos?.length === 8) setPartidos(d.partidos);
        setClasificados(d.clasificados || []);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const updPartido = (i, field, val) => setPartidos(prev =>
    prev.map((p, idx) => idx !== i ? p : { ...p, ...field })
  );

  const setEquipo = (i, lado, nombre) => {
    const eq = EQUIPOS_OCTAVOS.find(e => e.nombre === nombre) || { nombre, bandera:"🏳️" };
    setPartidos(prev => prev.map((p, idx) =>
      idx !== i ? p : { ...p, [lado]: eq }
    ));
  };

  // ── Guardar configuración ─────────────────────────────────
  const guardarConfig = async (activo) => {
    setGuardando(true);
    try {
      const validos = partidos.filter(p =>
        p.local.nombre && p.visitante.nombre && p.fecha
      );
      if (validos.length === 0) {
        onMensaje("error", "Configura al menos un partido."); return;
      }
      await setDoc(REF_CONFIG(), {
        activo:      activo ?? config?.activo ?? true,
        partidos:    partidos,
        clasificados: clasificados,
      });
      onMensaje("ok", `✅ Módulo ${activo ? "activado" : "actualizado"}.`);
    } catch(e) { onMensaje("error", e.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async () => {
    try {
      await updateDoc(REF_CONFIG(), { activo: !config?.activo });
      onMensaje("ok", config?.activo ? "Módulo desactivado." : "Módulo activado.");
    } catch(e) { onMensaje("error", e.message); }
  };

  const cerrarPartido = async (i) => {
    const nuevos = partidos.map((p,idx) =>
      idx === i ? { ...p, cerrado: true } : p
    );
    setPartidos(nuevos);
    try {
      await updateDoc(REF_CONFIG(), { partidos: nuevos });
      onMensaje("ok", `Partido cerrado.`);
    } catch(e) { onMensaje("error", e.message); }
  };

  const toggleClasificado = (nombre) => {
    setClasificados(prev =>
      prev.includes(nombre)
        ? prev.filter(n => n !== nombre)
        : prev.length < 8 ? [...prev, nombre] : prev
    );
  };

  // ── Confirmar clasificados y calcular puntos ──────────────
  const calcularPuntos = async () => {
    if (clasificados.length !== 8) {
      onMensaje("error", "Confirma exactamente 8 clasificados."); return;
    }
    setCalculando(true);
    try {
      // 1. Guardar clasificados
      await updateDoc(REF_CONFIG(), { clasificados });

      // 2. Leer todos los votos
      const snapV = await getDocs(REF_VOTOS());
      const batch = writeBatch(db);
      let procesados = 0;

      snapV.docs.forEach(d => {
        const voto = d.data();
        if (voto.calculado) return;
        const aciertos = (voto.selecciones || []).filter(s =>
          clasificados.includes(s)
        ).length;
        const pts = TABLA_PUNTOS[aciertos] || 0;
        batch.update(d.ref, { calculado: true, puntos: pts, aciertos });
        if (pts > 0) {
          batch.update(doc(db, "usuarios", voto.uid), {
            puntosTotal: increment(pts),
          });
        }
        procesados++;
      });

      await batch.commit();
      onMensaje("ok",
        `✅ Puntos calculados para ${procesados} usuarios. Clasificados confirmados.`
      );
    } catch(e) { onMensaje("error", e.message); }
    finally { setCalculando(false); }
  };

  if (cargando) return (
    <p style={{ fontSize:"6px", color:"var(--gris-claro)", padding:"16px" }}>⚙ Cargando...</p>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

      {/* ═══ SECCIÓN 1: Estado del módulo ════════════════════ */}
      <div style={{ padding:"10px", border:"2px solid #1e40af",
        background:"rgba(30,64,175,0.08)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:"7px", color:"#60a5fa", marginBottom:"2px" }}>
              🏆 PRONÓSTICO CUARTOS
            </p>
            <p style={{ fontSize:"5px", color:"var(--gris-claro)" }}>
              Estado: {config?.activo
                ? <span style={{ color:"var(--verde-claro)" }}>ACTIVO</span>
                : <span style={{ color:"var(--gris)" }}>INACTIVO</span>}
            </p>
          </div>
          {config && (
            <button
              className={`btn-pixel ${config.activo ? "btn-gris" : "btn-rojo"}`}
              style={{ fontSize:"6px" }}
              onClick={toggleActivo}>
              {config.activo ? "DESACTIVAR" : "ACTIVAR"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ SECCIÓN 2: Configurar los 8 partidos ════════════ */}
      <div style={{ border:"2px solid rgba(255,255,255,0.1)", padding:"12px" }}>
        <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>
          ⚙ CONFIGURAR LOS 8 PARTIDOS
        </p>

        {partidos.map((p, i) => (
          <div key={p.id} style={{ marginBottom:"12px", padding:"10px",
            border:`1px solid ${p.cerrado?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.1)"}`,
            background: p.cerrado ? "rgba(248,113,113,0.05)" : "rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:"8px" }}>
              <p style={{ fontSize:"6px", color:"var(--amarillo)" }}>
                PARTIDO {i+1}
              </p>
              {!p.cerrado ? (
                <button onClick={() => cerrarPartido(i)}
                  style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                    padding:"3px 7px", cursor:"pointer",
                    border:"1px solid var(--rojo-chile)", background:"transparent",
                    color:"var(--rojo-chile)" }}>
                  🔒 CERRAR
                </button>
              ) : (
                <span style={{ fontSize:"5px", color:"#f87171" }}>🔒 CERRADO</span>
              )}
            </div>

            <div style={{ display:"flex", gap:"6px", marginBottom:"6px" }}>
              {/* Local */}
              <select
                value={p.local.nombre}
                onChange={e => setEquipo(i, "local", e.target.value)}
                disabled={p.cerrado}
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                  flex:1, padding:"4px", border:"1px solid var(--negro)",
                  background:"var(--blanco)", color:"var(--negro)", outline:"none" }}>
                <option value="">— Local —</option>
                {EQUIPOS_OCTAVOS.map(e => (
                  <option key={e.nombre} value={e.nombre}>{e.bandera} {e.nombre}</option>
                ))}
              </select>
              <span style={{ color:"rgba(255,255,255,0.3)", fontSize:"10px",
                display:"flex", alignItems:"center" }}>vs</span>
              {/* Visitante */}
              <select
                value={p.visitante.nombre}
                onChange={e => setEquipo(i, "visitante", e.target.value)}
                disabled={p.cerrado}
                style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                  flex:1, padding:"4px", border:"1px solid var(--negro)",
                  background:"var(--blanco)", color:"var(--negro)", outline:"none" }}>
                <option value="">— Visitante —</option>
                {EQUIPOS_OCTAVOS.map(e => (
                  <option key={e.nombre} value={e.nombre}>{e.bandera} {e.nombre}</option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <input type="date" value={p.fecha} disabled={p.cerrado}
              onChange={e => updPartido(i, { fecha: e.target.value })}
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                width:"100%", padding:"4px 6px", border:"1px solid var(--negro)",
                background: p.cerrado ? "rgba(0,0,0,0.3)" : "var(--blanco)",
                color: p.cerrado ? "var(--gris-claro)" : "var(--negro)",
                outline:"none" }} />
          </div>
        ))}

        <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
          onClick={() => guardarConfig(true)} disabled={guardando}>
          {guardando ? "⚙ GUARDANDO..." : "💾 GUARDAR Y ACTIVAR"}
        </button>
      </div>

      {/* ═══ SECCIÓN 3: Confirmar clasificados ═══════════════ */}
      <div style={{ border:"2px solid var(--verde-campo)", padding:"12px" }}>
        <p style={{ fontSize:"7px", color:"var(--verde-claro)", marginBottom:"4px" }}>
          ✅ CONFIRMAR CLASIFICADOS A CUARTOS
        </p>
        <p style={{ fontSize:"5px", color:"var(--gris-claro)",
          marginBottom:"10px", lineHeight:2 }}>
          Selecciona los 8 equipos que clasificaron. Al confirmar se calculan los puntos.
          ({clasificados.length}/8 seleccionados)
        </p>

        <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"12px" }}>
          {EQUIPOS_OCTAVOS.map(e => (
            <button key={e.nombre}
              onClick={() => toggleClasificado(e.nombre)}
              style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                padding:"4px 8px", cursor:"pointer",
                border:`2px solid ${clasificados.includes(e.nombre)
                  ?"var(--verde-claro)":"rgba(255,255,255,0.15)"}`,
                background: clasificados.includes(e.nombre)
                  ?"rgba(52,211,153,0.15)":"rgba(0,0,0,0.3)",
                color:"var(--blanco)",
              }}>
              {e.bandera} {e.nombre}
            </button>
          ))}
        </div>

        <button
          className="btn-pixel btn-rojo w-full"
          style={{ fontSize:"7px" }}
          onClick={calcularPuntos}
          disabled={clasificados.length !== 8 || calculando}>
          {calculando
            ? "⚙ CALCULANDO..."
            : clasificados.length !== 8
              ? `⚠ FALTAN ${8 - clasificados.length} EQUIPOS`
              : "⚡ CONFIRMAR Y CALCULAR PUNTOS"}
        </button>
      </div>
    </div>
  );
}
