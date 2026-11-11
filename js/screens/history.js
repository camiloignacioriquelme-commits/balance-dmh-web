// Pantalla Historial: serie real de 69 días de la tesis, estadísticas, filtro y tabla.

import { formatCl, calculateSemaforo, calculateDatasetStats, SEMAFORO } from '../logic.js';
import { DATASET, ALERT_DAY, SERIES_YEAR } from '../data.js';
import { historyChartSvg } from '../charts.js';
import { statHtml, $ } from '../ui.js';
import { state, togglePlayback } from '../store.js';

let filter = null;

export function mount(root) {
  root.innerHTML = `
    <div class="screen history">
      <div class="section-head"><h1>Historial real de bombeo</h1>
        <p class="sub">Serie de la tesis DMH: 69 días con dato entre el 10-ago y el 27-oct de ${SERIES_YEAR}</p></div>
      <button type="button" class="btn btn-primary wide" data-act="play"></button>
      <section class="card">
        <div data-b="chart"></div>
        <p class="small muted">Cada punto es un día; los huecos son días sin dato (69 de 79). La línea roja marca el ${ALERT_DAY}: Alerta Roja banco 2130, Pared Este (radar 11,1 cm/d).</p>
      </section>
      <section class="card">
        <div class="section-head"><h2>Estadísticas de la serie</h2></div>
        <div class="stats3" data-b="stats"></div>
        <div class="stats2" data-b="minmax"></div>
        <p class="eyebrow">Días por color del semáforo</p>
        <div class="filters" role="group" aria-label="Filtrar por color" data-b="filters"></div>
      </section>
      <section class="card table-card">
        <div class="table-scroll">
          <table class="data">
            <thead><tr><th scope="col">Día ${SERIES_YEAR}</th><th scope="col" class="num">Outpit</th><th scope="col" class="num">T. extr.</th><th scope="col" class="num">Total</th><th scope="col">Semáforo</th></tr></thead>
            <tbody data-b="rows"></tbody>
          </table>
        </div>
      </section>
    </div>`;
  $(root, '[data-act="play"]').addEventListener('click', togglePlayback);
  $(root, '[data-b="filters"]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    const k = b.dataset.filter || null;
    filter = filter === k ? null : k;
    render(root, true);
  });
  const update = (topics) => {
    if (topics && !topics.has('params') && !topics.has('playback') && !topics.has('sim')) return;
    render(root, !topics || topics.has('params'));
  };
  update();
  return { update };
}

function classified() {
  const p = state.params;
  return DATASET.map((d) => {
    const porcentaje = p.metaOperacional > 0 ? (d.total / p.metaOperacional) * 100 : 0;
    return { ...d, porcentaje, semaforo: calculateSemaforo(porcentaje, p) };
  });
}

function render(root, full) {
  const pb = state.live.playback;
  const btn = $(root, '[data-act="play"]');
  btn.textContent = pb.running ? `■ Detener reproducción (${pb.day})` : '▶ Reproducir la serie completa en el Monitor';
  btn.classList.toggle('btn-danger', pb.running);

  const list = classified();
  if (full) {
    const stats = calculateDatasetStats(list.map((d) => ({ label: d.diaMes, value: d.total })), state.params);
    const chartBox = $(root, '[data-b="chart"]');
    chartBox.innerHTML = historyChartSvg({ readings: list, params: state.params, width: chartBox.clientWidth });
    $(root, '[data-b="stats"]').innerHTML =
      statHtml({ title: 'Promedio', value: formatCl(stats.mean, 1), unit: 'l/s' }) +
      statHtml({ title: 'Desv. estándar', value: `±${formatCl(stats.stdDev, 2)}`, unit: 'l/s' }) +
      statHtml({ title: 'Coef. de variación', value: formatCl(stats.cvPercent, 1), unit: '%' });
    $(root, '[data-b="minmax"]').innerHTML =
      statHtml({ title: 'Mínimo', value: formatCl(stats.minVal, 2), unit: 'l/s', sub: `Día ${stats.minDate}`, cls: 'c-ROJO' }) +
      statHtml({ title: 'Máximo', value: formatCl(stats.maxVal, 2), unit: 'l/s', sub: `Día ${stats.maxDate}` });
    const counts = { VERDE: stats.countVerde, AMARILLO: stats.countAmarillo, NARANJA: stats.countNaranja, ROJO: stats.countRojo };
    $(root, '[data-b="filters"]').innerHTML =
      `<button type="button" class="chip" data-filter="" aria-pressed="${filter === null}">Todos (${list.length})</button>` +
      Object.values(SEMAFORO).map((s) => `<button type="button" class="chip chip-${s.key}" data-filter="${s.key}" aria-pressed="${filter === s.key}"><span class="sw f-bg-${s.key}" aria-hidden="true"></span>${s.name} (${counts[s.key]})</button>`).join('');
  }

  const rows = filter ? list.filter((d) => d.semaforo.key === filter) : list;
  $(root, '[data-b="rows"]').innerHTML = rows.length ? rows.map((d) => {
    const playing = pb.running && pb.day === `${d.diaMes}-${SERIES_YEAR}`;
    const alert = d.diaMes === ALERT_DAY;
    return `<tr class="${playing ? 'playing' : ''}${alert ? ' alert-row' : ''}">
      <td class="mono">${d.diaMes}${alert ? '<span class="small c-ROJO strong block">Alerta Roja banco 2130</span>' : ''}</td>
      <td class="num mono">${formatCl(d.outpit, 2)}</td>
      <td class="num mono">${formatCl(d.tExtraido, 2)}</td>
      <td class="num mono strong">${formatCl(d.total, 2)}</td>
      <td><span class="sw f-bg-${d.semaforo.key}" aria-hidden="true"></span><span class="c-${d.semaforo.key} strong">${d.semaforo.name}</span> <span class="mono muted">${formatCl(d.porcentaje, 1)} %</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">No hay días con ese color.</td></tr>';

  if (pb.running) root.querySelector('tr.playing')?.scrollIntoView({ block: 'nearest' });
}
