// Cálculos del balance hídrico. Funciones puras, sin acceso a la pantalla,
// para poder probarlas con `npm test`. Equivale a WaterMath.kt de la app Android.

export const TOLERANCE = 1e-9;

export const SEMAFORO = {
  VERDE:    { key: 'VERDE',    name: 'Verde',    title: 'VERDE · Meta cumplida',      action: 'Meta cumplida' },
  AMARILLO: { key: 'AMARILLO', name: 'Amarillo', title: 'AMARILLO · Cerca de la meta', action: 'Cerca de la meta: revisar pozos con bajo caudal' },
  NARANJA:  { key: 'NARANJA',  name: 'Naranja',  title: 'NARANJA · Bajo la meta',      action: 'Bajo la meta: recuperar pozos detenidos' },
  ROJO:     { key: 'ROJO',     name: 'Rojo',     title: 'ROJO · Crítico',              action: 'Crítico: intervenir y revisar ubicación de pozos' },
};

export const RADAR = {
  VERDE:       { key: 'VERDE',       short: 'Verde',       label: 'Verde · Deformación normal (< 2 cm/d)' },
  SEGUIMIENTO: { key: 'SEGUIMIENTO', short: 'Seguimiento', label: 'Seguimiento · Monitoreo (2 a 6 cm/d)' },
  NARANJA:     { key: 'NARANJA',     short: 'Naranja',     label: 'Naranja · Alerta acelerada (6 a 10 cm/d)' },
  ROJO:        { key: 'ROJO',        short: 'Rojo',        label: 'Rojo · Deformación crítica (≥ 10 cm/d)' },
};

export const DEFAULT_PARAMS = Object.freeze({
  metaOperacional: 35.0,
  potencialMin: 52.0,
  potencialMax: 67.0,
  recargaNorte: 50.0,
  recargaEsteMin: 20.0,
  recargaEsteMax: 50.0,
  umbralVerde: 100.0,
  umbralAmarillo: 90.0,
  umbralNaranja: 80.0,
  regla80EsNaranja: false, // false = 80,0 % exacto es Rojo; true = Naranja (criterio tesis)
});

/** Redondeo "mitad al par" (igual que DecimalFormat de Java), tolerante a errores binarios. */
function roundHalfEven(value, decimals) {
  const f = 10 ** decimals;
  const x = value * f;
  const floor = Math.floor(x);
  const diff = x - floor;
  let r;
  if (Math.abs(diff - 0.5) < 1e-7) r = floor % 2 === 0 ? floor : floor + 1;
  else r = Math.round(x);
  return r / f;
}

/**
 * Formato chileno: coma decimal y punto de miles. Ej.: 31,2 · 185.803
 */
export function formatCl(value, decimals = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const rounded = roundHalfEven(Math.abs(value), decimals);
  const [intPart, decPart] = rounded.toFixed(decimals).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const negative = value < 0 && rounded !== 0;
  return (negative ? '-' : '') + grouped + (decPart ? ',' + decPart : '');
}

/** Igual que formatCl pero con signo explícito (+ o -). */
export function formatSignedCl(value, decimals = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const formatted = formatCl(Math.abs(value), decimals);
  if (value > TOLERANCE) return '+' + formatted;
  if (value < -TOLERANCE) return '-' + formatted;
  return formatted;
}

