// Página del Dashboard global (propuesta C de JST-11): los 4 contadores con el
// aporte de cada empresa, la comparativa por empresa y, abajo, agentes en vivo,
// actividad y tareas recientes. El filtro y el orden viven en la URL.
import { useCallback, useLayoutEffect, useMemo, type ReactNode } from "react";
import {
  useHostLocation,
  useHostNavigation,
  type PluginPageProps,
  type PluginSidebarProps,
} from "@paperclipai/plugin-sdk/ui";
import {
  formatMoney,
  formatMoneyShort,
  nextSort,
  parseDashboardQuery,
  serializeDashboardQuery,
  sortRows,
  toggleCompanyFilter,
  type BudgetAlert,
  type CompanyDashboardLoad,
  type CompanyMetrics,
  type CompanyRow,
  type DashboardModel,
  type DashboardQuery,
  type SortKey,
} from "../dashboard.js";
import { localeTag, t } from "../i18n.js";
import { DASHBOARD_ROUTE, PAGE_ROUTE } from "../shared.js";
import { CompanyTag, Skeleton, companyClass, companyStyle, cx, plural, useNow } from "./common.js";
import { ComparisonTable } from "./comparison.js";
import { ensureDashboardStyles } from "./dashStyles.js";
import { Feeds, Section } from "./feeds.js";
import { Icon } from "./icons.js";
import { LanguageButton } from "./lang.js";
import { ToastStack, useToasts } from "./layer.js";
import { ensureStyles } from "./styles.js";
import { useDashboardData } from "./useDashboardData.js";

function ChartColumnIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

