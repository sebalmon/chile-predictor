// src/components/Perfil.jsx  — v3
import React, { useState, useEffect } from "react";
import {
  doc, updateDoc, getDocs, collection, query,
  where, orderBy, getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { CARTAS } from "../data/sampleData";
import { ayerStr } from "../utils/helpers";

// ── Lightbox de carta ─────────────────────────────────────────
function LightboxCarta({ carta, onCerrar }) {
  if (!carta) return null;
  const RAREZA_COLOR = { comun:"var(--verde-claro)", rara:"var(--amarillo)", legendaria:"var(--rojo-chile)" };
  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(0,0,0,0.95)", zIndex:900,
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px",
    }}
      onClick={onCerrar}
    >
      <div style={{ maxWidth:"340px", width:"100%", textAlign:"center" }}
        onClick={(e) => e.stopPropagation()}>
        <img
          src={`/cartas/${carta.slug}.jpg`}
          alt={carta.nombre}
          style={{
            width:"100%", maxWidth:"280px",
            imageRendering:"pixelated",
            border:`4px solid ${RAREZA_COLOR[carta.rareza]||"#fff"}`,
            boxShadow:`0 0 30px ${RAREZA_COLOR[carta.rareza]||"#fff"}44`,
            marginBottom:"16px",
          }}
          onError={(e)=>{ e.target.style.display="none"; }}
        />
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"9px",
          color: RAREZA_COLOR[carta.rareza]||"#fff", marginBottom:"8px" }}>
          {carta.nombre}
        </p>
        <p style={{ fontFamily:"'Press Start 2P',monospace", fontSize:"7px",
          color:"var(--gris-claro)", marginBottom:"16px" }}>
          Multiplicador: ×{carta.multiplicador}
        </p>
        <button className="btn-pixel btn-gris" onClick={onCerrar}
          style={{ fontSize:"7px" }}>
          CERRAR ✕
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function Perfil({ onVolver }) {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [editando, setEditando]       = useState(false);
  const [nuevoNick, setNuevoNick]     = useState(userProfile?.nickname||"");
  const [error, setError]             = useState("");
  const [guardando, setGuardando]     = useState(false);
  const [exito, setExito]             = useState("");
  const [cartaLightbox, setCartaLightbox] = useState(null);

  // Historial
  const [puntosAyer, setPuntosAyer]   = useState(null);
  const [historial,  setHistorial]    = useState([]);
  const [cargandoHist, setCargandoHist] = useState(true);

  const ayer = ayerStr();

  useEffect(() => {
    if (!firebaseUser) return;
    cargarHistorial();
  }, [firebaseUser]);

  const cargarHistorial = async () => {
    setCargandoHist(true);
    try {
      const q = query(
        collection(db,"puntosDelDia"),
        where("uid","==",firebaseUser.uid),
        orderBy("fecha","desc")
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHistorial(items);
      const ayerItem = items.find((i) => i.fecha === ayer);
      if (ayerItem) setPuntosAyer(ayerItem);
    } catch(e) { console.error(e); }
    finally { setCargandoHist(false); }
  };

  const handleGuardarNick = async () => {
    if (nuevoNick === userProfile?.nickname) { setEditando(false); return; }
    if (nuevoNick.length < 3) { setError("Mínimo 3 caracteres"); return; }
    if (nuevoNick.length > 16) { setError("Máximo 16 caracteres"); return; }
    setGuardando(true); setError("");
    try {
      const norm = nuevoNick.toLowerCase();
      const q = query(collection(db,"usuarios"), where("nicknameLower","==",norm));
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].id !== firebaseUser.uid) {
        setError("Ese nickname ya está en uso."); setGuardando(false); return;
      }
      await updateDoc(doc(db,"usuarios",firebaseUser.uid),{
        nickname: nuevoNick, nicknameLower: norm,
      });
      await refreshProfile();
      setEditando(false);
      setExito("¡Nickname actualizado!");
      setTimeout(() => setExito(""), 3000);
    } catch(e) { setError("Error al guardar."); }
    finally { setGuardando(false); }
  };

  /*const cartasDesbloqueadas = userProfile?.cartasDesbloqueadas || []; */

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      {cartaLightbox && (
        <LightboxCarta carta={cartaLightbox} onCerrar={() => setCartaLightbox(null)} />
      )}

      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
        <button className="btn-pixel btn-gris" onClick={onVolver}
          style={{padding:"8px 12px",fontSize:"8px"}}>
          ← VOLVER
        </button>
        <h2 className="text-amarillo">👤 MI PERFIL</h2>
      </div>

      {/* Header */}
      <div className="perfil-header mb-16">
        <img
  src={`/avatares/${userProfile?.avatarSlug || "default"}-1.png`}
  alt="avatar"
  className="perfil-avatar-grande"
  style={{
    width: "80px",
    height: "80px",
    imageRendering: "pixelated",
    border: "2px solid var(--verde-claro)",
    padding: "4px",
  }}
  onError={(e) => { e.target.style.display = "none"; e.target.parentElement.innerHTML += "<span>?</span>"; }}
