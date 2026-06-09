// src/components/AvisoAdmin.jsx
// ─────────────────────────────────────────────────────────────
// Modal flotante con aviso del administrador.
// Lee el documento config/avisoAdmin de Firestore.
// Si activo===true y el usuario no lo ha cerrado hoy, lo muestra.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const LS_KEY = "cp8b_aviso_fecha_";

export default function AvisoAdmin() {
  const [aviso, setAviso]     = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDoc(doc(db,"config","avisoAdmin"));
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data.activo || !data.texto) return;

        // Mostrar solo si no fue cerrado para esta versión del mensaje
        const key = LS_KEY + data.fecha;
        if (localStorage.getItem(key)) return;

        setAviso(data);
        setVisible(true);
      } catch(e) {}
    };
    cargar();
  }, []);

  const handleCerrar = () => {
    if (aviso) localStorage.setItem(LS_KEY + aviso.fecha, "1");
    setVisible(false);
  };

  if (!visible || !aviso) return null;

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(0,0,0,0.75)", zIndex:700,
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px",
    }}>
      <div style={{
        background:"var(--negro)",
        border:"4px solid var(--amarillo)",
        boxShadow:"6px 6px 0 var(--amarillo-oscuro)",
        padding:"24px 20px",
        maxWidth:"380px", width:"100%",
        display:"flex", flexDirection:"column", gap:"14px",
      }}>
        <p style={{ fontSize:"8px", color:"var(--amarillo)", textAlign:"center" }}>
          📢 AVISO DEL ADMIN
        </p>
        <p style={{
          fontSize:"8px", color:"var(--blanco)",
          lineHeight:2.2, textAlign:"center",
          whiteSpace:"pre-wrap",
        }}>
          {aviso.texto}
        </p>
        <button
          className="btn-pixel btn-amarillo w-full"
          style={{ fontSize:"8px" }}
          onClick={handleCerrar}
        >
          ENTENDIDO ✕
        </button>
      </div>
    </div>
  );
}
