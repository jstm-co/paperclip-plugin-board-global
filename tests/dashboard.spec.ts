import { describe, expect, it } from "vitest";
import { toBoardCompany } from "../src/board.js";
import {
  activityVerb,
  buildDashboard,
  companySeries,
  contributions,
  dayLabel,
  durationLabel,
  formatMoney,
  formatMoneyShort,
  formatRate,
  metricsFromSummary,
  nextSort,
  parseDashboardQuery,
  recentDayKeys,
  recentUtcDayKeys,
  serializeDashboardQuery,
  sortRows,
  toggleCompanyFilter,
  type CompanyDashboardData,
  type CompanyDashboardLoad,
} from "../src/dashboard.js";
import { LABELS, initials } from "../src/ui/common.js";
import type { ActivityEvent, BoardIssue, DashboardSummary, LiveRun, RunActivityDay } from "../src/shared.js";

// Mediodía UTC: la fecha local y la UTC coinciden en cualquier zona horaria de América.
const NOW = new Date("2026-10-16T12:00:00.000Z");
const DAYS = recentUtcDayKeys(NOW);

function runDay(date: string, extra: Partial<RunActivityDay> = {}): RunActivityDay {
  const day = { date, succeeded: 0, failed: 0, recovered: 0, other: 0, failedByErrorCode: {}, ...extra };
  return { ...day, total: extra.total ?? day.succeeded + day.failed + day.recovered + day.other };
}

function summary(extra: {
  agents?: Partial<DashboardSummary["agents"]>;
  tasks?: Partial<DashboardSummary["tasks"]>;
  costs?: Partial<DashboardSummary["costs"]>;
  budgets?: Partial<DashboardSummary["budgets"]>;
  pendingApprovals?: number;
  runActivity?: RunActivityDay[];
}): DashboardSummary {
  return {
    companyId: "",
    agents: { active: 0, running: 0, paused: 0, error: 0, ...extra.agents },
    tasks: { open: 0, inProgress: 0, blocked: 0, done: 0, ...extra.tasks },
    costs: { monthSpendCents: 0, monthBudgetCents: 0, monthUtilizationPercent: 0, ...extra.costs },
    pendingApprovals: extra.pendingApprovals ?? 0,
    budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0, ...extra.budgets },
    runActivity: extra.runActivity ?? DAYS.map((date) => runDay(date)),
  };
}

function issue(id: string, companyId: string, extra: Partial<BoardIssue> = {}): BoardIssue {
  return {
    id,
    companyId,
    identifier: id.toUpperCase(),
    title: `Tarea ${id}`,
    status: "todo",
    priority: "medium",
    projectId: null,
    parentId: null,
    assigneeAgentId: null,
    assigneeUserId: null,
    labels: [],
    blockerIds: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...extra,
  };
}

function run(id: string, companyId: string, status: string, createdAt: string, issueId: string | null = null): LiveRun {
  return {
    id,
    companyId,
    status,
    invocationSource: "assignment",
    agentId: `${companyId}-agent`,
    agentName: `Agente ${companyId}`,
    issueId,
    createdAt,
    startedAt: createdAt,
    finishedAt: null,
  };
}

function event(id: string, companyId: string, createdAt: string, extra: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id,
    companyId,
    actorType: "agent",
    actorId: `${companyId}-agent`,
    action: "issue.updated",
    entityType: "issue",
    entityId: `${companyId}-1`,
    agentId: null,
    runId: null,
    details: null,
    createdAt,
    ...extra,
  };
}

function data(companyId: string, extra: Partial<CompanyDashboardData> = {}): CompanyDashboardData {
  return {
    summary: summary({}),
    issues: [],
    liveRuns: [],
    activity: [],
    agents: [{ id: `${companyId}-agent`, name: `Agente ${companyId}` }],
    projects: [],
    ...extra,
  };
}

const BET = toBoardCompany("bet", "Betacorp", "BET", null);
const ELM = toBoardCompany("elm", "El Molino", "ELM", null);
const JST = toBoardCompany("jst", "JSTM", "JST", null);
const MIG = toBoardCompany("mig", "Mignon", "MIG", null);

function ok(company: typeof BET, companyData: CompanyDashboardData): CompanyDashboardLoad {
  return { company, status: "ok", data: companyData };
}

