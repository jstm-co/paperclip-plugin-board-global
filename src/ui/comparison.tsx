// Tabla comparativa del Dashboard global (§3.6): una fila por empresa con sus
// números y los 3 gráficos de 14 días como minigráficos en la misma escala,
// más la fila Total. Cada fila abre el Dashboard nativo de su empresa.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { BoardCompany } from "../board.js";
import {
  companySeries,
  dayLabel,
  formatMoney,
  formatRate,
  type CompanyRow,
  type CompanySeries,
  type DashboardModel,
  type DashboardQuery,
  type SortKey,
} from "../dashboard.js";
import { CompanyTag, Skeleton, companyClass, companyStyle, cx, plural } from "./common.js";
import { Icon } from "./icons.js";
import { Layer } from "./layer.js";

type Metric = "runs" | "creadas" | "exito";

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string; name: string; right: boolean }> = [
  { key: "agentes", label: "Activos", name: "agentes activos", right: true },
  { key: "encurso", label: "En curso", name: "tareas en curso", right: true },
  { key: "abiertas", label: "Abiertas", name: "tareas abiertas", right: true },
  { key: "bloq", label: "Bloq.", name: "tareas bloqueadas", right: true },
  { key: "gasto", label: "Gasto", name: "gasto", right: false },
  { key: "aprob", label: "Aprob.", name: "aprobaciones pendientes", right: true },
  { key: "runs", label: "Runs", name: "runs", right: false },
  { key: "creadas", label: "Tareas creadas", name: "tareas creadas", right: false },
  { key: "exito", label: "Éxito", name: "tasa de éxito", right: false },
];

const METRIC_NAMES: Record<Metric, string> = { runs: "Runs", creadas: "Tareas creadas", exito: "Éxito" };

/** Gasto ≥ 90 % del presupuesto y éxito < 80 %: lo único que se marca en rojo (§1). */
const SPEND_HOT_PERCENT = 90;
const SUCCESS_LOW = 0.8;

const SKELETON_BARS = [30, 50, 40, 70, 60, 45, 80, 30, 25, 60, 90, 70, 50, 40];

function barHeight(value: number, max: number): string {
  return `max(2px, ${Math.min(100, (value / max) * 100)}%)`;
}

function sparkLabel(metric: Metric, who: string, days: readonly string[], values: readonly string[], total: string): string {
  const range = days.length > 0 ? `${dayLabel(days[0]!)} a ${dayLabel(days[days.length - 1]!)}` : "";
  return `${METRIC_NAMES[metric]} de ${who}, ${range}: ${values.join(", ")}; total ${total}`;
}

/** Minigráfico de una serie (una empresa, o el éxito de todas en gris). `null` = día sin datos. */
function Spark({
  company,
  values,
  max,
  tipKey,
  label,
}: {
  company: BoardCompany | undefined;
  values: ReadonlyArray<number | null>;
  max: number;
  tipKey: string;
  label: string;
}) {
  return (
    <span className={cx("gb-spark", companyClass(company))} style={companyStyle(company)} role="img" aria-label={label}>
      {values.map((value, day) => (
        <span key={day} className="gb-scol" data-tip={`${tipKey}:${day}`}>
          {value === null ? <i className="gb-zero" /> : <i className="gb-bar1" style={{ height: barHeight(value, max) }} />}
        </span>
      ))}
    </span>
  );
}

