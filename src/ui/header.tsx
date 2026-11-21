// Cabecera (JST-407, sobre §3.1): título, actualización, las cuatro vistas y
// «Crear tarea». Los contadores grandes ya no van: «Te toca» y «Críticas y
// altas» son filtros rápidos de la barra, y Bloqueadas y En revisión, columnas.
import { useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import type { BoardView } from "../board.js";
import { DASHBOARD_ROUTE } from "../shared.js";
import { cx, plural } from "./common.js";
import { CreateHeadButton } from "./create.js";
import { Icon, type IconName } from "./icons.js";

function updatedLabel(loadedAt: number | null, now: number): string {
  if (!loadedAt) return "";
  const minutes = Math.floor((now - loadedAt) / 60_000);
  if (minutes < 1) return "Actualizado hace un momento";
  if (minutes < 60) return `Actualizado hace ${minutes} min`;
  return `Actualizado hace ${Math.floor(minutes / 60)} h`;
}

const VIEW_META: Record<BoardView, { label: string; icon: IconName; title: string }> = {
  kanban: { label: "Board", icon: "kanban", title: "Lo que está en marcha: Por hacer, En curso, En revisión y Bloqueada" },
  backlog: { label: "Backlog", icon: "layers", title: "Lo que todavía no entra al Board" },
  lista: { label: "Lista", icon: "list", title: "Todas las tareas en una lista agrupada" },
  pedidos: { label: "Pedidos", icon: "list-tree", title: "Una fila por pedido (tarea sin padre) con el resumen de todas sus subtareas" },
};
const VIEW_ORDER: readonly BoardView[] = ["kanban", "backlog", "lista", "pedidos"];

export function Header({
  loading,
  companyCount,
  loadedAt,
  now,
  refreshing,
  onRefresh,
  view,
  backlogCount,
  onView,
}: {
  loading: boolean;
  companyCount: number | null;
  loadedAt: number | null;
  now: number;
  refreshing: boolean;
  onRefresh: () => void;
  view: BoardView;
  /** Tareas en Backlog con los filtros de ahora; `null` mientras carga. */
  backlogCount: number | null;
  onView: (view: BoardView) => void;
}) {
  const navigation = useHostNavigation();
  const n = companyCount ?? 4;
  const subtitle = loading ? `Cargando las tareas de ${plural(n, "empresa", "empresas")}…` : `Tareas de ${n === 1 ? "1 empresa" : `las ${n} empresas`}`;
  return (
    <div className="gb-head">
      <div className="gb-headtx">
        <div className="gb-title">
          <h1>Board global</h1>
          {/* El menú lateral del espacio «Coordinator» no trae las entradas del plugin: el Dashboard se alcanza desde acá. */}
          <a {...navigation.linkProps(`/${DASHBOARD_ROUTE}`)} className="gb-xlink" title="Dashboard global: la comparativa entre empresas">
            Dashboard global
            <Icon name="chevron-right" size={12} />
          </a>
        </div>
        <div className="gb-sub">
          {subtitle}
          {!loading && loadedAt ? <span className="gb-upd"> · {updatedLabel(loadedAt, now)}</span> : null}
        </div>
      </div>
      <span className="gb-sp" />
      <div className="gb-seg" role="group" aria-label="Vista">
        {VIEW_ORDER.map((key) => {
          const meta = VIEW_META[key];
          return (
            <button key={key} type="button" className={cx(view === key && "is-on")} aria-pressed={view === key} title={meta.title} onClick={() => onView(key)}>
              <Icon name={meta.icon} size={14} />
              {meta.label}
              {key === "backlog" && backlogCount !== null ? <span className="gb-segn gb-tnum">{backlogCount}</span> : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={cx("gb-btn", "is-icon", refreshing && "is-spinning")}
        title="Actualizar"
        aria-label="Actualizar"
        onClick={onRefresh}
        disabled={loading || refreshing}
      >
        <Icon name="refresh" size={14} />
      </button>
      <CreateHeadButton disabled={loading} />
    </div>
  );
}