/>
        <div style={{textAlign:"center"}}>
          {!editando ? (
            <div>
              <p style={{fontSize:"12px",color:"var(--amarillo)",marginBottom:"6px"}}>
                {userProfile?.nickname}
              </p>
              <p style={{fontSize:"7px",color:"var(--gris-claro)",marginBottom:"10px"}}>
                {userProfile?.nombreReal}
              </p>
              <button className="btn-pixel btn-verde"
                style={{fontSize:"7px",padding:"6px 12px"}}
                onClick={() => { setEditando(true); setNuevoNick(userProfile?.nickname); }}>
                ✏ CAMBIAR NICKNAME
              </button>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"8px",alignItems:"center"}}>
              <input className="input-pixel" style={{textAlign:"center"}}
                value={nuevoNick} maxLength={16}
                onChange={(e) => setNuevoNick(e.target.value)} />
              {error && <p className="text-rojo" style={{fontSize:"7px"}}>{error}</p>}
              <div style={{display:"flex",gap:"8px"}}>
                <button className="btn-pixel btn-verde"
                  style={{fontSize:"7px",padding:"6px 12px"}}
                  onClick={handleGuardarNick} disabled={guardando}>
                  {guardando?"...":"✅ OK"}
                </button>
                <button className="btn-pixel btn-gris"
                  style={{fontSize:"7px",padding:"6px 12px"}}
                  onClick={() => { setEditando(false); setError(""); }}>
                  ✕
                </button>
              </div>
            </div>
          )}
          {exito && <p style={{fontSize:"7px",color:"var(--verde-claro)",marginTop:"6px"}}>{exito}</p>}
        </div>
        <div style={{display:"flex",gap:"16px",marginTop:"8px"}}>
          <div style={{textAlign:"center"}}>
            <p style={{fontSize:"6px",color:"var(--gris-claro)"}}>PUNTOS TOTAL</p>
            <span className="puntos-badge" style={{fontSize:"12px"}}>
              {userProfile?.puntosTotal??0}
            </span>
          </div>
          <div style={{textAlign:"center"}}>
  <p style={{fontSize:"6px",color:"var(--gris-claro)"}}>CARTAS</p>
  <span className="puntos-badge" style={{fontSize:"12px"}}>
    {Object.values(userProfile?.cartas || {}).reduce((suma, cantidad) => suma + cantidad, 0)}
  </span>
