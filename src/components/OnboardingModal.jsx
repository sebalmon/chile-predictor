// src/components/OnboardingModal.jsx  — v7 (Patch 4)
// ─────────────────────────────────────────────────────────────
// TUTORIAL ACTUALIZADO:
//   Paso 0: Bienvenida
//   Paso 1: Cómo predecir (fase eliminatoria / muere-muere)
//   Paso 2: Sistema de puntos muere-muere (ya no hay grupos)
//   Paso 3: Podio y ranking diario
//   Paso 4: Cartas multiplicadoras
//   Paso 5: Láminas coleccionables
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const LOCAL_KEY = "cp8b_onboarding_visto_v7";

function FilaPts({ pts, desc, color = "var(--amarillo)" }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"5px 8px", border:"1px solid var(--verde-campo)",
      fontSize:"6px", background:"rgba(0,0,0,0.3)" }}>
      <span style={{ color:"var(--gris-claro)", lineHeight:1.8, flex:1 }}>{desc}</span>
      <span style={{ color, fontWeight:"bold", marginLeft:"8px",
        background:`rgba(${color==="var(--amarillo)"?"244,208,63":"82,183,136"},0.1)`,
        padding:"1px 6px", border:`1px solid ${color}`, whiteSpace:"nowrap" }}>{pts}</span>
    </div>
  );
}