const loads: CompanyDashboardLoad[] = [
  ok(
    JST,
    data("jst", {
      summary: summary({
        agents: { active: 3, running: 1 },
        tasks: { open: 8, inProgress: 2, blocked: 1, done: 4 },
        costs: { monthSpendCents: 5_000, monthBudgetCents: 20_000, monthUtilizationPercent: 25 },
        pendingApprovals: 1,
        runActivity: DAYS.map((date, i) =>
          i === 13 ? runDay(date, { succeeded: 3, failed: 1, failedByErrorCode: { process_lost: 1 } }) : runDay(date),
        ),
      }),
      issues: [
        issue("jst-1", "jst", { status: "in_progress", createdAt: "2026-10-16T09:00:00.000Z", updatedAt: "2026-10-16T11:00:00.000Z", assigneeAgentId: "jst-agent" }),
        issue("jst-2", "jst", { status: "done", createdAt: "2026-10-03T09:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z" }),
        // Fuera de la ventana de 14 días (el primer día es el 3 de octubre).
        issue("jst-3", "jst", { status: "todo", createdAt: "2026-10-02T23:59:59.000Z" }),
      ],
      liveRuns: [
        run("r-jst-old", "jst", "succeeded", "2026-10-16T08:00:00.000Z"),
        run("r-jst-live", "jst", "running", "2026-10-16T10:00:00.000Z", "jst-1"),
      ],
      activity: [event("e-jst-1", "jst", "2026-10-16T11:00:00.000Z", { entityId: "jst-1" })],
    }),
  ),
  ok(
    BET,
    data("bet", {
      summary: summary({
        agents: { active: 5, paused: 1, error: 1 },
        tasks: { open: 20, inProgress: 4, blocked: 3, done: 50 },
        costs: { monthSpendCents: 1_000 },
        budgets: { activeIncidents: 2, pendingApprovals: 1, pausedAgents: 1, pausedProjects: 1 },
        runActivity: DAYS.map((date, i) =>
          i === 13 ? runDay(date, { succeeded: 1, recovered: 1, other: 2 }) : i === 12 ? runDay(date, { failed: 2 }) : runDay(date),
        ),
      }),
      issues: [
        issue("bet-1", "bet", { status: "blocked", createdAt: "2026-10-16T01:00:00.000Z", updatedAt: "2026-10-16T12:00:00.000Z" }),
        issue("bet-2", "bet", { status: "todo", createdAt: "2026-10-03T00:00:00.000Z", updatedAt: "2026-10-15T00:00:00.000Z" }),
        ...Array.from({ length: 12 }, (_, i) =>
          issue(`bet-old-${i}`, "bet", { updatedAt: `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` }),
        ),
      ],
      liveRuns: [
        run("r-bet-live", "bet", "queued", "2026-10-16T09:00:00.000Z", "issue-oculta-123"),
        run("r-bet-old", "bet", "failed", "2026-10-16T09:30:00.000Z"),
      ],
      activity: [
        event("e-bet-run", "bet", "2026-10-16T11:30:00.000Z", {
          entityType: "heartbeat_run",
          entityId: "run-9",
          details: { agentId: "bet-agent" },
        }),
        event("e-bet-sys", "bet", "2026-10-16T07:00:00.000Z", { actorType: "system", actorId: "", entityType: "company", entityId: "bet" }),
        event("e-bet-user", "bet", "2026-10-16T06:00:00.000Z", { actorType: "user", actorId: "local-board", entityId: "bet-1" }),
        ...Array.from({ length: 9 }, (_, i) => event(`e-bet-old-${i}`, "bet", `2026-10-0${i + 1}T00:00:00.000Z`)),
      ],
    }),
  ),
  ok(ELM, data("elm", { summary: summary({ agents: { active: 2 }, tasks: { open: 1 }, costs: { monthSpendCents: 500, monthBudgetCents: 10_000, monthUtilizationPercent: 5 } }) })),
  { company: MIG, status: "err", error: "HTTP 500" },
];

