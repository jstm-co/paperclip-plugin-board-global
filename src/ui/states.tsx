// Avisos y estados (§3.9 aviso «Te toca», §4.2 error parcial, §4.3 sin resultados).
import {
  clearFilter,
  dependentsOf,
  emptyFilters,
  relaxSuggestions,
  type BoardFilters,
  type BoardIndex,
  type BoardQuery,
  type FilterKey,
} from "../board.js";
import type { BoardIssue } from "../shared.js";
import { TocaPill, plural } from "./common.js";
import { DIM_META } from "./filters.js";
import { Icon } from "./icons.js";
import type { CompanyLoad } from "./useBoardData.js";

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
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
        <b>{count === 1 ? "1 tarea espera tu respuesta." : `${count} tareas esperan tu respuesta.`}</b>{" "}
        {dependents.length > 0 ? (
          <span className="gb-muted">
            Al responderlas se desbloquean {plural(dependents.length, "tarea más", "tareas más")} ({ids.slice(0, 4).join(", ")}
            {ids.length > 4 ? ", …" : ""}).
          </span>
        ) : null}
      </span>
      <span className="gb-sp" />
      <button type="button" className="gb-linkbtn" onClick={onShowAll}>
        Ver todo el board
      </button>
    </div>
  );
}

export function PartialErrorBanner({ failed, onRetry }: { failed: CompanyLoad[]; onRetry: () => void }) {
  return (
    <div className="gb-banner" role="alert">
      <Icon name="circle-alert" />
      <span>
        <b>No se pudieron cargar las tareas de {listNames(failed.map((load) => load.company.name))}.</b>{" "}
        <span className="gb-muted">El resto del board está al día.</span>
      </span>
      <span className="gb-sp" />
      <button type="button" className="gb-btn is-sm" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

function relaxLabel(key: FilterKey): string {
  if (key === "q") return "texto";
  if (key === "toca") return "«Te toca»";
  if (key === "act") return "fecha";
  return DIM_META[key].label.toLowerCase();
}

export function EmptyResults({
  index,
  query,
  onFilters,
}: {
  index: BoardIndex;
  query: BoardQuery;
  onFilters: (filters: BoardFilters) => void;
}) {
  const { filters } = query;
  const suggestions = relaxSuggestions(index, filters, query);
  return (
    <div className="gb-empty">
      <div className="gb-box">
        <div className="gb-eic">
          <Icon name="search-x" size={18} />
        </div>
        <h3>No hay tareas con estos filtros</h3>
        <p>Los contadores de arriba solo aplican el filtro de empresa, así que siguen mostrando sus alertas. Prueba quitando un filtro:</p>
        <div className="gb-acts">
          {suggestions.map(({ key, count }) => (
            <button key={key} type="button" className="gb-btn is-sm" onClick={() => onFilters(clearFilter(filters, key))}>
              <Icon name="x" size={12} />
              Quitar {relaxLabel(key)} · {plural(count, "tarea", "tareas")}
            </button>
          ))}
          <button
            type="button"
            className="gb-btn is-sm"
            onClick={() => onFilters(emptyFilters())}
          >
            Limpiar todo
          </button>
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
        <h3>No se pudieron cargar las tareas</h3>
        <p>{message ?? "Ninguna empresa respondió."}</p>
        <div className="gb-acts">
          <button type="button" className="gb-btn is-sm" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
