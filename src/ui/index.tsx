import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useHostLocation,
  useHostNavigation,
  type PluginPageProps,
  type PluginSidebarProps,
} from "@paperclipai/plugin-sdk/ui";
import {
  filterIssues,
  kanbanLanes,
  kanbanStatuses,
  parseBoardQuery,
  serializeBoardQuery,
  type BoardFilters,
  type BoardQuery,
  type LaneBy,
} from "../board.js";
import { PAGE_ROUTE, type BoardIssue, type IssueStatus } from "../shared.js";
import { Peek } from "./card.js";
import { STATUS_LABELS, plural, useNow } from "./common.js";
import { FilterBar } from "./filters.js";
import { Header, KpiLine, Kpis } from "./header.js";
import { KanbanBoard, KanbanSkeleton } from "./kanban.js";
import { LaneBoard, badDropMessage, laneUiKey } from "./lanes.js";
import { ToastStack, useToasts } from "./layer.js";
import { ListView } from "./list.js";
import { EmptyResults, LoadFailed, PartialErrorBanner, TocaBanner } from "./states.js";
import { ensureStyles } from "./styles.js";
import { useBoardData } from "./useBoardData.js";
import { useSavedViews } from "./useSavedViews.js";
import { ViewTabs } from "./views.js";

function KanbanIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 5v11" />
      <path d="M12 5v6" />
      <path d="M18 5v14" />
    </svg>
  );
}

// Entrada del menú lateral. Replica las clases del ítem nativo del sidebar.
export function BoardGlobalSidebarLink(_props: PluginSidebarProps) {
  const navigation = useHostNavigation();
  const location = useHostLocation();
  const active = location.pathname.endsWith(`/${PAGE_ROUTE}`);
  return (
    <a
      {...navigation.linkProps(`/${PAGE_ROUTE}`)}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 mx-2 rounded-lg px-2 py-1.5 font-medium transition-colors ${
        active ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <span className="relative shrink-0">
        <KanbanIcon />
      </span>
      <span className="flex-1 truncate">Board global</span>
    </a>
  );
}

const PEEK_DELAY_MS = 450;

/** Padding inferior del contenedor con scroll del host (p. ej. `md:p-6`), para que no aparezca su scroll. */
function hostBottomGap(el: HTMLElement): number {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.overflowY === "auto" || style.overflowY === "scroll") return parseFloat(style.paddingBottom) || 0;
  }
  return 0;
}

/** Alto disponible desde el borde superior del plugin hasta el final de la ventana: la página no hace scroll. */
function useFillHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setHeight(Math.max(480, Math.floor(window.innerHeight - top - hostBottomGap(el))));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return { ref, height };
}

