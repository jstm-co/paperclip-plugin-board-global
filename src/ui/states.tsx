// Avisos y estados (§3.9 aviso «Te toca», §4.2 error parcial, §4.3 sin resultados).
import {
  clearFilter,
  dependentsOf,
  emptyFilters,
  hasChipFilters,
  relaxSuggestions,
  type BoardFilters,
  type BoardIndex,
  type BoardQuery,
  type FilterKey,
} from "../board.js";
import { t } from "../i18n.js";
import type { BoardIssue } from "../shared.js";
import { TocaPill, plural } from "./common.js";
import { DIM_META } from "./filters.js";
import { Icon } from "./icons.js";
import type { CompanyLoad } from "./useBoardData.js";

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return t("{names} y {last}", { names: names.slice(0, -1).join(", "), last: names[names.length - 1]! });
}

/** `issues`: las tareas «Te toca» que quedan con los filtros. Solo se nombran las que ellas desbloquean. */
export function TocaBanner({ index, issues, onShowAll }: { index: BoardIndex; issues: readonly BoardIssue[]; onShowAll: () => void }) {
  const count = issues.length;
  const dependents = dependentsOf(index, issues);
  const ids = dependents.map((issue) => issue.identifier ?? "").filter(Boolean);
  return (
    <div className="gb-toca-banner">
      <TocaPill />
      <span>
        <b>{count === 1 ? t("1 tarea espera tu respuesta.") : t("{n} tareas esperan tu respuesta.", { n: count })}</b>{" "}
        {dependents.length > 0 ? (
          <span className="gb-muted">
            {t("Al responderlas se desbloquean {tasks} ({ids}).", {
              tasks: plural(dependents.length, "tarea más", "tareas más"),
              ids: ids.slice(0, 4).join(", ") + (ids.length > 4 ? ", …" : ""),
            })}
          </span>
        ) : null}
      </span>
      <span className="gb-sp" />
      <button type="button" className="gb-linkbtn" onClick={onShowAll}>
        {t("Ver todo el board")}
      </button>
    </div>
  );
}

export function PartialErrorBanner({ failed, onRetry }: { failed: CompanyLoad[]; onRetry: () => void }) {
  return (
    <div className="gb-banner" role="alert">
      <Icon name="circle-alert" />
      <span>
        <b>{t("No se pudieron cargar las tareas de {names}.", { names: listNames(failed.map((load) => load.company.name)) })}</b>{" "}
        <span className="gb-muted">{t("El resto del board está al día.")}</span>
      </span>
      <span className="gb-sp" />
      <button type="button" className="gb-btn is-sm" onClick={onRetry}>
        {t("Reintentar")}
      </button>
    </div>
  );
}

function relaxLabel(key: FilterKey): string {
  if (key === "q") return t("texto");
  if (key === "toca") return t("«Te toca»");
  if (key === "act") return t("fecha");
  return DIM_META[key].label.toLowerCase();
}

export function EmptyResults({
  index,
  query,
  onFilters,
  backlogCount = 0,
  onBacklog,
}: {
  index: BoardIndex;
  query: BoardQuery;
  onFilters: (filters: BoardFilters) => void;
  /** En el Board: tareas del Backlog que sí calzan con los filtros. */
  backlogCount?: number;
  onBacklog?: () => void;
}) {
  const { filters } = query;
  const suggestions = relaxSuggestions(index, filters, query);
  const filtering = suggestions.length > 0 || hasChipFilters(filters) || filters.toca;
  const place = query.view === "kanban" ? "board" : query.view === "backlog" ? "backlog" : "";
  const heading = filtering
    ? place === "board"
      ? t("No hay tareas en el Board con estos filtros")
      : place === "backlog"
        ? t("No hay tareas en el Backlog con estos filtros")
        : t("No hay tareas con estos filtros")
    : place === "board"
      ? t("No hay tareas en el Board")
      : place === "backlog"
        ? t("No hay tareas en el Backlog")
        : t("No hay tareas");
  return (
    <div className="gb-empty">
      <div className="gb-box">
        <div className="gb-eic">
          <Icon name="search-x" size={18} />
        </div>
        <h3>{heading}</h3>
        <p>
          {backlogCount > 0
            ? backlogCount === 1
              ? t("En el Backlog hay {tasks} que todavía no entra al Board.", { tasks: plural(backlogCount, "tarea", "tareas") })
              : t("En el Backlog hay {tasks} que todavía no entran al Board.", { tasks: plural(backlogCount, "tarea", "tareas") })
            : filtering
              ? t("Prueba quitando un filtro:")
              : t("Cuando haya tareas, aparecen aquí.")}
        </p>
        <div className="gb-acts">
          {backlogCount > 0 && onBacklog ? (
            <button type="button" className="gb-btn is-sm is-primary" onClick={onBacklog}>
              {t("Ver el Backlog")}
            </button>
          ) : null}
          {suggestions.map(({ key, count }) => (
            <button key={key} type="button" className="gb-btn is-sm" onClick={() => onFilters(clearFilter(filters, key))}>
              <Icon name="x" size={12} />
              {t("Quitar {what} · {tasks}", { what: relaxLabel(key), tasks: plural(count, "tarea", "tareas") })}
            </button>
          ))}
          {filtering ? (
            <button type="button" className="gb-btn is-sm" onClick={() => onFilters(emptyFilters())}>
              {t("Limpiar todo")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LoadFailed({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="gb-empty">
      <div className="gb-box">
        <div className="gb-eic" style={{ color: "var(--gb-st-blocked)" }}>
          <Icon name="circle-alert" size={18} />
        </div>
        <h3>{t("No se pudieron cargar las tareas")}</h3>
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
