// Bloque inferior del Dashboard global (§3.7): agentes en vivo, actividad
// reciente y tareas recientes de todas las empresas del filtro, mezclados por
// fecha y con la empresa marcada en cada fila.
import type { ReactNode } from "react";
import { relativeTime, userLabel } from "../board.js";
import { activityVerb, durationLabel, type ActivityRow, type DashboardModel, type LiveRunRow, type RecentTaskRow } from "../dashboard.js";
import { Avatar, CompanyTag, LABELS, Skeleton, StatusIcon, cx } from "./common.js";
import { Icon } from "./icons.js";

/** «Agentes en vivo» muestra como máximo 6 filas: los activos y luego los recientes. */
const LIVE_ROWS = 6;
const FAILED_RUN_STATUSES = new Set(["failed", "timed_out", "error"]);

export function Section({ title, meta, right }: { title: string; meta?: ReactNode; right?: ReactNode }) {
  return (
    <div className="gb-dsec">
      <h2>{title}</h2>
      {meta ? <span className="gb-meta">{meta}</span> : null}
      <span className="gb-sp" />
      {right}
    </div>
  );
}

function finishedAt(row: LiveRunRow): string {
  return row.run.finishedAt ?? row.run.createdAt;
}

function LiveRow({ row, now }: { row: LiveRunRow; now: number }) {
  const { run } = row;
  const failed = FAILED_RUN_STATUSES.has(run.status);
  const when = row.isActive ? (
    <span className="gb-when is-live">
      {run.status === "queued" ? "En cola" : "En vivo"} · {durationLabel(run.startedAt ?? run.createdAt, now)}
    </span>
  ) : failed ? (
    <span className="gb-when is-fail">Falló {relativeTime(finishedAt(row), now)}</span>
  ) : (
    <span className="gb-when">Terminó {relativeTime(finishedAt(row), now)}</span>
  );
  return (
    <a className="gb-lrow" href={row.runHref} title={`Abrir el run de ${run.agentName}`}>
      <span className={cx("gb-rdot", row.isActive && "is-live", failed && "is-fail")} />
      <Avatar name={run.agentName} size={20} />
      <span className="gb-l1">
        <b>{run.agentName}</b>
        <CompanyTag company={row.company} />
        <span className="gb-sp" />
        {when}
      </span>
      <span className="gb-l2">
        {row.issue ? (
          <>
            <span className="gb-id">{row.issue.identifier}</span> {row.issue.title ?? ""}
          </>
        ) : (
          "Sin tarea"
        )}
      </span>
    </a>
  );
}

function LiveColumn({ model, now }: { model: DashboardModel; now: number }) {
  const active = model.liveRuns.filter((row) => row.isActive);
  const recent = model.liveRuns
    .filter((row) => !row.isActive)
    .sort((a, b) => (Date.parse(finishedAt(b)) || 0) - (Date.parse(finishedAt(a)) || 0));
  const shown = recent.slice(0, Math.max(0, LIVE_ROWS - active.length));
  const lastRun = recent[0];
  return (
    <div>
      <Section title="Agentes en vivo" meta={active.length > 0 ? `${active.length} corriendo` : undefined} />
      <div className="gb-feed">
        {active.map((row) => (
          <LiveRow key={row.run.id} row={row} now={now} />
        ))}
        {active.length === 0 ? (
          <div className="gb-mempty">
            <Icon name="bot" size={14} />
            <div>
              <b>Ningún agente trabajando ahora</b>
              {lastRun ? <span>Último run {relativeTime(finishedAt(lastRun), now)}.</span> : null}
            </div>
          </div>
        ) : null}
        {shown.length > 0 ? <div className="gb-subhd">Recientes</div> : null}
        {shown.map((row) => (
          <LiveRow key={row.run.id} row={row} now={now} />
        ))}
      </div>
    </div>
  );
}

function ActivityRowView({ row, now }: { row: ActivityRow; now: number }) {
  const content = (
    <>
      <span className="gb-l1">
        <CompanyTag company={row.company} />
        <Avatar name={row.actor} size={18} />
        <span className="gb-txt">
          <b>{row.actor}</b> <span className="gb-v">{activityVerb(row.event.action, row.event.details, LABELS)}</span>
          {row.entityLabel ? (
            <>
              {" "}
              <b className={cx(row.event.entityType === "issue" && "gb-ent")}>{row.entityLabel}</b>
            </>
          ) : null}
        </span>
        <span className="gb-when">{relativeTime(row.event.createdAt, now)}</span>
      </span>
      {row.entityTitle ? <span className="gb-l2">{row.entityTitle}</span> : null}
    </>
  );
  // Un evento que no lleva a ninguna parte no es un enlace (§3.7).
  return row.href ? (
    <a className="gb-arow" href={row.href}>
      {content}
    </a>
  ) : (
    <div className="gb-arow">{content}</div>
  );
}

function TaskRowView({ row, now }: { row: RecentTaskRow; now: number }) {
  const { issue } = row;
  const who = row.agentName ?? (issue.assigneeUserId ? userLabel(issue.assigneeUserId) : null);
  return (
    <a className="gb-trow" href={row.href}>
      <span className="gb-l1">
        <StatusIcon status={issue.status} />
        <CompanyTag company={row.company} />
        <span className="gb-id">{issue.identifier ?? issue.id.slice(0, 8)}</span>
        <span className="gb-who">
          <Avatar name={who} size={16} />
          <span>{who ?? "Sin asignar"}</span>
        </span>
        <span className="gb-when">{relativeTime(issue.updatedAt, now)}</span>
      </span>
      <span className="gb-l2">{issue.title}</span>
    </a>
  );
}

function SkeletonFeed() {
  return (
    <div className="gb-feed">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="gb-skrow">
          <Skeleton width={28} height={14} />
          <Skeleton width="70%" height={10} />
        </div>
      ))}
    </div>
  );
}

/** Las listas mezclan empresas por fecha: se llenan cuando respondieron todas (§4.1). */
export function Feeds({ model, loading, now }: { model: DashboardModel; loading: boolean; now: number }) {
  if (loading) {
    return (
      <div className="gb-cbottom">
        {["Agentes en vivo", "Actividad reciente", "Tareas recientes"].map((title) => (
          <div key={title}>
            <Section title={title} />
            <SkeletonFeed />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="gb-cbottom">
      <LiveColumn model={model} now={now} />
      <div>
        <Section title="Actividad reciente" />
        <div className="gb-feed">
          {model.recentActivity.length > 0 ? (
            model.recentActivity.map((row) => <ActivityRowView key={`${row.company.id}:${row.event.id}`} row={row} now={now} />)
          ) : (
            <div className="gb-fempty">Sin actividad.</div>
          )}
        </div>
      </div>
      <div>
        <Section title="Tareas recientes" />
        <div className="gb-feed">
          {model.recentTasks.length > 0 ? (
            model.recentTasks.map((row) => <TaskRowView key={row.issue.id} row={row} now={now} />)
          ) : (
            <div className="gb-fempty">Sin tareas recientes.</div>
          )}
        </div>
      </div>
    </div>
  );
}
