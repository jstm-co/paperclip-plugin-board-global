// Barra de filtros (§3.4): búsqueda, Proyecto · Estado · Responsable ·
// Prioridad, «Más filtros» (Empresa, Etiqueta y Actualizada), chips y menús con
// conteo facetado. En Kanban, «Carriles» (Fase 2, JST-21 §4.1). Todo el estado
// vive en la URL.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  FILTER_DIMS,
  GROUP_BY_OPTIONS,
  LANE_OPTIONS,
  NO_PROJECT,
  UNASSIGNED,
  assigneeKey,
  assigneeLabel,
  clearFilter,
  dateCounts,
  emptyFilters,
  facetCounts,
  hasChipFilters,
  normalizeText,
  toggleValue,
  type BoardFilters,
  type BoardIndex,
  type BoardQuery,
  type FilterDim,
  type GroupBy,
  type LaneBy,
} from "../board.js";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, type IssuePriority, type IssueStatus } from "../shared.js";
import { Avatar, CompanyTag, PRIORITY_LABELS, PriorityIcon, STATUS_LABELS, StatusIcon, cx } from "./common.js";
import { Icon, type IconName } from "./icons.js";
import { Popover } from "./layer.js";

export const DIM_META: Record<FilterDim, { label: string; icon: IconName }> = {
  emp: { label: "Empresa", icon: "building" },
  prj: { label: "Proyecto", icon: "folder" },
  est: { label: "Estado", icon: "circle-dashed" },
  resp: { label: "Responsable", icon: "user" },
  pri: { label: "Prioridad", icon: "signal" },
  eti: { label: "Etiqueta", icon: "tag" },
};

export const GROUP_META: Record<GroupBy, { label: string; icon: IconName }> = {
  empresa: { label: "Empresa", icon: "building" },
  estado: { label: "Estado", icon: "circle-dashed" },
  proyecto: { label: "Proyecto", icon: "folder" },
  responsable: { label: "Responsable", icon: "user" },
  prioridad: { label: "Prioridad", icon: "signal" },
};

/** Carriles del kanban: etiqueta, icono, plural (esquina de la grilla) y qué no cambia al arrastrar. */
export const LANE_META: Record<LaneBy, { label: string; icon: IconName; plural: string; what: string }> = {
  empresa: { label: "Empresa", icon: "building", plural: "empresas", what: "la empresa" },
  proyecto: { label: "Proyecto", icon: "folder", plural: "proyectos", what: "el proyecto" },
  responsable: { label: "Responsable", icon: "user", plural: "responsables", what: "el responsable" },
};

/** Filtro de fecha (§5 de JST-21): vive en «Más filtros» (Ley de Hick). */
const DATE_META = { label: "Actualizada", icon: "clock" as IconName };

interface DimOption {
  value: string;
  label: string;
  /** Subtítulo del menú (empresa del proyecto o del agente). */
  group?: string;
  pre?: ReactNode;
}

