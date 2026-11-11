// Pantalla Ajustes: radar, umbrales del semáforo, preferencias, registro de eventos y borrado.

import { formatCl, calculateRadarStatus, validateThresholds, SEMAFORO, DEFAULT_PARAMS } from '../logic.js';
import { numberField, switchHtml, esc, $ } from '../ui.js';
import { state, liveCalcs, updateParams, updateSettings, loadCase0309, clearAllData } from '../store.js';

const PREFS = [
  ['regla80', 'Regla del umbral naranja exacto', ''],
  ['dark', 'Tema oscuro', 'Para sala de control o de noche. El claro se lee mejor proyectado y al sol.'],
  ['screen', 'Mantener la pantalla encendida', 'Útil durante una presentación. Gasta más batería.'],
  ['sound', 'Sonido de alerta', 'Pitido al cambiar de color (máximo uno cada 5 s)'],
  ['vibration', 'Vibración', 'Solo en celulares Android compatibles'],
];

export function mount(root) {
  root.innerHTML = `
    <div class="screen settings">
      <div class="section-head"><h1>Alertas y ajustes</h1>
        <p class="sub">Cruce con el radar del talud, umbrales y preferencias</p></div>

      <section class="card" data-b="radar-card">
        <div class="row-between wrap"><h2>Radar de deformación (Pared Este)</h2><span class="pill" data-b="radar-pill"></span></div>
        <label class="field-label" for="radar">Velocidad de deformación: <strong class="mono" data-b="radar-val"></strong></label>
        <input id="radar" class="range-radar" type="range" min="0" max="15" step="0.1">
        <div class="radar-scale small" aria-hidden="true"><span>0</span><span>2</span><span>6</span><span>10</span><span>15 cm/d</span></div>
        <button type="button" class="btn btn-danger-outline wide" data-act="case">Cargar caso 03-09 (radar 11,1 cm/d)</button>
        <div data-b="mismatch"></div>
      </section>

      <section class="card">
        <div class="row-between wrap"><h2>Umbrales del semáforo</h2>
          <button type="button" class="btn btn-small" data-act="reset-th">Restablecer 100 / 90 / 80</button></div>
        <p class="sub">Deben cumplir Verde &gt; Amarillo &gt; Naranja. El medidor, los gráficos y la leyenda usan estos valores.</p>
        <div class="fields" data-b="th"></div>
      </section>

      <section class="card prefs">
        <h2>Preferencias</h2>
        ${switchHtml({ id: 'p-regla80', checked: state.params.regla80EsNaranja, label: PREFS[0][1], sub: ' ' })}
        ${switchHtml({ id: 'p-dark', checked: state.settings.theme === 'dark', label: PREFS[1][1], sub: PREFS[1][2] })}
        ${switchHtml({ id: 'p-screen', checked: state.settings.keepScreenOn, label: PREFS[2][1], sub: PREFS[2][2] })}
        ${switchHtml({ id: 'p-sound', checked: state.settings.soundEnabled, label: PREFS[3][1], sub: PREFS[3][2] })}
        ${switchHtml({ id: 'p-vibration', checked: state.settings.vibrationEnabled, label: PREFS[4][1], sub: PREFS[4][2] })}
      </section>

      <section class="card">
        <h2 data-b="events-title">Registro de eventos</h2>
        <p class="sub">Cambios de color confirmados en 2 lecturas seguidas (se guardan hasta 200)</p>
        <ol class="events" data-b="events"></ol>
      </section>

      <section class="card danger-zone">
        <h2>Borrar datos</h2>
        <p class="sub">Borra las lecturas guardadas, el registro de eventos y todos los ajustes de este navegador.</p>
        <div data-b="confirm">
          <button type="button" class="btn btn-danger-outline wide" data-act="ask-clear">Borrar datos guardados…</button>
        </div>
      </section>

      <p class="footnote">Fuente: tesis Barrera de Auscultación DMH (2026); Araya y Fonseca (2013); tablero de drenaje Almar Water. Simulacro académico: no es un sistema operativo real.</p>
    </div>`;

  const radar = $(root, '#radar');
  radar.value = String(state.settings.deformacionRadarCmDia);
  // Mientras arrastras se actualiza la pantalla; se guarda solo al soltar (arreglo M11).
  radar.addEventListener('input', () => updateSettings({ deformacionRadarCmDia: Number(radar.value) }, { persist: false }));
  radar.addEventListener('change', () => updateSettings({ deformacionRadarCmDia: Number(radar.value) }));
  $(root, '[data-act="case"]').addEventListener('click', loadCase0309);

  const th = {};
  const thCfg = [
    ['umbralVerde', 'Umbral Verde (meta cumplida)', 70, 150],
    ['umbralAmarillo', 'Umbral Amarillo (cerca de la meta)', 50, 120],
    ['umbralNaranja', 'Umbral Naranja (bajo la meta)', 30, 100],
  ];
  for (const [key, label, min, max] of thCfg) {
    th[key] = numberField({
      label, unit: '%', value: state.params[key], min, max, step: 1,
      validate: (v) => {
        const p = { ...state.params, [key]: v };
        return validateThresholds(p.umbralVerde, p.umbralAmarillo, p.umbralNaranja);
      },
      onChange: (v) => updateParams({ [key]: v }),
    });
    $(root, '[data-b="th"]').append(th[key].el);
  }
  $(root, '[data-act="reset-th"]').addEventListener('click', () => updateParams({
    umbralVerde: DEFAULT_PARAMS.umbralVerde, umbralAmarillo: DEFAULT_PARAMS.umbralAmarillo, umbralNaranja: DEFAULT_PARAMS.umbralNaranja,
  }));

  $(root, '#p-regla80').addEventListener('change', (e) => updateParams({ regla80EsNaranja: e.target.checked }));
  $(root, '#p-dark').addEventListener('change', (e) => updateSettings({ theme: e.target.checked ? 'dark' : 'light' }));
  $(root, '#p-screen').addEventListener('change', (e) => updateSettings({ keepScreenOn: e.target.checked }));
  $(root, '#p-sound').addEventListener('change', (e) => updateSettings({ soundEnabled: e.target.checked }));
  $(root, '#p-vibration').addEventListener('change', (e) => updateSettings({ vibrationEnabled: e.target.checked }));

  const confirmBox = $(root, '[data-b="confirm"]');
  const askHtml = confirmBox.innerHTML;
  confirmBox.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'ask-clear') {
      confirmBox.innerHTML = `<p class="strong c-ROJO">¿Seguro? Esto no se puede deshacer.</p>
        <div class="actions2"><button type="button" class="btn btn-danger" data-act="do-clear">Sí, borrar todo</button>
        <button type="button" class="btn btn-outline" data-act="cancel-clear">Cancelar</button></div>`;
      confirmBox.querySelector('[data-act="cancel-clear"]').focus();
    } else if (act === 'cancel-clear') {
      confirmBox.innerHTML = askHtml;
    } else if (act === 'do-clear') {
      confirmBox.innerHTML = askHtml;
      clearAllData();
    }
  });

  const update = (topics) => {
    if (topics && topics.size === 1 && topics.has('tick')) { renderMismatch(root); return; }
    for (const [key] of thCfg) th[key].set(state.params[key]);
    const set = (id, v) => { const el = $(root, id); if (el.checked !== v) el.checked = v; };
    set('#p-regla80', state.params.regla80EsNaranja);
    set('#p-dark', state.settings.theme === 'dark');
    set('#p-screen', state.settings.keepScreenOn);
    set('#p-sound', state.settings.soundEnabled);
    set('#p-vibration', state.settings.vibrationEnabled);
    $(root, '[data-sub-for="p-regla80"]').textContent = state.params.regla80EsNaranja
      ? `${formatCl(state.params.umbralNaranja, 1)} % exacto cuenta como NARANJA (criterio de la tesis)`
      : `${formatCl(state.params.umbralNaranja, 1)} % exacto cuenta como ROJO (por defecto)`;
    if (document.activeElement !== radar) radar.value = String(state.settings.deformacionRadarCmDia);
    renderMismatch(root);
    renderEvents(root);
  };
  update();
  return { update };
}

