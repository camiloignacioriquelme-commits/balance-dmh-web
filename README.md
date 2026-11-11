# Balance DMH

Monitor de balance hídrico de la barrera de auscultación DMH (División Ministro Hales, Calama).

**Abrir la app:** https://balance-dmh-web.vercel.app (funciona en celular y computador)

> Es un **simulacro académico** con los datos de la tesis. No está conectado a sensores reales.

## Qué hace
- **Monitor:** medidor de % de la meta, semáforo de 4 luces, cruce con el radar del talud, gráfico de
  las últimas lecturas simuladas, pozos crónicos y modo presentación para proyectar.
- **Calculadora:** escribes outpit y T. extraído y ves el resultado al instante; análisis de
  sensibilidad; lecturas guardadas y descarga en CSV para Excel.
- **Balance:** entradas, captura de la barrera y ecuación de conservación de masa.
- **Historial:** la serie real de 69 días (10-ago a 27-oct) con estadísticas y filtro por color.
- **Ajustes:** radar, umbrales del semáforo, tema claro/oscuro, sonido y vibración.

Las lecturas y ajustes se guardan solo en el navegador de cada persona.

## Para trabajar en el código
Necesitas [Node.js](https://nodejs.org) 20 o superior. No hay que instalar nada más.

```bash
npm run dev
```

```bash
npm test
```

El primero abre la app en http://localhost:5173. El segundo corre las pruebas de los cálculos.

Cada cambio que llega a la rama `main` en GitHub se publica solo en Vercel.
Los detalles técnicos están en [CLAUDE.md](CLAUDE.md).
