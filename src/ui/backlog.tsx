// Vista Backlog (JST-407): lo que todavía no entra al Board, en una lista por
// empresa, y arriba lo que ya está en «Por hacer». Pasar una tarea de un lado
// al otro (arrastrando o con el botón de la fila) solo cambia su estado.
import { useMemo, useState, type DragEvent } from "react";
import { relativeTime, sortIssues, type BoardIndex } from "../board.js";
import type { BoardIssue, IssueStatus } from "../shared.js";
import { ContextChip, SubtaskCount, hrefFor } from "./card.js";
import { Avatar, CompanyTag, PriorityIcon, StatusIcon, TocaPill, assigneeName, companyClass, companyStyle, cx, isOwnClick, plural } from "./common.js";
import { CreateSlot, MarkPill, markClass, useMark } from "./create.js";
import { Icon } from "./icons.js";
import { useOpenTask } from "./open.js";

const TODO_SHOWN = 8;
const GROUP_SHOWN = 15;
const MORE_STEP = 25;

type Zone = "todo" | "backlog";

export function BacklogView({
  index,
  issues,
  now,
  collapsed,
  more,
  dragging,
  onToggleGroup,
  onMore,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  index: BoardIndex;
  /** Las tareas filtradas en Backlog o en Por hacer. */
  issues: BoardIssue[];
  now: number;
  collapsed: ReadonlySet<string>;
  more: Readonly<Record<string, number>>;
  dragging: BoardIssue | null;
  onToggleGroup: (key: string) => void;
  onMore: (key: string, next: number) => void;
  onMove: (issue: BoardIssue, to: IssueStatus) => void;
  onDragStart: (issue: BoardIssue) => void;
  onDragEnd: () => void;
}) {
  const [dropOn, setDropOn] = useState<Zone | null>(null);
  const todo = useMemo(() => sortIssues(index, issues.filter((issue) => issue.status === "todo")), [index, issues]);
  const groups = useMemo(() => {
    const backlog = issues.filter((issue) => issue.status === "backlog");
    return index.companies
      .map((company) => ({ company, issues: sortIssues(index, backlog.filter((issue) => issue.companyId === company.id)) }))
      .filter((group) => group.issues.length > 0);
  }, [index, issues]);
  const backlogCount = groups.reduce((sum, group) => sum + group.issues.length, 0);

  // Cada zona recibe solo lo que viene de la otra.
  const zoneHandlers = (zone: Zone) => {
    const accepts = dragging !== null && dragging.status !== zone;
    return {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!accepts) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dropOn !== zone) setDropOn(zone);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropOn((current) => (current === zone ? null : current));
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDropOn(null);
        if (accepts && dragging) onMove(dragging, zone);
      },
    };
  };

  const todoKey = "bk:todo";
  const todoLimit = more[todoKey] ?? TODO_SHOWN;

  return (
    <div className="gb-list gb-backlog" onDragEnd={() => setDropOn(null)}>
      <section
        className={cx("gb-lgrp is-plain gb-bktop", dragging?.status === "backlog" && "is-target", dropOn === "todo" && "gb-drop-on")}
        aria-label="En el Board · Por hacer"
        {...zoneHandlers("todo")}
      >
        <div className="gb-grph gb-bkhead">
          <StatusIcon status="todo" />
          <span className="gb-nm">En el Board · Por hacer</span>
          <span className="gb-muted" style={{ fontSize: 12 }}>
            {plural(todo.length, "tarea", "tareas")}
          </span>
          <span className="gb-bkhint">
            <Icon name="arrow-up" size={12} />
            Arrastra aquí lo próximo que quieres que entre al Board
          </span>
        </div>
        {todo.length === 0 ? (
          <div className="gb-bkempty">Nada en «Por hacer» con estos filtros. Arrastra una tarea del Backlog o usa su botón «Pasar a Por hacer».</div>
        ) : (
          todo.slice(0, todoLimit).map((issue) => (
            <BacklogRow
              key={issue.id}
              index={index}
              issue={issue}
              now={now}
              showCompany
              dragging={dragging?.id === issue.id}
              onMove={onMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
        {todo.length > todoLimit ? (
          <div className="gb-rowmore">
            <button type="button" className="gb-linkbtn" onClick={() => onMore(todoKey, todoLimit + MORE_STEP)}>
              Ver {Math.min(MORE_STEP, todo.length - todoLimit)} más · quedan {todo.length - todoLimit}
            </button>
          </div>
        ) : null}
      </section>

      <div
        className={cx("gb-bkzone", dragging?.status === "todo" && "is-target", dropOn === "backlog" && "gb-drop-on")}
        {...zoneHandlers("backlog")}
      >
        <div className="gb-bktitle">
          <StatusIcon status="backlog" />
          <b>Backlog</b>
          <span className="gb-muted">{plural(backlogCount, "tarea", "tareas")} que todavía no entran al Board</span>
        </div>
        {groups.length === 0 ? <div className="gb-bkempty is-box">No hay tareas en el Backlog con estos filtros.</div> : null}
        {groups.map(({ company, issues: rows }) => {
          const key = `bk:${company.id}`;
          const closed = collapsed.has(key);
          const limit = more[key] ?? GROUP_SHOWN;
          const toca = rows.filter((issue) => index.waiting.has(issue.id)).length;
          return (
            <section key={company.id} className={cx("gb-lgrp", closed && "is-closed", companyClass(company))} style={companyStyle(company)}>
              <button type="button" className="gb-grph" aria-expanded={!closed} onClick={() => onToggleGroup(key)}>
                <span className="gb-chev">
                  <Icon name="chevron-down" size={14} />
                </span>
                <CompanyTag company={company} solid large />
                <span className="gb-nm">{company.name}</span>
                <span className="gb-muted" style={{ fontSize: 12 }}>
                  {plural(rows.length, "tarea", "tareas")}
                </span>
                {toca > 0 ? <TocaPill small label={`${toca} te ${toca === 1 ? "toca" : "tocan"}`} /> : null}
              </button>
              {closed ? null : (
                <>
                  {rows.slice(0, limit).map((issue) => (
                    <BacklogRow
                      key={issue.id}
                      index={index}
                      issue={issue}
                      now={now}
                      dragging={dragging?.id === issue.id}
                      onMove={onMove}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                  {rows.length > limit ? (
                    <div className="gb-rowmore">
                      <button type="button" className="gb-linkbtn" onClick={() => onMore(key, limit + MORE_STEP)}>
                        Ver {Math.min(MORE_STEP, rows.length - limit)} más · quedan {rows.length - limit}
                      </button>
                    </div>
                  ) : null}
                  <CreateSlot origin={{ surface: "group", status: "backlog", by: "empresa", key: company.id }} groupLabel={`el Backlog de ${company.name}`} />
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BacklogRow({
  index,
  issue,
  now,
  showCompany = false,
  dragging,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  index: BoardIndex;
  issue: BoardIssue;
  now: number;
  showCompany?: boolean;
  dragging: boolean;
  onMove: (issue: BoardIssue, to: IssueStatus) => void;
  onDragStart: (issue: BoardIssue) => void;
  onDragEnd: () => void;
}) {
  const href = hrefFor(index, issue);
  const who = assigneeName(index, issue);
  const mark = useMark(issue.id);
  const openTask = useOpenTask();
  const toTodo = issue.status === "backlog";
  const hot = issue.priority === "critical" || issue.priority === "high";
  const moveLabel = toTodo ? "Pasar a Por hacer" : "Devolver al Backlog";
  return (
    <div
      data-iid={issue.id}
      className={cx("gb-row gb-bkrow", markClass(mark), index.waiting.has(issue.id) && "is-w", dragging && "gb-dragging")}
      draggable
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", issue.id);
        onDragStart(issue);
      }}
      onDragEnd={onDragEnd}
      onClick={(event) => {
        if (isOwnClick(event)) openTask.row(issue, href, event);
      }}
    >
      <StatusIcon status={issue.status} />
      <span className="gb-rid">
        {showCompany ? <CompanyTag company={index.companyById.get(issue.companyId)} solid /> : null}
        <span className="gb-mono">{issue.identifier}</span>
      </span>
      <span className="gb-t">
        <a className="gb-tt gb-cover" href={href} draggable={false} title={issue.title} aria-label={`${issue.identifier ?? ""} ${issue.title}`} onClick={openTask.link(issue)}>
          {issue.title}
        </a>
        <MarkPill mark={mark} />
        {index.waiting.has(issue.id) ? <TocaPill /> : null}
        <ContextChip index={index} issue={issue} />
      </span>
      <span className="gb-bkmeta">
        {hot ? <PriorityIcon priority={issue.priority} /> : null}
        <SubtaskCount index={index} issue={issue} />
        <Avatar name={who} size={20} />
      </span>
      <span className="gb-upd">{relativeTime(issue.updatedAt, now)}</span>
      <button type="button" className="gb-bkmove" title={moveLabel} aria-label={`${moveLabel}: ${issue.identifier ?? issue.title}`} onClick={() => onMove(issue, toTodo ? "todo" : "backlog")}>
        <Icon name={toTodo ? "arrow-up" : "arrow-down"} size={14} />
        <span>{toTodo ? "Por hacer" : "Backlog"}</span>
      </button>
    </div>
  );
}
