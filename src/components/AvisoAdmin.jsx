// src/components/AvisoAdmin.jsx  — v5 (Fase 2)
// ─────────────────────────────────────────────────────────────
// CAMBIOS v5 (ítem i):
//   • Soporta dos tipos de aviso:
//       tipo: "permanente" → aparece cada vez que el usuario
//             abre/recarga la app, HASTA que el admin lo desactive.
//             No se puede "cerrar para siempre"; al recargar vuelve.
//       tipo: "unaVez" (default) → aparece solo una vez por usuario.
//             Al cerrar, se guarda en localStorage y no vuelve.
//   • El AdminPanel envía el campo `tipo` al crear el aviso.
//   • Si no hay campo `tipo`, se asume "unaVez" (comportamiento anterior).
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const LS_KEY_BASE = "cp8b_aviso_visto_";

export default function AvisoAdmin() {
  const [aviso,   setAviso]   = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    try {
      const snap = await getDoc(doc(db, "config", "avisoAdmin"));
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data.activo || !data.texto) return;

      const tipo = data.tipo || "unaVez";

      if (tipo === "permanente") {
        // Siempre mostrar mientras esté activo
        setAviso({ ...data, tipo });
        setVisible(true);
      } else {
        // "unaVez": mostrar solo si no fue cerrado para esta versión
        const key = LS_KEY_BASE + data.fecha;
        if (localStorage.getItem(key)) return;
        setAviso({ ...data, tipo });
        setVisible(true);
      }
    } catch (e) {
      console.error("Error cargando aviso admin:", e);
    }
  };

  const handleCerrar = () => {
    if (aviso?.tipo !== "permanente") {
      // Solo guardar en localStorage para avisos de una sola vez
      localStorage.setItem(LS_KEY_BASE + aviso.fecha, "1");
    }
    setVisible(false);
  };

  if (!visible || !aviso) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.82)",
      zIndex: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background:   "var(--negro)",
        border:       "4px solid var(--amarillo)",
        boxShadow:    "6px 6px 0 var(--amarillo-oscuro)",
        padding:      "24px 20px",
        maxWidth:     "380px",
        width:        "100%",
        display:      "flex",
        flexDirection: "column",
        gap:          "14px",
      }}>
        {/* Badge de tipo */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "8px", color: "var(--amarillo)" }}>
            📢 AVISO DEL ADMIN
          </p>
          {aviso.tipo === "permanente" && (
            <span style={{
              fontSize: "5px", padding: "2px 6px",
              border: "1px solid var(--amarillo)",
              color: "var(--amarillo)",
            }}>
              FIJO
            </span>
          )}
        </div>

        <p style={{
          fontSize: "8px", color: "var(--blanco)",
          lineHeight: 2.2, textAlign: "center",
          whiteSpace: "pre-wrap",
        }}>
          {aviso.texto}
        </p>

        <button
          className="btn-pixel btn-amarillo w-full"
          style={{ fontSize: "8px" }}
          onClick={handleCerrar}
        >
          ENTENDIDO ✕
        </button>

        {aviso.tipo === "permanente" && (
          <p style={{ fontSize: "5px", color: "var(--gris-claro)", textAlign: "center", lineHeight: 1.8 }}>
            Este aviso seguirá apareciendo hasta que el administrador lo desactive.
          </p>
        )}
      </div>
    </div>
  );
}
