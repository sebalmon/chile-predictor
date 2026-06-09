import React, { useState } from "react";
import { doc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { AVATARES } from "../data/sampleData";

export default function Registro() {
  const { firebaseUser, setUserProfile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const validarNickname = (val) => {
    if (val.length < 3) return "Mínimo 3 caracteres";
    if (val.length > 16) return "Máximo 16 caracteres";
    if (!/^[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+$/.test(val))
      return "Solo letras, números y guión bajo";
    return "";
  };

  const handleRegistro = async () => {
    const errNick = validarNickname(nickname);
    if (errNick) { setError(errNick); return; }
    if (!avatarId) { setError("Elige un avatar"); return; }

    setCargando(true);
    setError("");

    try {
      // Verificar unicidad del nickname (insensible a mayúsculas)
      const nicknameNorm = nickname.toLowerCase();
      const q = query(
        collection(db, "usuarios"),
        where("nicknameLower", "==", nicknameNorm)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setError("Ese nickname ya está en uso. Elige otro.");
        setCargando(false);
        return;
      }

      const avatarElegido = AVATARES.find((a) => a.id === avatarId);

      const nuevoUsuario = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        nombreReal: firebaseUser.displayName || "",
        nickname: nickname,
        nicknameLower: nicknameNorm,
        avatarId: avatarId,
        avatarSlug: avatarElegido.slug,   // ← NUEVO
        avatarNombre: avatarElegido.nombre,
        puntosTotal: 0,
        cartasDesbloqueadas: [],
        creadoEn: new Date().toISOString(),
      };

      await setDoc(doc(db, "usuarios", firebaseUser.uid), nuevoUsuario);
      setUserProfile(nuevoUsuario);
    } catch (e) {
      console.error(e);
      setError("Error al guardar. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="pantalla">
      <div className="registro-box">
        <h2 style={{ color: "var(--amarillo)", textAlign: "center", marginBottom: "4px" }}>
          ¡BIENVENIDO!
        </h2>
        <p style={{ fontSize: "7px", color: "var(--gris-claro)", textAlign: "center", marginBottom: "8px" }}>
          Crea tu perfil para jugar
        </p>

        {/* Nickname */}
        <div>
          <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
            NICKNAME (único)
          </p>
          <input
            className="input-pixel"
            type="text"
            placeholder="Ej: ElPibe10"
            value={nickname}
            maxLength={16}
            onChange={(e) => setNickname(e.target.value)}
          />
          <p style={{ fontSize: "6px", color: "var(--gris)", marginTop: "4px" }}>
            {nickname.length}/16 caracteres
          </p>
        </div>

        {/* Avatar */}
        <div>
          <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "8px" }}>
            ELIGE TU AVATAR
          </p>
          <div className="avatar-grid">
            {AVATARES.map((av) => (
              <button
                key={av.id}
                className={`avatar-opcion ${avatarId === av.id ? "seleccionado" : ""}`}
                onClick={() => setAvatarId(av.id)}
                type="button"
              >
                <img
                  src={`/avatares/${av.slug}-1.png`}
                  alt={av.nombre}
                  style={{ width: "40px", height: "40px", imageRendering: "pixelated" }}
                  onError={(e) => { e.target.style.display="none"; }}
                />
                <span className="avatar-opcion-nombre">{av.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-msg">❌ {error}</div>}

        <button
          className="btn-pixel btn-amarillo w-full"
          onClick={handleRegistro}
          disabled={cargando}
          style={{ marginTop: "8px" }}
        >
          {cargando ? "GUARDANDO..." : "✅ CREAR PERFIL"}
        </button>

        <p style={{ fontSize: "6px", color: "var(--gris)", textAlign: "center" }}>
          Entrando como: {firebaseUser?.displayName || firebaseUser?.email}
        </p>
      </div>
    </div>
  );
}