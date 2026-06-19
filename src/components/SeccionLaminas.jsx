// src/components/SeccionLaminas.jsx  — v2 (Bugfix 1)
// ─────────────────────────────────────────────────────────────
// BUG 7 CORREGIDO:
//   • cards.json retorna { laminas: [], categorias: [] }
//     → usar d.laminas (no d directamente)
//   • URL de imagen: usar l.url (ya absoluta) en lugar de
//     construir desde IMG_BASE + l.file
//   • Las cartas del sobre se guardan con visto:true para que
//     NO aparezcan en NotificacionCartas automáticamente.
//     El usuario ya las ve al abrir el sobre.
//   • Protección anti-doble-sobre: localStorage + Firestore
//     (campo ultimoSobre en el documento del usuario)
// ─────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useCallback,
} from "react";
import {
  doc, getDoc, updateDoc, setDoc,
  increment as fbIncrement,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";
import { hoyStr } from "../utils/helpers";

const CARDS_URL = "https://kvtral.github.io/laminas_16_bits/cards.json";

// Láminas según posición en ranking (igual que antes)
function laminasPorPosicion(pos) {
  if (pos <= 4)  return { numLam: 4, cartaMult: null, cartaCant: 0 };
  if (pos <= 9)  return { numLam: 3, cartaMult: 2,    cartaCant: 1 };
  if (pos <= 15) return { numLam: 3, cartaMult: 3,    cartaCant: 1 };
  if (pos <= 22) return { numLam: 3, cartaMult: 4,    cartaCant: 1 };
  return              { numLam: 2, cartaMult: 4,    cartaCant: 2 };
}

// ── Animación del sobre ───────────────────────────────────────
function SobreAnimado({ onAbrir }) {
  const [abierto, setAbierto] = useState(false);

  const abrir = () => {
    if (abierto) return;
    setAbierto(true);
    setTimeout(onAbrir, 900);
  };

  return (
    <div style={{ textAlign:"center", padding:"20px" }}>
      <div onClick={!abierto ? abrir : undefined}
        style={{ display:"inline-block", cursor: abierto?"default":"pointer" }}>
        <div style={{ width:"140px", height:"100px", margin:"0 auto 14px" }}>
          <img
            src={abierto ? "/sobre/sobre-abierto.png" : "/sobre/sobre-cerrado.png"}
            alt="sobre"
            style={{ width:"140px",height:"100px",imageRendering:"pixelated",
              objectFit:"contain",transition:"opacity 0.4s" }}
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
          {/* Fallback CSS */}
          <div style={{ display:"none", width:"140px", height:"100px",
            background: abierto?"#f4d03f":"#e8a020",
            border:"4px solid var(--negro)", boxShadow:"4px 4px 0 var(--negro)",
            alignItems:"center", justifyContent:"center", fontSize:"48px" }}>
            {abierto ? "📬" : "📦"}
          </div>
          {abierto && (
            <div style={{ position:"absolute",inset:0,
              background:"radial-gradient(circle,rgba(244,208,63,0.8) 0%,transparent 70%)",
              animation:"destello 0.6s ease-out forwards",pointerEvents:"none" }} />
          )}
        </div>
        <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
          color: abierto?"var(--verde-claro)":"var(--amarillo)" }}>
          {abierto ? "¡ABRIENDO!" : "👆 TOCA PARA ABRIR"}
        </p>
      </div>
      <style>{`
        @keyframes destello{0%{opacity:1;transform:scale(.5)}100%{opacity:0;transform:scale(2)}}
        @keyframes laminaSale{0%{opacity:0;transform:translateY(40px) rotate(-5deg) scale(.6)}100%{opacity:1;transform:translateY(0) rotate(0) scale(1)}}
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
    <div onClick={dar}
      style={{ width:"80px",height:"110px",cursor:volteada?"default":"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        animation:`laminaSale 0.5s ease ${idx*0.15}s both` }}>
      <div style={{ width:"76px",height:"106px",position:"relative",
        animation:flipAnim?"flipCard 0.4s ease":"none" }}>
        {!volteada ? (
          <div style={{ width:"100%",height:"100%",
            background:"linear-gradient(135deg,#1a1a5e 0%,#4a0e8f 100%)",
            border:"3px solid var(--amarillo)",boxShadow:"3px 3px 0 var(--negro)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px" }}>
            🃏
          </div>
        ) : (
          <div style={{ width:"100%",height:"100%",
            border:"3px solid var(--verde-claro)",boxShadow:"3px 3px 0 var(--negro)",
            overflow:"hidden" }}>
            {/* Bug 7 fix: usar l.url que ya viene absoluta */}
            <img src={lamina.url} alt={lamina.nombre}
              style={{ width:"100%",height:"85%",objectFit:"cover",display:"block" }} />
            <div style={{ height:"15%",background:"var(--negro)",
              display:"flex",alignItems:"center",justifyContent:"center",padding:"0 2px" }}>
              <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"4px",
                color:"var(--blanco)",textAlign:"center",lineHeight:1.3,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%" }}>
                {lamina.nombre}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Colección ─────────────────────────────────────────────────
function Coleccion({ laminas, todasLaminas }) {
  const [selCat,    setSelCat]    = useState("todas");
  const [laminaSel, setLaminaSel] = useState(null);

  if (!todasLaminas || todasLaminas.length === 0) {
    return <p style={{ fontSize:"6px",color:"var(--gris-claro)",padding:"16px",textAlign:"center" }}>
      Cargando catálogo...
    </p>;
  }

  // Bug 7 fix: categorías vienen en cada lámina como l.categoria
  const categorias = ["todas", ...new Set(todasLaminas.map(l=>l.categoria).filter(Boolean))];
  const filtradas  = selCat==="todas" ? todasLaminas : todasLaminas.filter(l=>l.categoria===selCat);

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
        {filtradas.map(lam => {
          // Bug 7 fix: clave es lam.file
          const cant  = laminas?.[lam.file] || 0;
          const tiene = cant > 0;
          return (
            <div key={lam.file} onClick={() => tiene && setLaminaSel(lam)}
              style={{ width:"60px",cursor:tiene?"pointer":"default",
                opacity:tiene?1:0.3,filter:tiene?"none":"grayscale(100%)",textAlign:"center" }}>
              <div style={{ width:"60px",height:"80px",
                border:`2px solid ${tiene?"var(--verde-claro)":"var(--gris)"}`,
                overflow:"hidden",boxShadow:tiene?"2px 2px 0 var(--negro)":"none" }}>
                {/* Bug 7 fix: usar lam.url */}
                <img src={lam.url} alt={lam.nombre}
                  style={{ width:"100%",height:"100%",objectFit:"cover",imageRendering:"pixelated" }}
                  onError={e=>{ e.target.src="/sobre/lamina-placeholder.png"; }} />
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

      {/* Lightbox */}
      {laminaSel && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:900,
          display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}
          onClick={()=>setLaminaSel(null)}>
          <div style={{ background:"var(--negro)",border:"4px solid var(--verde-claro)",
            padding:"20px",maxWidth:"300px",width:"100%",textAlign:"center" }}
            onClick={e=>e.stopPropagation()}>
            <img src={laminaSel.url} alt={laminaSel.nombre}
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
            <button className="btn-pixel btn-gris w-full"
              style={{ marginTop:"12px",fontSize:"7px" }}
              onClick={()=>setLaminaSel(null)}>CERRAR ✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Canje ─────────────────────────────────────────────────────
function CanjeLaminas({ laminas, todasLaminas, uid, onCanje }) {
  const [canjeando, setCanjeando] = useState(false);
  const [selLam,    setSelLam]    = useState(null);
  const [msg,       setMsg]       = useState(null);

  const REGLAS = [
    { cantidad:5,  mult:2, label:"5 repetidas → carta ×2" },
    { cantidad:8,  mult:3, label:"8 repetidas → carta ×3" },
    { cantidad:10, mult:4, label:"10 repetidas → carta ×4" },
  ];

  const repetidas = todasLaminas.filter(l=>(laminas?.[l.file]||0)>1)
    .map(l=>({...l,cant:laminas[l.file]}));

  const canjear = async (regla) => {
    if (!selLam||(laminas?.[selLam.file]||0)<regla.cantidad) {
      setMsg({tipo:"error",texto:`Necesitas ${regla.cantidad} copias.`}); return;
    }
    setCanjeando(true);
    try {
      await updateDoc(doc(db,"usuarios",uid),{
        [`laminas.${selLam.file}`]:fbIncrement(-regla.cantidad),
      });
      const carta = cartaAleatoriaPorMultiplicador(regla.mult);
      if (carta) {
        await setDoc(doc(db,"cartasDelUsuario",
          `${uid}_${carta.id}_canje_${Date.now()}`),{
          uid,cartaId:carta.id,cartaNombre:carta.nombre,
          cartaSlug:carta.slug,multiplicador:carta.multiplicador,
          rareza:carta.rareza,fecha:hoyStr(),
          visto:false, // Esta sí se notifica (origen vacío = podio/normal)
          origen:"",
        });
        await updateDoc(doc(db,"usuarios",uid),{
          [`cartas.${carta.id}`]:fbIncrement(1),
        });
      }
      setMsg({tipo:"ok",texto:`✅ Canjeaste ${regla.cantidad} "${selLam.nombre}" por carta ×${regla.mult}!`});
      onCanje();
    } catch(e){ setMsg({tipo:"error",texto:e.message}); }
    finally { setCanjeando(false); }
  };

  return (
    <div>
      <p style={{ fontSize:"7px",color:"var(--amarillo)",marginBottom:"8px" }}>CANJE</p>
      {msg && (
        <p style={{ fontSize:"6px",
          color:msg.tipo==="ok"?"var(--verde-claro)":"var(--rojo-chile)",
          marginBottom:"10px",lineHeight:2 }}>{msg.texto}</p>
      )}
      {repetidas.length===0 ? (
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
          Sin láminas repetidas para canjear.
        </p>
      ) : (
        <>
          <p style={{ fontSize:"6px",color:"var(--gris-claro)",marginBottom:"8px",lineHeight:2 }}>
            Selecciona una lámina repetida:
          </p>
          <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"12px" }}>
            {repetidas.map(l=>(
              <div key={l.file} onClick={()=>setSelLam(l)}
                style={{ width:"56px",cursor:"pointer",textAlign:"center",
                  border:`2px solid ${selLam?.file===l.file?"var(--amarillo)":"var(--gris)"}`,
                  padding:"2px",
                  background:selLam?.file===l.file?"rgba(244,208,63,0.1)":"transparent" }}>
                <img src={l.url} alt={l.nombre}
                  style={{ width:"52px",height:"70px",objectFit:"cover" }} />
                <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"5px",
                  color:"var(--amarillo)",display:"block" }}>×{l.cant}</span>
              </div>
            ))}
          </div>
          {selLam && (
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {REGLAS.filter(r=>(laminas?.[selLam.file]||0)>=r.cantidad).map(r=>(
                <button key={r.mult}
                  className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"6px" }}
                  onClick={()=>canjear(r)} disabled={canjeando}>
                  {canjeando?"⚙ ...":r.label}
                </button>
              ))}
              {REGLAS.every(r=>(laminas?.[selLam.file]||0)<r.cantidad) && (
                <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                  Tienes ×{laminas?.[selLam.file]||0}. Mínimo 5 para canjear.
                </p>
              )}
            </div>
          )}
        </>
      )}
      <div style={{ marginTop:"14px",padding:"10px",
        border:"1px solid var(--verde-campo)",background:"rgba(0,0,0,0.2)" }}>
        <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
          5 repetidas → ×2 | 8 → ×3 | 10 → ×4
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
const LS_SOBRE_KEY = "cp8b_sobre_";

export default function SeccionLaminas() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [tab,         setTab]         = useState("sobre");
  const [todasLaminas,setTodasLaminas]= useState([]);   // catálogo completo
  const [cargandoCat, setCargandoCat] = useState(true);
  const [errorCat,    setErrorCat]    = useState(null);

  // Estado del sobre
  const [sobreDisponible, setSobreDisponible]  = useState(false);
  const [laminasNuevas,   setLaminasNuevas]    = useState([]);
  const [sobreAbierto,    setSobreAbierto]     = useState(false);
  const [volteadas,       setVolteadas]        = useState(0);
  const [guardandoSobre,  setGuardandoSobre]   = useState(false);
  const [sobreGuardado,   setSobreGuardado]    = useState(false);
  const [posRanking,      setPosRanking]       = useState(null);

  const laminas = userProfile?.laminas || {};
  const hoy     = hoyStr();
  const lsKey   = LS_SOBRE_KEY + (firebaseUser?.uid||"") + "_" + hoy;

  // Bug 7 fix: fetch correcto de cards.json
  useEffect(() => {
    fetch(CARDS_URL)
      .then(r => r.json())
      .then(d => {
        // La API retorna { laminas: [...], categorias: [...] }
        const lista = Array.isArray(d) ? d : (d.laminas || []);
        setTodasLaminas(lista);
      })
      .catch(e => {
        console.error("Error cargando catálogo:", e);
        setErrorCat("No se pudo cargar el catálogo de láminas.");
      })
      .finally(() => setCargandoCat(false));
  }, []);

  // Verificar si puede abrir sobre
  useEffect(() => {
    if (!firebaseUser || !userProfile) return;
    const yaLS       = localStorage.getItem(lsKey);
    const yaFirestore = userProfile.ultimoSobre === hoy;
    setSobreDisponible(!yaLS && !yaFirestore);
  }, [firebaseUser, userProfile, hoy, lsKey]);

  // Preparar láminas al tener catálogo y poder abrir
  const prepararSobre = useCallback(async () => {
    if (!sobreDisponible || todasLaminas.length === 0 || !firebaseUser) return;

    let pos = 999;
    try {
      const { getDocs, query, collection, orderBy } = await import("firebase/firestore");
      const snap = await getDocs(query(collection(db,"usuarios"),orderBy("puntosTotal","desc")));
      const idx  = snap.docs.findIndex(d => d.id === firebaseUser.uid);
      pos        = idx >= 0 ? idx + 1 : 999;
    } catch (_) {}
    setPosRanking(pos);

    const { numLam } = laminasPorPosicion(pos);
    const shuffled   = [...todasLaminas].sort(() => Math.random() - 0.5);
    setLaminasNuevas(shuffled.slice(0, numLam));
    setVolteadas(0);
    setSobreGuardado(false);
  }, [sobreDisponible, todasLaminas, firebaseUser]);

  useEffect(() => { prepararSobre(); }, [prepararSobre]);

  const guardarLaminas = async () => {
    if (!firebaseUser || laminasNuevas.length === 0) return;
    setGuardandoSobre(true);
    try {
      const updates = {};
      for (const lam of laminasNuevas) {
        updates[`laminas.${lam.file}`] = fbIncrement(1);
      }
      updates["ultimoSobre"] = hoy;

      // Cartas del sobre (si corresponden por posición)
      const { cartaMult, cartaCant } = laminasPorPosicion(posRanking || 999);
      if (cartaMult && cartaCant > 0) {
        for (let i = 0; i < cartaCant; i++) {
          const carta = cartaAleatoriaPorMultiplicador(cartaMult);
          if (carta) {
            // Bug 6 fix: visto:true para NO mostrar en NotificacionCartas
            // El usuario ya las vio aquí al abrir el sobre
            await setDoc(doc(db,"cartasDelUsuario",
              `${firebaseUser.uid}_${carta.id}_sobre_${Date.now()}_${i}`),{
              uid:           firebaseUser.uid,
              cartaId:       carta.id,
              cartaNombre:   carta.nombre,
              cartaSlug:     carta.slug,
              multiplicador: carta.multiplicador,
              rareza:        carta.rareza,
              fecha:         hoy,
              visto:         true,   // ← ya vista, no notificar
              origen:        "sobre",
            });
            updates[`cartas.${carta.id}`] = fbIncrement(1);
          }
        }
      }

      await updateDoc(doc(db,"usuarios",firebaseUser.uid), updates);
      localStorage.setItem(lsKey, "1"); // no volver a abrir hoy
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

      <div style={{ display:"flex",gap:"4px",marginBottom:"14px" }}>
        {[
          {id:"sobre",     label:"📦 SOBRE DEL DÍA"},
          {id:"coleccion", label:"📚 COLECCIÓN"},
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
      {tab==="sobre" && (
        <div>
          {!sobreDisponible && !sobreAbierto ? (
            <div className="caja-pixel text-center">
              <p style={{ fontSize:"8px",color:"var(--gris-claro)" }}>📦</p>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginTop:"8px",lineHeight:2 }}>
                Ya abriste tu sobre de hoy.<br/>Vuelve mañana.
              </p>
            </div>
          ) : cargandoCat ? (
            <div className="text-center" style={{ padding:"20px" }}>
              <span className="spinner">⚙</span>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginTop:"8px" }}>
                Cargando catálogo...
              </p>
            </div>
          ) : errorCat ? (
            <div className="caja-pixel text-center">
              <p style={{ fontSize:"6px",color:"var(--rojo-chile)",lineHeight:2 }}>{errorCat}</p>
              <p style={{ fontSize:"5px",color:"var(--gris-claro)",marginTop:"8px",lineHeight:2 }}>
                Verifica tu conexión o intenta de nuevo más tarde.
              </p>
            </div>
          ) : !sobreAbierto && laminasNuevas.length > 0 ? (
            <SobreAnimado onAbrir={() => setSobreAbierto(true)} />
          ) : sobreAbierto ? (
            <div>
              <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                color:"var(--amarillo)",textAlign:"center",marginBottom:"12px" }}>
                ¡Da vuelta tus láminas!
              </p>
              <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",
                gap:"8px",marginBottom:"14px" }}>
                {laminasNuevas.map((lam,i) => (
                  <LaminaNueva key={lam.file+i} lamina={lam} idx={i}
                    onDarVuelta={() => setVolteadas(v=>v+1)} />
                ))}
              </div>
              {volteadas >= laminasNuevas.length && !sobreGuardado && (
                <button className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"7px" }}
                  onClick={guardarLaminas} disabled={guardandoSobre}>
                  {guardandoSobre ? "⚙ GUARDANDO..." : "💾 GUARDAR MIS LÁMINAS"}
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
            <div className="text-center" style={{ padding:"20px" }}>
              <span className="spinner">⚙</span>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginTop:"8px" }}>
                Preparando sobre...
              </p>
            </div>
          )}
        </div>
      )}

      {tab==="coleccion" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
              Cargando catálogo...
            </p>
          : errorCat
            ? <p style={{ fontSize:"6px",color:"var(--rojo-chile)",padding:"8px" }}>{errorCat}</p>
            : <Coleccion laminas={laminas} todasLaminas={todasLaminas} />
      )}

      {tab==="canje" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
              Cargando...
            </p>
          : <CanjeLaminas
              laminas={laminas}
              todasLaminas={todasLaminas}
              uid={firebaseUser.uid}
              onCanje={refreshProfile}
            />
      )}
    </div>
  );
}
