// src/components/AdminSemifinal.jsx
import React, { useState, useEffect } from "react";
import {
  doc, onSnapshot, setDoc, updateDoc,
  collection, getDocs, writeBatch, increment,
} from "firebase/firestore";
import { db } from "../firebase";

const REF_CONFIG = () => doc(db, "semifinales", "config");
const REF_VOTOS  = () => collection(db, "semifinales_votos");

const TABLA = [0, 250, 500, 750, 1000];

const EQUIPOS = [
  { nombre:"Francia",    bandera:"🇫🇷" },
  { nombre:"Marruecos",  bandera:"🇲🇦" },
  { nombre:"España",     bandera:"🇪🇸" },
  { nombre:"Bélgica",    bandera:"🇧🇪" },
  { nombre:"Noruega",    bandera:"🇳🇴" },
  { nombre:"Inglaterra", bandera:"🇬🇧" },
  { nombre:"Argentina",  bandera:"🇦🇷" },
  { nombre:"Suiza",      bandera:"🇨🇭" },
];

const CRUCES = [
  { local:{ nombre:"Francia",   bandera:"🇫🇷" }, visitante:{ nombre:"Marruecos",  bandera:"🇲🇦" } },
  { local:{ nombre:"España",    bandera:"🇪🇸" }, visitante:{ nombre:"Bélgica",    bandera:"🇧🇪" } },
  { local:{ nombre:"Noruega",   bandera:"🇳🇴" }, visitante:{ nombre:"Inglaterra", bandera:"🇬🇧" } },
  { local:{ nombre:"Argentina", bandera:"🇦🇷" }, visitante:{ nombre:"Suiza",      bandera:"🇨🇭" } },
];

const partidosFrescos = () => CRUCES.map((c,i) => ({
  id: `semi_${i+1}`,
  local:     c.local,
  visitante: c.visitante,
  fecha:     "",
  cerrado:   false,
}));

