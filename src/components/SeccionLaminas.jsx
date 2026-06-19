// src/components/SeccionLaminas.jsx  — v1 (Fase 4)
// ─────────────────────────────────────────────────────────────
// Pestaña LÁMINAS completa.
//
// MECÁNICA:
//   • Cada día el usuario recibe 1 sobre de láminas (por ranking).
//   • El sobre se abre con animación CSS.
//   • Las láminas salen del sobre, el usuario hace flip para revelar.
//   • Colección: cuadrícula por categoría.
//   • Canje: 5 repetidas → carta ×2, 8 → carta ×3, 10 → carta ×4.
//
// IMÁGENES DEL SOBRE:
//   /public/sobre/sobre-cerrado.png
//   /public/sobre/sobre-abierto.png
//   (Tú pones estas imágenes. Si no existen, se muestra un sobre CSS.)
//
// DATOS EN FIRESTORE:
//   usuarios/{uid}.laminas   → { "nombre-archivo.jpg": cantidad }
//   usuarios/{uid}.ultimoSobre → "YYYY-MM-DD"
//
// CARDS.JSON desde GitHub Pages:
//   https://kvtral.github.io/laminas_16_bits/cards.json
//   Cada card: { file, nombre, categoria, url }
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  doc, getDoc, updateDoc, setDoc, increment as fbIncrement,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";
import { hoyStr } from "../utils/helpers";

const CARDS_JSON_URL = "https://kvtral.github.io/laminas_16_bits/cards.json";
const IMG_BASE       = "https://kvtral.github.io/laminas_16_bits/";

// Tabla de láminas por posición en ranking
function laminasPorPosicion(pos, totalJugadores) {
  if (pos <= 4)                    return { laminas: 4, cartaMult: null, cartaCant: 0 };
  if (pos <= 9)                    return { laminas: 3, cartaMult: 2,    cartaCant: 1 };
  if (pos <= 15)                   return { laminas: 3, cartaMult: 3,    cartaCant: 1 };
  if (pos <= 22)                   return { laminas: 3, cartaMult: 4,    cartaCant: 1 };
  return                                  { laminas: 2, cartaMult: 4,    cartaCant: 2 };
}

// ── Animación de sobre ────────────────────────────────────────
function SobreAnimado({ onAbrir, yaAbierto }) {
  const [abierto, setAbierto] = useState(false);

  const abrir = () => {
    if (abierto) return;
    setAbierto(true);
    setTimeout(() => onAbrir(), 900);
  };

  return (
    <div style={{ textAlign:"center", padding:"24px" }}>
      <div
        onClick={!abierto ? abrir : undefined}
        style={{
          display: "inline-block",
          cursor: abierto ? "default" : "pointer",
          transition: "transform 0.3s",
          transform: abierto ? "scale(1.05)" : "scale(1)",
        }}
      >
        <div style={{
          position: "relative",
          width: "140px",
          height: "100px",
          margin: "0 auto 16px",
        }}>
          {/* Sobre: intentar imagen, fallback CSS */}
          <img
            src={abierto ? "/sobre/sobre-abierto.png" : "/sobre/sobre-cerrado.png"}
            alt="sobre"
            style={{
              width: "140px", height: "100px",
              imageRendering: "pixelated",
              objectFit: "contain",
              transition: "opacity 0.4s",
            }}
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
          {/* Fallback CSS envelope */}
          <div style={{
            display: "none",
            width: "140px", height: "100px",
            background: abierto ? "#f4d03f" : "#e8a020",
            border: "4px solid var(--negro)",
            boxShadow: "4px 4px 0 var(--negro)",
            alignItems: "center", justifyContent: "center",
            fontSize: "48px",
            transition: "background 0.4s",
          }}>
            {abierto ? "📬" : "📦"}
          </div>

          {/* Destello al abrir */}
          {abierto && (
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle, rgba(244,208,63,0.8) 0%, transparent 70%)",
              animation: "destello 0.6s ease-out forwards",
              pointerEvents: "none",
            }} />
          )}
        </div>

        <p style={{
          fontFamily: "'Press Start 2P',monospace",
          fontSize: "8px",
          color: abierto ? "var(--verde-claro)" : "var(--amarillo)",
        }}>
          {abierto ? "¡ABRIENDO!" : "👆 TOCA PARA ABRIR"}
        </p>
      </div>

      <style>{`
        @keyframes destello {
          0%   { opacity:1; transform:scale(0.5); }
          100% { opacity:0; transform:scale(2); }
        }
        @keyframes laminaSale {
          0%   { opacity:0; transform:translateY(40px) rotate(-5deg) scale(0.6); }
          100% { opacity:1; transform:translateY(0) rotate(0) scale(1); }
        }
        @keyframes flipCard {
          0%   { transform:rotateY(0deg); }
          50%  { transform:rotateY(90deg); }
          100% { transform:rotateY(0deg); }
        }
      `}</style>
    </div>
  );
}

