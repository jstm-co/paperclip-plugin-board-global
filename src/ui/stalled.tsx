// Bandeja «Paradas» (JST-424): las tareas bloqueadas que nada mueve (sin agente
// en curso, tarjeta ni aprobación). No esperan a la persona, así que ninguna
// tarjeta ni fila lleva marca; se juntan aquí, detrás de un solo botón.
import { useEffect, useRef, type RefObject } from "react";
import { issueHref, relativeTime, stalledCount, type BoardIndex, type StalledGroup, type StalledRow } from "../board.js";
import { t } from "../i18n.js";
import { tx } from "./i18n.js";
import { CompanyTag, assigneeName, cx, plural } from "./common.js";
import { Icon } from "./icons.js";
import { Layer } from "./layer.js";
import { useOpenTask } from "./open.js";

/** Esc cierra la bandeja, salvo que haya un menú o el modal de tarea encima: ese Esc es de ellos. */
export function useStalledEscape(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    // En captura: corre antes que el Esc del modal, que al cerrarse ya no estaría en el DOM.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".gb-layer .gb-menu, .gb-layer .gb-taskback")) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);
}

/** El botón «⏸ N paradas» de la barra de filtros. */
export function StalledButton({
  count,
  open,
  buttonRef,
  onToggle,
}: {
  count: number;
  open: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={cx("gb-btn", "gb-stallbtn", open && "is-on")}
      aria-expanded={open}
      aria-controls="gb-stalled"
      title={t("Tareas bloqueadas que nadie mueve. No esperan tu respuesta.")}
      onClick={onToggle}
    >
      <Icon name="circle-pause" size={14} />
      <b className="gb-tnum">{count}</b> {count === 1 ? t("parada") : t("paradas")}
    </button>
  );
}

function StalledItem({ index, row, now }: { index: BoardIndex; row: StalledRow; now: number }) {
  const open = useOpenTask();
  const { issue, blockedTaskCount, waitsOn } = row;
  const line = [
    assigneeName(index, issue) ?? t("Sin asignar"),
    t("sin movimiento {time}", { time: relativeTime(issue.updatedAt, now) }),
    ...(waitsOn ? [t("espera {id}", { id: waitsOn.identifier ?? waitsOn.id })] : []),
  ].join(" · ");
  return (
    <a className="gb-dritem" href={issueHref(index, issue)} onClick={open.link(issue)}>
      <span className="gb-mono gb-dri-id">{issue.identifier}</span>
      <span className="gb-dri-t">{issue.title}</span>
      <span className="gb-dri-n">
        {blockedTaskCount > 0 ? tx("bloquea {n}", { n: <b className="gb-tnum">{blockedTaskCount}</b> }) : t("no bloquea")}
      </span>
      <span className="gb-dri-l" title={line}>
        {line}
      </span>
    </a>
  );
}

export function StalledDrawer({
  index,
  groups,
  now,
  onClose,
}: {
  index: BoardIndex;
  groups: readonly StalledGroup[];
  now: number;
  onClose: () => void;
}) {
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headRef.current?.focus(), []);
  const total = stalledCount(groups);
  return (
    <Layer>
      <aside id="gb-stalled" className="gb-drawer" role="dialog" aria-modal="false" aria-labelledby="gb-stalled-h">
        <div className="gb-drhead">
          <Icon name="circle-pause" size={18} />
          <div>
            <h2 id="gb-stalled-h" ref={headRef} tabIndex={-1}>
              {total === 0 ? t("Paradas") : total === 1 ? t("1 parada · nadie la mueve") : t("{n} paradas · nadie las mueve", { n: total })}
            </h2>
            <p>{t("Bloqueadas sin agente en curso, tarjeta ni aprobación. No esperan tu respuesta.")}</p>
          </div>
          <button type="button" className="gb-drclose" aria-label={t("Cerrar")} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="gb-drbody" aria-label={t("Tareas paradas")}>
          {total === 0 ? (
            <div className="gb-drempty">
              <Icon name="circle-check" size={16} />
              <b>{t("No hay tareas paradas")}</b>
              <span>{t("Todas las bloqueadas tienen a alguien o algo que las mueve.")}</span>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.company.id}>
                <div className="gb-drgh">
                  <CompanyTag company={group.company} solid />
                  <span>{group.company.name}</span>
                  <span className="gb-drgn">{plural(group.rows.length, "parada", "paradas")}</span>
                </div>
                {group.rows.map((row) => (
                  <StalledItem key={row.issue.id} index={index} row={row} now={now} />
                ))}
              </section>
            ))
          )}
        </div>
        {total > 0 ? (
          <div className="gb-drfoot">
            <Icon name="info" size={14} />
            <span>{t("Ordenadas por cuántas tareas frenan. Ábrelas para reasignarlas, reactivar lo que esperan o cancelarlas.")}</span>
          </div>
        ) : null}
      </aside>
    </Layer>
  );
}
