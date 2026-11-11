# Balance DMH (versión web)

Monitor de balance hídrico de la barrera de auscultación DMH (División Ministro Hales, Calama).
Es un **simulacro académico** con los datos de la tesis: no está conectado a sensores reales.

Funciona en celular y computador desde el navegador. Es la versión web de la app Android
original exportada desde Google AI Studio.

## Cómo probarla en tu computador

Necesitas [Node.js](https://nodejs.org) (versión 20 o superior).

```bash
npm run dev
```

Abre http://localhost:5173 en el navegador.

## Pruebas automáticas

```bash
npm test
```

Revisan que los cálculos den lo mismo que en la tesis: semáforo, serie de 69 días, AR(1), etc.

## Estructura

| Carpeta / archivo | Qué contiene |
| --- | --- |
| `index.html` | La página principal |
| `css/styles.css` | Colores y diseño |
| `js/logic.js` | Fórmulas del balance y del semáforo (sin pantalla, fáciles de probar) |
| `js/data.js` | Serie real de 69 días y casos de la tesis |
| `js/store.js` | Estado de la app, guardado en el navegador y simulación |
| `js/charts.js` | Medidor y gráficos (SVG) |
| `js/screens/` | Las 5 pantallas: Monitor, Calculadora, Balance, Historial, Ajustes |
| `tests/` | Pruebas automáticas |
| `docs/` | Informe de diagnóstico (Etapa 1) |

No usa librerías externas ni necesita "compilar": los archivos se publican tal cual.
