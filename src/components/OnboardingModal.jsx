// src/components/OnboardingModal.jsx  — v6 (Fase 3)
// ─────────────────────────────────────────────────────────────
// REESCRITURA COMPLETA — refleja todas las novedades:
//   Paso 0: Bienvenida + pestañas de la app
//   Paso 1: Cómo predecir + nueva tabla de puntos (grupos)
//   Paso 2: Sistema de la polla (diario, ranking continuo)
//   Paso 3: Fases finales — nueva tabla muere-muere
//   Paso 4: El podio y el ranking (con flechas, carrusel)
//   Paso 5: Cartas coleccionables
//   Paso 6: Mensajes y notificaciones (La Voz, modal post-pronóstico, notifs)
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const LOCAL_KEY = "cp8b_onboarding_visto_v6";

function FilaPts({ pts, desc, color = "var(--amarillo)" }) {
  return (
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"5px 8px",border:"1px solid var(--verde-campo)",
      fontSize:"6px",background:"rgba(0,0,0,0.3)" }}>
      <span style={{ color:"var(--gris-claro)",lineHeight:1.8,flex:1 }}>{desc}</span>
      <span style={{ color,fontWeight:"bold",marginLeft:"8px",
        background:`rgba(${color==="var(--amarillo)"?"244,208,63":"82,183,136"},0.1)`,
        padding:"1px 6px",border:`1px solid ${color}`,whiteSpace:"nowrap" }}>{pts}</span>
    </div>
  );
}