export default function OnboardingModal({ isOpen, onClose }) {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [paso,    setPaso]    = useState(0);

  const esControlado  = isOpen !== undefined;
  const mostrarModal  = esControlado ? isOpen : visible;

  useEffect(() => {
    if (esControlado) { if (isOpen) setPaso(0); return; }
    const yaVioLocal     = localStorage.getItem(LOCAL_KEY);
    const yaVioFirestore = userProfile?.onboardingVisto;
    if (!yaVioLocal && !yaVioFirestore) {
      const t = setTimeout(() => { setPaso(0); setVisible(true); }, 600);
      return () => clearTimeout(t);
    }
  }, [userProfile, isOpen, esControlado]);

  const handleCerrar = async () => {
    if (esControlado) { if (onClose) onClose(); return; }
    setVisible(false);
    localStorage.setItem(LOCAL_KEY, "1");
    if (firebaseUser) {
      try {
        await updateDoc(doc(db,"usuarios",firebaseUser.uid), { onboardingVisto:true });
      } catch(_) {}
    }
  };

  if (!mostrarModal) return null;

  const pasos = [
    // ── 0. Bienvenida ─────────────────────────────────────
    {
      icono: "⚽",
      titulo: "¡BIENVENIDO!",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            <span style={{ color:"var(--amarillo)" }}>International Superstar Polla</span> es
            una competencia de pronósticos del{" "}
            <span style={{ color:"var(--verde-claro)" }}>Mundial 2026</span>.
            Pronostica partidos, acumula puntos y sube al ranking.
          </p>
          <div style={{ marginTop:"12px", padding:"10px",
            border:"2px solid var(--verde-campo)", background:"rgba(82,183,136,0.08)" }}>
            <p style={{ fontSize:"6px", color:"var(--verde-claro)", marginBottom:"6px" }}>🗂 PESTAÑAS:</p>
            <div style={{ fontSize:"6px", color:"var(--gris-claro)", lineHeight:2.2 }}>
              <p>🏠 <span style={{ color:"var(--blanco)" }}>INICIO</span> — Podio, mensajes y tabla de puntos</p>
              <p>⚽ <span style={{ color:"var(--blanco)" }}>PARTIDOS</span> — Pronósticos del día y pregunta</p>
              <p>📊 <span style={{ color:"var(--blanco)" }}>RANKING</span> — Tabla completa de posiciones</p>
              <p>🖼️ <span style={{ color:"var(--blanco)" }}>LÁMINAS</span> — Colección y sobre diario</p>
              <p>👤 <span style={{ color:"var(--blanco)" }}>PERFIL</span> — Cartas y estadísticas</p>
            </div>
          </div>
        </>
      ),
    },

    // ── 1. Cómo predecir ──────────────────────────────────
    {
      icono: "💀",
      titulo: "CÓMO PREDECIR",
      color: "var(--rojo-chile)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2, marginBottom:"10px" }}>
            Estamos en <span style={{ color:"var(--rojo-chile)" }}>fase eliminatoria</span>.
            Cada partido puede decidirse en 90 minutos, alargue o penales.
            Elige cómo crees que se define cada partido.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <div style={{ padding:"8px", border:"2px solid var(--gris)", background:"rgba(0,0,0,0.3)" }}>
              <p style={{ fontSize:"6px", color:"var(--amarillo)", marginBottom:"4px" }}>⚽ 90 MIN</p>
              <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:2 }}>
                Predice quién gana y por cuánto (1 gol o 2+).
              </p>
            </div>
            <div style={{ padding:"8px", border:"2px solid var(--gris)", background:"rgba(0,0,0,0.3)" }}>
              <p style={{ fontSize:"6px", color:"var(--amarillo)", marginBottom:"4px" }}>⏱ ALARGUE</p>
              <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:2 }}>
                Si empatan en 90 min y va a alargue. Predice quién gana en el alargue y diferencia.
              </p>
            </div>
            <div style={{ padding:"8px", border:"2px solid var(--gris)", background:"rgba(0,0,0,0.3)" }}>
              <p style={{ fontSize:"6px", color:"var(--amarillo)", marginBottom:"4px" }}>🎯 PENALES</p>
              <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:2 }}>
                Si empatan en alargue y va a penales. Predice quién gana y la diferencia exacta de la tanda.
              </p>
            </div>
          </div>
          <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginTop:"8px", lineHeight:2 }}>
            ⚠ Tienes hasta el inicio del partido para guardar tu pronóstico.
          </p>
        </>
      ),
    },

    // ── 2. Sistema de puntos ──────────────────────────────
    {
      icono: "🔢",
      titulo: "SISTEMA DE PUNTOS FASE MUERE MUERE",
      color: "var(--rojo-chile)",
      contenido: (
        <>
          <p style={{ lineHeight:2, marginBottom:"8px", fontSize:"6px" }}>
            Todos los puntos <span style={{ color:"var(--amarillo)" }}>aumentaron</span> en
            fase eliminatoria. Cuanto más exacto tu pronóstico, más puntos.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
            <FilaPts pts="+4/8/16/24"  desc="Ganador en 90 min (sube por fase)" color="var(--rojo-chile)" />
            <FilaPts pts="+6/12/24/36" desc="Ganador + diferencia 90 min" color="var(--rojo-chile)" />
            <FilaPts pts="+6/12/24/36" desc="Acertar que va a Alargue" color="var(--rojo-chile)" />
            <FilaPts pts="+12/24/48/72" desc="Alargue + diferencia exacta" color="var(--rojo-chile)" />
            <FilaPts pts="+6/12/24/36" desc="Acertar que va a Penales" color="var(--rojo-chile)" />
            <FilaPts pts="+10/20/40/60" desc="Penales + quién gana la tanda" color="var(--rojo-chile)" />
            <FilaPts pts="+14/28/56/84" desc="Penales + diferencia exacta" color="var(--rojo-chile)" />
            <FilaPts pts="+2"  desc="Pregunta del día correcta" />
            <FilaPts pts="+2"  desc="Ganador del día (bonus diario)" color="var(--verde-claro)" />
          </div>
        </>
      ),
    },

    // ── 3. Podio y ranking ────────────────────────────────
    {
      icono: "🏆",
      titulo: "PODIO Y RANKING",
      color: "var(--amarillo)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            Cada día hay un <span style={{ color:"var(--amarillo)" }}>ganador del día</span>:
            quien acumule más puntos en esa jornada recibe{" "}
            <span style={{ color:"var(--verde-claro)" }}>+2 pts bonus</span> y una{" "}
            <span style={{ color:"var(--amarillo)" }}>carta ×4</span>.
          </p>
          <div style={{ marginTop:"10px", padding:"10px",
            border:"2px solid var(--amarillo)", background:"rgba(244,208,63,0.06)",
            display:"flex", flexDirection:"column", gap:"6px" }}>
            <p style={{ fontSize:"6px", color:"var(--amarillo)", lineHeight:2 }}>
              🥇 1° del día → carta <strong>×4</strong> + <strong>+2 pts</strong>
            </p>
            <p style={{ fontSize:"6px", color:"var(--gris-claro)", lineHeight:2 }}>
              🥈 2° del día → carta <strong>×3</strong>
            </p>
            <p style={{ fontSize:"6px", color:"var(--gris-claro)", lineHeight:2 }}>
              🥉 3° del día → carta <strong>×2</strong>
            </p>
          </div>
          <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginTop:"8px", lineHeight:2 }}>
            En el RANKING puedes ver las flechas ▲▼ que indican cuántos puestos
            subiste o bajaste respecto al día anterior.
          </p>
        </>
      ),
    },

    // ── 4. Cartas multiplicadoras ─────────────────────────
    {
      icono: "🃏",
      titulo: "CARTAS MULTIPLICADORAS",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2, marginBottom:"10px" }}>
            Las cartas <span style={{ color:"var(--amarillo)" }}>multiplican tus puntos</span> en
            un partido. Úsalas estratégicamente en los partidos donde más confías.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:"5px", marginBottom:"10px" }}>
            {[
              { mult:"×2", desc:"Duplica los puntos del partido", color:"#4ade80" },
              { mult:"×3", desc:"Triplica los puntos del partido", color:"var(--amarillo)" },
              { mult:"×4", desc:"Cuadruplica los puntos del partido", color:"var(--rojo-chile)" },
            ].map((c,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:"6px 8px",
                border:`1px solid ${c.color}`, background:"rgba(0,0,0,0.3)" }}>
                <span style={{ fontSize:"6px", color:"var(--gris-claro)" }}>{c.desc}</span>
                <span style={{ fontSize:"12px", fontWeight:"bold", color:c.color }}>{c.mult}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:"5px", color:"var(--gris-claro)", lineHeight:2 }}>
            💡 La carta se consume al procesar el resultado, aunque no hayas acertado.
          </p>
        </>
      ),
    },

    // ── 5. Láminas ────────────────────────────────────────
    {
      icono: "🖼️",
      titulo: "LÁMINAS COLECCIONABLES",
      color: "var(--amarillo)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            Cada día recibes un{" "}
            <span style={{ color:"var(--amarillo)" }}>sobre de láminas</span> en la
            pestaña 🖼️ LÁMINAS. Ábrelo y da vuelta cada lámina para revelarla.
          </p>
          <div style={{ marginTop:"10px", display:"flex", flexDirection:"column", gap:"8px" }}>
            <p style={{ fontSize:"6px", color:"var(--verde-claro)", lineHeight:2 }}>
              📦 <strong style={{ color:"var(--blanco)" }}>SOBRE DIARIO:</strong>{" "}
              4 láminas por día. Mejor ranking → mejores cartas extra.
            </p>
            <p style={{ fontSize:"6px", color:"var(--verde-claro)", lineHeight:2 }}>
              📚 <strong style={{ color:"var(--blanco)" }}>COLECCIÓN:</strong>{" "}
              Las láminas se organizan por categoría. Completa una categoría entera
              y reclama <span style={{ color:"var(--amarillo)" }}>2 cartas multiplicadoras</span> de regalo.
            </p>
          </div>
        </>
      ),
    },
  ];

  const esUltimo   = paso === pasos.length - 1;
  const pasActual  = pasos[paso];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)",
      zIndex:900, display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px", overflowY:"auto" }}>
      <div style={{ background:"var(--negro)", border:`4px solid ${pasActual.color}`,
        boxShadow:`6px 6px 0 ${pasActual.color}44`,
        padding:"24px 20px 20px", maxWidth:"400px", width:"100%",
        display:"flex", flexDirection:"column", gap:"16px",
        maxHeight:"88vh", overflowY:"auto" }}>

        {/* Puntos de progreso */}
        <div style={{ display:"flex", justifyContent:"center", gap:"6px" }}>
          {pasos.map((_,i) => (
            <div key={i} style={{
              width: i===paso ? "16px" : "8px", height:"8px",
              background: i<=paso ? pasActual.color : "var(--gris)",
              border:`1px solid ${i<=paso?pasActual.color:"var(--gris)"}`,
              transition:"width 0.2s",
            }} />
          ))}
        </div>

        {/* Icono + título */}
        <div style={{ textAlign:"center" }}>
          <span style={{ fontSize:"32px" }}>{pasActual.icono}</span>
          <h2 style={{ color:pasActual.color, marginTop:"8px", fontSize:"10px" }}>
            {pasActual.titulo}
          </h2>
        </div>

        {/* Contenido */}
        <div style={{ fontSize:"7px", color:"var(--blanco)", lineHeight:2, flex:1 }}>
          {pasActual.contenido}
        </div>

        {/* Navegación */}
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {!esUltimo ? (
            <button className="btn-pixel btn-amarillo w-full" style={{ fontSize:"8px" }}
              onClick={() => setPaso(p=>p+1)}>
              SIGUIENTE →
            </button>
          ) : (
            <button className="btn-pixel btn-amarillo w-full" style={{ fontSize:"8px" }}
              onClick={handleCerrar}>
              {esControlado ? "✕ CERRAR" : "✅ ¡ENTENDIDO! JUGAR"}
            </button>
          )}
          {paso > 0 && (
            <button onClick={() => setPaso(p=>p-1)}
              style={{ background:"none", border:"none", color:"var(--gris)",
                fontSize:"6px", fontFamily:"'Press Start 2P',monospace",
                cursor:"pointer", textAlign:"center" }}>
              ← anterior
            </button>
          )}
          {!esUltimo && (
            <button onClick={handleCerrar}
              style={{ background:"none", border:"none", color:"var(--gris)",
                fontSize:"6px", fontFamily:"'Press Start 2P',monospace",
                cursor:"pointer", textAlign:"center" }}>
              {esControlado ? "Cerrar ✕" : "Saltar intro →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
