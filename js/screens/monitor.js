// Pantalla Monitor: medidor, semáforo, radar, tendencia, gráfico y controles de simulación.

import { formatCl, calculateRadarStatus } from '../logic.js';
import { gaugeSvg, liveChartSvg } from '../charts.js';
import { badgeHtml, statHtml, esc, $ } from '../ui.js';
import {
  state, liveCalcs, wellsAporte, SIM_MODES, setPlaying, setSpeed, setMode, toggleWell,
  loadCase0309, shareSummaryText, setPresentation, toast, nowFormatted,
} from '../store.js';

const TREND = {
  RISING: { icon: '↑', text: 'En ascenso', cls: 'c-VERDE' },
  FALLING: { icon: '↓', text: 'En descenso', cls: 'c-ROJO' },
  STABLE: { icon: '→', text: 'Estable', cls: 'muted' },
};

export function mount(root) {
  root.innerHTML = `
    <div class="screen monitor">
      <div class="row-between">
        <span class="clock mono" data-b="clock"></span>
        <span class="chip-status" data-b="mode"></span>
      </div>

      <div class="hero-grid">
        <div class="gauge-wrap" data-b="gauge"></div>
        <div class="stack">
          <div data-b="badge"></div>
          <div class="stats3" data-b="stats"></div>
          <div class="card radar" data-b="radar"></div>
          <div class="card trend" data-b="trend"></div>
        </div>
      </div>

      <div class="actions2">
        <button type="button" class="btn btn-danger-outline" data-act="case">Caso 03-09 · radar crítico</button>
        <button type="button" class="btn btn-outline" data-act="share">Compartir resumen</button>
      </div>

      <section class="card">
        <div class="section-head">
          <h2 data-b="chart-title">Telemetría simulada</h2>
          <p class="sub">Franjas según los umbrales del semáforo vigentes</p>
        </div>
        <div data-b="chart"></div>
        <div class="legend" data-b="legend"></div>
      </section>

      <section class="card">
        <div class="section-head"><h2>Controles de simulación</h2>
          <p class="sub">Los datos del Monitor son simulados o de la tesis, no de sensores reales</p></div>
        <div class="sim-row">
          <button type="button" class="btn btn-play" data-act="play"></button>
          <div class="seg" role="group" aria-label="Velocidad">
            ${[1, 2, 5].map((s) => `<button type="button" class="seg-btn" data-speed="${s}">${s}x</button>`).join('')}
          </div>
        </div>
        <label class="field-label" for="sim-mode">Modo de simulación</label>
        <select id="sim-mode" class="select">
          ${Object.entries(SIM_MODES).map(([k, m]) => `<option value="${k}">${esc(m.label)}</option>`).join('')}
        </select>
        <p class="sub" data-b="mode-desc"></p>
        <button type="button" class="btn btn-outline wide" data-act="present">Abrir modo presentación</button>
      </section>

      <section class="card">
        <div class="section-head"><h2>Pozos crónicos (Pared Este)</h2>
          <p class="sub">Estado inicial de la tesis: 4 detenidos · 0,8 l/s cada uno al recuperarse</p></div>
        <p class="strong" data-b="wells-sum"></p>
        <div class="wells">
          ${state.wells.map((w) => `
            <label class="well" for="well-${esc(w.id)}">
              <span class="well-dot" data-dot="${esc(w.id)}" aria-hidden="true"></span>
              <span class="well-text"><strong>${esc(w.name)}</strong><span data-wsub="${esc(w.id)}"></span></span>
              <input type="checkbox" role="switch" class="switch" id="well-${esc(w.id)}" data-well="${esc(w.id)}">
            </label>`).join('')}
        </div>
      </section>
    </div>`;

  root.querySelector('[data-act="case"]').addEventListener('click', loadCase0309);
  root.querySelector('[data-act="share"]').addEventListener('click', share);
  root.querySelector('[data-act="present"]').addEventListener('click', () => setPresentation(true));
  root.querySelector('[data-act="play"]').addEventListener('click', () => setPlaying(!state.live.playing));
  root.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
  root.querySelector('#sim-mode').addEventListener('change', (e) => setMode(e.target.value));
  root.querySelectorAll('[data-well]').forEach((cb) => cb.addEventListener('change', () => toggleWell(cb.dataset.well)));

  const update = () => render(root);
  update();
  return { update };
}

