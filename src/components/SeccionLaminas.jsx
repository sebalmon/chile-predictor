// src/components/SeccionLaminas.jsx  — v15 (Eliminado FORZAR SOBRE)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v15:
//   • Eliminado el botón "FORZAR SOBRE" (solo para pruebas).
//   • Mantiene la lógica de sobres diarios, colección y recompensas.
//   • Sin pestaña CANJE (ya eliminada en versión anterior).
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  doc, getDoc, updateDoc, setDoc, increment as fbIncrement,
  collection, getDocs, query, orderBy, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { cartaAleatoriaPorMultiplicador } from "../data/sampleData";
import { composicionPorPuesto, generarSobre, gastarDuplicados, cartaImg, recompensasPendientes } from "../utils/sobre";

const CARDS_URL = "https://kvtral.github.io/laminas_16_bits/cards.json";
const LS_IMAGEN_TAPA = "cp8b_imagen_tapa"; // localStorage key para caché de imagen de tapa
const LAMINAS_POR_SOBRE = 7;

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
  const [fase, setFase] = useState("cerrado"); // cerrado | sacudiendo | abriendo | abierto

  const abrir = () => {
    if (fase !== "cerrado") return;
    setFase("sacudiendo");
    setTimeout(() => setFase("abriendo"), 600);
    setTimeout(() => {
      setFase("abierto");
      setTimeout(onAbrir, 400);
    }, 1400);
  };

  const estiloSobre = {
    cerrado:    { transform:"scale(1) rotate(0deg)",    filter:"brightness(1)" },
    sacudiendo: { transform:"scale(1.08) rotate(-4deg)",filter:"brightness(1.2)" },
    abriendo:   { transform:"scale(1.15) rotate(2deg)", filter:"brightness(1.4)" },
    abierto:    { transform:"scale(1.1) rotate(0deg)",  filter:"brightness(1.6)" },
  }[fase];

  return (
    <>
      {/* Overlay fullscreen */}
      <div style={{
        position:"fixed", inset:0, zIndex:800,
        background:"radial-gradient(ellipse at center, rgba(10,22,40,0.97) 60%, rgba(0,0,0,0.99) 100%)",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"20px",
      }}>
        {/* Destellos de fondo */}
        {fase === "abriendo" || fase === "abierto" ? (
          <div style={{
            position:"absolute", inset:0, pointerEvents:"none",
            background:"radial-gradient(circle at 50% 45%, rgba(244,208,63,0.18) 0%, transparent 65%)",
          }} />
        ) : null}

        {/* Texto superior */}
        <p style={{
          fontFamily:"'Press Start 2P',monospace",
          fontSize:"8px", color:"var(--amarillo)",
          marginBottom:"32px", textAlign:"center", lineHeight:1.8,
          textShadow:"0 0 12px rgba(244,208,63,0.6)",
        }}>
          {fase === "cerrado"    && "🎁 ¡TU SOBRE DEL DÍA!"}
          {fase === "sacudiendo" && "✨ ¡¡LO TIENES!!"}
          {fase === "abriendo"   && "🔓 ABRIENDO..."}
          {fase === "abierto"    && "🎉 ¡¡LÁMINAS!!"}
        </p>

        {/* Sobre */}
        <div
          onClick={fase === "cerrado" ? abrir : undefined}
          style={{
            cursor: fase === "cerrado" ? "pointer" : "default",
            transition: "transform 0.3s ease, filter 0.3s ease",
            ...estiloSobre,
          }}
        >
          {/* Imagen del sobre */}
          <div style={{
            position:"relative", width:"200px", height:"150px",
            margin:"0 auto",
          }}>
            <img
              src={fase === "abierto" ? "/sobre/sobre-abierto.png" : "/sobre/sobre-cerrado.png"}
              alt="sobre"
              style={{
                width:"200px", height:"150px",
                imageRendering:"pixelated", objectFit:"contain",
                filter: fase==="sacudiendo" ? "drop-shadow(0 0 20px gold)" :
                        fase==="abriendo"   ? "drop-shadow(0 0 30px gold)" : "none",
                transition:"filter 0.3s",
              }}
              onError={e => {
                e.target.style.display="none";
                e.target.nextSibling.style.display="flex";
              }}
            />
            {/* Fallback CSS */}
            <div style={{
              display:"none", width:"200px", height:"150px",
              background: fase==="abierto" ? "#f4d03f" : "#e8a020",
              border:"4px solid var(--negro)", boxShadow:"4px 4px 0 var(--negro)",
              alignItems:"center", justifyContent:"center",
              fontSize:"72px",
            }}>
              {fase === "abierto" ? "📬" : "📦"}
            </div>

            {/* Rayos de luz al abrir */}
            {(fase === "abriendo" || fase === "abierto") && (
              <div style={{
                position:"absolute", top:"-20px", left:"50%",
                transform:"translateX(-50%)",
                width:"260px", height:"200px",
                background:"radial-gradient(ellipse at 50% 80%, rgba(244,208,63,0.35) 0%, transparent 70%)",
                pointerEvents:"none",
                animation:"rayos 0.6s ease-out",
              }} />
            )}
          </div>

          {/* Texto acción */}
          {fase === "cerrado" && (
            <div style={{ textAlign:"center", marginTop:"20px" }}>
              <p style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"9px",
                color:"var(--amarillo)", animation:"pulso 1.2s ease-in-out infinite",
              }}>
                👆 TOCA PARA ABRIR
              </p>
              <p style={{
                fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                color:"var(--gris-claro)", marginTop:"8px",
              }}>
                Contiene {LAMINAS_POR_SOBRE} láminas
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulso {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.7; transform:scale(1.04); }
        }
        @keyframes rayos {
          0%   { opacity:0; transform:translateX(-50%) scaleY(0.3); }
          60%  { opacity:1; transform:translateX(-50%) scaleY(1.1); }
          100% { opacity:0.7; transform:translateX(-50%) scaleY(1); }
        }
      `}</style>
    </>
  );
}

// ── Lámina con flip ───────────────────────────────────────
// ── CartaFlip — usa la misma tapa que las láminas ────────────
// Antes de darla vuelta: muestra la imagen de tapa (igual que láminas).
// Al darla vuelta: revela que es una carta multiplicadora con su arte.
function CartaFlip({ carta, idx, onVoltear, yaVolteada, imagenTapa }) {
  const [volteada, setVolteada] = React.useState(yaVolteada);

  const dar = () => {
    if (volteada) return;
    setVolteada(true);
    onVoltear();
  };

  const COLORES_RAREZA = {
    comun:      "#4ade80",
    rara:       "#f4d03f",
    legendaria: "#f87171",
  };
  const color = COLORES_RAREZA[carta.rareza] || "#f4d03f";

  return (
    <div onClick={dar}
      style={{ width:"80px", cursor: volteada ? "default" : "pointer", textAlign:"center",
        animation:`laminaSale 0.5s ease ${idx*0.15}s both` }}>
      <div style={{
        width:"80px", height:"110px",
        border: `3px solid ${volteada ? color : "var(--amarillo)"}`,
        boxShadow:`3px 3px 0 var(--negro)`,
        overflow:"hidden",
        // Mismo fondo tapa que las láminas
        background: volteada
          ? "var(--negro)"
          : imagenTapa
            ? `url(/${imagenTapa}) center/cover`
            : "linear-gradient(135deg,#1a1a5e,#4a0e8f)",
        display:"flex", alignItems:"center", justifyContent:"center",
        position:"relative",
      }}>
        {volteada ? (
          <>
            <img src={cartaImg(carta.slug)} alt={carta.nombre}
              style={{ width:"100%", height:"80%", objectFit:"cover", display:"block" }}
              onError={e => { e.target.style.opacity = 0.2; }} />
            {/* Badge multiplicador */}
            <div style={{
              position:"absolute", bottom:0, left:0, right:0,
              background:"var(--negro)", padding:"3px 0", textAlign:"center",
            }}>
              <span style={{ fontFamily:"'Press Start 2P',monospace",
                fontSize:"9px", color }}>
                ×{carta.multiplicador}
              </span>
            </div>
          </>
        ) : null}
      </div>
      {volteada && (
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"4px",
          color:"var(--amarillo)", marginTop:"3px", lineHeight:1.4,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {carta.nombre}
        </p>
      )}
    </div>
  );
}

function LaminaFlip({ lamina, idx, onVoltear, yaVolteada, onClick, imagenTapa }) {
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
        background: volteada ? "transparent" : imagenTapa ? `url(/${imagenTapa}) center/cover` : "linear-gradient(135deg,#1a1a5e,#4a0e8f)",
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"border-color 0.3s",
      }}>
        {!volteada
          ? null
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

// ── Colección (Álbum + Detalle + Recompensas) ────────────────
function Coleccion({ laminasUsuario, todasLaminas, onClickLamina, uid, reclamadas, onReclamar }) {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [reclamando, setReclamando] = useState(false);
  const [msgRec, setMsgRec] = useState(null);

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

  // ─── RECOMPENSAS ──────────────────────────────────────────
  const pendientes = recompensasPendientes(laminasUsuario, todasLaminas, reclamadas || {});

  const reclamar = async (rec) => {
    if (reclamando || !uid) return;
    setReclamando(true);
    setMsgRec(null);
    try {
      const detalles = [];
      for (const { mult, n } of rec.cartas) {
        for (let i = 0; i < n; i++) { const c = cartaAleatoriaPorMultiplicador(mult); if (c) detalles.push(c); }
      }
      // Bug 1 fix: use cat_ prefix for category keys so the util's lookup matches
      const storeKey = rec.tipo === "album" ? "album" : `cat_${rec.key}`;
      const updates = { [`recompensas.${storeKey}`]: true };
      // Bug 2 fix: count per unique carta id to avoid overwriting increments
      const conteo = {};
      for (const c of detalles) conteo[c.id] = (conteo[c.id] || 0) + 1;
      for (const [id, count] of Object.entries(conteo)) updates[`cartas.${id}`] = fbIncrement(count);
      const batch = writeBatch(db);
      batch.update(doc(db, "usuarios", uid), updates);
      for (let i = 0; i < detalles.length; i++) {
        const c = detalles[i];
        batch.set(doc(db, "cartasDelUsuario", `${uid}_${c.id}_recompensa_${rec.key}_${i}`), {
          uid, cartaId:c.id, cartaNombre:c.nombre, cartaSlug:c.slug,
          multiplicador:c.multiplicador, rareza:c.rareza,
          fecha:hoyStr(), visto:false, origen:"recompensa",
        });
      }
      await batch.commit();
      setMsgRec(`✅ ¡Recompensa reclamada! +${detalles.length} carta(s)`);
      // Bug 4 fix: clear banner after 4 s
      setTimeout(() => setMsgRec(null), 4000);
      if (onReclamar) await onReclamar();
    } catch (e) {
      setMsgRec(`❌ ${e.message}`);
      setTimeout(() => setMsgRec(null), 4000);
    } finally {
      setReclamando(false);
    }
  };

  if (!todasLaminas || todasLaminas.length === 0) {
    return (
      <p style={{ fontSize:"6px",color:"var(--gris-claro)",padding:"16px",textAlign:"center" }}>
        Cargando catálogo...
      </p>
    );
  }

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

        {/* Recompensas */}
        {msgRec && (
          <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
            color: msgRec.startsWith("✅") ? "var(--verde-claro)" : "var(--rojo-chile)",
            textAlign:"center", marginBottom:"10px", lineHeight:2 }}>{msgRec}</p>
        )}
        {pendientes.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"6px", marginBottom:"12px" }}>
            {pendientes.map(rec => (
              <button key={rec.key} className="btn-pixel btn-amarillo w-full" style={{ fontSize:"6px" }}
                onClick={() => reclamar(rec)} disabled={reclamando}>
                {reclamando ? "⚙ ..." :
                  rec.tipo === "album"
                    ? "🏆 ÁLBUM COMPLETO — RECLAMAR 2 CARTAS ×4"
                    : `✅ CATEGORÍA ${rec.key} COMPLETA — RECLAMAR CARTA ×2`}
              </button>
            ))}
          </div>
        )}

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

      {/* Recompensas (en vista álbum) */}
      {msgRec && (
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
          color: msgRec.startsWith("✅") ? "var(--verde-claro)" : "var(--rojo-chile)",
          textAlign:"center", marginBottom:"10px", lineHeight:2 }}>{msgRec}</p>
      )}
      {pendientes.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px", marginBottom:"16px" }}>
          {pendientes.map(rec => (
            <button key={rec.key} className="btn-pixel btn-amarillo w-full" style={{ fontSize:"6px" }}
              onClick={() => reclamar(rec)} disabled={reclamando}>
              {reclamando ? "⚙ ..." :
                rec.tipo === "album"
                  ? "🏆 ÁLBUM COMPLETO — RECLAMAR 2 CARTAS ×4"
                  : `✅ CATEGORÍA ${rec.key} COMPLETA — RECLAMAR CARTA ×2`}
            </button>
          ))}
        </div>
      )}

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

// ── Componente principal ──────────────────────────────────────
export default function SeccionLaminas() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();

  const [tab,          setTab]          = useState("sobre");
  const [todasLaminas, setTodasLaminas] = useState([]);
  const [cargandoCat,  setCargandoCat]  = useState(true);
  const [errorCat,     setErrorCat]     = useState(null);
  const [imagenTapa,   setImagenTapa]   = useState(
    () => localStorage.getItem(LS_IMAGEN_TAPA) || null
  );

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

  const [laminasLocal, setLaminasLocal] = useState(() => {
    const stored = localStorage.getItem("cp8b_mis_laminas");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_) {}
    }
    return {};
  });

  const uid  = firebaseUser?.uid;
  const hoy  = hoyStr();
  const sobreDocId = uid ? `${uid}_${hoy}` : null;

  // Cargar catálogo
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
    // Cargar imagen de tapa configurable desde Firestore
    getDoc(doc(db,"config","laminaConfig"))
      .then(snap => {
        if (snap.exists() && snap.data().imagenTapa) {
          const img = snap.data().imagenTapa;
          setImagenTapa(img);
          localStorage.setItem(LS_IMAGEN_TAPA, img);
        }
      })
      .catch(() => {});
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
      const generado = generarSobre(todasLaminas, comp, Math.random, laminasLocal);
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

      const batch = writeBatch(db);
      batch.update(doc(db, "usuarios", uid), updates);

      // docs detalle de cartas (ID determinista -> idempotente), origen "sobre"
      for (let i = 0; i < sobre.cartas.length; i++) {
        const c = sobre.cartas[i];
        batch.set(doc(db, "cartasDelUsuario", `${uid}_${c.id}_${hoy}_sobre_${i}`), {
          uid, cartaId: c.id, cartaNombre: c.nombre, cartaSlug: c.slug,
          multiplicador: c.multiplicador, rareza: c.rareza,
          fecha: hoy, visto: false, origen: "sobre",
        });
      }
      batch.update(doc(db, "sobresDelDia", sobreDocId), { guardado: true });
      await batch.commit();

      // Actualizar estado local y localStorage
      const nuevasLaminas = { ...laminasLocal };
      for (const lam of sobre.laminas) {
        nuevasLaminas[lam.file] = (nuevasLaminas[lam.file] || 0) + 1;
      }
      setLaminasLocal(nuevasLaminas);
      localStorage.setItem("cp8b_mis_laminas", JSON.stringify(nuevasLaminas));

      setSobreGuardado(true);
      setMsgGuardado("✅ ¡Guardado en tu colección!");
      if (refreshProfile) await refreshProfile();
    } catch (e) {
      setMsgGuardado(`❌ Error: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  };

  // Callback para actualizar estado después de canje/recompensa
  const handleRefresh = useCallback(async () => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const nuevasLaminas = data.laminas || {};
        setLaminasLocal(nuevasLaminas);
        localStorage.setItem("cp8b_mis_laminas", JSON.stringify(nuevasLaminas));
      }
      if (refreshProfile) await refreshProfile();
    } catch (_) {}
  }, [uid, refreshProfile]);

  const handleClickLamina = (lamina, cantidad) => {
    setLightboxLamina(lamina);
    setLightboxCantidad(cantidad);
  };

  if (!firebaseUser) return null;

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      {/* EL BOTÓN FORZAR SOBRE HA SIDO ELIMINADO */}

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
          {/* ── Bienvenida ──────────────────────────────────── */}
          <div style={{
            background:"linear-gradient(135deg,rgba(14,30,60,0.95),rgba(10,22,40,0.98))",
            border:"2px solid var(--amarillo)",
            padding:"14px 12px", marginBottom:"14px",
            boxShadow:"0 0 18px rgba(244,208,63,0.18)",
          }}>
            <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"8px",
              color:"var(--amarillo)",marginBottom:"10px",textAlign:"center",lineHeight:1.8 }}>
              🖼️ LÁMINAS COLECCIONABLES
            </p>
            <p style={{ fontFamily:"'Press Start 2P',monospace",fontSize:"5px",
              color:"var(--gris-claro)",lineHeight:2.2,marginBottom:"8px" }}>
              Cada día recibes un <span style={{ color:"var(--amarillo)" }}>sobre</span> con láminas únicas.
              Colecciona todas las de cada categoría y desbloquea
              <span style={{ color:"var(--verde-claro)" }}> cartas multiplicadoras de premio</span>.
            </p>
            
          </div>
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
          ) : sobre !== null ? (
            // Sobre abierto — mostrar láminas con flip
            <div>
              <p style={{
                fontFamily:"'Press Start 2P',monospace",fontSize:"7px",
                color:"var(--amarillo)",textAlign:"center",marginBottom:"14px",
              }}>
                {sobreGuardado ? "TUS LÁMINAS DE HOY" : `¡Da vuelta todo! (${volteadas}/${sobre.laminas.length + sobre.cartas.length})`}
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
                    onClick={(l) => handleClickLamina(l, laminasLocal[l.file]||1)}
                    imagenTapa={imagenTapa}
                  />
                ))}
              </div>

              {sobre.cartas.length > 0 && (
                <>
                  <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"6px",
                    color:"var(--amarillo)", textAlign:"center", margin:"10px 0" }}>
                    ¡HAY SORPRESAS EXTRA!
                  </p>
                  <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"10px" }}>
                    {sobre.cartas.map((c, i) => (
                      <CartaFlip
                        key={c.id+"_"+i}
                        carta={c}
                        idx={i}
                        yaVolteada={sobreGuardado}
                        onVoltear={() => setVolteadas(v => v+1)}
                        imagenTapa={imagenTapa}
                      />
                    ))}
                  </div>
                </>
              )}

              {!sobreGuardado && volteadas >= sobre.laminas.length + sobre.cartas.length && (
                <button
                  className="btn-pixel btn-verde w-full"
                  style={{ fontSize:"7px" }}
                  onClick={guardarLaminas}
                  disabled={guardando}
                >
                  {guardando ? "⚙ GUARDANDO..." : "💾 GUARDAR MIS LÁMINAS"}
                </button>
              )}

              {!sobreGuardado && volteadas < sobre.laminas.length + sobre.cartas.length && (
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
                uid={uid}
                reclamadas={userProfile?.recompensas}
                onReclamar={handleRefresh}
              />
      )}


    </div>
  );
}
