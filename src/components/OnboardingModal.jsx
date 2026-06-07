import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// Clave en localStorage para saber si ya vio el onboarding
// (Complementado con flag en Firestore para persistencia cross-device)
const LOCAL_KEY = "cp8b_onboarding_visto";

export default function OnboardingModal() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    // Mostrar si el usuario NO ha visto el onboarding todavía
    const yaVioLocal = localStorage.getItem(LOCAL_KEY);
    const yaVioFirestore = userProfile?.onboardingVisto;

    if (!yaVioLocal && !yaVioFirestore) {
      // Pequeño delay para que la UI cargue primero
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [userProfile]);

  const handleCerrar = async () => {
    setVisible(false);
    localStorage.setItem(LOCAL_KEY, "1");
    // Marcar en Firestore para persistencia en otros dispositivos
    if (firebaseUser) {
      try {
        await updateDoc(doc(db, "usuarios", firebaseUser.uid), {
          onboardingVisto: true,
        });
        await refreshProfile();
      } catch (e) {
        // No crítico si falla
      }
    }
  };

  if (!visible) return null;

  const pasos = [
    {
      icono: "⚽",
      titulo: "¡BIENVENIDO!",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            <span style={{ color: "var(--amarillo)" }}>Chile Predictor 8-Bit</span> es un
            sistema de ranking por puntos. Pronostica los partidos diarios mediante
            3 formatos de apuesta y escala en la tabla de posiciones.
          </p>
          <div style={{ marginTop: "12px", padding: "10px", border: "2px solid var(--verde-campo)", background: "rgba(82,183,136,0.1)" }}>
            <p style={{ fontSize: "6px", color: "var(--verde-claro)" }}>📊 FORMATO DE APUESTAS:</p>
            <p style={{ marginTop: "6px", fontSize: "6px", color: "var(--gris-claro)", lineHeight: 2 }}>
              🟢 Ganador del partido (1-2 pts)<br/>
              🟡 Marcador exacto en partidos destacados (3 pts)<br/>
              🔴 Alargues y penales en fases finales (hasta 4 pts)
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
            ¡A partir de los <span style={{ color: "var(--rojo-chile)" }}>Dieciseisavos de Final</span> los
            partidos son a muere-muere! Las predicciones incluyen <span style={{ color: "var(--amarillo)" }}>Alargues</span> y{" "}
            <span style={{ color: "var(--amarillo)" }}>Penales</span>, otorgando puntajes mucho más elevados.
          </p>
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              { label: "Acertar ganador (90 min)", pts: "+2 pts" },
              { label: "Ganador + diferencia (90 min)", pts: "+3 pts" },
              { label: "Acertar Alargue + diferencia", pts: "+3 pts" },
              { label: "Acertar Penales + ganador tanda", pts: "+3 pts" },
              { label: "Penales + diferencia exacta tanda", pts: "+4 pts" },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 8px", border: "1px solid var(--verde-campo)",
                fontSize: "6px", background: "rgba(0,0,0,0.3)",
              }}>
                <span style={{ color: "var(--gris-claro)" }}>{item.label}</span>
                <span style={{ color: "var(--amarillo)" }}>{item.pts}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      icono: "❓",
      titulo: "TRIVIA DIARIA",
      color: "var(--amarillo)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            Cada día hay una <span style={{ color: "var(--amarillo)" }}>Pregunta del Día</span> disponible
            hasta el cierre de las predicciones. Responderla correctamente te entrega{" "}
            <span style={{ color: "var(--verde-claro)" }}>+2 puntos cruciales</span> que pueden
            definir el ranking.
          </p>
          <div style={{
            marginTop: "14px", padding: "12px",
            border: "2px solid var(--amarillo)", background: "rgba(244,208,63,0.08)",
            textAlign: "center",
          }}>
            <span style={{ fontSize: "24px" }}>💡</span>
            <p style={{ marginTop: "8px", fontSize: "6px", color: "var(--amarillo)", lineHeight: 2 }}>
              No olvides responder ANTES de que<br/>
              cierren las votaciones del día.<br/>
              ¡Los puntos no se recuperan!
            </p>
          </div>
        </>
      ),
    },
    {
      icono: "🃏",
      titulo: "CARTAS Y PODIO",
      color: "var(--amarillo)",
      contenido: (
        <>
          <p style={{ lineHeight: 2.2 }}>
            Los <span style={{ color: "var(--amarillo)" }}>3 mejores jugadores del día</span> suben
            al podio diario y reciben <span style={{ color: "var(--verde-claro)" }}>Cartas Coleccionables</span>{" "}
            únicas como premio. ¡Además, el ganador del día obtiene{" "}
            <span style={{ color: "var(--rojo-chile)" }}>+3 puntos extra</span>!
          </p>
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { emoji: "⚽🔮", label: "Cartas Comunes (x2)", color: "var(--verde-claro)", desc: "Podio 2° y 3° lugar" },
              { emoji: "👑🔥", label: "Cartas Raras (x3)", color: "var(--amarillo)", desc: "Podio 1° lugar" },
              { emoji: "🏆⭐", label: "Cartas Legendarias (x4)", color: "var(--rojo-chile)", desc: "Logros especiales" },
            ].map((c, i) => (
              <div key={i} style={{
                padding: "8px 10px", border: `2px solid ${c.color}`,
                background: "rgba(0,0,0,0.3)", display: "flex",
                justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <span style={{ fontSize: "7px", color: c.color }}>{c.emoji} {c.label}</span>
                  <p style={{ fontSize: "5px", color: "var(--gris-claro)", marginTop: "3px" }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: "10px", fontSize: "6px", color: "var(--gris-claro)", lineHeight: 2 }}>
            Adjunta cartas a tus predicciones favoritas para{" "}
            <span style={{ color: "var(--amarillo)" }}>multiplicar tus puntos</span> si aciertas todo.
          </p>
        </>
      ),
    },
  ];

  const pasoActual = pasos[paso];
  const esUltimo = paso === pasos.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "var(--negro)",
        border: `4px solid ${pasoActual.color}`,
        boxShadow: `6px 6px 0 ${pasoActual.color}44`,
        padding: "24px 20px",
        maxWidth: "400px",
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}>
        {/* Encabezado */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>{pasoActual.icono}</div>
          <h2 style={{ color: pasoActual.color, fontSize: "11px" }}>{pasoActual.titulo}</h2>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
          {pasos.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === paso ? "20px" : "8px",
                height: "8px",
                background: i === paso ? pasoActual.color : "var(--gris)",
                border: "2px solid var(--negro)",
                transition: "width 0.2s",
              }}
            />
          ))}
        </div>

        {/* Contenido */}
        <div style={{ fontSize: "7px", color: "var(--blanco)", lineHeight: 2 }}>
          {pasoActual.contenido}
        </div>

        {/* Botones de navegación */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          {paso > 0 && (
            <button
              className="btn-pixel btn-gris"
              style={{ fontSize: "7px", flex: "0 0 auto" }}
              onClick={() => setPaso((p) => p - 1)}
            >
              ← ATRÁS
            </button>
          )}
          {!esUltimo ? (
            <button
              className="btn-pixel btn-verde w-full"
              style={{ fontSize: "7px" }}
              onClick={() => setPaso((p) => p + 1)}
            >
              SIGUIENTE →
            </button>
          ) : (
            <button
              className="btn-pixel btn-amarillo w-full"
              style={{ fontSize: "8px" }}
              onClick={handleCerrar}
            >
              ✅ ¡ENTENDIDO! JUGAR
            </button>
          )}
        </div>

        {/* Skip */}
        {!esUltimo && (
          <button
            onClick={handleCerrar}
            style={{
              background: "none",
              border: "none",
              color: "var(--gris)",
              fontSize: "6px",
              fontFamily: "'Press Start 2P', monospace",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Saltar intro →
          </button>
        )}
      </div>
    </div>
  );
}