function renderMismatch(root) {
  const r = calculateRadarStatus(state.settings.deformacionRadarCmDia);
  const c = liveCalcs();
  const mismatch = r.key === 'ROJO' && c.semaforo.key !== 'ROJO';
  $(root, '[data-b="radar-val"]').textContent = `${formatCl(state.settings.deformacionRadarCmDia, 1)} cm/día`;
  const pill = $(root, '[data-b="radar-pill"]');
  pill.textContent = r.label;
  pill.className = `pill c-R-${r.key} bd-R-${r.key}`;
  $(root, '[data-b="radar-card"]').classList.toggle('alert', mismatch);
  $(root, '[data-b="mismatch"]').innerHTML = mismatch
    ? `<div class="note danger" role="status"><strong>Advertencia geotécnica crítica</strong>
        <p>Caudal total aceptable (${esc(c.semaforo.name)}) con deformación crítica: revisar la ubicación de los pozos en la Pared Este. Importa dónde se extrae, no solo cuánto.</p></div>`
    : '';
}

function renderEvents(root) {
  const ev = state.events;
  $(root, '[data-b="events-title"]').textContent = `Registro de eventos (${ev.length})`;
  $(root, '[data-b="events"]').innerHTML = ev.length
    ? ev.slice(0, 20).map((e) => `<li><span class="sw f-bg-${esc(SEMAFORO[e.color] ? e.color : 'NARANJA')}" aria-hidden="true"></span>
        <div><span class="mono muted small">${esc(e.ts)}</span><p>${esc(e.description)}</p></div></li>`).join('')
    : '<li class="empty">No hay eventos registrados.</li>';
}
