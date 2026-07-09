// src/utils/scoring.js — lógica pura de puntaje (SIN firebase; testeable)
// Movida desde helpers.js para poder testearla sin inicializar firebase.
import { CARTAS } from "../data/sampleData.js";

// ── Cálculo de puntos ────────────────────────────────────────
// Multiplicador por fase eliminatoria
function multFase(fase) {
  if (fase === "dieciseisavos" || fase === "octavos") return 2;
  if (fase === "cuartos")    return 4;
  if (fase === "semifinal")  return 8;
  if (fase === "final")      return 12;
  return 1;
}

export function calcularPuntosPartido(prediccion, resultado, fase, estaDestacado) {
  if (!resultado || !prediccion) return { puntos: 0, esMaximo: false };
  const esElim = fase && fase !== "grupos";
  if (!esElim) {
    const { golesLocal: gl, golesVisitante: gv } = resultado;
    const ganReal = gl > gv ? "local" : gv > gl ? "visitante" : "empate";
    const difReal = Math.abs(gl-gv) === 1 ? "1" : "2+";
    if (estaDestacado) {
      const exacto = Number(prediccion.golesLocalPred) === gl && Number(prediccion.golesVisitantePred) === gv;
      if (exacto) return { puntos: 5, esMaximo: true };
      if (prediccion.ganador === ganReal) return { puntos: 2, esMaximo: true };
      return { puntos: 0, esMaximo: false };
    } else {
      let pts = 0;
      if (prediccion.ganador === ganReal) {
        pts += 1;
        if (ganReal !== "empate" && prediccion.diferencia === difReal) pts += 2;
      }
      const m = multFase(fase); if (m > 1 && pts > 0) pts *= m;
  return { puntos: pts, esMaximo: pts > 0 };
    }
  }
  const { golesLocal: gl, golesVisitante: gv, definicion,
    golesLocalAlargue, golesVisitanteAlargue,
    penalesLocal, penalesVisitante, ganadorFinal } = resultado;
  const gan90     = gl > gv ? "local" : gv > gl ? "visitante" : null;
  const dif90Real = Math.abs(gl-gv) === 1 ? "1" : "2+";
  // Ganador real del partido (puede ser por normal, alargue o penales)
  const ganadorReal = ganadorFinal || gan90;

  let pts = 0;

  if (definicion === "normal") {
    if (prediccion.definicion === "normal" && prediccion.ganador90 === gan90) {
      pts += 2;
      if (prediccion.diferencia90 === dif90Real) pts += 1;
    } else if (prediccion.ganador90 === gan90) {
      // Acertó el ganador aunque pronosticó otra definición → premio base
      pts += 2;
    }
  } else if (definicion === "alargue") {
    if (prediccion.definicion === "alargue") {
      pts += 3;
      const dAlg  = Math.abs((golesLocalAlargue??0)-(golesVisitanteAlargue??0));
      const dAlgR = dAlg === 1 ? "1" : "2+";
      if (prediccion.ganadorAlargue === ganadorFinal && prediccion.diferenciaAlargue === dAlgR) pts += 3;
    } else if (prediccion.ganador90 === ganadorFinal || prediccion.ganadorAlargue === ganadorFinal || prediccion.ganadorPenales === ganadorFinal) {
      // Acertó el ganador aunque pronosticó otra definición → premio base
      pts += 2;
    }
  } else if (definicion === "penales") {
    if (prediccion.definicion === "penales") {
      pts += 3;
      const exacta = Number(prediccion.penalesLocal) === penalesLocal && Number(prediccion.penalesVisitante) === penalesVisitante;
      if (exacta) pts += 4;
      else if (prediccion.ganadorPenales === ganadorFinal) pts += 2;
    } else if (prediccion.ganador90 === ganadorFinal || prediccion.ganadorAlargue === ganadorFinal || prediccion.ganadorPenales === ganadorFinal) {
      // Acertó el ganador aunque pronosticó otra definición → premio base
      pts += 2;
    }
  }

  const mult = multFase(fase); if (mult > 1 && pts > 0) pts *= mult;
  return { puntos: pts, esMaximo: pts > 0 };
}

export function calcularPuntosPregunta(resp, correcta) {
  if (!correcta || !resp) return 0;
  return resp === correcta ? 2 : 0;
}

export function aplicarMultiplicadorCarta(puntos, esMaximo, cartaId) {
  if (!cartaId || !esMaximo || puntos === 0) return puntos;
  const carta = CARTAS.find(c => c.id === cartaId);
  return carta ? puntos * carta.multiplicador : puntos;
}

// ¿Se aplica la carta a esta predicción?
// - En recálculo (ya consumida antes), se respeta la decisión original.
// - En primer procesamiento, solo si hay stock disponible en el inventario.
// Evita que una misma carta multiplique varios partidos y que el contador
// quede negativo.
export function cartaSeAplica(tieneCartaId, yaConsumio, stockActual) {
  if (!tieneCartaId) return false;
  if (yaConsumio) return true;
  return (stockActual || 0) > 0;
}
