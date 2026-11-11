// Pantalla Calculadora: insumos, parámetros del modelo, sensibilidad y lecturas guardadas.

import { formatCl, calculateSensitivity, SEMAFORO } from '../logic.js';
import { PRESETS } from '../data.js';
import { numberField, badgeHtml, switchHtml, esc, $ } from '../ui.js';
import {
  state, calcCalcs, updateCalc, updateParams, updateSens, updateSettings, applyPreset, resetCalcToThesis,
  sendCalcToMonitor, saveCurrentReading, deleteReading, exportCsv, toast,
} from '../store.js';

export function mount(root) {
  root.innerHTML = `
    <div class="screen calculator">
      <div class="section-head"><h1>Calculadora de balance</h1>
        <p class="sub">El resultado se recalcula al instante mientras cambias los valores</p></div>

      <div class="presets" role="group" aria-label="Atajos con casos de la tesis">
        ${PRESETS.map((p, i) => `<button type="button" class="chip" data-preset="${i}">${esc(p.label)}</button>`).join('')}
      </div>

      <div class="calc-grid">
        <section class="card result" data-b="result"></section>

        <section class="card">
          <div class="section-head"><h2>Insumos de la barrera</h2></div>
          <div class="fields" data-b="inputs"></div>
          ${switchHtml({ id: 'incl-planta', checked: state.settings.incluirPlantaEnTotal, label: 'Sumar pozos planta al total', sub: ' ' })}
          <div class="fields" data-b="planta"></div>
        </section>
      </div>

      <div class="actions2">
        <button type="button" class="btn btn-primary" data-act="send">Enviar al Monitor</button>
        <button type="button" class="btn btn-outline" data-act="save">Guardar lectura</button>
      </div>
      <button type="button" class="btn btn-ghost wide" data-act="reset">Restablecer valores de la tesis (25,13 + 6,03)</button>

      <section class="card">
        <div class="section-head"><h2>Análisis de sensibilidad</h2>
          <p class="sub">¿Qué pasaría si recupero pozos detenidos? Es solo una proyección: no cambia el Monitor.</p></div>
        <div class="fields two" data-b="sens"></div>
        <div class="projection" data-b="proj"></div>
      </section>

      <details class="card">
        <summary><h2>Parámetros del modelo hidrogeológico</h2><span class="sub">Meta, potencial y recargas. Afectan a toda la app.</span></summary>
        <div class="fields" data-b="params"></div>
      </details>

      <section class="card">
        <div class="row-between wrap">
          <h2 data-b="readings-title">Lecturas guardadas</h2>
          <button type="button" class="btn btn-small" data-act="csv">Descargar CSV (Excel)</button>
        </div>
        <div class="readings" data-b="readings"></div>
      </section>
    </div>`;

  const fields = {};
  const add = (container, key, cfg) => { fields[key] = numberField(cfg); $(root, container).append(fields[key].el); };
  const c = state.calc;
  add('[data-b="inputs"]', 'outpit', { label: 'Outpit (barrera de pozos)', unit: 'l/s', value: c.outpit, min: 0, max: 60, step: 0.1, onChange: (v) => updateCalc({ outpit: v }) });
  add('[data-b="inputs"]', 'tExtraido', { label: 'T. extraído (bombeo rajo)', unit: 'l/s', value: c.tExtraido, min: 0, max: 30, step: 0.1, onChange: (v) => updateCalc({ tExtraido: v }) });
  add('[data-b="planta"]', 'pozosPlanta', { label: 'Caudal pozos planta', unit: 'l/s', value: c.pozosPlanta, min: 0, max: 20, step: 0.1, onChange: (v) => updateCalc({ pozosPlanta: v }) });

  const s = state.sens;
  add('[data-b="sens"]', 'nPozos', { label: 'N° de pozos a recuperar', unit: '', value: s.nPozos, min: 0, max: 10, step: 1, onChange: (v) => updateSens({ nPozos: Math.round(v) }) });
  add('[data-b="sens"]', 'rendimiento', { label: 'Rendimiento por pozo', unit: 'l/s', value: s.rendimientoPorPozo, min: 0.6, max: 1, step: 0.05, onChange: (v) => updateSens({ rendimientoPorPozo: v }) });

  const p = state.params;
  const minMax = (other, isMin) => (v) => (isMin ? (v > state.params[other] ? `Debe ser menor o igual al máximo (${formatCl(state.params[other], 0)})` : null)
    : (v < state.params[other] ? `Debe ser mayor o igual al mínimo (${formatCl(state.params[other], 0)})` : null));
  add('[data-b="params"]', 'meta', { label: 'Meta operacional', unit: 'l/s', value: p.metaOperacional, min: 10, max: 60, step: 0.5, onChange: (v) => updateParams({ metaOperacional: v }) });
  add('[data-b="params"]', 'potMin', { label: 'Potencial mínimo', unit: 'l/s', value: p.potencialMin, min: 40, max: 80, step: 1, validate: minMax('potencialMax', true), onChange: (v) => updateParams({ potencialMin: v }) });
  add('[data-b="params"]', 'potMax', { label: 'Potencial máximo', unit: 'l/s', value: p.potencialMax, min: 40, max: 80, step: 1, validate: minMax('potencialMin', false), onChange: (v) => updateParams({ potencialMax: v }) });
  add('[data-b="params"]', 'recN', { label: 'Recarga Norte', unit: 'l/s', value: p.recargaNorte, min: 30, max: 80, step: 1, onChange: (v) => updateParams({ recargaNorte: v }) });
  add('[data-b="params"]', 'recEMin', { label: 'Recarga Este mínima', unit: 'l/s', value: p.recargaEsteMin, min: 10, max: 70, step: 1, validate: minMax('recargaEsteMax', true), onChange: (v) => updateParams({ recargaEsteMin: v }) });
  add('[data-b="params"]', 'recEMax', { label: 'Recarga Este máxima', unit: 'l/s', value: p.recargaEsteMax, min: 10, max: 70, step: 1, validate: minMax('recargaEsteMin', false), onChange: (v) => updateParams({ recargaEsteMax: v }) });

  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(PRESETS[Number(b.dataset.preset)])));
  $(root, '#incl-planta').addEventListener('change', (e) => updateSettings({ incluirPlantaEnTotal: e.target.checked }));
  $(root, '[data-act="send"]').addEventListener('click', sendCalcToMonitor);
  $(root, '[data-act="save"]').addEventListener('click', saveCurrentReading);
  $(root, '[data-act="reset"]').addEventListener('click', resetCalcToThesis);
  $(root, '[data-act="csv"]').addEventListener('click', downloadCsv);
  $(root, '[data-b="readings"]').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del]');
    if (btn) deleteReading(btn.dataset.del);
  });

  const update = (topics) => {
    if (!topics || topics.has('calc') || topics.has('params') || topics.has('sens') || topics.has('settings')) {
      fields.outpit.set(state.calc.outpit);
      fields.tExtraido.set(state.calc.tExtraido);
      fields.pozosPlanta.set(state.calc.pozosPlanta);
      fields.nPozos.set(state.sens.nPozos);
      fields.rendimiento.set(state.sens.rendimientoPorPozo);
      fields.meta.set(state.params.metaOperacional);
      fields.potMin.set(state.params.potencialMin);
      fields.potMax.set(state.params.potencialMax);
      fields.recN.set(state.params.recargaNorte);
      fields.recEMin.set(state.params.recargaEsteMin);
      fields.recEMax.set(state.params.recargaEsteMax);
      root.querySelectorAll('[data-preset]').forEach((b) => {
        const pr = PRESETS[Number(b.dataset.preset)];
        b.setAttribute('aria-pressed', String(pr.outpit === state.calc.outpit && pr.tExtraido === state.calc.tExtraido));
      });
      renderResult(root);
    }
    if (!topics || topics.has('readings')) renderReadings(root);
  };
  update();
  return { update };
}