/** Opciones de cada filtro. Proyectos, responsables y etiquetas: solo los que tienen tareas. */
function dimOptions(index: BoardIndex, dim: FilterDim): DimOption[] {
  switch (dim) {
    case "emp":
      return index.companies.map((company) => ({ value: company.prefix, label: company.name, pre: <CompanyTag company={company} /> }));
    case "est":
      return ISSUE_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status], pre: <StatusIcon status={status} /> }));
    case "pri":
      return ISSUE_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority], pre: <PriorityIcon priority={priority} /> }));
    case "prj": {
      const used = new Set(index.issues.map((issue) => issue.projectId ?? NO_PROJECT));
      const options: DimOption[] = used.has(NO_PROJECT) ? [{ value: NO_PROJECT, label: "Sin proyecto" }] : [];
      for (const company of index.companies) {
        const projects = [...index.projectById.values()]
          .filter((project) => project.companyId === company.id && used.has(project.id))
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        for (const project of projects) {
          options.push({ value: project.id, label: project.name, group: company.name, pre: <CompanyTag company={company} /> });
        }
      }
      return options;
    }
    case "resp": {
      const used = new Set(index.issues.map(assigneeKey));
      const options: DimOption[] = [{ value: UNASSIGNED, label: "Sin asignar", pre: <Avatar name={null} size={18} /> }];
      for (const company of index.companies) {
        const agents = [...index.agentById.values()]
          .filter((agent) => agent.companyId === company.id && used.has(`agent:${agent.id}`))
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        for (const agent of agents) {
          options.push({ value: `agent:${agent.id}`, label: agent.name, group: company.name, pre: <Avatar name={agent.name} size={18} /> });
        }
      }
      for (const key of [...used].filter((k) => k.startsWith("user:")).sort()) {
        const label = assigneeLabel(index, key);
        options.push({ value: key, label, group: "Personas", pre: <Avatar name={label} size={18} /> });
      }
      return options;
    }
    case "eti": {
      const colors = new Map<string, string>();
      for (const issue of index.issues) for (const label of issue.labels) if (!colors.has(label.name)) colors.set(label.name, label.color);
      return [...colors.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "es"))
        .map(([name, color]) => ({ value: name, label: name, pre: <i className="gb-ldot" style={{ "--lc": color } as CSSProperties} /> }));
    }
  }
}

/** Texto corto de un valor para el chip. */
export function valueLabel(index: BoardIndex, dim: FilterDim, value: string): string {
  switch (dim) {
    case "prj": {
      if (value === NO_PROJECT) return "Sin proyecto";
      const project = index.projectById.get(value);
      if (!project) return "Proyecto desconocido";
      return `${index.companyById.get(project.companyId)?.prefix ?? ""} · ${project.name}`;
    }
    case "resp":
      return assigneeLabel(index, value);
    case "est":
      return STATUS_LABELS[value as IssueStatus] ?? value;
    case "pri":
      return PRIORITY_LABELS[value as IssuePriority] ?? value;
    case "emp":
      return index.companies.find((company) => company.prefix === value)?.name ?? value;
    case "eti":
      return value;
  }
}

function chipValue(index: BoardIndex, dim: FilterDim, values: readonly string[]): ReactNode {
  if (dim === "emp" && values.length <= 3) {
    return values.map((prefix) => <CompanyTag key={prefix} company={index.companies.find((c) => c.prefix === prefix)} />);
  }
  if ((dim === "est" || dim === "pri") && values.length <= 2) {
    return values.map((value, i) => (
      <span key={value} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {dim === "est" ? <StatusIcon status={value as IssueStatus} size={12} /> : <PriorityIcon priority={value as IssuePriority} size={12} />}
        {valueLabel(index, dim, value)}
        {i < values.length - 1 ? "," : ""}
      </span>
    ));
  }
  if (values.length <= 2) return values.map((value) => valueLabel(index, dim, value)).join(", ");
  return `${values.length} seleccionados`;
}

// ---------------------------------------------------------------------------
// Menús
// ---------------------------------------------------------------------------

