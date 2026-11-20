// Vista Pedidos: una fila por tarea raíz con el resumen de todo lo que se creó
// por debajo (quién tiene la pelota, avance del subárbol completo, última
// novedad y último movimiento). Las secciones van en el orden de `PEDIDO_STATES`:
// lo que pide algo de ti, arriba; «Sin empezar» y «Cerrado» parten plegadas.
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { WAIT_LABELS, emptyFilters, hasActiveFilters, relativeTime, type BoardFilters, type BoardIndex, type BoardQuery } from "../board.js";
import {
  PEDIDO_FOLDED,
  PEDIDO_HINTS,
  PEDIDO_LABELS,
  liveByIssue,
  pedidoSections,
  pedidoTree,
  type PedidoRow,
  type PedidoSection,
  type PedidoState,
} from "../pedidos.js";
import { isOpenStatus, type BoardIssue, type LiveRun } from "../shared.js";
import { hrefFor } from "./card.js";
import {
  Avatar,
  CompanyTag,
  ProgressBar,
  STATUS_LABELS,
  StatusIcon,
  TocaPill,
  assigneeName,
  cx,
  isOwnClick,
  openHref,
  plural,
} from "./common.js";
import { Icon, type IconName } from "./icons.js";
import { usePedidoNotes, type PedidoNote } from "./usePedidos.js";

const SECTION_STEP = 25;
const TREE_STEP = 40;

const STATE_ICONS: Record<PedidoState, IconName> = {
  toca: "reply",
  cerrar: "circle-check",
  bloqueado: "circle-minus",
  espera: "link",
  pausa: "clock",
  sueltos: "circle-alert",
  trabajando: "zap",
  curso: "rotate-cw",
  nuevo: "circle-dashed",
  cerrado: "check",
};

