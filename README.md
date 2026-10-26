# Global Board and Global Dashboard for Paperclip

**English** · [Español](README.es.md)

A [Paperclip](https://github.com/paperclipai/paperclip) plugin that brings every company in an instance together on two pages:

- **Board global** (Global Board): the issues of every company and every project in one view, as a kanban or a list, with filters, saved views and swimlanes.
- **Dashboard global** (Global Dashboard): each company's Dashboard side by side, with a per-company comparison and the activity of all of them merged by date.

Both pages show up in the sidebar of every company. **The interface is in Spanish**; this README quotes the on-screen labels in Spanish, with a translation the first time they appear.

- Plugin key: `jstm.board-global` · npm package: `paperclip-plugin-board-global` · version `0.6.1`
- Routes: `/<PREFIX>/board-global` and `/<PREFIX>/dashboard-global`, where `<PREFIX>` is the prefix of any company (e.g. `/ACM/board-global`).
- Tested with Paperclip `2026.824.1`.

## Global Board

- **Counters** that filter with one click: «Te toca responder» (waiting for your answer), «Bloqueadas» (blocked), «Críticas y altas» (critical and high) and «En revisión» (in review). They only follow the company filter.
- **Open issues by company:** one bar per company, split by status. Each row is also the company filter.
- **Kanban:** one column per open status. Inside each column, one group per company with 3 cards and «+N más» (+N more). Done and cancelled issues show up with the «Hechas y canceladas» (done and cancelled) rail.
- **Card:** company (prefix and color), ID, title, project (or parent issue), assignee and priority. Parent issues show their open sub-issues and progress (2/8).
- **«Te toca»** (your turn): marks the issues waiting for your answer and the ones that depend on them («Espera tu respuesta en ACM-9», waiting for your answer on ACM-9). The data comes from each company's Inbox.
- **List** grouped by company, status, project, assignee or priority. When grouped by company or project, sub-issues are nested under their parent.
- **Filters:** search, project, status, assignee and priority. Company, label and last-updated date are under «Más filtros» (more filters). Each menu shows how many issues match each option.
  - **Search** matches ID, title or company, ignoring accents and case. An issue shows up if the text is in its ID or title, or if its company name, a word of that name, or its prefix starts with the text. The company part needs at least 3 characters and does not search inside the name: `corp` does not bring up all of «Betacorp».
- **Drag** a card to another column to change its status with `PATCH /api/issues/:id`, just like the built-in kanban. The toast offers «Deshacer» (undo). If the API rejects the change, the card goes back.
- **Preview** after hovering a card for 450 ms: details, «Te toca» and the issue tree.
- **Per-company loading:** if a company does not respond, the rest of the board keeps working and that company can be retried on its own.
- **Company colors:** if the company has a brand color in Paperclip («Brand color» in its settings), that one is used. Otherwise the first 4 companies in alphabetical order of the name get one of 4 fixed colors, and from the fifth on they are gray. The prefix always goes next to the color.

### Saved views and swimlanes

- **View tabs** under the header: «Todo el board» (whole board), one tab per saved view (with its count) and «+ Guardar vista» (save view).
  - **Save:** the popover suggests a name based on the filters («Bloqueadas de todas las empresas», «Lo mío · últimos 7 días») and shows what it saves and how many issues it shows. A view saves everything in the URL: filters, Kanban or List, grouping, swimlanes, collapsed sub-issues and closed columns.
  - **Open:** click the tab. **Rename:** double-click, F2 or «⋯ › Renombrar». **Delete:** «⋯ › Borrar vista…», with confirmation.
  - **Unsaved changes:** if you change a filter while a view is open, the tab gets a dot and «Descartar» (discard) and «Actualizar vista» (update view) appear.
  - Tabs that do not fit go into «Más · N» (more). The active one is always visible.
  - **Stored on the server** (plugin state with instance scope): everyone using the instance sees them and can change them, from any company and browser.
- **Swimlanes** (Kanban only): «Carriles» (swimlanes) in the filter bar groups them by company, project or assignee. Columns are still the statuses.
  - Each swimlane shows 2 cards per cell and «+N más», and collapses to a row of counts by clicking its label. «Carriles › Plegar todos» collapses all of them.
  - With swimlanes, the sub-issues of each card start collapsed and expand one by one by clicking «Subtareas» (sub-issues).
  - Dragging only changes the status, and only within the same swimlane: an issue does not move to another company, project or assignee.
- **«Actualizada» filter** (updated) under «Más filtros»: «En los últimos 7 días» (in the last 7 days) is counted from now every time the board renders, so a view like «Lo mío · últimos 7 días» never goes stale. The counters do not apply it.

### State in the URL

The whole view state lives in the URL, so it can be bookmarked or shared. Default values are not written.

| Parameter | Values |
|---|---|
| `v` | `kanban` (default) · `lista` (list) |
| `q` | text (ID, title or company) |
| `emp` | company prefixes: `ACM,GLX` |
| `prj` | project ids; `none` = no project |
| `est` | `backlog,todo,in_progress,in_review,blocked,done,cancelled` |
| `resp` | `agent:<id>`, `user:<id>`; `none` = unassigned |
| `pri` | `critical,high,medium,low` |
| `eti` | label names |
| `toca=1` | only what is waiting for your answer |
| `act=7d` | updated in the last 7 days, counted from now |
| `grp` | list grouping: `empresa` (company, default) · `estado` (status) · `proyecto` (project) · `responsable` (assignee) · `prioridad` (priority) |
| `carr` | kanban swimlanes: `empresa` · `proyecto` · `responsable` (no parameter = no swimlanes) |
| `sub=0` | sub-issues collapsed on every card (without swimlanes; with swimlanes they always start collapsed) |
| `cerr=1` | Done and Cancelled columns visible |

Example: `/ACM/board-global?emp=GLX&est=blocked&pri=critical,high`

## Global Dashboard

Shows the same as each company's built-in Dashboard, with all of them together. From top to bottom:

- **Counters:** active agents, issues in progress, month spend and pending approvals. They show the total for the filtered companies and, at the bottom, what each one contributes (`ACM 8  GLX 3  NOR 4`). Each contribution opens that company's built-in page.
  - The spend % only counts companies with a budget; the others are listed at the end («GLX sin límite», GLX without limit).
- **Budget warning** if any company has incidents, with one line per company and a link to its budgets.
- **Per-company comparison:** one row per company with agents, issues in progress, open, blocked, month spend, approvals and 3 charts of the last 14 days (runs, issues created and success rate). The last row is the total.
  - Each row opens that company's built-in Dashboard.
  - Runs and Issues created use the same scale on every row, to compare companies. Success goes from 0 to 100 %. On the Total row, bars are stacked by company.
  - Hovering a bar shows a tooltip with that day's value per company. Each mini chart has a text for screen readers.
  - Click any header to sort: descending → ascending → Paperclip's order.
  - Only abnormal values are highlighted: agents in error, spend ≥ 90 % of budget, budget incident and success < 80 %.
- **Live agents, recent activity and recent issues** from every company, merged by date, with the company on each row and a link to the run or the issue.
- **Company filter** in the header. From «Todas» (all), one click shows only that company; after that, each click adds or removes one.
- **Refresh** fetches the data again without hiding the page. When you come back to the tab, it reloads if the data is older than 60 s.
- **Loading and errors:** each row appears when its company responds. If a company does not respond, its numbers are not added up, its row says «No respondió» (did not respond) and it can be retried on its own.

### Dashboard state in the URL

| Parameter | Values |
|---|---|
| `emp` | prefixes: `ACM,GLX`. Empty = all |
| `ord` | sorted column: `agentes` · `encurso` · `abiertas` · `bloq` · `gasto` · `aprob` · `runs` · `creadas` · `exito` |
| `dir=asc` | ascending order (descending by default) |

Example: `/ACM/dashboard-global?emp=ACM,GLX&ord=gasto`

### Where each number comes from

The same data the built-in Dashboard uses, requested for each company with the user's session:

| Block | Source |
|---|---|
| Counters, spend, approvals, budget warning, Runs and Success | `GET /api/companies/:id/dashboard` (Runs and Success: `runActivity`, UTC days; success = succeeded + recovered over total) |
| Issues created and Recent issues | the worker's issues (`company-issues`): created per day and the 10 most recently updated |
| Live agents | `GET /api/companies/:id/live-runs?minCount=4` |
| Recent activity | `GET /api/companies/:id/activity?limit=10` |

## Requirements

- Paperclip `2026.824.1` or compatible.
- Board access to the instance. In `local_trusted` mode any local process has it; in `authenticated` mode, sign in first with `npx paperclipai auth login`.
- To install from npm: npm on the machine where Paperclip runs, which uses it to download the package.
- To install from source: Node.js 20 or later and npm.

## Installation

### From npm

```bash
npx paperclipai plugin install paperclip-plugin-board-global
npx paperclipai plugin list        # jstm.board-global, status=ready
```

### From source

Paperclip loads the plugin from a local folder and does not copy the code: keep the folder where it is while you use the plugin.

```bash
git clone https://github.com/jstm-co/paperclip-plugin-board-global.git
cd paperclip-plugin-board-global
npm ci
npm run build
npx paperclipai plugin install "$PWD"
npx paperclipai plugin list        # jstm.board-global, status=ready
```

If your instance is not at the default address, add `--api-base <url>` to the `paperclipai` commands. Then reload Paperclip: «Board global» and «Dashboard global» show up in the sidebar of every company.

## Upgrading

If you installed from npm, `upgrade` downloads the latest published version:

```bash
npx paperclipai plugin upgrade jstm.board-global
```

If you installed from source:

```bash
git pull
npm ci
npm run build
npx paperclipai plugin upgrade jstm.board-global
```

`upgrade` rejects a version that asks for new permissions. In that case, uninstall **without** `--force` and install again: Paperclip keeps the plugin's record and data, including saved views.

```bash
npx paperclipai plugin uninstall jstm.board-global                # without --force
npx paperclipai plugin install paperclip-plugin-board-global      # or "$PWD" from the source folder
```

## Uninstalling

```bash
npx paperclipai plugin uninstall jstm.board-global            # keeps the record and data (saved views too)
npx paperclipai plugin uninstall jstm.board-global --force    # deletes everything, saved views included
```

## Permissions and data

| Permission | What for |
|---|---|
| `companies.read` | List the companies in the instance. |
| `issues.read` | Read each company's issues (the worker returns only the fields the board uses). |
| `plugin.state.read`, `plugin.state.write` | Read and store saved views. This is the only thing the plugin writes. |
| `ui.page.register`, `ui.sidebar.register` | The two pages and their sidebar links. |

- The plugin does not call any external service: everything goes to your own Paperclip instance's API.
- Projects, agents, the Inbox («Te toca»), the Dashboard and the status change when dragging use the built-in API with the session of the user viewing the page. That way the same core rules and permissions apply.
- Saved views belong to the whole instance: there are no per-user views.

## Known limitations

- **«Te toca»** needs a user session in the browser. If the Inbox cannot be read, the counter shows «—» and the filter is not applied.
- **Assigned people:** the SDK does not expose their names. `local-board` shows up as «Board» and other people as «Persona» (person) with a short id.
- **Links to other companies:** opening an issue from another company reloads the app, because the host's navigation prepends the active company.
- **Pagination:** each company is requested in full (in Paperclip `2026.824.1`, `ctx.issues.list` with `offset` returns nothing). With about 400 issues per company it takes about 65 ms in the worker.
- **Host breadcrumb on the Global Dashboard:** Paperclip builds the breadcrumb from the plugin name, so it says «Plugins › Board global» on the Global Dashboard too.
- **Dashboard API:** the summary, live runs and activity are read through Paperclip's HTTP API, not the SDK. If they change in a new Paperclip version, `src/ui/bridge.ts` needs to be adjusted.
- **Shared views:** «Lo mío» (mine) saves `resp=user:local-board`. With several users, everyone would see that user's issues.
- **Activity texts:** known events are written in Spanish («cambió el estado a En revisión de ACM-412», changed the status of ACM-412 to In review). A new Paperclip event shows its technical name until it is added to `src/dashboard.ts`.

## Development

```bash
npm ci
npm run dev         # build in watch mode
npm test            # tests for the board, dashboard and worker logic
npm run typecheck
```

The tests cover what does not depend on React: URL state, filters and counts, date filter, sorting, counters, «Te toca», sub-issue tree, grouping, swimlanes, company colors, saved views and the fields the worker returns. On the Dashboard: totals, budget %, 14-day charts, comparison sorting, company filter, formats and activity texts.

Paperclip serves the interface from `dist/ui/` in the installed folder on every page load: a build in that folder changes what the user sees even if you do not run `upgrade`. If you develop on an instance you use every day, install from a separate copy.

## How it works

| Piece | File | What it does |
|---|---|---|
| Manifest | `src/manifest.ts` | Two pages (`board-global` and `dashboard-global`), their sidebar links and the permissions. |
| Worker | `src/worker.ts` | `company-issues` data: the issues of **one** company with only the board's fields. `saved-views` data and `view-create`, `view-rename`, `view-update` and `view-delete` actions for saved views, one operation at a time. |
| Board logic | `src/board.ts` | URL, multi-company index, colors, filters, sorting, counters, «Te toca», tree, grouping and swimlanes. No React. |
| Saved views | `src/views.ts`, `src/ui/views.tsx`, `src/ui/useSavedViews.ts` | Names, suggested name, tab state, worker operations and optimistic writes. |
| UI data | `src/ui/useBoardData.ts`, `src/ui/useDashboardData.ts`, `src/ui/bridge.ts` | Parallel loading per company, retry and status change. |
| Dashboard logic | `src/dashboard.ts` | URL, totals, per-company contribution, 14-day charts, sorting, formats and activity texts. No React. |
| Interface | `src/ui/*.tsx`, `src/ui/styles.ts`, `src/ui/dashStyles.ts` | Components and the plugin's own style sheets. |

The host limits each worker call to a single company. That is why the UI lists the companies (`GET /api/companies`) and, for each one in parallel, asks the worker for its issues (`POST /api/plugins/jstm.board-global/data/company-issues` with `{ companyId }`), plus the project and agent names and the Inbox.

**Styles.** The host's CSS only ships the Tailwind classes the core uses, so the plugin injects its own style sheet. Classes are prefixed with `gb-` and variables are named `--gb-*`, so they do not clash with the host's. It follows the host's light or dark theme (`.dark` class).

## Contributing

Bug reports and improvements are welcome as [issues](https://github.com/jstm-co/paperclip-plugin-board-global/issues) or pull requests. Before sending a change, run `npm test` and `npm run typecheck`.

## License

[MIT](LICENSE)