async function share() {
  const text = shareSummaryText();
  try {
    if (navigator.share) { await navigator.share({ title: 'Balance DMH', text }); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Resumen copiado. Pégalo en WhatsApp o en un correo.');
  } catch {
    toast('No se pudo copiar el resumen en este navegador.');
  }
}

function render(root) {
  const c = liveCalcs();
  const p = state.params;
  const s = state.settings;
  const live = state.live;
  const radar = calculateRadarStatus(s.deformacionRadarCmDia);
  const mismatch = radar.key === 'ROJO' && c.semaforo.key !== 'ROJO';
  const aporte = wellsAporte();

  $(root, '[data-b="clock"]').textContent = nowFormatted();
  $(root, '[data-b="mode"]').textContent = live.playback.running ? `Serie real: ${live.playback.day}` : `Modo: ${SIM_MODES[live.mode].label}`;
  $(root, '[data-b="mode"]').classList.toggle('playback', live.playback.running);
  $(root, '[data-b="gauge"]').innerHTML = gaugeSvg({ porcentaje: c.porcentajeMeta, qTotal: c.qTotal, semaforo: c.semaforo, params: p });
  $(root, '[data-b="badge"]').innerHTML = badgeHtml(c.semaforo);

  const sobre = c.brechaMeta <= 0;
  $(root, '[data-b="stats"]').innerHTML =
    statHtml({ title: 'Meta operacional', value: formatCl(p.metaOperacional, 1), unit: 'l/s', sub: '100 % de bombeo' }) +
    statHtml({ title: 'Brecha', value: sobre ? `+${formatCl(-c.brechaMeta, 1)}` : `-${formatCl(c.brechaMeta, 1)}`, unit: 'l/s', sub: sobre ? 'Sobre la meta' : 'Faltante', cls: sobre ? 'c-VERDE' : 'c-ROJO' }) +
    statHtml({ title: '% del potencial', value: `${formatCl(c.porcentajePotencialMin, 0)}–${formatCl(c.porcentajePotencialMax, 0)} %`, sub: `Modelo: ${formatCl(p.potencialMin, 0)} a ${formatCl(p.potencialMax, 0)} l/s` });

  const radarCard = $(root, '[data-b="radar"]');
  radarCard.classList.toggle('alert', mismatch);
  radarCard.innerHTML = `<div class="row-between"><span class="eyebrow">Radar talud · Pared Este</span>
      <strong class="c-R-${radar.key}">${formatCl(s.deformacionRadarCmDia, 1)} cm/d · ${esc(radar.short)}</strong></div>
    ${mismatch ? '<p class="alert-text c-ROJO">Caudal total aceptable con deformación crítica: revisar la ubicación de los pozos en la Pared Este. Importa dónde se extrae, no solo cuánto.</p>' : ''}`;

  const t = TREND[state.session.trend];
  const sess = state.session;
  $(root, '[data-b="trend"]').innerHTML = sess.count
    ? `<div class="row-between wrap"><span class="${t.cls} strong"><span aria-hidden="true">${t.icon}</span> Tendencia: ${t.text}</span>
       <span class="mono muted">Mín ${formatCl(sess.min, 1)} · Prom ${formatCl(sess.sum / sess.count, 1)} · Máx ${formatCl(sess.max, 1)} l/s</span></div>`
    : '<span class="muted">Tendencia: esperando lecturas…</span>';

  $(root, '[data-b="chart-title"]').textContent = live.playback.running ? 'Serie real en reproducción' : 'Telemetría simulada';
  const chartBox = $(root, '[data-b="chart"]');
  chartBox.innerHTML = liveChartSvg({ points: live.telemetry, params: p, isPlayback: live.playback.running, width: chartBox.clientWidth });
  $(root, '[data-b="legend"]').innerHTML = [
    ['VERDE', `≥ ${formatCl(p.umbralVerde, 0)} %`, 'Meta'],
    ['AMARILLO', `${formatCl(p.umbralAmarillo, 0)} a < ${formatCl(p.umbralVerde, 0)} %`, 'Cerca'],
    ['NARANJA', `> ${formatCl(p.umbralNaranja, 0)} a < ${formatCl(p.umbralAmarillo, 0)} %`, 'Bajo'],
    ['ROJO', `${p.regla80EsNaranja ? '<' : '≤'} ${formatCl(p.umbralNaranja, 0)} %`, 'Crítico'],
  ].map(([k, r, l]) => `<span class="legend-item"><span class="sw f-bg-${k}" aria-hidden="true"></span><span><strong>${l}</strong> ${r}</span></span>`).join('');

  const play = $(root, '[data-act="play"]');
  play.textContent = live.playing ? '❚❚ Pausar' : '▶ Reanudar';
  play.setAttribute('aria-pressed', String(!live.playing));
  play.disabled = live.playback.running;
  root.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === live.speed)));
  const sel = $(root, '#sim-mode');
  if (sel.value !== live.mode) sel.value = live.mode;
  sel.disabled = live.playback.running;
  $(root, '[data-b="mode-desc"]').textContent = SIM_MODES[live.mode].description;

  const active = state.wells.filter((w) => w.isActive).length;
  const sum = $(root, '[data-b="wells-sum"]');
  sum.textContent = `Recuperados: ${active}/4 (+${formatCl(aporte, 1)} l/s)`;
  sum.className = `strong ${active ? 'c-VERDE' : 'c-amber'}`;
  for (const w of state.wells) {
    const cb = root.querySelector(`[data-well="${CSS.escape(w.id)}"]`);
    if (cb.checked !== w.isActive) cb.checked = w.isActive;
    root.querySelector(`[data-dot="${CSS.escape(w.id)}"]`).className = `well-dot f-bg-${w.isActive ? 'VERDE' : 'ROJO'}`;
    root.querySelector(`[data-wsub="${CSS.escape(w.id)}"]`).textContent = w.isActive ? `Recuperado +${formatCl(w.aporte, 1)} l/s` : 'Detenido (0,0 l/s)';
  }
}