/** Columnas apiladas por empresa, de abajo hacia arriba en el orden fijo (fila Total). */
function StackSpark({
  days,
  max,
  tipKey,
  label,
}: {
  days: ReadonlyArray<ReadonlyArray<{ company: BoardCompany; value: number }>>;
  max: number;
  tipKey: string;
  label: string;
}) {
  return (
    <span className="gb-spark" role="img" aria-label={label}>
      {days.map((segments, day) => {
        const total = segments.reduce((sum, segment) => sum + segment.value, 0);
        return (
          <span key={day} className="gb-scol" data-tip={`${tipKey}:${day}`}>
            {total === 0 ? (
              <i className="gb-zero" />
            ) : (
              <span className="gb-stack" style={{ height: barHeight(total, max) }}>
                {segments
                  .filter((segment) => segment.value > 0)
                  .map((segment) => (
                    <i
                      key={segment.company.id}
                      className={companyClass(segment.company)}
                      style={{ flex: `${segment.value} 0 0`, ...companyStyle(segment.company) }}
                    />
                  ))}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function NoData({ metric }: { metric: Metric }) {
  return <span className="gb-nodata">{metric === "creadas" ? "sin tareas nuevas" : "sin runs"}</span>;
}

function SkeletonCells() {
  const number = (
    <span className="gb-r" role="cell">
      <Skeleton width={22} height={12} />
    </span>
  );
  const chart = (
    <span className="gb-ccell" role="cell">
      <span className="gb-spark-sk">
        {SKELETON_BARS.map((height, index) => (
          <Skeleton key={index} width="auto" height={0} style={{ height: `${height}%` }} />
        ))}
      </span>
    </span>
  );
  return (
    <>
      {number}
      {number}
      {number}
      {number}
      <span role="cell">
        <Skeleton width={90} height={12} />
      </span>
      <span className="gb-r" role="cell">
        <Skeleton width={16} height={12} />
      </span>
      {chart}
      {chart}
      {chart}
      <span role="cell" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tooltip: un solo elemento que se reutiliza para todas las barras
// ---------------------------------------------------------------------------

function TipRow({ company, value, label }: { company: BoardCompany | undefined; value: ReactNode; label: ReactNode }) {
  return (
    <div className="gb-tr">
      <i className={cx("gb-k", companyClass(company))} style={companyStyle(company)} />
      <b>{value}</b>
      <span className="gb-l">{label}</span>
    </div>
  );
}

function ChartTip({ anchor, children }: { anchor: DOMRect; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    // Sobre la barra, o debajo si no cabe arriba.
    let top = anchor.top - height - 8;
    if (top < 8) top = anchor.bottom + 8;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, anchor.left + anchor.width / 2 - width / 2));
    if (!pos || pos.left !== left || pos.top !== top) setPos({ left, top });
  });
  return (
    <Layer>
      <div
        ref={ref}
        className="gb-dtip"
        role="tooltip"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
      >
        {children}
      </div>
    </Layer>
  );
}

function openLabel(count: { total: number; byStatus: Partial<Record<string, number>> }): string {
  const open = count.total - (count.byStatus.done ?? 0) - (count.byStatus.cancelled ?? 0);
  return plural(open, "abierta", "abiertas");
}

function successLabel(ok: number, total: number): string {
  return `${ok} de ${total} ${total === 1 ? "exitoso" : "exitosos"}`;
}

// ---------------------------------------------------------------------------
// Tabla
// ---------------------------------------------------------------------------

interface LoadedRow {
  row: CompanyRow;
  series: CompanySeries;
}

export function ComparisonTable({
  model,
  rows,
  query,
  onSort,
  onRetry,
}: {
  model: DashboardModel;
  /** Filas en el orden pedido (`sortRows`). */
  rows: CompanyRow[];
  query: DashboardQuery;
  onSort: (key: SortKey) => void;
  onRetry: (row: CompanyRow) => void;
}) {
  const runDays = model.charts.runActivity.map((day) => day.date);
  const taskDays = model.charts.tasksByStatus.map((day) => day.date);

  // Empresas que respondieron, en el orden fijo de Paperclip (apilado del Total).
  const loaded: LoadedRow[] = useMemo(
    () =>
      model.rows.flatMap((row) => (row.status === "ok" ? [{ row, series: companySeries(model.charts, row.company.id) }] : [])),
    [model],
  );
  const seriesById = useMemo(() => new Map(loaded.map((entry) => [entry.row.company.id, entry.series])), [loaded]);

  // Misma escala en todas las filas: el mayor valor diario entre las empresas cargadas.
  const maxRuns = Math.max(1, ...loaded.flatMap(({ series }) => series.runs.map((day) => day.total)));
  const maxCreated = Math.max(1, ...loaded.flatMap(({ series }) => series.created.map((day) => day.total)));
  const runsByDay = runDays.map((_, day) => loaded.map(({ row, series }) => ({ company: row.company, value: series.runs[day]!.total })));
  const createdByDay = taskDays.map((_, day) =>
    loaded.map(({ row, series }) => ({ company: row.company, value: series.created[day]!.total })),
  );
  const sum = (segments: ReadonlyArray<{ value: number }>) => segments.reduce((total, segment) => total + segment.value, 0);
  const maxRunsTotal = Math.max(1, ...runsByDay.map(sum));
  const maxCreatedTotal = Math.max(1, ...createdByDay.map(sum));

  const liveByCompany = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of model.liveRuns) if (row.isActive) counts.set(row.company.id, (counts.get(row.company.id) ?? 0) + 1);
    return counts;
  }, [model.liveRuns]);

  // Tooltip (§3.6): se arma al pasar sobre una barra. Esc y el scroll lo ocultan.
  const [tip, setTip] = useState<{ key: string; rect: DOMRect } | null>(null);
  const onMouseOver = (event: MouseEvent) => {
    const column = (event.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    const key = column?.dataset.tip;
    if (!column || !key) setTip(null);
    else if (key !== tip?.key) setTip({ key, rect: column.getBoundingClientRect() });
  };
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [tip]);

  const tipContent = (key: string): ReactNode => {
    const [who, metric, dayText] = key.split(":") as [string, Metric, string];
    const day = Number(dayText);
    const date = metric === "creadas" ? taskDays[day] : runDays[day];
    if (date === undefined) return null;
    const when = dayLabel(date, true);
    const companies = who === "total" ? loaded : loaded.filter((entry) => entry.row.company.id === who);
    if (companies.length === 0) return null;
    if (metric === "runs") {
      const total = companies.reduce((acc, { series }) => acc + series.runs[day]!.total, 0);
      return (
        <>
          <div className="gb-h">
            {when} · <b>{plural(total, "run", "runs")}</b>
          </div>
          {companies.map(({ row, series }) => {
            const runs = series.runs[day]!;
            return (
              <TipRow
                key={row.company.id}
                company={row.company}
                value={runs.total}
                label={`${row.company.prefix}${runs.failed > 0 ? ` · ${plural(runs.failed, "fallido", "fallidos")}` : ""}`}
              />
            );
          })}
        </>
      );
    }
    if (metric === "creadas") {
      const total = companies.reduce((acc, { series }) => acc + series.created[day]!.total, 0);
      return (
        <>
          <div className="gb-h">
            {when} · <b>{plural(total, "tarea creada", "tareas creadas")}</b>
          </div>
          {companies.map(({ row, series }) => {
            const created = series.created[day]!;
            return (
              <TipRow
                key={row.company.id}
                company={row.company}
                value={created.total}
                label={`${row.company.prefix}${created.total > 0 ? ` · ${openLabel(created)}` : ""}`}
              />
            );
          })}
        </>
      );
    }
    if (who !== "total") {
      const { row, series } = companies[0]!;
      const rate = series.success[day]!;
      return (
        <>
          <div className="gb-h">
            {when} · {row.company.name}
          </div>
          {rate.rate === null ? (
            <div className="gb-tr">
              <span className="gb-l">Sin runs</span>
            </div>
          ) : (
            <TipRow company={row.company} value={formatRate(rate.rate)} label={successLabel(rate.ok, rate.total)} />
          )}
        </>
      );
    }
    const all = model.charts.successRate[day];
    return (
      <>
        <div className="gb-h">
          {when} ·{" "}
          {all && all.rate !== null ? (
            <>
              <b>{formatRate(all.rate)}</b> de éxito
            </>
          ) : (
            "Sin runs"
          )}
        </div>
        {companies.map(({ row, series }) => {
          const rate = series.success[day]!;
          return (
            <TipRow
              key={row.company.id}
              company={row.company}
              value={rate.rate === null ? "—" : formatRate(rate.rate)}
              label={`${row.company.prefix} · ${rate.rate === null ? "sin runs" : successLabel(rate.ok, rate.total)}`}
            />
          );
        })}
      </>
    );
  };

  const waiting = model.rows.filter((row) => row.status === "wait").length;
  const listing = model.rows.length === 0;
  const first = runDays[0];
  const last = runDays[runDays.length - 1];

  return (
    <div className="gb-ctab" role="table" aria-label="Comparativa por empresa" onMouseOver={onMouseOver} onMouseLeave={() => setTip(null)}>
      <div className="gb-ctr gb-cg" aria-hidden="true">
        <span />
        <span className="gb-g" style={{ gridColumn: "2 / 3" }}>
          Agentes
        </span>
        <span className="gb-g" style={{ gridColumn: "3 / 6" }}>
          Tareas
        </span>
        <span className="gb-g" style={{ gridColumn: "6 / 8" }}>
          Mes
        </span>
        <span className="gb-g" style={{ gridColumn: "8 / 11" }}>
          Últimos 14 días{first && last ? ` · ${dayLabel(first)} → ${dayLabel(last)}` : ""}
        </span>
        <span />
      </div>
      <div className="gb-ctr gb-cth" role="row">
        <span role="columnheader">Empresa</span>
        {COLUMNS.map((column) => {
          const on = query.ord === column.key;
          const asc = on && query.dir === "asc";
          return (
            <span
              key={column.key}
              role="columnheader"
              className={cx(column.right && "gb-r")}
              aria-sort={on ? (asc ? "ascending" : "descending") : "none"}
            >
              <button
                type="button"
                className={cx("gb-csort", on && "is-on")}
                aria-label={`Ordenar por ${column.name}`}
                title={`Ordenar por ${column.name}`}
                onClick={() => onSort(column.key)}
              >
                {column.label}
                {on ? (
                  <Icon name={asc ? "arrow-up" : "arrow-down"} size={12} />
                ) : (
                  <span className="gb-csorti">
                    <Icon name="arrow-up-down" size={12} />
                  </span>
                )}
              </button>
            </span>
          );
        })}
        <span role="columnheader">
          <span className="gb-sr">Abrir</span>
        </span>
      </div>

      {listing
        ? [0, 1, 2, 3].map((index) => (
            <div key={index} className="gb-ctr gb-crow" role="row">
              <span className="gb-cname" role="cell">
                <Skeleton width={30} height={20} />
                <Skeleton width={80} height={12} />
              </span>
              <SkeletonCells />
            </div>
          ))
        : rows.map((row) => (
            <CompanyRowView
              key={row.company.id}
              row={row}
              series={seriesById.get(row.company.id)}
              maxRuns={maxRuns}
              maxCreated={maxCreated}
              runDays={runDays}
              taskDays={taskDays}
              live={liveByCompany.get(row.company.id) ?? 0}
              onRetry={() => onRetry(row)}
            />
          ))}

      {listing || waiting > 0 ? (
        <div className="gb-ctr gb-ctot" role="row">
          <span className="gb-cname" role="cell">
            <b>Total</b>
            <small>{listing ? "cargando…" : `esperando a ${plural(waiting, "empresa", "empresas")}`}</small>
          </span>
          <SkeletonCells />
        </div>
      ) : (
        <TotalRow
          model={model}
          loaded={loaded}
          runDays={runDays}
          taskDays={taskDays}
          runsByDay={runsByDay}
          createdByDay={createdByDay}
          maxRuns={maxRunsTotal}
          maxCreated={maxCreatedTotal}
        />
      )}

      {tip ? <ChartTip anchor={tip.rect}>{tipContent(tip.key)}</ChartTip> : null}
    </div>
  );
}

function CompanyRowView({
  row,
  series,
  maxRuns,
  maxCreated,
  runDays,
  taskDays,
  live,
  onRetry,
}: {
  row: CompanyRow;
  series: CompanySeries | undefined;
  maxRuns: number;
  maxCreated: number;
  runDays: string[];
  taskDays: string[];
  live: number;
  onRetry: () => void;
}) {
  const { company, metrics } = row;
  const name = (extra?: ReactNode) => (
    <span className="gb-cname" role="cell">
      <CompanyTag company={company} solid />
      <b>{company.name}</b>
      {extra}
    </span>
  );

  if (row.status === "wait" || (row.status === "ok" && (!metrics || !series))) {
    return (
      <div className="gb-ctr gb-crow" role="row">
        {name(
          <span className="gb-spin" title={`${company.name}: cargando…`}>
            <Icon name="loader" size={12} />
          </span>,
        )}
        <SkeletonCells />
      </div>
    );
  }

  if (row.status === "err" || !metrics || !series) {
    return (
      <div className="gb-ctr gb-crow" role="row" title={row.error ?? undefined}>
        {name()}
        <span className="gb-cerr" role="cell">
          <Icon name="circle-alert" size={14} />
          No respondió. Sus números no están en los totales.
          <button type="button" className="gb-linkbtn" onClick={onRetry}>
            Reintentar
          </button>
        </span>
        <span role="cell" />
      </div>
    );
  }

  const percent = row.monthUtilizationPercent;
  const hot = percent !== null && percent >= SPEND_HOT_PERCENT;
  const incident = metrics.budgetIncidents > 0;
  const rate = series.rate.rate;

  return (
    <a
      className={cx("gb-ctr gb-crow", incident && "is-inc")}
      href={row.dashboardHref}
      title={`Abrir el Dashboard de ${company.name}`}
      role="row"
    >
      {name(live > 0 ? <span className="gb-live" title={`${live} en vivo`} /> : null)}
      <span className="gb-r gb-cag" role="cell">
        <b>{metrics.agentsEnabled}</b>
        {metrics.agentsError > 0 ? (
          <small className="gb-bad">{metrics.agentsError} con error</small>
        ) : (
          <small>{metrics.agentsRunning} corriendo</small>
        )}
      </span>
      <span className="gb-r" role="cell">
        <b>{metrics.tasksInProgress}</b>
      </span>
      <span className="gb-r" role="cell">
        {metrics.tasksOpen}
      </span>
      <span className="gb-r" role="cell">
        {metrics.tasksBlocked}
      </span>
      <span className="gb-cspend" role="cell">
        <span className="gb-top">
          <b>{formatMoney(metrics.monthSpendCents)}</b>
          <small className={cx(hot && "gb-bad")}>{percent === null ? "sin límite" : `${Math.round(percent)}%`}</small>
        </span>
        {percent === null ? (
          <span className="gb-meter is-none" />
        ) : (
          <span className={cx("gb-meter", hot && "is-hot")}>
            <i style={{ width: `${Math.min(100, percent)}%` }} />
          </span>
        )}
        {incident ? (
          <small className="gb-bad gb-cinc">
            <Icon name="triangle-alert" size={12} />
            incidente de presupuesto
          </small>
        ) : null}
      </span>
      <span className="gb-r" role="cell">
        {metrics.pendingApprovals}
      </span>
      <span className="gb-ccell" role="cell">
        {series.runsTotal > 0 ? (
          <>
            <Spark
              company={company}
              values={series.runs.map((day) => day.total || null)}
              max={maxRuns}
              tipKey={`${company.id}:runs`}
              label={sparkLabel("runs", company.name, runDays, series.runs.map((day) => String(day.total)), String(series.runsTotal))}
            />
            <span className="gb-n">{series.runsTotal}</span>
          </>
        ) : (
          <NoData metric="runs" />
        )}
      </span>
      <span className="gb-ccell" role="cell">
        {series.createdTotal > 0 ? (
          <>
            <Spark
              company={company}
              values={series.created.map((day) => day.total || null)}
              max={maxCreated}
              tipKey={`${company.id}:creadas`}
              label={sparkLabel(
                "creadas",
                company.name,
                taskDays,
                series.created.map((day) => String(day.total)),
                String(series.createdTotal),
              )}
            />
            <span className="gb-n">{series.createdTotal}</span>
          </>
        ) : (
          <NoData metric="creadas" />
        )}
      </span>
      <span className="gb-ccell" role="cell">
        {rate !== null ? (
          <>
            <Spark
              company={company}
              values={series.success.map((day) => day.rate)}
              max={1}
              tipKey={`${company.id}:exito`}
              label={sparkLabel(
                "exito",
                company.name,
                runDays,
                series.success.map((day) => (day.rate === null ? "sin runs" : formatRate(day.rate))),
                formatRate(rate),
              )}
            />
            <span className={cx("gb-n", rate < SUCCESS_LOW && "gb-bad")}>{formatRate(rate)}</span>
          </>
        ) : (
          <NoData metric="exito" />
        )}
      </span>
      <span className="gb-cgo" role="cell">
        <Icon name="chevron-right" size={14} />
      </span>
    </a>
  );
}

function TotalRow({
  model,
  loaded,
  runDays,
  taskDays,
  runsByDay,
  createdByDay,
  maxRuns,
  maxCreated,
}: {
  model: DashboardModel;
  loaded: LoadedRow[];
  runDays: string[];
  taskDays: string[];
  runsByDay: Array<Array<{ company: BoardCompany; value: number }>>;
  createdByDay: Array<Array<{ company: BoardCompany; value: number }>>;
  maxRuns: number;
  maxCreated: number;
}) {
  const { totals } = model;
  const who = plural(loaded.length, "empresa", "empresas");
  const runsAll = loaded.reduce((acc, { series }) => acc + series.runsTotal, 0);
  const createdAll = loaded.reduce((acc, { series }) => acc + series.createdTotal, 0);
  const okAll = loaded.reduce((acc, { series }) => acc + series.rate.ok, 0);
  const rateAll = runsAll > 0 ? okAll / runsAll : null;
  const daySums = (days: Array<Array<{ value: number }>>) => days.map((segments) => String(segments.reduce((acc, s) => acc + s.value, 0)));

  return (
    <div className="gb-ctr gb-ctot" role="row">
      <span className="gb-cname" role="cell">
        <b>Total</b>
        <small>{who}</small>
      </span>
      <span className="gb-r" role="cell">
        <b>{totals.agentsEnabled}</b>
      </span>
      <span className="gb-r" role="cell">
        <b>{totals.tasksInProgress}</b>
      </span>
      <span className="gb-r" role="cell">
        <b>{totals.tasksOpen}</b>
      </span>
      <span className="gb-r" role="cell">
        <b>{totals.tasksBlocked}</b>
      </span>
      <span className="gb-cspend" role="cell">
        <span className="gb-top">
          <b>{formatMoney(totals.monthSpendCents)}</b>
          <small>{totals.monthUtilizationPercent === null ? "sin límite" : `${Math.round(totals.monthUtilizationPercent)}%`}</small>
        </span>
      </span>
      <span className="gb-r" role="cell">
        <b>{totals.pendingApprovals}</b>
      </span>
      <span className="gb-ccell" role="cell">
        {runsAll > 0 ? (
          <>
            <StackSpark
              days={runsByDay}
              max={maxRuns}
              tipKey="total:runs"
              label={sparkLabel("runs", `las ${who}`, runDays, daySums(runsByDay), String(runsAll))}
            />
            <span className="gb-n">
              <b>{runsAll}</b>
            </span>
          </>
        ) : (
          <NoData metric="runs" />
        )}
      </span>
      <span className="gb-ccell" role="cell">
        {createdAll > 0 ? (
          <>
            <StackSpark
              days={createdByDay}
              max={maxCreated}
              tipKey="total:creadas"
              label={sparkLabel("creadas", `las ${who}`, taskDays, daySums(createdByDay), String(createdAll))}
            />
            <span className="gb-n">
              <b>{createdAll}</b>
            </span>
          </>
        ) : (
          <NoData metric="creadas" />
        )}
      </span>
      <span className="gb-ccell" role="cell">
        {rateAll !== null ? (
          <>
            <Spark
              company={undefined}
              values={model.charts.successRate.map((day) => day.rate)}
              max={1}
              tipKey="total:exito"
              label={sparkLabel(
                "exito",
                `las ${who}`,
                runDays,
                model.charts.successRate.map((day) => (day.rate === null ? "sin runs" : formatRate(day.rate))),
                formatRate(rateAll),
              )}
            />
            <span className={cx("gb-n", rateAll < SUCCESS_LOW && "gb-bad")}>
              <b>{formatRate(rateAll)}</b>
            </span>
          </>
        ) : (
          <NoData metric="exito" />
        )}
      </span>
      <span role="cell" />
    </div>
  );
}
