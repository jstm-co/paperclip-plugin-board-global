// Vista Lista (§3.11): agrupada (por empresa por defecto) y, al agrupar por
// empresa o proyecto, con las subtareas anidadas bajo su tarea padre.
import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  groupIssues,
  progressOf,
  projectLabel,
  relativeTime,
  sortIssues,
  splitTree,
  treeRows,
  type BoardIndex,
  type GroupBy,
  type IssueGroup,
  type TreeRow,
} from "../board.js";
import { OPEN_STATUSES, isOpenStatus, type BoardIssue, type IssuePriority, type IssueStatus } from "../shared.js";
import { hrefFor } from "./card.js";
import {
  Avatar,
  CompanyTag,
  LABELS,
  PriorityBadge,
  PriorityIcon,
  ProgressBar,
  StatusIcon,
  TocaPill,
  assigneeName,
  companyClass,
  companyStyle,
  cx,
  isOwnClick,
  openHref,
  plural,
} from "./common.js";
import { Icon } from "./icons.js";

const MORE_STEP = 25;

export interface ListUi {
  collapsed: ReadonlySet<string>;
  /** Tareas con las subtareas plegadas en el árbol. */
  treeClosed: ReadonlySet<string>;
  more: Readonly<Record<string, number>>;
}

export function ListView({
  index,
  issues,
  group,
  now,
  ui,
  onToggleGroup,
  onToggleTree,
  onMore,
}: {
  index: BoardIndex;
  issues: BoardIssue[];
  group: GroupBy;
  now: number;
  ui: ListUi;
  onToggleGroup: (key: string) => void;
  onToggleTree: (issueId: string) => void;
  onMore: (key: string, next: number) => void;
}) {
  const groups = useMemo(() => {
    // Abiertas primero; dentro, el orden del board (§5).
    const sorted = sortIssues(index, issues).sort((a, b) => Number(!isOpenStatus(a.status)) - Number(!isOpenStatus(b.status)));
    return groupIssues(index, sorted, group, LABELS);
  }, [index, issues, group]);

  return (
    <div className="gb-list">
      {groups.map((g) => {
        const key = `l:${group}:${g.key}`;
        return (
          <ListGroup
            key={key}
            index={index}
            group={g}
            groupBy={group}
            now={now}
            closed={ui.collapsed.has(key)}
            limit={ui.more[key]}
            treeClosed={ui.treeClosed}
            onToggle={() => onToggleGroup(key)}
            onToggleTree={onToggleTree}
            onMore={(next) => onMore(key, next)}
          />
        );
      })}
    </div>
  );
}

function groupLabel(index: BoardIndex, group: IssueGroup, groupBy: GroupBy): ReactNode {
  const company = group.companyId ? index.companyById.get(group.companyId) : undefined;
  switch (groupBy) {
    case "empresa":
      return (
        <>
          <CompanyTag company={company} solid large />
          <span className="gb-nm">{group.label}</span>
        </>
      );
    case "estado":
      return (
        <>
          <StatusIcon status={group.key as IssueStatus} />
          <span className="gb-nm">{group.label}</span>
        </>
      );
    case "prioridad":
      return (
        <>
          <PriorityIcon priority={group.key as IssuePriority} />
          <span className="gb-nm">{group.label}</span>
        </>
      );
    case "proyecto":
      return (
        <>
          <CompanyTag company={company} solid />
          <span className="gb-nm">{group.label}</span>
        </>
      );
    case "responsable":
      return (
        <>
          <Avatar name={group.key === "none" ? null : group.label} size={22} />
          <span className="gb-nm">{group.label}</span>
          {company ? <CompanyTag company={company} /> : null}
        </>
      );
  }
}

interface RowModel {
  issue: BoardIssue;
  tree: TreeRow | null;
}

