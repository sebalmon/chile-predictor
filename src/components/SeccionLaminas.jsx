// src/components/SeccionLaminas.jsx  — v3 (Bugfix 2)
// ─────────────────────────────────────────────────────────────
// BUGS CORREGIDOS:
//   Bug 6:  Entrega solo 1 sobre por día (localStorage + Firestore)
//   Bug 8:  Siempre 4 láminas por sobre (no depende del ranking)
//   Bug 9:  Las láminas del sobre se persisten en localStorage
//           → al recargar, las mismas láminas siguen ahí
//   Bug 10: Botón "GUARDAR MIS LÁMINAS" guarda en Firestore
//           sin recargar la app. Muestra mensaje de confirmación.
//   Bug 11: Clic en lámina abre lightbox con imagen grande.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  doc, getDoc, updateDoc, setDoc,
  increment as fbIncrement,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";

const CARDS_URL = "https://kvtral.github.io/laminas_16_bits/cards.json";
const LAMINAS_POR_SOBRE = 4; // Bug 8: siempre 4

// LocalStorage keys
const lsKeyHoy      = (uid) => `cp8b_sobre_${uid}_${hoyStr()}`;
const lsKeySobreDia = (uid) => `cp8b_sobre_laminas_${uid}_${hoyStr()}`;

