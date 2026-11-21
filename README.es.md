# Board global y Dashboard global para Paperclip

[English](README.md) · **Español**

[![npm](https://img.shields.io/npm/v/paperclip-plugin-board-global)](https://www.npmjs.com/package/paperclip-plugin-board-global) [![CI](https://github.com/jstm-co/paperclip-plugin-board-global/actions/workflows/ci.yml/badge.svg)](https://github.com/jstm-co/paperclip-plugin-board-global/actions/workflows/ci.yml)

Plugin para [Paperclip](https://github.com/paperclipai/paperclip) que junta todas las empresas de una instancia en dos páginas:

- **Board global:** las tareas de todas las empresas y de todos sus proyectos en una sola vista, en board, en backlog, en lista o por pedidos, con filtros, vistas guardadas y carriles.
- **Dashboard global:** el Dashboard de cada empresa, lado a lado, con una comparativa por empresa y la actividad de todas mezclada por fecha.

«Board global» tiene un botón en la barra de arriba de todas las páginas, y cada página enlaza a la otra junto a su título. En el espacio clásico de Paperclip las dos aparecen además en el menú lateral; el espacio «Coordinator», que es el que viene por defecto, no muestra los enlaces de menú de los plugins. La interfaz está en español.

- Clave del plugin: `jstm.board-global` · paquete npm: `paperclip-plugin-board-global`
- Rutas: `/<PREFIJO>/board-global` y `/<PREFIJO>/dashboard-global`, donde `<PREFIJO>` es el de cualquier empresa (p. ej. `/ACM/board-global`).
- Probado con Paperclip `2026.824.1`.

## Board global

- **Board:** una columna por estado en marcha, en gris neutro: Por hacer, En curso, En revisión y Bloqueada. Abre agrupado por empresa: cada empresa es un carril con su cabecera arriba (nombre, cantidad de tareas y cuántas te tocan) y 2 tarjetas por celda, con «Ver N más». Las hechas y canceladas se muestran con el riel «Hechas y canceladas». Un filtro de estado reemplaza las columnas por los estados elegidos.
- **Backlog:** tiene su propia vista, para no llenar el board. Arriba, lo que ya está en «Por hacer»; abajo, el backlog de cada empresa en una lista plana. Arrastrar una fila de un lado al otro, o usar el botón de la fila, la pasa entre Backlog y «Por hacer».
- **«Por confirmar»:** una columna del board con las tareas raíz que alguien cerró (hechas o canceladas) y que todavía no confirmas, para distinguir lo que se terminó de lo que ya revisaste.
  - Para Paperclip esas tareas están cerradas: el plugin solo recuerda qué cierres confirmaste y no agrega ningún estado.
  - «Confirmar» en la tarjeta, o arrastrarla a «Hechas y canceladas», la confirma. «Todas» confirma la columna entera. Arrastrarla a una columna abierta la reabre. Todas estas acciones ofrecen «Deshacer».
  - Si la tarea se reabre y se vuelve a cerrar, vuelve a la columna. Cerrar una tarea tú mismo desde el board no pide confirmación.
  - La columna parte con los cierres de los últimos 7 días, y un cierre que nadie confirmó sale a los 30 días. Las subtareas nunca aparecen ahí. Con un filtro de estado la columna no se muestra.
- **Tarjeta:** primero el título; después la línea «Te toca», la tarea padre (o el proyecto) y un pie con el color de la empresa junto al ID, la prioridad cuando es crítica o alta, el avance de las subtareas (2/8) y el responsable. La tarjeta que espera tu respuesta lleva el fondo teñido.
- **Te toca:** marca las tareas que esperan tu respuesta y las que dependen de ellas («Espera tu respuesta en ACM-9»). El dato sale del Inbox de cada empresa.
- **Lista** agrupable por empresa, estado, proyecto, responsable o prioridad. Al agrupar por empresa o proyecto, las subtareas van anidadas bajo su tarea padre.
- **Pedidos:** una fila por pedido (tarea sin tarea padre) que resume todo lo que se creó por debajo, para ver de un vistazo en qué va cada cosa que pediste.
  - **Quién tiene la pelota:** las filas van en secciones, con lo que pide algo de ti arriba. «Te toca a ti»: alguna tarea del pedido espera tu respuesta, aunque el pedido ya esté cerrado. «Listo para cerrar»: todas las subtareas están hechas y el pedido sigue abierto. «Bloqueado»: está marcado como bloqueado y ninguna tarea lo frena. «Espera otra tarea»: lo frena una tarea de otro pedido. «En pausa»: hay trabajo hecho y lo que falta está en backlog. «Cerrado con pendientes»: el pedido se cerró y le quedan subtareas abiertas. «Trabajando ahora»: un agente está corriendo en alguna de sus tareas. Después vienen «En curso» y «Sin empezar». «Sin empezar» y «Cerrado» parten plegadas.
  - **Avance del pedido completo:** cuenta las subtareas de cualquier nivel, sin las canceladas (la tarjeta y la Lista cuentan solo las hijas directas). Al lado dice cuántas quedan abiertas por estado.
  - **Última novedad:** la primera línea del último comentario del pedido, con su autor, y el último movimiento de cualquiera de sus tareas.
  - **Desplegar** una fila muestra el árbol completo de subtareas con su estado, su responsable y cuál está corriendo.
  - Los **filtros** miran la tarea raíz, con tres diferencias: la búsqueda también encuentra un pedido por el ID o el título de una subtarea (y dice cuál), «Te toca» deja los pedidos donde alguna tarea espera tu respuesta y «Actualizada» cuenta el último movimiento de cualquier tarea del pedido.
  - **«Ocultar títulos que empiezan con…»** esconde los pedidos cuyo título empieza con un texto, por ejemplo los avisos que crea una automatización. Admite varios textos separados por coma y se guarda con la vista. «Ver cerrados» suma los pedidos hechos y cancelados.
- **Filtros**, todos en una fila: búsqueda, un botón por empresa, los filtros rápidos «Te toca» y «Críticas y altas» con cuántas tareas dejaría cada uno en la vista de ahora, y el menú «Filtros» con proyecto, estado, responsable, prioridad, etiqueta y fecha de actualización. Los menús muestran cuántas tareas hay por opción.
  - La **búsqueda** encuentra por ID, título o empresa, sin distinguir tildes ni mayúsculas. Una tarea aparece si el texto está en su ID o en su título, o si el nombre de su empresa, una palabra del nombre o su prefijo empieza con el texto. La parte de empresa pide al menos 3 caracteres y no busca dentro del nombre: `corp` no trae todo «Betacorp».
- **Arrastrar** una tarjeta a otra columna cambia el estado con `PATCH /api/issues/:id`, igual que el kanban nativo. El aviso ofrece «Deshacer». Si la API rechaza el cambio, la tarjeta vuelve a su lugar.
- **Crear tareas:** «+ Crear» en cada celda de las columnas Por hacer y En curso abre un compositor en el mismo lugar: escribes el título y Enter. Hay lo mismo en una fila «Nueva tarea en…» al pie de cada grupo de la Lista y del Backlog, y en el botón «Crear tarea» de la cabecera. Empresa, proyecto, responsable y prioridad salen del carril, el grupo o el filtro activo; si no hay empresa de partida, se elige. Asignar a un agente lo despierta (salvo en Backlog) y el compositor lo avisa; En curso exige responsable, así que parte en «Yo». Usa `POST /api/companies/:id/issues` con tu sesión, sin permisos nuevos. Un título ya abierto en las últimas 48 horas no se crea dos veces (el servidor devuelve la existente y el board la marca).
- **Modal de tarea:** el clic en una tarjeta o en una fila abre la tarea encima del board, sin salir de la página: descripción, subtareas, comentarios (puedes escribir uno), cambio de estado y, si la tarea está en «Por confirmar», su botón «Confirmar». Al abrirla queda leída, igual que en su página. Las subtareas, las tareas padre y los bloqueadores se abren en el mismo modal. Ctrl o ⌘ + clic (y los demás gestos del navegador) siguen yendo a la página de la tarea, igual que el enlace «Página completa» del modal; allá están los documentos, las corridas y las aprobaciones.
- **Vista previa** al pasar el mouse 450 ms sobre una tarjeta: detalle, «Te toca» y árbol de la tarea.
- **Carga por empresa:** si una empresa no responde, el resto del board sigue funcionando y esa empresa se puede reintentar sola.
- **Colores de empresa:** si la empresa tiene color de marca en Paperclip («Brand color» en sus ajustes), se usa ese. Si no, las 4 primeras por orden alfabético del nombre toman uno de 4 colores fijos y desde la quinta quedan en gris. El prefijo siempre va junto al color.

### Vistas guardadas y carriles

- **Pestañas de vistas** bajo la cabecera: «Todo el board», una pestaña por vista guardada (con su conteo) y «+ Guardar vista».
  - **Guardar:** el popover propone un nombre a partir de los filtros («Bloqueadas de todas las empresas», «Lo mío · últimos 7 días») y muestra qué guarda y cuántas tareas (o pedidos) muestra. Una vista guarda todo lo que va en la URL: filtros, Board, Backlog, Lista o Pedidos, agrupación, carriles, cerradas y títulos ocultos.
  - **Abrir:** clic en la pestaña. **Renombrar:** doble clic, F2 o «⋯ › Renombrar». **Borrar:** «⋯ › Borrar vista…», con confirmación.
  - **Cambios sin guardar:** si cambias un filtro con una vista abierta, la pestaña lleva un punto y aparecen «Descartar» y «Actualizar vista».
  - Las pestañas que no caben pasan a «Más · N». La activa siempre se ve.
  - **Se guardan en el servidor** (estado del plugin con alcance de instancia): las ven y las pueden cambiar todos los que usan la instancia, desde cualquier empresa y navegador.
- **Carriles** (solo en el Board): «Agrupar» en la barra de filtros los arma por empresa (lo de siempre), proyecto o responsable, o muestra el board sin agrupar. Las columnas siguen siendo los estados.
  - Cada carril muestra 2 tarjetas por celda y «Ver N más», y se pliega a su cabecera con un clic en ella. «Agrupar › Plegar todos los carriles» los pliega de una vez.
  - Arrastrar solo cambia el estado y solo dentro del mismo carril: una tarea no pasa a otra empresa, proyecto o responsable.
- **Filtro «Actualizada»** en el menú «Filtros»: «En los últimos 7 días» se cuenta desde ahora cada vez que se pinta, así que una vista como «Lo mío · últimos 7 días» nunca queda vieja.

### Estado en la URL

Todo el estado de la vista va en la URL, así que se puede guardar como marcador o compartir. Los valores por defecto no se escriben.

| Parámetro | Valores |
|---|---|
| `v` | `kanban` (el Board, defecto) · `backlog` · `lista` · `pedidos` |
| `q` | texto (ID, título o empresa) |
| `emp` | prefijos de empresa: `ACM,GLX` |
| `prj` | ids de proyecto; `none` = sin proyecto |
| `est` | `backlog,todo,in_progress,in_review,blocked,done,cancelled` |
| `resp` | `agent:<id>`, `user:<id>`; `none` = sin asignar |
| `pri` | `critical,high,medium,low` |
| `eti` | nombres de etiqueta |
| `toca=1` | solo lo que espera tu respuesta |
| `act=7d` | actualizadas en los últimos 7 días, contados desde ahora |
| `grp` | agrupación de la lista: `empresa` (defecto) · `estado` · `proyecto` · `responsable` · `prioridad` |
| `carr` | carriles del board: `empresa` (defecto) · `proyecto` · `responsable` · `no` (sin agrupar) |
| `sub=0` | ya no cambia nada: las tarjetas no despliegan subtareas. Se sigue leyendo para que los enlaces y las vistas guardadas de antes funcionen |
| `cerr=1` | columnas Hecha y Cancelada visibles; en Pedidos, los pedidos cerrados |
| `ocu` | solo en Pedidos: oculta los pedidos cuyo título empieza con alguno de estos textos: `Aviso%20autom%C3%A1tico,Recordatorio` |

Ejemplo: `/ACM/board-global?emp=GLX&est=blocked&pri=critical,high`

## Dashboard global

Muestra lo mismo que el Dashboard nativo de cada empresa, con todas juntas. De arriba abajo:

- **Contadores:** agentes activos, tareas en curso, gasto del mes y aprobaciones pendientes. Muestran el total de las empresas del filtro y, al pie, lo que aporta cada una (`ACM 8  GLX 3  NOR 4`). Cada aporte abre la página nativa de esa empresa.
  - El % del gasto se calcula solo con las empresas que tienen presupuesto; las demás se nombran al final («GLX sin límite»).
- **Aviso de presupuesto** si alguna empresa tiene incidentes, con una línea por empresa y el enlace a sus presupuestos.
- **Comparativa por empresa:** una fila por empresa con agentes, tareas en curso, abiertas, bloqueadas, gasto del mes, aprobaciones y 3 gráficos de 14 días (runs, tareas creadas y tasa de éxito). La última fila es el total.
  - Cada fila abre el Dashboard nativo de esa empresa.
  - Runs y Tareas creadas usan la misma escala en todas las filas, para comparar empresas. Éxito va de 0 a 100 %. En la fila Total, las barras se apilan por empresa.
  - Al pasar sobre una barra, un tooltip muestra el valor del día por empresa. Cada minigráfico tiene su texto para lectores de pantalla.
  - Se ordena con un clic en cualquier encabezado: descendente → ascendente → orden de Paperclip.
  - Solo se marca lo anormal: agentes con error, gasto ≥ 90 % del presupuesto, incidente de presupuesto y éxito < 80 %.
- **Agentes en vivo, actividad reciente y tareas recientes** de todas las empresas, mezclados por fecha, con la empresa marcada en cada fila y enlace al run o a la tarea.
- **Filtro por empresa** en la cabecera. Desde «Todas», un clic muestra solo esa empresa; después cada clic agrega o quita una.
- **Actualizar** vuelve a pedir los datos sin ocultar la página. Al volver a la pestaña, se recarga si los datos tienen más de 60 s.
- **Carga y errores:** cada fila aparece cuando su empresa responde. Si una empresa no responde, sus números no suman, su fila dice «No respondió» y se puede reintentar sola.

### Estado en la URL del Dashboard

| Parámetro | Valores |
|---|---|
| `emp` | prefijos: `ACM,GLX`. Vacío = todas |
| `ord` | columna ordenada: `agentes` · `encurso` · `abiertas` · `bloq` · `gasto` · `aprob` · `runs` · `creadas` · `exito` |
| `dir=asc` | orden ascendente (por defecto, descendente) |

Ejemplo: `/ACM/dashboard-global?emp=ACM,GLX&ord=gasto`

### De dónde sale cada dato

Son los mismos datos que usa el Dashboard nativo, pedidos para cada empresa con la sesión del usuario:

| Bloque | Fuente |
|---|---|
| Contadores, gasto, aprobaciones, aviso de presupuesto, Runs y Éxito | `GET /api/companies/:id/dashboard` (Runs y Éxito: `runActivity`, días UTC; éxito = exitosos + recuperados sobre el total) |
| Tareas creadas y Tareas recientes | las tareas del worker (`company-issues`): creadas por día y las 10 actualizadas más recientemente |
| Agentes en vivo | `GET /api/companies/:id/live-runs?minCount=4` |
| Actividad reciente | `GET /api/companies/:id/activity?limit=10` |

## Idiomas

La interfaz viene en **español** e **inglés**. Sigue el idioma del navegador (cualquier otro idioma queda en inglés) y el botón con el globo, en la cabecera de las dos páginas, deja elegir uno; la elección se guarda en ese navegador. Las fechas y los números siguen el idioma de la interfaz.

No se traducen el nombre del plugin en el administrador de plugins de Paperclip ni los valores de la URL (`v=lista`, `carr=empresa`…).

Para sumar un idioma, copia `src/i18n/en/` a `src/i18n/<código>/`, traduce los valores (las claves son los textos en español del código y quedan como están) y regístralo en `LOCALES` y `CATALOGS` de `src/i18n.ts`. `npm test` revisa que cada catálogo tenga todos los textos que usa el código, ninguno que no use y los mismos `{marcadores}`.

## Requisitos

- Paperclip `2026.824.1` o compatible.
- Acceso de board a la instancia. En modo `local_trusted` lo tiene cualquier proceso local; en modo `authenticated`, inicia sesión antes con `npx paperclipai auth login`.
- Para instalar desde npm: npm en la máquina donde corre Paperclip, que lo usa para descargar el paquete.
- Para instalar desde el código: Node.js 20 o superior y npm.

## Instalación

### Desde npm

```bash
npx paperclipai plugin install paperclip-plugin-board-global
npx paperclipai plugin list        # jstm.board-global, status=ready
```

### Desde el código

Paperclip carga el plugin desde una carpeta local y no copia el código: deja la carpeta donde está mientras uses el plugin.

```bash
git clone https://github.com/jstm-co/paperclip-plugin-board-global.git
cd paperclip-plugin-board-global
npm ci
npm run build
npx paperclipai plugin install "$PWD"
npx paperclipai plugin list        # jstm.board-global, status=ready
```

Si tu instancia no está en la dirección por defecto, agrega `--api-base <url>` a los comandos de `paperclipai`. Después recarga Paperclip: «Board global» y «Dashboard global» aparecen en el menú lateral de cada empresa.

## Actualización

Si lo instalaste desde npm, `upgrade` descarga la última versión publicada:

```bash
npx paperclipai plugin upgrade jstm.board-global
```

Si lo instalaste desde el código:

```bash
git pull
npm ci
npm run build
npx paperclipai plugin upgrade jstm.board-global
```

`upgrade` rechaza una versión que pida permisos nuevos (pasó con la que agregó el botón de la barra de arriba, que pide `ui.action.register`). En ese caso, desinstala **sin** `--force` y vuelve a instalar: Paperclip conserva el registro y los datos del plugin, incluidas las vistas guardadas.

```bash
npx paperclipai plugin uninstall jstm.board-global                # sin --force
npx paperclipai plugin install paperclip-plugin-board-global      # o "$PWD" desde la carpeta del código
```

## Desinstalación

```bash
npx paperclipai plugin uninstall jstm.board-global            # conserva el registro y los datos (también las vistas guardadas)
npx paperclipai plugin uninstall jstm.board-global --force    # borra todo, incluidas las vistas guardadas
```

## Permisos y datos

| Permiso | Para qué |
|---|---|
| `companies.read` | Listar las empresas de la instancia. |
| `issues.read` | Leer las tareas de cada empresa (el worker entrega solo los campos que usa el board). |
| `plugin.state.read`, `plugin.state.write` | Leer y guardar las vistas guardadas y las confirmaciones de «Por confirmar». Es lo único que el plugin escribe. |
| `ui.page.register`, `ui.sidebar.register` | Las dos páginas y sus enlaces en el menú lateral. |
| `ui.action.register` | El botón «Board global» de la barra de arriba. |

- El plugin no llama a servicios externos: todo va a la API de tu propia instancia de Paperclip.
- Proyectos, agentes, el Inbox («Te toca»), el Dashboard, el cambio de estado al arrastrar, el modal de tarea (descripción, comentarios, comentar y marcar la tarea como leída) y, en la vista Pedidos, las corridas activas y el último comentario de cada pedido usan la API nativa con la sesión del usuario que mira la página. Así se aplican las mismas reglas y permisos del núcleo.
- Las vistas guardadas y las confirmaciones son de toda la instancia: no son por usuario.

## Límites conocidos

- **«Te toca»** necesita una sesión de usuario en el navegador. Si el Inbox no se puede leer, el filtro rápido queda deshabilitado.
- **«Por confirmar»** no sabe quién cerró una tarea: una que cerraste tú fuera del board, en las páginas de Paperclip, también aparece ahí.
- **Modal de tarea:** muestra los últimos 50 comentarios y no edita el título, la descripción, el responsable ni la prioridad; las aprobaciones, los documentos y las corridas están en la página de la tarea.
- **Personas asignadas:** el SDK no expone sus nombres. `local-board` aparece como «Board» y otras personas como «Persona» con un id corto.
- **Enlaces a otras empresas:** abrir una tarea de otra empresa recarga la app, porque la navegación del host antepone la empresa activa.
- **Paginación:** cada empresa se pide completa (en Paperclip `2026.824.1`, `ctx.issues.list` con `offset` devuelve vacío). Con unas 400 tareas por empresa tarda unos 65 ms en el worker.
- **Miga del host en el Dashboard global:** Paperclip arma la miga con el nombre del plugin, así que dice «Plugins › Board global» también en el Dashboard global.
- **API del Dashboard:** el resumen, los runs en vivo y la actividad se leen con la API HTTP de Paperclip, no con el SDK. Si cambian en una versión nueva de Paperclip, hay que ajustar `src/ui/bridge.ts`.
- **Vista Pedidos:** las corridas activas y el último comentario de cada pedido también se leen con la API HTTP de Paperclip (`/live-runs` y `/issues/:id/comments`), solo con la vista abierta. Las corridas se vuelven a leer cada 30 segundos; lo demás, al actualizar el board. Los comentarios se piden de a 4 y solo para los pedidos a la vista; si una lectura falla, esa fila queda sin novedad.
- **Vistas compartidas:** «Lo mío» guarda `resp=user:local-board`. Con varios usuarios, todos verían las tareas de ese usuario.
- **Textos de la actividad:** los eventos conocidos van en español («cambió el estado a En revisión de ACM-412»). Un evento nuevo de Paperclip aparece con su nombre técnico hasta agregarlo a `src/dashboard.ts`.

## Desarrollo

```bash
npm ci
npm run dev         # build en modo watch
npm test            # pruebas de la lógica del board, del dashboard y del worker
npm run typecheck
```

Las pruebas cubren lo que no depende de React: estado en la URL, filtros y conteos, filtro de fecha, orden, filtros rápidos, «Te toca», árbol de subtareas, agrupación, carriles, columnas del board, la vista Backlog, «Por confirmar», el modal de tarea (qué clics lo abren, orden y autores de los comentarios), colores de empresa, vistas guardadas, la vista Pedidos (subárbol, quién tiene la pelota, búsqueda por subtarea, títulos ocultos y última novedad) y los campos que entrega el worker. En el Dashboard: totales, % de presupuesto, gráficos de 14 días, orden de la comparativa, filtro de empresa, formatos y el texto de la actividad.

Paperclip sirve la interfaz desde `dist/ui/` de la carpeta instalada en cada carga de página: un build en esa carpeta cambia lo que ve el usuario aunque no ejecutes `upgrade`. Si desarrollas sobre una instancia que usas a diario, instala desde una copia aparte.

## Cómo funciona

| Pieza | Archivo | Qué hace |
|---|---|---|
| Manifiesto | `src/manifest.ts` | Dos páginas (`board-global` y `dashboard-global`), sus enlaces en el menú lateral, el botón de la barra de arriba y los permisos. |
| Worker | `src/worker.ts` | Dato `company-issues`: las tareas de **una** empresa con solo los campos del board. Dato `saved-views` y acciones `view-create`, `view-rename`, `view-update` y `view-delete` para las vistas guardadas, de a una operación. Dato `confirmations` y acciones `confirm-add` y `confirm-remove` para «Por confirmar». |
| Lógica del Board | `src/board.ts` | URL, índice multiempresa, colores, filtros, orden, «Te toca», árbol, agrupación, carriles y columnas del board. Sin React. |
| «Por confirmar» | `src/confirm.ts`, `src/ui/useConfirmations.ts` | Qué tareas raíz cerradas esperan confirmación, y las operaciones de confirmar y deshacer. |
| Modal de tarea | `src/task.ts`, `src/ui/task.tsx`, `src/ui/open.tsx` | Qué clics abren el modal, autores y orden de los comentarios, y el modal con su descripción, subtareas y comentarios. |
| Lógica de Pedidos | `src/pedidos.ts` | Subárbol de cada tarea raíz, avance completo, quién tiene la pelota, qué pedidos se ven con cada filtro y la primera línea de un comentario. Sin React. |
| Vistas guardadas | `src/views.ts`, `src/ui/views.tsx`, `src/ui/useSavedViews.ts` | Nombres, nombre sugerido, pestaña marcada, operaciones del worker y escrituras optimistas. |
| Datos de la UI | `src/ui/useBoardData.ts`, `src/ui/useDashboardData.ts`, `src/ui/usePedidos.ts`, `src/ui/bridge.ts` | Carga en paralelo por empresa, reintento y cambio de estado. En Pedidos, corridas activas y último comentario. |
| Lógica del Dashboard | `src/dashboard.ts` | URL, totales, aporte por empresa, gráficos de 14 días, orden, formatos y texto de la actividad. Sin React. |
| Interfaz | `src/ui/*.tsx`, `src/ui/styles.ts`, `src/ui/dashStyles.ts` | Componentes y hojas de estilo propias. |

El host limita cada llamada al worker a una sola empresa. Por eso la UI lista las empresas (`GET /api/companies`) y, por cada una en paralelo, pide las tareas al worker (`POST /api/plugins/jstm.board-global/data/company-issues` con `{ companyId }`), los nombres de proyectos y agentes, y el Inbox.

**Estilos.** El CSS del host solo trae las clases de Tailwind que usa el núcleo, así que el plugin inserta su propia hoja. Las clases llevan el prefijo `gb-` y las variables van como `--gb-*`, para no pisar las del host. Sigue el tema claro u oscuro del host (clase `.dark`).

## Contribuir

Los reportes de errores y las mejoras son bienvenidos en [Issues](https://github.com/jstm-co/paperclip-plugin-board-global/issues) o como pull request. Así funciona:

1. Crea una rama desde `develop` y abre un pull request contra `develop`. El CI corre el typecheck, las pruebas y el build.
2. No subas la versión a mano. El check `version` informa si el cambio publicará cuando un release llegue a `main`.
3. Alguien del equipo fusiona el PR de la tarea en `develop` con un merge commit. Cuando se fusiona el PR de release `develop` → `main`, GitHub Actions publica la versión nueva en npm con procedencia (provenance) y crea su tag y su release.

Detalles en [CONTRIBUTING.md](CONTRIBUTING.md#español).

## Licencia

[MIT](LICENSE)
