// Estado de la app (única fuente de verdad), guardado en el navegador y simulación del Monitor.
// Equivale a WaterMonitorViewModel.kt. Las pantallas leen `state` y llaman a las acciones;
// cada cambio avisa a quien esté suscrito con un "tema" ('tick', 'params', 'readings', ...).

import {
  DEFAULT_PARAMS, calculateWaterBalance, calculateTrend, ar1Step, debounceColor, formatCl, SEMAFORO,
} from './logic.js';
import { DATASET, THESIS_AVG_OUTPIT, THESIS_AVG_T_EXTRAIDO, THESIS_AVG_TOTAL, CHRONIC_WELLS, SERIES_YEAR } from './data.js';

const STORAGE_PREFIX = 'dmh.';
const MAX_POINTS = 60;
const MAX_EVENTS = 200;
const ALERT_COOLDOWN_MS = 5000;

export const SIM_MODES = {
  NORMAL: { label: 'Normal (tesis)', description: 'Variación aleatoria realista: media 31,2 l/s, desviación 1,3 l/s' },
  FALLA_POZOS: { label: 'Falla de pozos', description: 'Descenso gradual por descebe o falla de bombas' },
  RECUPERACION: { label: 'Recuperación', description: 'Ascenso progresivo hacia la meta operacional' },
  MANUAL: { label: 'Manual (Calculadora)', description: 'Valores fijos enviados desde la Calculadora' },
};

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'light', // claro por defecto: se lee mejor proyectado y a pleno sol

  soundEnabled: true,
  vibrationEnabled: true,
  incluirPlantaEnTotal: false,
  keepScreenOn: false, // apagado por defecto para no gastar batería (arreglo M11)
  deformacionRadarCmDia: 1.2,
});

const DEFAULT_CALC = Object.freeze({ outpit: THESIS_AVG_OUTPIT, tExtraido: THESIS_AVG_T_EXTRAIDO, pozosPlanta: 0 });
const DEFAULT_SENS = Object.freeze({ nPozos: 4, rendimientoPorPozo: 0.8 });
const defaultWells = () => CHRONIC_WELLS.map((w) => ({ ...w, isActive: false }));

// ---------- Guardado en el navegador (puede fallar en modo privado: nunca rompe la app) ----------
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    return typeof parsed === 'object' && parsed ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* sin espacio o bloqueado */ }
}
function clearStorage() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* nada */ }
}