export default function OnboardingModal({ isOpen, onClose }) {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [paso, setPaso]       = useState(0);

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
        await refreshProfile();
      } catch(_) {}
    }
  };

  if (!mostrarModal) return null;

  const pasos = [
    // ── 0. Bienvenida ───────────────────────────────────────
    {
      icono: "⚽",
      titulo: "¡BIENVENIDO!",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            <span style={{ color:"var(--amarillo)" }}>International Superstar Polla</span> es
            una competencia de pronósticos del <span style={{ color:"var(--verde-claro)" }}>Mundial 2026</span>.
            Pronostica partidos, acumula puntos y escala en el ranking.
          </p>
          <div style={{ marginTop:"12px",padding:"10px",
            border:"2px solid var(--verde-campo)",background:"rgba(82,183,136,0.1)" }}>
            <p style={{ fontSize:"6px",color:"var(--verde-claro)",marginBottom:"6px" }}>🗂 PESTAÑAS:</p>
            <div style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2.2 }}>
              <p>🏠 <span style={{ color:"var(--blanco)" }}>INICIO</span> — Podio, La Voz de la Hinchada y tabla de puntuación</p>
              <p>⚽ <span style={{ color:"var(--blanco)" }}>PARTIDOS</span> — Tus pronósticos del día + pregunta del día</p>
              <p>📊 <span style={{ color:"var(--blanco)" }}>RANKING</span> — Tabla completa con flechas de cambio ▲▼</p>
              <p>👤 <span style={{ color:"var(--blanco)" }}>PERFIL</span> — Cartas, historial y estadísticas</p>
            </div>
          </div>
        </>
      ),
    },

    // ── 1. Cómo predecir ────────────────────────────────────
    {
      icono: "🔮",
      titulo: "CÓMO PREDECIR",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            En la pestaña <span style={{ color:"var(--amarillo)" }}>PARTIDOS</span> encontrarás
            todos los encuentros del día. Tienes hasta{" "}
            <span style={{ color:"var(--rojo-chile)" }}>1 segundo antes</span> del inicio de cada
            partido para guardar tu pronóstico.{" "}
            <span style={{ color:"var(--verde-claro)" }}>El horario usa timestamps de Firestore</span>{" "}
            (universal, no depende del huso horario de tu dispositivo).
          </p>

          <p style={{ fontSize:"6px",color:"var(--amarillo)",margin:"10px 0 6px" }}>FASE DE GRUPOS</p>
          <div style={{ display:"flex",flexDirection:"column",gap:"4px" }}>
            <FilaPts pts="+1"  desc="Acertar ganador (partido normal)" />
            <FilaPts pts="+3"  desc="Ganador + diferencia de goles (1+2)" />
            <FilaPts pts="+2"  desc="Solo ganador (partido destacado ⭐)" />
            <FilaPts pts="+5"  desc="Resultado exacto (destacado ⭐) — 3+2" />
            <FilaPts pts="+2"  desc="Pregunta del día correcta" />
            <FilaPts pts="+2"  desc="Ganador del día (bonus diario)" color="var(--verde-claro)" />
          </div>

          <div style={{ marginTop:"10px",padding:"8px",
            border:"2px solid var(--verde-campo)",background:"rgba(82,183,136,0.08)" }}>
            <p style={{ fontSize:"6px",color:"var(--verde-claro)",lineHeight:2 }}>
              ❓ <strong style={{ color:"var(--blanco)" }}>Pregunta del día:</strong> está
              siempre visible en la pestaña PARTIDOS, junto a los partidos.
              No es necesario completar todos los pronósticos para verla.
              Aparece un sello <span style={{ color:"var(--verde-claro)" }}>✓ RESPONDIDA</span> cuando ya respondiste.
            </p>
          </div>
        </>
      ),
    },

    // ── 2. Sistema de la polla ───────────────────────────────
    {
      icono: "📅",
      titulo: "SISTEMA DE LA POLLA",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <div style={{ display:"flex",flexDirection:"column",gap:"10px",marginTop:"4px" }}>
            <p style={{ fontSize:"6.5px",lineHeight:2 }}>
              📅 <span style={{ color:"var(--amarillo)" }}>Pronósticos diarios:</span>{" "}
              Se habilitan solo los partidos de la jornada en curso. No puedes ingresar
              resultados de partidos futuros.
            </p>
            <p style={{ fontSize:"6.5px",lineHeight:2 }}>
              ⚡ <span style={{ color:"var(--verde-claro)" }}>Puntos inmediatos:</span>{" "}
              Cuando el administrador ingresa el resultado real de un partido, los puntos
              se suman automáticamente. Al entrar a la app recibirás{" "}
              <span style={{ color:"var(--amarillo)" }}>notificaciones</span> con el detalle
              de tu apuesta, resultado real y puntos ganados.
            </p>
            <p style={{ fontSize:"6.5px",lineHeight:2 }}>
              🃏 <span style={{ color:"var(--rojo-chile)" }}>Cartas y bonus:</span>{" "}
              El admin ejecuta "ENTREGAR CARTAS Y BONUS" al final de la jornada.
              Ese botón solo otorga el +2 del ganador del día y asigna las cartas al podio.
              No recalcula los puntos de los partidos (ya fueron sumados antes).
            </p>
            <p style={{ fontSize:"6.5px",lineHeight:2 }}>
              ❌ <span style={{ color:"var(--gris-claro)" }}>Si olvidas un día:</span>{" "}
              No quedas eliminado. Sigues acumulando puntos en los días siguientes.
            </p>
          </div>
        </>
      ),
    },

    // ── 3. Fases finales ─────────────────────────────────────
    {
      icono: "💀",
      titulo: "FASES MUERE-MUERE",
      color: "var(--rojo-chile)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            Desde los <span style={{ color:"var(--rojo-chile)" }}>Dieciseisavos</span> los
            partidos son a <strong>muere-muere</strong>. Además del ganador, apuesta por{" "}
            <span style={{ color:"var(--amarillo)" }}>Alargue</span> o{" "}
            <span style={{ color:"var(--amarillo)" }}>Penales</span> para más puntos.
          </p>
          <div style={{ marginTop:"10px",display:"flex",flexDirection:"column",gap:"4px" }}>
            <FilaPts pts="+2" desc="Acertar ganador en 90 min" color="var(--rojo-chile)" />
            <FilaPts pts="+3" desc="Ganador + diferencia en 90 min" color="var(--rojo-chile)" />
            <FilaPts pts="+3" desc="Acertar que se define en Alargue" color="var(--rojo-chile)" />
            <FilaPts pts="+6" desc="Alargue + diferencia en el alargue" color="var(--rojo-chile)" />
            <FilaPts pts="+3" desc="Acertar que se define en Penales" color="var(--rojo-chile)" />
            <FilaPts pts="+5" desc="Penales + quién gana la tanda" color="var(--rojo-chile)" />
            <FilaPts pts="+7" desc="Penales + diferencia exacta de la tanda" color="var(--rojo-chile)" />
            <FilaPts pts="+2" desc="Pregunta del día correcta" />
            <FilaPts pts="+2" desc="Ganador del día (bonus diario)" color="var(--verde-claro)" />
          </div>
        </>
      ),
    },

    // ── 4. Podio y ranking ───────────────────────────────────
    {
      icono: "🏆",
      titulo: "EL PODIO Y EL RANKING",
      color: "var(--amarillo)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            Cada jornada genera un <span style={{ color:"var(--amarillo)" }}>Podio</span> con
            los mejores jugadores. El <span style={{ color:"var(--amarillo)" }}>ganador del día</span>{" "}
            obtiene <span style={{ color:"var(--verde-claro)" }}>+2 pts bonus</span>.
          </p>

          <div style={{ marginTop:"10px",padding:"10px",
            border:"2px solid var(--amarillo)",background:"rgba(244,208,63,0.06)",
            display:"flex",flexDirection:"column",gap:"6px" }}>
            <p style={{ fontSize:"6px",color:"var(--amarillo)",lineHeight:2 }}>
              🏅 El podio muestra <strong>3 columnas</strong> (1°, 2°, 3°). Si hay empates,
              los avatares rotan en <strong>carrusel</strong> automático cada 2 segundos.
              Puedes deslizar o tocar para ver los demás. Toca un avatar para ver el perfil
              y los pronósticos de ese jugador.
            </p>
            <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
              📊 En el <strong>RANKING</strong>, junto a los puntos aparecen flechas{" "}
              <span style={{ color:"#4ade80" }}>▲</span> o{" "}
              <span style={{ color:"var(--rojo-chile)" }}>▼</span> indicando cuántos
              puestos subiste o bajaste respecto al día anterior.
            </p>
          </div>
        </>
      ),
    },

    // ── 5. Cartas coleccionables ─────────────────────────────
    {
      icono: "🃏",
      titulo: "CARTAS COLECCIONABLES",
      color: "var(--verde-claro)",
      contenido: (
        <>
          <p style={{ lineHeight:2.2 }}>
            El podio de cada día reparte <span style={{ color:"var(--amarillo)" }}>cartas multiplicadoras</span>:
          </p>
          <div style={{ marginTop:"8px",display:"flex",flexDirection:"column",gap:"5px" }}>
            {[
              {pos:"🥇 1° lugar", mult:"×4", desc:"Cuadruplica tus puntos en un partido"},
              {pos:"🥈 2° lugar", mult:"×3", desc:"Triplica tus puntos en un partido"},
              {pos:"🥉 3° lugar", mult:"×2", desc:"Duplica tus puntos en un partido"},
            ].map((c,i) => (
              <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"6px 8px",border:"1px solid var(--verde-campo)",fontSize:"6px",background:"rgba(0,0,0,0.3)" }}>
                <div>
                  <p style={{ color:"var(--blanco)",marginBottom:"2px" }}>{c.pos}</p>
                  <p style={{ color:"var(--gris-claro)" }}>{c.desc}</p>
                </div>
                <span style={{ color:"var(--amarillo)",fontSize:"12px",fontWeight:"bold" }}>{c.mult}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:"10px",padding:"8px",
            border:"2px solid var(--verde-campo)",background:"rgba(82,183,136,0.08)" }}>
            <p style={{ fontSize:"6px",color:"var(--verde-claro)",lineHeight:2 }}>
              💡 Para usar una carta, selecciónala antes de guardar tu predicción.
              La carta se consume cuando el partido termine (al procesar el resultado).
              Si acierta algo, se aplica el multiplicador. Si falla, la carta igual se consume.
              Puedes cambiar la carta antes del cierre del partido editando tu predicción.
            </p>
          </div>
        </>
      ),
    },

    // ── 6. Mensajes y notificaciones ────────────────────────
    {
      icono: "📢",
      titulo: "MENSAJES Y NOTIFICACIONES",
      color: "var(--amarillo)",
      contenido: (
        <>
          <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>

            <div style={{ padding:"8px",border:"2px solid var(--verde-campo)",background:"rgba(0,0,0,0.3)" }}>
              <p style={{ fontSize:"6px",color:"var(--amarillo)",marginBottom:"4px" }}>
                📢 LA VOZ DE LA HINCHADA
              </p>
              <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                En la pantalla <strong style={{ color:"var(--blanco)" }}>INICIO</strong> encontrarás
                el muro de mensajes. Puedes dejar mensajes cortos (máx 200 caracteres) con
                un enlace opcional. Los mensajes son visibles para todos. Cada mensaje muestra
                si es de <span style={{ color:"var(--verde-claro)" }}>HOY</span> o la fecha anterior (DD/MM).
                El admin puede limpiar el muro periódicamente (límite recomendado: 500 mensajes).
              </p>
            </div>

            <div style={{ padding:"8px",border:"2px solid var(--verde-campo)",background:"rgba(0,0,0,0.3)" }}>
              <p style={{ fontSize:"6px",color:"var(--amarillo)",marginBottom:"4px" }}>
                💬 MODAL POST-PRONÓSTICO
              </p>
              <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                Al guardar tu primer pronóstico del día aparecerá un modal preguntando{" "}
                <span style={{ color:"var(--blanco)" }}>"¿Algún mensaje para la hinchada?"</span>.
                Puedes escribir un mensaje directamente o cerrar. Solo aparece una vez por día.
              </p>
            </div>

            <div style={{ padding:"8px",border:"2px solid var(--amarillo)",background:"rgba(0,0,0,0.3)" }}>
              <p style={{ fontSize:"6px",color:"var(--amarillo)",marginBottom:"4px" }}>
                🔔 NOTIFICACIONES DE RESULTADOS
              </p>
              <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                Cuando el administrador guarda un resultado real, recibirás modales automáticos
                al entrar o recargar la app con:{" "}
                <span style={{ color:"var(--blanco)" }}>tu apuesta · resultado real · acierto · puntos ganados</span>.
                Los modales aparecen uno por uno en orden cronológico.
              </p>
            </div>

          </div>
        </>
      ),
    },
  ];

  const esUltimo = paso === pasos.length - 1;
  const pasActual = pasos[paso];

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",
      zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",
      padding:"20px",overflowY:"auto" }}>
      <div style={{ background:"var(--negro)",border:`4px solid ${pasActual.color}`,
        boxShadow:`6px 6px 0 ${pasActual.color}44`,
        padding:"24px 20px 20px",maxWidth:"400px",width:"100%",
        display:"flex",flexDirection:"column",gap:"16px",
        maxHeight:"88vh",overflowY:"auto" }}>

        {/* Progress dots */}
        <div style={{ display:"flex",justifyContent:"center",gap:"6px" }}>
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
          <h2 style={{ color:pasActual.color,marginTop:"8px",fontSize:"10px" }}>{pasActual.titulo}</h2>
        </div>

        {/* Contenido */}
        <div style={{ fontSize:"7px",color:"var(--blanco)",lineHeight:2,flex:1 }}>
          {pasActual.contenido}
        </div>

        {/* Navegación */}
        <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
          {!esUltimo ? (
            <button className="btn-pixel btn-amarillo w-full" style={{ fontSize:"8px" }}
              onClick={() => setPaso(p => p+1)}>
              SIGUIENTE →
            </button>
          ) : (
            <button className="btn-pixel btn-amarillo w-full" style={{ fontSize:"8px" }}
              onClick={handleCerrar}>
              {esControlado ? "✕ CERRAR TUTORIAL" : "✅ ¡ENTENDIDO! JUGAR"}
            </button>
          )}
          {paso > 0 && (
            <button onClick={() => setPaso(p => p-1)}
              style={{ background:"none",border:"none",color:"var(--gris)",fontSize:"6px",
                fontFamily:"'Press Start 2P',monospace",cursor:"pointer",textAlign:"center" }}>
              ← anterior
            </button>
          )}
          {!esUltimo && (
            <button onClick={handleCerrar}
              style={{ background:"none",border:"none",color:"var(--gris)",fontSize:"6px",
                fontFamily:"'Press Start 2P',monospace",cursor:"pointer",textAlign:"center" }}>
              {esControlado ? "Cerrar ✕" : "Saltar intro →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
