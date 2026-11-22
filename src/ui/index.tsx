import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useHostLocation,
  useHostNavigation,
  type PluginPageProps,
  type PluginSidebarProps,
} from "@paperclipai/plugin-sdk/ui";
import {
  BACKLOG_STATUSES,
  FLAT_LANE,
  NO_PROJECT,
  assigneeKey,
  boardColumns,
  buildBoardIndex,
  columnOf,
  filterIssues,
  laneKeyOf,
  parseBoardQuery,
  serializeBoardQuery,
  stalledCount,
  stalledGroups,
  type BoardFilters,
  type BoardIndex,
  type BoardQuery,
  type GroupBy,
  type LaneBy,
} from "../board.js";
import { pendingConfirmation } from "../confirm.js";
import { localeTag, t } from "../i18n.js";
import { pedidoRows } from "../pedidos.js";
import { PAGE_ROUTE, isOpenStatus, type BoardIssue, type IssueStatus } from "../shared.js";
import { BacklogView } from "./backlog.js";
import { getSessionUserId } from "./bridge.js";
import { Peek } from "./card.js";
import { CreateProvider, MarksProvider, useCreateFlow, useMarks } from "./create.js";
import { STATUS_LABELS, plural, useNow } from "./common.js";
import { FilterBar } from "./filters.js";
import { StalledDrawer, useStalledEscape } from "./stalled.js";
import { tx } from "./i18n.js";
import { Header } from "./header.js";
import { BoardSkeleton, LaneBoard, badDropMessage, boardLanes, laneUiKey } from "./lanes.js";
import { ToastStack, useToasts } from "./layer.js";
import { ListView } from "./list.js";
import { OpenTaskProvider } from "./open.js";
import { EmptyPedidos, PedidosView } from "./pedidos.js";
import { EmptyResults, LoadFailed, PartialErrorBanner, TocaBanner } from "./states.js";
import { ensureStyles } from "./styles.js";
import { TaskModal } from "./task.js";
import { useBoardData } from "./useBoardData.js";
import { useConfirmations } from "./useConfirmations.js";
import { useLiveRuns } from "./usePedidos.js";
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
      <span className="flex-1 truncate">{t("Board global")}</span>
    </a>
  );
}

/**
 * Botón de la barra de arriba (slot `globalToolbarButton`): está en todas las
 * páginas de todas las empresas. El menú lateral del espacio «Coordinator» no
 * dibuja los slots `sidebar`, así que esta es la entrada que se ve siempre.
 * Va fuera de `.gb`: toma los tokens de `.gb-layer`.
 */