</div>
        </div>
      </div>

      {/* HISTORIAL DEL DÍA ANTERIOR */}
      <div className="seccion-titulo">📅 PUNTOS DE AYER</div>
      <div className="caja-pixel mb-16">
        {cargandoHist ? (
          <p style={{fontSize:"7px",color:"var(--gris-claro)"}}>Cargando...</p>
        ) : puntosAyer ? (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <p style={{fontSize:"7px",color:"var(--blanco)",marginBottom:"4px"}}>
                {puntosAyer.fecha}
              </p>
              {puntosAyer.esGanador && (
                <p style={{fontSize:"6px",color:"var(--amarillo)"}}>
                  👑 GANADOR DEL DÍA +3 bonus
                </p>
              )}
            </div>
            <span className="puntos-badge" style={{fontSize:"14px"}}>
              {puntosAyer.puntos} pts
            </span>
          </div>
        ) : (
          <p style={{fontSize:"7px",color:"var(--gris-claro)"}}>
            Sin actividad ayer.
          </p>
        )}
      </div>

      {/* HISTORIAL COMPLETO */}
      <div className="seccion-titulo">📈 HISTORIAL DESDE DÍA 1</div>
      <div className="caja-pixel mb-16" style={{padding:"8px"}}>
        {cargandoHist ? (
          <p style={{fontSize:"7px",color:"var(--gris-claro)",padding:"8px"}}>Cargando...</p>
        ) : historial.length === 0 ? (
          <p style={{fontSize:"7px",color:"var(--gris-claro)",padding:"8px"}}>
            Sin historial todavía.
          </p>
        ) : (
          <div style={{maxHeight:"200px",overflowY:"auto"}}>
            {historial.map((h,i) => (
              <div key={i} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"6px 8px",
                borderBottom:"1px solid var(--verde-campo)",
              }}>
                <div>
                  <p style={{fontSize:"6px",color:"var(--gris-claro)"}}>{h.fecha}</p>
                  {h.esGanador && (
                    <p style={{fontSize:"5px",color:"var(--amarillo)"}}>👑 Ganador del día</p>
                  )}
                </div>
                <span className="puntos-badge" style={{fontSize:"8px"}}>{h.puntos}pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CARTAS COLECCIONABLES */}
      <div className="seccion-titulo">🃏 CARTAS COLECCIONABLES</div>
      <div className="cartas-grid">
  {CARTAS.map((carta) => {
    const cantidad = userProfile?.cartas?.[carta.id] || 0;
    const desbloq = cantidad > 0;
    const RAREZA_COLOR = {
      comun: "var(--verde-claro)",
      rara: "var(--amarillo)",
      legendaria: "var(--rojo-chile)",
    };
    return (
      <div
        key={carta.id}
        className={`carta ${desbloq ? "carta-desbloqueada" : "carta-bloqueada"}`}
        style={desbloq ? {
          cursor: "pointer",
          borderColor: RAREZA_COLOR[carta.rareza] || "var(--negro)",
        } : {}}
        onClick={() => desbloq && setCartaLightbox(carta)}
      >
        {desbloq ? (
          <>
            <img
              src={`/cartas/${carta.slug}.jpg`}
              alt={carta.nombre}
              style={{
                width: "60px",
                height: "60px",
                objectFit: "cover",
                imageRendering: "pixelated",
                border: "2px solid var(--negro)",
              }}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.parentElement.innerHTML += `<span style="font-size:28px">🃏</span>`;
              }}
            />
            <p className="carta-nombre">{carta.nombre}</p>
            <span style={{
              fontFamily: "'Press Start 2P',monospace",
              fontSize: "7px",
              color: RAREZA_COLOR[carta.rareza] || "var(--verde-claro)",
            }}>
              ×{carta.multiplicador}
            </span>
            <span style={{
              fontFamily: "'Press Start 2P',monospace",
              fontSize: "6px",
              color: "var(--gris-claro)",
              marginLeft: "4px",
            }}>
              (x{cantidad})
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: "28px" }}>🔒</span>
            <p className="carta-nombre">{carta.nombre}</p>
            <p className="carta-condicion">Gana el podio del día</p>
          </>
        )}
      </div>
    );
  })}
</div>
    </div>
  );
}
