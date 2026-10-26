// Vistas guardadas (Fase 2, design-spec §3 de JST-21, alternativa A ·
// Pestañas): fila de pestañas bajo la cabecera, «Más · N», «Guardar vista»,
// renombrar en la pestaña, menú «⋯» y confirmación de borrado. Las vistas viven
// en el servidor y las comparte toda la instancia; la vista «de origen» (para
// «Cambios sin guardar») se recuerda en memoria, en este navegador.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { FILTER_DIMS, allBoardQuery, visibleIssues, type BoardIndex, type BoardQuery } from "../board.js";
import {
  VIEW_NAME_MAX,
  cleanViewName,
  suggestViewName,
  viewCount,
  viewNameError,
  viewQuery,
  viewSearch,
  viewState,
  type SavedView,
  type ViewOp,
  type ViewOpResult,
  type ViewState,
} from "../views.js";
import { Skeleton, cx, plural } from "./common.js";
import { DIM_META, GROUP_META, LANE_META, valueLabel } from "./filters.js";
import { Icon, type IconName } from "./icons.js";
import { Popover, type ToastInput } from "./layer.js";
import type { SavedViews } from "./useSavedViews.js";

const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** «Qué guarda» la vista (§3.4): Kanban · Carriles: Empresa · Prioridad: Crítica, Alta… */
function summaryItems(index: BoardIndex, query: BoardQuery): Array<{ icon: IconName; text: string }> {
  const { filters } = query;
  const items: Array<{ icon: IconName; text: string }> = [
    query.view === "lista"
      ? { icon: "list", text: `Lista por ${GROUP_META[query.group].label.toLowerCase()}` }
      : { icon: "kanban", text: "Kanban" },
  ];
  if (query.view === "kanban" && query.lanes) items.push({ icon: "rows", text: `Carriles: ${LANE_META[query.lanes].label}` });
  if (filters.toca) items.push({ icon: "reply", text: "Te toca" });
  for (const dim of FILTER_DIMS) {
    const values = filters[dim] as readonly string[];
    if (values.length === 0) continue;
    const shown = values.length <= 2 ? values.map((value) => valueLabel(index, dim, value)).join(", ") : `${values.length} valores`;
    items.push({ icon: DIM_META[dim].icon, text: `${DIM_META[dim].label}: ${shown}` });
  }
  if (filters.act) items.push({ icon: "clock", text: "Actualizada: últimos 7 días" });
  if (filters.q.trim()) items.push({ icon: "search", text: `«${filters.q.trim()}»` });
  if (query.subtasksCollapsed) items.push({ icon: "list-tree", text: "Subtareas plegadas" });
  if (query.showClosed) items.push({ icon: "eye", text: "Con hechas y canceladas" });
  return items;
}

type Menu =
  | { kind: "tab"; id: string; anchor: HTMLElement }
  | { kind: "confirm"; id: string; anchor: HTMLElement }
  | { kind: "more"; anchor: HTMLElement }
  | { kind: "save"; anchor: HTMLElement; name: string; error: string | null };

interface Editing {
  id: string;
  value: string;
  error: string | null;
}

const FIT_GAP = 2;

