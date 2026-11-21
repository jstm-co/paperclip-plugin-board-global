// Board (JST-407, sobre los carriles de JST-21 §4): una grilla carril × columna
// con la cabecera de cada carril arriba, a lo ancho. Las columnas son los
// estados del Board y «Por confirmar»; arrastrar solo cambia el estado y solo
// dentro del mismo carril. Sin agrupar es un único carril sin cabecera.
import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  CONFIRM_COLUMN,
  FLAT_LANE,
  NO_PROJECT,
  UNASSIGNED,
  assigneeLabel,
  columnOf,
  hiddenLaneCount,
  kanbanFlat,
  kanbanLanes,
  laneKeyOf,
  type BoardColumn,
  type BoardIndex,
  type BoardQuery,
  type KanbanLane,
  type LaneBy,
} from "../board.js";
import { t } from "../i18n.js";
import { tx } from "./i18n.js";
import type { BoardIssue, IssueStatus } from "../shared.js";
import { Card } from "./card.js";
import { Avatar, CompanyTag, STATUS_LABELS, Skeleton, TocaPill, companyClass, companyStyle, cx, plural } from "./common.js";
import { CreateSlot } from "./create.js";
import { LANE_META } from "./filters.js";
import { Icon } from "./icons.js";
import { Layer } from "./layer.js";

/** Con carriles, 2 tarjetas por celda: así se ve más de un carril a la vez (§4.2). Sin agrupar hay un solo carril. */
const PER_CELL = 2;
const PER_CELL_FLAT = 6;
const MORE_STEP = 20;
/**
 * Ancho mínimo de una columna: por debajo, el board se desplaza hacia el lado.
 * Con «Por confirmar» son cinco columnas, y a 200 px caben sin scroll lateral
 * en una pantalla de 1440 px con el menú de Paperclip abierto.
 */
const MIN_COL = 200;
const COL_GAP = 10;

export const COLUMN_LABELS: Record<BoardColumn, string> = { ...STATUS_LABELS, [CONFIRM_COLUMN]: t("Por confirmar") };
const CONFIRM_HELP = t(
  "Tareas que alguien cerró (hechas o canceladas) y todavía no confirmas. En Paperclip ya están cerradas: aquí esperan tu visto bueno.",
);

/** Clave de estado de la vista (carriles plegados y «Ver N más»): cambia con el tipo de carril. */
export const laneUiKey = (laneBy: LaneBy | null, key: string) => `${laneBy ?? "flat"}:${key}`;

/** Carriles del Board con la consulta de ahora: por el tipo elegido, o uno solo sin agrupar. */
export function boardLanes(
  index: BoardIndex,
  issues: readonly BoardIssue[],
  laneBy: LaneBy | null,
  columns: readonly BoardColumn[],
  pending: ReadonlySet<string>,
): KanbanLane[] {
  return laneBy ? kanbanLanes(index, issues, laneBy, columns, pending) : kanbanFlat(index, issues, columns, pending);
}

function laneName(index: BoardIndex, lane: KanbanLane, laneBy: LaneBy) {
  const company = lane.companyId ? index.companyById.get(lane.companyId) : undefined;
  if (laneBy === "empresa") {
    return (
      <>
        <CompanyTag company={company} solid />
        <span className="gb-nm">{company?.name ?? lane.label}</span>
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
        <span className="gb-nm">{lane.label}</span>
      </>
    );
  }
  if (laneBy === "proyecto") {
    return (
      <>
        <CompanyTag company={company} solid />
        <span className="gb-nm">{lane.label}</span>
      </>
    );
  }
  return (
    <>
      <Avatar name={assigneeLabel(index, lane.key)} size={18} />
      <span className="gb-nm">{lane.label}</span>
    </>
  );
}