describe("estado en la URL", () => {
  it("lee y escribe `emp` igual que el Board global", () => {
    expect(parseDashboardQuery("?emp=jst,BET&v=lista")).toEqual({ emp: ["JST", "BET"], ord: null, dir: "desc" });
    expect(parseDashboardQuery("")).toEqual({ emp: [], ord: null, dir: "desc" });
    expect(serializeDashboardQuery({ emp: ["JST", "BET", "JST"] })).toBe("?emp=BET,JST");
    expect(serializeDashboardQuery({ emp: [] })).toBe("");
  });

  it("guarda el orden de la tabla sin escribir los valores por defecto", () => {
    expect(parseDashboardQuery("?ord=gasto&dir=asc")).toEqual({ emp: [], ord: "gasto", dir: "asc" });
    expect(parseDashboardQuery("?ord=gasto")).toEqual({ emp: [], ord: "gasto", dir: "desc" });
    // Columna desconocida o `dir` sin `ord`: orden por defecto.
    expect(parseDashboardQuery("?ord=nada&dir=asc")).toEqual({ emp: [], ord: null, dir: "desc" });
    expect(serializeDashboardQuery({ emp: ["MIG", "BET"], ord: "exito", dir: "asc" })).toBe("?emp=BET,MIG&ord=exito&dir=asc");
    expect(serializeDashboardQuery({ emp: [], ord: "runs", dir: "desc" })).toBe("?ord=runs");
    expect(serializeDashboardQuery({ emp: [], ord: null, dir: "asc" })).toBe("");
  });

  it("filtro: desde «Todas» muestra una; luego agrega o quita; con todas o ninguna vuelve a «Todas»", () => {
    const all = ["BET", "ELM", "JST", "MIG"];
    expect(toggleCompanyFilter([], "JST", all)).toEqual(["JST"]);
    expect(toggleCompanyFilter(["JST"], "BET", all)).toEqual(["BET", "JST"]);
    expect(toggleCompanyFilter(["BET", "JST"], "JST", all)).toEqual(["BET"]);
    expect(toggleCompanyFilter(["BET"], "BET", all)).toEqual([]);
    expect(toggleCompanyFilter(["BET", "ELM", "JST"], "MIG", all)).toEqual([]);
  });

  it("ordenar: descendente → ascendente → por defecto", () => {
    expect(nextSort({ emp: [] }, "gasto")).toEqual({ ord: "gasto", dir: "desc" });
    expect(nextSort({ emp: [], ord: "gasto", dir: "desc" }, "gasto")).toEqual({ ord: "gasto", dir: "asc" });
    expect(nextSort({ emp: [], ord: "gasto", dir: "asc" }, "gasto")).toEqual({ ord: null, dir: "desc" });
    expect(nextSort({ emp: [], ord: "gasto", dir: "asc" }, "runs")).toEqual({ ord: "runs", dir: "desc" });
  });
});

describe("contadores y comparativa", () => {
  it("suma como el Dashboard nativo de cada empresa", () => {
    const metrics = metricsFromSummary(
      summary({ agents: { active: 2, running: 1, paused: 1, error: 1 }, pendingApprovals: 2, budgets: { pendingApprovals: 1 } }),
    );
    expect(metrics.agentsEnabled).toBe(5);
    expect(metrics.pendingApprovals).toBe(3);
    expect(metrics.budgetApprovals).toBe(1);
  });

  it("totaliza las empresas que respondieron y marca la que falló", () => {
    const model = buildDashboard(loads, { emp: [] }, NOW);

    expect(model.rows.map((row) => [row.company.prefix, row.status])).toEqual([
      ["BET", "ok"],
      ["ELM", "ok"],
      ["JST", "ok"],
      ["MIG", "err"],
    ]);
    expect(model.failed.map((row) => [row.company.prefix, row.error])).toEqual([["MIG", "HTTP 500"]]);
    expect(model.complete).toBe(false);

    expect(model.totals.agentsEnabled).toBe(7 + 2 + 4);
    expect(model.totals.agentsRunning).toBe(1);
    expect(model.totals.tasksInProgress).toBe(6);
    expect(model.totals.tasksOpen).toBe(29);
    expect(model.totals.tasksBlocked).toBe(4);
    expect(model.totals.pendingApprovals).toBe(2);
    expect(contributions(model, "agentsEnabled").map((entry) => [entry.company.prefix, entry.value])).toEqual([
      ["BET", 7],
      ["ELM", 2],
      ["JST", 4],
    ]);
    expect(model.rows[2].dashboardHref).toBe("/JST/dashboard");
  });

  it("calcula el % de presupuesto solo con las empresas que tienen límite", () => {
    const model = buildDashboard(loads, { emp: [] }, NOW);
    expect(model.totals.monthSpendCents).toBe(6_500);
    expect(model.totals.monthBudgetCents).toBe(30_000);
    expect(model.totals.budgetedSpendCents).toBe(5_500);
    expect(model.totals.monthUtilizationPercent).toBe(18.33);
    expect(model.totals.unlimitedBudget.map((company) => company.prefix)).toEqual(["BET"]);
    // El % por empresa es el mismo que calcula el servidor.
    expect(model.rows.map((row) => row.monthUtilizationPercent)).toEqual([null, 5, 25, null]);
  });

  it("avisa de presupuesto solo con las empresas que tienen incidentes", () => {
    const model = buildDashboard(loads, { emp: [] }, NOW);
    expect(model.budgetAlert).toEqual({
      incidents: 2,
      pausedAgents: 1,
      pausedProjects: 1,
      budgetApprovals: 1,
      companies: [{ company: BET, incidents: 2, pausedAgents: 1, pausedProjects: 1, budgetApprovals: 1, costsHref: "/BET/costs" }],
    });
    expect(buildDashboard(loads, { emp: ["JST"] }, NOW).budgetAlert).toBeNull();
  });

  it("muestra las empresas que siguen cargando sin sumarlas", () => {
    const model = buildDashboard([loads[0], { company: MIG, status: "wait" }], { emp: [] }, NOW);
    expect(model.rows.map((row) => [row.company.prefix, row.status, row.error])).toEqual([
      ["JST", "ok", null],
      ["MIG", "wait", null],
    ]);
    expect(model.failed).toEqual([]);
    expect(model.complete).toBe(false);
    expect(model.totals.agentsEnabled).toBe(4);
  });
});