export function BoardGlobalToolbarButton() {
  const navigation = useHostNavigation();
  const location = useHostLocation();
  useLayoutEffect(() => ensureStyles(), []);
  const active = location.pathname.replace(/\/+$/, "").endsWith(`/${PAGE_ROUTE}`);
  return (
    <a
      {...navigation.linkProps(`/${PAGE_ROUTE}`)}
      aria-current={active ? "page" : undefined}
      aria-label={t("Board global")}
      title={t("Board global: las tareas de todas las empresas")}
      className={`gb-layer gb-tb${active ? " is-on" : ""}`}
    >
      <KanbanIcon />
      <span className="gb-tb-lbl">{t("Board global")}</span>
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

const EMPTY_INDEX: BoardIndex = buildBoardIndex([]);
const NO_IDS: ReadonlySet<string> = new Set();

/** Clave de la tarea en los grupos de la Lista, para desplegar el grupo donde cae una tarea nueva. */
function listGroupKey(issue: BoardIssue, group: GroupBy): string {
  switch (group) {
    case "empresa":
      return issue.companyId;
    case "proyecto":
      return issue.projectId ?? NO_PROJECT;
    case "responsable":
      return assigneeKey(issue);
    case "estado":
      return issue.status;
    case "prioridad":
      return issue.priority;
  }
}

function toggleIn(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * Página del Board global (propuesta D de JST-9, la Fase 2 de JST-21 y el
 * rediseño de JST-407) y sus cuatro vistas: Board, Backlog, Lista y Pedidos.
 * Todo el estado de la vista vive en la URL, así que se puede guardar como
 * marcador, compartir o guardar como vista.
 */
export function BoardGlobalPage({ context }: PluginPageProps) {
  useLayoutEffect(() => ensureStyles(), []);
  const location = useHostLocation();
  const navigation = useHostNavigation();
  const data = useBoardData();
  // Se leen al abrir el board, en paralelo con las tareas (§3.10).
  const saved = useSavedViews(context.companyId);
  const confirmations = useConfirmations(context.companyId);
  const { toasts, show: toast, dismiss } = useToasts();
  const now = useNow();
  const { ref: rootRef, height } = useFillHeight();

  const query = useMemo(() => parseBoardQuery(location.search), [location.search]);
  const setQuery = useCallback(
    (next: BoardQuery) => navigation.navigate(`/${PAGE_ROUTE}${serializeBoardQuery(next)}`, { replace: true }),
    [navigation],
  );
  const setFilters = (filters: BoardFilters) => setQuery({ ...query, filters });
  const inBoard = query.view === "kanban";
  const inBacklog = query.view === "backlog";
  const lanes = inBoard ? query.lanes : null;

  // Tareas recién creadas (JST-333): marcadas y primeras en su grupo hasta que se actualiza el board.
  const { marks, set: setMark, clear: clearMark } = useMarks(data.loadedAt);
  const freshIds = useMemo(() => new Set([...marks].flatMap(([id, mark]) => (mark.kind === "new" ? [id] : []))), [marks]);
  const index = useMemo(() => (data.index ? { ...data.index, fresh: freshIds } : null), [data.index, freshIds]);
  const loading = !data.ready;
  // «Actualizada · últimos 7 días» se cuenta desde ahora cada vez que se pinta (§5).
  const filterNow = query.filters.act ? now : 0;
  const filtered = useMemo(() => {
    if (!index) return [];
    const base = filterIssues(index, query.filters, undefined, filterNow || Date.now());
    if (marks.size === 0) return base;
    // Una tarea recién creada se ve hasta actualizar aunque no calce con los filtros, salvo si su empresa quedó fuera (§7.6).
    const shown = new Set(base.map((issue) => issue.id));
    const extra = [...marks.keys()].flatMap((id) => {
      const issue = index.byId.get(id);
      const prefix = issue ? index.companyById.get(issue.companyId)?.prefix : undefined;
      const companyOut = query.filters.emp.length > 0 && !(prefix && query.filters.emp.includes(prefix));
      return issue && !shown.has(id) && !companyOut ? [issue] : [];
    });
    return extra.length > 0 ? [...base, ...extra] : base;
  }, [index, marks, query.filters, filterNow]);

  // «Por confirmar» (JST-407): raíces cerradas que la persona todavía no confirma. Con filtro
  // de estado no hay columna. `selfClosed`: las que cerró ella misma desde el board; se dan
  // por confirmadas apenas se sueltan, antes de que responda el worker.
  const [selfClosed, setSelfClosed] = useState<ReadonlySet<string>>(NO_IDS);
  const withConfirm = confirmations.state !== null && query.filters.est.length === 0;
  const pending = useMemo(() => {
    if (!index || !withConfirm) return NO_IDS;
    const ids = pendingConfirmation(index.issues, confirmations.state, now);
    for (const id of selfClosed) ids.delete(id);
    return ids;
  }, [index, withConfirm, confirmations.state, now, selfClosed]);
  const columns = useMemo(() => boardColumns(query.filters, query.showClosed, withConfirm), [query.filters, query.showClosed, withConfirm]);
  // Lo que cabe en cada vista: las columnas del Board, o Backlog y Por hacer.
  const boardIssues = useMemo(() => filtered.filter((issue) => columns.includes(columnOf(issue, pending))), [filtered, columns, pending]);
  const backlogIssues = useMemo(() => filtered.filter((issue) => (BACKLOG_STATUSES as readonly IssueStatus[]).includes(issue.status)), [filtered]);
  const backlogCount = useMemo(() => backlogIssues.filter((issue) => issue.status === "backlog").length, [backlogIssues]);
  const closedCount = useMemo(() => filtered.filter((issue) => !isOpenStatus(issue.status) && !pending.has(issue.id)).length, [filtered, pending]);

  // Vista Pedidos: una fila por tarea raíz. Las corridas activas se piden solo con la vista abierta.
  const inPedidos = query.view === "pedidos";
  const liveRuns = useLiveRuns(data.index, inPedidos, data.loadedAt);
  const pedidos = useMemo(
    () => (inPedidos && index ? pedidoRows(index, query, { live: liveRuns, now: filterNow || Date.now() }) : []),
    [inPedidos, index, query, liveRuns, filterNow],
  );

  // Estado de la vista que no va en la URL: grupos plegados, «Ver N más» y árbol de la lista.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [more, setMore] = useState<Readonly<Record<string, number>>>({});
  const [treeClosed, setTreeClosed] = useState<ReadonlySet<string>>(() => new Set());
  const onToggleGroup = useCallback((key: string) => setCollapsed((prev) => toggleIn(prev, key)), []);
  const onMore = useCallback((key: string, next: number) => setMore((prev) => ({ ...prev, [key]: next })), []);
  const onToggleTree = useCallback((id: string) => setTreeClosed((prev) => toggleIn(prev, id)), []);

  // Carriles plegados: en memoria, en este navegador (§3.10).
  const [closedLanes, setClosedLanes] = useState<ReadonlySet<string>>(() => new Set());
  const onToggleLane = useCallback((key: string) => setClosedLanes((prev) => toggleIn(prev, key)), []);
  // Al cambiar `carr` se despliegan todos y vuelven las tarjetas por celda de ese modo (§4.1).
  const onLanes = (next: LaneBy | null) => {
    setClosedLanes(new Set());
    setMore({});
    setQuery({ ...query, lanes: next });
  };
  const onFoldLanes = (fold: boolean) => {
    if (!index || !lanes) return;
    const keys = boardLanes(index, filtered, lanes, columns, pending).map((lane) => laneUiKey(lanes, lane.key));
    setClosedLanes(fold ? new Set(keys) : new Set());
  };
  // Abrir una vista (o «Todo el board», o «Descartar»): vuelve a las tarjetas por celda de siempre.
  const onApplyView = (next: BoardQuery) => {
    setMore({});
    setQuery(next);
  };

  // «+ Crear»: el compositor vive en la página y los puntos de entrada lo abren por contexto.
  const reveal = useCallback(
    (issue: BoardIssue) => {
      const keys = [`bk:${issue.companyId}`, `l:${query.group}:${listGroupKey(issue, query.group)}`];
      setCollapsed((prev) => (keys.some((key) => prev.has(key)) ? new Set([...prev].filter((key) => !keys.includes(key))) : prev));
      if (inBoard) {
        const laneKey = laneUiKey(lanes, lanes ? laneKeyOf(issue, lanes) : FLAT_LANE);
        setClosedLanes((prev) => (prev.has(laneKey) ? new Set([...prev].filter((key) => key !== laneKey)) : prev));
      }
    },
    [query.group, inBoard, lanes],
  );
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!context.userId) void getSessionUserId().then(setSessionUserId);
  }, [context.userId]);
  const userId = context.userId ?? sessionUserId;
  const retryCompany = data.retry;
  const refreshCompany = useCallback((companyId: string) => retryCompany(companyId, true), [retryCompany]);
  const create = useCreateFlow({
    index: index ?? EMPTY_INDEX,
    filters: query.filters,
    userId,
    addIssue: data.addIssue,
    refreshCompany,
    setMark,
    clearMark,
    reveal,
    toast,
  });

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

  // Modal de tarea (JST-408): el clic en una tarjeta o fila la abre aquí, sin salir del Board.
  const [taskId, setTaskId] = useState<string | null>(null);
  const openTask = useCallback(
    (issue: BoardIssue) => {
      onPeek(null);
      setTaskId(issue.id);
    },
    [onPeek],
  );
  const closeTask = useCallback(() => setTaskId(null), []);

  // Bandeja «Paradas» (JST-424): solo respeta el filtro de empresas; su estado no va en la URL.
  const [stalledOpen, setStalledOpen] = useState(false);
  const stalledBtn = useRef<HTMLButtonElement>(null);
  const stalledList = useMemo(() => (index ? stalledGroups(index, query.filters.emp) : []), [index, query.filters.emp]);
  const stalledTotal = stalledCount(stalledList);
  const closeStalled = useCallback(() => {
    setStalledOpen(false);
    stalledBtn.current?.focus();
  }, []);
  useStalledEscape(stalledOpen, closeStalled);

  // Arrastrar y soltar: actualización optimista + PATCH nativo + toast con «Deshacer».
  const [dragging, setDragging] = useState<BoardIssue | null>(null);
  const onDragStart = useCallback((issue: BoardIssue) => setDragging(issue), []);
  const onDragEnd = useCallback(() => setDragging(null), []);

  const idLabel = (issue: BoardIssue) => (
    <b className="gb-mono" style={{ fontWeight: 500 }}>
      {issue.identifier ?? t("La tarea")}
    </b>
  );

  // Confirmar: la tarea sale de «Por confirmar». Para Paperclip ya estaba cerrada, así que no cambia nada allá.
  const { confirm: confirmIds, unconfirm: unconfirmIds } = confirmations;
  const confirmIssues = useCallback(
    async (issues: readonly BoardIssue[]) => {
      if (issues.length === 0) return;
      const ids = issues.map((issue) => issue.id);
      try {
        await confirmIds(ids);
        toast({
          content:
            issues.length === 1
              ? tx("{id} confirmada · queda en {status}", { id: idLabel(issues[0]!), status: STATUS_LABELS[issues[0]!.status] })
              : t("{n} tareas confirmadas", { n: issues.length }),
          action: {
            label: t("Deshacer"),
            run: () =>
              void unconfirmIds(ids).catch((err: Error) => toast({ error: true, content: t("No se pudo deshacer la confirmación: {message}", { message: err.message }) })),
          },
        });
      } catch (err) {
        toast({ error: true, content: t("No se pudo confirmar: {message}", { message: (err as Error).message }) });
      }
    },
    [confirmIds, unconfirmIds, toast],
  );
  const onConfirm = useCallback((issue: BoardIssue) => void confirmIssues([issue]), [confirmIssues]);

  const move = async (issue: BoardIssue, from: IssueStatus, to: IssueStatus, undo: boolean) => {
    const label = issue.identifier ?? t("la tarea");
    // Si la cierra la persona desde el board, no hace falta que después la confirme. Al
    // deshacer una reapertura sí vuelve a «Por confirmar», como estaba.
    const selfClose = !undo && !isOpenStatus(to) && !issue.parentId && confirmations.state !== null;
    if (selfClose) setSelfClosed((prev) => new Set(prev).add(issue.id));
    const settle = () => setSelfClosed((prev) => (prev.has(issue.id) ? new Set([...prev].filter((id) => id !== issue.id)) : prev));
    try {
      const status = await data.moveIssue(issue.id, from, to);
      // Después del cambio de estado: la confirmación tiene que quedar con hora posterior al cierre.
      if (selfClose && status === to) await confirmIds([issue.id]).catch(() => undefined);
      if (selfClose) settle();
      const idNode = (
        <b className="gb-mono" style={{ fontWeight: 500 }}>
          {label}
        </b>
      );
      toast({
        content: (
          <>
            {undo
              ? tx("{id} volvió a {status}", { id: idNode, status: STATUS_LABELS[status] })
              : tx("{id} movida a {status}", { id: idNode, status: STATUS_LABELS[status] })}
          </>
        ),
        action: undo ? undefined : { label: t("Deshacer"), run: () => void move(issue, status, from, true) },
      });
    } catch (err) {
      if (selfClose) settle();
      toast({ error: true, content: undo
          ? t("No se pudo deshacer el cambio de {task}: {message}", { task: label, message: (err as Error).message })
          : t("No se pudo mover {task}: {message}", { task: label, message: (err as Error).message }),
      });
    }
  };
  const onDrop = (status: IssueStatus) => {
    const issue = dragging;
    setDragging(null);
    if (!issue) return;
    // Una tarjeta de «Por confirmar» soltada en la columna de su propio estado: se confirma.
    if (issue.status === status) {
      if (pending.has(issue.id)) void confirmIssues([issue]);
      return;
    }
    void move(issue, issue.status, status, false);
  };
  const onDropConfirm = () => {
    const issue = dragging;
    setDragging(null);
    if (issue && pending.has(issue.id)) void confirmIssues([issue]);
  };
  const onBacklogMove = (issue: BoardIssue, to: IssueStatus) => {
    setDragging(null);
    if (issue.status !== to) void move(issue, issue.status, to, false);
  };

  const refresh = async () => {
    void saved.reload(true);
    void confirmations.reload();
    const result = await data.refresh();
    if (!result) return;
    const seconds = (result.elapsedMs / 1000).toLocaleString(localeTag(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    toast({ content: t("Board actualizado · {companies} en {seconds} s", { companies: plural(result.ok, "empresa", "empresas"), seconds }) });
  };

  const peekIssue = peek && index ? index.byId.get(peek.issueId) : undefined;
  const taskIssue = taskId && index ? index.byId.get(taskId) : undefined;
  const shown = inBoard ? boardIssues : inBacklog ? backlogIssues : filtered;

  return (
    <CreateProvider value={create}>
    <MarksProvider value={marks}>
    <OpenTaskProvider value={openTask}>
    <div ref={rootRef} className="gb" style={{ height }} onScrollCapture={() => onPeek(null)}>
      <Header
        loading={loading}
        companyCount={index?.companies.length ?? data.companies?.length ?? null}
        loadedAt={data.loadedAt}
        now={now}
        refreshing={data.refreshing}
        onRefresh={() => void refresh()}
        view={query.view}
        backlogCount={index ? backlogCount : null}
        onView={(view) => setQuery({ ...query, view })}
      />
      {/* Desde el primer instante, también durante el esqueleto: la página no salta al llegar las vistas (§3.10). */}
      <ViewTabs index={index} query={query} now={now} saved={saved} onApply={onApplyView} toast={toast} />
      <FilterBar index={index} query={query} disabled={loading || !index} onQuery={setQuery} onLanes={onLanes} onFoldLanes={onFoldLanes}
        stalled={{ count: stalledTotal, open: stalledOpen, buttonRef: stalledBtn, onToggle: () => (stalledOpen ? closeStalled() : setStalledOpen(true)) }}
      />
      {index && data.failed.length > 0 ? (
        <PartialErrorBanner failed={data.failed} onRetry={() => data.failed.forEach((load) => void data.retry(load.company.id))} />
      ) : null}
      {index && query.filters.toca && index.tocaAvailable ? (
        <TocaBanner index={index} issues={shown} onShowAll={() => setFilters({ ...query.filters, toca: false })} />
      ) : null}

      {loading ? (
        <BoardSkeleton />
      ) : !index ? (
        <LoadFailed message={data.listError} onRetry={() => void data.refresh()} />
      ) : inPedidos ? (
        pedidos.length === 0 ? (
          <EmptyPedidos query={query} onQuery={setQuery} />
        ) : (
          <PedidosView
            index={index}
            rows={pedidos}
            live={liveRuns}
            now={now}
            userId={userId}
            unfold={query.filters.q.trim().length > 0 || query.filters.est.length > 0}
          />
        )
      ) : shown.length === 0 ? (
        <EmptyResults
          index={index}
          query={query}
          onFilters={setFilters}
          backlogCount={inBoard ? backlogCount : 0}
          onBacklog={() => setQuery({ ...query, view: "backlog" })}
        />
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
      ) : inBacklog ? (
        <BacklogView
          index={index}
          issues={backlogIssues}
          now={now}
          collapsed={collapsed}
          more={more}
          dragging={dragging}
          onToggleGroup={onToggleGroup}
          onMore={onMore}
          onMove={onBacklogMove}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ) : (
        <LaneBoard
          index={index}
          issues={boardIssues}
          query={query}
          laneBy={lanes}
          columns={columns}
          pending={pending}
          closedCount={closedCount}
          more={more}
          closedLanes={closedLanes}
          dragging={dragging}
          onToggleLane={onToggleLane}
          onMore={onMore}
          onShowClosed={() => setQuery({ ...query, showClosed: true })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          onDropConfirm={onDropConfirm}
          onBadDrop={() => toast({ content: badDropMessage(lanes) })}
          onConfirm={onConfirm}
          onConfirmAll={(issues) => void confirmIssues(issues)}
          onPeek={onPeek}
        />
      )}

      {peekIssue && peek && !dragging && !taskIssue ? <Peek index={index!} issue={peekIssue} anchor={peek.rect} now={now} /> : null}
      {taskIssue ? (
        <TaskModal
          index={index!}
          issue={taskIssue}
          now={now}
          userId={userId}
          pending={pending.has(taskIssue.id)}
          onClose={closeTask}
          onOpen={openTask}
          onMove={(issue, to) => void move(issue, issue.status, to, false)}
          onConfirm={onConfirm}
          onCommented={(issue) => void refreshCompany(issue.companyId)}
        />
      ) : null}
      {index && stalledOpen ? <StalledDrawer index={index} groups={stalledList} now={now} onClose={closeStalled} /> : null}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
    </OpenTaskProvider>
    </MarksProvider>
    </CreateProvider>
  );
}

// Segunda página del plugin (JST-13): el Dashboard global.
export { DashboardGlobalPage, DashboardGlobalSidebarLink } from "./dashboard.js";