export function LaneBoard({
  index,
  issues,
  query,
  laneBy,
  columns,
  pending,
  closedCount,
  more,
  closedLanes,
  dragging,
  onToggleLane,
  onMore,
  onShowClosed,
  onDragStart,
  onDragEnd,
  onDrop,
  onDropConfirm,
  onBadDrop,
  onConfirm,
  onConfirmAll,
  onPeek,
}: {
  index: BoardIndex;
  issues: BoardIssue[];
  query: BoardQuery;
  /** `null`: sin agrupar. */
  laneBy: LaneBy | null;
  columns: readonly BoardColumn[];
  /** Tareas cerradas que esperan confirmación: van en la columna «Por confirmar». */
  pending: ReadonlySet<string>;
  /** Hechas y canceladas ya confirmadas, con los filtros de ahora: el número del botón que las muestra. */
  closedCount: number;
  /** Tarjetas visibles por celda cuando se pidió «Ver N más». */
  more: Readonly<Record<string, number>>;
  /** Carriles plegados (`laneUiKey`). En memoria: no van a la URL ni a la vista (§4.3). */
  closedLanes: ReadonlySet<string>;
  dragging: BoardIssue | null;
  onToggleLane: (key: string) => void;
  onMore: (key: string, next: number) => void;
  onShowClosed: () => void;
  onDragStart: (issue: BoardIssue) => void;
  onDragEnd: () => void;
  onDrop: (status: IssueStatus) => void;
  /** Una tarjeta de «Por confirmar» se soltó en «Hechas y canceladas». */
  onDropConfirm: () => void;
  /** Se soltó en otro carril o en «Por confirmar»: no cambia nada (§4.4). */
  onBadDrop: () => void;
  onConfirm: (issue: BoardIssue) => void;
  onConfirmAll: (issues: BoardIssue[]) => void;
  onPeek: (issue: BoardIssue | null, element?: HTMLElement) => void;
}) {
  const [dropOn, setDropOn] = useState<string | null>(null);
  const badOver = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const { filters } = query;
  const lanes = boardLanes(index, issues, laneBy, columns, pending);
  const hidden = laneBy ? hiddenLaneCount(index, lanes, laneBy, filters.emp) : 0;
  const meta = laneBy ? LANE_META[laneBy] : null;
  const gridStyle = { "--gcols": `repeat(${columns.length}, minmax(0, 1fr))` } as CSSProperties;
  const minWidth = columns.length * MIN_COL + (columns.length - 1) * COL_GAP;
  const dragLane = dragging ? (laneBy ? laneKeyOf(dragging, laneBy) : FLAT_LANE) : null;
  const dragLaneName = dragLane ? (lanes.find((lane) => lane.key === dragLane)?.label ?? "") : "";
  const dragPending = dragging ? pending.has(dragging.id) : false;
  const perCell = laneBy ? PER_CELL : PER_CELL_FLAT;
  const showRail = !query.showClosed && filters.est.length === 0;

  const cellHandlers = (laneKey: string, column: BoardColumn) => {
    const key = `${laneKey}|${column}`;
    if (column === CONFIRM_COLUMN || (dragLane !== null && laneKey !== dragLane)) {
      // Otro carril o «Por confirmar»: sin `preventDefault`, el navegador muestra «no permitido».
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
        if (dragging) onDrop(column);
      },
    };
  };

  const box = boxRef.current?.getBoundingClientRect();
  const hintLeft = box ? box.left + box.width / 2 : undefined;

  return (
    <div
      className="gb-lanewrap"
      onDragEnd={(event) => {
        setDropOn(null);
        if (badOver.current && event.dataTransfer.dropEffect === "none") onBadDrop();
        badOver.current = false;
      }}
    >
      <div ref={boxRef} className={cx("gb-lanes", dragLane !== null && "is-dragging")} style={{ "--gminw": `${minWidth}px` } as CSSProperties}>
        <div className="gb-grid gb-lhead" style={gridStyle}>
          {columns.map((column) => {
            const items = issues.filter((issue) => columnOf(issue, pending) === column);
            return (
              <div key={column} className="gb-colh" data-s={column} title={column === CONFIRM_COLUMN ? CONFIRM_HELP : undefined}>
                <span className="gb-name">{COLUMN_LABELS[column]}</span>
                <span className="gb-cnt gb-tnum">{items.length}</span>
                {column === CONFIRM_COLUMN && items.length > 1 ? (
                  <button
                    type="button"
                    className="gb-colact"
                    title={t("Confirmar las {n} de una vez", { n: items.length })}
                    aria-label={t("Confirmar las {n} tareas de «Por confirmar»", { n: items.length })}
                    onClick={() => onConfirmAll(items)}
                  >
                    <Icon name="check" size={12} />
                    {t("Todas")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {lanes.map((lane) => {
          const uiKey = laneUiKey(laneBy, lane.key);
          const closed = laneBy !== null && closedLanes.has(uiKey);
          const company = lane.companyId ? index.companyById.get(lane.companyId) : undefined;
          const toca = lane.cells.reduce((sum, cell) => sum + cell.issues.filter((issue) => index.waiting.has(issue.id)).length, 0);
          const agentCompany =
            laneBy === "responsable" && lane.key.startsWith("agent:")
              ? index.companyById.get(index.agentById.get(lane.key.slice("agent:".length))?.companyId ?? "")
              : undefined;
          const label = laneBy ? lane.label : t("Board");
          return (
            <section
              key={lane.key}
              className={cx(
                "gb-lane",
                closed && "is-closed",
                !laneBy && "is-flat",
                company ? companyClass(company) : "is-nocol",
                dragLane !== null && (lane.key === dragLane ? "is-src" : "is-other"),
              )}
              style={companyStyle(company)}
              aria-label={label}
            >
              {laneBy ? (
                <div className="gb-lanehead">
                  <button
                    type="button"
                    className="gb-lanebtn"
                    aria-expanded={!closed}
                    title={closed ? t("Desplegar el carril") : t("Plegar el carril")}
                    onClick={() => onToggleLane(uiKey)}
                  >
                    <span className="gb-chev">
                      <Icon name="chevron-down" size={14} />
                    </span>
                    {laneName(index, lane, laneBy)}
                    {agentCompany ? <CompanyTag company={agentCompany} /> : null}
                    <span className="gb-meta">{plural(lane.total, "tarea", "tareas")}</span>
                    {toca > 0 ? <TocaPill label={t("Te toca {n}", { n: toca })} small /> : null}
                  </button>
                </div>
              ) : null}
              {closed ? null : (
                <div className="gb-grid" style={gridStyle}>
                  {lane.cells.map((cell) => {
                    const moreKey = `ln:${uiKey}:${cell.status}`;
                    const limit = more[moreKey] ?? perCell;
                    const isConfirm = cell.status === CONFIRM_COLUMN;
                    const same = !isConfirm && (dragLane === null || lane.key === dragLane);
                    return (
                      <div
                        key={cell.status}
                        className={cx(
                          "gb-cell",
                          dragLane !== null && (same ? "is-ok" : "is-nodrop"),
                          dropOn === `${lane.key}|${cell.status}` && "gb-drop-on",
                        )}
                        data-s={cell.status}
                        aria-label={`${label} · ${COLUMN_LABELS[cell.status]}`}
                        {...cellHandlers(lane.key, cell.status)}
                      >
                        {cell.issues.slice(0, limit).map((issue) => (
                          <Card
                            key={issue.id}
                            index={index}
                            issue={issue}
                            pending={isConfirm}
                            dragging={dragging?.id === issue.id}
                            onConfirm={onConfirm}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onPeek={onPeek}
                          />
                        ))}
                        {cell.issues.length > limit ? (
                          <button type="button" className="gb-more" onClick={() => onMore(moreKey, limit + MORE_STEP)}>
                            {t("Ver {n} más", { n: cell.issues.length - limit })}
                          </button>
                        ) : null}
                        {cell.status === CONFIRM_COLUMN ? null : (
                          <CreateSlot
                            origin={laneBy ? { surface: "cell", status: cell.status, by: laneBy, key: lane.key } : { surface: "cell", status: cell.status }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {hidden > 0 && meta ? (
          <div className="gb-lnote">
            <Icon name="info" size={12} />
            {hidden === 1
              ? t("1 {name} sin tareas en estas columnas no se muestra.", { name: meta.label.toLowerCase() })
              : t("{n} {name} sin tareas en estas columnas no se muestran.", { n: hidden, name: meta.plural })}
          </div>
        ) : null}
      </div>
      {showRail ? (
        <button
          type="button"
          className={cx("gb-closedtoggle", dragPending && "is-drop", dropOn === "rail" && "gb-drop-on")}
          onClick={onShowClosed}
          title={dragPending ? t("Suelta aquí para confirmarla") : t("Mostrar las columnas Hecha y Cancelada")}
          onDragOver={(event) => {
            if (!dragPending) {
              badOver.current = true;
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            badOver.current = false;
            if (dropOn !== "rail") setDropOn("rail");
          }}
          onDragLeave={() => setDropOn((current) => (current === "rail" ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            setDropOn(null);
            badOver.current = false;
            if (dragPending) onDropConfirm();
          }}
        >
          <Icon name={dragPending ? "check" : "eye"} size={14} />
          {dragPending ? t("Suelta aquí para confirmar") : t("Hechas y canceladas · {n}", { n: closedCount })}
        </button>
      ) : null}

      {dragLane !== null && (dragPending || laneBy) ? (
        <Layer>
          <div className="gb-draghint" style={hintLeft === undefined ? undefined : { left: hintLeft }} role="status">
            <Icon name={dragPending ? "check" : "lock"} size={14} />
            <span>
              {dragPending
                ? tx("Suéltala en {column} para confirmarla, o en una columna abierta para reabrirla.", {
                    column: <b>{showRail ? t("Hechas y canceladas") : COLUMN_LABELS[dragging!.status]}</b>,
                  })
                : laneBy === "empresa"
                  ? tx("Suelta en una columna de {lane}. Una tarea no puede pasar a otra empresa.", { lane: <b>{dragLaneName}</b> })
                  : tx("Suelta dentro de {lane}. Arrastrar cambia el estado, no {what}.", { lane: <b>{dragLaneName}</b>, what: meta?.what ?? "" })}
            </span>
          </div>
        </Layer>
      ) : null}
    </div>
  );
}

/** Toast al soltar donde no se puede: otro carril (§4.4) o la columna «Por confirmar». */
export function badDropMessage(laneBy: LaneBy | null): string {
  if (!laneBy) return t("Ahí no se puede soltar: «Por confirmar» se llena sola con lo que se cierra.");
  return laneBy === "empresa"
    ? t("Solo se suelta dentro de su empresa: una tarea no puede pasar a otra.")
    : t("Solo se suelta dentro del mismo carril. Para cambiar {what}, abre la tarea.", { what: LANE_META[laneBy].what });
}

/** Esqueleto de carga: las columnas del Board y dos carriles con tarjetas (§4.1). */
export function BoardSkeleton() {
  const gridStyle = { "--gcols": "repeat(4, minmax(0, 1fr))" } as CSSProperties;
  return (
    <div className="gb-lanewrap" aria-busy="true" aria-label={t("Cargando tareas")}>
      <div className="gb-lanes" style={{ "--gminw": "0px" } as CSSProperties}>
        <div className="gb-grid gb-lhead" style={gridStyle}>
          {[0, 1, 2, 3].map((column) => (
            <div key={column} className="gb-colh">
              <Skeleton width={84} height={10} />
            </div>
          ))}
        </div>
        {[
          [2, 1, 1, 2],
          [1, 2, 0, 2],
        ].map((cells, lane) => (
          <section key={lane} className="gb-lane is-nocol">
            <div className="gb-lanehead">
              <span className="gb-lanebtn" style={{ cursor: "default" }}>
                <Skeleton width={150} height={12} />
              </span>
            </div>
            <div className="gb-grid" style={gridStyle}>
              {cells.map((count, column) => (
                <div key={column} className="gb-cell">
                  {Array.from({ length: count }, (_, i) => (
                    <div key={i} className="gb-card" style={{ cursor: "default" }}>
                      <Skeleton width={`${92 - ((i + column) % 3) * 12}%`} height={10} />
                      <Skeleton width="58%" height={10} style={{ marginTop: 7 }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Skeleton width={64} height={9} />
                        <Skeleton width={20} height={20} style={{ marginLeft: "auto", borderRadius: 10 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
