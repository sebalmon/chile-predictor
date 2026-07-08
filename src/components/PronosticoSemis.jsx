// src/components/PronosticoSemis.jsx
// Widget flotante para votar los 4 semifinalistas.
// Firestore:
//   semifinales/config → { activo, partidos:[{id,local,visitante,fecha,cerrado}], clasificados:[] }
//   semifinales_votos/{uid} → { uid, selecciones:[], calculado, puntos, aciertos }

import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const REF_CONFIG = () => doc(db, "semifinales", "config");
const REF_VOTO   = (uid) => doc(db, "semifinales_votos", uid);

const TABLA = [0, 250, 500, 750, 1000]; // índice = aciertos

export default function PronosticoSemis() {
  const { firebaseUser } = useAuth();
  const [config,      setConfig]      = useState(null);
  const [miVoto,      setMiVoto]      = useState(null);
  const [abierto,     setAbierto]     = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [guardadoOk,  setGuardadoOk]  = useState(false);
  const [selecciones, setSelecciones] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cp8b_semis_sel") || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    const unsub = onSnapshot(REF_CONFIG(), snap => {
      setConfig(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    getDoc(REF_VOTO(firebaseUser.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setMiVoto(data);
        setSelecciones(data.selecciones || []);
        localStorage.setItem("cp8b_semis_sel", JSON.stringify(data.selecciones || []));
      }
    });
  }, [firebaseUser]);

  if (!config?.activo) return null;

  const partidos = config.partidos || [];
  const hoy      = new Date().toISOString().split("T")[0];
  const abiertos = partidos.filter(p => !p.cerrado && p.fecha >= hoy);
  const cerrados = partidos.filter(p => p.cerrado  || p.fecha <  hoy);
  const yaVoto   = miVoto?.calculado;

  const toggleEquipo = (nombre) => {
    if (yaVoto) return;
    const partido = partidos.find(p => p.local.nombre === nombre || p.visitante.nombre === nombre);
    if (!partido) return;
    if (partido.cerrado || partido.fecha < hoy) return;
    const rival = partido.local.nombre === nombre ? partido.visitante.nombre : partido.local.nombre;
    setSelecciones(prev => {
      let next;
      if (prev.includes(nombre)) {
        next = prev.filter(n => n !== nombre);
      } else {
        next = [...prev.filter(n => n !== rival), nombre];
      }
      localStorage.setItem("cp8b_semis_sel", JSON.stringify(next));
      return next;
    });
  };

  const guardar = async () => {
    if (!firebaseUser || selecciones.length === 0) return;
    setGuardando(true);
    try {
      await setDoc(REF_VOTO(firebaseUser.uid), {
        uid: firebaseUser.uid, selecciones,
        timestamp: serverTimestamp(), calculado: false, puntos: 0,
      });
      setMiVoto(prev => ({ ...(prev||{}), selecciones, calculado:false, puntos:0 }));
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3500);
    } catch(e) { console.error(e); }
    finally { setGuardando(false); }
  };

  // ── BOTÓN LATERAL ─────────────────────────────────────────────
  if (!abierto) return (
    <button onClick={() => setAbierto(true)}
      style={{
        position:"fixed", bottom:"220px", right:0, zIndex:600,
        background:"linear-gradient(135deg,#4c1d95,#6d28d9)",
        border:"3px solid #a78bfa", borderRight:"none",
        borderRadius:"8px 0 0 8px", padding:"10px 10px",
        display:"flex", flexDirection:"column", alignItems:"center",
        gap:"4px", cursor:"pointer", maxWidth:"66px",
        boxShadow:"-4px 0 14px rgba(167,139,250,0.5)",
        animation:"pulsoVioleta 2s ease-in-out infinite",
      }}>
      <span style={{ fontSize:"20px" }}>⚽</span>
      <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"4px",
        color:"#c4b5fd", lineHeight:1.6, textAlign:"center" }}>
        PRONOSTICA<br/>SEMIS
      </span>
      <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"4px", color:"var(--amarillo)" }}>
        ¡1000 pts!
      </span>
      <style>{`@keyframes pulsoVioleta{0%,100%{box-shadow:-4px 0 14px rgba(167,139,250,0.5)}50%{box-shadow:-4px 0 22px rgba(167,139,250,0.9)}}`}</style>
    </button>
  );

  // ── PANEL ABIERTO ─────────────────────────────────────────────
  return (
    <div style={{
      position:"fixed", right:0, top:0, bottom:0, zIndex:600,
      width:"min(340px,100vw)",
      background:"linear-gradient(180deg,#1e0040 0%,#0d001a 100%)",
      border:"2px solid #6d28d9", borderRight:"none",
      display:"flex", flexDirection:"column",
      fontFamily:"'Press Start 2P',monospace",
      boxShadow:"-4px 0 20px rgba(109,40,217,0.4)",
      overflowY:"auto",
    }}>
      {/* Header */}
      <div style={{ padding:"12px 14px", flexShrink:0,
        background:"linear-gradient(90deg,#4c1d95,#6d28d9)",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <p style={{ fontSize:"7px", color:"#c4b5fd", marginBottom:"2px" }}>⚽ SEMIFINALES</p>
          <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.5)" }}>¿Quiénes clasifican?</p>
        </div>
        <button onClick={() => setAbierto(false)}
          style={{ background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.2)",
            color:"var(--blanco)", fontSize:"14px", width:"28px", height:"28px",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
      </div>

      {/* Explicación + tabla */}
      <div style={{ padding:"10px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ fontSize:"5px", color:"#c4b5fd", lineHeight:2.2, marginBottom:"8px" }}>
          Elige el equipo que crees que clasificará a semifinales en cada partido.
          Puedes cambiar tu voto hasta que el partido empiece.
        </p>
        <p style={{ fontSize:"5px", color:"var(--amarillo)", marginBottom:"6px" }}>PUNTOS SEGÚN ACIERTOS:</p>
        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
          {[4,3,2,1].map(n => (
            <div key={n} style={{ background:"rgba(109,40,217,0.3)",
              border:"1px solid rgba(167,139,250,0.4)", padding:"4px 8px", textAlign:"center" }}>
              <p style={{ fontSize:"4px", color:"#c4b5fd" }}>{n} ✓</p>
              <p style={{ fontSize:"6px", color:"var(--amarillo)" }}>{TABLA[n]} pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resultado si ya calculado */}
      {yaVoto && miVoto?.puntos > 0 && (
        <div style={{ padding:"10px 14px", background:"rgba(52,211,153,0.1)",
          borderBottom:"1px solid rgba(52,211,153,0.3)" }}>
          <p style={{ fontSize:"7px", color:"#34d399", textAlign:"center" }}>
            🎉 GANASTE {miVoto.puntos} PTS
          </p>
        </div>
      )}

      <div style={{ padding:"12px 14px", flex:1 }}>
        {/* Partidos abiertos */}
        {abiertos.length > 0 && (
          <>
            <p style={{ fontSize:"5px", color:"#c4b5fd", marginBottom:"8px", letterSpacing:"1px" }}>
              ELIGE UN CLASIFICADO POR PARTIDO:
            </p>
            {abiertos.map(p => {
              const selL = selecciones.includes(p.local.nombre);
              const selV = selecciones.includes(p.visitante.nombre);
              return (
                <div key={p.id} style={{ marginBottom:"8px" }}>
                  <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)", marginBottom:"4px" }}>{p.fecha}</p>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {[{eq:p.local,sel:selL},{eq:p.visitante,sel:selV}].map(({eq,sel},ii) => (
                      <button key={ii} onClick={() => toggleEquipo(eq.nombre)} disabled={yaVoto}
                        style={{ flex:1, padding:"7px 4px",
                          fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                          cursor: yaVoto?"default":"pointer",
                          border:`2px solid ${sel?"#a78bfa":"rgba(255,255,255,0.15)"}`,
                          background: sel?"rgba(167,139,250,0.2)":"rgba(0,0,0,0.4)",
                          color:"var(--blanco)", textAlign:"center" }}>
                        {eq.bandera}<br/>{eq.nombre}
                      </button>
                    ))}
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
              margin:"10px 0 6px", letterSpacing:"1px" }}>CERRADOS:</p>
            {cerrados.map(p => {
              const selL = selecciones.includes(p.local.nombre);
              const selV = selecciones.includes(p.visitante.nombre);
              const clas = config.clasificados?.find(n => n===p.local.nombre||n===p.visitante.nombre);
              return (
                <div key={p.id} style={{ marginBottom:"6px", opacity:0.65 }}>
                  <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.5)" }}>
                    {p.local.bandera} {p.local.nombre} vs {p.visitante.nombre} {p.visitante.bandera}
                  </p>
                  {clas && (
                    <p style={{ fontSize:"5px", color:"#34d399", marginTop:"2px" }}>
                      ✅ Clasificó: {clas}
                      {(selL||selV) && (
                        <span style={{ marginLeft:"6px",
                          color:(selL&&clas===p.local.nombre)||(selV&&clas===p.visitante.nombre)?"#34d399":"#f87171" }}>
                          {(selL&&clas===p.local.nombre)||(selV&&clas===p.visitante.nombre)?"✓ acertaste":"✗ fallaste"}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Mis selecciones guardadas */}
        {(selecciones.length > 0) && (
          <div style={{ marginTop:"10px", padding:"8px",
            border:"1px solid rgba(167,139,250,0.3)", background:"rgba(109,40,217,0.15)" }}>
            <p style={{ fontSize:"5px", color:"#c4b5fd", marginBottom:"6px" }}>
              {miVoto ? `✅ TUS ${miVoto.selecciones?.length||selecciones.length} PRONÓSTICOS:` : `TUS ${selecciones.length} SELECCIÓN(ES):`}
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
              {(miVoto?.selecciones||selecciones).map(n => {
                const correcto   = config.clasificados?.includes(n);
                const incorrecto = config.clasificados?.length > 0 && !correcto;
                return (
                  <span key={n} style={{ fontSize:"5px", color:"var(--blanco)",
                    background: correcto?"rgba(52,211,153,0.2)":incorrecto?"rgba(248,113,113,0.2)":"rgba(167,139,250,0.2)",
                    border:`1px solid ${correcto?"#34d399":incorrecto?"#f87171":"#a78bfa"}`,
                    padding:"2px 6px" }}>
                    {correcto?"✓ ":incorrecto?"✗ ":""}{n}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Botón guardar/editar */}
        {!yaVoto && (
          <button className="btn-pixel btn-rojo w-full"
            style={{ fontSize:"7px", marginTop:"10px", padding:"10px" }}
            onClick={guardar}
            disabled={guardando || (selecciones.length === 0 && !miVoto)}>
            {guardando ? "⚙ GUARDANDO..."
              : selecciones.length === 0 && miVoto ? "✏ EDITAR PRONÓSTICOS"
              : miVoto ? `✏ ACTUALIZAR ${selecciones.length} PRONÓSTICOS`
              : `💾 GUARDAR MIS ${selecciones.length} PRONÓSTICOS`}
          </button>
        )}

        {abiertos.length === 0 && !miVoto && (
          <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.4)",
            textAlign:"center", marginTop:"10px", lineHeight:2 }}>
            Todos los partidos están cerrados.
          </p>
        )}
      </div>

      {/* Overlay confirmación */}
      {guardadoOk && (
        <div style={{ position:"fixed", inset:0, zIndex:900,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(0,0,0,0.8)" }}>
          <div style={{ background:"#1a0030", border:"4px solid #a78bfa",
            padding:"28px 24px", textAlign:"center",
            boxShadow:"0 0 40px rgba(167,139,250,0.6)", maxWidth:"280px" }}>
            <p style={{ fontSize:"32px", marginBottom:"12px" }}>✅</p>
            <p style={{ fontSize:"9px", color:"#c4b5fd", lineHeight:2 }}>¡PRONÓSTICOS<br/>GUARDADOS!</p>
            <p style={{ fontSize:"5px", color:"rgba(255,255,255,0.5)",
              lineHeight:2, marginTop:"8px" }}>
              Puedes editarlos hasta que empiece cada partido.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