function DimMenuBody({
  index,
  filters,
  dim,
  onFilters,
  onBack,
}: {
  index: BoardIndex;
  filters: BoardFilters;
  dim: FilterDim;
  onFilters: (filters: BoardFilters) => void;
  onBack?: () => void;
}) {
  const [search, setSearch] = useState("");
  const options = useMemo(() => dimOptions(index, dim), [index, dim]);
  const counts = useMemo(() => facetCounts(index, filters, dim), [index, filters, dim]);
  const selected = filters[dim] as readonly string[];
  const q = normalizeText(search.trim());
  const visible = q ? options.filter((o) => normalizeText(`${o.label} ${o.group ?? ""}`).includes(q)) : options;
  let lastGroup: string | undefined;
  return (
    <>
      {onBack ? (
        <button type="button" className="gb-mi" onClick={onBack}>
          <Icon name="chevron-left" size={14} />
          <span className="gb-lbl gb-muted">{DIM_META[dim].label}</span>
        </button>
      ) : null}
      {options.length > 7 ? (
        <div className="gb-ms">
          <Icon name="search" size={14} />
          <input
            autoFocus
            value={search}
            placeholder={`Buscar ${DIM_META[dim].label.toLowerCase()}…`}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      ) : null}
      <div className="gb-scroll">
        {visible.map((option) => {
          const header = option.group && option.group !== lastGroup ? option.group : null;
          lastGroup = option.group;
          const on = selected.includes(option.value);
          return (
            <div key={option.value}>
              {header ? <div className="gb-mh">{header}</div> : null}
              <button
                type="button"
                className="gb-mi"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => onFilters(toggleValue(filters, dim, option.value))}
              >
                <span className={cx("gb-cbox", on && "is-on")}>{on ? <Icon name="check" /> : null}</span>
                {option.pre}
                <span className="gb-lbl">{option.label}</span>
                <span className="gb-n gb-tnum">{counts.get(option.value) ?? 0}</span>
              </button>
            </div>
          );
        })}
        {visible.length === 0 ? <div className="gb-mh">Sin coincidencias</div> : null}
      </div>
      {selected.length > 0 ? (
        <>
          <div className="gb-msep" />
          <button type="button" className="gb-mi" onClick={() => onFilters(clearFilter(filters, dim))}>
            <Icon name="x" size={14} />
            <span className="gb-lbl gb-muted">Quitar filtro</span>
          </button>
        </>
      ) : null}
    </>
  );
}