// ── Lámina con flip ───────────────────────────────────────────
function LaminaNueva({ lamina, idx, onDarVuelta }) {
  const [volteada, setVolteada] = useState(false);
  const [flipAnim, setFlipAnim] = useState(false);

  const dar = () => {
    if (volteada) return;
    setFlipAnim(true);
    setTimeout(() => { setVolteada(true); setFlipAnim(false); onDarVuelta(); }, 400);
  };

  return (
    <div
      onClick={dar}
      style={{
        width: "80px", height: "110px",
        cursor: volteada ? "default" : "pointer",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        animation: `laminaSale 0.5s ease ${idx * 0.15}s both`,
        perspective: "600px",
      }}
    >
      <div style={{
        width: "76px", height: "106px",
        position: "relative",
        animation: flipAnim ? "flipCard 0.4s ease" : "none",
      }}>
        {!volteada ? (
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(135deg, #1a1a5e 0%, #4a0e8f 100%)",
            border: "3px solid var(--amarillo)",
            boxShadow: "3px 3px 0 var(--negro)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "28px",
          }}>
            🃏
          </div>
        ) : (
          <div style={{
            width: "100%", height: "100%",
            border: "3px solid var(--verde-claro)",
            boxShadow: "3px 3px 0 var(--negro)",
            overflow: "hidden",
          }}>
            <img src={`${IMG_BASE}${lamina.file}`} alt={lamina.nombre}
              style={{ width:"100%", height:"85%", objectFit:"cover", display:"block" }} />
            <div style={{
              height: "15%", background: "var(--negro)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 2px",
            }}>
              <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"4px",
                color:"var(--blanco)", textAlign:"center", lineHeight:1.3,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                maxWidth:"100%" }}>
                {lamina.nombre}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Colección de láminas ──────────────────────────────────────
function Coleccion({ laminas, todasCards }) {
  const [selCat,   setSelCat]   = useState("todas");
  const [laminaSel,setLaminaSel]= useState(null);

  if (!todasCards || todasCards.length === 0) {
    return <p style={{ fontSize:"6px",color:"var(--gris-claro)",padding:"16px",textAlign:"center" }}>
      Cargando catálogo...
    </p>;
  }

  const categorias = ["todas", ...new Set(todasCards.map(c=>c.categoria).filter(Boolean))];
  const filtradas  = selCat === "todas"
    ? todasCards
    : todasCards.filter(c => c.categoria === selCat);

  return (
    <div>
      {/* Selector de categoría */}
      <div style={{ display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"12px" }}>
        {categorias.map(cat => (
          <button key={cat}
            className={`btn-pixel ${selCat===cat?"btn-amarillo":"btn-gris"}`}
            style={{ fontSize:"5px",padding:"4px 7px",flex:"0 0 auto" }}
            onClick={()=>setSelCat(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* Cuadrícula */}
      <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",justifyContent:"flex-start" }}>
        {filtradas.map(card => {
          const cant = laminas?.[card.file] || 0;
          const tiene = cant > 0;
          return (
            <div key={card.file}
              onClick={() => tiene && setLaminaSel(card)}
              style={{
                width: "60px",
                cursor: tiene ? "pointer" : "default",
                opacity: tiene ? 1 : 0.3,
                filter: tiene ? "none" : "grayscale(100%)",
                textAlign: "center",
              }}>
              <div style={{
                width: "60px", height: "80px",
                border: `2px solid ${tiene?"var(--verde-claro)":"var(--gris)"}`,
                overflow: "hidden",
                boxShadow: tiene?"2px 2px 0 var(--negro)":"none",
              }}>
                <img src={`${IMG_BASE}${card.file}`} alt={card.nombre}
                  style={{ width:"100%",height:"100%",objectFit:"cover",
                    imageRendering:"pixelated" }}
                  onError={e=>{e.target.src="/sobre/lamina-placeholder.png";}} />
              </div>
              {cant > 1 && (
                <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"5px",
                  color:"var(--amarillo)",display:"block",marginTop:"2px" }}>
                  ×{cant}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox de lámina */}
      {laminaSel && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",
          zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",
          padding:"20px" }} onClick={()=>setLaminaSel(null)}>
          <div style={{ background:"var(--negro)",border:"4px solid var(--verde-claro)",
            padding:"20px",maxWidth:"300px",width:"100%",textAlign:"center" }}
            onClick={e=>e.stopPropagation()}>
            <img src={`${IMG_BASE}${laminaSel.file}`} alt={laminaSel.nombre}
              style={{ width:"100%",maxHeight:"300px",objectFit:"contain",
                border:"2px solid var(--negro)",imageRendering:"pixelated" }} />
            <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
              color:"var(--amarillo)",marginTop:"12px" }}>{laminaSel.nombre}</p>
            {laminaSel.categoria && (
              <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                color:"var(--gris-claro)",marginTop:"4px" }}>#{laminaSel.categoria}</p>
            )}
            <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
              color:"var(--verde-claro)",marginTop:"8px" }}>
              Tienes: ×{laminas?.[laminaSel.file]||0}
            </p>
            <button className="btn-pixel btn-gris w-full" style={{ marginTop:"12px",fontSize:"7px" }}
              onClick={()=>setLaminaSel(null)}>CERRAR ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Canje de láminas ──────────────────────────────────────────
function CanjeLaminas({ laminas, todasCards, uid, onCanje }) {
  const [canjeando, setCanjeando] = useState(false);
  const [selLam,    setSelLam]    = useState(null);
  const [msg,       setMsg]       = useState(null);

  const REGLAS = [
    { cantidad:5,  mult:2, label:"5 láminas repetidas → carta ×2" },
    { cantidad:8,  mult:3, label:"8 láminas repetidas → carta ×3" },
    { cantidad:10, mult:4, label:"10 láminas repetidas → carta ×4" },
  ];

  // Láminas repetidas (cantidad > 1)
  const repetidas = todasCards
    .filter(c => (laminas?.[c.file]||0) > 1)
    .map(c => ({ ...c, cant:laminas[c.file] }));

  const canjear = async (regla) => {
    if (!selLam || (laminas?.[selLam.file]||0) < regla.cantidad) {
      setMsg({ tipo:"error", texto:`Necesitas ${regla.cantidad} copias de esa lámina.` });
      return;
    }
    setCanjeando(true);
    try {
      // Restar láminas
      await updateDoc(doc(db,"usuarios",uid), {
        [`laminas.${selLam.file}`]: fbIncrement(-regla.cantidad),
      });
      // Asignar carta
      const carta = cartaAleatoriaPorMultiplicador(regla.mult);
      if (carta) {
        await setDoc(doc(db,"cartasDelUsuario",`${uid}_${carta.id}_canje_${Date.now()}`), {
          uid, cartaId:carta.id, cartaNombre:carta.nombre, cartaSlug:carta.slug,
          multiplicador:carta.multiplicador, rareza:carta.rareza,
          fecha:hoyStr(), visto:false, origen:"canjeLamina",
        });
        await updateDoc(doc(db,"usuarios",uid), {
          [`cartas.${carta.id}`]: fbIncrement(1),
        });
      }
      setMsg({ tipo:"ok", texto:`✅ Canjeaste ${regla.cantidad} láminas "${selLam.nombre}" por una carta ×${regla.mult}!` });
      onCanje();
    } catch(e) { setMsg({ tipo:"error", texto:e.message }); }
    finally { setCanjeando(false); }
  };

  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"8px" }}>
        CANJE DE LÁMINAS REPETIDAS
      </p>
      {msg && (
        <p style={{ fontSize:"6px",
          color:msg.tipo==="ok"?"var(--verde-claro)":"var(--rojo-chile)",
          marginBottom:"10px",lineHeight:2 }}>
          {msg.texto}
        </p>
      )}
      {repetidas.length === 0 ? (
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
          No tienes láminas repetidas para canjear.
        </p>
      ) : (
        <>
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"8px",lineHeight:2 }}>
            Selecciona una lámina repetida:
          </p>
          <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"12px" }}>
            {repetidas.map(c => (
              <div key={c.file} onClick={()=>setSelLam(c)}
                style={{ width:"56px",cursor:"pointer",textAlign:"center",
                  border:`2px solid ${selLam?.file===c.file?"var(--amarillo)":"var(--gris)"}`,
                  padding:"2px",background:selLam?.file===c.file?"rgba(244,208,63,0.1)":"transparent" }}>
                <img src={`${IMG_BASE}${c.file}`} alt={c.nombre}
                  style={{ width:"52px",height:"70px",objectFit:"cover" }} />
                <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"5px",
                  color:"var(--amarillo)",display:"block" }}>×{c.cant}</span>
              </div>
            ))}
          </div>

          {selLam && (
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {REGLAS.filter(r => (laminas?.[selLam.file]||0) >= r.cantidad).map(r => (
                <button key={r.mult}
                  className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"6px" }}
                  onClick={()=>canjear(r)}
                  disabled={canjeando}>
                  {canjeando?"⚙ ...":r.label}
                </button>
              ))}
              {REGLAS.every(r => (laminas?.[selLam.file]||0) < r.cantidad) && (
                <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                  Tienes ×{laminas?.[selLam.file]||0}. Necesitas al menos 5 copias para canjear.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop:"14px",padding:"10px",
        border:"1px solid var(--verde-campo)",background:"rgba(0,0,0,0.2)" }}>
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
          Reglas de canje:<br/>
          5 repetidas → carta ×2<br/>
          8 repetidas → carta ×3<br/>
          10 repetidas → carta ×4
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function SeccionLaminas() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [tab,        setTab]        = useState("sobre"); // "sobre"|"coleccion"|"canje"
  const [todasCards, setTodasCards] = useState([]);
  const [cargandoCat,setCargandoCat]= useState(true);

  // Estado del sobre
  const [sobreDisponible,  setSobreDisponible]  = useState(false);
  const [laminasNuevas,    setLaminasNuevas]    = useState([]);
  const [sobreAbierto,     setSobreAbierto]     = useState(false);
  const [volteadasCount,   setVolteadasCount]   = useState(0);
  const [guardandoSobre,   setGuardandoSobre]   = useState(false);
  const [sobreGuardado,    setSobreGuardado]    = useState(false);
  const [posicionRanking,  setPosicionRanking]  = useState(null);

  const laminas = userProfile?.laminas || {};
  const hoy     = hoyStr();

  // Cargar catálogo
  useEffect(() => {
    fetch(CARDS_JSON_URL)
      .then(r => r.json())
      .then(data => {
        setTodasCards(Array.isArray(data) ? data : []);
      })
      .catch(() => setTodasCards([]))
      .finally(() => setCargandoCat(false));
  }, []);

  // Verificar si puede abrir sobre hoy
  useEffect(() => {
    if (!firebaseUser || !userProfile) return;
    const ultimoSobre = userProfile.ultimoSobre;
    setSobreDisponible(ultimoSobre !== hoy);
  }, [firebaseUser, userProfile, hoy]);

  // Preparar láminas del sobre (elegir al azar del catálogo)
  const prepararSobre = useCallback(async () => {
    if (!sobreDisponible || todasCards.length === 0) return;

    // Determinar posición en ranking para saber cuántas láminas
    let pos = 999;
    try {
      const { getDocs, query, collection, orderBy } = await import("firebase/firestore");
      const snap = await getDocs(query(collection(db,"usuarios"), orderBy("puntosTotal","desc")));
      const lista = snap.docs.map(d => d.id);
      const idx   = lista.indexOf(firebaseUser.uid);
      pos = idx >= 0 ? idx + 1 : 999;
    } catch (_) {}
    setPosicionRanking(pos);

    const { laminas: numLam } = laminasPorPosicion(pos, 999);
    // Elegir láminas al azar del catálogo
    const shuffled = [...todasCards].sort(() => Math.random() - 0.5);
    setLaminasNuevas(shuffled.slice(0, numLam));
    setVolteadasCount(0);
    setSobreGuardado(false);
  }, [sobreDisponible, todasCards, firebaseUser]);

  useEffect(() => { prepararSobre(); }, [prepararSobre]);

  const guardarLaminas = async () => {
    if (!firebaseUser || laminasNuevas.length === 0) return;
    setGuardandoSobre(true);
    try {
      // Incrementar cada lámina nueva en Firestore
      const updates = {};
      for (const lam of laminasNuevas) {
        updates[`laminas.${lam.file}`] = fbIncrement(1);
      }
      updates["ultimoSobre"] = hoy;

      // También dar carta si corresponde por posición
      const { cartaMult, cartaCant } = laminasPorPosicion(posicionRanking || 999, 999);
      if (cartaMult && cartaCant > 0) {
        for (let i = 0; i < cartaCant; i++) {
          const carta = cartaAleatoriaPorMultiplicador(cartaMult);
          if (carta) {
            await setDoc(doc(db,"cartasDelUsuario",`${firebaseUser.uid}_${carta.id}_sobre_${Date.now()}_${i}`), {
              uid:firebaseUser.uid, cartaId:carta.id, cartaNombre:carta.nombre,
              cartaSlug:carta.slug, multiplicador:carta.multiplicador,
              rareza:carta.rareza, fecha:hoy, visto:false, origen:"sobre",
            });
            updates[`cartas.${carta.id}`] = fbIncrement(1);
          }
        }
      }

      await updateDoc(doc(db,"usuarios",firebaseUser.uid), updates);
      await refreshProfile();
      setSobreGuardado(true);
      setSobreDisponible(false);
    } catch (e) { console.error(e); }
    finally { setGuardandoSobre(false); }
  };

  if (!firebaseUser) return null;

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <div className="seccion-titulo">🃏 LÁMINAS COLECCIONABLES</div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:"4px",marginBottom:"14px" }}>
        {[
          {id:"sobre",     label:"📦 SOBRE DEL DÍA"},
          {id:"coleccion", label:"📚 MI COLECCIÓN"},
          {id:"canje",     label:"🔄 CANJEAR"},
        ].map(t => (
          <button key={t.id}
            className={`btn-pixel ${tab===t.id?"btn-amarillo":"btn-gris"}`}
            style={{ flex:1,fontSize:"5px",padding:"5px 4px" }}
            onClick={()=>setTab(t.id)}>
            {t.label}
            {t.id==="sobre" && sobreDisponible && (
              <span style={{ marginLeft:"4px",color:"var(--rojo-chile)" }}>●</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Sobre del día ─────────────────────────────────── */}
      {tab === "sobre" && (
        <div>
          {!sobreDisponible ? (
            <div className="caja-pixel text-center">
              <p style={{ fontSize:"8px",color:"var(--gris-claro)" }}>📦</p>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginTop:"8px",lineHeight:2 }}>
                Ya abriste tu sobre de hoy.<br/>
                Vuelve mañana para el siguiente.
              </p>
            </div>
          ) : !sobreAbierto && laminasNuevas.length > 0 ? (
            <SobreAnimado
              onAbrir={() => setSobreAbierto(true)}
              yaAbierto={sobreAbierto}
            />
          ) : sobreAbierto ? (
            <div>
              <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                color:"var(--amarillo)",textAlign:"center",marginBottom:"12px" }}>
                ¡Da vuelta tus láminas!
              </p>
              <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",
                gap:"8px",marginBottom:"14px" }}>
                {laminasNuevas.map((lam,i) => (
                  <LaminaNueva
                    key={lam.file+i}
                    lamina={lam}
                    idx={i}
                    onDarVuelta={() => setVolteadasCount(c=>c+1)}
                  />
                ))}
              </div>
              {volteadasCount >= laminasNuevas.length && !sobreGuardado && (
                <button className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"7px" }}
                  onClick={guardarLaminas}
                  disabled={guardandoSobre}>
                  {guardandoSobre?"⚙ GUARDANDO...":"💾 GUARDAR MIS LÁMINAS"}
                </button>
              )}
              {sobreGuardado && (
                <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                  color:"var(--verde-claro)",textAlign:"center",lineHeight:2 }}>
                  ✅ ¡Láminas guardadas en tu colección!
                </p>
              )}
            </div>
          ) : (
            <div className="loading-pantalla" style={{ minHeight:"120px" }}>
              <span className="spinner">⚙</span>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)" }}>Preparando sobre...</p>
            </div>
          )}
        </div>
      )}

      {/* ── Colección ─────────────────────────────────────── */}
      {tab === "coleccion" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>Cargando catálogo...</p>
          : <Coleccion laminas={laminas} todasCards={todasCards} />
      )}

      {/* ── Canje ─────────────────────────────────────────── */}
      {tab === "canje" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>Cargando...</p>
          : <CanjeLaminas
              laminas={laminas}
              todasCards={todasCards}
              uid={firebaseUser.uid}
              onCanje={refreshProfile}
            />
      )}
    </div>
  );
}
