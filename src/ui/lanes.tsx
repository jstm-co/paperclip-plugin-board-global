// Kanban con carriles (Fase 2, design-spec §4 de JST-21): una grilla carril ×
// estado. Las columnas siguen siendo los estados; arrastrar solo cambia el
// estado y solo dentro del mismo carril.
import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  NO_PROJECT,
  UNASSIGNED,
  assigneeLabel,
  hiddenLaneCount,
  kanbanLanes,
  kanbanStatuses,
  laneKeyOf,
  type BoardIndex,
  type BoardQuery,
  type KanbanLane,
  type LaneBy,
} from "../board.js";
import { isOpenStatus, type BoardIssue, type IssueStatus } from "../shared.js";
import { Card } from "./card.js";
import { Avatar, CompanyTag, STATUS_LABELS, StatusIcon, TocaPill, companyClass, companyStyle, cx, plural } from "./common.js";
import { LANE_META } from "./filters.js";
import { Icon } from "./icons.js";
import type { KanbanUi } from "./kanban.js";
import { Layer } from "./layer.js";

/** Con carriles, 2 tarjetas por celda: así se ve más de un carril a la vez (§4.2). */
const PER_CELL = 2;
const MORE_STEP = 20;
// Las subtareas empiezan plegadas en todas las tarjetas y se despliegan una por
// una (`cardToggled`); con carriles no se usa `sub` (rev 2, §4.2).

/** Clave de estado de la vista (carriles plegados y «+N más»): cambia con el tipo de carril. */
export const laneUiKey = (laneBy: LaneBy, key: string) => `${laneBy}:${key}`;

function laneName(index: BoardIndex, lane: KanbanLane, laneBy: LaneBy) {
  const company = lane.companyId ? index.companyById.get(lane.companyId) : undefined;
  if (laneBy === "empresa") {
    return (
      <>
        <CompanyTag company={company} solid />
        <span className="gb-t">{company?.name ?? lane.label}</span>
      </>
    );
  }
  if (lane.key === NO_PROJECT || lane.key === UNASSIGNED) {
    return (
      <>
        {laneBy === "proyecto" ? (
          <span className="gb-noic">
            <Icon name="folder" size={12} />
          </span>
        ) : (
          <Avatar name={null} size={18} />
        )}
        <span className="gb-t">{lane.label}</span>
      </>
    );
  }
  if (laneBy === "proyecto") {
    return (
      <>
        <CompanyTag company={company} solid />
        <span className="gb-t">{lane.label}</span>
      </>
    );
  }
  return (
    <>
      <Avatar name={assigneeLabel(index, lane.key)} size={18} />
      <span className="gb-t">{lane.label}</span>
    </>
  );
}

