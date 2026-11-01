// «+ Crear tarea» (JST-333 design-spec, opción A · En línea): el botón al pie de
// la columna, la celda del carril y el grupo de la lista, el botón de la
// cabecera y el compositor que se abre en el mismo lugar. La lógica de valores
// por defecto y de la petición está en `../create.ts`.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { matchesFilters, issueHref, type BoardFilters, type BoardIndex } from "../board.js";
import {
  CREATE_STATUSES,
  afterCreate,
  buildCreateRequest,
  canCreateIn,
  defaultDraft,
  draftProblem,
  originKey,
  submitCreate,
  withCompany,
  withStatus,
  withoutAgent,
  wakesAgent,
  type Assignee,
  type CreateDraft,
  type CreateOrigin,
  type FromSource,
  type NewMark,
} from "../create.js";
import type { BoardIssue, IssuePriority } from "../shared.js";
import { createIssue } from "./bridge.js";
import {
  Avatar,
  CompanyTag,
  PRIORITY_LABELS,
  PriorityIcon,
  STATUS_LABELS,
  StatusIcon,
  companyClass,
  companyStyle,
  cx,
  openHref,
} from "./common.js";
import { Icon } from "./icons.js";
import { Layer, Popover, type ToastInput } from "./layer.js";

// ---------------------------------------------------------------------------
// Marcas «Nueva» y «Ya existe» (§7): en memoria, hasta el próximo «Actualizar»
// ---------------------------------------------------------------------------

const NO_MARKS: ReadonlyMap<string, NewMark> = new Map();
const MarksContext = createContext<ReadonlyMap<string, NewMark>>(NO_MARKS);
export const MarksProvider = MarksContext.Provider;

export function useMark(issueId: string): NewMark | undefined {
  return useContext(MarksContext).get(issueId);
}

/** Las marcas se borran al recargar el board (`resetKey` = hora de la última carga). */
export function useMarks(resetKey: unknown) {
  const [marks, setMarks] = useState<ReadonlyMap<string, NewMark>>(NO_MARKS);
  useEffect(() => setMarks(NO_MARKS), [resetKey]);
  const set = useCallback((id: string, mark: NewMark) => setMarks((prev) => new Map(prev).set(id, mark)), []);
  const clear = useCallback(
    (id: string) =>
      setMarks((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      }),
    [],
  );
  return { marks, set, clear };
}

/** Anillo y pastilla de la tarjeta o fila marcada. */
export function markClass(mark: NewMark | undefined): string | false {
  return mark ? (mark.kind === "new" ? "is-new" : "is-dup") : false;
}

export function MarkPill({ mark }: { mark: NewMark | undefined }) {
  if (!mark) return null;
  if (mark.kind === "dup") return <span className="gb-cr-newpill is-dup">Ya existe</span>;
  return mark.outside ? (
    <span className="gb-cr-newpill is-out" title="No calza con los filtros activos: se va al actualizar">
      Nueva · fuera del filtro
    </span>
  ) : (
    <span className="gb-cr-newpill">Nueva</span>
  );
}

// ---------------------------------------------------------------------------
// Estado del compositor: uno solo abierto a la vez (§6)
// ---------------------------------------------------------------------------

type Message = { kind: "error"; text: string } | { kind: "dup"; issue: BoardIssue };

interface Session {
  origin: CreateOrigin;
  draft: CreateDraft;
  message: Message | null;
  sending: boolean;
  /** Sube cada vez que Enter pide la empresa que falta. */
  nudge: number;
  /** Botón de la cabecera, ancla del compositor flotante. */
  anchor: HTMLElement | null;
}

export interface CreateApi {
  session: Session | null;
  index: BoardIndex;
  userId: string | null;
  open: (origin: CreateOrigin, anchor?: HTMLElement | null) => void;
  close: () => void;
  edit: (change: (draft: CreateDraft) => CreateDraft) => void;
  setTitle: (title: string) => void;
  submit: (allowDuplicate?: boolean) => void;
}

