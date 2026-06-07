import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { partidoAbierto, formatHora } from "../utils/helpers";

export default function PartidoCard({ partido }) {
  const { firebaseUser } = useAuth();
  const {
    id,
    fecha,
    horaInicio,
    local,
    visitante,
    estaDestacado,
    resultado,
  } = partido;

  const abierto = partidoAbierto(fecha, horaInicio);

  const [ganadorSel, setGanadorSel] = useState(null); // "local"|"empate"|"visitante"
  const [difSel, setDifSel] = useState(null);          // "1"|"2+"
  const [golesLocalPred, setGolesLocalPred] = useState("");
  const [golesVisPred, setGolesVisPred] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [predExistente, setPredExistente] = useState(null);

  // Cargar predicción previa
  useEffect(() => {
    if (!firebaseUser) return;
    const cargar = async () => {
      const ref = doc(db, "predicciones", `${firebaseUser.uid}_${id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setPredExistente(data);
        setGanadorSel(data.ganador);
        setDifSel(data.diferencia || null);
        if (estaDestacado) {
          setGolesLocalPred(String(data.golesLocalPred ?? ""));
          setGolesVisPred(String(data.golesVisitantePred ?? ""));
        }
        setGuardado(true);
      }
    };
    cargar();
  }, [firebaseUser, id, estaDestacado]);

  const handleGuardar = async () => {
    if (!ganadorSel) return;
    if (!estaDestacado && !difSel) return;
    if (estaDestacado && (golesLocalPred === "" || golesVisPred === "")) return;

    setGuardando(true);
    try {
      const predData = {
        uid: firebaseUser.uid,
        partidoId: id,
        fecha,
        ganador: ganadorSel,
        estaDestacado,
        guardadoEn: new Date().toISOString(),
      };

      if (estaDestacado) {
        predData.golesLocalPred = Number(golesLocalPred);
        predData.golesVisitantePred = Number(golesVisPred);
        // También inferir ganador del resultado exacto
        const gl = Number(golesLocalPred);
        const gv = Number(golesVisPred);
        predData.ganador = gl > gv ? "local" : gv > gl ? "visitante" : "empate";
      } else {
        predData.diferencia = difSel;
      }

      await setDoc(
        doc(db, "predicciones", `${firebaseUser.uid}_${id}`),
        predData
      );
      setGuardado(true);
    } catch (e) {
      console.error("Error guardando predicción:", e);
    } finally {
      setGuardando(false);
    }
  };

  // Si partido tiene resultado real, mostrar resultado
  const tieneResultado = resultado !== null && resultado !== undefined;

  return (
    <div className={`partido-card ${estaDestacado ? "partido-destacado-card" : ""}`}>
      {estaDestacado && (
        <div className="partido-badge">⭐ DESTACADO</div>
      )}

      <div className="partido-hora">
        🕐 {formatHora(horaInicio)}
        {!abierto && !tieneResultado && (
          <span style={{ color: "var(--rojo-chile)", marginLeft: "8px" }}>
            [CERRADO]
          </span>
        )}
      </div>

      {/* Equipos */}
      <div className="partido-equipos">
        <div className="partido-equipo">
          <span className="partido-bandera">{local.bandera}</span>
          <span className="partido-nombre">{local.nombre}</span>
        </div>
        <span className="partido-vs">VS</span>
        <div className="partido-equipo">
          <span className="partido-bandera">{visitante.bandera}</span>
          <span className="partido-nombre">{visitante.nombre}</span>
        </div>
      </div>

      {/* Resultado real (si ya se jugó) */}
      {tieneResultado && (
        <div style={{
          textAlign: "center",
          background: "var(--negro)",
          border: "2px solid var(--verde-claro)",
          padding: "8px",
          margin: "8px 0",
          fontSize: "14px",
        }}>
          <span>{resultado.golesLocal}</span>
          <span style={{ padding: "0 8px", fontSize: "10px", color: "var(--gris-claro)" }}>-</span>
          <span>{resultado.golesVisitante}</span>
          {predExistente && (
            <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginTop: "6px" }}>
              Tu pred: {estaDestacado
                ? `${predExistente.golesLocalPred}-${predExistente.golesVisitantePred}`
                : predExistente.ganador === "local"
                  ? local.nombre
                  : predExistente.ganador === "visitante"
                    ? visitante.nombre
                    : "EMPATE"}
            </p>
          )}
        </div>
      )}

      {/* Predicción (si partido está abierto) */}
      {abierto && !tieneResultado && (
        <div>
          {estaDestacado ? (
            /* Partido destacado: resultado exacto */
            <div>
              <p style={{ fontSize: "7px", color: "var(--amarillo)", textAlign: "center", marginBottom: "8px" }}>
                PREDICE EL MARCADOR EXACTO
              </p>
              <div className="resultado-exacto">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={golesLocalPred}
                  onChange={(e) => setGolesLocalPred(e.target.value)}
                  placeholder="0"
                />
                <span style={{ fontSize: "18px", color: "var(--amarillo)" }}>-</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={golesVisPred}
                  onChange={(e) => setGolesVisPred(e.target.value)}
                  placeholder="0"
                />
              </div>
              <p style={{ fontSize: "6px", color: "var(--gris-claro)", textAlign: "center", marginTop: "6px" }}>
                Acierto exacto: 3 pts | Solo ganador: 1 pt
              </p>
            </div>
          ) : (
            /* Partido normal */
            <div>
              <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                ¿QUIÉN GANA?
              </p>
              <div className="pred-opciones">
                <button
                  className={`pred-btn ${ganadorSel === "local" ? "seleccionado" : ""}`}
                  onClick={() => setGanadorSel("local")}
                >
                  {local.bandera} {local.nombre}
                </button>
                <button
                  className={`pred-btn ${ganadorSel === "empate" ? "seleccionado" : ""}`}
                  onClick={() => setGanadorSel("empate")}
                >
                  🤝 EMPATE
                </button>
                <button
                  className={`pred-btn ${ganadorSel === "visitante" ? "seleccionado" : ""}`}
                  onClick={() => setGanadorSel("visitante")}
                >
                  {visitante.bandera} {visitante.nombre}
                </button>
              </div>

              {ganadorSel && ganadorSel !== "empate" && (
                <div>
                  <p style={{ fontSize: "7px", color: "var(--verde-claro)", marginBottom: "6px" }}>
                    ¿POR CUÁNTO?
                  </p>
                  <div className="pred-opciones">
                    <button
                      className={`pred-btn ${difSel === "1" ? "seleccionado" : ""}`}
                      onClick={() => setDifSel("1")}
                    >
                      1 GOL
                    </button>
                    <button
                      className={`pred-btn ${difSel === "2+" ? "seleccionado" : ""}`}
                      onClick={() => setDifSel("2+")}
                    >
                      2+ GOLES
                    </button>
                  </div>
                </div>
              )}

              {ganadorSel === "empate" && setDifSel(null)}

              <p style={{ fontSize: "6px", color: "var(--gris-claro)", marginTop: "4px" }}>
                Ganador: 1 pt | + diferencia: 1 pt extra
              </p>
            </div>
          )}

          <button
            className="btn-pixel btn-verde w-full"
            style={{ marginTop: "12px" }}
            onClick={handleGuardar}
            disabled={guardando || guardado}
          >
            {guardando
              ? "GUARDANDO..."
              : guardado
                ? "✅ PREDICCIÓN GUARDADA"
                : "💾 GUARDAR"}
          </button>

          {guardado && (
            <p className="pred-guardado-ok">
              ✓ Puedes cambiarla antes del cierre
            </p>
          )}
        </div>
      )}

      {!abierto && !tieneResultado && (
        <div className="partido-cerrado">
          🔒 PREDICCIONES CERRADAS
        </div>
      )}
    </div>
  );
}