export function LaneBoard({
  index,
  issues,
  query,
  laneBy,
  ui,
  closedLanes,
  dragging,
  onToggleLane,
  onMore,
  onToggleSubtasks,
  onShowAllKids,
  onShowClosed,
  onDragStart,
  onDragEnd,
  onDrop,
  onBadDrop,
  onPeek,
}: {
  index: BoardIndex;
  issues: BoardIssue[];
  query: BoardQuery;
  laneBy: LaneBy;
  ui: KanbanUi;
  /** Carriles plegados (`laneUiKey`). En memoria: no van a la URL ni a la vista (§4.3). */
  closedLanes: ReadonlySet<string>;
  dragging: BoardIssue | null;
  onToggleLane: (key: string) => void;
  onMore: (key: string, next: number) => void;
  onToggleSubtasks: (issueId: string) => void;
  onShowAllKids: (issueId: string) => void;
  onShowClosed: () => void;
  onDragStart: (issue: BoardIssue) => void;
  onDragEnd: () => void;
  onDrop: (status: IssueStatus) => void;
  /** Se soltó en otro carril: no cambia nada (§4.4). */
  onBadDrop: () => void;
  onPeek: (issue: BoardIssue | null, element?: HTMLElement) => void;
}) {
  const [dropOn, setDropOn] = useState<string | null>(null);
  const badOver = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const { filters } = query;
  const statuses = kanbanStatuses(filters, query.showClosed);
  const lanes = kanbanLanes(index, issues, laneBy, statuses);
  const hidden = hiddenLaneCount(index, lanes, laneBy, filters.emp);
  const meta = LANE_META[laneBy];
  const gridStyle = { "--gcols": `170px repeat(${statuses.length}, minmax(${query.showClosed ? 200 : 150}px, 1fr))` } as CSSProperties;
  const dragLane = dragging ? laneKeyOf(dragging, laneBy) : null;
  const dragLaneName = dragLane ? (lanes.find((lane) => lane.key === dragLane)?.label ?? "") : "";
  const closedCount = issues.filter((issue) => !isOpenStatus(issue.status)).length;

  const cellHandlers = (laneKey: string, status: IssueStatus) => {
    const key = `${laneKey}|${status}`;
    if (dragLane !== null && laneKey !== dragLane) {
      // Otro carril: sin `preventDefault`, el navegador muestra «no permitido».
      return {
        onDragOver: () => {
          badOver.current = true;
          if (dropOn) setDropOn(null);
        },
      };
    }
    return {
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        if (!dragging) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        badOver.current = false;
        if (dropOn !== key) setDropOn(key);
      },
      onDragLeave: (event: DragEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropOn((current) => (current === key ? null : current));
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDropOn(null);
        badOver.current = false;
        if (dragging) onDrop(status);
      },
    };
  };

  const box = boxRef.current?.getBoundingClientRect();
  const hintLeft = box ? box.left + box.width / 2 : undefined;

  return (
    <div className="gb-lanewrap">
      <div
        ref={boxRef}
        className={cx("gb-lanes", dragLane !== null && "is-dragging")}
        onDragEnd={(event) => {
          setDropOn(null);
          if (badOver.current && event.dataTransfer.dropEffect === "none") onBadDrop();
          badOver.current = false;
        }}
      >
        <div className="gb-grid gb-lhead" style={gridStyle}>
          <div className="gb-corner">
            <Icon name={meta.icon} size={12} />
            {lanes.length} {lanes.length === 1 ? meta.label.toLowerCase() : meta.plural}
          </div>
          {statuses.map((status) => {
            const items = issues.filter((issue) => issue.status === status);
            const hot = items.filter((issue) => issue.priority === "critical" || issue.priority === "high").length;
            return (
              <div key={status} className="gb-colh" data-s={status}>
                <StatusIcon status={status} />
                <span className="gb-name">{STATUS_LABELS[status]}</span>
                {hot > 0 && isOpenStatus(status) ? (
                  <span className="gb-hot" title={`${hot} de prioridad crítica o alta`}>
                    <Icon name="arrow-up" size={12} />
                    {hot}
                  </span>
                ) : null}
                <span className="gb-cnt gb-tnum">{items.length}</span>
              </div>
            );
          })}
        </div>

        {lanes.map((lane) => {
          const uiKey = laneUiKey(laneBy, lane.key);
          const closed = closedLanes.has(uiKey);
          const company = lane.companyId ? index.companyById.get(lane.companyId) : undefined;
          const toca = lane.cells.reduce((sum, cell) => sum + cell.issues.filter((issue) => index.waiting.has(issue.id)).length, 0);
          const agentCompany =
            laneBy === "responsable" && lane.key.startsWith("agent:")
              ? index.companyById.get(index.agentById.get(lane.key.slice("agent:".length))?.companyId ?? "")
              : undefined;
          return (
            <section
              key={lane.key}
              className={cx(
                "gb-grid",
                "gb-lane",
                closed && "is-closed",
                company ? companyClass(company) : "is-nocol",
                dragLane !== null && (lane.key === dragLane ? "is-src" : "is-other"),
              )}
              style={{ ...gridStyle, ...companyStyle(company) }}
              aria-label={lane.label}
            >
              <button
                type="button"
                className="gb-llabel"
                aria-expanded={!closed}
                title={`${closed ? "Desplegar" : "Plegar"} el carril`}
                onClick={() => onToggleLane(uiKey)}
              >
                <span className="gb-nm">
                  <span className="gb-chev">
                    <Icon name="chevron-down" size={12} />
                  </span>
                  {laneName(index, lane, laneBy)}
                </span>
                <span className="gb-meta">
                  {agentCompany ? <CompanyTag company={agentCompany} /> : null}
                  {plural(lane.total, "tarea", "tareas")}
                  {toca > 0 ? <TocaPill label={`Te toca ${toca}`} small /> : null}
                </span>
              </button>
              {lane.cells.map((cell) => {
                if (closed) {
                  return (
                    <div key={cell.status} className="gb-lcnt" data-s={cell.status}>
                      {cell.issues.length > 0 ? (
                        <>
                          <StatusIcon status={cell.status} size={12} />
                          <b className="gb-tnum">{cell.issues.length}</b>
                        </>
                      ) : (
                        <span className="gb-zero">—</span>
                      )}
                    </div>
                  );
                }
                const moreKey = `ln:${uiKey}:${cell.status}`;
                const limit = ui.more[moreKey] ?? PER_CELL;
                const same = dragLane === null || lane.key === dragLane;
                return (
                  <div
                    key={cell.status}
                    className={cx(
                      "gb-cell",
                      dragLane !== null && (same ? "is-ok" : "is-nodrop"),
                      dropOn === `${lane.key}|${cell.status}` && "gb-drop-on",
                    )}
                    data-s={cell.status}
                    aria-label={`${lane.label} · ${STATUS_LABELS[cell.status]}`}
                    {...cellHandlers(lane.key, cell.status)}
                  >
                    {cell.issues.slice(0, limit).map((issue) => (
                      <Card
                        key={issue.id}
                        index={index}
                        issue={issue}
                        subtasksOpen={ui.cardToggled.has(issue.id)}
                        showAllKids={ui.kidsAll.has(issue.id)}
                        dragging={dragging?.id === issue.id}
                        onToggleSubtasks={onToggleSubtasks}
                        onShowAllKids={onShowAllKids}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onPeek={onPeek}
                      />
                    ))}
                    {cell.issues.length > limit ? (
                      <button type="button" className="gb-more" onClick={() => onMore(moreKey, limit + MORE_STEP)}>
                        +{cell.issues.length - limit} más
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </section>
          );
        })}

        {hidden > 0 ? (
          <div className="gb-lnote">
            <Icon name="info" size={12} />
            {hidden === 1
              ? `1 ${meta.label.toLowerCase()} sin tareas en estas columnas no se muestra.`
              : `${hidden} ${meta.plural} sin tareas en estas columnas no se muestran.`}
          </div>
        ) : null}
      </div>
      {query.showClosed || filters.est.length > 0 ? null : (
        <button type="button" className="gb-closedtoggle" onClick={onShowClosed} title="Mostrar las columnas Hecha y Cancelada">
          <Icon name="eye" size={14} />
          Hechas y canceladas · {closedCount}
        </button>
      )}

      {dragLane !== null ? (
        <Layer>
          <div className="gb-draghint" style={hintLeft === undefined ? undefined : { left: hintLeft }} role="status">
            <Icon name="lock" size={14} />
            <span>
              {laneBy === "empresa" ? (
                <>
                  Suelta en una columna de <b>{dragLaneName}</b>. Una tarea no puede pasar a otra empresa.
                </>
              ) : (
                <>
                  Suelta dentro de <b>{dragLaneName}</b>. Arrastrar cambia el estado, no {meta.what}.
                </>
              )}
            </span>
          </div>
        </Layer>
      ) : null}
    </div>
  );
}

/** Toast al soltar en otro carril (§4.4). */
export function badDropMessage(laneBy: LaneBy): string {
  return laneBy === "empresa"
    ? "Solo se suelta dentro de su empresa: una tarea no puede pasar a otra."
    : `Solo se suelta dentro del mismo carril. Para cambiar ${LANE_META[laneBy].what}, abre la tarea.`;
}
