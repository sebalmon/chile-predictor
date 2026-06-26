// src/components/SeccionLaminas.jsx  — v13 (Mapeo de abreviaturas a nombres completos)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v13:
//   • Mapeo de abreviaturas (BA, CA, CU, FO, HA, ME, OB, RE) a nombres completos.
//   • Asignación de íconos para cada categoría.
//   • Muestra el nombre completo en los cuadros del álbum.
//   • Persistencia, guardado y canje intactos.
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  doc, getDoc, updateDoc, setDoc, increment as fbIncrement,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";

const CARDS_URL = "https://kvtral.github.io/laminas_16_bits/cards.json";
const LAMINAS_POR_SOBRE = 4;

function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
        {lamina.descripcion && (
          <p style={{
            fontFamily:"'Press Start 2P',monospace", fontSize:"5px",
            color:"var(--verde-claro)", marginBottom:"14px",
            lineHeight:1.8, maxHeight:"100px", overflow:"auto",
          }}>
            {lamina.descripcion}
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

// ── Lámina con flip ───────────────────────────────────────
function LaminaFlip({ lamina, idx, onVoltear, yaVolteada, onClick }) {
  const [volteada, setVolteada] = useState(yaVolteada);

  const dar = () => {
    if (volteada) {
      onClick(lamina);
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

// ── Colección (Álbum + Detalle) ──────────────────────────────
function Coleccion({ laminasUsuario, todasLaminas, onClickLamina }) {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  if (!todasLaminas || todasLaminas.length === 0) {
    return (
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",padding:"16px",textAlign:"center" }}>
        Cargando catálogo...
      </p>
    );
  }

  // ─── MAPEO DE ABREVIATURAS A NOMBRES COMPLETOS ─────────────
  const mapaCategorias = {
    "BA": "BARRIO",
    "CA": "CANTERA",
    "CU": "CULTO",
    "FO": "FOSIL",
    "HA": "HAZARA",
    "ME": "MEMORIA",
    "OB": "OBRERO",
    "RE": "REBELDE",
  };

  const iconosPorCategoria = {
    "BARRIO": "🏘️",
    "CANTERA": "🌱",
    "CULTO": "⛪",
    "FOSIL": "🦴",
    "HAZARA": "⚡",
    "MEMORIA": "📜",
    "OBRERO": "🔧",
    "REBELDE": "✊",
  };

  // Obtener abreviatura única de los datos
  const categoriasAbr = [...new Set(todasLaminas.map(l => l.categoria?.trim() || "Sin"))].sort();

  // Crear lista de categorías con nombre completo
  const categoriasCompletas = categoriasAbr.map(abr => ({
    abreviatura: abr,
    nombre: mapaCategorias[abr] || abr,
  }));

  // Agrupar por abreviatura para contar láminas
  const categoriasMap = {};
  todasLaminas.forEach(l => {
    const cat = l.categoria?.trim() || "Sin";
    categoriasMap[cat] = (categoriasMap[cat] || 0) + 1;
  });

  // Función para obtener nombre completo desde abreviatura
  const getNombreCompleto = (abr) => mapaCategorias[abr] || abr;

  // Función para obtener ícono desde nombre completo
  const getIcono = (nombre) => iconosPorCategoria[nombre] || "🃏";

  // ─── VISTA DETALLE (categoría seleccionada) ──────────────
  if (categoriaSeleccionada) {
    const abreviaturaSel = categoriaSeleccionada;
    const nombreCompleto = getNombreCompleto(abreviaturaSel);
    const icono = getIcono(nombreCompleto);

    const laminasCategoria = todasLaminas
      .filter(l => (l.categoria?.trim() || "Sin") === abreviaturaSel)
      .sort((a, b) => {
        const numA = parseInt(a.file.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.file.match(/\d+/)?.[0] || 0);
        return numA - numB;
      });

    const total = categoriasMap[abreviaturaSel] || 0;
    const obtenidas = laminasCategoria.filter(l => (laminasUsuario?.[l.file] || 0) > 0).length;

    return (
      <div style={{
        background: "#0a0a0a",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "16px 16px",
        padding: "20px 16px",
        borderRadius: "4px",
        border: "2px solid var(--verde-campo)",
        minHeight: "400px",
      }}>
        <button
          onClick={() => setCategoriaSeleccionada(null)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "6px",
            background: "rgba(255,255,255,0.05)",
            color: "var(--amarillo)",
            border: "1px solid var(--amarillo)",
            padding: "4px 10px",
            cursor: "pointer",
            marginBottom: "16px",
            boxShadow: "2px 2px 0 var(--negro)",
          }}
        >
          ← VOLVER
        </button>

        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "12px",
          color: "var(--amarillo)",
          textAlign: "center",
          paddingBottom: "8px",
          borderBottom: "2px solid var(--verde-campo)",
          marginBottom: "12px",
          letterSpacing: "2px",
          textShadow: "2px 2px 0 var(--negro)",
        }}>
          {icono} {nombreCompleto}
        </div>

        <div style={{
          padding:"4px 10px",
          marginBottom:"16px",
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "5px",
            color: "var(--gris-claro)",
          }}>
            COLECCIÓN
          </span>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "6px",
            color: "var(--amarillo)",
            background: "rgba(0,0,0,0.6)",
            padding: "2px 8px",
            border: "1px solid var(--amarillo)",
          }}>
            {obtenidas} / {total}
          </span>
        </div>

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "16px",
          padding: "4px 0",
        }}>
          {laminasCategoria.map((lam) => {
            const cantidad = laminasUsuario?.[lam.file] || 0;
            const tiene = cantidad > 0;
            const anio = lam.file.match(/\d+/)?.[0] || "";

            return (
              <div
                key={lam.file}
                onClick={() => tiene && onClickLamina(lam, cantidad)}
                style={{
                  width: "140px",
                  cursor: tiene ? "pointer" : "default",
                  textAlign: "center",
                  transition: "transform 0.15s",
                  transform: tiene ? "scale(1)" : "scale(0.95)",
                  background: "rgba(0,0,0,0.4)",
                  padding: "8px 6px 10px",
                  border: tiene
                    ? "2px solid var(--verde-claro)"
                    : "2px solid rgba(255,255,255,0.05)",
                  boxShadow: tiene
                    ? "4px 4px 0 var(--negro)"
                    : "2px 2px 0 rgba(0,0,0,0.5)",
                }}
                title={tiene ? `${lam.nombre} — clic para ampliar` : lam.nombre}
              >
                <div style={{
                  width: "100%",
                  aspectRatio: "5/7",
                  overflow: "hidden",
                  background: tiene ? "transparent" : "rgba(0,0,0,0.6)",
                  position: "relative",
                  imageRendering: "pixelated",
                  marginBottom: "6px",
                }}>
                  <img
                    src={lam.url}
                    alt={lam.nombre}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      imageRendering: "pixelated",
                      filter: tiene ? "none" : "grayscale(100%) brightness(0.25)",
                      transition: "filter 0.2s",
                    }}
                    onError={(e) => { e.target.src = "/sobre/lamina-placeholder.png"; }}
                  />
                  {!tiene && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.4)",
                    }}>
                      <span style={{ fontSize: "28px", opacity: 0.4 }}>🔒</span>
                    </div>
                  )}
                </div>

                <div style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "6px",
                  color: tiene ? "var(--amarillo)" : "rgba(255,255,255,0.15)",
                  textShadow: tiene ? "2px 2px 0 var(--negro)" : "none",
                  marginBottom: "4px",
                  letterSpacing: "0.5px",
                }}>
                  {nombreCompleto} {anio}
                </div>

                <div style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "5px",
                  color: tiene ? "var(--blanco)" : "rgba(255,255,255,0.1)",
                  textShadow: tiene ? "1px 1px 0 var(--negro)" : "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: "4px",
                }}>
                  {lam.nombre}
                </div>

                {lam.descripcion && tiene && (
                  <div style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: "4px",
                    color: "var(--gris-claro)",
                    lineHeight: 1.6,
                    maxHeight: "40px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    opacity: 0.8,
                  }}>
                    {lam.descripcion}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── VISTA ÁLBUM ──────────────────────────────────────────
  const totalGlobal = todasLaminas.length;
  const obtenidasGlobal = todasLaminas.filter(l => (laminasUsuario?.[l.file] || 0) > 0).length;

  return (
    <div style={{
      background: "#0a0a0a",
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
      `,
      backgroundSize: "16px 16px",
      padding: "24px 16px",
      borderRadius: "4px",
      border: "2px solid var(--verde-campo)",
      minHeight: "400px",
      textAlign: "center",
    }}>
      {/* Título con degradado */}
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "28px",
        fontWeight: "bold",
        background: "linear-gradient(135deg, #f4d03f 40%, #e74c3c 60%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "4px 4px 0 rgba(0,0,0,0.8)",
        letterSpacing: "6px",
        paddingBottom: "6px",
        marginBottom: "4px",
      }}>
        ALBUM
      </div>

      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "7px",
        color: "var(--gris-claro)",
        letterSpacing: "2px",
        marginBottom: "24px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        paddingBottom: "12px",
      }}>
        SELECCIONA CATEGORIA
      </div>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "16px",
      }}>
        {categoriasCompletas.map(({ abreviatura, nombre }) => {
          const count = categoriasMap[abreviatura] || 0;
          const icono = getIcono(nombre);

          return (
            <div
              key={abreviatura}
              onClick={() => setCategoriaSeleccionada(abreviatura)}
              style={{
                width: "180px",
                padding: "16px 8px",
                background: "rgba(0,0,0,0.5)",
                border: "2px solid rgba(255,255,255,0.1)",
                boxShadow: "3px 3px 0 var(--negro)",
                cursor: "pointer",
                transition: "transform 0.1s, border-color 0.1s",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--amarillo)";
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <div style={{
                fontSize: "34px",
                lineHeight: 1.2,
                filter: "drop-shadow(2px 2px 0 var(--negro))",
              }}>
                {icono}
              </div>

              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "5px",
                color: "var(--amarillo)",
                letterSpacing: "0.5px",
                textShadow: "2px 2px 0 var(--negro)",
                wordWrap: "break-word",
                whiteSpace: "normal",
                maxWidth: "100%",
                lineHeight: 1.6,
              }}>
                {nombre}
              </div>

              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "5px",
                color: "var(--gris-claro)",
                background: "rgba(0,0,0,0.6)",
                padding: "2px 8px",
                border: "1px solid rgba(255,255,255,0.05)",
                marginTop: "2px",
              }}>
                {count} {count === 1 ? "LÁMINA" : "LÁMINAS"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: "24px",
        padding: "6px 12px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "5px",
        color: "var(--gris-claro)",
      }}>
        COLECCIÓN: {obtenidasGlobal} / {totalGlobal} LÁMINAS
      </div>
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
  const { firebaseUser } = useAuth();

  const [tab,          setTab]          = useState("sobre");
  const [todasLaminas, setTodasLaminas] = useState([]);
  const [cargandoCat,  setCargandoCat]  = useState(true);
  const [errorCat,     setErrorCat]     = useState(null);

  const [lightboxLamina,   setLightboxLamina]   = useState(null);
  const [lightboxCantidad, setLightboxCantidad] = useState(0);

  const [sobreDisponible, setSobreDisponible] = useState(false);
  const [laminasNuevas,   setLaminasNuevas]   = useState([]);
  const [sobreAbierto,    setSobreAbierto]     = useState(false);
  const [volteadas,       setVolteadas]        = useState(0);
  const [guardando,       setGuardando]        = useState(false);
  const [sobreGuardado,   setSobreGuardado]    = useState(false);
  const [msgGuardado,     setMsgGuardado]      = useState(null);

  const [laminasLocal, setLaminasLocal] = useState(() => {
    const stored = localStorage.getItem("cp8b_mis_laminas");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_) {}
    }
    return {};
  });

  const iniciadoRef = useRef(false);
  const uid  = firebaseUser?.uid;
  const hoy  = hoyStr();
  const lsKeyOver = uid ? `cp8b_sobre_${uid}_${hoy}` : null;
  const lsKeyLams = uid ? `cp8b_lams_${uid}_${hoy}`  : null;

  useEffect(() => {
    fetch(CARDS_URL)
      .then(r => r.json())
      .then(d => {
        const lista = Array.isArray(d) ? d : (d.laminas || []);
        setTodasLaminas(lista);
      })
      .catch(e => {
        console.error("Catálogo:", e);
        setErrorCat("No se pudo cargar el catálogo. Verifica la conexión.");
      })
      .finally(() => setCargandoCat(false));
  }, []);

  useEffect(() => {
    if (!uid || iniciadoRef.current) return;
    iniciadoRef.current = true;

    const verificar = async () => {
      if (localStorage.getItem(lsKeyOver) === "guardado") {
        setSobreGuardado(true);
        setSobreDisponible(false);
        const lamsGuardadas = localStorage.getItem(lsKeyLams);
        if (lamsGuardadas) {
          try { setLaminasNuevas(JSON.parse(lamsGuardadas)); } catch(_) {}
        }
        return;
      }

      try {
        const uSnap = await getDoc(doc(db,"usuarios",uid));
        if (uSnap.exists() && uSnap.data().ultimoSobre === hoy) {
          localStorage.setItem(lsKeyOver, "guardado");
          setSobreGuardado(true);
          setSobreDisponible(false);
          const lamsGuardadas = localStorage.getItem(lsKeyLams);
          if (lamsGuardadas) {
            try { setLaminasNuevas(JSON.parse(lamsGuardadas)); } catch(_) {}
          }
          return;
        }
      } catch(_) {}

      const lamsPrep = localStorage.getItem(lsKeyLams);
      if (lamsPrep) {
        try {
          setLaminasNuevas(JSON.parse(lamsPrep));
          setSobreDisponible(false);
          setSobreAbierto(true);
          return;
        } catch(_) {}
      }

      setSobreDisponible(true);
    };

    verificar();
  }, [uid, hoy, lsKeyOver, lsKeyLams]);

  useEffect(() => {
    if (!sobreDisponible || todasLaminas.length === 0 || !uid) return;
    if (laminasNuevas.length > 0) return;

    const seleccionadas = [...todasLaminas]
      .sort(() => Math.random() - 0.5)
      .slice(0, LAMINAS_POR_SOBRE);

    setLaminasNuevas(seleccionadas);
    localStorage.setItem(lsKeyLams, JSON.stringify(seleccionadas));
  }, [sobreDisponible, todasLaminas, uid, laminasNuevas.length, lsKeyLams]);

  const guardarLaminas = async (e) => {
    if (e) e.preventDefault();
    if (!uid || laminasNuevas.length === 0 || guardando) return;
    setGuardando(true);
    setMsgGuardado(null);
    try {
      const updates = { ultimoSobre: hoy };
      for (const lam of laminasNuevas) {
        updates[`laminas.${lam.file}`] = fbIncrement(1);
      }
      await updateDoc(doc(db, "usuarios", uid), updates);

      const nuevasLaminas = { ...laminasLocal };
      for (const lam of laminasNuevas) {
        nuevasLaminas[lam.file] = (nuevasLaminas[lam.file] || 0) + 1;
      }
      setLaminasLocal(nuevasLaminas);
      localStorage.setItem("cp8b_mis_laminas", JSON.stringify(nuevasLaminas));

      localStorage.setItem(lsKeyOver, "guardado");
      setSobreGuardado(true);
      setMsgGuardado("✅ ¡Láminas guardadas en tu colección!");
    } catch (e) {
      setMsgGuardado(`❌ Error: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const handleCanje = useCallback(async () => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const nuevasLaminas = data.laminas || {};
        setLaminasLocal(nuevasLaminas);
        localStorage.setItem("cp8b_mis_laminas", JSON.stringify(nuevasLaminas));
      }
    } catch (_) {}
  }, [uid]);

  const handleClickLamina = (lamina, cantidad) => {
    setLightboxLamina(lamina);
    setLightboxCantidad(cantidad);
  };

  if (!firebaseUser) return null;

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <div style={{ marginBottom:"12px", padding:"8px", border:"2px solid red", textAlign:"center" }}>
        <button
          onClick={() => {
            setSobreDisponible(true);
            setSobreGuardado(false);
            setSobreAbierto(false);
          }}
          className="btn-pixel btn-rojo"
          style={{ fontSize:"8px" }}
        >
          🔴 FORZAR SOBRE
        </button>
        <p style={{ fontSize:"5px", color:"var(--gris-claro)", marginTop:"4px" }}>
          Haz clic para activar un sobre nuevo (solo para pruebas)
        </p>
      </div>

      <Lightbox
        lamina={lightboxLamina}
        cantidad={lightboxCantidad}
        onCerrar={() => { setLightboxLamina(null); setLightboxCantidad(0); }}
      />

      <div className="seccion-titulo">🃏 LÁMINAS COLECCIONABLES</div>

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
            <div>
              <div className="caja-pixel text-center" style={{ marginBottom:"12px" }}>
                <p style={{ fontSize:"7px",color:"var(--verde-claro)",lineHeight:2 }}>
                  ✅ Ya abriste tu sobre de hoy.
                </p>
                <p style={{ fontSize:"6px",color:"var(--gris-claro)",lineHeight:2 }}>
                  Vuelve mañana para un nuevo sobre.
                </p>
              </div>
              {laminasNuevas.length > 0 && (
                <>
                  <p style={{
                    fontFamily:"'Press Start 2P',monospace",fontSize:"6px",
                    color:"var(--gris-claro)",textAlign:"center",marginBottom:"12px",
                  }}>
                    TUS LÁMINAS DE HOY:
                  </p>
                  <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"8px" }}>
                    {laminasNuevas.map((lam,i) => (
                      <div key={i}
                        onClick={() => handleClickLamina(lam, laminasLocal[lam.file]||1)}
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
            <SobreAnimado onAbrir={() => setSobreAbierto(true)} />
          ) : laminasNuevas.length > 0 ? (
            <div>
              <p style={{
                fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                color:"var(--amarillo)",textAlign:"center",marginBottom:"14px",
              }}>
                {sobreGuardado ? "TUS LÁMINAS DE HOY" : `¡Da vuelta tus láminas! (${volteadas}/${laminasNuevas.length})`}
              </p>
              <div style={{
                display:"flex",flexWrap:"wrap",justifyContent:"center",
                gap:"10px",marginBottom:"16px",
              }}>
                {laminasNuevas.map((lam,i) => (
                  <LaminaFlip
                    key={lam.file+i}
                    lamina={lam}
                    idx={i}
                    yaVolteada={sobreGuardado}
                    onVoltear={() => setVolteadas(v => v+1)}
                    onClick={(l) => handleClickLamina(l, laminasLocal[l.file]||1)}
                  />
                ))}
              </div>

              {!sobreGuardado && volteadas >= laminasNuevas.length && (
                <button
                  className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"7px" }}
                  onClick={guardarLaminas}
                  disabled={guardando}
                >
                  {guardando ? "⚙ GUARDANDO..." : "💾 GUARDAR MIS LÁMINAS"}
                </button>
              )}

              {!sobreGuardado && volteadas < laminasNuevas.length && (
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

      {tab === "coleccion" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
              Cargando...
            </p>
          : errorCat
            ? <p style={{ fontSize:"6px",color:"var(--rojo-chile)",padding:"8px" }}>{errorCat}</p>
            : <Coleccion
                laminasUsuario={laminasLocal}
                todasLaminas={todasLaminas}
                onClickLamina={handleClickLamina}
              />
      )}

      {tab === "canje" && (
        cargandoCat
          ? <p style={{ fontSize:"7px",color:"var(--gris-claro)",textAlign:"center",padding:"16px" }}>
              Cargando...
            </p>
          : <CanjeLaminas
              laminasUsuario={laminasLocal}
              todasLaminas={todasLaminas}
              uid={uid}
              onCanje={handleCanje}
            />
      )}
    </div>
  );
}