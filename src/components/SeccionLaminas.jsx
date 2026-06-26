// src/components/SeccionLaminas.jsx  — v4 (Hotfix 1)
// ─────────────────────────────────────────────────────────────
// FIXES en esta versión:
//   • Colección: las láminas que el usuario tiene se marcan
//     visualmente (borde verde, sin filtro gris, con contador ×N).
//     Las que NO tiene aparecen en escala de grises con candado.
//   • Lightbox: clic en cualquier lámina que el usuario TIENE
//     abre un modal grande con la imagen y datos.
//   • Persistencia del sobre: las 4 láminas del día se guardan
//     en localStorage por uid+fecha. Al recargar, las mismas.
//   • Una sola entrega por día: localStorage + Firestore.
//   • Botón GUARDAR: escribe en Firestore sin recargar la app.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  doc, getDoc, updateDoc, setDoc, increment as fbIncrement,
  collection, getDocs, query, orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";
import { composicionPorPuesto, generarSobre, cartaImg } from "../utils/sobre";

const CARDS_URL = "https://kvtral.github.io/laminas_16_bits/cards.json";
const LAMINAS_POR_SOBRE = 4;

function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

async function obtenerPosicionTotal(uid) {
  try {
    const snap = await getDocs(query(
      collection(db, "usuarios"), orderBy("puntosTotal", "desc")
    ));
    const idx = snap.docs.findIndex(d => d.id === uid);
    return { posicion: idx >= 0 ? idx + 1 : null, total: snap.size };
  } catch (e) {
    console.error("posicionTotal:", e);
    return { posicion: null, total: 0 };
  }
}

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({ lamina, cantidad, onCerrar }) {
  if (!lamina) return null;
  return (
    <div
      onClick={onCerrar}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.95)",
        zIndex:1000, display:"flex", alignItems:"center",
        justifyContent:"center", padding:"20px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:"var(--negro)", border:"4px solid var(--verde-claro)",
          boxShadow:"6px 6px 0 var(--verde-oscuro)",
          padding:"16px", maxWidth:"340px", width:"100%", textAlign:"center",
        }}
      >
        <img
          src={lamina.url}
          alt={lamina.nombre}
          style={{
            width:"100%", maxHeight:"340px", objectFit:"contain",
            imageRendering:"pixelated", border:"2px solid var(--negro)",
            display:"block", marginBottom:"12px",
          }}
        />
        <p style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:"9px",
          color:"var(--amarillo)", lineHeight:1.8, marginBottom:"6px",
        }}>
          {lamina.nombre}
        </p>
        {lamina.categoria && (
          <p style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color:"var(--gris-claro)", marginBottom:"6px",
          }}>
            #{lamina.categoria}
          </p>
        )}
        <p style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
          color:"var(--verde-claro)", marginBottom:"14px",
        }}>
          En tu colección: ×{cantidad}
        </p>
        <button
          className="btn-pixel btn-gris w-full"
          style={{ fontSize:"7px" }}
          onClick={onCerrar}
        >
          CERRAR ✕
        </button>
      </div>
    </div>
  );
}

// ── Animación del sobre ───────────────────────────────────────
function SobreAnimado({ onAbrir }) {
  const [abierto, setAbierto] = useState(false);
  const abrir = () => {
    if (abierto) return;
    setAbierto(true);
    setTimeout(onAbrir, 800);
  };
  return (
    <div style={{ textAlign:"center", padding:"24px 20px" }}>
      <div
        onClick={!abierto ? abrir : undefined}
        style={{ display:"inline-block", cursor:abierto?"default":"pointer" }}
      >
        {/* Imagen del sobre — con fallback CSS */}
        <div style={{ position:"relative", width:"160px", height:"120px", margin:"0 auto 16px" }}>
          <img
            src={abierto ? "/sobre/sobre-abierto.png" : "/sobre/sobre-cerrado.png"}
            alt="sobre"
            style={{ width:"160px", height:"120px", imageRendering:"pixelated", objectFit:"contain" }}
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
          <div style={{
            display:"none", width:"160px", height:"120px",
            background: abierto ? "#f4d03f" : "#e8a020",
            border:"4px solid var(--negro)", boxShadow:"4px 4px 0 var(--negro)",
            alignItems:"center", justifyContent:"center",
            fontSize:"56px",
          }}>
            {abierto ? "📬" : "📦"}
          </div>
        </div>
        <p style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:"9px",
          color: abierto ? "var(--verde-claro)" : "var(--amarillo)",
          lineHeight:1.8,
        }}>
          {abierto ? "¡ABRIENDO!" : "👆 TOCA PARA ABRIR"}
        </p>
        {!abierto && (
          <p style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color:"var(--gris-claro)", marginTop:"6px",
          }}>
            Contiene {LAMINAS_POR_SOBRE} láminas
          </p>
        )}
      </div>
    </div>
  );
}

