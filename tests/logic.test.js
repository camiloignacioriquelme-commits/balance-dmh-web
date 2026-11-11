// Pruebas de los cálculos. Son las mismas que traía la app Android (ExampleUnitTest.kt)
// más algunas nuevas para los arreglos de la Etapa 2. Se corren con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSemaforo, calculateWaterBalance, calculateDatasetStats, calculateSensitivity,
  calculateRadarStatus, calculateTrend, validateThresholds, formatCl, formatSignedCl,
  parseCl, decimalsForStep, ar1Step, debounceColor, DEFAULT_PARAMS,
} from '../js/logic.js';
import { DATASET, THESIS_AVG_OUTPIT, THESIS_AVG_T_EXTRAIDO, TOTAL_CALENDAR_DAYS, dayIndexFromStart } from '../js/data.js';

const pct = (q, meta = 35) => (q / meta) * 100;
const sem = (p, opts) => calculateSemaforo(p, opts).key;

test('reglas del semáforo (sección 6 de la tesis)', () => {
  assert.equal(sem(pct(35)), 'VERDE');
  assert.equal(formatCl(pct(35), 1), '100,0');
  assert.equal(sem(pct(36)), 'VERDE');
  assert.equal(formatCl(pct(36), 1), '102,9');
  assert.equal(sem(pct(31.5)), 'AMARILLO');
  assert.equal(formatCl(pct(31.5), 1), '90,0');
  assert.equal(sem(pct(31.39)), 'NARANJA');
  assert.equal(formatCl(pct(31.39), 1), '89,7');
  assert.equal(sem(pct(31.2)), 'NARANJA');
  assert.equal(formatCl(pct(31.2), 1), '89,1');
  assert.equal(sem(pct(28)), 'ROJO');
  assert.equal(sem(pct(28), { regla80EsNaranja: true }), 'NARANJA');
  assert.equal(sem(pct(27.95)), 'ROJO');
  assert.equal(formatCl(pct(27.95), 1), '79,9');
  assert.equal(sem(0), 'ROJO');
  assert.equal(sem(NaN), 'ROJO');
});

test('serie histórica: 69 días y sus estadísticas', () => {
  assert.equal(DATASET.length, 69);
  const stats = calculateDatasetStats(DATASET.map((d) => ({ label: d.diaMes, value: d.total })), DEFAULT_PARAMS);
  assert.equal(stats.countVerde, 0);
  assert.equal(stats.countAmarillo, 29);
  assert.equal(stats.countNaranja, 37);
  assert.equal(stats.countRojo, 3);
  assert.equal(formatCl(stats.mean, 1), '31,2');
  assert.equal(formatCl(stats.stdDev, 2), '1,27');
  assert.ok(stats.cvPercent > 3.9 && stats.cvPercent < 4.2);
  assert.equal(formatCl(stats.minVal, 2), '26,78');
  assert.equal(stats.minDate, '11-08');
  assert.equal(formatCl(stats.maxVal, 2), '33,52');
  assert.equal(stats.maxDate, '30-09');
});

test('calendario de la serie: 79 días del 10-08 al 27-10', () => {
  assert.equal(dayIndexFromStart('10-08'), 0);
  assert.equal(dayIndexFromStart('01-09'), 22);
  assert.equal(dayIndexFromStart('01-10'), 52);
  assert.equal(TOTAL_CALENDAR_DAYS, 79);
});

test('valores iniciales: 25,13 + 6,03 = 31,2 l/s (89,0 %, Naranja)', () => {
  const c = calculateWaterBalance({ outpit: THESIS_AVG_OUTPIT, tExtraido: THESIS_AVG_T_EXTRAIDO, pozosPlanta: 0 });
  assert.equal(formatCl(c.qTotal, 1), '31,2');
  assert.equal(formatCl(c.porcentajeMeta, 1), '89,0');
  assert.equal(c.semaforo.key, 'NARANJA');
});

test('recuperar 4 pozos crónicos suma 3,2 l/s sin modificar el outpit', () => {
  const inputs = { outpit: THESIS_AVG_OUTPIT, tExtraido: THESIS_AVG_T_EXTRAIDO, pozosPlanta: 0 };
  const c = calculateWaterBalance(inputs, DEFAULT_PARAMS, { aportePozosRecuperados: 4 * 0.8 });
  assert.ok(Math.abs(c.qTotal - 34.36) < 0.01);
  assert.equal(formatCl(c.porcentajeMeta, 1), '98,2');
  assert.equal(c.semaforo.key, 'AMARILLO');
  assert.equal(inputs.outpit, THESIS_AVG_OUTPIT);
});

test('pozos planta solo se suman si el interruptor está activo', () => {
  const inputs = { outpit: 25, tExtraido: 6, pozosPlanta: 2 };
  assert.equal(calculateWaterBalance(inputs).qTotal, 31);
  assert.equal(calculateWaterBalance(inputs, DEFAULT_PARAMS, { incluirPlanta: true }).qTotal, 33);
});