describe("filtro por empresa", () => {
  it("se aplica a todos los bloques", () => {
    const model = buildDashboard(loads, { emp: ["JST", "ELM"] }, NOW);
    const prefixes = (rows: Array<{ company: { prefix: string } }>) => [...new Set(rows.map((row) => row.company.prefix))];

    expect(model.selected).toEqual(["ELM", "JST"]);
    expect(model.companies.map((company) => company.prefix)).toEqual(["BET", "ELM", "JST", "MIG"]);
    expect(prefixes(model.rows)).toEqual(["ELM", "JST"]);
    expect(model.totals.agentsEnabled).toBe(6);
    expect(model.charts.runActivity[13].byCompany.map((entry) => entry.company.prefix)).toEqual(["ELM", "JST"]);
    expect(model.charts.runActivity[13].total).toBe(4);
    expect(prefixes(model.liveRuns)).toEqual(["JST"]);
    expect(prefixes(model.recentActivity)).toEqual(["JST"]);
    expect(prefixes(model.recentTasks)).toEqual(["JST"]);
    expect(model.failed).toEqual([]);
    expect(model.complete).toBe(true);
  });

  it("ignora prefijos que no existen y, si no queda ninguno, muestra todas", () => {
    expect(buildDashboard(loads, { emp: ["XXX", "JST"] }, NOW).selected).toEqual(["JST"]);
    const model = buildDashboard(loads, { emp: ["XXX"] }, NOW);
    expect(model.selected).toEqual([]);
    expect(model.rows).toHaveLength(4);
  });
});

