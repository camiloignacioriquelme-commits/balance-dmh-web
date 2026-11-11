// Gráficos dibujados en SVG. Todas las franjas y marcas usan los umbrales vigentes
// (no valores fijos 80/90/100), para que el dibujo siempre coincida con el semáforo (arreglo N3).

import { formatCl } from './logic.js';
import { TOTAL_CALENDAR_DAYS, ALERT_DAY } from './data.js';

const GAUGE_MAX = 120; // el medidor llega hasta 120 % de la meta

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function arc(cx, cy, r, a0, a1) {
  if (a1 - a0 <= 0.01) return '';
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Medidor circular: arco de 240° que va de 0 % a 120 % de la meta. */
export function gaugeSvg({ porcentaje, qTotal, semaforo, params }) {
  const cx = 120, cy = 124, r = 92, start = 150, sweep = 240;
  const angle = (p) => start + (Math.min(Math.max(p, 0), GAUGE_MAX) / GAUGE_MAX) * sweep;
  const uN = params.umbralNaranja, uA = params.umbralAmarillo, uV = params.umbralVerde;
  const bands = [
    ['ROJO', 0, uN], ['NARANJA', uN, uA], ['AMARILLO', uA, uV], ['VERDE', uV, GAUGE_MAX],
  ].map(([k, a, b]) => `<path class="g-band s-${k}" d="${arc(cx, cy, r, angle(a), angle(b))}"/>`).join('');
  const ticks = [uN, uA, uV].filter((t) => t <= GAUGE_MAX).map((t) => {
    const a = angle(t);
    const [x0, y0] = polar(cx, cy, r - 12, a);
    const [x1, y1] = polar(cx, cy, r + 12, a);
    const [tx, ty] = polar(cx, cy, r + 24, a);
    return `<line class="g-tick" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>
      <text class="g-tick-label" x="${tx}" y="${ty + 4}" text-anchor="middle">${formatCl(t, 0)} %</text>`;
  }).join('');
  const value = porcentaje > 0.05 ? `<path class="g-value s-${semaforo.key}" d="${arc(cx, cy, r, start, angle(porcentaje))}"/>` : '';
  return `<svg class="gauge" viewBox="-24 0 288 196" role="img" aria-label="${formatCl(porcentaje, 1)} % de la meta, ${formatCl(qTotal, 1)} litros por segundo, estado ${semaforo.name}">
    ${bands}${value}${ticks}
    <text class="g-pct c-${semaforo.key}" x="${cx}" y="${cy + 2}" text-anchor="middle">${formatCl(porcentaje, 1)} %</text>
    <text class="g-q" x="${cx}" y="${cy + 30}" text-anchor="middle">${formatCl(qTotal, 1)} l/s</text>
    <text class="g-cap" x="${cx}" y="${cy + 50}" text-anchor="middle">Caudal total extraído</text>
  </svg>`;
}

/** Elige marcas "redondas" para un eje (cada 1, 2, 5 o 10 l/s). */
function niceTicks(lo, hi, target = 5) {
  const raw = (hi - lo) / target;
  const step = [1, 2, 5, 10, 20].find((s) => s >= raw) ?? 20;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

function bandRects(params, yFor, x0, x1, top, bottom) {
  const m = params.metaOperacional;
  const lim = { V: (m * params.umbralVerde) / 100, A: (m * params.umbralAmarillo) / 100, N: (m * params.umbralNaranja) / 100 };
  const clampY = (y) => Math.min(Math.max(y, top), bottom);
  const rows = [
    ['VERDE', top, clampY(yFor(lim.V))],
    ['AMARILLO', clampY(yFor(lim.V)), clampY(yFor(lim.A))],
    ['NARANJA', clampY(yFor(lim.A)), clampY(yFor(lim.N))],
    ['ROJO', clampY(yFor(lim.N)), bottom],
  ];
  return { lim, svg: rows.map(([k, a, b]) => (b - a > 0.1 ? `<rect class="band f-${k}" x="${x0}" y="${a}" width="${x1 - x0}" height="${b - a}"/>` : '')).join('') };
}

/** Gráfico de las últimas lecturas del Monitor, con franjas del semáforo y línea de meta. */
/** Tamaño del dibujo según el ancho real disponible, para que el texto se lea igual en celular y computador. */
function frame(width, ratio) {
  const W = Math.round(Math.min(Math.max(width || 640, 300), 1000));
  return { W, H: Math.round(Math.min(Math.max(W * ratio, 210), 300)) };
}

export function liveChartSvg({ points, params, isPlayback, width }) {
  const { W, H } = frame(width, 0.42);
  const L = 40, R = 10, T = 14, B = 28;
  if (!points.length) {
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sin lecturas todavía"><text class="axis-label" x="${W / 2}" y="${H / 2}" text-anchor="middle">Esperando lecturas…</text></svg>`;
  }
  const m = params.metaOperacional;
  const lowRef = (m * params.umbralNaranja) / 100;
  const highRef = (m * Math.max(params.umbralVerde, 100)) / 100;
  const lo = Math.floor(Math.min(...points, lowRef) - 1);
  const hi = Math.ceil(Math.max(...points, highRef) + 1);
  const yFor = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  // Los puntos se alinean a la derecha: la lectura más reciente siempre queda en el borde.
  const offset = 60 - points.length;
  const px = (i) => L + ((i + offset) / 59) * (W - L - R);

  const { lim, svg: bands } = bandRects(params, yFor, L, W - R, T, H - B);
  const grid = niceTicks(lo, hi).map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${yFor(v)}" y2="${yFor(v)}"/>
    <text class="axis-label" x="${L - 6}" y="${yFor(v) + 4}" text-anchor="end">${formatCl(v, 0)}</text>`).join('');
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
  const area = `${line} L${px(points.length - 1).toFixed(1)} ${H - B} L${px(0).toFixed(1)} ${H - B} Z`;
  const last = points[points.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de las últimas ${points.length} lecturas; la última es ${formatCl(last, 1)} litros por segundo">
    ${bands}${grid}
    <line class="meta-line" x1="${L}" x2="${W - R}" y1="${yFor(lim.V)}" y2="${yFor(lim.V)}"/>
    <text class="meta-label" x="${W - R - 4}" y="${yFor(lim.V) - 6}" text-anchor="end">Meta ${formatCl(lim.V, 1)} l/s</text>
    <path class="area" d="${area}"/>
    <path class="line" d="${line}"/>
    <circle class="last" cx="${px(points.length - 1)}" cy="${yFor(last)}" r="5"/>
    <text class="axis-label" x="${L}" y="${H - 8}">${isPlayback ? 'Días de la serie' : 'Lecturas'}: ${points.length} de 60</text>
    <text class="axis-label" x="${W - R}" y="${H - 8}" text-anchor="end">l/s</text>
  </svg>`;
}

/** Serie de 69 días ubicada en su fecha real: los días sin dato quedan como huecos. */
export function historyChartSvg({ readings, params, width }) {
  const { W, H } = frame(width, 0.45);
  const L = 40, R = 10, T = 14, B = 34;
  const totals = readings.map((r) => r.total);
  const m = params.metaOperacional;
  const lo = Math.floor(Math.min(...totals, (m * params.umbralNaranja) / 100) - 1);
  const hi = Math.ceil(Math.max(...totals, (m * Math.max(params.umbralVerde, 100)) / 100) + 1); // eje según datos y meta (arreglo M10)
  const yFor = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const xFor = (d) => L + 6 + (d / (TOTAL_CALENDAR_DAYS - 1)) * (W - L - R - 12);
  const { lim, svg: bands } = bandRects(params, yFor, L, W - R, T, H - B);
  const grid = niceTicks(lo, hi).map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${yFor(v)}" y2="${yFor(v)}"/>
    <text class="axis-label" x="${L - 6}" y="${yFor(v) + 4}" text-anchor="end">${formatCl(v, 0)}</text>`).join('');
  const months = [[0, '10 ago'], [22, '1 sep'], [52, '1 oct'], [78, '27 oct']].map(([d, t], i, arr) =>
    `<text class="axis-label" x="${xFor(d)}" y="${H - 12}" text-anchor="${i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle'}">${t}</text>`).join('');
  const alert = readings.find((r) => r.diaMes === ALERT_DAY);
  const alertMark = alert ? `<line class="alert-line" x1="${xFor(alert.dayIndex)}" x2="${xFor(alert.dayIndex)}" y1="${T}" y2="${H - B}"/>
    <circle class="alert-ring" cx="${xFor(alert.dayIndex)}" cy="${yFor(alert.total)}" r="9"/>` : '';
  const dots = readings.map((r) => `<circle class="dot f-${r.semaforo.key}" cx="${xFor(r.dayIndex).toFixed(1)}" cy="${yFor(r.total).toFixed(1)}" r="4"><title>${r.diaMes}: ${formatCl(r.total, 2)} l/s (${r.semaforo.name})</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Serie de 69 días entre el 10 de agosto y el 27 de octubre">
    ${bands}${grid}
    <line class="meta-line" x1="${L}" x2="${W - R}" y1="${yFor(lim.V)}" y2="${yFor(lim.V)}"/>
    <text class="meta-label" x="${W - R - 4}" y="${yFor(lim.V) - 6}" text-anchor="end">Meta ${formatCl(lim.V, 1)} l/s</text>
    ${alertMark}${dots}${months}
  </svg>`;
}