function downloadCsv() {
  if (!state.readings.length) { toast('Aún no hay lecturas guardadas para descargar.'); return; }
  const blob = new Blob([exportCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'DMH_Lecturas_Balance_Hidrico.csv' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`CSV descargado con ${state.readings.length} lectura${state.readings.length === 1 ? '' : 's'}`);
}

function metric(label, value) {
  return `<div class="metric"><span>${esc(label)}</span><strong class="mono">${value}</strong></div>`;
}

function renderResult(root) {
  const c = calcCalcs();
  const incl = state.settings.incluirPlantaEnTotal;
  const sw = $(root, '#incl-planta');
  if (sw.checked !== incl) sw.checked = incl;
  $(root, '[data-sub-for="incl-planta"]').textContent = incl ? 'Se suma al caudal total' : 'No se suma al caudal total';

  const sobre = c.brechaMeta <= 0;
  $(root, '[data-b="result"]').className = `card result edge-${c.semaforo.key}`;
  $(root, '[data-b="result"]').innerHTML = `
    <div class="result-top">
      <div><span class="eyebrow">Caudal total (Q)</span><span class="big mono c-${c.semaforo.key}">${formatCl(c.qTotal, 1)} <small>l/s</small></span></div>
      <div class="right"><span class="eyebrow">% de la meta</span><span class="big mono c-${c.semaforo.key}">${formatCl(c.porcentajeMeta, 1)} <small>%</small></span></div>
    </div>
    ${badgeHtml(c.semaforo)}
    <div class="metrics">
      ${metric('Brecha a la meta', sobre ? `Sobre la meta (+${formatCl(-c.brechaMeta, 1)} l/s)` : `Faltan ${formatCl(c.brechaMeta, 1)} l/s`)}
      ${metric('% del potencial', `${formatCl(c.porcentajePotencialMin, 1)} – ${formatCl(c.porcentajePotencialMax, 1)} %`)}
      ${metric('Captura de entradas', `${formatCl(c.capturaMin, 1)} – ${formatCl(c.capturaMax, 1)} %`)}
      ${metric('Agua sin extraer', `${formatCl(c.aguaSinExtraerMin, 1)} – ${formatCl(c.aguaSinExtraerMax, 1)} l/s`)}
      ${metric('Equivalente diario', `${formatCl(c.m3PorDia, 0)} m³/día`)}
      ${metric('Equivalente anual', `${formatCl(c.hm3PorAnio, 2)} hm³/año`)}
    </div>`;

  const sens = state.sens;
  const r = calculateSensitivity(c.qTotal, state.params, sens);
  $(root, '[data-b="proj"]').innerHTML = `
    <div><span class="eyebrow">Ahora</span><strong class="mono c-${c.semaforo.key}">${formatCl(c.qTotal, 1)} l/s · ${formatCl(c.porcentajeMeta, 1)} %</strong><span class="c-${c.semaforo.key}">${c.semaforo.name}</span></div>
    <span class="arrow" aria-hidden="true">→</span>
    <div class="right"><span class="eyebrow">Con +${formatCl(sens.nPozos * sens.rendimientoPorPozo, 2)} l/s</span><strong class="mono c-${r.semaforo.key}">${formatCl(r.qProyectado, 1)} l/s · ${formatCl(r.porcentajeProyectado, 1)} %</strong><span class="c-${r.semaforo.key}">${r.semaforo.name}</span></div>`;
}

function renderReadings(root) {
  const list = state.readings;
  $(root, '[data-b="readings-title"]').textContent = `Lecturas guardadas (${list.length})`;
  $(root, '[data-act="csv"]').disabled = !list.length;
  $(root, '[data-b="readings"]').innerHTML = list.length
    ? list.map((r) => {
      const sem = SEMAFORO[r.semaforo] ?? SEMAFORO.NARANJA;
      return `<div class="reading">
        <div><span class="mono muted small">${esc(r.ts)}</span>
          <strong class="mono">${formatCl(r.total, 1)} l/s <span class="muted">(Outpit ${formatCl(r.outpit, 2)} + T ${formatCl(r.tExtraido, 2)}${r.planta ? ` + planta ${formatCl(r.planta, 2)}` : ''})</span></strong>
          <span class="c-${sem.key} small strong">${esc(sem.title)}${r.meta ? ` · meta ${formatCl(r.meta, 1)} l/s` : ''}</span></div>
        <button type="button" class="icon-btn" data-del="${esc(r.id)}" aria-label="Borrar lectura del ${esc(r.ts)}">✕</button>
      </div>`;
    }).join('')
    : '<p class="empty">No hay lecturas guardadas. Usa «Guardar lectura» para archivar el resultado con fecha y hora.</p>';
}
