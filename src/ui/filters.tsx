// Barra de filtros (JST-407, sobre §3.4): una sola fila con búsqueda, empresas,
// los filtros rápidos «Te toca» y «Críticas y altas», y el menú «Filtros»
// (Proyecto, Estado, Responsable, Prioridad, Etiqueta y Actualizada) con conteo
// facetado. A la derecha, lo propio de cada vista: «Agrupar» en el Board y la
// Lista; «Ocultar títulos» y «Ver cerrados» en Pedidos. Todo vive en la URL.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  GROUP_BY_OPTIONS,
  HOT_PRIORITIES,
  LANE_OPTIONS,
  NO_PROJECT,
  UNASSIGNED,
  assigneeKey,
  assigneeLabel,
  clearFilter,
  dateCounts,
  emptyFilters,
  facetCounts,
  isHotFilter,
  normalizeText,
  toggleValue,
  visibleIssues,
  type BoardFilters,
  type BoardIndex,
  type BoardQuery,
  type FilterDim,
  type GroupBy,
  type LaneBy,
} from "../board.js";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, type IssuePriority, type IssueStatus } from "../shared.js";
import { Avatar, CompanyTag, PRIORITY_LABELS, PriorityIcon, STATUS_LABELS, StatusIcon, companyClass, companyStyle, cx } from "./common.js";
import { Icon, type IconName } from "./icons.js";
import { Popover } from "./layer.js";
import { t } from "../i18n.js";

export const DIM_META: Record<FilterDim, { label: string; icon: IconName }> = {
  emp: { label: t("Empresa"), icon: "building" },
  prj: { label: t("Proyecto"), icon: "folder" },
  est: { label: t("Estado"), icon: "circle-dashed" },
  resp: { label: t("Responsable"), icon: "user" },
  pri: { label: t("Prioridad"), icon: "signal" },
  eti: { label: t("Etiqueta"), icon: "tag" },
};

export const GROUP_META: Record<GroupBy, { label: string; icon: IconName }> = {
  empresa: { label: t("Empresa"), icon: "building" },
  estado: { label: t("Estado"), icon: "circle-dashed" },
  proyecto: { label: t("Proyecto"), icon: "folder" },
  responsable: { label: t("Responsable"), icon: "user" },
  prioridad: { label: t("Prioridad"), icon: "signal" },
};

/** Carriles del Board: etiqueta, icono, plural y qué no cambia al arrastrar. */
export const LANE_META: Record<LaneBy, { label: string; icon: IconName; plural: string; what: string }> = {
  empresa: { label: t("Empresa"), icon: "building", plural: t("empresas"), what: t("la empresa") },
  proyecto: { label: t("Proyecto"), icon: "folder", plural: t("proyectos"), what: t("el proyecto") },
  responsable: { label: t("Responsable"), icon: "user", plural: t("responsables"), what: t("el responsable") },
};

/** Filtro de fecha (§5 de JST-21). */
const DATE_META = { label: t("Actualizada"), icon: "clock" as IconName };

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
      const options: DimOption[] = used.has(NO_PROJECT) ? [{ value: NO_PROJECT, label: t("Sin proyecto") }] : [];
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
      const options: DimOption[] = [{ value: UNASSIGNED, label: t("Sin asignar"), pre: <Avatar name={null} size={18} /> }];
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
        options.push({ value: key, label, group: t("Personas"), pre: <Avatar name={label} size={18} /> });
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
      if (value === NO_PROJECT) return t("Sin proyecto");
      const project = index.projectById.get(value);
      if (!project) return t("Proyecto desconocido");
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
  return t("{n} seleccionados", { n: values.length });
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
            placeholder={t("Buscar {what}…", { what: DIM_META[dim].label.toLowerCase() })}
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
        {visible.length === 0 ? <div className="gb-mh">{t("Sin coincidencias")}</div> : null}
      </div>
      {selected.length > 0 ? (
        <>
          <div className="gb-msep" />
          <button type="button" className="gb-mi" onClick={() => onFilters(clearFilter(filters, dim))}>
            <Icon name="x" size={14} />
            <span className="gb-lbl gb-muted">{t("Quitar filtro")}</span>
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
    { value: null, label: t("Cualquier fecha"), count: counts.any },
    { value: "7d" as const, label: t("En los últimos 7 días"), count: counts["7d"] },
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
        <span>{t("Usa la fecha «Actualizada» de cada tarea, la misma de la Lista. Cuenta 7 días hacia atrás desde ahora.")}</span>
      </div>
    </>
  );
}

type MoreSub = FilterDim | "act" | null;

/** Lo que agrupa el menú «Filtros». La empresa tiene sus botones en la barra. */
const MENU_DIMS = ["prj", "est", "resp", "pri", "eti"] as const satisfies readonly FilterDim[];