describe("gráficos de 14 días", () => {
  it("usa los días UTC del servidor y suma los runs de cada empresa", () => {
    const { runActivity } = buildDashboard(loads, { emp: [] }, NOW).charts;
    expect(runActivity.map((day) => day.date)).toEqual(DAYS);
    expect(runActivity[13]).toMatchObject({
      date: "2026-10-16",
      succeeded: 4,
      failed: 1,
      recovered: 1,
      other: 2,
      total: 8,
      failedByErrorCode: { process_lost: 1 },
    });
    expect(runActivity[13].byCompany.map((entry) => [entry.company.prefix, entry.runs.total])).toEqual([
      ["BET", 4],
      ["ELM", 0],
      ["JST", 4],
    ]);
  });

  it("calcula la tasa de éxito con exitosos + recuperados, como el nativo", () => {
    const { successRate } = buildDashboard(loads, { emp: [] }, NOW).charts;
    expect(successRate[13]).toMatchObject({ ok: 5, total: 8, rate: 5 / 8 });
    expect(successRate[13].byCompany.map((entry) => [entry.company.prefix, entry.rate])).toEqual([
      ["BET", 0.5],
      ["ELM", null],
      ["JST", 0.75],
    ]);
    expect(successRate[12]).toMatchObject({ ok: 0, total: 2, rate: 0 });
    expect(successRate[0].rate).toBeNull();
  });

  it("si las respuestas cruzan la medianoche UTC, quedan los 14 días más nuevos", () => {
    const later = [...DAYS.slice(1), "2026-10-17"];
    const model = buildDashboard(
      [
        ok(JST, data("jst", { summary: summary({ runActivity: DAYS.map((date) => runDay(date, { succeeded: 1 })) }) })),
        ok(BET, data("bet", { summary: summary({ runActivity: later.map((date) => runDay(date, { succeeded: 1 })) }) })),
      ],
      { emp: [] },
      NOW,
    );
    expect(model.charts.runActivity.map((day) => day.date)).toEqual(later);
    expect(model.charts.runActivity[0].total).toBe(2);
    expect(model.charts.runActivity[13].total).toBe(1);
  });

  it("cuenta las tareas por día de creación y estado actual", () => {
    const { tasksByStatus, taskStatuses } = buildDashboard(loads, { emp: [] }, NOW).charts;
    expect(tasksByStatus.map((day) => day.date)).toEqual(DAYS);
    expect(tasksByStatus[0]).toMatchObject({ date: "2026-10-03", total: 2, byStatus: { done: 1, todo: 1 } });
    expect(tasksByStatus[13]).toMatchObject({ date: "2026-10-16", total: 2, byStatus: { in_progress: 1, blocked: 1 } });
    expect(tasksByStatus[13].byCompany.map((entry) => [entry.company.prefix, entry.total])).toEqual([
      ["BET", 1],
      ["ELM", 0],
      ["JST", 1],
    ]);
    expect(tasksByStatus.reduce((sum, day) => sum + day.total, 0)).toBe(4);
    // Orden de la leyenda nativa.
    expect(taskStatuses).toEqual(["todo", "in_progress", "done", "blocked"]);
  });

  it("arma los días de tareas como la UI nativa: resta días locales y toma la fecha UTC", () => {
    const keys = recentDayKeys(NOW);
    expect(keys).toHaveLength(14);
    expect(keys[13]).toBe(NOW.toISOString().slice(0, 10));
    expect(keys).toEqual(DAYS);
  });
});

describe("agentes en vivo, actividad y tareas recientes", () => {
  it("mezcla los runs: primero los activos y luego los recientes, del más nuevo al más viejo", () => {
    const { liveRuns } = buildDashboard(loads, { emp: [] }, NOW);
    expect(liveRuns.map((row) => [row.run.id, row.isActive])).toEqual([
      ["r-jst-live", true],
      ["r-bet-live", true],
      ["r-bet-old", false],
      ["r-jst-old", false],
    ]);
    expect(liveRuns[0].issue).toEqual({ identifier: "JST-1", title: "Tarea jst-1", href: "/JST/issues/JST-1" });
    expect(liveRuns[0].runHref).toBe("/JST/agents/jst-agent/runs/r-jst-live");
    // Tarea que no está en la lista: id corto, sin título y enlace por id.
    expect(liveRuns[1].issue).toEqual({ identifier: "issue-oc", title: null, href: "/BET/issues/issue-oculta-123" });
    expect(liveRuns[2].issue).toBeNull();
  });

  it("mezcla la actividad: los 10 eventos más nuevos con su empresa, autor y enlace", () => {
    const { recentActivity } = buildDashboard(loads, { emp: [] }, NOW);
    expect(recentActivity).toHaveLength(10);
    expect(recentActivity.slice(0, 4).map((row) => [row.event.id, row.company.prefix, row.actor, row.entityLabel, row.href])).toEqual([
      ["e-bet-run", "BET", "Agente bet", "Agente bet", "/BET/agents/bet-agent/runs/run-9"],
      ["e-jst-1", "JST", "Agente jst", "JST-1", "/JST/issues/JST-1"],
      ["e-bet-sys", "BET", "Sistema", null, null],
      ["e-bet-user", "BET", "Board", "BET-1", "/BET/issues/BET-1"],
    ]);
    expect(recentActivity[1].entityTitle).toBe("Tarea jst-1");
    expect(recentActivity.at(-1)?.event.id).toBe("e-bet-old-3");
  });

  it("mezcla las tareas: las 10 actualizadas más recientemente, con enlace a su empresa", () => {
    const { recentTasks } = buildDashboard(loads, { emp: [] }, NOW);
    expect(recentTasks).toHaveLength(10);
    expect(recentTasks.slice(0, 4).map((row) => [row.issue.id, row.company.prefix, row.href, row.agentName])).toEqual([
      ["bet-1", "BET", "/BET/issues/BET-1", null],
      ["jst-1", "JST", "/JST/issues/JST-1", "Agente jst"],
      ["bet-2", "BET", "/BET/issues/BET-2", null],
      ["jst-2", "JST", "/JST/issues/JST-2", null],
    ]);
  });
});

