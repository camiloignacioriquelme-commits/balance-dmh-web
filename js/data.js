// Serie real de la tesis: 69 días con dato entre el 10-08-2026 y el 27-10-2026.
// Cada entrada: día-mes, outpit (l/s), T. extraído (l/s). Igual que HistoricalData.kt.

export const THESIS_AVG_OUTPIT = 25.13;
export const THESIS_AVG_T_EXTRAIDO = 6.03;
export const THESIS_AVG_TOTAL = 31.16;
export const SERIES_YEAR = 2026;
export const ALERT_DAY = '03-09'; // Alerta Roja banco 2130, Pared Este (radar 11,1 cm/d)

const RAW_DATA =
  '10-08,24.83,6.13;11-08,22.52,4.26;12-08,22.79,5.16;13-08,22.57,7.41;14-08,25.12,7.82;15-08,24.75,7.18;16-08,25.00,7.05;18-08,23.48,6.61;19-08,24.42,7.69;20-08,24.22,6.67;21-08,24.95,6.84;22-08,23.74,6.82;23-08,24.46,6.95;24-08,24.57,6.31;25-08,24.53,6.11;26-08,25.61,6.74;27-08,26.30,5.75;28-08,26.56,6.37;29-08,26.11,6.96;30-08,26.41,5.90;31-08,26.33,5.75;01-09,26.23,5.60;02-09,26.19,6.56;03-09,26.17,5.95;04-09,25.44,5.51;05-09,25.30,5.76;06-09,25.13,5.31;07-09,25.64,5.46;08-09,25.81,5.22;09-09,26.34,5.64;10-09,25.17,5.36;11-09,25.12,5.27;12-09,25.87,5.76;13-09,26.06,5.33;17-09,24.07,6.53;18-09,24.61,5.52;19-09,24.95,6.18;20-09,24.90,5.56;21-09,26.02,6.14;22-09,26.67,6.18;23-09,27.03,6.03;29-09,26.66,6.52;30-09,26.59,6.93;01-10,25.53,5.45;02-10,24.87,5.33;03-10,25.28,5.50;04-10,25.01,5.67;05-10,25.53,5.91;06-10,25.61,6.06;07-10,25.65,6.84;08-10,25.98,6.30;09-10,26.09,5.72;10-10,25.25,6.87;11-10,24.64,5.73;12-10,24.79,5.93;13-10,25.15,6.08;15-10,25.06,5.67;16-10,24.20,4.84;17-10,24.68,6.01;18-10,23.90,3.76;19-10,24.65,4.75;20-10,24.78,4.87;21-10,24.44,5.79;22-10,24.68,4.97;23-10,24.10,6.19;24-10,25.07,6.56;25-10,24.47,7.19;26-10,24.63,7.16;27-10,24.86,6.41';

const START = Date.UTC(SERIES_YEAR, 7, 10); // 10 de agosto
const DAY_MS = 86_400_000;

/** Días transcurridos desde el 10-08 (sirve para dejar visibles los días sin dato en el gráfico). */
export function dayIndexFromStart(diaMes) {
  const [d, m] = diaMes.split('-').map(Number);
  if (!d || !m) return 0;
  return Math.round((Date.UTC(SERIES_YEAR, m - 1, d) - START) / DAY_MS);
}

export const TOTAL_CALENDAR_DAYS = dayIndexFromStart('27-10') + 1; // 79

export const DATASET = RAW_DATA.split(';').map((entry) => {
  const [diaMes, o, t] = entry.split(',');
  const outpit = Number(o);
  const tExtraido = Number(t);
  return { diaMes, outpit, tExtraido, total: outpit + tExtraido, dayIndex: dayIndexFromStart(diaMes) };
});

/** Atajos de la Calculadora (casos de la tesis). */
export const PRESETS = [
  { name: 'Promedio tesis', label: 'Promedio tesis (31,2)', outpit: THESIS_AVG_OUTPIT, tExtraido: THESIS_AVG_T_EXTRAIDO },
  { name: 'Meta cumplida', label: 'Meta cumplida (35,0)', outpit: 28.5, tExtraido: 6.5 },
  { name: 'Caso 03-09', label: 'Caso 03-09 (32,1)', outpit: 26.17, tExtraido: 5.95 },
  { name: 'Mínimo 11-08', label: 'Mínimo 11-08 (26,8)', outpit: 22.52, tExtraido: 4.26 },
  { name: 'Máximo 30-09', label: 'Máximo 30-09 (33,5)', outpit: 26.59, tExtraido: 6.93 },
];

/** Pozos crónicos de la Pared Este: en la tesis parten los 4 detenidos, con 0,8 l/s cada uno al recuperarse. */
export const CHRONIC_WELLS = [
  { id: 'PBMH-49', name: 'PBMH-49', aporte: 0.8 },
  { id: 'PBMH-51', name: 'PBMH-51', aporte: 0.8 },
  { id: 'PBMH-58', name: 'PBMH-58', aporte: 0.8 },
  { id: '2280 SE', name: '2280 SE', aporte: 0.8 },
];
