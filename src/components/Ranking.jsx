import ModalPerfilResumido from "./ModalPerfilResumido";
import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function Ranking({ onVolver }) {
  const { firebaseUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const q = query(
          collection(db, "usuarios"),
          orderBy("puntosTotal", "desc")
        );
        const snap = await getDocs(q);
        setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const medallas = ["🥇", "🥈", "🥉"];

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
        <h2 className="text-amarillo">🏆 RANKING COMPLETO</h2>
      </div>

      {cargando ? (
        <div className="text-center" style={{ padding: "40px", fontSize: "8px", color: "var(--verde-claro)" }}>
          <span className="spinner">⚙</span>
          <br /><br />
          CARGANDO...
        </div>
      ) : (
        <div className="caja-pixel">
          <table className="ranking-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>JUGADOR</th>
                <th style={{ textAlign: "right" }}>PUNTOS</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr
                  key={u.id}
                  className={u.uid === firebaseUser?.uid ? "ranking-fila-yo" : ""}
                onClick={() => setPerfilSeleccionado({
  avatarId: u.avatarId,
  nickname: u.nickname,
  puntos: u.puntosTotal
})}
  style={{ cursor: "pointer" }}   // ← añade esto para mostrar que es clickeable
>
                  <td className="ranking-pos">
                    {i < 3 ? medallas[i] : `${i + 1}`}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img
  src={`/avatares/${u.avatarSlug || "default"}-1.png`}
  alt={u.nickname}
  style={{ width: "24px", height: "24px", imageRendering: "pixelated", marginRight: "8px" }}
  onError={(e) => { e.target.style.display = "none"; }}
/>
                      <div>
                        <div style={{ fontSize: "7px", color: "var(--blanco)" }}>
                          {u.nickname}
                          {u.uid === firebaseUser?.uid && (
                            <span style={{
                              marginLeft: "6px",
                              fontSize: "6px",
                              background: "var(--verde-claro)",
                              color: "var(--negro)",
                              padding: "1px 4px",
                              border: "1px solid var(--negro)",
                            }}>
                              TÚ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="puntos-badge">{u.puntosTotal ?? 0}</span>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "20px", fontSize: "7px", color: "var(--gris-claro)" }}>
                    Aún no hay jugadores
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {perfilSeleccionado && (
  <ModalPerfilResumido
    jugador={perfilSeleccionado}
    onCerrar={() => setPerfilSeleccionado(null)}
  />
)}
    </div>
  );
}
