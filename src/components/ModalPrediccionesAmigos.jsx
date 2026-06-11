import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function ModalPrediccionesAmigos({ partidoId, onCerrar }) {
  const [predicciones, setPredicciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const q = query(collection(db, "predicciones"), where("partidoId", "==", partidoId));
        const snap = await getDocs(q);
        const items = [];
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          // obtener nickname del usuario
          const userSnap = await getDoc(doc(db, "usuarios", data.uid));
          const nickname = userSnap.exists() ? userSnap.data().nickname : "?";
          items.push({ ...data, nickname });
        }
        setPredicciones(items);
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [partidoId]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.85)", zIndex: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }} onClick={onCerrar}>
      <div style={{
        background: "var(--negro)", border: "4px solid var(--verde-claro)",
        padding: "20px", maxWidth: "400px", width: "100%", maxHeight: "80vh",
        overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: "8px", color: "var(--amarillo)", marginBottom: "16px" }}>
          🕵️ PREDICCIONES DE TUS AMIGOS
        </p>
        {cargando ? (
          <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>Cargando...</p>
        ) : predicciones.length === 0 ? (
          <p style={{ fontSize: "7px", color: "var(--gris-claro)" }}>Aún no hay predicciones.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {predicciones.map((p, idx) => (
              <div key={idx} style={{
                borderBottom: "1px solid var(--verde-campo)", padding: "8px 0"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "7px", color: "var(--verde-claro)" }}>{p.nickname}</span>
                  <span style={{ fontSize: "6px", color: "var(--gris)" }}>
  {p.guardadoEn ? new Date(p.guardadoEn).toLocaleString() : ""}
</span>
                </div>
                <div style={{ fontSize: "7px", color: "var(--blanco)", marginTop: "4px" }}>
                  {p.estaDestacado ? (
                    <>🔮 {p.golesLocalPred} - {p.golesVisitantePred}</>
                  ) : p.ganador ? (
                    <>🏆 {p.ganador === "local" ? "Local" : p.ganador === "visitante" ? "Visitante" : "Empate"} {p.diferencia ? `(dif. ${p.diferencia})` : ""}</>
                  ) : p.definicion ? (
                    <>⚡ {p.definicion.toUpperCase()} {p.ganador === "local" ? "Local" : "Visitante"} {p.penalesLocal !== undefined ? `(${p.penalesLocal}-${p.penalesVisitante})` : ""}</>
                  ) : "Sin datos"}
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn-pixel btn-gris w-full" style={{ marginTop: "16px" }} onClick={onCerrar}>
          CERRAR
        </button>
      </div>
    </div>
  );
}