export default function AdminSemifinal({ onMensaje }) {
  const [config,     setConfig]     = useState(null);
  const [cargando,   setCargando]   = useState(true);
  const [guardando,  setGuardando]  = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [partidos,   setPartidos]   = useState(partidosFrescos());
  const [clasificados, setClasificados] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(REF_CONFIG(), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setConfig(d);
        if (d.partidos?.length > 0) setPartidos(d.partidos);
        setClasificados(d.clasificados || []);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const setEquipo = (i, lado, nombre) => {
    const eq = EQUIPOS.find(e => e.nombre === nombre) || { nombre, bandera:"🏳️" };
    setPartidos(prev => prev.map((p,idx) => idx!==i ? p : { ...p, [lado]:eq }));
  };

  const guardar = async (activo) => {
    setGuardando(true);
    try {
      await setDoc(REF_CONFIG(), {
        activo:      activo ?? config?.activo ?? true,
        partidos,
        clasificados,
      });
      onMensaje("ok", `✅ ${activo ? "Activado" : "Guardado"}.`);
    } catch(e) { onMensaje("error", e.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async () => {
    try {
      await updateDoc(REF_CONFIG(), { activo: !config?.activo });
    } catch(e) { onMensaje("error", e.message); }
  };

  const cerrarPartido = async (i) => {
    const nuevos = partidos.map((p,idx) => idx===i ? {...p,cerrado:true} : p);
    setPartidos(nuevos);
    try { await updateDoc(REF_CONFIG(), { partidos: nuevos }); }
    catch(e) { onMensaje("error", e.message); }
  };

  const toggleClas = (nombre) => setClasificados(prev =>
    prev.includes(nombre) ? prev.filter(n=>n!==nombre)
      : prev.length < 4 ? [...prev,nombre] : prev
  );

  const calcular = async () => {
    if (clasificados.length !== 4) { onMensaje("error","Selecciona exactamente 4."); return; }
    setCalculando(true);
    try {
      await updateDoc(REF_CONFIG(), { clasificados });
      const snapV = await getDocs(REF_VOTOS());
      const batch = writeBatch(db);
      let n = 0;
      snapV.docs.forEach(d => {
        const v = d.data();
        if (v.calculado) return;
        const aciertos = (v.selecciones||[]).filter(s=>clasificados.includes(s)).length;
        const pts = TABLA[aciertos]||0;
        batch.update(d.ref, { calculado:true, puntos:pts, aciertos });
        if (pts>0) batch.update(doc(db,"usuarios",v.uid),{ puntosTotal:increment(pts) });
        n++;
      });
      await batch.commit();
      onMensaje("ok", `✅ ${n} usuario(s) procesados.`);
    } catch(e) { onMensaje("error", e.message); }
    finally { setCalculando(false); }
  };

  if (cargando) return <p style={{ fontSize:"6px", color:"var(--gris-claro)", padding:"16px" }}>⚙ Cargando...</p>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

      {/* Estado */}
      <div style={{ padding:"10px", border:"2px solid #6d28d9", background:"rgba(109,40,217,0.08)" }}>
        <p style={{ fontSize:"7px", color:"#c4b5fd", marginBottom:"6px" }}>⚽ SEMIFINALES</p>
        <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"8px" }}>
          Estado: {config?.activo
            ? <span style={{ color:"var(--verde-claro)" }}>ACTIVO</span>
            : <span style={{ color:"var(--gris)" }}>INACTIVO</span>}
        </p>
        {config && (
          <button className={`btn-pixel ${config.activo?"btn-gris":"btn-rojo"}`}
            style={{ fontSize:"6px" }} onClick={toggleActivo}>
            {config.activo ? "DESACTIVAR" : "ACTIVAR"}
          </button>
        )}
      </div>

      {/* Partidos */}
      <div style={{ border:"2px solid rgba(255,255,255,0.1)", padding:"12px" }}>
        <p style={{ fontSize:"7px", color:"var(--amarillo)", marginBottom:"12px" }}>⚙ LOS 4 PARTIDOS</p>
        {partidos.map((p,i) => (
          <div key={p.id} style={{ marginBottom:"10px", padding:"10px",
            border:`1px solid ${p.cerrado?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.1)"}`,
            background:p.cerrado?"rgba(248,113,113,0.05)":"rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
              <p style={{ fontSize:"6px", color:"var(--amarillo)" }}>PARTIDO {i+1}</p>
              {!p.cerrado
                ? <button onClick={() => cerrarPartido(i)}
                    style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                      padding:"3px 7px", cursor:"pointer",
                      border:"1px solid var(--rojo-chile)", background:"transparent",
                      color:"var(--rojo-chile)" }}>🔒 CERRAR</button>
                : <span style={{ fontSize:"5px", color:"#f87171" }}>🔒 CERRADO</span>}
            </div>
            <div style={{ display:"flex", gap:"6px", marginBottom:"6px" }}>
              {["local","visitante"].map(lado => (
                <select key={lado} value={p[lado].nombre}
                  onChange={e => setEquipo(i,lado,e.target.value)}
                  disabled={p.cerrado}
                  style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                    flex:1, padding:"4px", border:"1px solid var(--negro)",
                    background:"var(--blanco)", color:"var(--negro)", outline:"none" }}>
                  <option value="">— {lado==="local"?"Local":"Visitante"} —</option>
                  {EQUIPOS.map(e => <option key={e.nombre} value={e.nombre}>{e.bandera} {e.nombre}</option>)}
                </select>
              ))}
            </div>
            <input type="date" value={p.fecha} disabled={p.cerrado}
              onChange={e => setPartidos(prev => prev.map((x,idx) => idx===i?{...x,fecha:e.target.value}:x))}
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                width:"100%", padding:"4px 6px", border:"1px solid var(--negro)",
                background:p.cerrado?"rgba(0,0,0,0.3)":"var(--blanco)",
                color:p.cerrado?"var(--gris-claro)":"var(--negro)", outline:"none" }} />
          </div>
        ))}
        <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
          onClick={() => guardar(true)} disabled={guardando}>
          {guardando ? "⚙ GUARDANDO..." : "💾 GUARDAR Y ACTIVAR"}
        </button>
      </div>

      {/* Confirmar semifinalistas */}
      <div style={{ border:"2px solid var(--verde-campo)", padding:"12px" }}>
        <p style={{ fontSize:"7px", color:"var(--verde-claro)", marginBottom:"4px" }}>
          ✅ CONFIRMAR 4 SEMIFINALISTAS
        </p>
        <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginBottom:"10px", lineHeight:2 }}>
          ({clasificados.length}/4 seleccionados)
        </p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"12px" }}>
          {EQUIPOS.map(e => (
            <button key={e.nombre} onClick={() => toggleClas(e.nombre)}
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                padding:"4px 8px", cursor:"pointer",
                border:`2px solid ${clasificados.includes(e.nombre)?"var(--verde-claro)":"rgba(255,255,255,0.15)"}`,
                background:clasificados.includes(e.nombre)?"rgba(52,211,153,0.15)":"rgba(0,0,0,0.3)",
                color:"var(--blanco)" }}>
              {e.bandera} {e.nombre}
            </button>
          ))}
        </div>
        <button className="btn-pixel btn-rojo w-full" style={{ fontSize:"7px" }}
          onClick={calcular}
          disabled={clasificados.length!==4||calculando}>
          {calculando?"⚙ CALCULANDO..."
            :clasificados.length!==4?`⚠ FALTAN ${4-clasificados.length} EQUIPOS`
            :"⚡ CONFIRMAR Y CALCULAR PUNTOS"}
        </button>
      </div>
    </div>
  );
}
