// ============================================================
// UTILIDADES — Cálculo de puntajes y helpers de fecha
// ============================================================

/**
 * Calcula si un partido todavía acepta predicciones.
 * Cierra 1 hora antes del inicio.
 */
export function partidoAbierto(fecha, horaInicio) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [hora, min] = horaInicio.split(":").map(Number);
  const inicio = new Date(anio, mes - 1, dia, hora, min, 0);
  const cierre = new Date(inicio.getTime() - 60 * 60 * 1000); // -1 hora
  return new Date() < cierre;
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD (hora local).
 */
export function hoyStr() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retorna la fecha de ayer en formato YYYY-MM-DD.
 */
export function ayerStr() {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const y = ayer.getFullYear();
  const m = String(ayer.getMonth() + 1).padStart(2, "0");
  const d = String(ayer.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calcula puntos de una predicción de partido.
 * prediccion: { ganador: "local"|"empate"|"visitante", diferencia: "1"|"2+" }
 * resultado:  { golesLocal: number, golesVisitante: number }
 * estaDestacado: boolean
 */
export function calcularPuntosPartido(prediccion, resultado, estaDestacado) {
  if (!resultado || !prediccion) return 0;

  const { golesLocal, golesVisitante } = resultado;
  const diff = Math.abs(golesLocal - golesVisitante);

  // Determinar ganador real
  let ganadorReal;
  if (golesLocal > golesVisitante) ganadorReal = "local";
  else if (golesVisitante > golesLocal) ganadorReal = "visitante";
  else ganadorReal = "empate";

  // Diferencia real
  const diferenciaReal = diff === 1 ? "1" : "2+";

  if (estaDestacado) {
    // Partido destacado: predicción exacta de goles
    const { golesLocalPred, golesVisitantePred } = prediccion;
    if (
      golesLocalPred === golesLocal &&
      golesVisitantePred === golesVisitante
    ) {
      return 3; // Resultado exacto
    } else if (ganadorReal === prediccion.ganador) {
      return 1; // Solo ganador
    }
    return 0;
  } else {
    // Partido normal
    let puntos = 0;
    if (prediccion.ganador === ganadorReal) puntos += 1;
    if (prediccion.ganador === ganadorReal && prediccion.diferencia === diferenciaReal) {
      puntos += 1;
    }
    return puntos;
  }
}

/**
 * Calcula puntos de la pregunta del día.
 */
export function calcularPuntosPregunta(respuestaUsuario, respuestaCorrecta) {
  if (!respuestaCorrecta || !respuestaUsuario) return 0;
  return respuestaUsuario === respuestaCorrecta ? 2 : 0;
}

/**
 * Formatea hora para mostrar (HH:MM hrs)
 */
export function formatHora(horaStr) {
  return `${horaStr} hrs`;
}

/**
 * Formatea fecha legible en español
 */
export function formatFecha(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
