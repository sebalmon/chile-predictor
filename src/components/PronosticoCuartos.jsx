// src/components/PronosticoCuartos.jsx
// ─────────────────────────────────────────────────────────────
// Widget flotante minimizable — aparece en todas las pestañas.
// El usuario elige los 8 clasificados a cuartos de final.
// Los partidos se cierran por fecha (cuando empieza el partido).
//
// Firestore:
//   pronosticoCuartos/config → {
//     activo: bool,
//     partidos: [{ id, local{nombre,bandera}, visitante{nombre,bandera},
//                  fecha, cerrado }],
//     clasificados: ["nombre1",...] // admin confirma los 8 reales
//   }
//   pronosticoCuartos/votos/{uid} → {
//     uid, selecciones: ["nombre1",...], timestamp,
//     puntos: N, calculado: bool
//   }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  doc, onSnapshot, setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const REF_CONFIG = () => doc(db, "pronosticoCuartos", "config");
const REF_VOTO   = (uid) => doc(db, "pronosticoCuartos", "votos", uid);

const TABLA_PUNTOS = [0, 100, 200, 250, 300, 350, 400, 450, 500];

export default function PronosticoCuartos() {
  const { firebaseUser } = useAuth();
  const [config,      setConfig]      = useState(null);
  const [miVoto,      setMiVoto]      = useState(null);
  const [abierto,     setAbierto]     = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [selecciones, setSelecciones] = useState([]);

  // Escuchar config en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(REF_CONFIG(), snap => {
      setConfig(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  // Cargar mi voto
  useEffect(() => {
    if (!firebaseUser) return;
    getDoc(REF_VOTO(firebaseUser.uid)).then(snap => {
      if (snap.exists()) {
        setMiVoto(snap.data());
        setSelecciones(snap.data().selecciones || []);
      }
    });
  }, [firebaseUser]);

  if (!config?.activo) return null;

  const partidos = config.partidos || [];
  const hoy      = new Date().toISOString().split("T")[0];

  // Partidos abiertos: fecha >= hoy y no cerrado manualmente
  const abiertos  = partidos.filter(p => !p.cerrado && p.fecha >= hoy);
  const cerrados  = partidos.filter(p => p.cerrado || p.fecha < hoy);
  const yaVoto    = miVoto?.calculado;

  // Equipos disponibles para seleccionar (de partidos aún abiertos)
  const equiposDisponibles = abiertos.flatMap(p => [
    { nombre: p.local.nombre,     bandera: p.local.bandera,     partidoId: p.id },
    { nombre: p.visitante.nombre, bandera: p.visitante.bandera, partidoId: p.id },
  ]);

  const toggleEquipo = (nombre) => {
    if (miVoto?.calculado) return;
    // No se puede seleccionar ambos del mismo partido
    const partido = abiertos.find(p =>
      p.local.nombre === nombre || p.visitante.nombre === nombre
    );
    if (!partido) return;
    const rival = partido.local.nombre === nombre
      ? partido.visitante.nombre : partido.local.nombre;

    setSelecciones(prev => {
      if (prev.includes(nombre)) return prev.filter(n => n !== nombre);
      // Quitar rival si estaba seleccionado
      const sinRival = prev.filter(n => n !== rival);
      return [...sinRival, nombre];
    });
  };

  const guardar = async () => {
    if (!firebaseUser || selecciones.length === 0) return;
    setGuardando(true);
    try {
      await setDoc(REF_VOTO(firebaseUser.uid), {
        uid:         firebaseUser.uid,
        selecciones,
        timestamp:   serverTimestamp(),
        calculado:   false,
        puntos:      0,
      });
      setMiVoto({ selecciones, calculado: false, puntos: 0 });
    } catch(e) { console.error(e); }
    finally { setGuardando(false); }
  };

  // ── BURBUJA MINIMIZADA ──────────────────────────────────────
  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        style={{
          position:"fixed", bottom:"160px", right:"16px", zIndex:600,
          background:"linear-gradient(135deg,#1e3a8a,#1e40af)",
          border:"3px solid #60a5fa",
          borderRadius:"50%", width:"52px", height:"52px",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"22px", cursor:"pointer",
          boxShadow:"0 0 14px rgba(96,165,250,0.5)",
          animation:"pulsoAzul 2s ease-in-out infinite",
        }}
        title="Pronóstico Cuartos de Final"
      >
        🏆
        <style>{`
          @keyframes pulsoAzul {
            0%,100%{ box-shadow:0 0 14px rgba(96,165,250,0.5); }
            50%    { box-shadow:0 0 22px rgba(96,165,250,0.9); }
          }
        `}</style>
      </button>
    );
  }

  // ── PANEL ABIERTO ────────────────────────────────────────────
  return (
    <div style={{
      position:"fixed", right:"0", top:"0", bottom:"0", zIndex:600,
      width:"min(340px, 100vw)",
      background:"linear-gradient(180deg,#0f172a 0%,#0a0f1e 100%)",
      border:"2px solid #1e40af",
      borderRight:"none",
      display:"flex", flexDirection:"column",
      fontFamily:"'Press Start 2P',monospace",
      boxShadow:"-4px 0 20px rgba(30,64,175,0.4)",
      overflowY:"auto",
    }}>
      {/* Header */}
      <div style={{
        padding:"12px 14px",
        background:"linear-gradient(90deg,#1e3a8a,#1e40af)",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        flexShrink:0,
      }}>
        <div>
          <p style={{ fontSize:"7px", color:"#93c5fd", marginBottom:"2px" }}>
            🏆 CUARTOS DE FINAL
          </p>
          <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.6)" }}>
            ¿Quiénes clasifican?
          </p>
        </div>
        <button onClick={() => setAbierto(false)}
          style={{ background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.2)",
            color:"var(--blanco)", fontSize:"14px", width:"28px", height:"28px",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          ✕
        </button>
      </div>

      {/* Tabla de puntos */}
      <div style={{ padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
          {[8,7,6,5,4,3,2,1].map(n => (
            <div key={n} style={{
              background:"rgba(30,64,175,0.3)", border:"1px solid rgba(96,165,250,0.3)",
              padding:"3px 6px", textAlign:"center",
            }}>
              <p style={{ fontSize:"5px", color:"#93c5fd" }}>{n} ✓</p>
              <p style={{ fontSize:"6px", color:"var(--amarillo)" }}>{TABLA_PUNTOS[n]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resultado si ya fue calculado */}
      {yaVoto && miVoto?.puntos > 0 && (
        <div style={{ padding:"10px 14px", background:"rgba(52,211,153,0.1)",
          borderBottom:"1px solid rgba(52,211,153,0.3)" }}>
          <p style={{ fontSize:"7px", color:"#34d399", textAlign:"center" }}>
            🎉 GANASTE {miVoto.puntos} PTS
          </p>
        </div>
      )}

      <div style={{ padding:"12px 14px", flex:1 }}>

        {/* Partidos con votación abierta */}
        {abiertos.length > 0 && (
          <>
            <p style={{ fontSize:"5px", color:"#93c5fd", marginBottom:"8px",
              letterSpacing:"1px" }}>
              ELIGE UN CLASIFICADO POR PARTIDO:
            </p>
            {abiertos.map(p => {
              const selLocal     = selecciones.includes(p.local.nombre);
              const selVisitante = selecciones.includes(p.visitante.nombre);
              return (
                <div key={p.id} style={{ marginBottom:"8px" }}>
                  <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)",
                    marginBottom:"4px" }}>
                    {p.fecha}
                  </p>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button onClick={() => toggleEquipo(p.local.nombre)}
                      disabled={yaVoto}
                      style={{
                        flex:1, padding:"7px 4px",
                        fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                        cursor: yaVoto ? "default" : "pointer",
                        border:`2px solid ${selLocal?"#60a5fa":"rgba(255,255,255,0.15)"}`,
                        background: selLocal?"rgba(96,165,250,0.2)":"rgba(0,0,0,0.4)",
                        color:"var(--blanco)", textAlign:"center",
                      }}>
                      {p.local.bandera}<br/>{p.local.nombre}
                    </button>
                    <span style={{ color:"rgba(255,255,255,0.3)", fontSize:"10px",
                      display:"flex", alignItems:"center" }}>vs</span>
                    <button onClick={() => toggleEquipo(p.visitante.nombre)}
                      disabled={yaVoto}
                      style={{
                        flex:1, padding:"7px 4px",
                        fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                        cursor: yaVoto ? "default" : "pointer",
                        border:`2px solid ${selVisitante?"#60a5fa":"rgba(255,255,255,0.15)"}`,
                        background: selVisitante?"rgba(96,165,250,0.2)":"rgba(0,0,0,0.4)",
                        color:"var(--blanco)", textAlign:"center",
                      }}>
                      {p.visitante.bandera}<br/>{p.visitante.nombre}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Partidos cerrados */}
        {cerrados.length > 0 && (
          <>
            <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.3)",
              margin:"10px 0 6px", letterSpacing:"1px" }}>
              CERRADOS:
            </p>
            {cerrados.map(p => {
              const selLocal     = selecciones.includes(p.local.nombre);
              const selVisitante = selecciones.includes(p.visitante.nombre);
              const clasificado  = config.clasificados?.includes(p.local.nombre)
                ? p.local.nombre
                : config.clasificados?.includes(p.visitante.nombre)
                  ? p.visitante.nombre : null;
              return (
                <div key={p.id} style={{ marginBottom:"6px",
                  opacity: 0.6 }}>
                  <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
                    <span style={{ fontSize:"6px", color:"rgba(255,255,255,0.5)" }}>
                      {p.local.bandera} {p.local.nombre}
                    </span>
                    <span style={{ fontSize:"5px", color:"rgba(255,255,255,0.3)" }}>vs</span>
                    <span style={{ fontSize:"6px", color:"rgba(255,255,255,0.5)" }}>
                      {p.visitante.nombre} {p.visitante.bandera}
                    </span>
                  </div>
                  {clasificado && (
                    <p style={{ fontSize:"5px", color:"#34d399", marginTop:"2px" }}>
                      ✅ Clasificó: {clasificado}
                      {(selLocal || selVisitante) && (
                        <span style={{
                          color: (selLocal && clasificado === p.local.nombre) ||
                                 (selVisitante && clasificado === p.visitante.nombre)
                            ? "#34d399" : "#f87171",
                          marginLeft:"6px",
                        }}>
                          {(selLocal && clasificado === p.local.nombre) ||
                           (selVisitante && clasificado === p.visitante.nombre)
                            ? "✓ acertaste" : "✗ fallaste"}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Resumen selecciones */}
        {selecciones.length > 0 && (
          <div style={{ marginTop:"10px", padding:"8px",
            border:"1px solid rgba(96,165,250,0.3)",
            background:"rgba(30,64,175,0.15)" }}>
            <p style={{ fontSize:"5px", color:"#93c5fd", marginBottom:"6px" }}>
              TUS {selecciones.length} SELECCION(ES):
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
              {selecciones.map(n => (
                <span key={n} style={{ fontSize:"5px", color:"var(--blanco)",
                  background:"rgba(96,165,250,0.2)",
                  border:"1px solid #60a5fa", padding:"2px 6px" }}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Botón guardar */}
        {!yaVoto && selecciones.length > 0 && (
          <button
            className="btn-pixel btn-rojo w-full"
            style={{ fontSize:"6px", marginTop:"10px" }}
            onClick={guardar}
            disabled={guardando}>
            {guardando ? "⚙ GUARDANDO..." : `💾 GUARDAR MIS ${selecciones.length} PRONÓSTICOS`}
          </button>
        )}

        {yaVoto && (
          <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)",
            textAlign:"center", marginTop:"10px", lineHeight:2 }}>
            Pronósticos guardados. Los puntos se asignan cuando el admin confirme los clasificados.
          </p>
        )}

        {abiertos.length === 0 && !yaVoto && (
          <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)",
            textAlign:"center", marginTop:"10px", lineHeight:2 }}>
            Todos los partidos están cerrados.
          </p>
        )}
      </div>
    </div>
  );
}
