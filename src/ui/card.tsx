// Tarjeta del Board (JST-407, sobre §3.7): título primero, la línea «Te toca»
// (§3.9), un chip de contexto y un pie con lo mínimo. Las subtareas se ven en
// la vista previa al pasar (§3.10), no dentro de la tarjeta.
import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import {
  WAIT_LABELS,
  ancestorsOf,
  childrenOf,
  dependentsOf,
  issueHref,
  progressOf,
  projectLabel,
  relativeTime,
  sortSubtasks,
  waitBlockerOf,
  type BoardIndex,
} from "../board.js";
import { t } from "../i18n.js";
import { tx } from "./i18n.js";
import { isOpenStatus, type BoardIssue } from "../shared.js";
import {
  Avatar,
  CompanyTag,
  PRIORITY_LABELS,
  PriorityIcon,
  ProgressBar,
  STATUS_LABELS,
  StatusIcon,
  TocaPill,
  assigneeName,
  companyClass,
  companyStyle,
  cx,
} from "./common.js";
import { MarkPill, markClass, useMark } from "./create.js";
import { Icon } from "./icons.js";
import { Layer } from "./layer.js";
import { useOpenTask } from "./open.js";

export function hrefFor(index: BoardIndex, issue: BoardIssue): string {
  return index.waiting.get(issue.id)?.href ?? issueHref(index, issue);
}

function WaitLine({ index, issue }: { index: BoardIndex; issue: BoardIssue }) {
  const waiting = index.waiting.get(issue.id);
  if (waiting) {
    return (
      <div className="gb-wait-line" title={`${WAIT_LABELS[waiting.kind]}: ${waiting.what}`}>
        <TocaPill />
        <span className="gb-what">{waiting.what}</span>
      </div>
    );
  }
  const blocker = waitBlockerOf(index, issue);
  if (!blocker) return null;
  return (
    <div className="gb-wait-line is-dep" title={t("Bloqueada hasta que respondas en {id}", { id: blocker.identifier ?? "" })}>
      <Icon name="link" size={12} />
      <span className="gb-what">
        {tx("Espera tu respuesta en {id}", { id: <b className="gb-mono">{blocker.identifier}</b> })}
      </span>
    </div>
  );
}

/** Chip de contexto: la tarea padre si es subtarea; si no, el proyecto. */
export function ContextChip({ index, issue }: { index: BoardIndex; issue: BoardIssue }) {
  const parent = issue.parentId ? index.byId.get(issue.parentId) : undefined;
  if (parent) {
    return (
      <span className="gb-parchip" title={t("Subtarea de {id} · {title}", { id: parent.identifier ?? "", title: parent.title })}>
        <Icon name="corner-down-right" size={12} />
        {parent.identifier}
      </span>
    );
  }
  if (!issue.projectId) return null;
  const project = projectLabel(index, issue.projectId);
  return (
    <span className="gb-prjchip" title={t("Proyecto: {project}", { project })}>
      <Icon name="folder" size={12} />
      <span>{project}</span>
    </span>
  );
}

/** Subtareas hechas sobre el total, sin las canceladas. Nada si no tiene. */
export function SubtaskCount({ index, issue }: { index: BoardIndex; issue: BoardIssue }) {
  const progress = progressOf(index, issue);
  if (progress.total === 0) return null;
  return (
    <span className="gb-subn gb-tnum" title={t("{done} de {total} subtareas hechas", { done: progress.done, total: progress.total })}>
      <Icon name="list-tree" size={12} />
      {progress.done}/{progress.total}
    </span>
  );
}

export interface CardProps {
  index: BoardIndex;
  issue: BoardIssue;
  /** Cerrada y a la espera del visto bueno: va en «Por confirmar» con su botón. */
  pending?: boolean;
  dragging: boolean;
  onConfirm?: (issue: BoardIssue) => void;
  onDragStart: (issue: BoardIssue) => void;
  onDragEnd: () => void;
  onPeek: (issue: BoardIssue | null, element?: HTMLElement) => void;
}

