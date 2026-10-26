// Kanban (§3.5–3.6): una columna por estado y, dentro, un grupo por empresa
// con 3 tarjetas y «+N más». Todo el cuerpo de la columna es zona de soltar.
import { useState, type DragEvent } from "react";
import { kanbanStatuses, sortIssues, type BoardIndex, type BoardQuery } from "../board.js";
import { isOpenStatus, type BoardIssue, type IssueStatus } from "../shared.js";
import { Card } from "./card.js";
import { CompanyTag, STATUS_LABELS, Skeleton, StatusIcon, TocaPill, companyClass, companyStyle, cx } from "./common.js";
import { Icon } from "./icons.js";

/** Tarjetas por grupo de empresa antes de «+N más» (§3.6). */
const PER_GROUP = 3;
const MORE_STEP = 20;

export interface KanbanUi {
  /** Grupos plegados: `estado:empresa`. */
  collapsed: ReadonlySet<string>;
  /** Tarjetas visibles por grupo cuando se pidió «+N más». */
  more: Readonly<Record<string, number>>;
  /** Tarjetas cuyo estado de subtareas difiere del general (`sub`). */
  cardToggled: ReadonlySet<string>;
  /** Tarjetas con «Ver N más» de subtareas abierto. */
  kidsAll: ReadonlySet<string>;
}

export function KanbanBoard({
  index,
  issues,
  query,
  ui,
  draggingId,
  onToggleGroup,
  onMore,
  onToggleSubtasks,
  onShowAllKids,
  onShowClosed,
  onDragStart,
  onDragEnd,
  onDrop,
  onPeek,
}: {
  index: BoardIndex;
  issues: BoardIssue[];
  query: BoardQuery;
  ui: KanbanUi;
  draggingId: string | null;
  onToggleGroup: (key: string) => void;
  onMore: (key: string, next: number) => void;
  onToggleSubtasks: (issueId: string) => void;
  onShowAllKids: (issueId: string) => void;
  onShowClosed: () => void;
  onDragStart: (issue: BoardIssue) => void;
  onDragEnd: () => void;
  onDrop: (status: IssueStatus) => void;
  onPeek: (issue: BoardIssue | null, element?: HTMLElement) => void;
}) {
  const [dropOn, setDropOn] = useState<IssueStatus | null>(null);
  const { filters } = query;
  const statuses = kanbanStatuses(filters, query.showClosed);
  const fixed = query.showClosed && filters.est.length === 0;
  const companies = index.companies.filter((company) => filters.emp.length === 0 || filters.emp.includes(company.prefix));
  const closedCount = issues.filter((issue) => !isOpenStatus(issue.status)).length;

  const dropHandlers = (status: IssueStatus) => ({
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!draggingId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropOn !== status) setDropOn(status);
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropOn((current) => (current === status ? null : current));
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropOn(null);
      if (draggingId) onDrop(status);
    },
  });

  return (
    <div className="gb-board" onDragEnd={() => setDropOn(null)}>
      {statuses.map((status) => {
        const items = issues.filter((issue) => issue.status === status);
        const hot = items.filter((issue) => issue.priority === "critical" || issue.priority === "high").length;
        const groups = companies
          .map((company) => ({ company, items: sortIssues(index, items.filter((issue) => issue.companyId === company.id)) }))
          .filter((group) => group.items.length > 0);
        return (
          <section key={status} className={cx("gb-col", fixed && "is-fixed")} data-s={status} aria-label={STATUS_LABELS[status]}>
            <div className="gb-colh">
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
            <div className={cx("gb-body", dropOn === status && "gb-drop-on")} {...dropHandlers(status)}>
              {groups.length === 0 ? <div className="gb-colempty">Sin tareas · suelta aquí</div> : null}
              {groups.map(({ company, items: groupItems }) => {
                const key = `${status}:${company.id}`;
                const closed = ui.collapsed.has(key);
                const limit = ui.more[key] ?? PER_GROUP;
                const toca = groupItems.filter((issue) => index.waiting.has(issue.id)).length;
                return (
                  <div key={company.id} className={cx("gb-grp-k", closed && "is-closed", companyClass(company))} style={companyStyle(company)}>
                    <button type="button" className="gb-subh" aria-expanded={!closed} onClick={() => onToggleGroup(key)}>
                      <span className="gb-chev">
                        <Icon name="chevron-down" size={12} />
                      </span>
                      <CompanyTag company={company} solid />
                      {company.name}
                      {toca > 0 ? <TocaPill label={String(toca)} small /> : null}
                      <span className="gb-n gb-tnum">{groupItems.length}</span>
                    </button>
                    {closed
                      ? null
                      : groupItems.slice(0, limit).map((issue) => (
                          <Card
                            key={issue.id}
                            index={index}
                            issue={issue}
                            subtasksOpen={!query.subtasksCollapsed !== ui.cardToggled.has(issue.id)}
                            showAllKids={ui.kidsAll.has(issue.id)}
                            dragging={draggingId === issue.id}
                            onToggleSubtasks={onToggleSubtasks}
                            onShowAllKids={onShowAllKids}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onPeek={onPeek}
                          />
                        ))}
                    {!closed && groupItems.length > limit ? (
                      <button type="button" className="gb-more" onClick={() => onMore(key, limit + MORE_STEP)}>
                        +{groupItems.length - limit} más de {company.name}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {query.showClosed || filters.est.length > 0 ? null : (
        <button type="button" className="gb-closedtoggle" onClick={onShowClosed} title="Mostrar las columnas Hecha y Cancelada">
          <Icon name="eye" size={14} />
          Hechas y canceladas · {closedCount}
        </button>
      )}
    </div>
  );
}

/** Esqueleto de carga: 5 columnas con tarjetas de 3 líneas (§4.1). */
export function KanbanSkeleton() {
  return (
    <div className="gb-board" aria-busy="true" aria-label="Cargando tareas">
      {[5, 2, 2, 3, 3].map((count, column) => (
        <section key={column} className="gb-col is-skel">
          <div className="gb-colh">
            <Skeleton width={80} height={10} />
          </div>
          <div className="gb-body">
            <div className="gb-subh" style={{ cursor: "default" }}>
              <Skeleton width={110} height={10} />
            </div>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="gb-card" style={{ cursor: "default" }}>
                <div className="gb-r1">
                  <Skeleton width={30} height={14} />
                  <Skeleton width={50} height={9} />
                </div>
                <Skeleton width={`${90 - (i % 3) * 10}%`} height={10} style={{ marginTop: 9 }} />
                <Skeleton width="60%" height={10} style={{ marginTop: 6 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Skeleton width={70} height={9} />
                  <Skeleton width={60} height={9} style={{ marginLeft: "auto" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
