import React, { useState } from "react";
import { doc, updateDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { CARTAS, AVATARES } from "../data/sampleData";

export default function Perfil({ onVolver }) {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [editando, setEditando] = useState(false);
  const [nuevoNick, setNuevoNick] = useState(userProfile?.nickname || "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");

  const handleGuardarNick = async () => {
    if (nuevoNick === userProfile?.nickname) {
      setEditando(false);
      return;
    }
    if (nuevoNick.length < 3) { setError("Mínimo 3 caracteres"); return; }
    if (nuevoNick.length > 16) { setError("Máximo 16 caracteres"); return; }

    setGuardando(true);
    setError("");
    try {
      const nicknameNorm = nuevoNick.toLowerCase();
      const q = query(
        collection(db, "usuarios"),
        where("nicknameLower", "==", nicknameNorm)
      );
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].id !== firebaseUser.uid) {
        setError("Ese nickname ya está en uso.");
        setGuardando(false);
        return;
      }

      await updateDoc(doc(db, "usuarios", firebaseUser.uid), {
        nickname: nuevoNick,
        nicknameLower: nicknameNorm,
      });
      await refreshProfile();
      setEditando(false);
      setExito("¡Nickname actualizado!");
      setTimeout(() => setExito(""), 3000);
    } catch (e) {
      setError("Error al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const cartasDesbloqueadas = userProfile?.cartasDesbloqueadas || [];

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button
          className="btn-pixel btn-gris"
          onClick={onVolver}
          style={{ padding: "8px 12px", fontSize: "8px" }}
        >
          ← VOLVER
        </button>
        <h2 className="text-amarillo">👤 MI PERFIL</h2>
      </div>

      {/* Header perfil */}
      <div className="perfil-header mb-16">
        <span className="perfil-avatar-grande">{userProfile?.avatarEmoji}</span>
        <div style={{ textAlign: "center" }}>
          {!editando ? (
            <div>
              <p style={{ fontSize: "12px", color: "var(--amarillo)", marginBottom: "6px" }}>
                {userProfile?.nickname}
              </p>
              <p style={{ fontSize: "7px", color: "var(--gris-claro)", marginBottom: "10px" }}>
                {userProfile?.nombreReal}
              </p>
              <button
                className="btn-pixel btn-verde"
                style={{ fontSize: "7px", padding: "6px 12px" }}
                onClick={() => { setEditando(true); setNuevoNick(userProfile?.nickname); }}
              >
                ✏ CAMBIAR NICKNAME
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
              <input
                className="input-pixel"
                style={{ textAlign: "center" }}
                value={nuevoNick}
                maxLength={16}
                onChange={(e) => setNuevoNick(e.target.value)}
              />
              {error && <p className="text-rojo" style={{ fontSize: "7px" }}>{error}</p>}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-pixel btn-verde"
                  style={{ fontSize: "7px", padding: "6px 12px" }}
                  onClick={handleGuardarNick}
                  disabled={guardando}
                >
                  {guardando ? "..." : "✅ OK"}
                </button>
                <button
                  className="btn-pixel btn-gris"
                  style={{ fontSize: "7px", padding: "6px 12px" }}
                  onClick={() => { setEditando(false); setError(""); }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {exito && <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginTop: "6px" }}>{exito}</p>}
        </div>

        <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "6px", color: "var(--gris-claro)" }}>PUNTOS TOTAL</p>
            <span className="puntos-badge" style={{ fontSize: "12px" }}>
              {userProfile?.puntosTotal ?? 0}
            </span>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "6px", color: "var(--gris-claro)" }}>CARTAS</p>
            <span className="puntos-badge" style={{ fontSize: "12px" }}>
              {cartasDesbloqueadas.length}/{CARTAS.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cartas coleccionables */}
      <div className="seccion-titulo">🃏 CARTAS COLECCIONABLES</div>
      <div className="cartas-grid">
        {CARTAS.map((carta) => {
          const desbloqueada = cartasDesbloqueadas.includes(carta.id);
          return (
            <div
              key={carta.id}
              className={`carta ${desbloqueada ? "carta-desbloqueada" : "carta-bloqueada"}`}
            >
              <span className="carta-emoji">{desbloqueada ? carta.emoji : "🔒"}</span>
              <p className="carta-nombre">{carta.nombre}</p>
              <p className="carta-condicion">{carta.condicion}</p>
              {desbloqueada && (
                <span style={{ fontSize: "6px", color: "var(--amarillo)" }}>✓ DESBLOQUEADA</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Info cuenta */}
      <div className="caja-pixel mt-16" style={{ fontSize: "7px" }}>
        <p className="text-amarillo mb-8">ℹ INFORMACIÓN DE CUENTA</p>
        <p className="text-gris mb-4">Email: {firebaseUser?.email}</p>
        <p className="text-gris mb-4">Avatar: {userProfile?.avatarNombre}</p>
        <p className="text-gris">
          Miembro desde: {userProfile?.creadoEn
            ? new Date(userProfile.creadoEn).toLocaleDateString("es-CL")
            : "-"}
        </p>
      </div>
    </div>
  );
}
