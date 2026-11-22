// Modal de tarea (JST-408): la tarea se abre encima del Board, sin salir de la
// página. Muestra lo que el board ya tiene (estado, responsable, árbol) y pide
// la descripción y los comentarios al abrir. Lo demás (documentos, corridas,
// aprobaciones) sigue en la página de la tarea, a un clic.
import { Component, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { MarkdownBlock } from "@paperclipai/plugin-sdk/ui";
import { ancestorsOf, childrenOf, progressOf, projectLabel, relativeTime, sortSubtasks, type BoardIndex } from "../board.js";
import { localeTag, t } from "../i18n.js";
import { ISSUE_STATUSES, isOpenStatus, type BoardIssue, type IssueComment, type IssueDetail, type IssueStatus } from "../shared.js";
import { ASSIGN_SEARCH_FROM, TASK_COMMENTS_LIMIT, assignCandidates, commentAuthor, commentBody, filterCandidates, isAssignedTo, visibleComments, type AssignTarget } from "../task.js";
import { addIssueComment, getIssueDetail, listIssueComments, markIssueRead } from "./bridge.js";
import { WaitNote, hrefFor } from "./card.js";
import {
  Avatar,
  CompanyTag,
  PRIORITY_LABELS,
  PriorityIcon,
  ProgressBar,
  STATUS_LABELS,
  Skeleton,
  StatusIcon,
  TocaPill,
  assigneeName,
  cx,
} from "./common.js";
import { Icon } from "./icons.js";
import { Layer, Popover } from "./layer.js";
import { useOpenTask } from "./open.js";

/** Subtareas que se listan antes de «Ver todas». */
const KIDS_SHOWN = 8;

/** Borradores de comentario por tarea: cerrar el modal sin enviar no pierde lo escrito. */
const drafts = new Map<string, string>();

interface Thread {
  issueId: string;
  detail: IssueDetail | null;
  detailError: string | null;
  comments: IssueComment[] | null;
  commentsError: string | null;
}

const emptyThread = (issueId: string): Thread => ({ issueId, detail: null, detailError: null, comments: null, commentsError: null });

/** Descripción y comentarios de la tarea abierta. Al abrirla queda leída, como en su página. */
function useThread(issueId: string) {
  const [thread, setThread] = useState<Thread>(() => emptyThread(issueId));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const patch = (next: Partial<Thread>) => {
      if (alive) setThread((prev) => (prev.issueId === issueId ? { ...prev, ...next } : prev));
    };
    setThread(emptyThread(issueId));
    getIssueDetail(issueId).then(
      (detail) => patch({ detail }),
      (err: Error) => patch({ detailError: err.message }),
    );
    listIssueComments(issueId, TASK_COMMENTS_LIMIT).then(
      (comments) => patch({ comments }),
      (err: Error) => patch({ commentsError: err.message }),
    );
    void markIssueRead(issueId).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [issueId, attempt]);
  const addComment = useCallback(
    (comment: IssueComment) => setThread((prev) => (prev.issueId === comment.issueId ? { ...prev, comments: [comment, ...(prev.comments ?? [])] } : prev)),
    [],
  );
  // Mientras llega la otra tarea no se muestra la anterior.
  return { thread: thread.issueId === issueId ? thread : emptyThread(issueId), addComment, retry: () => setAttempt((n) => n + 1) };
}

/** Si el renderizador de Markdown del host falla, queda el texto tal cual. */
class MarkdownGuard extends Component<{ text: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="gb-mdplain">{this.props.text}</div> : this.props.children;
  }
}

function Markdown({ text }: { text: string }) {
  return (
    <MarkdownGuard key={text} text={text}>
      <MarkdownBlock content={text} className="gb-md" />
    </MarkdownGuard>
  );
}

/** Alto de la descripción antes de «Mostrar toda»: los comentarios quedan a la vista sin bajar mucho. */
const DESCRIPTION_CLAMP = 260;

function Description({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Con margen: no vale la pena cortar por un par de líneas.
    const measure = () => setLong(el.scrollHeight > DESCRIPTION_CLAMP + 60);
    measure();
    // El renderizador del host puede pintar después del primer pase.
    const timer = window.setTimeout(measure, 300);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [text]);
  return (
    <>
      <div ref={ref} className={cx("gb-taskdesc", long && !open && "is-clamped")} style={long && !open ? { maxHeight: DESCRIPTION_CLAMP } : undefined}>
        <Markdown text={text} />
      </div>
      {long ? (
        <button type="button" className="gb-linkbtn gb-taskmore" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t("Mostrar menos") : t("Mostrar toda la descripción")}
        </button>
      ) : null}
    </>
  );
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(
    (el) => el.offsetParent !== null,
  );
}