// ── Lámina con flip (dentro del sobre) ───────────────────────
function LaminaFlip({ lamina, idx, onVoltear, yaVolteada, onClick }) {
  const [volteada, setVolteada] = useState(yaVolteada);

  const dar = () => {
    if (volteada) {
      onClick(lamina); // ya volteada → abrir lightbox
      return;
    }
    setVolteada(true);
    onVoltear();
  };

  return (
    <div
      onClick={dar}
      style={{
        width:"80px",
        cursor:"pointer",
        textAlign:"center",
        animation:`laminaSale 0.5s ease ${idx*0.12}s both`,
      }}
    >
      <div style={{
        width:"80px", height:"110px",
        border: volteada ? "3px solid var(--verde-claro)" : "3px solid var(--amarillo)",
        boxShadow:"3px 3px 0 var(--negro)",
        overflow:"hidden",
        background: volteada ? "transparent" : "linear-gradient(135deg,#1a1a5e,#4a0e8f)",
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"border-color 0.3s",
      }}>
        {!volteada
          ? <span style={{ fontSize:"32px" }}>🃏</span>
          : <img
              src={lamina.url}
              alt={lamina.nombre}
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
            />
        }
      </div>
      {volteada && (
        <p style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:"4px",
          color:"var(--blanco)", marginTop:"3px", lineHeight:1.4,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        }}>
          {lamina.nombre}
        </p>
      )}
    </div>
  );
}