function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
    <div style={{ textAlign:"center", padding:"20px" }}>
      <div onClick={!abierto ? abrir : undefined}
        style={{ display:"inline-block", cursor:abierto?"default":"pointer" }}>
        <div style={{ position:"relative", width:"140px", height:"100px", margin:"0 auto 14px" }}>
          <img
            src={abierto ? "/sobre/sobre-abierto.png" : "/sobre/sobre-cerrado.png"}
            alt="sobre"
            style={{ width:"140px",height:"100px",imageRendering:"pixelated",objectFit:"contain" }}
            onError={e => {
              e.target.style.display = "none";
              if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
            }}
          />
          <div style={{
            display:"none", width:"140px", height:"100px",
            background:abierto?"#f4d03f":"#e8a020",
            border:"4px solid var(--negro)", boxShadow:"4px 4px 0 var(--negro)",
            alignItems:"center", justifyContent:"center", fontSize:"48px",
          }}>
            {abierto ? "📬" : "📦"}
          </div>
        </div>
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"8px",
          color:abierto?"var(--verde-claro)":"var(--amarillo)" }}>
          {abierto ? "¡ABRIENDO!" : "👆 TOCA PARA ABRIR"}
        </p>
      </div>
      <style>{`
        @keyframes laminaSale {
          0%  { opacity:0; transform:translateY(40px) scale(.7); }
          100%{ opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Lámina con flip ───────────────────────────────────────────
function LaminaNueva({ lamina, idx, onDarVuelta, onClick }) {
  const [volteada, setVolteada] = useState(false);
  const dar = () => {
    if (volteada) { onClick(lamina); return; }
    setVolteada(true);
    onDarVuelta();
  };
  return (
    <div onClick={dar}
      style={{ width:"76px", cursor:"pointer", textAlign:"center",
        animation:`laminaSale 0.5s ease ${idx*0.15}s both` }}>
      <div style={{ width:"76px", height:"106px",
        border: volteada ? "3px solid var(--verde-claro)" : "3px solid var(--amarillo)",
        boxShadow:"3px 3px 0 var(--negro)", overflow:"hidden",
        background: volteada ? "transparent" : "linear-gradient(135deg,#1a1a5e,#4a0e8f)",
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        {!volteada
          ? <span style={{ fontSize:"28px" }}>🃏</span>
          : <img src={lamina.url} alt={lamina.nombre}
              style={{ width:"100%",height:"100%",objectFit:"cover" }} />
        }
      </div>
      {volteada && (
        <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"4px",
          color:"var(--blanco)",marginTop:"3px",lineHeight:1.4,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
          {lamina.nombre}
        </p>
      )}
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({ lamina, onCerrar }) {
  if (!lamina) return null;
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.96)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}
      onClick={onCerrar}>
      <div style={{ background:"var(--negro)",border:"4px solid var(--verde-claro)",
        padding:"16px",maxWidth:"340px",width:"100%",textAlign:"center" }}
        onClick={e=>e.stopPropagation()}>
        <img src={lamina.url} alt={lamina.nombre}
          style={{ width:"100%",maxHeight:"320px",objectFit:"contain",
            imageRendering:"pixelated",border:"2px solid var(--negro)" }} />
        <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
          color:"var(--amarillo)",marginTop:"12px",lineHeight:1.8 }}>
          {lamina.nombre}
        </p>
        {lamina.categoria && (
          <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
            color:"var(--gris-claro)",marginTop:"4px" }}>#{lamina.categoria}</p>
        )}
        <button className="btn-pixel btn-gris w-full" style={{ marginTop:"12px",fontSize:"7px" }}
          onClick={onCerrar}>CERRAR ✕</button>
      </div>
    </div>
  );
}

// ── Colección ─────────────────────────────────────────────────
function Coleccion({ laminas, todasLaminas, onClickLamina }) {
  const [selCat, setSelCat] = useState("todas");
  if (!todasLaminas.length) return (
    <p style={{ fontSize:"6px",color:"var(--gris-claro)",padding:"16px",textAlign:"center" }}>
      Cargando catálogo...
    </p>
  );
  const cats     = ["todas",...new Set(todasLaminas.map(l=>l.categoria).filter(Boolean))];
  const filtradas= selCat==="todas"?todasLaminas:todasLaminas.filter(l=>l.categoria===selCat);

  return (
    <div>
      <div style={{ display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"12px" }}>
        {cats.map(cat => (
          <button key={cat}
            className={`btn-pixel ${selCat===cat?"btn-amarillo":"btn-gris"}`}
            style={{ fontSize:"5px",padding:"4px 7px" }}
            onClick={()=>setSelCat(cat)}>
            {cat}
          </button>
        ))}
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
        {filtradas.map(lam => {
          const cant  = laminas?.[lam.file]||0;
          const tiene = cant>0;
          return (
            <div key={lam.file}
              onClick={()=>tiene&&onClickLamina(lam)}
              style={{ width:"60px",cursor:tiene?"pointer":"default",
                opacity:tiene?1:0.3,filter:tiene?"none":"grayscale(100%)",textAlign:"center" }}>
              <div style={{ width:"60px",height:"80px",
                border:`2px solid ${tiene?"var(--verde-claro)":"var(--gris)"}`,
                overflow:"hidden",boxShadow:tiene?"2px 2px 0 var(--negro)":"none" }}>
                <img src={lam.url} alt={lam.nombre}
                  style={{ width:"100%",height:"100%",objectFit:"cover",imageRendering:"pixelated" }}
                  onError={e=>{e.target.src="/sobre/lamina-placeholder.png";}} />
              </div>
              {cant>1 && (
                <span style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"5px",
                  color:"var(--amarillo)",display:"block",marginTop:"2px" }}>×{cant}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Canje ─────────────────────────────────────────────────────
function CanjeLaminas({ laminas, todasLaminas, uid, onCanje }) {
  const [selLam,    setSelLam]    = useState(null);
  const [canjeando, setCanjeando] = useState(false);
  const [msg,       setMsg]       = useState(null);

  const REGLAS = [
    {cantidad:5, mult:2, label:"5 repetidas → carta ×2"},
    {cantidad:8, mult:3, label:"8 repetidas → carta ×3"},
    {cantidad:10,mult:4, label:"10 repetidas → carta ×4"},
  ];

  const repetidas = todasLaminas
    .filter(l=>(laminas?.[l.file]||0)>1)
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
        await setDoc(doc(db,"cartasDelUsuario",`${uid}_${carta.id}_canje_${Date.now()}`),{
          uid,cartaId:carta.id,cartaNombre:carta.nombre,
          cartaSlug:carta.slug,multiplicador:carta.multiplicador,
          rareza:carta.rareza,fecha:hoyStr(),visto:false,origen:"canje",
        });
        await updateDoc(doc(db,"usuarios",uid),{[`cartas.${carta.id}`]:fbIncrement(1)});
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
        <p style={{ fontSize:"6px",lineHeight:2,marginBottom:"10px",
          color:msg.tipo==="ok"?"var(--verde-claro)":"var(--rojo-chile)" }}>
          {msg.texto}
        </p>
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
              {REGLAS.every(r=>(laminas?.[selLam.file]||0)<r.cantidad)&&(
                <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                  Mínimo 5 copias para canjear.
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
export default function SeccionLaminas() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();

  const [tab,          setTab]          = useState("sobre");
  const [todasLaminas, setTodasLaminas] = useState([]);
  const [cargandoCat,  setCargandoCat]  = useState(true);
  const [errorCat,     setErrorCat]     = useState(null);
  const [lightbox,     setLightbox]     = useState(null);

  // Sobre del día
  const [sobreDisponible, setSobreDisponible] = useState(false);
  const [laminasNuevas,   setLaminasNuevas]   = useState([]); // Bug 9: las mismas al recargar
  const [sobreAbierto,    setSobreAbierto]     = useState(false);
  const [volteadas,       setVolteadas]        = useState(0);
  const [guardando,       setGuardando]        = useState(false);
  const [guardado,        setGuardado]         = useState(false);
  const [msgGuardado,     setMsgGuardado]      = useState(null);

  const laminas = userProfile?.laminas || {};
  const uid     = firebaseUser?.uid;
  const hoy     = hoyStr();

  // Cargar catálogo
  useEffect(() => {
    fetch(CARDS_URL)
      .then(r => r.json())
      .then(d => {
        // API retorna { laminas: [...], categorias: [...] }
        const lista = Array.isArray(d) ? d : (d.laminas || []);
        setTodasLaminas(lista);
      })
      .catch(e => { console.error(e); setErrorCat("No se pudo cargar el catálogo."); })
      .finally(() => setCargandoCat(false));
  }, []);

  // Bug 6 + 9: verificar si puede abrir sobre y restaurar láminas del día
  useEffect(() => {
    if (!uid) return;

    // Bug 9: ¿hay láminas guardadas en localStorage para hoy?
    const lsKey = lsKeySobreDia(uid);
    const guardadasHoy = localStorage.getItem(lsKey);
    if (guardadasHoy) {
      try {
        const lamsPersistidas = JSON.parse(guardadasHoy);
        setLaminasNuevas(lamsPersistidas);
        // Si ya estaban guardadas en Firestore, el sobre está cerrado
        const yaGuardado = localStorage.getItem(lsKeyHoy(uid));
        if (yaGuardado === "guardado") {
          setSobreDisponible(false);
          setGuardado(true);
        } else {
          // Tenemos láminas pero no se guardaron → mostrar sobre ya abierto
          setSobreDisponible(false);
          setSobreAbierto(true);
        }
        return;
      } catch(_) {}
    }

    // Bug 6: verificar si ya abrió sobre hoy (Firestore)
    const verificar = async () => {
      try {
        const uSnap = await getDoc(doc(db,"usuarios",uid));
        const ultimoSobre = uSnap.exists() ? uSnap.data().ultimoSobre : null;
        if (ultimoSobre === hoy) {
          setSobreDisponible(false);
          setGuardado(true);
        } else {
          setSobreDisponible(true);
        }
      } catch(_) { setSobreDisponible(true); }
    };
    verificar();
  }, [uid, hoy]);

  // Bug 8 + 9: preparar 4 láminas al azar y persistirlas en localStorage
  const prepararSobre = useCallback(() => {
    if (!sobreDisponible || todasLaminas.length === 0 || !uid) return;
    const lsKey = lsKeySobreDia(uid);
    if (localStorage.getItem(lsKey)) return; // ya preparadas

    // Bug 8: siempre 4
    const shuffled = [...todasLaminas].sort(() => Math.random() - 0.5);
    const seleccionadas = shuffled.slice(0, LAMINAS_POR_SOBRE);
    setLaminasNuevas(seleccionadas);

    // Bug 9: persistir en localStorage ANTES de mostrarlas
    localStorage.setItem(lsKey, JSON.stringify(seleccionadas));
  }, [sobreDisponible, todasLaminas, uid]);

  useEffect(() => { prepararSobre(); }, [prepararSobre]);

  // Bug 10: guardar láminas en Firestore SIN recargar
  const guardarLaminas = async () => {
    if (!uid || laminasNuevas.length === 0 || guardando) return;
    setGuardando(true);
    setMsgGuardado(null);
    try {
      const updates = { ultimoSobre: hoy };
      for (const lam of laminasNuevas) {
        updates[`laminas.${lam.file}`] = fbIncrement(1);
      }
      await updateDoc(doc(db,"usuarios",uid), updates);

      // Marcar como guardado en localStorage
      localStorage.setItem(lsKeyHoy(uid), "guardado");

      setGuardado(true);
      setMsgGuardado("✅ ¡Láminas guardadas en tu colección!");

      // Refrescar perfil sin recargar página
      if (refreshProfile) await refreshProfile();
    } catch(e) {
      setMsgGuardado(`❌ Error al guardar: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  };

  if (!firebaseUser) return null;

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      {/* Bug 11: Lightbox */}
      <Lightbox lamina={lightbox} onCerrar={() => setLightbox(null)} />

      <div className="seccion-titulo">🃏 LÁMINAS COLECCIONABLES</div>

      <div style={{ display:"flex",gap:"4px",marginBottom:"14px" }}>
        {[
          {id:"sobre",     label:"📦 SOBRE"},
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

      {/* ── SOBRE ──────────────────────────────────────────── */}
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
          ) : !sobreDisponible && !sobreAbierto && guardado ? (
            <div className="caja-pixel text-center">
              <p style={{ fontSize:"8px",color:"var(--gris-claro)" }}>📦</p>
              <p style={{ fontSize:"7px",color:"var(--gris-claro)",marginTop:"8px",lineHeight:2 }}>
                Ya abriste tu sobre de hoy.<br/>Vuelve mañana para el siguiente.
              </p>
            </div>
          ) : sobreDisponible && !sobreAbierto ? (
            <SobreAnimado onAbrir={() => setSobreAbierto(true)} />
          ) : laminasNuevas.length > 0 ? (
            <div>
              <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                color:"var(--amarillo)",textAlign:"center",marginBottom:"12px" }}>
                {guardado ? "TUS LÁMINAS DE HOY" : "¡Da vuelta tus láminas!"}
              </p>
              <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",
                gap:"8px",marginBottom:"14px" }}>
                {laminasNuevas.map((lam,i) => (
                  <LaminaNueva
                    key={lam.file+i}
                    lamina={lam}
                    idx={i}
                    onDarVuelta={() => setVolteadas(v=>v+1)}
                    onClick={setLightbox}
                  />
                ))}
              </div>

              {/* Bug 10: botón guardar corregido */}
              {!guardado && volteadas >= laminasNuevas.length && (
                <button
                  className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"7px" }}
                  onClick={guardarLaminas}
                  disabled={guardando}>
                  {guardando ? "⚙ GUARDANDO..." : "💾 GUARDAR MIS LÁMINAS"}
                </button>
              )}

              {msgGuardado && (
                <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                  color:"var(--verde-claro)",textAlign:"center",marginTop:"10px",lineHeight:2 }}>
                  {msgGuardado}
                </p>
              )}

              {guardado && !msgGuardado && (
                <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                  color:"var(--gris-claro)",textAlign:"center",lineHeight:2,marginTop:"8px" }}>
                  ✅ Láminas ya guardadas. Vuelve mañana para un nuevo sobre.
                </p>
              )}

              {!guardado && volteadas < laminasNuevas.length && (
                <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                  color:"var(--gris-claro)",textAlign:"center",lineHeight:2 }}>
                  Toca cada lámina para darle vuelta ({volteadas}/{laminasNuevas.length})
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

      {/* ── COLECCIÓN ──────────────────────────────────────── */}
      {tab === "coleccion" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>Cargando...</p>
          : <Coleccion laminas={laminas} todasLaminas={todasLaminas} onClickLamina={setLightbox} />
      )}

      {/* ── CANJE ──────────────────────────────────────────── */}
      {tab === "canje" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>Cargando...</p>
          : <CanjeLaminas
              laminas={laminas}
              todasLaminas={todasLaminas}
              uid={uid}
              onCanje={refreshProfile}
            />
      )}
    </div>
  );
}