const CreateContext = createContext<CreateApi | null>(null);
export const CreateProvider = CreateContext.Provider;
const useCreate = () => useContext(CreateContext);

export function useCreateFlow({
  index,
  filters,
  userId,
  addIssue,
  refreshCompany,
  setMark,
  clearMark,
  reveal,
  toast,
}: {
  index: BoardIndex;
  filters: BoardFilters;
  userId: string | null;
  addIssue: (issue: BoardIssue) => void;
  /** Recarga solo esa empresa, sin vaciarla mientras carga. */
  refreshCompany: (companyId: string) => Promise<unknown>;
  setMark: (id: string, mark: NewMark) => void;
  clearMark: (id: string) => void;
  /** Despliega el grupo, carril o columna donde cae la tarea. */
  reveal: (issue: BoardIssue) => void;
  toast: (toast: ToastInput) => void;
}): CreateApi {
  const [session, setSession] = useState<Session | null>(null);
  const live = useRef({ session, index, filters, userId });
  live.current = { session, index, filters, userId };

  const open = useCallback((origin: CreateOrigin, anchor: HTMLElement | null = null) => {
    setSession((prev) => {
      const same = prev && originKey(prev.origin) === originKey(origin);
      if (same) return origin.surface === "head" ? null : prev;
      const { index: idx, filters: f, userId: uid } = live.current;
      // Al moverse a otro «+», el título se conserva y los valores se recalculan (§6).
      return { origin, draft: defaultDraft(origin, { index: idx, filters: f, userId: uid }, prev?.draft.title ?? ""), message: null, sending: false, nudge: 0, anchor };
    });
  }, []);

  const close = useCallback(() => setSession(null), []);
  const patch = useCallback((change: Partial<Session>) => setSession((prev) => (prev ? { ...prev, ...change } : prev)), []);
  const edit = useCallback(
    (change: (draft: CreateDraft) => CreateDraft) => setSession((prev) => (prev ? { ...prev, draft: change(prev.draft) } : prev)),
    [],
  );

  const setTitle = useCallback(
    (title: string) =>
      setSession((prev) => {
        if (!prev) return prev;
        // Editar el título quita el aviso y la marca de «Ya existe» (§7).
        if (prev.message?.kind === "dup") clearMark(prev.message.issue.id);
        return { ...prev, draft: { ...prev.draft, title }, message: prev.message?.kind === "dup" ? null : prev.message };
      }),
    [clearMark],
  );

  const submit = useCallback(
    async (allowDuplicate = false) => {
      const { session: current, index: idx, filters: f, userId: uid } = live.current;
      if (!current || current.sending) return;
      const problem = draftProblem(current.draft);
      if (problem === "company") return patch({ nudge: current.nudge + 1 });
      if (problem === "title") return;
      if (problem === "assignee") return patch({ message: { kind: "error", text: "En curso necesita responsable" } });

      const draft = current.draft;
      const request = buildCreateRequest(draft, { idempotencyKey: crypto.randomUUID(), allowDuplicate });
      patch({ sending: true, message: null });
      try {
        const outcome = await submitCreate(request, { create: createIssue, insert: addIssue, refresh: refreshCompany });
        const { issue } = outcome;
        if (outcome.kind === "duplicate") {
          setMark(issue.id, { kind: "dup" });
          patch({ sending: false, message: { kind: "dup", issue } });
          scrollToIssue(issue.id);
          return;
        }
        const company = idx.companyById.get(issue.companyId);
        const hiddenCompany = f.emp.length > 0 && !!company && !f.emp.includes(company.prefix);
        const outside = hiddenCompany || !matchesFilters(idx, issue, f);
        setMark(issue.id, { kind: "new", outside });
        reveal(issue);
        const agent = draft.assignee?.kind === "agent" ? idx.agentById.get(draft.assignee.id)?.name : undefined;
        toast({
          content: (
            <>
              <b className="gb-mono" style={{ fontWeight: 500 }}>
                {issue.identifier}
              </b>{" "}
              creada en {STATUS_LABELS[issue.status]}
              {agent && wakesAgent(draft) ? ` · ${agent} ya empezó` : ""}
              {hiddenCompany ? " · no se ve con el filtro actual" : ""}
            </>
          ),
          action: { label: "Abrir ↗", run: () => openHref(issueHref(idx, issue)) },
        });
        setSession((prev) => (prev ? { ...prev, draft: afterCreate(prev.draft, uid), sending: false, message: null } : prev));
        scrollToIssue(issue.id);
      } catch (err) {
        patch({ sending: false, message: { kind: "error", text: (err as Error).message } });
      }
    },
    [addIssue, patch, refreshCompany, reveal, setMark, toast],
  );

  // Clic fuera: sin texto cierra; con texto queda abierto para no perder lo escrito (§6).
  const isOpen = session !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-cr], .gb-layer")) return;
      if (!live.current.session?.draft.title.trim()) setSession(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  return useMemo(() => ({ session, index, userId, open, close, edit, setTitle, submit }), [session, index, userId, open, close, edit, setTitle, submit]);
}