/**
 * «Filtros»: menú de dos niveles, Filtrar por → dimensión → valores.
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
    ...MENU_DIMS.map((key) => ({ key, ...DIM_META[key], count: filters[key].length })),
    { key: "act" as const, ...DATE_META, count: filters.act ? 1 : 0 },
  ];
  return (
    <>
      <div className="gb-mh">{t("Filtrar por")}</div>
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

/** «Actualizada» mide 280 también como segundo nivel de «Filtros» (§5). */
function menuWidth(menu: MenuState): number {
  if (menu.kind === "group") return 220;
  if (menu.kind === "more") return menu.sub === "act" || menu.sub === "prj" || menu.sub === "resp" ? 280 : 260;
  if (menu.kind === "act" || menu.kind === "lanes" || menu.dim === "prj" || menu.dim === "resp") return 280;
  return 240;
}

// ---------------------------------------------------------------------------
// Barra
// ---------------------------------------------------------------------------

/** Prefijos de `ocu` como los escribe la persona: separados por coma. */
const hideText = (hide: readonly string[]) => hide.join(", ");
const parseHide = (text: string) => [...new Set(text.split(",").map((part) => part.trim()).filter(Boolean))];

/**
 * «Ocultar títulos» de la vista Pedidos: esconde las raíces cuyo título empieza
 * con el texto (p. ej. los avisos que crea una automatización). Con debounce,
 * como la búsqueda; `sent` evita que la URL pise lo que se sigue escribiendo.
 */