function toggled(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function PedidosView({
  index,
  rows,
  live,
  now,
  userId,
  unfold,
}: {
  index: BoardIndex;
  rows: readonly PedidoRow[];
  live: readonly LiveRun[];
  now: number;
  userId: string | null;
  /** Con búsqueda o filtro de estado, todas las secciones parten desplegadas: lo que se buscó no queda escondido. */
  unfold: boolean;
}) {
  const sections = useMemo(() => pedidoSections(rows), [rows]);
  const liveMap = useMemo(() => liveByIssue(live), [live]);
  // Estado de la vista que no va en la URL: secciones tocadas a mano, pedidos desplegados y «Ver más».
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [more, setMore] = useState<Readonly<Record<string, number>>>({});

  const isClosed = (state: PedidoState) => (!unfold && PEDIDO_FOLDED.has(state)) !== flipped.has(state);
  const limitOf = (state: PedidoState) => more[state] ?? SECTION_STEP;
  // La última novedad se pide solo para los pedidos abiertos que están a la vista.
  const shown = useMemo(
    () =>
      sections.flatMap((section) =>
        section.state === "cerrado" || isClosed(section.state) ? [] : section.rows.slice(0, limitOf(section.state)).map((row) => row.issue),
      ),
    // `isClosed` y `limitOf` dependen de estos tres.
    [sections, flipped, more, unfold],
  );
  const notes = usePedidoNotes(index, shown, userId);

  return (
    <div className="gb-list gb-ped">
      {sections.map((section) => (
        <Section
          key={section.state}
          index={index}
          section={section}
          closed={isClosed(section.state)}
          limit={limitOf(section.state)}
          expanded={expanded}
          notes={notes}
          live={liveMap}
          now={now}
          onToggle={() => setFlipped((prev) => toggled(prev, section.state))}
          onExpand={(id) => setExpanded((prev) => toggled(prev, id))}
          onMore={(next) => setMore((prev) => ({ ...prev, [section.state]: next }))}
        />
      ))}
    </div>
  );
}

function Section({
  index,
  section,
  closed,
  limit,
  expanded,
  notes,
  live,
  now,
  onToggle,
  onExpand,
  onMore,
}: {
  index: BoardIndex;
  section: PedidoSection;
  closed: boolean;
  limit: number;
  expanded: ReadonlySet<string>;
  notes: ReadonlyMap<string, PedidoNote>;
  live: ReadonlyMap<string, readonly LiveRun[]>;
  now: number;
  onToggle: () => void;
  onExpand: (issueId: string) => void;
  onMore: (next: number) => void;
}) {
  const { state, rows } = section;
  const left = rows.length - limit;
  return (
    <div className={cx("gb-lgrp", "is-plain", "gb-psec", `is-${state}`, closed && "is-closed")}>
      <button type="button" className="gb-grph" aria-expanded={!closed} onClick={onToggle}>
        <span className="gb-chev">
          <Icon name="chevron-down" size={14} />
        </span>
        <span className="gb-ic gb-pico">
          <Icon name={STATE_ICONS[state]} size={14} />
        </span>
        <span className="gb-nm">{PEDIDO_LABELS[state]}</span>
        <span className="gb-muted gb-pcount">{plural(rows.length, "pedido", "pedidos")}</span>
        <span className="gb-muted gb-phint">{PEDIDO_HINTS[state]}</span>
      </button>
      {closed ? null : (
        <>
          {rows.slice(0, limit).map((row) => (
            <Row
              key={row.issue.id}
              index={index}
              row={row}
              open={expanded.has(row.issue.id)}
              note={notes.get(row.issue.id)}
              live={live}
              now={now}
              onExpand={() => onExpand(row.issue.id)}
            />
          ))}
          {left > 0 ? (
            <div className="gb-rowmore">
              <button type="button" className="gb-linkbtn" onClick={() => onMore(limit + SECTION_STEP)}>
                Ver {Math.min(SECTION_STEP, left)} más · quedan {left}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Enlace a otra tarea dentro de la celda: va por encima del enlace que cubre la fila. */
function TaskLink({ index, issue, children }: { index: BoardIndex; issue: BoardIssue; children?: ReactNode }) {
  return (
    <a className="gb-plink gb-mono" href={hrefFor(index, issue)} title={issue.title}>
      {children ?? issue.identifier}
    </a>
  );
}

/** Quién tiene la pelota, con la tarea que lo explica. */
function Ball({ index, row }: { index: BoardIndex; row: PedidoRow }) {
  const { issue, state } = row;
  const icon = (
    <span className="gb-ic gb-pico">
      <Icon name={STATE_ICONS[state]} size={14} />
    </span>
  );
  switch (state) {
    case "toca": {
      const first = row.waits[0]!;
      const waiting = index.waiting.get(first.id);
      const rest = row.waits.length - 1;
      return (
        <>
          <TocaPill small />
          <span className="gb-pwhat" title={waiting?.what}>
            {first.id === issue.id ? (
              <TaskLink index={index} issue={first}>
                {waiting ? WAIT_LABELS[waiting.kind] : "Atender"}
              </TaskLink>
            ) : (
              <>
                en <TaskLink index={index} issue={first} />
              </>
            )}
            {rest > 0 ? ` y ${rest} más` : null}
          </span>
        </>
      );
    }
    case "cerrar":
      return (
        <>
          {icon}
          <span className="gb-pwhat">Todo hecho, falta cerrarlo</span>
        </>
      );
    case "trabajando": {
      const first = row.live[0]!;
      const rest = row.live.length - 1;
      return (
        <>
          {icon}
          <span className="gb-pwhat">
            {first.run.agentName}
            {first.issue.id === issue.id ? null : (
              <>
                {" "}
                en <TaskLink index={index} issue={first.issue} />
              </>
            )}
            {rest > 0 ? ` y ${rest} más` : null}
          </span>
        </>
      );
    }
    case "espera":
      return (
        <>
          {icon}
          <span className="gb-pwhat">
            {row.stuck && row.stuck.id !== issue.id ? (
              <>
                <TaskLink index={index} issue={row.stuck} /> espera
              </>
            ) : (
              "Espera"
            )}{" "}
            {row.blocker ? <TaskLink index={index} issue={row.blocker} /> : "otra tarea"}
          </span>
          {row.blocker && index.waiting.has(row.blocker.id) ? <TocaPill small iconOnly /> : null}
        </>
      );
    case "pausa":
      return (
        <>
          {icon}
          <span className="gb-pwhat">Lo que falta está en backlog</span>
        </>
      );
    case "sueltos": {
      const left = row.open.reduce((sum, entry) => sum + entry.count, 0);
      return (
        <>
          {icon}
          <span className="gb-pwhat">Cerrado con {plural(left, "subtarea abierta", "subtareas abiertas")}</span>
        </>
      );
    }
    case "bloqueado":
      return (
        <>
          {icon}
          <span className="gb-pwhat">
            {row.stuck && row.stuck.id !== issue.id ? (
              <>
                <TaskLink index={index} issue={row.stuck} /> bloqueada
              </>
            ) : (
              "Bloqueado, sin bloqueador"
            )}
          </span>
        </>
      );
    default: {
      const who = assigneeName(index, issue);
      return (
        <>
          <StatusIcon status={issue.status} />
          <span className="gb-pwhat">
            {STATUS_LABELS[issue.status]}
            {who ? ` · ${who}` : null}
          </span>
        </>
      );
    }
  }
}

function Row({
  index,
  row,
  open,
  note,
  live,
  now,
  onExpand,
}: {
  index: BoardIndex;
  row: PedidoRow;
  open: boolean;
  note: PedidoNote | undefined;
  live: ReadonlyMap<string, readonly LiveRun[]>;
  now: number;
  onExpand: () => void;
}) {
  const { issue, progress } = row;
  const href = hrefFor(index, issue);
  const hit = row.hits[0];
  return (
    <div className={cx("gb-prow", `is-${row.state}`, open && "is-open")} data-iid={issue.id}>
      <div
        className="gb-pmain"
        onClick={(event) => {
          // El enlace cubre la fila; esto cubre los iconos que quedan encima para mostrar su título.
          if (isOwnClick(event)) openHref(href, event);
        }}
      >
        <span className="gb-pexp">
          {index.kids.has(issue.id) ? (
            <button
              type="button"
              className={cx("gb-tchev", !open && "is-closed")}
              aria-expanded={open}
              aria-label={`${open ? "Plegar" : "Desplegar"} las subtareas de ${issue.identifier ?? "el pedido"}`}
              onClick={onExpand}
            >
              <Icon name="chevron-down" size={12} />
            </button>
          ) : (
            <span className="gb-tdot" />
          )}
        </span>
        <span className="gb-rid">
          <CompanyTag company={index.companyById.get(issue.companyId)} solid />
          <span className="gb-mono">{issue.identifier}</span>
        </span>
        <span className="gb-pbody">
          <span className="gb-ptitle">
            {/* Un pedido cerrado que sigue en la lista (cabos sueltos, o «Ver cerrados») lleva su estado a la vista. */}
            {isOpenStatus(issue.status) ? null : <StatusIcon status={issue.status} />}
            <a className="gb-tt gb-cover" href={href} title={issue.title} aria-label={`${issue.identifier ?? ""} ${issue.title}`}>
              {issue.title}
            </a>
          </span>
          {hit ? (
            <span className="gb-pnote">
              <Icon name="corner-down-right" size={12} />
              <span>
                Coincide <TaskLink index={index} issue={hit} /> {hit.title}
                {row.hits.length > 1 ? ` y ${row.hits.length - 1} más` : null}
              </span>
            </span>
          ) : note ? (
            <span className="gb-pnote" title={`${note.author}: ${note.text}`}>
              <span>
                <b>{note.author}:</b> {note.text}
              </span>
              <span className="gb-pnote-at">{relativeTime(note.at, now)}</span>
            </span>
          ) : null}
        </span>
        <span className="gb-pball">
          <Ball index={index} row={row} />
        </span>
        <span className="gb-pprog">
          {progress.total > 0 ? (
            <>
              <ProgressBar done={progress.done} total={progress.total} width={56} />
              <span className="gb-tnum">
                {progress.done} de {progress.total}
              </span>
              <span className="gb-popen">
                {row.open.map(({ status, count }) => (
                  <span key={status} title={`${count} ${STATUS_LABELS[status].toLowerCase()}`}>
                    <StatusIcon status={status} size={12} />
                    <span className="gb-tnum">{count}</span>
                  </span>
                ))}
              </span>
            </>
          ) : (
            <span className="gb-muted">Sin subtareas</span>
          )}
        </span>
        <span className="gb-upd" title="Último movimiento de cualquier tarea del pedido">
          {relativeTime(row.lastMove, now)}
        </span>
      </div>
      {open ? <Tree index={index} root={issue} live={live} now={now} /> : null}
    </div>
  );
}

/** Todo lo que se creó por debajo del pedido, en árbol. */
function Tree({ index, root, live, now }: { index: BoardIndex; root: BoardIssue; live: ReadonlyMap<string, readonly LiveRun[]>; now: number }) {
  const rows = useMemo(() => pedidoTree(index, root), [index, root]);
  const [limit, setLimit] = useState(TREE_STEP);
  return (
    <div className="gb-ptree">
      {rows.slice(0, limit).map(({ issue, depth }) => {
        const href = hrefFor(index, issue);
        const who = assigneeName(index, issue);
        const run = live.get(issue.id)?.[0];
        return (
          <div
            key={issue.id}
            className={cx("gb-pkid", !isOpenStatus(issue.status) && "is-closed", index.waiting.has(issue.id) && "is-w")}
            style={{ "--d": depth } as CSSProperties}
            onClick={(event) => {
              if (isOwnClick(event)) openHref(href, event);
            }}
          >
            <StatusIcon status={issue.status} size={12} />
            <span className="gb-kidid gb-mono">{issue.identifier}</span>
            <a className="gb-tt gb-cover" href={href} title={issue.title}>
              {issue.title}
            </a>
            {index.waiting.has(issue.id) ? <TocaPill small /> : null}
            {run ? (
              <span className="gb-plive" title={`${run.agentName} está corriendo ahora`}>
                <Icon name="zap" size={12} />
                {run.agentName}
              </span>
            ) : null}
            <span className="gb-pwho">
              <Avatar name={who} size={16} />
              <span>{who ?? "Sin asignar"}</span>
            </span>
            <span className="gb-upd">{relativeTime(issue.updatedAt, now)}</span>
          </div>
        );
      })}
      {rows.length > limit ? (
        <div className="gb-rowmore">
          <button type="button" className="gb-linkbtn" onClick={() => setLimit(limit + TREE_STEP)}>
            Ver {Math.min(TREE_STEP, rows.length - limit)} más · quedan {rows.length - limit}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Ningún pedido calza: ofrece quitar lo que los esconde. */
export function EmptyPedidos({ query, onQuery }: { query: BoardQuery; onQuery: (query: BoardQuery) => void }) {
  const setFilters = (filters: BoardFilters) => onQuery({ ...query, filters });
  const filtered = hasActiveFilters(query.filters);
  return (
    <div className="gb-empty">
      <div className="gb-box">
        <div className="gb-eic">
          <Icon name="search-x" size={18} />
        </div>
        <h3>No hay pedidos {filtered || query.hide.length > 0 ? "con estos filtros" : "abiertos"}</h3>
        <p>Un pedido es una tarea sin tarea padre. Las subtareas se ven al desplegar su pedido.</p>
        <div className="gb-acts">
          {filtered ? (
            <button type="button" className="gb-btn is-sm" onClick={() => setFilters(emptyFilters())}>
              Limpiar filtros
            </button>
          ) : null}
          {query.hide.length > 0 ? (
            <button type="button" className="gb-btn is-sm" onClick={() => onQuery({ ...query, hide: [] })}>
              Mostrar los títulos ocultos
            </button>
          ) : null}
          {query.showClosed ? null : (
            <button type="button" className="gb-btn is-sm" onClick={() => onQuery({ ...query, showClosed: true })}>
              Ver cerrados
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