export const Card = memo(function Card({ index, issue, pending = false, dragging, onConfirm, onDragStart, onDragEnd, onPeek }: CardProps) {
  const company = index.companyById.get(issue.companyId);
  const who = assigneeName(index, issue);
  const href = hrefFor(index, issue);
  const mark = useMark(issue.id);
  const openTask = useOpenTask();
  const hot = issue.priority === "critical" || issue.priority === "high";
  return (
    <div
      data-iid={issue.id}
      className={cx("gb-card", markClass(mark), index.waiting.has(issue.id) && "is-toca", pending && "is-pending", dragging && "gb-dragging")}
      draggable
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", issue.id);
        onPeek(null);
        onDragStart(issue);
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={(event) => onPeek(issue, event.currentTarget)}
      onMouseLeave={() => onPeek(null)}
    >
      <div className="gb-t">
        {/* Enlace normal que cubre la tarjeta (§5): sin `draggable` para que se arrastre la tarjeta. */}
        <a className="gb-cover" href={href} draggable={false} aria-label={`${issue.identifier ?? ""} ${issue.title}`} onClick={openTask.link(issue)}>
          {issue.title}
        </a>
      </div>
      <WaitLine index={index} issue={issue} />
      <div className="gb-ctxrow">
        <ContextChip index={index} issue={issue} />
      </div>
      <div className="gb-foot">
        {/* El color nunca va solo: al lado, la clave lleva el prefijo de la empresa. */}
        <i className={cx("gb-cosq", companyClass(company))} style={companyStyle(company)} title={company?.name} />
        <span className="gb-id">{issue.identifier}</span>
        <MarkPill mark={mark} />
        <span className="gb-sp" />
        {pending ? (
          <span className="gb-closedas">
            <StatusIcon status={issue.status} size={12} />
            {STATUS_LABELS[issue.status]}
          </span>
        ) : null}
        {hot ? <PriorityIcon priority={issue.priority} /> : null}
        <SubtaskCount index={index} issue={issue} />
        <Avatar name={who} size={20} />
      </div>
      {pending && onConfirm ? (
        <button
          type="button"
          className="gb-confirm"
          title={t("Ya la revisé: sale de «Por confirmar» y queda entre las cerradas")}
          onClick={() => onConfirm(issue)}
        >
          <Icon name="check" size={14} />
          {t("Confirmar")}
        </button>
      ) : null}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Vista previa al pasar (§3.10)
// ---------------------------------------------------------------------------

const PEEK_WIDTH = 320;

/**
 * Qué se espera de la persona en esta tarea, o qué la tiene bloqueada. Nada si
 * no aplica. La usan la vista previa y el modal de tarea, que suma su enlace
 * para ir a responder (`children`).
 */
export function WaitNote({ index, issue, now, children }: { index: BoardIndex; issue: BoardIssue; now: number; children?: ReactNode }) {
  const waiting = index.waiting.get(issue.id);
  if (waiting) {
    const unblocks = dependentsOf(index, [issue]);
    return (
      <div className="gb-peek-toca">
        <TocaPill />
        <span>
          <b>{WAIT_LABELS[waiting.kind]}:</b> {waiting.what}
          {waiting.since ? <span className="gb-muted"> · {relativeTime(waiting.since, now)}</span> : null}
          {unblocks.length > 0 ? (
            <>
              <br />
              <span className="gb-muted">{t("Al responder se desbloquean {ids}", { ids: unblocks.map((u) => u.identifier).join(", ") })}</span>
            </>
          ) : null}
        </span>
        {children}
      </div>
    );
  }
  const directBlocker = issue.blockerIds[0] ? index.byId.get(issue.blockerIds[0]) : undefined;
  if (!directBlocker || !isOpenStatus(issue.status)) return null;
  const waitBlocker = waitBlockerOf(index, issue);
  return (
    <div className="gb-peek-toca is-dep">
      <Icon name="link" size={14} />
      <span>
        {waitBlocker && waitBlocker.id !== directBlocker.id
          ? tx("Bloqueada por {id}, que espera a {waiting}.", {
              id: <b className="gb-mono">{directBlocker.identifier}</b>,
              waiting: <b className="gb-mono">{waitBlocker.identifier}</b>,
            })
          : tx("Bloqueada por {id}.", { id: <b className="gb-mono">{directBlocker.identifier}</b> })}
        {waitBlocker ? (
          <>
            {" "}
            {tx("{id} espera tu respuesta.", { id: <b>{waitBlocker.identifier}</b> })}
          </>
        ) : null}
      </span>
    </div>
  );
}

export function Peek({ index, issue, anchor, now }: { index: BoardIndex; issue: BoardIssue; anchor: DOMRect; now: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(anchor.top);
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    setTop(Math.max(8, Math.min(anchor.top, window.innerHeight - height - 12)));
  }, [anchor, issue]);
  // A la derecha de la tarjeta, o a la izquierda si no cabe; siempre dentro de la ventana.
  let left = anchor.right + 8;
  if (left + PEEK_WIDTH + 10 > window.innerWidth) left = anchor.left - PEEK_WIDTH - 8;
  left = Math.max(8, Math.min(left, window.innerWidth - PEEK_WIDTH - 8));

  const company = index.companyById.get(issue.companyId);
  const who = assigneeName(index, issue);
  const ancestors = ancestorsOf(index, issue);
  const kids = sortSubtasks(index, childrenOf(index, issue));
  const progress = progressOf(index, issue);

  return (
    <Layer>
      <div ref={ref} className="gb-peek" style={{ left, top }} role="tooltip">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CompanyTag company={company} />
          <span className="gb-mono gb-muted" style={{ fontSize: 12 }}>
            {issue.identifier}
          </span>
          <span className="gb-muted" style={{ fontSize: 12 }}>
            · {company?.name}
          </span>
        </div>
        <div className="gb-pt">{issue.title}</div>
        <WaitNote index={index} issue={issue} now={now} />
        <div className="gb-prow">
          <StatusIcon status={issue.status} />
          <b>{STATUS_LABELS[issue.status]}</b>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>
            <PriorityIcon priority={issue.priority} />
            <b>{PRIORITY_LABELS[issue.priority]}</b>
          </span>
        </div>
        <div className="gb-prow">
          <Icon name="folder" size={14} />
          <b>{projectLabel(index, issue.projectId)}</b>
        </div>
        <div className="gb-prow">
          <Avatar name={who} size={16} />
          <b>{who ?? t("Sin asignar")}</b>
        </div>
        <div className="gb-prow">
          <Icon name="clock" size={14} />
          {t("Actualizada {when}", { when: relativeTime(issue.updatedAt, now) })}
        </div>
        {issue.labels.length > 0 ? (
          <div className="gb-labels">
            {issue.labels.map((label) => (
              <span key={label.id} className="gb-lblpill">
                <i className="gb-ldot" style={{ "--lc": label.color, width: 6, height: 6 } as CSSProperties} />
                {label.name}
              </span>
            ))}
          </div>
        ) : null}
        {ancestors.length > 0 || kids.length > 0 ? (
          <div className="gb-tree">
            <div className="gb-tree-h">
              <Icon name="list-tree" size={12} />
              <span>{t("Árbol")}</span>
              {progress.total > 0 ? (
                <>
                  <span className="gb-sp" />
                  <ProgressBar done={progress.done} total={progress.total} width={56} />
                  <span className="gb-tnum">
                    {t("{done}/{total} hechas", { done: progress.done, total: progress.total })}
                  </span>
                </>
              ) : null}
            </div>
            {ancestors.map((ancestor, depth) => (
              <TreeLine key={ancestor.id} index={index} issue={ancestor} depth={depth} kind="anc" />
            ))}
            <TreeLine index={index} issue={issue} depth={ancestors.length} kind="cur" />
            {kids.slice(0, 5).map((kid) => (
              <TreeLine key={kid.id} index={index} issue={kid} depth={ancestors.length + 1} />
            ))}
            {kids.length > 5 ? (
              <div className="gb-trmore" style={{ "--d": ancestors.length + 1 } as CSSProperties}>
                {t("y {n} subtareas más", { n: kids.length - 5 })}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="gb-popen">
          <Icon name="external-link" size={12} />
          {t("Clic para abrirla aquí · Ctrl o ⌘ + clic: su página")}
        </div>
      </div>
    </Layer>
  );
}

function TreeLine({ index, issue, depth, kind }: { index: BoardIndex; issue: BoardIssue; depth: number; kind?: "anc" | "cur" }) {
  return (
    <div
      className={cx("gb-trrow", depth > 0 && "is-nested", kind === "anc" && "is-anc", kind === "cur" && "is-cur", !isOpenStatus(issue.status) && "is-closed")}
      style={{ "--d": depth } as CSSProperties}
    >
      <StatusIcon status={issue.status} size={12} />
      <span className="gb-mono gb-tid">{issue.identifier}</span>
      <span className="gb-tt">{issue.title}</span>
      {index.waiting.has(issue.id) ? <TocaPill small iconOnly /> : null}
    </div>
  );
}