test('proceso AR(1): desviación estacionaria cerca de 1,3 l/s', () => {
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let x = 0;
  const samples = [];
  for (let i = 0; i < 10_000; i++) { x = ar1Step(x, rand); samples.push(31.16 + x); }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sd = Math.sqrt(samples.reduce((a, v) => a + (v - mean) ** 2, 0) / (samples.length - 1));
  assert.ok(sd > 1.15 && sd < 1.45, `desviación ${sd}`);
  assert.ok(Math.abs(mean - 31.16) < 0.2, `media ${mean}`);
});

test('validación de umbrales', () => {
  assert.equal(validateThresholds(100, 90, 80), null);
  assert.notEqual(validateThresholds(100, 90, 0), null);
  assert.notEqual(validateThresholds(100, 80, 80), null);
  assert.notEqual(validateThresholds(90, 90, 80), null);
});

test('protección contra división por cero y formato de signos', () => {
  const zero = { ...DEFAULT_PARAMS, metaOperacional: 0, potencialMin: 0, potencialMax: 0, recargaNorte: 0, recargaEsteMin: 0, recargaEsteMax: 0 };
  const c = calculateWaterBalance({ outpit: 0, tExtraido: 0 }, zero);
  assert.equal(c.porcentajeMeta, 0);
  for (const v of Object.values(c)) if (typeof v === 'number') assert.ok(Number.isFinite(v));
  assert.equal(formatCl(NaN), '—');
  assert.equal(formatSignedCl(Infinity), '—');
  assert.equal(formatSignedCl(3.8, 1), '+3,8');
  assert.equal(formatSignedCl(-3.8, 1), '-3,8');
});

test('formato chileno con miles y redondeo', () => {
  assert.equal(formatCl(2692.224, 0), '2.692');
  assert.equal(formatCl(185803, 0), '185.803');
  assert.equal(formatCl(0.98, 2), '0,98');
  assert.equal(formatCl(-0.04, 1), '0,0');
});

test('lectura de números escritos (arreglo N2)', () => {
  assert.equal(parseCl('25,13'), 25.13);
  assert.equal(parseCl('25.13'), 25.13);
  assert.equal(parseCl(' 7 '), 7);
  assert.equal(parseCl('25,'), 25);
  assert.equal(parseCl(''), null);
  assert.equal(parseCl('abc'), null);
  assert.equal(parseCl('1,2,3'), null);
});

test('decimales según el paso (arreglo M7)', () => {
  assert.equal(decimalsForStep(0.05), 2);
  assert.equal(decimalsForStep(0.1), 1);
  assert.equal(decimalsForStep(1), 0);
  assert.equal(formatCl(0.85, decimalsForStep(0.05)), '0,85');
});

test('umbrales personalizados cambian el semáforo (arreglo N3)', () => {
  const p = { ...DEFAULT_PARAMS, umbralVerde: 95, umbralAmarillo: 85, umbralNaranja: 75 };
  assert.equal(calculateWaterBalance({ outpit: 25.13, tExtraido: 6.03 }, p).semaforo.key, 'AMARILLO');
});

test('sensibilidad: 4 pozos × 0,8 l/s desde el promedio de la tesis', () => {
  const r = calculateSensitivity(31.16, DEFAULT_PARAMS, { nPozos: 4, rendimientoPorPozo: 0.8 });
  assert.ok(Math.abs(r.qProyectado - 34.36) < 1e-9);
  assert.equal(r.semaforo.key, 'AMARILLO');
});

test('radar: límites 2, 6 y 10 cm/día', () => {
  assert.equal(calculateRadarStatus(1.9).key, 'VERDE');
  assert.equal(calculateRadarStatus(2).key, 'SEGUIMIENTO');
  assert.equal(calculateRadarStatus(6).key, 'NARANJA');
  assert.equal(calculateRadarStatus(10).key, 'ROJO');
  assert.equal(calculateRadarStatus(11.1).key, 'ROJO');
});

test('caso 03-09: caudal en Amarillo con radar en Rojo', () => {
  const c = calculateWaterBalance({ outpit: 26.17, tExtraido: 5.95 });
  assert.equal(formatCl(c.qTotal, 1), '32,1');
  assert.equal(c.semaforo.key, 'AMARILLO');
});

test('tendencia: necesita 20 lecturas y detecta subidas y bajadas', () => {
  assert.equal(calculateTrend([30, 31, 32]), 'STABLE');
  assert.equal(calculateTrend([...Array(10).fill(30), ...Array(10).fill(31)]), 'RISING');
  assert.equal(calculateTrend([...Array(10).fill(31), ...Array(10).fill(30)]), 'FALLING');
});

test('antirrebote: un color nuevo debe repetirse 2 veces', () => {
  let s = { active: 'NARANJA', candidate: null, count: 0 };
  let r = debounceColor(s, 'AMARILLO');
  assert.equal(r.changed, false);
  r = debounceColor(r.state, 'NARANJA');
  assert.equal(r.changed, false);
  assert.equal(r.state.candidate, null);
  r = debounceColor(r.state, 'AMARILLO');
  r = debounceColor(r.state, 'AMARILLO');
  assert.equal(r.changed, true);
  assert.equal(r.to, 'AMARILLO');
  assert.equal(r.state.active, 'AMARILLO');
});