/** Después de pintar la tarea nueva, hace scroll hasta ella (§7.4). */
function scrollToIssue(id: string) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.querySelector(`[data-iid="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" })),
  );
}

// ---------------------------------------------------------------------------
// Puntos de entrada (§3.1–3.4)
// ---------------------------------------------------------------------------

/** El «+ Crear» de una columna o celda, o la fila de un grupo de la lista; se vuelve compositor al abrirlo. */
export function CreateSlot({ origin, groupLabel }: { origin: CreateOrigin; groupLabel?: string }) {
  const api = useCreate();
  if (!api || !canCreateIn(origin.status)) return null;
  const isOpen = !!api.session && originKey(api.session.origin) === originKey(origin);

  if (origin.surface === "group") {
    return isOpen ? (
      <div className="gb-cr-listwrap" data-cr>
        <Composer origin={origin} />
      </div>
    ) : (
      <button type="button" className="gb-cr-addrow" data-cr onClick={() => api.open(origin)}>
        <Icon name="plus" size={14} />
        <span>
          Nueva tarea en <b>{groupLabel}</b>
        </span>
      </button>
    );
  }
  if (origin.surface === "cell") {
    return isOpen ? (
      <Composer origin={origin} />
    ) : (
      <button type="button" className="gb-cr-add is-sm" data-cr onClick={() => api.open(origin)}>
        <Icon name="plus" size={14} />
        Crear
      </button>
    );
  }
  return (
    <div className={cx("gb-cr-foot", isOpen && "is-open")}>
      {isOpen ? (
        <Composer origin={origin} />
      ) : (
        <button type="button" className="gb-cr-add" data-cr onClick={() => api.open(origin)}>
          <Icon name="plus" size={14} />
          Crear
        </button>
      )}
    </div>
  );
}

const HEAD_ORIGIN: CreateOrigin = { surface: "head", status: "todo" };

/** Botón primario de la cabecera y su compositor flotante (§3.4). */
export function CreateHeadButton({ disabled }: { disabled: boolean }) {
  const api = useCreate();
  if (!api) return null;
  const isOpen = !!api.session && api.session.origin.surface === "head";
  return (
    <>
      <button
        type="button"
        className="gb-btn gb-cr-headbtn"
        data-cr
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={(event) => api.open(HEAD_ORIGIN, event.currentTarget)}
      >
        <Icon name="plus" size={14} />
        <span className="gb-cr-long">Crear tarea</span>
        <span className="gb-cr-short">Crear</span>
      </button>
      {isOpen && api.session?.anchor ? <HeadPop anchor={api.session.anchor} /> : null}
    </>
  );
}

function HeadPop({ anchor }: { anchor: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const width = ref.current?.offsetWidth ?? 420;
    setPos({ left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top: rect.bottom + 8 });
  }, [anchor]);
  return (
    <Layer>
      <div ref={ref} className="gb-cr-pop" data-cr role="dialog" aria-label="Crear tarea" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
        <Composer origin={HEAD_ORIGIN} />
      </div>
    </Layer>
  );
}

// ---------------------------------------------------------------------------
// Compositor (§3.5)
// ---------------------------------------------------------------------------

type MenuKind = "company" | "status" | "project" | "assignee" | "priority";

const SOURCE_TITLE: Record<FromSource, string> = { filtro: "Puesto por el filtro", carril: "Puesto por el carril", grupo: "Puesto por el grupo" };

function Chip({
  menuOpen,
  className,
  title,
  disabled,
  from,
  onOpen,
  children,
}: {
  menuOpen: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  from?: FromSource;
  onOpen: (anchor: HTMLElement) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx("gb-cr-chip", className)}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      disabled={disabled}
      title={from ? SOURCE_TITLE[from] : title}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      {from ? <Icon name="funnel" size={12} /> : null}
      {children}
      <span className="gb-cr-chev">
        <Icon name="chevron-down" size={12} />
      </span>
    </button>
  );
}

function Pick({ on, disabled, right, onPick, children }: { on: boolean; disabled?: boolean; right?: string; onPick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="gb-mi" role="menuitemradio" aria-checked={on} disabled={disabled} onClick={onPick}>
      <span className="gb-cr-ck">{on ? <Icon name="check" size={14} /> : null}</span>
      {children}
      {right ? <span className="gb-n">{right}</span> : null}
    </button>
  );
}

function Composer({ origin }: { origin: CreateOrigin }) {
  const api = useCreate()!;
  const { session, index, userId } = api;
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState<{ kind: MenuKind; anchor: HTMLElement } | null>(null);
  const { draft, message, sending, nudge } = session!;
  const named = origin.surface === "group" || origin.surface === "head";
  const compact = origin.surface === "column" || origin.surface === "cell";
  const showStatus = named;
  const company = draft.companyId ? index.companyById.get(draft.companyId) : undefined;
  const project = draft.projectId ? index.projectById.get(draft.projectId) : undefined;
  const agent = draft.assignee?.kind === "agent" ? index.agentById.get(draft.assignee.id) : undefined;
  const wakes = wakesAgent(draft);

  const focusTitle = useCallback(() => titleRef.current?.focus({ preventScroll: true }), []);

  // Al abrir (o moverse a otro «+»): foco en el título y a la vista (§6).
  useLayoutEffect(() => {
    focusTitle();
    const narrow = window.matchMedia("(max-width: 640px)").matches;
    if (origin.surface !== "head") rootRef.current?.scrollIntoView({ block: "nearest", inline: narrow ? "center" : "nearest" });
  }, [focusTitle, origin.surface]);

  const companyRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nudge > 0) companyRow.current?.querySelector<HTMLElement>("[role=radio]")?.focus();
  }, [nudge]);
  useEffect(() => {
    if (message?.kind === "error") focusTitle();
  }, [message, focusTitle]);

  const pick = (change: (d: CreateDraft) => CreateDraft) => {
    api.edit(change);
    setMenu(null);
    focusTitle();
  };
  const openMenu = (kind: MenuKind) => (anchor: HTMLElement) => setMenu((current) => (current?.kind === kind ? null : { kind, anchor }));

  const onTitleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      api.submit();
    }
  };
  const onRootKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // Con un menú abierto, Esc cierra solo el menú (lo hace el popover).
    if (event.key === "Escape" && !menu) {
      event.stopPropagation();
      api.close();
    }
  };

  const projects = useMemo(
    () => [...index.projectById.values()].filter((p) => p.companyId === draft.companyId).sort((a, b) => a.name.localeCompare(b.name, "es")),
    [index, draft.companyId],
  );
  const agents = useMemo(
    () => [...index.agentById.values()].filter((a) => a.companyId === draft.companyId).sort((a, b) => a.name.localeCompare(b.name, "es")),
    [index, draft.companyId],
  );
  const needsCompany = !draft.companyId;
  const noCompanyTitle = "Elige primero la empresa";
  const canSelf = !!userId;
  const inProgress = draft.status === "in_progress";
  const selfAssigned = draft.assignee?.kind === "user";

  const assigneeChip =
    draft.assignee?.kind === "agent" ? (
      <>
        <Avatar name={agent?.name ?? "Agente"} size={16} />
        <span className="gb-cr-v">{agent?.name ?? "Agente"}</span>
      </>
    ) : draft.assignee?.kind === "user" ? (
      <>
        <Avatar name="Yo" size={16} />
        <span className="gb-cr-v">Yo</span>
      </>
    ) : (
      <>
        <Avatar name={null} size={16} />
        <span className="gb-cr-v gb-muted">Sin responsable</span>
      </>
    );

  const submitLabel = sending ? "Creando…" : wakes ? "Crear y asignar" : "Crear";

  return (
    <div
      ref={rootRef}
      className={cx("gb-cr-comp", `is-${origin.surface}`)}
      data-cr
      onKeyDown={onRootKey}
      style={company ? companyStyle(company) : undefined}
    >
      <textarea
        ref={titleRef}
        className="gb-cr-title"
        rows={2}
        value={draft.title}
        placeholder="¿Qué hay que hacer?"
        aria-label="Título de la tarea nueva"
        onChange={(event) => api.setTitle(event.target.value)}
        onKeyDown={onTitleKey}
      />

      {needsCompany ? (
        <div ref={companyRow} key={nudge} className={cx("gb-cr-corow", nudge > 0 && "is-nudge")}>
          <span className="gb-cr-colabel">{nudge > 0 ? "⚠ Elige la empresa para crearla" : "¿En qué empresa?"}</span>
          <div className="gb-cr-cos" role="radiogroup" aria-label="Empresa">
            {index.companies.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={false}
                className={cx("gb-cr-co", companyClass(c))}
                style={companyStyle(c)}
                title={c.name}
                aria-label={c.name}
                onClick={() => pick((d) => withCompany(d, c.id, index))}
              >
                <CompanyTag company={c} solid />
                {named ? <span>{c.name}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="gb-cr-chips">
        {company ? (
          <Chip menuOpen={menu?.kind === "company"} from={draft.from.company} onOpen={openMenu("company")} title="Empresa">
            <CompanyTag company={company} solid />
            {compact ? <span className="gb-sr">{company.name}</span> : <span className="gb-cr-v">{company.name}</span>}
          </Chip>
        ) : null}
        {showStatus ? (
          <Chip menuOpen={menu?.kind === "status"} onOpen={openMenu("status")} title="Estado">
            <StatusIcon status={draft.status} size={12} />
            <span className="gb-cr-v">{STATUS_LABELS[draft.status]}</span>
          </Chip>
        ) : null}
        <Chip
          menuOpen={menu?.kind === "project"}
          from={draft.from.project}
          disabled={needsCompany}
          title={needsCompany ? noCompanyTitle : "Proyecto"}
          onOpen={openMenu("project")}
        >
          <Icon name="folder" size={12} />
          <span className={cx("gb-cr-v", !project && "gb-muted")}>{project?.name ?? "Sin proyecto"}</span>
        </Chip>
        <Chip
          menuOpen={menu?.kind === "assignee"}
          className={cx(draft.assignee?.kind === "agent" && (wakes ? "is-agent" : "is-quiet"))}
          from={draft.from.assignee}
          disabled={needsCompany}
          title={needsCompany ? noCompanyTitle : "Responsable"}
          onOpen={openMenu("assignee")}
        >
          {assigneeChip}
        </Chip>
        <Chip menuOpen={menu?.kind === "priority"} from={draft.from.priority} onOpen={openMenu("priority")} title="Prioridad">
          <PriorityIcon priority={draft.priority} size={12} muted={draft.priority === "medium"} />
          {compact ? (
            <span className="gb-sr">Prioridad: {PRIORITY_LABELS[draft.priority]}</span>
          ) : (
            <span className={cx("gb-cr-v", draft.priority === "medium" && "gb-muted")}>{PRIORITY_LABELS[draft.priority]}</span>
          )}
        </Chip>
      </div>

      {message?.kind === "error" ? (
        <div className="gb-cr-err" role="alert">
          <Icon name="circle-alert" size={14} />
          <span>
            No se pudo crear: {message.text}. Tu texto sigue aquí.{" "}
            <button type="button" className="gb-cr-lk" onClick={() => api.submit()}>
              Reintentar
            </button>
          </span>
        </div>
      ) : message?.kind === "dup" ? (
        <div className="gb-cr-dup" role="note">
          <Icon name="circle-alert" size={14} />
          <span>
            Ya existe <b className="gb-mono">{message.issue.identifier}</b> con este título en {index.companyById.get(message.issue.companyId)?.name ?? "la empresa"} (
            {STATUS_LABELS[message.issue.status]}). No se creó otra.{" "}
            <a className="gb-cr-lk" href={issueHref(index, message.issue)}>
              Abrir {message.issue.identifier}
            </a>{" "}
            <button type="button" className="gb-cr-lk" onClick={() => api.submit(true)}>
              Crear igual
            </button>
          </span>
        </div>
      ) : draft.assignee?.kind === "agent" ? (
        <div className={cx("gb-cr-warn", !wakes && "is-quiet")} role="note">
          <Icon name={wakes ? "zap" : "clock"} size={12} />
          <span>
            {wakes ? (
              <>
                <b>{agent?.name}</b> empieza a trabajar apenas la crees.
              </>
            ) : (
              <>
                Queda asignada a <b>{agent?.name}</b>. En Backlog no lo despierta: empieza al pasarla a Por hacer.
              </>
            )}
            {draft.from.assignee ? <span className="gb-muted"> Viene del {draft.from.assignee}.</span> : null}{" "}
            <button type="button" className="gb-cr-lk" onClick={() => api.edit((d) => withoutAgent(d, userId))}>
              Quitar
            </button>
          </span>
        </div>
      ) : inProgress && selfAssigned ? (
        <div className="gb-cr-note" role="note">
          <Icon name="user" size={12} />
          <span>En curso necesita responsable: quedas tú. No despierta a nadie.</span>
        </div>
      ) : null}

      <div className="gb-cr-footrow">
        {origin.surface === "cell" ? null : (
          <span className="gb-cr-keys">
            <kbd>Enter</kbd> crea · <kbd>Esc</kbd> {draft.title.trim() ? "descarta" : "cierra"}
          </span>
        )}
        <button type="button" className={cx("gb-cr-go", sending && "is-busy")} disabled={sending} onClick={() => api.submit()}>
          {sending ? <Icon name="loader" size={12} /> : null}
          {submitLabel}
        </button>
      </div>

      {menu ? (
        <Popover anchor={menu.anchor} width={menu.kind === "assignee" ? 300 : undefined} label={menuLabel(menu.kind)} onClose={() => setMenu(null)}>
          {menu.kind === "company"
            ? index.companies.map((c) => (
                <Pick key={c.id} on={c.id === draft.companyId} onPick={() => pick((d) => withCompany(d, c.id, index))}>
                  <CompanyTag company={c} solid />
                  <span className="gb-lbl">{c.name}</span>
                </Pick>
              ))
            : menu.kind === "status"
              ? CREATE_STATUSES.map((status) => (
                  <Pick key={status} on={status === draft.status} onPick={() => pick((d) => withStatus(d, status, userId))}>
                    <StatusIcon status={status} />
                    <span className="gb-lbl">{STATUS_LABELS[status]}</span>
                  </Pick>
                ))
              : menu.kind === "priority"
                ? (["critical", "high", "medium", "low"] as IssuePriority[]).map((priority) => (
                    <Pick key={priority} on={priority === draft.priority} onPick={() => pick((d) => ({ ...d, priority, from: { ...d.from, priority: undefined } }))}>
                      <PriorityIcon priority={priority} />
                      <span className="gb-lbl">{PRIORITY_LABELS[priority]}</span>
                    </Pick>
                  ))
                : menu.kind === "project"
                  ? (
                      <div className="gb-scroll">
                        <Pick on={!draft.projectId} onPick={() => pick((d) => ({ ...d, projectId: null, from: { ...d.from, project: undefined } }))}>
                          <Icon name="folder" size={14} />
                          <span className="gb-lbl gb-muted">Sin proyecto</span>
                        </Pick>
                        {projects.map((p) => (
                          <Pick key={p.id} on={p.id === draft.projectId} onPick={() => pick((d) => ({ ...d, projectId: p.id, from: { ...d.from, project: undefined } }))}>
                            <Icon name="folder" size={14} />
                            <span className="gb-lbl">{p.name}</span>
                          </Pick>
                        ))}
                      </div>
                    )
                  : (
                      <AssigneeMenu
                        inProgress={inProgress}
                        wakesNote={draft.status !== "backlog"}
                        canSelf={canSelf}
                        current={draft.assignee}
                        agents={agents}
                        onPick={(assignee) => pick((d) => ({ ...d, assignee, from: { ...d.from, assignee: undefined } }))}
                        userId={userId}
                      />
                    )}
        </Popover>
      ) : null}
    </div>
  );
}

function menuLabel(kind: MenuKind): string {
  return { company: "Empresa", status: "Estado", project: "Proyecto", assignee: "Responsable", priority: "Prioridad" }[kind];
}

/** Menú de responsable (§5): «Sin responsable», «Yo», la nota de que despierta y los agentes. */
function AssigneeMenu({
  inProgress,
  wakesNote,
  canSelf,
  current,
  agents,
  userId,
  onPick,
}: {
  inProgress: boolean;
  wakesNote: boolean;
  canSelf: boolean;
  current: Assignee | null;
  agents: Array<{ id: string; name: string }>;
  userId: string | null;
  onPick: (assignee: Assignee | null) => void;
}) {
  return (
    <>
      <Pick on={!current} disabled={inProgress} right={inProgress ? "no en En curso" : undefined} onPick={() => onPick(null)}>
        <Avatar name={null} size={18} />
        <span className="gb-lbl">Sin responsable</span>
      </Pick>
      {canSelf ? (
        <Pick on={current?.kind === "user"} right="no despierta a nadie" onPick={() => onPick({ kind: "user", id: userId! })}>
          <Avatar name="Yo" size={18} />
          <span className="gb-lbl">Yo</span>
        </Pick>
      ) : null}
      <div className="gb-cr-mnote">
        <Icon name="zap" size={12} />
        <span>
          {wakesNote
            ? "Asignar a un agente lo despierta: empieza a trabajar apenas se crea la tarea."
            : "En Backlog, asignar a un agente no lo despierta: empieza cuando la tarea pasa a Por hacer."}
        </span>
      </div>
      <div className="gb-scroll">
        {agents.map((a) => (
          <Pick key={a.id} on={current?.kind === "agent" && current.id === a.id} onPick={() => onPick({ kind: "agent", id: a.id })}>
            <Avatar name={a.name} size={18} />
            <span className="gb-lbl">{a.name}</span>
          </Pick>
        ))}
      </div>
    </>
  );
}