export function TaskModal({
  index,
  issue,
  now,
  userId,
  pending,
  onClose,
  onOpen,
  onMove,
  onAssign,
  onConfirm,
  onCommented,
}: {
  index: BoardIndex;
  issue: BoardIssue;
  now: number;
  userId: string | null;
  /** Cerrada y todavía en «Por confirmar». */
  pending: boolean;
  onClose: () => void;
  /** Pasa a otra tarea sin cerrar el modal (la tarea padre, una subtarea, un bloqueador). */
  onOpen: (issue: BoardIssue) => void;
  onMove: (issue: BoardIssue, to: IssueStatus) => void;
  /** Reasigna (JST-429). Resuelve al terminar, con o sin error: el modal solo espera para no mandar dos a la vez. */
  onAssign: (issue: BoardIssue, to: AssignTarget) => Promise<void>;
  onConfirm: (issue: BoardIssue) => void;
  /** Después de comentar: la tarea puede dejar de estar en «Te toca». */
  onCommented: (issue: BoardIssue) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { thread, addComment, retry } = useThread(issue.id);
  const [statusMenu, setStatusMenu] = useState<HTMLElement | null>(null);
  const [assignMenu, setAssignMenu] = useState<HTMLElement | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [allKids, setAllKids] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // El foco entra al modal al abrir y vuelve a donde estaba al cerrar.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus?.();
  }, []);
  // Otra tarea en el mismo modal: arriba de nuevo y con las subtareas recogidas.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    setAllKids(false);
    setStatusMenu(null);
    setAssignMenu(null);
  }, [issue.id]);
  // Esc cierra; si hay un menú abierto encima, ese Esc es del menú.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".gb-layer .gb-menu")) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Tab no sale del modal.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !ref.current) return;
    const items = focusables(ref.current);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === ref.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const company = index.companyById.get(issue.companyId);
  const href = hrefFor(index, issue);
  const mine = userId !== null && !issue.assigneeAgentId && issue.assigneeUserId === userId;
  const who = mine ? t("Tú") : assigneeName(index, issue);
  const ancestors = ancestorsOf(index, issue);
  const kids = useMemo(() => sortSubtasks(index, childrenOf(index, issue)), [index, issue]);
  const progress = progressOf(index, issue);
  const blockers = issue.blockerIds.flatMap((id) => index.byId.get(id) ?? []);
  const waiting = index.waiting.get(issue.id);
  const titleId = `gb-task-${issue.id}`;
  const shownKids = allKids ? kids : kids.slice(0, KIDS_SHOWN);

  return (
    <Layer>
      <div
        className="gb-taskback"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div ref={ref} className="gb-task" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
          <div className="gb-taskhead">
            <CompanyTag company={company} solid />
            <nav className="gb-crumbs" aria-label={t("Tarea y sus tareas padre")}>
              {ancestors.map((ancestor) => (
                <span key={ancestor.id} className="gb-crumb">
                  <button type="button" className="gb-mono" title={ancestor.title} onClick={() => onOpen(ancestor)}>
                    {ancestor.identifier}
                  </button>
                  <Icon name="chevron-right" size={12} />
                </span>
              ))}
              <span className="gb-mono gb-crumb-cur">{issue.identifier}</span>
            </nav>
            <span className="gb-sp" />
            <a className="gb-btn is-sm is-ghost" href={href} title={t("Abrir la página de la tarea, con todo su detalle")}>
              <Icon name="external-link" size={14} />
              <span className="gb-taskfull">{t("Página completa")}</span>
            </a>
            <button type="button" className="gb-btn is-sm is-ghost is-icon" title={t("Cerrar (Esc)")} aria-label={t("Cerrar")} onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          </div>

          <div ref={bodyRef} className="gb-taskbody">
            <div className="gb-taskmain">
              <h2 id={titleId} className="gb-tasktitle">
                {issue.title}
              </h2>
              <WaitNote index={index} issue={issue} now={now}>
                {waiting ? (
                  <a className="gb-tasklink" href={href}>
                    {t("Ir a responder")}
                    <Icon name="chevron-right" size={12} />
                  </a>
                ) : null}
              </WaitNote>

              <section className="gb-tasksec" aria-label={t("Descripción")}>
                <h3>{t("Descripción")}</h3>
                {thread.detail ? (
                  thread.detail.description?.trim() ? (
                    <Description key={issue.id} text={thread.detail.description} />
                  ) : (
                    <p className="gb-muted">{t("Sin descripción.")}</p>
                  )
                ) : thread.detailError ? (
                  <LoadError what={t("la descripción")} message={thread.detailError} onRetry={retry} />
                ) : (
                  <TextSkeleton lines={3} />
                )}
              </section>

              {kids.length > 0 ? (
                <section className="gb-tasksec" aria-label={t("Subtareas")}>
                  <h3>
                    {t("Subtareas")}
                    <span className="gb-taskn gb-tnum">
                      {t("{done}/{total} hechas", { done: progress.done, total: progress.total })}
                    </span>
                    <ProgressBar done={progress.done} total={progress.total} width={64} />
                  </h3>
                  <div className="gb-taskkids">
                    {shownKids.map((kid) => (
                      <KidRow key={kid.id} index={index} issue={kid} />
                    ))}
                  </div>
                  {kids.length > shownKids.length ? (
                    <button type="button" className="gb-linkbtn" onClick={() => setAllKids(true)}>
                      {t("Ver las {n} subtareas", { n: kids.length })}
                    </button>
                  ) : null}
                </section>
              ) : null}

              <section className="gb-tasksec" aria-label={t("Comentarios")}>
                <h3>
                  {t("Comentarios")}
                  {thread.comments ? <span className="gb-taskn gb-tnum">{visibleComments(thread.comments).length}</span> : null}
                </h3>
                <Composer
                  issue={issue}
                  onSent={(comment) => {
                    addComment(comment);
                    onCommented(issue);
                  }}
                />
                {thread.comments ? (
                  <Comments index={index} comments={thread.comments} now={now} userId={userId} href={href} />
                ) : thread.commentsError ? (
                  <LoadError what={t("los comentarios")} message={thread.commentsError} onRetry={retry} />
                ) : (
                  <TextSkeleton lines={2} />
                )}
              </section>
            </div>

            <aside className="gb-taskside" aria-label={t("Detalles")}>
              <div className="gb-taskfield">
                <span>{t("Estado")}</span>
                <button
                  type="button"
                  className={cx("gb-btn is-sm gb-taskstatus", statusMenu && "is-active")}
                  aria-haspopup="menu"
                  aria-expanded={statusMenu !== null}
                  onClick={(event) => setStatusMenu(statusMenu ? null : event.currentTarget)}
                >
                  <StatusIcon status={issue.status} />
                  {STATUS_LABELS[issue.status]}
                  <Icon name="chevron-down" size={12} />
                </button>
              </div>
              {pending ? (
                <button type="button" className="gb-confirm gb-taskconfirm" title={t("Ya la revisé: sale de «Por confirmar» y queda entre las cerradas")} onClick={() => onConfirm(issue)}>
                  <Icon name="check" size={14} />
                  {t("Confirmar")}
                </button>
              ) : null}
              <div className="gb-taskfield">
                <span>{t("Responsable")}</span>
                <button
                  type="button"
                  className={cx("gb-btn is-sm gb-taskstatus", assignMenu && "is-active")}
                  aria-haspopup="menu"
                  aria-expanded={assignMenu !== null}
                  aria-label={t("Cambiar responsable")}
                  aria-busy={assigning}
                  disabled={assigning}
                  onClick={(event) => setAssignMenu(assignMenu ? null : event.currentTarget)}
                >
                  <Avatar name={who} size={18} />
                  <span className="gb-lbl">{who ?? t("Sin asignar")}</span>
                  <Icon name="chevron-down" size={12} />
                </button>
              </div>
              <div className="gb-taskfield">
                <span>{t("Prioridad")}</span>
                <b>
                  <PriorityIcon priority={issue.priority} />
                  {PRIORITY_LABELS[issue.priority]}
                </b>
              </div>
              <div className="gb-taskfield">
                <span>{t("Proyecto")}</span>
                <b>
                  <Icon name="folder" size={14} />
                  {projectLabel(index, issue.projectId)}
                </b>
              </div>
              <div className="gb-taskfield">
                <span>{t("Empresa")}</span>
                <b>{company?.name ?? "—"}</b>
              </div>
              {issue.labels.length > 0 ? (
                <div className="gb-taskfield is-wrap">
                  <span>{t("Etiquetas")}</span>
                  <div className="gb-labels">
                    {issue.labels.map((label) => (
                      <span key={label.id} className="gb-lblpill">
                        <i className="gb-ldot" style={{ "--lc": label.color, width: 6, height: 6 } as CSSProperties} />
                        {label.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {blockers.length > 0 ? (
                <div className="gb-taskfield is-wrap">
                  <span>{t("Bloqueada por")}</span>
                  <div className="gb-taskkids">
                    {blockers.map((blocker) => (
                      <KidRow key={blocker.id} index={index} issue={blocker} />
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="gb-taskdates">
                {thread.detail ? <span>{t("Creada {when}", { when: relativeTime(thread.detail.createdAt, now) })}</span> : null}
                <span>{t("Actualizada {when}", { when: relativeTime(issue.updatedAt, now) })}</span>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {statusMenu ? (
        <Popover anchor={statusMenu} width={200} align="end" label={t("Cambiar estado")} onClose={() => setStatusMenu(null)}>
          <div className="gb-mh">{t("Cambiar estado")}</div>
          {ISSUE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className="gb-mi"
              role="menuitemradio"
              aria-checked={status === issue.status}
              onClick={() => {
                setStatusMenu(null);
                if (status !== issue.status) onMove(issue, status);
              }}
            >
              <StatusIcon status={status} />
              <span className="gb-lbl">{STATUS_LABELS[status]}</span>
              {status === issue.status ? <Icon name="check" size={14} /> : null}
            </button>
          ))}
        </Popover>
      ) : null}
      {assignMenu ? (
        <AssignMenu
          anchor={assignMenu}
          index={index}
          issue={issue}
          userId={userId}
          onClose={() => {
            setAssignMenu(null);
            assignMenu.focus();
          }}
          onPick={(target) => {
            setAssignMenu(null);
            assignMenu.focus();
            if (isAssignedTo(issue, target) || assigning) return;
            setAssigning(true);
            void onAssign(issue, target).finally(() => setAssigning(false));
          }}
        />
      ) : null}
    </Layer>
  );
}

/** Menú de responsable (JST-429): «Yo», «Sin asignar» y los agentes de la empresa de la tarea; con búsqueda si son muchos. */
function AssignMenu({
  anchor,
  index,
  issue,
  userId,
  onClose,
  onPick,
}: {
  anchor: HTMLElement;
  index: BoardIndex;
  issue: BoardIssue;
  userId: string | null;
  onClose: () => void;
  onPick: (target: AssignTarget) => void;
}) {
  const [search, setSearch] = useState("");
  const candidates = useMemo(() => assignCandidates(index, issue), [index, issue.companyId, issue.assigneeAgentId]);
  const visible = filterCandidates(candidates, search);
  const row = (target: AssignTarget, key: string, name: string | null, label: string, note?: string) => {
    const on = isAssignedTo(issue, target);
    return (
      <button key={key} type="button" className="gb-mi" role="menuitemradio" aria-checked={on} onClick={() => onPick(target)}>
        <Avatar name={name} size={18} />
        <span className="gb-lbl">{label}</span>
        {note ? <span className="gb-muted">{note}</span> : null}
        {on ? <Icon name="check" size={14} /> : null}
      </button>
    );
  };
  return (
    <Popover anchor={anchor} width={240} align="end" label={t("Cambiar responsable")} onClose={onClose}>
      <div className="gb-mh">{t("Cambiar responsable")}</div>
      {candidates.length > ASSIGN_SEARCH_FROM ? (
        <div className="gb-ms">
          <Icon name="search" size={14} />
          <input autoFocus value={search} placeholder={t("Buscar agente…")} aria-label={t("Buscar agente")} onChange={(event) => setSearch(event.target.value)} />
        </div>
      ) : null}
      {userId ? row({ kind: "user", id: userId }, "yo", t("Yo"), t("Yo")) : null}
      {row({ kind: "none" }, "none", null, t("Sin asignar"))}
      <div className="gb-scroll">
        {visible.map((agent) => row({ kind: "agent", id: agent.id }, agent.id, agent.name, agent.name, agent.paused ? t("en pausa") : undefined))}
        {visible.length === 0 && search ? <div className="gb-mh">{t("Sin coincidencias")}</div> : null}
      </div>
    </Popover>
  );
}

/** Otra tarea dentro del modal (subtarea o bloqueador): el clic la abre aquí mismo; con Ctrl o ⌘, su página. */
function KidRow({ index, issue }: { index: BoardIndex; issue: BoardIssue }) {
  const openTask = useOpenTask();
  const who = assigneeName(index, issue);
  return (
    <a
      className={cx("gb-taskkid", !isOpenStatus(issue.status) && "is-closed")}
      href={hrefFor(index, issue)}
      title={t("{status} · {title}", { status: STATUS_LABELS[issue.status], title: issue.title })}
      onClick={openTask.link(issue)}
    >
      <StatusIcon status={issue.status} size={12} />
      <span className="gb-mono gb-tid">{issue.identifier}</span>
      <span className="gb-tt">{issue.title}</span>
      {index.waiting.has(issue.id) ? <TocaPill small iconOnly /> : null}
      <Avatar name={who} size={16} />
    </a>
  );
}

function Composer({ issue, onSent }: { issue: BoardIssue; onSent: (comment: IssueComment) => void }) {
  const [draft, setDraft] = useState(() => drafts.get(issue.id) ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(drafts.get(issue.id) ?? "");
    setError(null);
  }, [issue.id]);
  const write = (text: string) => {
    setDraft(text);
    if (text) drafts.set(issue.id, text);
    else drafts.delete(issue.id);
  };
  const body = commentBody(draft);
  const send = async () => {
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const comment = await addIssueComment(issue.id, body);
      write("");
      onSent(comment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="gb-taskcomp">
      <textarea
        value={draft}
        rows={draft.includes("\n") || draft.length > 90 ? 4 : 2}
        placeholder={t("Escribe un comentario…")}
        aria-label={t("Comentario para {task}", { task: issue.identifier ?? t("la tarea") })}
        disabled={sending}
        onChange={(event) => write(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void send();
          }
        }}
      />
      <div className="gb-taskcompfoot">
        {error ? (
          <span className="gb-taskerr" role="alert">
            {t("No se pudo comentar: {message}", { message: error })}
          </span>
        ) : (
          <span className="gb-muted">{t("Acepta Markdown · Ctrl o ⌘ + Enter para enviar")}</span>
        )}
        <span className="gb-sp" />
        <button type="button" className="gb-btn is-sm is-primary" disabled={!body || sending} onClick={() => void send()}>
          {sending ? t("Enviando…") : t("Comentar")}
        </button>
      </div>
    </div>
  );
}

function Comments({ index, comments, now, userId, href }: { index: BoardIndex; comments: IssueComment[]; now: number; userId: string | null; href: string }) {
  const shown = useMemo(() => visibleComments(comments), [comments]);
  if (shown.length === 0) return <p className="gb-muted gb-tasknone">{t("Todavía no hay comentarios.")}</p>;
  return (
    <div className="gb-taskcomments">
      {shown.map((comment) => {
        const author = commentAuthor(index, comment, userId);
        return (
          <article key={comment.id} className={cx("gb-taskcomment", author.self && "is-self")}>
            <Avatar name={author.name} size={24} />
            <div className="gb-taskcbody">
              <div className="gb-taskchead">
                <b>{author.name}</b>
                {author.agent ? <Icon name="bot" size={12} /> : null}
                <span className="gb-muted" title={new Date(comment.createdAt).toLocaleString(localeTag())}>
                  {relativeTime(comment.createdAt, now)}
                </span>
              </div>
              <Markdown text={comment.body} />
            </div>
          </article>
        );
      })}
      {comments.length >= TASK_COMMENTS_LIMIT ? (
        <a className="gb-tasklink" href={href}>
          {t("Los comentarios anteriores están en la página de la tarea")}
          <Icon name="chevron-right" size={12} />
        </a>
      ) : null}
    </div>
  );
}

function TextSkeleton({ lines }: { lines: number }) {
  return (
    <div className="gb-taskskel" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} height={12} />
      ))}
    </div>
  );
}

function LoadError({ what, message, onRetry }: { what: string; message: string; onRetry: () => void }) {
  return (
    <p className="gb-taskerr" role="alert">
      {t("No se pudo cargar {what}: {message}.", { what, message })}{" "}
      <button type="button" className="gb-linkbtn" onClick={onRetry}>
        {t("Reintentar")}
      </button>
    </p>
  );
}