/** «Actualizada»: cualquier fecha o los últimos 7 días, con conteo facetado. Un clic aplica y cierra. */
function DateMenuBody({
  index,
  filters,
  onFilters,
  onClose,
  onBack,
}: {
  index: BoardIndex;
  filters: BoardFilters;
  onFilters: (filters: BoardFilters) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const counts = useMemo(() => dateCounts(index, filters), [index, filters]);
  const options = [
    { value: null, label: "Cualquier fecha", count: counts.any },
    { value: "7d" as const, label: "En los últimos 7 días", count: counts["7d"] },
  ];
  return (
    <>
      {onBack ? (
        <button type="button" className="gb-mi" onClick={onBack}>
          <Icon name="chevron-left" size={14} />
          <span className="gb-lbl gb-muted">{DATE_META.label}</span>
        </button>
      ) : null}
      {options.map((option) => {
        const on = filters.act === option.value;
        return (
          <button
            key={option.label}
            type="button"
            className="gb-mi"
            role="menuitemradio"
            aria-checked={on}
            onClick={() => {
              onClose();
              onFilters({ ...filters, act: option.value });
            }}
          >
            <span className="gb-ck">{on ? <Icon name="check" size={14} /> : null}</span>
            <span className="gb-lbl">{option.label}</span>
            <span className="gb-n gb-tnum">{option.count}</span>
          </button>
        );
      })}
      <div className="gb-msep" />
      <div className="gb-mnote">
        <Icon name="info" size={12} />
        <span>Usa la fecha «Actualizada» de cada tarea, la misma de la Lista. Cuenta 7 días hacia atrás desde ahora.</span>
      </div>
    </>
  );
}

type MoreSub = FilterDim | "act" | null;

/**
 * «Más filtros»: menú de dos niveles, Filtrar por → Empresa, Etiqueta o Actualizada → valores.
 * El nivel abierto (`dim`) vive en la barra, porque el ancho del popover depende de él.
 */
function MoreMenuBody({
  index,
  filters,
  dim,
  onDim: setDim,
  onFilters,
  onClose,
}: {
  index: BoardIndex;
  filters: BoardFilters;
  dim: MoreSub;
  onDim: (dim: MoreSub) => void;
  onFilters: (f: BoardFilters) => void;
  onClose: () => void;
}) {
  if (dim === "act") return <DateMenuBody index={index} filters={filters} onFilters={onFilters} onClose={onClose} onBack={() => setDim(null)} />;
  if (dim) return <DimMenuBody index={index} filters={filters} dim={dim} onFilters={onFilters} onBack={() => setDim(null)} />;
  const entries = [
    ...(["emp", "eti"] as const).map((key) => ({ key, ...DIM_META[key], count: filters[key].length })),
    { key: "act" as const, ...DATE_META, count: filters.act ? 1 : 0 },
  ];
  return (
    <>
      <div className="gb-mh">Filtrar por</div>
      {entries.map((entry) => (
        <button key={entry.key} type="button" className="gb-mi" onClick={() => setDim(entry.key)}>
          <Icon name={entry.icon} size={14} />
          <span className="gb-lbl">{entry.label}</span>
          {entry.count > 0 ? <span className="gb-n">{entry.count}</span> : null}
          <span className="gb-muted gb-ic">
            <Icon name="chevron-right" size={14} />
          </span>
        </button>
      ))}
    </>
  );
}

type MenuState =
  | { kind: "dim"; dim: FilterDim; anchor: HTMLElement }
  | { kind: "act"; anchor: HTMLElement }
  | { kind: "more"; anchor: HTMLElement; sub: MoreSub }
  | { kind: "group"; anchor: HTMLElement }
  | { kind: "lanes"; anchor: HTMLElement };

/** «Actualizada» mide 280 también como segundo nivel de «Más filtros» (§5). */
function menuWidth(menu: MenuState): number {
  if (menu.kind === "group") return 220;
  if (menu.kind === "more") return menu.sub === "act" ? 280 : 260;
  if (menu.kind === "act" || menu.kind === "lanes" || menu.dim === "prj" || menu.dim === "resp") return 280;
  return 240;
}

// ---------------------------------------------------------------------------
// Barra
// ---------------------------------------------------------------------------

export function FilterBar({
  index,
  query,
  disabled,
  onQuery,
  onResetCards,
  onLanes,
  onFoldLanes,
}: {
  index: BoardIndex | null;
  query: BoardQuery;
  disabled: boolean;
  onQuery: (query: BoardQuery) => void;
  /** «Plegar/Desplegar subtareas» borra los cambios hechos tarjeta por tarjeta. */
  onResetCards: () => void;
  /** Cambiar los carriles despliega todos y vuelve a 2 tarjetas por celda. */
  onLanes: (lanes: LaneBy | null) => void;
  onFoldLanes: (fold: boolean) => void;
}) {
  const { filters } = query;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const setFilters = (next: BoardFilters) => onQuery({ ...query, filters: next });

  // Búsqueda con debounce de 200 ms. `sent` evita que la URL pise lo que se
  // sigue escribiendo.
  const [draft, setDraft] = useState(filters.q);
  const sent = useRef(filters.q);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ query, onQuery });
  latest.current = { query, onQuery };
  useEffect(() => {
    if (filters.q !== sent.current) {
      sent.current = filters.q;
      setDraft(filters.q);
    }
  }, [filters.q]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onSearch = (value: string) => {
    setDraft(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      sent.current = value.trim();
      const { query: current, onQuery: apply } = latest.current;
      apply({ ...current, filters: { ...current.filters, q: value.trim() } });
    }, 200);
  };

  const toggleMenu = (next: MenuState) =>
    setMenu((current) => (current && current.anchor === next.anchor ? null : next));

  const moreCount = (filters.emp.length > 0 ? 1 : 0) + (filters.eti.length > 0 ? 1 : 0) + (filters.act ? 1 : 0);
  const lanes = query.view === "kanban" ? query.lanes : null;
  // Con carriles, «Ocultar cerradas» queda solo con su icono y «Plegar subtareas»
  // no aparece: las subtareas empiezan plegadas en cada tarjeta (§4.1, rev 2).
  const iconOnly = (label: string) => (lanes ? { title: label, "aria-label": label } : {});

  return (
    <>
      <div className={cx("gb-filters", disabled && "is-off")}>
        <label className="gb-search" title="Buscar por ID, título o empresa">
          <Icon name="search" size={14} />
          <input value={draft} placeholder="Buscar…" aria-label="Buscar por ID, título o empresa" onChange={(e) => onSearch(e.target.value)} />
        </label>
        {(["prj", "est", "resp", "pri"] as const).map((dim) => {
          const n = filters[dim].length;
          return (
            <button
              key={dim}
              type="button"
              className={cx("gb-btn", n > 0 && "is-active")}
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "dim" && menu.dim === dim}
              onClick={(event) => toggleMenu({ kind: "dim", dim, anchor: event.currentTarget })}
            >
              <Icon name={DIM_META[dim].icon} size={14} />
              {DIM_META[dim].label}
              {n > 0 ? <span className="gb-v">· {n}</span> : null}
              <Icon name="chevron-down" size={14} />
            </button>
          );
        })}
        <button
          type="button"
          className="gb-btn is-ghost"
          aria-haspopup="menu"
          onClick={(event) => toggleMenu({ kind: "more", anchor: event.currentTarget, sub: null })}
        >
          <Icon name="plus" size={14} />
          Más filtros
          {moreCount > 0 ? <span className="gb-v">· {moreCount}</span> : null}
        </button>
        <span className="gb-sp" />
        {query.view === "lista" ? (
          <button
            type="button"
            className="gb-btn"
            aria-haspopup="menu"
            onClick={(event) => toggleMenu({ kind: "group", anchor: event.currentTarget })}
          >
            <Icon name="layers" size={14} />
            Agrupar: {GROUP_META[query.group].label}
            <Icon name="chevron-down" size={14} />
          </button>
        ) : (
          <>
            <button
              type="button"
              className={cx("gb-btn", lanes && "is-active")}
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "lanes"}
              onClick={(event) => toggleMenu({ kind: "lanes", anchor: event.currentTarget })}
            >
              <Icon name="rows" size={14} />
              {lanes ? (
                <>
                  Carriles: <span className="gb-v">{LANE_META[lanes].label}</span>
                </>
              ) : (
                "Carriles"
              )}
              <Icon name="chevron-down" size={14} />
            </button>
            {!disabled && !lanes ? (
              <button
                type="button"
                className="gb-btn is-ghost"
                title="Desplegar o plegar las subtareas de todas las tarjetas"
                onClick={() => {
                  onResetCards();
                  onQuery({ ...query, subtasksCollapsed: !query.subtasksCollapsed });
                }}
              >
                <Icon name="list-tree" size={14} />
                {query.subtasksCollapsed ? "Desplegar subtareas" : "Plegar subtareas"}
              </button>
            ) : null}
            {query.showClosed ? (
              <button
                type="button"
                className={cx("gb-btn", "is-ghost", lanes && "is-icon")}
                {...iconOnly("Ocultar cerradas")}
                onClick={() => onQuery({ ...query, showClosed: false })}
              >
                <Icon name="eye-off" size={14} />
                {lanes ? null : "Ocultar cerradas"}
              </button>
            ) : null}
          </>
        )}
      </div>

      {index && hasChipFilters(filters) ? (
        <div className="gb-chips">
          Filtros:
          {FILTER_DIMS.filter((dim) => filters[dim].length > 0).map((dim) => (
            <span key={dim} className="gb-fchip">
              <span className="gb-k">{DIM_META[dim].label}</span>
              <button
                type="button"
                className="gb-v"
                aria-haspopup="menu"
                onClick={(event) => toggleMenu({ kind: "dim", dim, anchor: event.currentTarget })}
              >
                {chipValue(index, dim, filters[dim])}
              </button>
              <button type="button" className="gb-x" aria-label={`Quitar filtro ${DIM_META[dim].label}`} onClick={() => setFilters(clearFilter(filters, dim))}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {filters.act ? (
            <span className="gb-fchip">
              <span className="gb-k">{DATE_META.label}</span>
              <button
                type="button"
                className="gb-v"
                aria-haspopup="menu"
                onClick={(event) => toggleMenu({ kind: "act", anchor: event.currentTarget })}
              >
                <Icon name="clock" size={12} />
                últimos 7 días
              </button>
              <button type="button" className="gb-x" aria-label={`Quitar filtro ${DATE_META.label}`} onClick={() => setFilters(clearFilter(filters, "act"))}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ) : null}
          {filters.q ? (
            <span className="gb-fchip">
              <span className="gb-k">Texto</span>
              <span className="gb-v">“{filters.q}”</span>
              <button type="button" className="gb-x" aria-label="Quitar búsqueda" onClick={() => setFilters(clearFilter(filters, "q"))}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ) : null}
          <button
            type="button"
            className="gb-linkbtn"
            onClick={() => setFilters(emptyFilters())}
          >
            Limpiar todo
          </button>
        </div>
      ) : null}

      {menu && index ? (
        <Popover
          anchor={menu.anchor}
          width={menuWidth(menu)}
          align={menu.kind === "lanes" ? "end" : "start"}
          onClose={() => setMenu(null)}
        >
          {menu.kind === "dim" ? (
            <DimMenuBody index={index} filters={filters} dim={menu.dim} onFilters={setFilters} />
          ) : menu.kind === "act" ? (
            <DateMenuBody index={index} filters={filters} onFilters={setFilters} onClose={() => setMenu(null)} />
          ) : menu.kind === "more" ? (
            <MoreMenuBody
              index={index}
              filters={filters}
              dim={menu.sub}
              onDim={(sub) => setMenu({ ...menu, sub })}
              onFilters={setFilters}
              onClose={() => setMenu(null)}
            />
          ) : menu.kind === "lanes" ? (
            <>
              <div className="gb-mh">Carriles del kanban</div>
              {[null, ...LANE_OPTIONS].map((option) => (
                <button
                  key={option ?? "none"}
                  type="button"
                  className="gb-mi"
                  role="menuitemradio"
                  aria-checked={lanes === option}
                  onClick={() => {
                    setMenu(null);
                    onLanes(option);
                  }}
                >
                  <Icon name={option ? LANE_META[option].icon : "kanban"} size={14} />
                  <span className="gb-lbl">{option ? LANE_META[option].label : "Sin carriles"}</span>
                  {lanes === option ? <Icon name="check" size={14} /> : null}
                </button>
              ))}
              {lanes ? (
                <>
                  <div className="gb-msep" />
                  {[true, false].map((fold) => (
                    <button
                      key={String(fold)}
                      type="button"
                      className="gb-mi"
                      onClick={() => {
                        setMenu(null);
                        onFoldLanes(fold);
                      }}
                    >
                      <Icon name={fold ? "chevrons-down-up" : "chevrons-up-down"} size={14} />
                      <span className="gb-lbl">{fold ? "Plegar todos los carriles" : "Desplegar todos"}</span>
                    </button>
                  ))}
                </>
              ) : null}
              <div className="gb-msep" />
              <div className="gb-mnote">
                <Icon name="info" size={12} />
                <span>Las columnas siguen siendo los estados. Al arrastrar solo cambia el estado, dentro del mismo carril.</span>
              </div>
            </>
          ) : (
            <>
              <div className="gb-mh">Agrupar por</div>
              {GROUP_BY_OPTIONS.map((group) => (
                <button
                  key={group}
                  type="button"
                  className="gb-mi"
                  role="menuitemradio"
                  aria-checked={query.group === group}
                  onClick={() => {
                    setMenu(null);
                    onQuery({ ...query, group });
                  }}
                >
                  <Icon name={GROUP_META[group].icon} size={14} />
                  <span className="gb-lbl">{GROUP_META[group].label}</span>
                  {query.group === group ? <Icon name="check" size={14} /> : null}
                </button>
              ))}
            </>
          )}
        </Popover>
      ) : null}
    </>
  );
}