export function ViewTabs({
  index,
  query,
  now,
  saved,
  onApply,
  toast,
}: {
  index: BoardIndex | null;
  query: BoardQuery;
  now: number;
  saved: SavedViews;
  /** Abre una consulta: la de una vista, «Todo el board» o «Descartar». */
  onApply: (query: BoardQuery) => void;
  toast: (toast: ToastInput) => void;
}) {
  const ready = saved.status === "ok";
  const views = saved.views;
  const [origin, setOrigin] = useState<string | null>(null);
  const state: ViewState = viewState(ready ? views : null, query, origin);
  const activeId = state.kind === "view" ? state.view.id : null;
  useEffect(() => {
    if (activeId) setOrigin(activeId);
  }, [activeId]);
  const tabId = state.kind === "view" || state.kind === "mod" ? state.view.id : null;

  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const saveRef = useRef<HTMLButtonElement>(null);

  // ---------- Pestañas que no caben: «Más · N» (§3.8) ----------
  const rowRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [, setWidth] = useState(0);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const tabs = Array.from(row.querySelectorAll<HTMLElement>("[data-view-tab]"));
    const more = row.querySelector<HTMLElement>("[data-tabs-more]");
    for (const tab of tabs) tab.style.display = "";
    if (more) more.style.display = "";
    const fixed = Array.from(row.children)
      .filter((child) => !(child as HTMLElement).matches("[data-view-tab], [data-tabs-more]"))
      .reduce((sum, child) => sum + (child as HTMLElement).offsetWidth + FIT_GAP, 0);
    let available = row.clientWidth - fixed - 12;
    const next: string[] = [];
    if (more && tabs.reduce((sum, tab) => sum + tab.offsetWidth + FIT_GAP, 0) > available) {
      available -= more.offsetWidth + FIT_GAP;
      // La activa siempre se ve, aunque esté después en el orden.
      const active = tabs.find((tab) => tab.dataset.active === "1");
      let used = active ? active.offsetWidth + FIT_GAP : 0;
      let full = false;
      for (const tab of tabs) {
        if (tab === active) continue;
        if (!full && used + tab.offsetWidth + FIT_GAP <= available) used += tab.offsetWidth + FIT_GAP;
        else {
          full = true;
          next.push(tab.dataset.viewTab!);
        }
      }
    }
    for (const tab of tabs) tab.style.display = next.includes(tab.dataset.viewTab!) ? "none" : "";
    if (more) more.style.display = next.length > 0 ? "" : "none";
    if (next.join(",") !== hidden.join(",")) setHidden(next);
  });

  // ---------- Escrituras ----------
  const byId = (id: string) => views.find((view) => view.id === id);

  /**
   * Corre la operación y resuelve lo común (§3.10): si sale bien, confirma con
   * el toast `done`; si otro navegador borró la vista, avisa y queda la lista
   * del servidor; si la llamada falla, el cambio ya se deshizo y el toast ofrece
   * «Reintentar», que repite todo (también la confirmación).
   */
  const write = async (
    op: ViewOp,
    text: { verb: string; name: string; done: ReactNode },
    onInvalid: (message: string) => void = () => undefined,
  ): Promise<void> => {
    let result: ViewOpResult;
    try {
      result = await saved.mutate(op);
    } catch (err) {
      toast({
        error: true,
        content: (
          <>
            No se pudo {text.verb} la vista <b>{text.name}</b>: {(err as Error).message}
          </>
        ),
        action: { label: "Reintentar", run: () => void write(op, text, onInvalid) },
      });
      return;
    }
    if (result.ok) toast({ content: text.done });
    else if (result.reason === "not_found") toast({ content: `La vista «${text.name}» ya no existe. Se actualizó la lista.` });
    else onInvalid(result.message);
  };

  const create = async (name: string) => {
    const id = crypto.randomUUID();
    const clean = cleanViewName(name);
    setMenu(null);
    setOrigin(id);
    await write(
      { op: "create", id, name: clean, search: viewSearch(query) },
      {
        verb: "guardar",
        name: clean,
        done: (
          <>
            Vista <b>{clean}</b> guardada <span className="gb-muted">· compartida en esta instancia</span>
          </>
        ),
      },
      (message) => {
        // Otro navegador ya usó el nombre: vuelve el formulario con el error (§3.10).
        if (saveRef.current) setMenu({ kind: "save", anchor: saveRef.current, name: clean, error: message });
      },
    );
  };

  const rename = async (view: SavedView, name: string) => {
    const clean = cleanViewName(name);
    setEditing(null);
    if (clean === view.name) return;
    await write(
      { op: "rename", id: view.id, name: clean },
      {
        verb: "renombrar",
        name: view.name,
        done: (
          <>
            Vista renombrada: <b>{clean}</b>
          </>
        ),
      },
      (message) => setEditing({ id: view.id, value: clean, error: message }),
    );
  };

  const update = async (view: SavedView) => {
    setMenu(null);
    setOrigin(view.id);
    await write(
      { op: "update", id: view.id, search: viewSearch(query) },
      {
        verb: "actualizar",
        name: view.name,
        done: (
          <>
            Vista <b>{view.name}</b> actualizada con los filtros de ahora
          </>
        ),
      },
    );
  };

  const remove = async (view: SavedView) => {
    setMenu(null);
    // El board no cambia: los mismos filtros pasan a «sin guardar».
    if (origin === view.id) setOrigin(null);
    await write(
      { op: "delete", id: view.id },
      {
        verb: "borrar",
        name: view.name,
        done: (
          <>
            Vista <b>{view.name}</b> borrada <span className="gb-muted">· el board no cambió</span>
          </>
        ),
      },
    );
  };

  // ---------- Abrir, renombrar ----------
  const openView = (view: SavedView) => {
    setMenu(null);
    setOrigin(view.id);
    onApply(viewQuery(view));
  };
  const openAll = () => {
    setMenu(null);
    setOrigin(null);
    onApply(allBoardQuery(query));
  };
  const startRename = (view: SavedView) => {
    setMenu(null);
    setEditing({ id: view.id, value: view.name, error: null });
  };
  const commitRename = () => {
    const current = editingRef.current;
    const view = current && byId(current.id);
    if (!current || !view) return setEditing(null);
    const error = viewNameError(views, current.value, view.id);
    if (error) return setEditing({ ...current, error });
    void rename(view, current.value);
  };

  const onTabClick = (event: MouseEvent, view: SavedView) => {
    if ((event.target as HTMLElement).closest("button, input")) return;
    // El primer clic abre la vista; el segundo (doble clic) renombra.
    if (event.detail >= 2) startRename(view);
    else openView(view);
  };
  const onTabKey = (event: KeyboardEvent, view: SavedView) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") openView(view);
    if (event.key === "F2") {
      event.preventDefault();
      startRename(view);
    }
  };

  const count = (value: number | null) =>
    value === null ? <Skeleton width={24} height={12} style={{ borderRadius: 8 }} /> : <span className="gb-n gb-tnum">{value}</span>;
  const allCount = index ? visibleIssues(index, allBoardQuery(query), now).length : null;
  const tabCount = (view: SavedView) => (index ? viewCount(index, view, now) : null);

  const allTab = (
    <span
      className={cx("gb-tab", "is-all", state.kind === "all" && "is-on")}
      role="tab"
      aria-selected={state.kind === "all"}
      tabIndex={0}
      onClick={openAll}
      onKeyDown={(event) => event.key === "Enter" && openAll()}
    >
      Todo el board
      {count(allCount)}
    </span>
  );

  const saveOff = (why: string) => (
    <button type="button" className="gb-btn is-sm is-ghost gb-save" disabled title={why}>
      <Icon name="plus" size={14} />
      Guardar vista
    </button>
  );

  if (saved.status !== "ok") {
    const loading = saved.status === "loading";
    return (
      <div className="gb-tabs" role="tablist" aria-label="Vistas guardadas" aria-busy={loading || undefined}>
        {allTab}
        {loading ? (
          [112, 148, 92].map((width) => (
            <span key={width} className="gb-tab is-ghost" aria-hidden="true">
              <Skeleton width={width} height={10} />
            </span>
          ))
        ) : (
          <span className="gb-tabsmsg" role="status">
            <Icon name="circle-alert" size={14} />
            No se pudieron cargar las vistas guardadas.
            <button type="button" className="gb-linkbtn" onClick={() => void saved.reload()}>
              Reintentar
            </button>
          </span>
        )}
        {saveOff(loading ? "Cargando las vistas…" : "Primero hay que cargar las vistas")}
      </div>
    );
  }

  const menuView = menu && (menu.kind === "tab" || menu.kind === "confirm") ? byId(menu.id) : undefined;
  const modView = state.kind === "mod" ? state.view : null;

  return (
    <>
      <div ref={rowRef} className="gb-tabs" role="tablist" aria-label="Vistas guardadas">
        {allTab}
        {views.map((view) => {
          const on = view.id === tabId;
          const mod = on && state.kind === "mod";
          if (editing?.id === view.id) {
            return (
              <span key={view.id} className="gb-tab is-on is-editing" data-view-tab={view.id} data-active={on ? "1" : undefined}>
                <input
                  className={cx("gb-tabin", editing.error && "is-bad")}
                  value={editing.value}
                  maxLength={80}
                  aria-label="Nombre de la vista"
                  aria-invalid={editing.error ? true : undefined}
                  spellCheck={false}
                  autoFocus
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setEditing({ id: view.id, value: event.target.value, error: null })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditing(null);
                    }
                  }}
                  onBlur={() => {
                    // Al salir del campo: guarda si el nombre sirve; si no, cancela.
                    const current = editingRef.current;
                    if (current?.id !== view.id) return;
                    if (viewNameError(views, current.value, view.id)) setEditing(null);
                    else commitRename();
                  }}
                />
                <span className={cx("gb-tabtip", editing.error && "is-bad")} role={editing.error ? "alert" : undefined}>
                  {editing.error ? (
                    <>
                      <Icon name="circle-alert" size={12} />
                      {editing.error}
                    </>
                  ) : (
                    "Enter guarda · Esc cancela"
                  )}
                </span>
              </span>
            );
          }
          return (
            <span
              key={view.id}
              className={cx("gb-tab", on && "is-on")}
              data-view-tab={view.id}
              data-active={on ? "1" : undefined}
              role="tab"
              aria-selected={on}
              tabIndex={0}
              title={`${view.name} · doble clic para renombrar`}
              onClick={(event) => onTabClick(event, view)}
              onKeyDown={(event) => onTabKey(event, view)}
            >
              <span className="gb-nm">{view.name}</span>
              {mod ? <i className="gb-dot" title="Cambios sin guardar" /> : null}
              {count(tabCount(view))}
              <button
                type="button"
                className="gb-tabmenu"
                aria-label={`Opciones de la vista ${view.name}`}
                aria-haspopup="menu"
                onClick={(event) => {
                  const tab = event.currentTarget.closest<HTMLElement>("[data-view-tab]")!;
                  setMenu((current) => (current?.kind === "tab" && current.id === view.id ? null : { kind: "tab", id: view.id, anchor: tab }));
                }}
              >
                <Icon name="more" size={14} />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="gb-tabmore"
          data-tabs-more=""
          aria-haspopup="menu"
          style={{ display: "none" }}
          onClick={(event) => setMenu({ kind: "more", anchor: event.currentTarget })}
        >
          Más
          <span className="gb-n gb-tnum">{hidden.length}</span>
          <Icon name="chevron-down" size={14} />
        </button>
        <button
          ref={saveRef}
          type="button"
          className={cx("gb-btn", "is-sm", "gb-save", (state.kind === "all" || state.kind === "view") && "is-ghost")}
          disabled={state.kind === "view" || !index}
          title={state.kind === "view" ? `Ya está guardada como «${state.view.name}»` : !index ? "Cargando las tareas…" : undefined}
          onClick={(event) =>
            index &&
            setMenu({ kind: "save", anchor: event.currentTarget, name: suggestViewName(index, query, views), error: null })
          }
        >
          <Icon name={state.kind === "unsaved" ? "bookmark-plus" : "plus"} size={14} />
          {state.kind === "mod" ? "Guardar como nueva" : "Guardar vista"}
        </button>
        {views.length === 0 ? (
          <span className="gb-tabhint">
            <Icon name="bookmark" size={12} />
            Guarda los filtros que usas seguido. Por ejemplo, «Bloqueadas de todas las empresas».
          </span>
        ) : null}
        {modView ? (
          <span className="gb-modbar">
            <i className="gb-dot" />
            Cambios sin guardar
            <button type="button" className="gb-linkbtn" title={`Volver a los filtros guardados de «${modView.name}»`} onClick={() => openView(modView)}>
              <Icon name="undo-2" size={12} />
              Descartar
            </button>
            <button type="button" className="gb-btn is-sm is-primary" onClick={() => void update(modView)}>
              <Icon name="check" size={14} />
              Actualizar vista
            </button>
          </span>
        ) : null}
      </div>

      {menu?.kind === "tab" && menuView ? (
        <Popover anchor={menu.anchor} width={280} onClose={() => setMenu(null)}>
          <div className="gb-mh">{short(menuView.name, 36)}</div>
          <button type="button" className="gb-mi" onClick={() => startRename(menuView)}>
            <Icon name="pencil" size={14} />
            <span className="gb-lbl">Renombrar</span>
            <span className="gb-kbd">doble clic</span>
          </button>
          <button
            type="button"
            className={cx("gb-mi", modView?.id !== menuView.id && "is-off")}
            aria-disabled={modView?.id !== menuView.id || undefined}
            onClick={() => modView?.id === menuView.id && void update(menuView)}
          >
            <Icon name="refresh" size={14} />
            <span className="gb-lbl">Actualizar con los filtros de ahora</span>
          </button>
          <div className="gb-msep" />
          <button type="button" className="gb-mi is-danger" onClick={() => setMenu({ kind: "confirm", id: menuView.id, anchor: menu.anchor })}>
            <Icon name="trash-2" size={14} />
            <span className="gb-lbl">Borrar vista…</span>
          </button>
        </Popover>
      ) : null}

      {menu?.kind === "confirm" && menuView ? (
        <Popover anchor={menu.anchor} width={300} className="gb-form" role="dialog" label="Confirmar borrado" onClose={() => setMenu(null)}>
          <ConfirmDelete view={menuView} onCancel={() => setMenu(null)} onConfirm={() => void remove(menuView)} />
        </Popover>
      ) : null}

      {menu?.kind === "more" ? (
        <Popover anchor={menu.anchor} width={280} onClose={() => setMenu(null)}>
          <div className="gb-mh">Más vistas</div>
          {hidden.flatMap((id) => {
            const view = byId(id);
            if (!view) return [];
            return [
              <button key={id} type="button" className="gb-mi" onClick={() => openView(view)}>
                <Icon name="bookmark" size={14} />
                <span className="gb-lbl">{view.name}</span>
                <span className="gb-n gb-tnum">{tabCount(view) ?? ""}</span>
              </button>,
            ];
          })}
        </Popover>
      ) : null}

      {menu?.kind === "save" && index ? (
        <Popover anchor={menu.anchor} width={320} className="gb-form" role="dialog" label="Guardar vista" onClose={() => setMenu(null)}>
          <SaveForm
            index={index}
            query={query}
            now={now}
            views={views}
            initialName={menu.name}
            initialError={menu.error}
            onCancel={() => setMenu(null)}
            onSave={(name) => void create(name)}
          />
        </Popover>
      ) : null}
    </>
  );
}