/** Interpreta texto escrito por una persona ("25,13", "25.13", " 7 ") como número. */
export function parseCl(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim().replace(',', '.');
  if (t === '' || !/^-?\d*\.?\d*$/.test(t) || t === '.' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Cantidad de decimales que corresponde mostrar para un paso (0,05 → 2; 0,1 → 1; 1 → 0). */
export function decimalsForStep(step) {
  if (step >= 1) return 0;
  const s = String(step);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/**
 * Semáforo con precisión estricta (1e-9):
 * VERDE ≥ umbralVerde · AMARILLO ≥ umbralAmarillo · NARANJA > umbralNaranja · ROJO el resto.
 * Si regla80EsNaranja, el umbral naranja exacto cuenta como NARANJA.
 */
export function calculateSemaforo(porcentaje, {
  regla80EsNaranja = false,
  umbralVerde = 100,
  umbralAmarillo = 90,
  umbralNaranja = 80,
} = {}) {
  if (typeof porcentaje !== 'number' || !Number.isFinite(porcentaje)) return SEMAFORO.ROJO;
  if (regla80EsNaranja && Math.abs(porcentaje - umbralNaranja) < TOLERANCE) return SEMAFORO.NARANJA;
  if (porcentaje >= umbralVerde - TOLERANCE) return SEMAFORO.VERDE;
  if (porcentaje >= umbralAmarillo - TOLERANCE) return SEMAFORO.AMARILLO;
  if (porcentaje > umbralNaranja + TOLERANCE) return SEMAFORO.NARANJA;
  return SEMAFORO.ROJO;
}

/** Valida verde > amarillo > naranja > 0. Devuelve el mensaje de error o null. */
export function validateThresholds(verde, amarillo, naranja) {
  if (naranja <= 0) return 'El umbral Naranja debe ser mayor a 0 %';
  if (amarillo <= naranja) return 'El umbral Amarillo debe ser mayor que el Naranja';
  if (verde <= amarillo) return 'El umbral Verde debe ser mayor que el Amarillo';
  if (verde > 200) return 'El umbral Verde no puede superar el 200 %';
  return null;
}

/** Calcula todo el balance a partir de los insumos y parámetros. No modifica las entradas. */
export function calculateWaterBalance(inputs, params = DEFAULT_PARAMS, {
  incluirPlanta = false,
  aportePozosRecuperados = 0,
} = {}) {
  const qBase = inputs.outpit + inputs.tExtraido + (incluirPlanta ? (inputs.pozosPlanta || 0) : 0);
  const qTotal = Math.max(qBase + aportePozosRecuperados, 0);
  const meta = params.metaOperacional;

  const porcentajeMeta = meta > 0 ? (qTotal / meta) * 100 : 0;
  const brechaMeta = meta - qTotal;
  const semaforo = calculateSemaforo(porcentajeMeta, params);

  const potMin = Math.max(params.potencialMin, 1);
  const potMax = Math.max(params.potencialMax, potMin);
  const entradasMin = Math.max(params.recargaNorte + params.recargaEsteMin, 1);
  const entradasMax = Math.max(params.recargaNorte + params.recargaEsteMax, entradasMin);

  return {
    qTotal,
    porcentajeMeta,
    brechaMeta,
    semaforo,
    porcentajePotencialMin: (qTotal / potMax) * 100,
    porcentajePotencialMax: (qTotal / potMin) * 100,
    brechaPotencialMin: potMin - qTotal,
    brechaPotencialMax: potMax - qTotal,
    entradasMin,
    entradasMax,
    capturaMin: (qTotal / entradasMax) * 100,
    capturaMax: (qTotal / entradasMin) * 100,
    aguaSinExtraerMin: Math.max(entradasMin - qTotal, 0),
    aguaSinExtraerMax: Math.max(entradasMax - qTotal, 0),
    variacionAlmacenamientoMin: entradasMin - qTotal,
    variacionAlmacenamientoMax: entradasMax - qTotal,
    m3PorDia: qTotal * 86.4,                       // l/s × 86.400 s ÷ 1.000
    hm3PorAnio: (qTotal * 31_536_000) / 1e9,       // l/s × s/año ÷ 10⁹
    aportePozosRecuperados,
  };
}

/** Sensibilidad: ¿qué pasa si recupero N pozos con cierto rendimiento? */
export function calculateSensitivity(qActual, params, { nPozos, rendimientoPorPozo }) {
  const qProyectado = Math.max(qActual + nPozos * rendimientoPorPozo, 0);
  const meta = params.metaOperacional;
  const porcentajeProyectado = meta > 0 ? (qProyectado / meta) * 100 : 0;
  return { qProyectado, porcentajeProyectado, semaforo: calculateSemaforo(porcentajeProyectado, params) };
}

/** Radar interferométrico (cm/día): < 2 verde · < 6 seguimiento · < 10 naranja · resto rojo. */
export function calculateRadarStatus(cmDia) {
  if (cmDia < 2) return RADAR.VERDE;
  if (cmDia < 6) return RADAR.SEGUIMIENTO;
  if (cmDia < 10) return RADAR.NARANJA;
  return RADAR.ROJO;
}

/** Estadísticas de una serie [{ label, value }] con conteo por color del semáforo. */
export function calculateDatasetStats(items, params = DEFAULT_PARAMS) {
  const empty = { count: 0, mean: 0, stdDev: 0, cvPercent: 0, minVal: 0, minDate: '', maxVal: 0, maxDate: '',
    countVerde: 0, countAmarillo: 0, countNaranja: 0, countRojo: 0 };
  if (!items.length) return empty;

  const values = items.map((i) => i.value);
  const count = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / count;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(count - 1, 1);
  const stdDev = Math.sqrt(variance);
  const meta = Math.max(params.metaOperacional, 0.1);

  let minItem = items[0];
  let maxItem = items[0];
  const counts = { VERDE: 0, AMARILLO: 0, NARANJA: 0, ROJO: 0 };
  for (const item of items) {
    if (item.value < minItem.value) minItem = item;
    if (item.value > maxItem.value) maxItem = item;
    counts[calculateSemaforo((item.value / meta) * 100, params).key]++;
  }

  return {
    count,
    mean,
    stdDev,
    cvPercent: mean > 0 ? (stdDev / mean) * 100 : 0,
    minVal: minItem.value,
    minDate: minItem.label,
    maxVal: maxItem.value,
    maxDate: maxItem.label,
    countVerde: counts.VERDE,
    countAmarillo: counts.AMARILLO,
    countNaranja: counts.NARANJA,
    countRojo: counts.ROJO,
  };
}

/**
 * Tendencia: compara el promedio de las últimas 10 lecturas con las 10 anteriores.
 * Con menos de 20 lecturas aún no hay tendencia confiable.
 */
export function calculateTrend(points) {
  if (points.length < 20) return 'STABLE';
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const diff = avg(points.slice(-10)) - avg(points.slice(-20, -10));
  if (diff > 0.15) return 'RISING';
  if (diff < -0.15) return 'FALLING';
  return 'STABLE';
}

/** Ruido gaussiano (Box-Muller). `rand` permite fijar la semilla en las pruebas. */
export function gaussian(rand = Math.random) {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Proceso AR(1) de la tesis: x(t) = φ·x(t−1) + ε, con φ = 0,85 y σ(ε) = 0,69.
 * Desviación estacionaria = 0,69 / √(1 − 0,85²) ≈ 1,31 l/s.
 */
export const AR1 = { phi: 0.85, sigma: 0.69 };
export function ar1Step(prev, rand = Math.random) {
  return AR1.phi * prev + gaussian(rand) * AR1.sigma;
}

/**
 * Antirrebote de alertas: un color nuevo debe repetirse en 2 lecturas seguidas
 * antes de confirmarse. Devuelve el nuevo estado y si hubo transición.
 */
export function debounceColor(state, instantKey) {
  if (instantKey === state.active) return { state: { active: state.active, candidate: null, count: 0 }, changed: false };
  const count = state.candidate === instantKey ? state.count + 1 : 1;
  if (count >= 2) {
    return { state: { active: instantKey, candidate: null, count: 0 }, changed: true, from: state.active, to: instantKey };
  }
  return { state: { active: state.active, candidate: instantKey, count }, changed: false };
}
