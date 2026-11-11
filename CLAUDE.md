# Balance DMH (versión web) · guía para Claude

## Qué es
Monitor de balance hídrico de la barrera de auscultación DMH (División Ministro Hales, Codelco, Calama).
Es un **simulacro académico** para la defensa de tesis de Camilo: los datos son simulados (proceso AR(1))
o la serie real de 69 días de la tesis. **No hay sensores reales.** Nunca presentar los datos como reales.

Es la versión web de una app Android (Kotlin/Compose) exportada desde Google AI Studio. La app Android
no está en este repositorio; el informe de diagnóstico de esa versión está en `docs/informe-etapa1.html`.

- **App publicada:** https://balance-dmh-web.vercel.app
- **Repositorio:** https://github.com/camiloignacioriquelme-commits/balance-dmh-web
- **Carpeta local:** `C:\Users\camil\Downloads\balance-dmh-web`

## Cómo funciona
Caudal total Q = Outpit + T. extraído (+ pozos planta si el interruptor está activo) + pozos crónicos
recuperados (0 a 4 × 0,8 l/s). % de la meta = Q ÷ meta (35 l/s por defecto). Semáforo:
Verde ≥ 100 %, Amarillo ≥ 90 %, Naranja > 80 %, Rojo ≤ 80 % (umbrales configurables; opción para que el
80 % exacto sea Naranja). El radar del talud (cm/día) se cruza con el semáforo: si el radar está en Rojo
y el caudal no, se muestra una advertencia ("importa dónde se extrae, no solo cuánto").

## Tecnología
HTML + CSS + JavaScript (módulos ES) **sin librerías, sin compilación y sin dependencias de npm**.
Node.js solo se usa para las pruebas y el servidor local. Fuentes de Google Fonts (Barlow, Barlow
Condensed, IBM Plex Mono); si no cargan, se usan las del sistema.

## Estructura
- `index.html`: encabezado, pestañas, contenedor `#main`, avisos y modo presentación.
- `js/logic.js`: fórmulas puras (semáforo, balance, sensibilidad, radar, estadísticas, AR(1), antirrebote,
  formato chileno `formatCl`). **Todo cálculo nuevo va aquí y con prueba.**
- `js/data.js`: serie de 69 días (`DATASET`), atajos (`PRESETS`), pozos crónicos.
- `js/store.js`: estado único (`state`), acciones, guardado en `localStorage` (prefijo `dmh.`),
  simulación y reproducción de la serie. Las pantallas se suscriben con `subscribe(topics => …)`.
- `js/charts.js`: medidor y gráficos en SVG; siempre usan los umbrales vigentes.
- `js/ui.js`: `numberField` (campo numérico que no se reescribe mientras se escribe), semáforo de
  4 luces (`badgeHtml`), interruptores, fichas.
- `js/screens/*.js`: cada pantalla exporta `mount(root)` → `{ update(topics) }`.
- `js/app.js`: navegación por `#hash` (#monitor, #calculadora, #balance, #historial, #ajustes), avisos,
  sonido, vibración, pantalla encendida, tema y modo presentación.
- `css/styles.css`: diseño "Ficha de faena". Colores como variables en `:root` (tema claro por defecto)
  y `:root[data-theme="dark"]`. `--X` es el relleno del semáforo y `--t-X` el color de texto con buen
  contraste: usar siempre `--t-X` para texto.
- `tests/logic.test.js`: 18 pruebas con `node --test`.
- `docs/`: informe de la Etapa 1, propuesta de diseño y capturas. No se publican.

## Comandos
```bash
npm test        # pruebas (deben pasar todas antes de cada commit)
npm run dev     # servidor local en http://localhost:5173
```
Si `node`/`git` no se encuentran en la consola, usar las rutas completas:
`C:\Program Files\nodejs\node.exe` y `C:\Program Files\Git\cmd\git.exe`.

## Publicación
Vercel publica automáticamente cada cambio que llega a `main` (sitio estático; `vercel.json` sin
compilación). `.vercelignore` deja fuera `tests/`, `scripts/`, `docs/`, `README.md` y `package.json`.
No hay variables de entorno, ni base de datos ni inicio de sesión (Supabase no se usa: se decidió que es
solo para la tesis). Si algún día hay datos reales compartidos, ahí se agregaría Supabase (Etapa 4).

## Forma de trabajo con Camilo
- Responder en **español de Chile**, simple, sin tecnicismos innecesarios, explicando el porqué.
  Camilo no es experto y quiere aprender mientras avanza.
- **No inventar** datos ni funciones; si hay que decidir, preguntar con opciones y una recomendación.
- Una etapa o tarea a la vez; mostrar el resultado y esperar su "ok".
- Probar antes de decir que algo está listo: `npm test` y revisar en el navegador en tamaño celular
  (375 px) y escritorio. Si algo falla, decirlo tal cual.
- Git: trabajar en una rama nueva, commits claros en español. **No hacer push a `main` ni abrir PR sin
  preguntar.** Camilo aprueba los Pull Request en GitHub.
- Cuando Camilo deba hacer algo (cuentas, permisos, aprobar PR, Vercel) usar el bloque
  "🙋 Te toca, Camilo" con pasos numerados, links completos y una línea de "Por qué".
- Seguridad: nunca pedir contraseñas ni tokens en el chat; nunca subir `.env` ni secretos.

## Pendientes / ideas
- Probar en un celular real: Compartir, sonido, vibración y el CSV en Excel.
- Opcional: hacerla instalable (PWA: manifest + íconos + service worker).
- Opcional: dominio propio.
- Las capturas de "antes/después" en `docs/` son solo de celular.
