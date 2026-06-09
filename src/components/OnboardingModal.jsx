// src/components/OnboardingModal.jsx  — v3 (Modificado)
import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const LOCAL_KEY = "cp8b_onboarding_visto";

export default function OnboardingModal({ isOpen, onClose }) {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [paso, setPaso]       = useState(0);

  // Modo controlado (Botón manual) vs Modo automático (Primera vez)
  const esControlado = isOpen !== undefined;
  const mostrarModal = esControlado ? isOpen : visible;

  useEffect(() => {
    // Si es controlado externamente, reiniciamos el paso al abrirse y no evaluamos el auto-open
    if (esControlado) {
      if (isOpen) setPaso(0);
      return;
    }

    const yaVioLocal     = localStorage.getItem(LOCAL_KEY);
    const yaVioFirestore = userProfile?.onboardingVisto;
    if (!yaVioLocal && !yaVioFirestore) {
      const t = setTimeout(() => {
        setPaso(0);
        setVisible(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [userProfile, isOpen, esControlado]);

  const handleCerrar = async () => {
    if (esControlado) {
      if (onClose) onClose();
      return;
    }

    // Comportamiento automático la primera vez
    setVisible(false);
    localStorage.setItem(LOCAL_KEY, "1");
    if (firebaseUser) {
      try {
        await updateDoc(doc(db, "usuarios", firebaseUser.uid), { onboardingVisto: true });
        await refreshProfile();
      } catch(_) {}
    }
  };

  if (!mostrarModal) return null;

  const pasos = [
    {
      icono: "⚽",
      titulo: "¡BIENVENIDO!",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            <span style={{ color: "var(--amarillo)" }}>International Superstar Polla</span> es
            un sistema de ranking por puntos. Pronostica los partidos del Mundial 2026
            y escala en la tabla de posiciones.
          </p>
          <div style={{ marginTop: "12px", padding: "10px",
            border: "2px solid var(--verde-campo)", background: "rgba(82,183,136,0.1)" }}>
            <p style={{ fontSize: "6px", color: "var(--verde-claro)" }}>🗂 PESTAÑAS DE LA APP:</p>
            <div style={{ marginTop: "6px", fontSize: "6px",
              color: "var(--gris-claro)", lineHeight: 2 }}>
              <p>🏠 <span style={{ color: "var(--blanco)" }}>INICIO</span> — Podio, ranking y puntuación</p>
              <p>⚽ <span style={{ color: "var(--blanco)" }}>PARTIDOS</span> — Tus pronósticos del día</p>
              <p>📊 <span style={{ color: "var(--blanco)" }}>RANKING</span> — Tabla completa</p>
              <p>👤 <span style={{ color: "var(--blanco)" }}>PERFIL</span> — Tus cartas y estadísticas</p>
            </div>
          </div>
        </>
      ),
    },
    {
      icono: "🔮",
      titulo: "CÓMO PREDECIR",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            En la pestaña <span style={{ color: "var(--amarillo)" }}>PARTIDOS</span> encontrarás
            todos los encuentros del día. Tienes hasta <span style={{ color: "var(--rojo-chile)" }}>
            1 segundo antes</span> del inicio de cada partido para guardar tu pronóstico.
          </p>

          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              { pts: "+1 / +2", desc: "Acertar ganador y diferencia (grupos)" },
              { pts: "+3",      desc: "Resultado exacto en partido destacado ⭐" },
              { pts: "+2 / +4", desc: "Alargues y penales en fases finales" },
            ].map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                padding:"6px 8px", border:"1px solid var(--verde-campo)",
                fontSize:"6px", background:"rgba(0,0,0,0.3)" }}>
                <span style={{ color: "var(--gris-claro)" }}>{r.desc}</span>
                <span style={{ color: "var(--amarillo)" }}>{r.pts}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "6px", color: "var(--verde-claro)", marginTop: "12px", lineHeight: 2 }}>
            💡 Cuando completes TODOS los pronósticos del día, aparecerá automáticamente
            la <span style={{ color: "var(--amarillo)" }}>Pregunta del Día</span> (+2 pts).
          </p>
        </>
      ),
    },
    {
      icono: "📅",
      titulo: "SISTEMA DE LA POLLA",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
            <p style={{ fontSize: "6.5px", lineHeight: 2, margin: 0 }}>
              📅 <span style={{ color: "var(--amarillo)" }}>Pronósticos diarios:</span> Esta polla se juega día a día. No se pueden ingresar todos los resultados del Mundial a la vez; se habilitan solo los partidos de la jornada en curso.
            </p>
            <p style={{ fontSize: "6.5px", lineHeight: 2, margin: 0 }}>
              ❌ <span style={{ color: "var(--gris-claro)" }}>Si olvidas un día:</span> No te preocupes, no quedas eliminado. Sigues participando activamente con tu puntaje acumulado, pero no sumarás puntos por esa jornada en blanco.
            </p>
            <p style={{ fontSize: "6.5px", lineHeight: 2, margin: 0 }}>
              🏆 <span style={{ color: "var(--verde-claro)" }}>Ranking continuo:</span> Esta es una competencia continua por puntos hasta el final del mundial. No hay cortes drásticos: acumulas todo el puntaje posible hasta el final del Mundial para ganar.
            </p>
          </div>
        </>
      ),
    },
    {
      icono: "💀",
      titulo: "FASES FINALES",
      color: "var(--rojo-chile)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            Desde los <span style={{ color: "var(--rojo-chile)" }}>Dieciseisavos</span> en
            adelante los partidos son a <strong>muere-muere</strong>. Además de predecir al
            ganador, puedes apostar por <span style={{ color: "var(--amarillo)" }}>Alargue</span> o{" "}
            <span style={{ color: "var(--amarillo)" }}>Penales</span> para ganar más puntos.
          </p>
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {[
              { pts:"+2", desc:"Acertar ganador en 90 min" },
              { pts:"+3", desc:"Ganador + diferencia en 90 min" },
              { pts:"+2", desc:"Acertar que se define en Alargue" },
              { pts:"+3", desc:"Alargue + diferencia en el alargue" },
              { pts:"+2", desc:"Acertar que se define en Penales" },
              { pts:"+3", desc:"Penales + quién gana la tanda" },
              { pts:"+4", desc:"Penales + diferencia exacta de la tanda" },
              { pts:"+2", desc:"Pregunta del día correcta" },
              { pts:"+3", desc:"Ganador del día (más puntos)" },
            ].map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                padding:"5px 8px", border:"1px solid var(--verde-campo)",
                fontSize:"6px", background:"rgba(0,0,0,0.3)" }}>
                <span style={{ color:"var(--gris-claro)" }}>{r.desc}</span>
                <span style={{ color:"var(--amarillo)" }}>{r.pts}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      icono: "🏆",
      titulo: "EL PODIO Y EL RANKING",
      color: "var(--amarillo)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            Cada día se genera un <span style={{ color: "var(--amarillo)" }}>Podio</span> con los
            mejores jugadores de ese día. El <span style={{ color: "var(--amarillo)" }}>ganador del día</span>{" "}
            obtiene <span style={{ color: "var(--verde-claro)" }}>+3 puntos extra</span>.
          </p>
          <div style={{ marginTop: "12px", padding: "12px",
            border: "2px solid var(--amarillo)", background: "rgba(244,208,63,0.08)", textAlign:"center" }}>
            <span style={{ fontSize: "24px" }}>🥇🥈🥉</span>
            <p style={{ marginTop: "8px", fontSize: "6px", color: "var(--amarillo)", lineHeight: 2 }}>
              Si empatas en puntaje con otros jugadores,<br/>
              compartes el mismo escalón del podio.<br/>
              ¡Todos reciben carta!
            </p>
          </div>
          <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginTop: "10px", lineHeight: 2 }}>
            Ve a la pestaña <span style={{ color: "var(--blanco)" }}>INICIO</span> para ver
            el podio del día anterior y el ranking general actualizado.
          </p>
        </>
      ),
    },
    {
      icono: "🃏",
      titulo: "CARTAS COLECCIONABLES",
      color: "var(--amarillo)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            Todos <span style={{ color: "var(--amarillo)" }}>los que se suben al podio en el día</span> reciben
            Cartas Coleccionables como premio. Úsalas en tus partidos favoritos para
            <span style={{ color: "var(--verde-claro)" }}> multiplicar tus puntos</span>.
          </p>
          <div style={{ marginTop: "10px", display:"flex", flexDirection:"column", gap:"8px" }}>
            {[
              { em:"🏆⭐", label:"Legendarias (×4)", color:"var(--rojo-chile)", desc:"1° del podio del día" },
              { em:"👑🔥", label:"Raras (×3)",        color:"var(--amarillo)",  desc:"2° del podio del día" },
              { em:"⚽🔮", label:"Comunes (×2)",       color:"var(--verde-claro)", desc:"3° del podio del día" },
            ].map((c,i)=>(
              <div key={i} style={{ padding:"8px 10px", border:`2px solid ${c.color}`,
                background:"rgba(0,0,0,0.3)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <span style={{ fontSize:"7px", color:c.color }}>{c.em} {c.label}</span>
                  <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginTop:"3px" }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "6px", color:"var(--gris-claro)", marginTop:"10px", lineHeight: 2 }}>
            ✨ La carta multiplica tus puntos si aciertas <strong style={{color:"var(--amarillo)"}}>algo</strong> en
            el partido. Si no aciertas nada, la carta se consume igual. Las puedes ocupar en cualquier partido.
          </p>
        </>
      ),
    },
  ];

  const pasoActual = pasos[paso];
  const esUltimo   = paso === pasos.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div style={{
        background: "var(--negro)",
        border: `4px solid ${pasoActual.color}`,
        boxShadow: `6px 6px 0 ${pasoActual.color}44`,
        padding: "24px 20px", maxWidth: "400px", width: "100%",
        maxHeight: "90vh", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>{pasoActual.icono}</div>
          <h2 style={{ color: pasoActual.color, fontSize: "11px" }}>{pasoActual.titulo}</h2>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
          {pasos.map((_, i) => (
            <div key={i} style={{
              width: i === paso ? "20px" : "8px", height: "8px",
              background: i === paso ? pasoActual.color : "var(--gris)",
              border: "2px solid var(--negro)", transition: "width 0.2s",
            }} />
          ))}
        </div>

        {/* Contenido */}
        <div style={{ fontSize: "7px", color: "var(--blanco)", lineHeight: 2 }}>
          {pasoActual.contenido}
        </div>

        {/* Navegación */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          {paso > 0 && (
            <button className="btn-pixel btn-gris"
              style={{ fontSize: "7px", flex: "0 0 auto" }}
              onClick={() => setPaso((p) => p - 1)}>
              ← ATRÁS
            </button>
          )}
          {!esUltimo ? (
            <button className="btn-pixel btn-verde w-full"
              style={{ fontSize: "7px" }}
              onClick={() => setPaso((p) => p + 1)}>
              SIGUIENTE →
            </button>
          ) : (
            <button className="btn-pixel btn-amarillo w-full"
              style={{ fontSize: "8px" }}
              onClick={handleCerrar}>
              {esControlado ? "✕ CERRAR TUTORIAL" : "✅ ¡ENTENDIDO! JUGAR"}
            </button>
          )}
        </div>

        {!esUltimo && (
          <button onClick={handleCerrar} style={{
            background: "none", border: "none",
            color: "var(--gris)", fontSize: "6px",
            fontFamily: "'Press Start 2P', monospace",
            cursor: "pointer", textAlign: "center",
          }}>
            {esControlado ? "Cerrar tutorial ✕" : "Saltar intro →"}
          </button>
        )}
      </div>
    </div>
  );
}