function loadWells() {
  const saved = load('wells', []);
  return defaultWells().map((w) => ({ ...w, isActive: Boolean(saved.find((s) => s.id === w.id)?.isActive) }));
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export function nowFormatted(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------- Estado ----------
export const state = {
  params: load('params', { ...DEFAULT_PARAMS }),
  settings: load('settings', { ...DEFAULT_SETTINGS }),
  calc: load('calc', { ...DEFAULT_CALC }),
  sens: load('sens', { ...DEFAULT_SENS }),
  wells: loadWells(),
  readings: load('readings', []),
  events: load('events', []),
  live: {
    inputs: { outpit: THESIS_AVG_OUTPIT, tExtraido: THESIS_AVG_T_EXTRAIDO, pozosPlanta: 0 },
    telemetry: [],           // parte vacío: sin lecturas inventadas (arreglo M6)
    playing: true,
    speed: 1,
    mode: 'NORMAL',
    playback: { running: false, day: '' },
  },
  session: { count: 0, min: null, max: null, sum: 0, trend: 'STABLE' },
  presentation: false,
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(...topics) { for (const fn of listeners) fn(new Set(topics)); }

// Efectos de sonido/vibración/aviso: los conecta app.js.
const effects = { toast: () => {}, alert: () => {} };
export function setEffects(e) { Object.assign(effects, e); }
export function toast(message, action, kind = 'info') { effects.toast(message, action, kind); }

// ---------- Cálculos derivados ----------
export function wellsAporte() {
  return state.wells.filter((w) => w.isActive).reduce((a, w) => a + w.aporte, 0);
}
export function liveCalcs() {
  return calculateWaterBalance(state.live.inputs, state.params, {
    incluirPlanta: state.settings.incluirPlantaEnTotal,
    aportePozosRecuperados: wellsAporte(),
  });
}
export function calcCalcs() {
  return calculateWaterBalance(state.calc, state.params, { incluirPlanta: state.settings.incluirPlantaEnTotal });
}

// ---------- Acciones ----------
export function updateParams(patch) {
  state.params = { ...state.params, ...patch };
  save('params', state.params);
  emit('params');
}
export function updateSettings(patch, { persist = true } = {}) {
  state.settings = { ...state.settings, ...patch };
  if (persist) save('settings', state.settings);
  emit('settings');
}
export function updateCalc(patch) {
  state.calc = { ...state.calc, ...patch };
  save('calc', state.calc);
  emit('calc');
}
/** La sensibilidad es solo un "¿qué pasaría si...?": ya no cambia los pozos del Monitor (arreglo M4). */
export function updateSens(patch) {
  state.sens = { ...state.sens, ...patch };
  save('sens', state.sens);
  emit('sens');
}

export function toggleWell(id) {
  state.wells = state.wells.map((w) => (w.id === id ? { ...w, isActive: !w.isActive } : w));
  save('wells', state.wells.map(({ id: wid, isActive }) => ({ id: wid, isActive })));
  const w = state.wells.find((x) => x.id === id);
  toast(`Pozo ${w.name}: ${w.isActive ? `recuperado (+${formatCl(w.aporte, 1)} l/s)` : 'detenido (0,0 l/s)'}`);
  emit('wells');
  evaluateTransition(false);
}

export function applyPreset(preset) {
  updateCalc({ outpit: preset.outpit, tExtraido: preset.tExtraido });
  toast(`Atajo aplicado: ${preset.name}`);
}
export function resetCalcToThesis() {
  updateCalc({ ...DEFAULT_CALC });
  toast('Valores restablecidos al promedio de la tesis (25,13 + 6,03 = 31,2 l/s)');
}

export function sendCalcToMonitor() {
  stopPlayback(false);
  state.live.inputs = { ...state.calc };
  state.live.mode = 'MANUAL';
  emit('sim', 'tick', 'go-monitor');
  evaluateTransition(false);
  toast('Valores de la Calculadora enviados al Monitor (modo Manual)');
}

/** Caso 03-09: caudal 32,1 l/s (Amarillo) con radar crítico 11,1 cm/d en la Pared Este. */
export function loadCase0309() {
  stopPlayback(false);
  const inputs = { outpit: 26.17, tExtraido: 5.95, pozosPlanta: 0 };
  state.live.inputs = { ...inputs };
  state.live.mode = 'MANUAL';
  updateCalc(inputs);
  updateSettings({ deformacionRadarCmDia: 11.1 });
  emit('sim', 'tick', 'go-monitor');
  evaluateTransition(false);
  toast('Caso 03-09 cargado: outpit 26,17 + T. extraído 5,95 l/s, con radar crítico de 11,1 cm/d');
}

export function saveCurrentReading() {
  const c = calcCalcs();
  const reading = {
    id: uid(),
    ts: nowFormatted(),
    outpit: state.calc.outpit,
    tExtraido: state.calc.tExtraido,
    planta: state.settings.incluirPlantaEnTotal ? state.calc.pozosPlanta : 0,
    total: c.qTotal,
    meta: state.params.metaOperacional,       // se guarda la meta del momento (arreglo M5)
    porcentaje: c.porcentajeMeta,
    semaforo: c.semaforo.key,
  };
  state.readings = [reading, ...state.readings];
  save('readings', state.readings);
  emit('readings');
  toast(`Lectura guardada: ${formatCl(c.qTotal)} l/s (${c.semaforo.name})`);
}

/** Borra una lectura y ofrece deshacer (arreglo M3). */
export function deleteReading(id) {
  const index = state.readings.findIndex((r) => r.id === id);
  if (index === -1) return;
  const removed = state.readings[index];
  state.readings = state.readings.filter((r) => r.id !== id);
  save('readings', state.readings);
  emit('readings');
  toast(`Lectura del ${removed.ts} borrada`, {
    label: 'Deshacer',
    run: () => {
      const list = [...state.readings];
      list.splice(Math.min(index, list.length), 0, removed);
      state.readings = list;
      save('readings', state.readings);
      emit('readings');
    },
  });
}

/** Borra todo y deja la app como recién instalada, incluida la Calculadora (arreglo M2). */
export function clearAllData() {
  stopPlayback(false);
  clearStorage();
  state.params = { ...DEFAULT_PARAMS };
  state.settings = { ...DEFAULT_SETTINGS };
  state.calc = { ...DEFAULT_CALC };
  state.sens = { ...DEFAULT_SENS };
  state.wells = defaultWells();
  state.readings = [];
  state.live.inputs = { outpit: THESIS_AVG_OUTPIT, tExtraido: THESIS_AVG_T_EXTRAIDO, pozosPlanta: 0 };
  state.live.telemetry = [];
  state.live.mode = 'NORMAL';
  state.live.speed = 1;
  state.live.playing = true;
  state.session = { count: 0, min: null, max: null, sum: 0, trend: 'STABLE' };
  ar1Deviation = 0;
  const c = liveCalcs();
  debounce = { active: c.semaforo.key, candidate: null, count: 0 };
  state.events = [];
  addEvent(c.semaforo.key, `Datos reiniciados. Estado inicial: ${c.semaforo.name} (${formatCl(c.porcentajeMeta, 1)} %)`);
  emit('params', 'settings', 'calc', 'sens', 'wells', 'readings', 'events', 'sim', 'tick');
  toast('Se borraron las lecturas, el registro y los ajustes.');
  startLoop();
}

export function exportCsv() {
  const head = 'Fecha_Hora;Outpit_ls;T_Extraido_ls;Planta_ls;Total_ls;Meta_ls;Porcentaje_Meta;Semaforo';
  const rows = state.readings.map((r) => [
    r.ts,
    formatCl(r.outpit, 2),
    formatCl(r.tExtraido, 2),
    formatCl(r.planta, 2),
    formatCl(r.total, 2),
    formatCl(r.meta ?? state.params.metaOperacional, 1),
    formatCl(r.porcentaje ?? (r.total / state.params.metaOperacional) * 100, 1) + '%',
    SEMAFORO[r.semaforo]?.name ?? r.semaforo,
  ].join(';'));
  return '﻿' + [head, ...rows].join('\r\n') + '\r\n'; // BOM para que Excel lea bien los acentos
}

export function shareSummaryText() {
  const c = liveCalcs();
  const active = state.wells.filter((w) => w.isActive).length;
  const brecha = c.brechaMeta <= 0 ? `sobre la meta (+${formatCl(-c.brechaMeta, 1)} l/s)` : `faltan ${formatCl(c.brechaMeta, 1)} l/s`;
  return [
    'MONITOR DE BALANCE HÍDRICO · DMH',
    `Fecha: ${nowFormatted()}`,
    `Caudal total: ${formatCl(c.qTotal, 1)} l/s`,
    `% de la meta: ${formatCl(c.porcentajeMeta, 1)} %`,
    `Estado: ${c.semaforo.title}`,
    `Brecha a la meta: ${brecha}`,
    `Captura de entradas: ${formatCl(c.capturaMin, 1)} % a ${formatCl(c.capturaMax, 1)} %`,
    `Pozos recuperados: ${active}/4 (+${formatCl(wellsAporte(), 1)} l/s)`,
    'SIMULACRO · División Ministro Hales, Calama',
  ].join('\n');
}

export function setPresentation(on) { state.presentation = on; emit('presentation'); }

// ---------- Registro de eventos y alertas ----------
let debounce = { active: liveCalcs().semaforo.key, candidate: null, count: 0 };
let lastAlertAt = 0;

function addEvent(colorKey, description) {
  state.events = [{ id: uid(), ts: nowFormatted(), color: colorKey, description }, ...state.events].slice(0, MAX_EVENTS);
  save('events', state.events);
  emit('events');
}

function evaluateTransition(isPlayback) {
  const c = liveCalcs();
  const r = debounceColor(debounce, c.semaforo.key);
  debounce = r.state;
  if (!r.changed) return;
  const to = SEMAFORO[r.to];
  const msg = `Cambio de ${SEMAFORO[r.from].name} a ${to.name}: caudal ${formatCl(c.qTotal)} l/s (${formatCl(c.porcentajeMeta)} %). ${to.action}`;
  addEvent(to.key, msg);
  const now = Date.now();
  const sensory = (!isPlayback && now - lastAlertAt >= ALERT_COOLDOWN_MS) || (isPlayback && to.key === 'ROJO');
  if (sensory) {
    lastAlertAt = now;
    effects.alert(to.key);
  }
  if (!isPlayback || sensory) toast(msg, null, 'transition');
}

function pushTelemetry(q) {
  const t = [...state.live.telemetry, q];
  if (t.length > MAX_POINTS) t.shift();
  state.live.telemetry = t;
  const s = state.session;
  state.session = {
    count: s.count + 1,
    min: s.min == null ? q : Math.min(s.min, q),
    max: s.max == null ? q : Math.max(s.max, q),
    sum: s.sum + q,
    trend: calculateTrend(t),
  };
}

// ---------- Simulación ----------
let ar1Deviation = 0;
let loopTimer = null;
let playbackTimer = null;
const delayFor = (speed) => (speed === 5 ? 200 : speed === 2 ? 500 : 1000);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function nextInputs(cur) {
  switch (state.live.mode) {
    case 'NORMAL': {
      ar1Deviation = ar1Step(ar1Deviation);
      const targetQ = clamp(THESIS_AVG_TOTAL + ar1Deviation, 26.5, 34.5);
      const tExtraido = clamp(THESIS_AVG_T_EXTRAIDO + (Math.random() - 0.5) * 0.8, 5.2, 6.8);
      return { ...cur, outpit: clamp(targetQ - tExtraido, 20, 29), tExtraido };
    }
    case 'FALLA_POZOS':
      return { ...cur, outpit: Math.max(cur.outpit - 0.25, 18), tExtraido: Math.max(cur.tExtraido - 0.08, 3.5) };
    case 'RECUPERACION':
      return { ...cur, outpit: Math.min(cur.outpit + 0.3, 28.5), tExtraido: Math.min(cur.tExtraido + 0.1, 7.5) };
    default:
      return cur;
  }
}

function tick() {
  if (state.live.playing && !state.live.playback.running) {
    state.live.inputs = nextInputs(state.live.inputs);
    pushTelemetry(liveCalcs().qTotal);
    evaluateTransition(false);
  }
  emit('tick');
}

export function startLoop() {
  clearTimeout(loopTimer);
  const run = () => { tick(); loopTimer = setTimeout(run, delayFor(state.live.speed)); };
  loopTimer = setTimeout(run, delayFor(state.live.speed));
}

export function setPlaying(playing) { state.live.playing = playing; emit('sim'); }
export function setSpeed(speed) { state.live.speed = speed; emit('sim'); startLoop(); }
export function setMode(mode) {
  state.live.mode = mode;
  if (mode === 'MANUAL') state.live.inputs = { ...state.calc };
  emit('sim', 'tick');
}

function stopPlayback(notify = true) {
  if (!state.live.playback.running) return;
  clearTimeout(playbackTimer);
  state.live.playback = { running: false, day: '' };
  emit('sim', 'playback');
  if (notify) toast('Reproducción de la serie detenida');
}

/** Reproduce los 69 días reales en el Monitor (o la detiene si ya está corriendo). */
export function togglePlayback() {
  if (state.live.playback.running) { stopPlayback(true); return; }
  let i = 0;
  state.live.playback = { running: true, day: '' };
  state.live.telemetry = [];
  toast('Reproduciendo la serie real (69 días)…');
  const step = () => {
    if (i >= DATASET.length) {
      state.live.playback = { running: false, day: '' };
      emit('sim', 'playback', 'tick');
      toast('Reproducción de la serie completada');
      return;
    }
    const item = DATASET[i++];
    state.live.playback = { running: true, day: `${item.diaMes}-${SERIES_YEAR}` };
    state.live.inputs = { outpit: item.outpit, tExtraido: item.tExtraido, pozosPlanta: 0 };
    pushTelemetry(liveCalcs().qTotal);
    evaluateTransition(true);
    emit('playback', 'tick');
    playbackTimer = setTimeout(step, delayFor(state.live.speed));
  };
  emit('sim', 'go-monitor');
  step();
}

/** Arranque: registra el estado inicial y echa a andar la simulación. */
export function init() {
  if (!state.events.length) {
    const c = liveCalcs();
    addEvent(c.semaforo.key, `Inicio de monitoreo. Estado inicial: ${c.semaforo.name} (${formatCl(c.porcentajeMeta, 1)} %)`);
  }
  startLoop();
}