function toggleIn(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * Página del Board global (propuesta D de JST-9, con la Fase 2 de JST-21:
 * vistas guardadas y carriles). Todo el estado de la vista vive en la URL, así
 * que se puede guardar como marcador, compartir o guardar como vista.
 */
export function BoardGlobalPage({ context }: PluginPageProps) {
  useLayoutEffect(() => ensureStyles(), []);
  const location = useHostLocation();
  const navigation = useHostNavigation();
  const data = useBoardData();
  // Se leen al abrir el board, en paralelo con las tareas (§3.10).
  const saved = useSavedViews(context.companyId);
  const { toasts, show: toast, dismiss } = useToasts();
  const now = useNow();
  const { ref: rootRef, height } = useFillHeight();

  const query = useMemo(() => parseBoardQuery(location.search), [location.search]);
  const setQuery = useCallback(
    (next: BoardQuery) => navigation.navigate(`/${PAGE_ROUTE}${serializeBoardQuery(next)}`, { replace: true }),
    [navigation],
  );
  const setFilters = (filters: BoardFilters) => setQuery({ ...query, filters });
  const lanes = query.view === "kanban" ? query.lanes : null;

  const { index } = data;
  const loading = !data.ready;
  // «Actualizada · últimos 7 días» se cuenta desde ahora cada vez que se pinta (§5).
  const filterNow = query.filters.act ? now : 0;
  const filtered = useMemo(
    () => (index ? filterIssues(index, query.filters, undefined, filterNow || Date.now()) : []),
    [index, query.filters, filterNow],
  );

  // Estado de la vista que no va en la URL: grupos plegados, «+N más», subtareas por tarjeta.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [more, setMore] = useState<Readonly<Record<string, number>>>({});
  const [cardToggled, setCardToggled] = useState<ReadonlySet<string>>(() => new Set());
  const [kidsAll, setKidsAll] = useState<ReadonlySet<string>>(() => new Set());
  const [treeClosed, setTreeClosed] = useState<ReadonlySet<string>>(() => new Set());
  const onToggleGroup = useCallback((key: string) => setCollapsed((prev) => toggleIn(prev, key)), []);
  const onMore = useCallback((key: string, next: number) => setMore((prev) => ({ ...prev, [key]: next })), []);
  const onToggleSubtasks = useCallback((id: string) => setCardToggled((prev) => toggleIn(prev, id)), []);
  const onShowAllKids = useCallback((id: string) => setKidsAll((prev) => new Set(prev).add(id)), []);
  const onToggleTree = useCallback((id: string) => setTreeClosed((prev) => toggleIn(prev, id)), []);
  const resetCards = useCallback(() => {
    setCardToggled(new Set());
    setKidsAll(new Set());
  }, []);

  // Carriles plegados y «Ver contadores»: en memoria, en este navegador (§3.10).
  const [closedLanes, setClosedLanes] = useState<ReadonlySet<string>>(() => new Set());
  const [kpiOpen, setKpiOpen] = useState(false);
  const onToggleLane = useCallback((key: string) => setClosedLanes((prev) => toggleIn(prev, key)), []);
  // Al cambiar `carr`, las tarjetas tocadas a mano vuelven a lo de ese modo (§4.1).
  const onLanes = (next: LaneBy | null) => {
    setClosedLanes(new Set());
    setMore({});
    resetCards();
    setQuery({ ...query, lanes: next });
  };
  const onFoldLanes = (fold: boolean) => {
    if (!index || !lanes) return;
    const keys = kanbanLanes(index, filtered, lanes, kanbanStatuses(query.filters, query.showClosed)).map((lane) => laneUiKey(lanes, lane.key));
    setClosedLanes(fold ? new Set(keys) : new Set());
  };
  // Abrir una vista (o «Todo el board», o «Descartar»): vuelve a 3 tarjetas por grupo.
  const onApplyView = (next: BoardQuery) => {
    setMore({});
    resetCards();
    setQuery(next);
  };

  // Vista previa al pasar: aparece tras 450 ms y se oculta al salir, al hacer scroll o al arrastrar.
  const [peek, setPeek] = useState<{ issueId: string; rect: DOMRect } | null>(null);
  const peekTimer = useRef<number | undefined>(undefined);
  const onPeek = useCallback((issue: BoardIssue | null, element?: HTMLElement) => {
    window.clearTimeout(peekTimer.current);
    if (!issue || !element) {
      setPeek(null);
      return;
    }
    peekTimer.current = window.setTimeout(() => setPeek({ issueId: issue.id, rect: element.getBoundingClientRect() }), PEEK_DELAY_MS);
  }, []);

  // Arrastrar y soltar: actualización optimista + PATCH nativo + toast con «Deshacer».
  const [dragging, setDragging] = useState<BoardIssue | null>(null);
  const onDragStart = useCallback((issue: BoardIssue) => setDragging(issue), []);
  const onDragEnd = useCallback(() => setDragging(null), []);

  const move = async (issue: BoardIssue, from: IssueStatus, to: IssueStatus, undo: boolean) => {
    const label = issue.identifier ?? "la tarea";
    try {
      const status = await data.moveIssue(issue.id, from, to);
      toast({
        content: (
          <>
            <b className="gb-mono" style={{ fontWeight: 500 }}>
              {label}
            </b>{" "}
            {undo ? "volvió a" : "movida a"} {STATUS_LABELS[status]}
          </>
        ),
        action: undo ? undefined : { label: "Deshacer", run: () => void move(issue, status, from, true) },
      });
    } catch (err) {
      toast({ error: true, content: `No se pudo ${undo ? "deshacer el cambio de" : "mover"} ${label}: ${(err as Error).message}` });
    }
  };
  const onDrop = (status: IssueStatus) => {
    const issue = dragging;
    setDragging(null);
    if (issue && issue.status !== status) void move(issue, issue.status, status, false);
  };

  const refresh = async () => {
    void saved.reload(true);
    const result = await data.refresh();
    if (!result) return;
    const seconds = (result.elapsedMs / 1000).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    toast({ content: `Board actualizado · ${plural(result.ok, "empresa", "empresas")} en ${seconds} s` });
  };

  const peekIssue = peek && index ? index.byId.get(peek.issueId) : undefined;

  return (
    <div ref={rootRef} className="gb" style={{ height }} onScrollCapture={() => onPeek(null)}>
      <Header
        loading={loading}
        companyCount={index?.companies.length ?? data.companies?.length ?? null}
        loadedAt={data.loadedAt}
        now={now}
        refreshing={data.refreshing}
        onRefresh={() => void refresh()}
        view={query.view}
        onView={(view) => setQuery({ ...query, view })}
      />
      {/* Desde el primer instante, también durante el esqueleto: la página no salta al llegar las vistas (§3.10). */}
      <ViewTabs index={index} query={query} now={now} saved={saved} onApply={onApplyView} toast={toast} />
      {lanes && !kpiOpen ? (
        <KpiLine index={index} loading={loading} filters={query.filters} onFilters={setFilters} onExpand={() => setKpiOpen(true)} />
      ) : (
        <Kpis
          index={index}
          loads={data.loads}
          loading={loading}
          filters={query.filters}
          onFilters={setFilters}
          onRetry={data.retry}
          onFold={lanes ? () => setKpiOpen(false) : undefined}
        />
      )}
      <FilterBar
        index={index}
        query={query}
        disabled={loading || !index}
        onQuery={setQuery}
        onResetCards={resetCards}
        onLanes={onLanes}
        onFoldLanes={onFoldLanes}
      />
      {index && data.failed.length > 0 ? (
        <PartialErrorBanner failed={data.failed} onRetry={() => data.failed.forEach((load) => void data.retry(load.company.id))} />
      ) : null}
      {index && query.filters.toca && index.tocaAvailable ? (
        <TocaBanner index={index} issues={filtered} onShowAll={() => setFilters({ ...query.filters, toca: false })} />
      ) : null}

      {loading ? (
        <KanbanSkeleton />
      ) : !index ? (
        <LoadFailed message={data.listError} onRetry={() => void data.refresh()} />
      ) : filtered.length === 0 ? (
        <EmptyResults index={index} query={query} onFilters={setFilters} />
      ) : query.view === "lista" ? (
        <ListView
          index={index}
          issues={filtered}
          group={query.group}
          now={now}
          ui={{ collapsed, treeClosed, more }}
          onToggleGroup={onToggleGroup}
          onToggleTree={onToggleTree}
          onMore={onMore}
        />
      ) : lanes ? (
        <LaneBoard
          index={index}
          issues={filtered}
          query={query}
          laneBy={lanes}
          ui={{ collapsed, more, cardToggled, kidsAll }}
          closedLanes={closedLanes}
          dragging={dragging}
          onToggleLane={onToggleLane}
          onMore={onMore}
          onToggleSubtasks={onToggleSubtasks}
          onShowAllKids={onShowAllKids}
          onShowClosed={() => setQuery({ ...query, showClosed: true })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          onBadDrop={() => toast({ content: badDropMessage(lanes) })}
          onPeek={onPeek}
        />
      ) : (
        <KanbanBoard
          index={index}
          issues={filtered}
          query={query}
          ui={{ collapsed, more, cardToggled, kidsAll }}
          draggingId={dragging?.id ?? null}
          onToggleGroup={onToggleGroup}
          onMore={onMore}
          onToggleSubtasks={onToggleSubtasks}
          onShowAllKids={onShowAllKids}
          onShowClosed={() => setQuery({ ...query, showClosed: true })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          onPeek={onPeek}
        />
      )}

      {peekIssue && peek && !dragging ? <Peek index={index!} issue={peekIssue} anchor={peek.rect} now={now} /> : null}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

// Segunda página del plugin (JST-13): el Dashboard global.
export { DashboardGlobalPage, DashboardGlobalSidebarLink } from "./dashboard.js";
