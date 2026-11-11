// Arranque de la app: navegación entre pestañas, encabezado, avisos, modo presentación,
// tema, sonido, vibración y pantalla encendida.

import { formatCl } from './logic.js';
import { gaugeSvg } from './charts.js';
import { badgeHtml, esc } from './ui.js';
import { state, subscribe, setEffects, liveCalcs, setPresentation, init } from './store.js';
import * as monitor from './screens/monitor.js';
import * as calculator from './screens/calculator.js';
import * as balance from './screens/balance.js';
import * as history from './screens/history.js';
import * as settings from './screens/settings.js';

const TABS = {
  monitor: { title: 'Monitor', screen: monitor },
  calculadora: { title: 'Calculadora', screen: calculator },
  balance: { title: 'Balance', screen: balance },
  historial: { title: 'Historial', screen: history },
  ajustes: { title: 'Ajustes', screen: settings },
};

const main = document.getElementById('main');
const pill = document.getElementById('status-pill');
const toastBox = document.getElementById('toasts');
const overlay = document.getElementById('presentation');
let current = null;

// ---------- Navegación: cada pestaña tiene su dirección (#monitor, #calculadora...) y el botón Atrás funciona ----------
function tabFromHash() {
  const t = location.hash.replace('#', '');
  return TABS[t] ? t : 'monitor';
}
function show(tab) {
  current = { tab, view: TABS[tab].screen.mount(main) };
  document.title = `${TABS[tab].title} · Balance DMH`;
  document.querySelectorAll('[data-tab]').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => show(tabFromHash()));

// Algunas acciones (enviar al Monitor, caso 03-09, reproducir serie) llevan al Monitor.
function goMonitor() { if (tabFromHash() !== 'monitor') location.hash = 'monitor'; }

// ---------- Encabezado ----------
function renderPill() {
  const c = liveCalcs();
  pill.className = `status-pill bd-${c.semaforo.key}`;
  pill.innerHTML = `<span class="sw f-bg-${c.semaforo.key}" aria-hidden="true"></span><span class="mono c-${c.semaforo.key}">${formatCl(c.qTotal, 1)} l/s</span>`;
  pill.setAttribute('aria-label', `Caudal actual ${formatCl(c.qTotal, 1)} litros por segundo, ${c.semaforo.name}`);
}

// ---------- Avisos (toasts) ----------
function showToast(message, action, kind) {
  // Los cambios de color de la simulación se avisan solo en el Monitor; en las demás pestañas
  // quedan en el registro de eventos sin interrumpir lo que estás haciendo.
  if (kind === 'transition' && tabFromHash() !== 'monitor') return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ''}<button type="button" class="toast-close" aria-label="Cerrar aviso">✕</button>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
  el.querySelector('.toast-close').addEventListener('click', close);
  if (action) el.querySelector('.toast-action').addEventListener('click', () => { action.run(); close(); });
  toastBox.append(el);
  while (toastBox.children.length > 3) toastBox.firstElementChild.remove();
  setTimeout(close, action ? 7000 : 4500);
}

// ---------- Sonido y vibración ----------
let audio = null;
let touched = false;
document.addEventListener('pointerdown', () => {
  // Los navegadores solo permiten sonido y vibración después de que la persona toca la página.
  touched = true;
  if (!audio && (window.AudioContext || window.webkitAudioContext)) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  }
}, { once: true });

function beep(colorKey) {
  if (!audio) return;
  const tones = { ROJO: [880, 660], NARANJA: [740], AMARILLO: [620], VERDE: [523] }[colorKey];
  let t = audio.currentTime;
  for (const f of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.16);
    t += 0.2;
  }
}

function alertEffects(colorKey) {
  if (state.settings.soundEnabled) beep(colorKey);
  if (state.settings.vibrationEnabled && touched && navigator.vibrate) {
    navigator.vibrate({ ROJO: [150, 100, 250], NARANJA: [120, 80, 120], AMARILLO: [80], VERDE: [50] }[colorKey]);
  }
}

// ---------- Pantalla encendida ----------
let wakeLock = null;
async function syncWakeLock() {
  const want = (state.settings.keepScreenOn || state.presentation) && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', syncWakeLock);

// ---------- Modo presentación ----------
function renderPresentation() {
  if (!state.presentation) return;
  const c = liveCalcs();
  overlay.querySelector('[data-b="p-gauge"]').innerHTML = gaugeSvg({ porcentaje: c.porcentajeMeta, qTotal: c.qTotal, semaforo: c.semaforo, params: state.params });
  overlay.querySelector('[data-b="p-badge"]').innerHTML = badgeHtml(c.semaforo);
}
function togglePresentationView() {
  overlay.hidden = !state.presentation;
  document.body.classList.toggle('no-scroll', state.presentation);
  if (state.presentation) {
    renderPresentation();
    overlay.querySelector('.p-close').focus();
  }
  syncWakeLock();
}
overlay.querySelector('.p-close').addEventListener('click', () => setPresentation(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.presentation) setPresentation(false); });

// ---------- Tema ----------
function applyTheme() { document.documentElement.dataset.theme = state.settings.theme === 'light' ? 'light' : 'dark'; }

// ---------- Conexión con el estado ----------
setEffects({ toast: showToast, alert: alertEffects });

subscribe((topics) => {
  if (topics.has('settings')) { applyTheme(); syncWakeLock(); }
  if (topics.has('presentation')) togglePresentationView();
  if (topics.has('go-monitor')) goMonitor();
  renderPill();
  renderPresentation();
  current?.view.update(topics);
});

applyTheme();
show(tabFromHash());
renderPill();
init();