// ── Colección ─────────────────────────────────────────────────
function Coleccion({ laminasUsuario, todasLaminas, onClickLamina }) {
  const [selCat, setSelCat] = useState("todas");

  if (!todasLaminas || todasLaminas.length === 0) {
    return (
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",padding:"16px",textAlign:"center" }}>
        Cargando catálogo...
      </p>
    );
  }

  const categorias = ["todas", ...new Set(todasLaminas.map(l => l.categoria).filter(Boolean))];
  const filtradas  = selCat === "todas"
    ? todasLaminas
    : todasLaminas.filter(l => l.categoria === selCat);

  const total     = todasLaminas.length;
  const obtenidas = todasLaminas.filter(l => (laminasUsuario?.[l.file]||0) > 0).length;

  return (
    <div>
      {/* Progreso */}
      <div style={{
        padding:"8px 10px", marginBottom:"12px",
        border:"1px solid var(--verde-campo)",
        background:"rgba(82,183,136,0.08)",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px", color:"var(--gris-claro)" }}>
          COLECCIÓN
        </span>
        <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px", color:"var(--amarillo)" }}>
          {obtenidas}/{total}
        </span>
      </div>

      {/* Categorías */}
      <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", marginBottom:"12px" }}>
        {categorias.map(cat => (
          <button
            key={cat}
            className={`btn-pixel ${selCat===cat?"btn-amarillo":"btn-gris"}`}
            style={{ fontSize:"5px", padding:"4px 7px", flex:"0 0 auto" }}
            onClick={() => setSelCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Cuadrícula */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
        {filtradas.map(lam => {
          const cantidad = laminasUsuario?.[lam.file] || 0;
          const tiene    = cantidad > 0;

          return (
            <div
              key={lam.file}
              onClick={() => tiene && onClickLamina(lam, cantidad)}
              style={{
                width:"64px",
                cursor: tiene ? "pointer" : "default",
                textAlign:"center",
                position:"relative",
              }}
              title={tiene ? `${lam.nombre} — clic para ampliar` : lam.nombre}
            >
              {/* Marco de la lámina */}
              <div style={{
                width:"64px", height:"88px",
                border: tiene
                  ? "3px solid var(--verde-claro)"
                  : "2px solid rgba(255,255,255,0.1)",
                boxShadow: tiene ? "2px 2px 0 var(--negro)" : "none",
                overflow:"hidden",
                background:"#111",
                position:"relative",
              }}>
                <img
                  src={lam.url}
                  alt={lam.nombre}
                  style={{
                    width:"100%", height:"100%", objectFit:"cover",
                    imageRendering:"pixelated",
                    filter: tiene ? "none" : "grayscale(100%) brightness(0.35)",
                    transition:"filter 0.2s",
                  }}
                  onError={e => { e.target.src = "/sobre/lamina-placeholder.png"; }}
                />
                {/* Candado para no obtenidas */}
                {!tiene && (
                  <div style={{
                    position:"absolute", inset:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:"rgba(0,0,0,0.3)",
                  }}>
                    <span style={{ fontSize:"20px", opacity:0.5 }}>🔒</span>
                  </div>
                )}
                {/* Contador de duplicados */}
                {cantidad > 1 && (
                  <div style={{
                    position:"absolute", top:"2px", right:"2px",
                    background:"var(--rojo-chile)", color:"var(--blanco)",
                    fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                    padding:"1px 4px", border:"1px solid var(--negro)",
                    lineHeight:1.5,
                  }}>
                    ×{cantidad}
                  </div>
                )}
                {/* Check de obtenida */}
                {tiene && cantidad === 1 && (
                  <div style={{
                    position:"absolute", top:"2px", right:"2px",
                    background:"var(--verde-claro)", color:"var(--negro)",
                    fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
                    padding:"1px 3px", border:"1px solid var(--negro)",
                    lineHeight:1.5,
                  }}>
                    ✓
                  </div>
                )}
              </div>
              {/* Nombre */}
              <p style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"4px",
                color: tiene ? "var(--blanco)" : "rgba(255,255,255,0.2)",
                marginTop:"3px", lineHeight:1.4,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              }}>
                {lam.nombre}
              </p>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes laminaSale {
          0%  { opacity:0; transform:translateY(30px) scale(.8); }
          100%{ opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Canje ─────────────────────────────────────────────────────
function CanjeLaminas({ laminasUsuario, todasLaminas, uid, onCanje }) {
  const [selLam,    setSelLam]    = useState(null);
  const [canjeando, setCanjeando] = useState(false);
  const [msg,       setMsg]       = useState(null);

  const REGLAS = [
    { cantidad:5,  mult:2, label:"5 iguales → carta ×2" },
    { cantidad:8,  mult:3, label:"8 iguales → carta ×3" },
    { cantidad:10, mult:4, label:"10 iguales → carta ×4" },
  ];

  const repetidas = todasLaminas
    .filter(l => (laminasUsuario?.[l.file]||0) > 1)
    .map(l => ({ ...l, cant: laminasUsuario[l.file] }));

  const canjear = async (regla) => {
    if (!selLam || (laminasUsuario?.[selLam.file]||0) < regla.cantidad) {
      setMsg({ tipo:"error", texto:`Necesitas ${regla.cantidad} copias de la misma lámina.` });
      return;
    }
    setCanjeando(true);
    try {
      await updateDoc(doc(db,"usuarios",uid), {
        [`laminas.${selLam.file}`]: fbIncrement(-regla.cantidad),
      });
      const carta = cartaAleatoriaPorMultiplicador(regla.mult);
      if (carta) {
        await setDoc(
          doc(db,"cartasDelUsuario",`${uid}_${carta.id}_canje_${Date.now()}`),
          {
            uid, cartaId:carta.id, cartaNombre:carta.nombre, cartaSlug:carta.slug,
            multiplicador:carta.multiplicador, rareza:carta.rareza,
            fecha:hoyStr(), visto:false, origen:"canje",
          }
        );
        await updateDoc(doc(db,"usuarios",uid), {
          [`cartas.${carta.id}`]: fbIncrement(1),
        });
      }
      setMsg({ tipo:"ok", texto:`✅ ×${regla.cantidad} "${selLam.nombre}" → carta ×${regla.mult}!` });
      setSelLam(null);
      onCanje();
    } catch(e) {
      setMsg({ tipo:"error", texto:e.message });
    } finally {
      setCanjeando(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"10px" }}>
        CANJE DE LÁMINAS REPETIDAS
      </p>
      {msg && (
        <p style={{
          fontSize:"6px", lineHeight:2, marginBottom:"10px",
          color: msg.tipo==="ok" ? "var(--verde-claro)" : "var(--rojo-chile)",
        }}>
          {msg.texto}
        </p>
      )}
      {repetidas.length === 0 ? (
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
          Aún no tienes láminas repetidas.
        </p>
      ) : (
        <>
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"8px",lineHeight:2 }}>
            Selecciona una lámina repetida:
          </p>
          <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"12px" }}>
            {repetidas.map(l => (
              <div
                key={l.file}
                onClick={() => setSelLam(l)}
                style={{
                  width:"56px", cursor:"pointer", textAlign:"center",
                  border:`2px solid ${selLam?.file===l.file?"var(--amarillo)":"var(--gris)"}`,
                  padding:"3px",
                  background: selLam?.file===l.file ? "rgba(244,208,63,0.12)" : "transparent",
                }}
              >
                <img src={l.url} alt={l.nombre}
                  style={{ width:"50px",height:"68px",objectFit:"cover",display:"block" }} />
                <span style={{
                  fontFamily:"'Press Start 2P',monospace",fontSize:"5px",
                  color:"var(--amarillo)",display:"block",marginTop:"2px",
                }}>
                  ×{l.cant}
                </span>
              </div>
            ))}
          </div>

          {selLam && (
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {REGLAS.filter(r => (laminasUsuario?.[selLam.file]||0) >= r.cantidad).map(r => (
                <button
                  key={r.mult}
                  className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"6px" }}
                  onClick={() => canjear(r)}
                  disabled={canjeando}
                >
                  {canjeando ? "⚙ ..." : r.label}
                </button>
              ))}
              {REGLAS.every(r => (laminasUsuario?.[selLam.file]||0) < r.cantidad) && (
                <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                  Tienes ×{laminasUsuario?.[selLam.file]||0}. Mínimo 5 copias para canjear.
                </p>
              )}
            </div>
          )}
        </>
      )}
      <div style={{
        marginTop:"14px",padding:"10px",
        border:"1px solid var(--verde-campo)",background:"rgba(0,0,0,0.2)",
      }}>
        <p style={{ fontSize:"5px",color:"var(--gris-claro)",lineHeight:2 }}>
          5 iguales → carta ×2 &nbsp;|&nbsp; 8 → carta ×3 &nbsp;|&nbsp; 10 → carta ×4
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function SeccionLaminas() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();

  const [tab,          setTab]          = useState("sobre");
  const [todasLaminas, setTodasLaminas] = useState([]);
  const [cargandoCat,  setCargandoCat]  = useState(true);
  const [errorCat,     setErrorCat]     = useState(null);

  // Estado del lightbox
  const [lightboxLamina,   setLightboxLamina]   = useState(null);
  const [lightboxCantidad, setLightboxCantidad] = useState(0);

  // Estado del sobre (reemplaza laminasNuevas)
  const [sobre, setSobre]                 = useState(null); // { laminas:[], cartas:[] }
  const [sobreDisponible, setSobreDisponible] = useState(false);
  const [sobreAbierto, setSobreAbierto]   = useState(false);
  const [sobreGuardado, setSobreGuardado] = useState(false);
  const [volteadas, setVolteadas]         = useState(0);
  const [guardando, setGuardando]         = useState(false);
  const [msgGuardado, setMsgGuardado]     = useState(null);
  const iniciadoRef = useRef(false);

  const uid  = firebaseUser?.uid;
  const hoy  = hoyStr();
  const sobreDocId = uid ? `${uid}_${hoy}` : null;

  // Láminas que el usuario tiene (mapa file→cantidad)
  const laminasUsuario = userProfile?.laminas || {};

  // 1. Cargar catálogo de GitHub Pages
  useEffect(() => {
    fetch(CARDS_URL)
      .then(r => r.json())
      .then(d => {
        // API: { laminas: [...] } o array directo
        const lista = Array.isArray(d) ? d : (d.laminas || []);
        setTodasLaminas(lista);
      })
      .catch(e => {
        console.error("Catálogo:", e);
        setErrorCat("No se pudo cargar el catálogo. Verifica la conexión.");
      })
      .finally(() => setCargandoCat(false));
  }, []);

  // 2. Cargar/crear el sobre del día (fuente de verdad: Firestore sobresDelDia)
  useEffect(() => {
    if (!uid || iniciadoRef.current || todasLaminas.length === 0) return;
    iniciadoRef.current = true;

    (async () => {
      // 1) ¿Ya existe el sobre de hoy? -> restaurar (anti re-roll)
      const ref = doc(db, "sobresDelDia", sobreDocId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        setSobre({ laminas: d.laminas || [], cartas: d.cartas || [] });
        setSobreGuardado(!!d.guardado);
        setSobreAbierto(true);
        setSobreDisponible(false);
        if (d.guardado) setVolteadas((d.laminas?.length || 0) + (d.cartas?.length || 0));
        return;
      }
      // 2) No existe -> generar por puesto y FIJAR en Firestore antes del reveal
      const { posicion } = await obtenerPosicionTotal(uid);
      const comp = composicionPorPuesto(posicion);
      const generado = generarSobre(todasLaminas, comp);
      await setDoc(ref, {
        uid, fecha: hoy, guardado: false,
        laminas: generado.laminas, cartas: generado.cartas,
      });
      setSobre(generado);
      setSobreDisponible(true);
    })();
  }, [uid, hoy, sobreDocId, todasLaminas]);

  // 4. Guardar láminas en Firestore (sin recargar)
  const guardarLaminas = async () => {
    if (!uid || !sobre || guardando || sobreGuardado) return;
    setGuardando(true);
    setMsgGuardado(null);
    try {
      const updates = { ultimoSobre: hoy };
      for (const lam of sobre.laminas) updates[`laminas.${lam.file}`] = fbIncrement(1);
      for (const c of sobre.cartas)    updates[`cartas.${c.id}`]      = fbIncrement(1);
      await updateDoc(doc(db, "usuarios", uid), updates);

      // docs detalle de cartas (ID determinista -> idempotente), origen "sobre"
      for (let i = 0; i < sobre.cartas.length; i++) {
        const c = sobre.cartas[i];
        await setDoc(doc(db, "cartasDelUsuario", `${uid}_${c.id}_${hoy}_sobre_${i}`), {
          uid, cartaId: c.id, cartaNombre: c.nombre, cartaSlug: c.slug,
          multiplicador: c.multiplicador, rareza: c.rareza,
          fecha: hoy, visto: false, origen: "sobre",
        });
      }
      await updateDoc(doc(db, "sobresDelDia", sobreDocId), { guardado: true });

      setSobreGuardado(true);
      setMsgGuardado("✅ ¡Guardado en tu colección!");
      if (refreshProfile) await refreshProfile();
    } catch (e) {
      setMsgGuardado(`❌ Error: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  };

  // Abrir lightbox
  const handleClickLamina = (lamina, cantidad) => {
    setLightboxLamina(lamina);
    setLightboxCantidad(cantidad);
  };

  if (!firebaseUser) return null;

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      {/* Lightbox */}
      <Lightbox
        lamina={lightboxLamina}
        cantidad={lightboxCantidad}
        onCerrar={() => { setLightboxLamina(null); setLightboxCantidad(0); }}
      />

      <div className="seccion-titulo">🃏 LÁMINAS COLECCIONABLES</div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:"4px",marginBottom:"14px" }}>
        {[
          { id:"sobre",     label:"📦 SOBRE"     },
          { id:"coleccion", label:"📚 COLECCIÓN"  },
          { id:"canje",     label:"🔄 CANJEAR"    },
        ].map(t => (
          <button
            key={t.id}
            className={`btn-pixel ${tab===t.id?"btn-amarillo":"btn-gris"}`}
            style={{ flex:1,fontSize:"5px",padding:"5px 4px" }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id==="sobre" && sobreDisponible && (
              <span style={{ marginLeft:"4px",color:"var(--rojo-chile)" }}>●</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB SOBRE ──────────────────────────────────────── */}
      {tab === "sobre" && (
        <div>
          {cargandoCat ? (
            <div style={{ textAlign:"center",padding:"20px" }}>
              <span className="spinner">⚙</span>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginTop:"8px" }}>
                Cargando catálogo...
              </p>
            </div>
          ) : errorCat ? (
            <div className="caja-pixel text-center">
              <p style={{ fontSize:"6px",color:"var(--rojo-chile)",lineHeight:2 }}>{errorCat}</p>
            </div>
          ) : sobreGuardado && !sobreAbierto ? (
            // Ya guardadas, mostrar láminas obtenidas hoy (modo solo lectura)
            <div>
              <div className="caja-pixel text-center" style={{ marginBottom:"12px" }}>
                <p style={{ fontSize:"7px",color:"var(--verde-claro)",lineHeight:2 }}>
                  ✅ Ya abriste tu sobre de hoy.
                </p>
                <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                  Vuelve mañana para un nuevo sobre.
                </p>
              </div>
              {sobre?.laminas?.length > 0 && (
                <>
                  <p style={{
                    fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                    color:"var(--gris-claro)",textAlign:"center",marginBottom:"12px",
                  }}>
                    TUS LÁMINAS DE HOY:
                  </p>
                  <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"8px" }}>
                    {sobre.laminas.map((lam,i) => (
                      <div key={i}
                        onClick={() => handleClickLamina(lam, laminasUsuario[lam.file]||1)}
                        style={{ width:"76px",cursor:"pointer",textAlign:"center" }}>
                        <div style={{ width:"76px",height:"106px",
                          border:"3px solid var(--verde-claro)",overflow:"hidden" }}>
                          <img src={lam.url} alt={lam.nombre}
                            style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                        </div>
                        <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"4px",
                          color:"var(--blanco)",marginTop:"3px",lineHeight:1.4,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          {lam.nombre}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : sobreDisponible && !sobreAbierto ? (
            // Sobre disponible para abrir
            <SobreAnimado onAbrir={() => setSobreAbierto(true)} />
          ) : sobre !== null ? (
            // Sobre abierto — mostrar láminas con flip
            <div>
              <p style={{
                fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                color:"var(--amarillo)",textAlign:"center",marginBottom:"14px",
              }}>
                {sobreGuardado ? "TUS LÁMINAS DE HOY" : `¡Da vuelta tus láminas! (${volteadas}/${sobre.laminas.length})`}
              </p>
              <div style={{
                display:"flex",flexWrap:"wrap",justifyContent:"center",
                gap:"10px",marginBottom:"16px",
              }}>
                {sobre.laminas.map((lam,i) => (
                  <LaminaFlip
                    key={lam.file+i}
                    lamina={lam}
                    idx={i}
                    yaVolteada={sobreGuardado}
                    onVoltear={() => setVolteadas(v => v+1)}
                    onClick={(l) => handleClickLamina(l, laminasUsuario[l.file]||1)}
                  />
                ))}
              </div>

              {sobre.cartas.length > 0 && (
                <>
                  <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                    color:"var(--amarillo)", textAlign:"center", margin:"10px 0" }}>
                    ¡CARTAS MULTIPLICADORAS!
                  </p>
                  <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"10px" }}>
                    {sobre.cartas.map((c, i) => (
                      <div key={c.id+"_"+i} style={{ width:"80px", textAlign:"center" }}>
                        <div style={{ width:"80px", height:"110px", border:"3px solid var(--amarillo)",
                          boxShadow:"3px 3px 0 var(--negro)", overflow:"hidden" }}>
                          <img src={cartaImg(c.slug)} alt={c.nombre}
                            style={{ width:"100%", height:"100%", objectFit:"cover" }}
                            onError={e => { e.target.style.opacity = 0.2; }} />
                        </div>
                        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                          color:"var(--verde-claro)", marginTop:"3px" }}>×{c.multiplicador}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!sobreGuardado && volteadas >= sobre.laminas.length && (
                <button
                  className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"7px" }}
                  onClick={guardarLaminas}
                  disabled={guardando}
                >
                  {guardando ? "⚙ GUARDANDO..." : "💾 GUARDAR MIS LÁMINAS"}
                </button>
              )}

              {!sobreGuardado && volteadas < sobre.laminas.length && (
                <p style={{
                  fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                  color:"var(--gris-claro)",textAlign:"center",lineHeight:2,
                }}>
                  Toca cada lámina para darle vuelta
                </p>
              )}

              {msgGuardado && (
                <p style={{
                  fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                  color:"var(--verde-claro)",textAlign:"center",
                  marginTop:"10px",lineHeight:2,
                }}>
                  {msgGuardado}
                </p>
              )}

              {sobreGuardado && !msgGuardado && (
                <p style={{
                  fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                  color:"var(--gris-claro)",textAlign:"center",lineHeight:2,marginTop:"8px",
                }}>
                  ✅ Guardadas. Vuelve mañana para un nuevo sobre.
                </p>
              )}
            </div>
          ) : (
            <div style={{ textAlign:"center",padding:"20px" }}>
              <span className="spinner">⚙</span>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginTop:"8px" }}>
                Preparando sobre...
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB COLECCIÓN ───────────────────────────────────── */}
      {tab === "coleccion" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
              Cargando...
            </p>
          : errorCat
            ? <p style={{ fontSize:"6px",color:"var(--rojo-chile)",padding:"8px" }}>{errorCat}</p>
            : <Coleccion
                laminasUsuario={laminasUsuario}
                todasLaminas={todasLaminas}
                onClickLamina={handleClickLamina}
              />
      )}

      {/* ── TAB CANJE ───────────────────────────────────────── */}
      {tab === "canje" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
              Cargando...
            </p>
          : <CanjeLaminas
              laminasUsuario={laminasUsuario}
              todasLaminas={todasLaminas}
              uid={uid}
              onCanje={refreshProfile}
            />
      )}
    </div>
  );
}