function ListGroup({
  index,
  group,
  groupBy,
  now,
  closed,
  limit: requestedLimit,
  treeClosed,
  onToggle,
  onToggleTree,
  onMore,
}: {
  index: BoardIndex;
  group: IssueGroup;
  groupBy: GroupBy;
  now: number;
  closed: boolean;
  limit: number | undefined;
  treeClosed: ReadonlySet<string>;
  onToggle: () => void;
  onToggleTree: (issueId: string) => void;
  onMore: (next: number) => void;
}) {
  const nested = groupBy === "empresa" || groupBy === "proyecto";
  const rows: RowModel[] = useMemo(() => {
    if (!nested) return group.issues.map((issue) => ({ issue, tree: null }));
    const { tree: inTree, flat } = splitTree(index, group.issues);
    return [
      ...treeRows(index, inTree, treeClosed).map((tree) => ({ issue: tree.issue, tree })),
      ...flat.map((issue) => ({ issue, tree: null })),
    ];
  }, [index, group, nested, treeClosed]);

  const limit = requestedLimit ?? (nested ? 12 : 8);
  const tocaCount = group.issues.filter((issue) => index.waiting.has(issue.id)).length;
  const openCounts = OPEN_STATUSES.map((status) => ({ status, count: group.issues.filter((issue) => issue.status === status).length })).filter(
    (entry) => entry.count > 0,
  );
  const closedCount = group.issues.filter((issue) => !isOpenStatus(issue.status)).length;
  const company = groupBy === "empresa" && group.companyId ? index.companyById.get(group.companyId) : undefined;

  return (
    <div className={cx("gb-lgrp", closed && "is-closed", company ? companyClass(company) : "is-plain")} style={companyStyle(company)}>
      <button type="button" className="gb-grph" aria-expanded={!closed} onClick={onToggle}>
        <span className="gb-chev">
          <Icon name="chevron-down" size={14} />
        </span>
        {groupLabel(index, group, groupBy)}
        <span className="gb-muted" style={{ fontSize: 12 }}>
          {plural(group.issues.length, "tarea", "tareas")}
        </span>
        {tocaCount > 0 ? <TocaPill small label={`${tocaCount} te ${tocaCount === 1 ? "toca" : "tocan"}`} /> : null}
        <span className="gb-stc">
          {openCounts.map(({ status, count }) => (
            <span key={status} title={LABELS.status[status]}>
              <StatusIcon status={status} size={12} />
              <span className="gb-tnum">{count}</span>
            </span>
          ))}
          <span title="Hechas y canceladas">
            <StatusIcon status="done" size={12} />
            <span className="gb-tnum">{closedCount}</span>
          </span>
        </span>
      </button>
      {closed ? null : (
        <>
          {rows.slice(0, limit).map((row) => (
            <ListRow
              key={row.issue.id}
              index={index}
              issue={row.issue}
              tree={row.tree}
              showCompany={groupBy !== "empresa"}
              now={now}
              onToggleTree={onToggleTree}
            />
          ))}
          {rows.length > limit ? (
            <div className="gb-rowmore">
              <button type="button" className="gb-linkbtn" onClick={() => onMore(limit + MORE_STEP)}>
                Ver {Math.min(MORE_STEP, rows.length - limit)} más · quedan {rows.length - limit}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function TreeCell({ row, onToggle }: { row: TreeRow; onToggle: (issueId: string) => void }) {
  return (
    <span className={cx("gb-tcell", row.depth > 0 && "is-child", row.last && "is-last")} style={{ "--d": row.depth } as CSSProperties}>
      {row.rails.map((on, level) => (on ? <i key={level} className="gb-rail" style={{ "--l": level } as CSSProperties} /> : null))}
      {row.kidCount > 0 ? (
        <button
          type="button"
          className={cx("gb-tchev", !row.open && "is-closed")}
          aria-expanded={row.open}
          aria-label={`${row.open ? "Plegar" : "Desplegar"} subtareas`}
          onClick={() => onToggle(row.issue.id)}
        >
          <Icon name="chevron-down" size={12} />
        </button>
      ) : (
        <span className="gb-tdot" />
      )}
    </span>
  );
}

function ListRow({
  index,
  issue,
  tree,
  showCompany,
  now,
  onToggleTree,
}: {
  index: BoardIndex;
  issue: BoardIssue;
  tree: TreeRow | null;
  showCompany: boolean;
  now: number;
  onToggleTree: (issueId: string) => void;
}) {
  const href = hrefFor(index, issue);
  const progress = progressOf(index, issue);
  const who = assigneeName(index, issue);
  return (
    <div
      className={cx("gb-row", tree?.context && "gb-ctx", index.waiting.has(issue.id) && "is-w")}
      onClick={(event) => {
        // El enlace cubre la fila; esto cubre los iconos que quedan encima para mostrar su título.
        if (isOwnClick(event)) openHref(href, event);
      }}
    >
      <StatusIcon status={issue.status} />
      <span className="gb-rid">
        {showCompany ? <CompanyTag company={index.companyById.get(issue.companyId)} solid /> : null}
        <span className="gb-mono">{issue.identifier}</span>
      </span>
      <span className="gb-t">
        {tree ? <TreeCell row={tree} onToggle={onToggleTree} /> : null}
        <a
          className={cx("gb-tt gb-cover", tree?.depth === 0 && tree.kidCount > 0 && "is-root")}
          href={href}
          title={issue.title}
          aria-label={`${issue.identifier ?? ""} ${issue.title}`}
        >
          {issue.title}
        </a>
        {index.waiting.has(issue.id) ? <TocaPill /> : null}
        {progress.total > 0 ? (
          <span className="gb-pg">
            <ProgressBar done={progress.done} total={progress.total} width={40} />
            <span className="gb-tnum">
              {progress.done}/{progress.total}
            </span>
          </span>
        ) : null}
      </span>
      <span className="gb-cell">
        <PriorityBadge priority={issue.priority} inline />
      </span>
      <span className="gb-cell">
        <Icon name="folder" size={14} />
        <span>{projectLabel(index, issue.projectId)}</span>
      </span>
      <span className="gb-cell">
        <Avatar name={who} size={18} />
        <span>{who ?? "Sin asignar"}</span>
      </span>
      <span className="gb-upd">{relativeTime(issue.updatedAt, now)}</span>
    </div>
  );
}
