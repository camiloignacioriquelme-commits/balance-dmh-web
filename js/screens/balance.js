// Pantalla Balance: diagrama de flujo, comparación de magnitudes y ecuación de conservación de masa.

import { formatCl, formatSignedCl } from '../logic.js';
import { statHtml, $ } from '../ui.js';
import { state, liveCalcs, calcCalcs } from '../store.js';

let useLive = true;

export function mount(root) {
  root.innerHTML = `
    <div class="screen balance">
      <div class="section-head"><h1>Balance hídrico global</h1>
        <p class="sub">Cuánta del agua que entra al dominio intercepta la barrera DMH</p></div>
      <div class="seg" role="group" aria-label="Fuente de datos">
        <button type="button" class="seg-btn" data-src="live">Monitor en vivo</button>
        <button type="button" class="seg-btn" data-src="calc">Calculadora (fija)</button>
      </div>
      <div data-b="body"></div>
    </div>`;
  root.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => { useLive = b.dataset.src === 'live'; update(); }));
  const update = (topics) => {
    if (topics && useLive === false && topics.size === 1 && topics.has('tick')) return; // con la Calculadora no hace falta redibujar cada segundo
    render(root);
  };
  update();
  return { update };
}

function bar(label, valueText, from, to, scale, meta, cls) {
  const pct = (v) => Math.min(Math.max((v / scale) * 100, 0), 100);
  const left = pct(from);
  const width = Math.max(pct(to) - left, 1.5);
  return `<div class="rbar">
    <div class="row-between"><span>${label}</span><strong class="mono ${cls}">${valueText}</strong></div>
    <div class="rbar-track"><span class="rbar-fill ${cls}-bg" style="left:${left}%;width:${width}%"></span>
      <span class="rbar-meta" style="left:${pct(meta)}%" aria-hidden="true"></span></div>
  </div>`;
}

function render(root) {
  root.querySelectorAll('[data-src]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.src === 'live') === useLive)));
  const c = useLive ? liveCalcs() : calcCalcs();
  const inputs = useLive ? state.live.inputs : state.calc;
  const p = state.params;
  const scale = Math.max(c.entradasMax, 100);
  const extra = useLive && c.aportePozosRecuperados > 0 ? ` + pozos ${formatCl(c.aportePozosRecuperados, 1)}` : '';

  $(root, '[data-b="body"]').innerHTML = `
    <section class="card">
      <div class="section-head"><h2>Flujo en la barrera</h2></div>
      <div class="flow">
        <div class="flow-box in"><span class="eyebrow">Entradas</span><strong class="mono">${formatCl(c.entradasMin, 0)}–${formatCl(c.entradasMax, 0)} l/s</strong>
          <span class="small muted">Norte ${formatCl(p.recargaNorte, 0)} + Este ${formatCl(p.recargaEsteMin, 0)}–${formatCl(p.recargaEsteMax, 0)}</span></div>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <div class="flow-box barrier edge-${c.semaforo.key}"><span class="eyebrow c-${c.semaforo.key}">Barrera DMH</span>
          <strong class="mono c-${c.semaforo.key}">Capta ${formatCl(c.capturaMin, 1)}–${formatCl(c.capturaMax, 1)} %</strong>
          <span class="small muted">de lo que entra</span></div>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <div class="flow-box out"><span class="eyebrow">Extraído</span><strong class="mono">${formatCl(c.qTotal, 1)} l/s</strong>
          <span class="small muted">Outpit ${formatCl(inputs.outpit, 1)} + T ${formatCl(inputs.tExtraido, 1)}${extra}</span></div>
      </div>
      <div class="note warn">
        <strong>Agua sin extraer: ${formatCl(c.aguaSinExtraerMin, 1)} a ${formatCl(c.aguaSinExtraerMax, 1)} l/s</strong>
        <p>Esa fracción puede salir por flujo regional, aflorar, evaporarse o quedar almacenada en el macizo; el balance no separa estas vías.</p>
      </div>
    </section>

    <section class="card">
      <div class="section-head"><h2>Comparación de magnitudes (l/s)</h2>
        <p class="sub">La línea vertical marca la meta operacional (${formatCl(p.metaOperacional, 1)} l/s)</p></div>
      ${bar('Caudal extraído (Q)', `${formatCl(c.qTotal, 1)} l/s`, 0, c.qTotal, scale, p.metaOperacional, `c-${c.semaforo.key}`)}
      ${bar('Potencial del modelo', `${formatCl(p.potencialMin, 0)} a ${formatCl(p.potencialMax, 0)} l/s`, p.potencialMin, p.potencialMax, scale, p.metaOperacional, 'c-accent')}
      ${bar('Entradas estimadas', `${formatCl(c.entradasMin, 0)} a ${formatCl(c.entradasMax, 0)} l/s`, c.entradasMin, c.entradasMax, scale, p.metaOperacional, 'c-amber')}
    </section>

    <section class="card">
      <div class="section-head"><h2>Conservación de masa</h2></div>
      <p class="equation">Entradas − Salidas = Δ Almacenamiento</p>
      <p class="mono strong c-accent">[${formatCl(c.entradasMin, 0)} a ${formatCl(c.entradasMax, 0)}] − ${formatCl(c.qTotal, 1)} = ${formatSignedCl(c.variacionAlmacenamientoMin, 1)} a ${formatSignedCl(c.variacionAlmacenamientoMax, 1)} l/s</p>
      <p>La barrera capta entre <strong>${formatCl(c.capturaMin, 1)} %</strong> y <strong>${formatCl(c.capturaMax, 1)} %</strong> del agua que entra al dominio.</p>
      <p class="note-line c-amber">Balance de órdenes de magnitud: las entradas son estimaciones de 2013 y no se separa el almacenamiento.</p>
    </section>

    <section class="card">
      <div class="section-head"><h2>Equivalencia volumétrica</h2></div>
      <div class="stats2">
        ${statHtml({ title: 'Tasa diaria', value: formatCl(c.m3PorDia, 0), unit: 'm³/día', sub: 'Q × 86,4' })}
        ${statHtml({ title: 'Tasa anual', value: formatCl(c.hm3PorAnio, 2), unit: 'hm³/año', sub: 'millones de m³ al año' })}
      </div>
    </section>`;
}
