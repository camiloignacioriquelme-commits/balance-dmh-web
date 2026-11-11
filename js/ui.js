// Piezas de interfaz reutilizables.

import { formatCl, parseCl, decimalsForStep } from './logic.js';

/** Escapa texto antes de insertarlo como HTML. */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function $(root, sel) { return root.querySelector(sel); }

let fieldSeq = 0;

/**
 * Campo numérico con botones − / +, casilla editable y deslizador.
 * Mientras escribes, la casilla NO se reescribe sola; solo se ordena el formato al salir (arreglo N2).
 * Los valores escritos conservan hasta 2 decimales aunque el paso de los botones sea 0,1.
 *
 * @returns {{ el: HTMLElement, set(value:number): void }}
 */
export function numberField({ label, unit, value, min, max, step, onChange, validate, hint }) {
  const id = `nf-${++fieldSeq}`;
  const stepDecimals = decimalsForStep(step);
  // Muestra los decimales del paso, o 2 si el valor los tiene (25,13 no se ve como 25,1) (arreglo M7).
  const neededDecimals = (v) => {
    const hundredths = Math.round(Math.abs(v) * 100);
    if (hundredths % 10 !== 0) return 2;
    if (hundredths % 100 !== 0) return 1;
    return 0;
  };
  const fmt = (v) => formatCl(v, Math.max(stepDecimals, neededDecimals(v)));
  const snap = (v) => Math.round(Math.round(v / step) * step * 1e6) / 1e6;
  const clamp = (v) => Math.min(Math.max(v, min), max);

  const el = document.createElement('div');
  el.className = 'nf';
  el.innerHTML = `
    <div class="nf-row">
      <div class="nf-text">
        <label class="nf-label" for="${id}">${esc(label)}</label>
        ${hint ? `<span class="nf-hint">${esc(hint)}</span>` : ''}
        <span class="nf-error" role="alert" hidden></span>
      </div>
      <div class="nf-controls">
        <button type="button" class="icon-btn" data-act="dec" aria-label="Disminuir ${esc(label)}">−</button>
        <div class="nf-input-wrap">
          <input id="${id}" class="nf-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false">
          <span class="nf-unit">${esc(unit)}</span>
        </div>
        <button type="button" class="icon-btn" data-act="inc" aria-label="Aumentar ${esc(label)}">+</button>
      </div>
    </div>
    <input class="nf-range" type="range" min="${min}" max="${max}" step="${step}" aria-label="${esc(label)} (deslizador)">`;

  const input = el.querySelector('.nf-input');
  const range = el.querySelector('.nf-range');
  const error = el.querySelector('.nf-error');
  let current = value;

  const showError = (msg) => { error.textContent = msg || ''; error.hidden = !msg; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
  const commit = (v, { fromTyping = false } = {}) => {
    const msg = validate ? validate(v) : null;
    if (msg) { showError(msg); return false; }
    showError(null);
    current = v;
    range.value = String(v);
    if (!fromTyping) input.value = fmt(v);
    onChange(v);
    return true;
  };

  input.value = fmt(value);
  range.value = String(value);

  input.addEventListener('input', () => {
    const parsed = parseCl(input.value);
    if (input.value.trim() === '') return showError('Escribe un valor');
    if (parsed == null) return showError('Número no válido');
    if (parsed < min) return showError(`Mínimo ${formatCl(min, stepDecimals)} ${unit}`);
    if (parsed > max) return showError(`Máximo ${formatCl(max, stepDecimals)} ${unit}`);
    commit(Math.round(parsed * 100) / 100, { fromTyping: true });
  });
  input.addEventListener('blur', () => { showError(null); input.value = fmt(current); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  range.addEventListener('input', () => commit(snap(Number(range.value))));
  el.querySelector('[data-act="dec"]').addEventListener('click', () => commit(clamp(snap(current - step))));
  el.querySelector('[data-act="inc"]').addEventListener('click', () => commit(clamp(snap(current + step))));

  return {
    el,
    set(v) {
      current = v;
      range.value = String(v);
      if (document.activeElement !== input) { input.value = fmt(v); showError(null); }
    },
  };
}

/** Interruptor accesible (checkbox con aspecto de switch). */
export function switchHtml({ id, checked, label, sub }) {
  return `<label class="switch-row" for="${id}">
    <span class="switch-text"><span class="switch-label">${esc(label)}</span>${sub ? `<span class="switch-sub" data-sub-for="${id}">${esc(sub)}</span>` : ''}</span>
    <input type="checkbox" role="switch" class="switch" id="${id}" ${checked ? 'checked' : ''}>
  </label>`;
}

/** Píldora de estado del semáforo. */
export function badgeHtml(semaforo, { compact = false } = {}) {
  return `<div class="badge bg-${semaforo.key}${compact ? ' compact' : ''}${semaforo.key === 'ROJO' ? ' pulse' : ''}">
    <span class="badge-dot f-bg-${semaforo.key}" aria-hidden="true"></span>
    <span class="badge-body"><strong class="c-${semaforo.key}">${esc(semaforo.title)}</strong>${compact ? '' : `<span>${esc(semaforo.action)}</span>`}</span>
  </div>`;
}

export function statHtml({ title, value, unit, sub, cls = '' }) {
  return `<div class="stat"><span class="stat-title">${esc(title)}</span>
    <span class="stat-value ${cls}">${value}${unit ? ` <small>${esc(unit)}</small>` : ''}</span>
    ${sub ? `<span class="stat-sub">${esc(sub)}</span>` : ''}</div>`;
}