describe("orden de la comparativa", () => {
  const model = buildDashboard(loads, { emp: [] }, NOW);
  const order = (ord: Parameters<typeof sortRows>[1], dir?: "asc" | "desc") =>
    sortRows(model, ord, dir).map((row) => row.company.prefix);

  it("por defecto, el de Paperclip", () => {
    expect(order(null)).toEqual(["BET", "ELM", "JST", "MIG"]);
  });

  it("ordena por cualquier columna y deja al final la empresa que no respondió", () => {
    expect(order("gasto")).toEqual(["JST", "BET", "ELM", "MIG"]);
    expect(order("gasto", "asc")).toEqual(["ELM", "BET", "JST", "MIG"]);
    expect(order("agentes")).toEqual(["BET", "JST", "ELM", "MIG"]);
    expect(order("runs")).toEqual(["BET", "JST", "ELM", "MIG"]);
    expect(order("runs", "asc")).toEqual(["ELM", "JST", "BET", "MIG"]);
  });

  it("en «Éxito», las que no tuvieron runs también van al final", () => {
    expect(order("exito")).toEqual(["JST", "BET", "ELM", "MIG"]);
    expect(order("exito", "asc")).toEqual(["BET", "JST", "ELM", "MIG"]);
  });

  it("arma las series de 14 días de cada empresa", () => {
    const bet = companySeries(model.charts, "bet");
    expect(bet.runs).toHaveLength(14);
    expect(bet.runsTotal).toBe(6);
    expect(bet.rate).toEqual({ ok: 2, total: 6, rate: 2 / 6 });
    expect(bet.success[12]).toEqual({ ok: 0, total: 2, rate: 0 });
    expect(bet.success[0]!.rate).toBeNull();
    expect(bet.createdTotal).toBe(2);
    // Una empresa que no cargó queda en cero.
    expect(companySeries(model.charts, "mig").runsTotal).toBe(0);
  });
});

describe("formatos y textos", () => {
  it("escribe el dinero como el Dashboard nativo", () => {
    expect(formatMoney(41_230)).toBe("$412.30");
    expect(formatMoney(1_234_567)).toBe("$12,345.67");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoneyShort(41_250)).toBe("$413");
    expect(formatRate(0.916)).toBe("92%");
  });

  it("nombra los días UTC y las duraciones", () => {
    expect(dayLabel("2026-10-14")).toBe("14 oct");
    expect(dayLabel("2026-10-14", true)).toBe("mié 14 oct");
    expect(dayLabel("2026-09-03")).toBe("3 sept");
    const now = Date.parse("2026-10-16T12:00:00.000Z");
    expect(durationLabel("2026-10-16T11:51:00.000Z", now)).toBe("9 min");
    expect(durationLabel("2026-10-16T10:55:00.000Z", now)).toBe("1 h 5 min");
  });

  it("redacta la actividad como el Dashboard nativo", () => {
    expect(activityVerb("issue.updated", { status: "in_review", _previous: { status: "todo" } }, LABELS)).toBe(
      "cambió el estado a En revisión de",
    );
    expect(activityVerb("issue.updated", { priority: "high" }, LABELS)).toBe("cambió la prioridad a alta de");
    expect(activityVerb("issue.updated", { assigneeAgentId: "a" }, LABELS)).toBe("cambió el responsable de");
    expect(activityVerb("issue.updated", { title: "x" }, LABELS)).toBe("actualizó");
    expect(activityVerb("issue.comment_added", null, LABELS)).toBe("comentó en");
    expect(activityVerb("algo.nuevo_raro", null, LABELS)).toBe("algo nuevo raro");
  });

  it("arma las iniciales del avatar sin tomar guiones sueltos", () => {
    expect(initials("Ceo - cto")).toBe("CC");
    expect(initials("Líder Técnico")).toBe("LT");
    expect(initials("Ingeniero/a Full-stack de Plugins")).toBe("IF");
  });
});