function HideField({ query, onQuery }: { query: BoardQuery; onQuery: (query: BoardQuery) => void }) {
  const current = hideText(query.hide);
  const [draft, setDraft] = useState(current);
  const sent = useRef(current);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ query, onQuery });
  latest.current = { query, onQuery };
  useEffect(() => {
    if (current !== sent.current) {
      sent.current = current;
      setDraft(current);
    }
  }, [current]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onChange = (value: string) => {
    setDraft(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const hide = parseHide(value);
      sent.current = hideText(hide);
      const { query: now, onQuery: apply } = latest.current;
      apply({ ...now, hide });
    }, 400);
  };
  const label = t("Ocultar los pedidos cuyo título empieza con este texto. Separa varios con coma.");
  return (
    <label className={cx("gb-search", "gb-hide", query.hide.length > 0 && "is-active")} title={label}>
      <Icon name="eye-off" size={14} />
      <input value={draft} placeholder={t("Ocultar títulos que empiezan con…")} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function FilterBar({
  index,
  query,
  disabled,
  onQuery,
  onLanes,
  onFoldLanes,
}: {
  index: BoardIndex | null;
  query: BoardQuery;
  disabled: boolean;
  onQuery: (query: BoardQuery) => void;
  /** Cambiar la agrupación del Board despliega todos los carriles y vuelve a 2 tarjetas por celda. */
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

  // Filtros rápidos: cuántas tareas quedarían en esta vista con cada uno encendido.
  const { view, showClosed } = query;
  const quick = useMemo(() => {
    if (!index || view === "pedidos") return null;
    const count = (next: BoardFilters) => visibleIssues(index, { view, filters: next, showClosed }).length;
    return { toca: count({ ...filters, toca: true }), crit: count({ ...filters, pri: [...HOT_PRIORITIES] }) };
  }, [index, view, showClosed, filters]);
  const tocaOff = index !== null && !index.tocaAvailable;
  const critOn = isHotFilter(filters);

  // «Críticas y altas» ya se ve encendido en su botón: no repite el chip de Prioridad ni suma en «Filtros».
  const chipDims = MENU_DIMS.filter((dim) => filters[dim].length > 0 && !(dim === "pri" && critOn));
  const menuCount = chipDims.length + (filters.act ? 1 : 0);
  const lanes = view === "kanban" ? query.lanes : null;

  return (
    <>
      <div className={cx("gb-filters", disabled && "is-off")}>
        <label className="gb-search" title={t("Buscar por ID, título o empresa")}>
          <Icon name="search" size={14} />
          <input value={draft} placeholder={t("Buscar…")} aria-label={t("Buscar por ID, título o empresa")} onChange={(e) => onSearch(e.target.value)} />
        </label>
        {index && index.companies.length > 1 ? (
          <div className="gb-cotogs" role="group" aria-label={t("Empresas")}>
            {index.companies.map((company) => {
              const on = filters.emp.includes(company.prefix);
              return (
                <button
                  key={company.id}
                  type="button"
                  className={cx("gb-cotog", companyClass(company), on ? "is-on" : filters.emp.length > 0 && "is-dim")}
                  style={companyStyle(company)}
                  aria-pressed={on}
                  title={on ? t("Quitar filtro: {name}", { name: company.name }) : t("Ver solo: {name}", { name: company.name })}
                  onClick={() => setFilters(toggleValue(filters, "emp", company.prefix))}
                >
                  {company.prefix}
                </button>
              );
            })}
          </div>
        ) : null}
        <button
          type="button"
          className={cx("gb-btn", "gb-quick", filters.toca && !tocaOff && "is-on")}
          aria-pressed={filters.toca && !tocaOff}
          disabled={tocaOff}
          title={tocaOff ? t("No disponible en esta instancia") : t("Solo las tareas donde te toca responder")}
          onClick={() => setFilters({ ...filters, toca: !filters.toca })}
        >
          <Icon name="reply" size={14} />
          {t("Te toca")}
          {quick && !tocaOff ? <b className="gb-tnum">{quick.toca}</b> : null}
        </button>
        <button
          type="button"
          className={cx("gb-btn", "gb-quick", critOn && "is-on")}
          aria-pressed={critOn}
          title={t("Solo las de prioridad crítica o alta")}
          onClick={() => setFilters({ ...filters, pri: critOn ? [] : [...HOT_PRIORITIES] })}
        >
          <PriorityIcon priority="high" />
          {t("Críticas y altas")}
          {quick ? <b className="gb-tnum">{quick.crit}</b> : null}
        </button>
        <button
          type="button"
          className={cx("gb-btn", menuCount > 0 ? "is-active" : "is-ghost")}
          aria-haspopup="menu"
          aria-expanded={menu?.kind === "more"}
          onClick={(event) => toggleMenu({ kind: "more", anchor: event.currentTarget, sub: null })}
        >
          <Icon name="funnel" size={14} />
          {t("Filtros")}
          {menuCount > 0 ? <span className="gb-v">· {menuCount}</span> : null}
          <Icon name="chevron-down" size={14} />
        </button>
        <span className="gb-sp" />
        {view === "lista" ? (
          <button
            type="button"
            className="gb-btn"
            aria-haspopup="menu"
            onClick={(event) => toggleMenu({ kind: "group", anchor: event.currentTarget })}
          >
            <Icon name="layers" size={14} />
            {t("Agrupar: {group}", { group: GROUP_META[query.group].label })}
            <Icon name="chevron-down" size={14} />
          </button>
        ) : view === "pedidos" ? (
          <>
            <HideField query={query} onQuery={onQuery} />
            <button
              type="button"
              className="gb-btn is-ghost"
              title={t("Los pedidos hechos y cancelados")}
              onClick={() => onQuery({ ...query, showClosed: !query.showClosed })}
            >
              <Icon name={query.showClosed ? "eye-off" : "eye"} size={14} />
              {query.showClosed ? t("Ocultar cerrados") : t("Ver cerrados")}
            </button>
          </>
        ) : view === "kanban" ? (
          <>
            {query.showClosed ? (
              <button type="button" className="gb-btn is-ghost" title={t("Ocultar las columnas Hecha y Cancelada")} onClick={() => onQuery({ ...query, showClosed: false })}>
                <Icon name="eye-off" size={14} />
                {t("Ocultar cerradas")}
              </button>
            ) : null}
            <button
              type="button"
              className="gb-btn"
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "lanes"}
              onClick={(event) => toggleMenu({ kind: "lanes", anchor: event.currentTarget })}
            >
              <Icon name="rows" size={14} />
              {t("Agrupar: {group}", { group: lanes ? LANE_META[lanes].label : t("Sin agrupar") })}
              <Icon name="chevron-down" size={14} />
            </button>
          </>
        ) : null}
      </div>

      {index && (chipDims.length > 0 || filters.act || filters.q) ? (
        <div className="gb-chips">
          {t("Filtros:")}
          {chipDims.map((dim) => (
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
              <button type="button" className="gb-x" aria-label={t("Quitar filtro {name}", { name: DIM_META[dim].label })} onClick={() => setFilters(clearFilter(filters, dim))}>
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
                {t("últimos 7 días")}
              </button>
              <button type="button" className="gb-x" aria-label={t("Quitar filtro {name}", { name: DATE_META.label })} onClick={() => setFilters(clearFilter(filters, "act"))}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ) : null}
          {filters.q ? (
            <span className="gb-fchip">
              <span className="gb-k">{t("Texto")}</span>
              <span className="gb-v">“{filters.q}”</span>
              <button type="button" className="gb-x" aria-label={t("Quitar búsqueda")} onClick={() => setFilters(clearFilter(filters, "q"))}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ) : null}
          <button type="button" className="gb-linkbtn" onClick={() => setFilters(emptyFilters())}>
            {t("Limpiar todo")}
          </button>
        </div>
      ) : null}

      {menu && index ? (
        <Popover
          anchor={menu.anchor}
          width={menuWidth(menu)}
          align={menu.kind === "lanes" || menu.kind === "group" ? "end" : "start"}
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
              <div className="gb-mh">{t("Agrupar el Board por")}</div>
              {[...LANE_OPTIONS, null].map((option) => (
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
                  <span className="gb-lbl">{option ? LANE_META[option].label : t("Sin agrupar")}</span>
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
                      <span className="gb-lbl">{fold ? t("Plegar todos los carriles") : t("Desplegar todos")}</span>
                    </button>
                  ))}
                </>
              ) : null}
              <div className="gb-msep" />
              <div className="gb-mnote">
                <Icon name="info" size={12} />
                <span>{t("Las columnas siguen siendo los estados. Al arrastrar solo cambia el estado, dentro del mismo carril.")}</span>
              </div>
            </>
          ) : (
            <>
              <div className="gb-mh">{t("Agrupar por")}</div>
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