// Entrada del menú lateral, debajo de «Board global». Replica las clases del ítem nativo.
export function DashboardGlobalSidebarLink(_props: PluginSidebarProps) {
  const navigation = useHostNavigation();
  const location = useHostLocation();
  const active = location.pathname.endsWith(`/${DASHBOARD_ROUTE}`);
  return (
    <a
      {...navigation.linkProps(`/${DASHBOARD_ROUTE}`)}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 mx-2 rounded-lg px-2 py-1.5 font-medium transition-colors ${
        active ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <span className="relative shrink-0">
        <ChartColumnIcon />
      </span>
      <span className="flex-1 truncate">{t("Dashboard global")}</span>
    </a>
  );
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return t("{names} y {last}", { names: names.slice(0, -1).join(", "), last: names[names.length - 1]! });
}

function updatedLabel(loadedAt: number | null, now: number): string {
  if (!loadedAt) return "";
  const minutes = Math.floor((now - loadedAt) / 60_000);
  if (minutes < 1) return t("Actualizado hace unos segundos");
  if (minutes < 60) return t("Actualizado hace {n} min", { n: minutes });
  return t("Actualizado hace {n} h", { n: Math.floor(minutes / 60) });
}

function subtitle(model: DashboardModel, loading: boolean): string {
  const total = model.rows.length;
  if (loading) {
    return t("Cargando los datos de {companies}…", { companies: plural(total || model.companies.length || 4, "empresa", "empresas") });
  }
  const ok = model.rows.filter((row) => row.status === "ok");
  if (model.failed.length > 0) {
    const names = model.failed.map((row) => row.company.name);
    const args = { ok: ok.length, total, names: listNames(names) };
    return names.length === 1
      ? t("{ok} de {total} empresas · {names} no respondió", args)
      : t("{ok} de {total} empresas · {names} no respondieron", args);
  }
  if (model.selected.length > 0) {
    return t("{ok} de {total} empresas: {names}", {
      ok: ok.length,
      total: model.companies.length,
      names: ok.map((row) => row.company.name).join(", "),
    });
  }
  if (total === 1) return t("{name}: qué está bien y qué necesita atención", { name: model.rows[0]!.company.name });
  return t("Las {total} empresas lado a lado: qué está bien y qué necesita atención", { total });
}

// ---------------------------------------------------------------------------
// Filtro de empresas (§3.2): el único filtro
// ---------------------------------------------------------------------------

function CompanyFilter({
  model,
  statusById,
  disabled,
  onChange,
}: {
  model: DashboardModel;
  statusById: ReadonlyMap<string, CompanyDashboardLoad>;
  disabled: boolean;
  onChange: (emp: string[]) => void;
}) {
  const all = model.companies.map((company) => company.prefix);
  const { selected } = model;
  const none = selected.length === 0;
  return (
    <div className="gb-cof" role="group" aria-label={t("Filtrar por empresa")}>
      <span className="gb-lbl">{t("Empresas")}</span>
      <button
        type="button"
        className={cx("gb-all", none && "is-on")}
        aria-pressed={none}
        disabled={disabled}
        onClick={() => onChange([])}
      >
        {t("Todas")}
      </button>
      {model.companies.map((company) => {
        const status = statusById.get(company.id)?.status ?? "wait";
        const on = !none && selected.includes(company.prefix);
        const title =
          status === "wait"
            ? t("{name}: cargando…", { name: company.name })
            : status === "err"
              ? t("{name}: no respondió", { name: company.name })
              : on
                ? t("Quitar {name}", { name: company.name })
                : none
                  ? t("Ver solo {name}", { name: company.name })
                  : t("Agregar {name}", { name: company.name });
        return (
          <button
            key={company.id}
            type="button"
            className={cx("gb-cob", companyClass(company), on && "is-on", !none && !on && "is-off")}
            style={companyStyle(company)}
            aria-pressed={on}
            aria-label={company.name}
            title={title}
            disabled={disabled}
            onClick={() => onChange(toggleCompanyFilter(selected, company.prefix, all))}
          >
            {status === "wait" ? (
              <span className="gb-spin">
                <Icon name="loader" size={12} />
              </span>
            ) : status === "err" ? (
              <span className="gb-alert">
                <Icon name="circle-alert" size={12} />
              </span>
            ) : (
              <span className="gb-dot" />
            )}
            <span className="gb-p">{company.prefix}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contadores (§3.3): el total de las empresas del filtro y el aporte de cada una
// ---------------------------------------------------------------------------

function Breakdown({
  rows,
  path,
  value,
}: {
  rows: readonly CompanyRow[];
  path: string;
  value: (metrics: CompanyMetrics) => ReactNode;
}) {
  return (
    <div className="gb-dbrk">
      {rows.map(({ company, metrics }) =>
        metrics ? (
          <a
            key={company.id}
            href={`/${company.prefix}/${path}`}
            className={companyClass(company)}
            style={companyStyle(company)}
            title={t("Abrir {name}", { name: company.name })}
          >
            <b>{company.prefix}</b>
            {value(metrics)}
          </a>
        ) : (
          <span key={company.id} className={companyClass(company)} style={companyStyle(company)} title={t("{name}: no respondió", { name: company.name })}>
            <b>{company.prefix}</b>—
          </span>
        ),
      )}
    </div>
  );
}

function Kpi({ icon, label, value, desc, children }: { icon: ReactNode; label: string; value: ReactNode; desc: ReactNode; children: ReactNode }) {
  return (
    <div className="gb-dk">
      <span className="gb-lab">
        {icon}
        {label}
      </span>
      <span className="gb-val">{value}</span>
      <span className="gb-desc">{desc}</span>
      {children}
    </div>
  );
}

function Kpis({ model, loading }: { model: DashboardModel; loading: boolean }) {
  // Esperan a todas las empresas: un total a medias engaña (§4.1).
  if (loading) {
    return (
      <div className="gb-dkpis">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="gb-dk">
            <Skeleton width={110} height={10} />
            <Skeleton width={60} height={26} style={{ marginTop: 6 }} />
            <Skeleton width={150} height={9} style={{ marginTop: 6 }} />
            <Skeleton width={150} height={9} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
    );
  }
  const totals = model.totals;
  const { rows } = model;
  const percent = totals.monthUtilizationPercent;
  return (
    <div className="gb-dkpis">
      <Kpi
        icon={<Icon name="bot" size={14} />}
        label={t("Agentes activos")}
        value={totals.agentsEnabled}
        desc={
          <>
            {t("{n} corriendo", { n: totals.agentsRunning })} ·{" "}
            {totals.agentsPaused === 1 ? t("{n} pausado", { n: totals.agentsPaused }) : t("{n} pausados", { n: totals.agentsPaused })} ·{" "}
            {totals.agentsError > 0 ? <span className="gb-bad">{t("{n} con error", { n: totals.agentsError })}</span> : t("0 con error")}
          </>
        }
      >
        <Breakdown rows={rows} path="agents" value={(m) => m.agentsEnabled} />
      </Kpi>
      <Kpi
        icon={<Icon name="circle-dot" size={14} />}
        label={t("Tareas en curso")}
        value={totals.tasksInProgress}
        desc={t("{open}, {blocked}", {
          open: plural(totals.tasksOpen, "abierta", "abiertas"),
          blocked: plural(totals.tasksBlocked, "bloqueada", "bloqueadas"),
        })}
      >
        <Breakdown rows={rows} path="issues" value={(m) => m.tasksInProgress} />
      </Kpi>
      <Kpi
        icon={<Icon name="dollar-sign" size={14} />}
        label={t("Gasto del mes")}
        value={formatMoney(totals.monthSpendCents)}
        desc={
          percent === null
            ? t("Sin límite de presupuesto")
            : totals.unlimitedBudget.length > 0
              ? t("{percent}% de {budget} · {names} sin límite", {
                  percent: Math.round(percent),
                  budget: formatMoney(totals.monthBudgetCents),
                  names: totals.unlimitedBudget.map((company) => company.prefix).join(", "),
                })
              : t("{percent}% de {budget}", { percent: Math.round(percent), budget: formatMoney(totals.monthBudgetCents) })
        }
      >
        <Breakdown rows={rows} path="costs" value={(m) => formatMoneyShort(m.monthSpendCents)} />
      </Kpi>
      <Kpi
        icon={<Icon name="shield-check" size={14} />}
        label={t("Aprobaciones pendientes")}
        value={totals.pendingApprovals}
        desc={
          totals.budgetApprovals > 0
            ? t("{n} de presupuesto, esperando al board", { n: totals.budgetApprovals })
            : t("Esperando revisión del board")
        }
      >
        <Breakdown rows={rows} path="approvals" value={(m) => m.pendingApprovals} />
      </Kpi>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avisos y estados (§3.4, §4.2)
// ---------------------------------------------------------------------------

function BudgetBanner({ alert }: { alert: BudgetAlert }) {
  return (
    <div className="gb-budget" role="status">
      <Icon name="triangle-alert" />
      <div className="gb-txt">
        <b>
          {alert.incidents === 1
            ? t("1 incidente de presupuesto activo")
            : t("{n} incidentes de presupuesto activos", { n: alert.incidents })}
        </b>
        {alert.companies.map((entry) => (
          <div key={entry.company.id} className="gb-line">
            <CompanyTag company={entry.company} />
            <span>
              {t("{name}: {agents} · {projects} · {approvals}", {
                name: entry.company.name,
                agents: plural(entry.pausedAgents, "agente pausado", "agentes pausados"),
                projects: plural(entry.pausedProjects, "proyecto pausado", "proyectos pausados"),
                approvals: plural(entry.budgetApprovals, "aprobación de presupuesto pendiente", "aprobaciones de presupuesto pendientes"),
              })}
            </span>
            <a href={entry.costsHref}>{t("Abrir presupuestos de {name}", { name: entry.company.name })}</a>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ model, onRetry }: { model: DashboardModel; onRetry: () => void }) {
  const ok = model.rows.filter((row) => row.status === "ok").length;
  return (
    <div className="gb-banner" role="alert">
      <Icon name="circle-alert" />
      <span>
        <b>{t("No se pudieron cargar los datos de {names}.", { names: listNames(model.failed.map((row) => row.company.name)) })}</b>{" "}
        <span className="gb-muted">
          {t("Los totales muestran {ok} de {companies}.", { ok, companies: plural(model.rows.length, "empresa", "empresas") })}
        </span>
      </span>
      <span className="gb-sp" />
      <button type="button" className="gb-btn is-sm" onClick={onRetry}>
        {t("Reintentar")}
      </button>
    </div>
  );
}

function LoadFailed({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="gb-empty">
      <div className="gb-box">
        <div className="gb-eic" style={{ color: "var(--gb-st-blocked)" }}>
          <Icon name="circle-alert" size={18} />
        </div>
        <h3>{t("No se pudieron cargar los datos")}</h3>
        <p>{message ?? t("Ninguna empresa respondió.")}</p>
        <div className="gb-acts">
          <button type="button" className="gb-btn is-sm" onClick={onRetry}>
            {t("Reintentar")}
          </button>
        </div>
      </div>
    </div>
  );
}

function seconds(ms: number): string {
  return (ms / 1000).toLocaleString(localeTag(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export function DashboardGlobalPage(_props: PluginPageProps) {
  useLayoutEffect(() => {
    ensureStyles();
    ensureDashboardStyles();
  }, []);
  const location = useHostLocation();
  const navigation = useHostNavigation();
  const { toasts, show: toast, dismiss } = useToasts();
  const now = useNow();

  const query = useMemo(() => parseDashboardQuery(location.search), [location.search]);
  const setQuery = useCallback(
    (next: DashboardQuery) => navigation.navigate(`/${DASHBOARD_ROUTE}${serializeDashboardQuery(next)}`, { replace: true }),
    [navigation],
  );
  const data = useDashboardData(query, { onVisibleRefresh: () => toast({ content: t("Actualizado al volver a la pestaña") }) });
  const { model } = data;

  const loading = !data.ready;
  // Cargando, o alguna empresa del filtro sigue sin responder (p. ej. al reintentar).
  const waiting = loading || model.rows.length === 0 || model.rows.some((row) => row.status === "wait");
  const allFailed = data.ready && (data.listError !== null || (model.rows.length > 0 && model.rows.every((row) => row.status === "err")));
  const rows = useMemo(() => sortRows(model, query.ord, query.dir), [model, query.ord, query.dir]);

  const refresh = async () => {
    if (data.refreshing) return;
    const result = await data.refresh();
    if (!result) return;
    toast({
      content: t("Dashboard actualizado · {companies} en {seconds} s", {
        companies: plural(result.ok, "empresa", "empresas"),
        seconds: seconds(result.elapsedMs),
      }),
    });
  };

  // «Reintentar» de una fila pide solo esa empresa; el del aviso, todas las que fallaron (§4.2).
  const retry = async (failed: readonly CompanyRow[]) => {
    const results = await Promise.all(failed.map((row) => data.retry(row.company.id)));
    const ok = results.flatMap((load) => (load?.status === "ok" ? [load.company.name] : []));
    const stillFailing = results.flatMap((load) => (load?.status === "err" ? [load.company.name] : []));
    if (ok.length > 0) {
      const rest = model.failed.length - ok.length;
      const names = listNames(ok);
      const total = model.rows.length;
      let content: string;
      if (rest !== 0) content = ok.length === 1 ? t("{names} respondió", { names }) : t("{names} respondieron", { names });
      else if (total === 1) {
        content = ok.length === 1 ? t("{names} respondió · datos al día", { names }) : t("{names} respondieron · datos al día", { names });
      } else {
        content =
          ok.length === 1
            ? t("{names} respondió · datos de las {total} empresas al día", { names, total })
            : t("{names} respondieron · datos de las {total} empresas al día", { names, total });
      }
      toast({ content });
    }
    if (stillFailing.length > 0) {
      const names = listNames(stillFailing);
      toast({
        error: true,
        content: stillFailing.length === 1 ? t("{names} sigue sin responder", { names }) : t("{names} siguen sin responder", { names }),
      });
    }
  };

  const onSort = (key: SortKey) => setQuery({ ...query, ...nextSort(query, key) });

  return (
    <div className={cx("gb gb-dash", data.refreshing && "is-refreshing")}>
      <div className="gb-dhead">
        <div>
          <div className="gb-title">
            <h1>{t("Dashboard global")}</h1>
            <a {...navigation.linkProps(`/${PAGE_ROUTE}`)} className="gb-xlink" title={t("Board global: las tareas de todas las empresas")}>
              {t("Board global")}
              <Icon name="chevron-right" size={12} />
            </a>
          </div>
          <div className="gb-sub">{allFailed ? t("No se pudieron cargar los datos") : subtitle(model, loading)}</div>
        </div>
        <span className="gb-sp" />
        <CompanyFilter
          model={model}
          statusById={data.statusById}
          disabled={loading}
          onChange={(emp) => setQuery({ ...query, emp })}
        />
        <span className="gb-upd">
          <Icon name="clock" size={12} />
          {loading ? t("Cargando…") : updatedLabel(data.loadedAt, now)}
        </span>
        <button
          type="button"
          className={cx("gb-btn", data.refreshing && "is-busy")}
          disabled={loading}
          aria-busy={data.refreshing}
          onClick={() => void refresh()}
        >
          <Icon name="refresh" size={14} />
          {t("Actualizar")}
        </button>
        <LanguageButton />
      </div>

      {allFailed ? (
        <LoadFailed message={data.listError} onRetry={() => void data.refresh()} />
      ) : (
        <>
          {model.failed.length > 0 ? <ErrorBanner model={model} onRetry={() => void retry(model.failed)} /> : null}
          <Kpis model={model} loading={waiting} />
          {!waiting && model.budgetAlert ? <BudgetBanner alert={model.budgetAlert} /> : null}
          <Section
            title={t("Comparativa por empresa")}
            meta={waiting ? t("cada fila aparece cuando su empresa responde") : t("clic en una fila para abrir su Dashboard")}
            right={waiting ? null : <span className="gb-scale">{t("Las barras usan la misma escala en todas las filas")}</span>}
          />
          <ComparisonTable model={model} rows={rows} query={query} onSort={onSort} onRetry={(row) => void retry([row])} />
          <Feeds model={model} loading={waiting} now={now} />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