function ConfirmDelete({ view, onCancel, onConfirm }: { view: SavedView; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return (
    <>
      <h4>¿Borrar la vista «{view.name}»?</h4>
      <p className="gb-dsub">
        <b>Se borra para todos los que usan esta instancia.</b> Las tareas y los filtros de ahora no cambian.
      </p>
      <div className="gb-acts">
        <button ref={cancelRef} type="button" className="gb-btn is-sm is-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="gb-btn is-sm is-danger" onClick={onConfirm}>
          <Icon name="trash-2" size={14} />
          Borrar
        </button>
      </div>
    </>
  );
}

function SaveForm({
  index,
  query,
  now,
  views,
  initialName,
  initialError,
  onCancel,
  onSave,
}: {
  index: BoardIndex;
  query: BoardQuery;
  now: number;
  views: readonly SavedView[];
  initialName: string;
  initialError: string | null;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(initialError);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // El nombre sugerido viene todo seleccionado, para escribir encima.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const submit = () => {
    const problem = viewNameError(views, name);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    onSave(name);
  };
  const shown = visibleIssues(index, query, now).length;
  return (
    <>
      <h4>Guardar vista</h4>
      <p className="gb-dsub">Guarda los filtros, la vista y los carriles de ahora para volver con un clic.</p>
      <div className="gb-field">
        <label htmlFor="gb-view-name">Nombre</label>
        <input
          ref={inputRef}
          id="gb-view-name"
          className={cx("gb-input", error && "is-bad")}
          value={name}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby="gb-view-name-help"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div id="gb-view-name-help" className={cx("gb-help", error && "is-bad")}>
          <span className="gb-msg">
            {error ? (
              <>
                <Icon name="circle-alert" size={12} />
                {error}
              </>
            ) : (
              `Hasta ${VIEW_NAME_MAX} caracteres. No se puede repetir.`
            )}
          </span>
          <span className="gb-tnum">
            {cleanViewName(name).length}/{VIEW_NAME_MAX}
          </span>
        </div>
      </div>
      <div className="gb-field" style={{ marginTop: 12 }}>
        <label>Qué guarda</label>
        <div className="gb-sums">
          {summaryItems(index, query).map((item) => (
            <span key={item.text} className="gb-sum">
              <Icon name={item.icon} size={12} />
              {item.text}
            </span>
          ))}
        </div>
      </div>
      <div className="gb-count">
        <Icon name="eye" size={12} />
        Ahora muestra {plural(shown, "tarea", "tareas")}
      </div>
      <div className="gb-count is-shared">
        <Icon name="users" size={12} />
        La ven y la pueden cambiar todos en esta instancia
      </div>
      <div className="gb-acts">
        <button type="button" className="gb-btn is-sm is-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="gb-btn is-sm is-primary" onClick={submit}>
          Guardar vista
        </button>
      </div>
    </>
  );
}
