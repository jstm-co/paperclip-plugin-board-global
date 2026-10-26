// Piezas visuales compartidas (design-spec §3 y §6): etiquetas de empresa,
// iconos de estado y prioridad, avatar, «Te toca» y barra de avance.
import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type KeyboardEvent } from "react";
import { assigneeKey, assigneeLabel, type BoardCompany, type BoardIndex } from "../board.js";
import type { BoardIssue, IssuePriority, IssueStatus } from "../shared.js";
import { Icon, type IconName } from "./icons.js";

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Por hacer",
  in_progress: "En curso",
  in_review: "En revisión",
  blocked: "Bloqueada",
  done: "Hecha",
  cancelled: "Cancelada",
};

export const STATUS_ICONS: Record<IssueStatus, IconName> = {
  backlog: "circle-dashed",
  todo: "circle",
  in_progress: "rotate-cw",
  in_review: "circle-dot",
  blocked: "circle-minus",
  done: "circle-check",
  cancelled: "ban",
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const PRIORITY_ICONS: Record<IssuePriority, IconName> = {
  critical: "triangle-alert",
  high: "arrow-up",
  medium: "minus",
  low: "arrow-down",
};

export const LABELS = { status: STATUS_LABELS, priority: PRIORITY_LABELS };

export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// ---------------------------------------------------------------------------
// Empresa: prefijo + color (nunca solo color)
// ---------------------------------------------------------------------------

/** Clase de color de la empresa: paleta fija por prefijo, o `brandColor` en línea. */
export function companyClass(company: BoardCompany | undefined): string {
  if (!company) return "gb-co-none";
  if (company.brandColor) return "";
  return company.paletteKey ? `gb-co-${company.paletteKey}` : "gb-co-none";
}

function readableOn(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "#ffffff";
  const n = parseInt(match[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0a0a0a" : "#ffffff";
}

export function companyStyle(company: BoardCompany | undefined): CSSProperties | undefined {
  if (!company?.brandColor) return undefined;
  return { "--cc": company.brandColor, "--cfg": company.brandColor, "--con": readableOn(company.brandColor) } as CSSProperties;
}

export function CompanyTag({ company, solid = false, large = false }: { company: BoardCompany | undefined; solid?: boolean; large?: boolean }) {
  return (
    <span
      className={cx("gb-cotag", companyClass(company), solid && "is-solid", large && "is-lg")}
      style={companyStyle(company)}
      title={company?.name}
    >
      {company?.prefix ?? "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estado y prioridad
// ---------------------------------------------------------------------------

export function StatusIcon({ status, size = 14 }: { status: IssueStatus; size?: 12 | 14 | 16 }) {
  return (
    <span className="gb-st gb-ic" style={{ "--stc": `var(--gb-st-${status})` } as CSSProperties} title={STATUS_LABELS[status]}>
      <Icon name={STATUS_ICONS[status]} size={size} />
    </span>
  );
}

export function PriorityIcon({ priority, size = 14, muted = false }: { priority: IssuePriority; size?: 12 | 14 | 16; muted?: boolean }) {
  return (
    <span
      className="gb-pr gb-ic"
      style={{ "--prc": muted ? "var(--gb-subtle-fg)" : `var(--gb-pr-${priority})` } as CSSProperties}
      title={`Prioridad ${PRIORITY_LABELS[priority].toLowerCase()}`}
    >
      <Icon name={PRIORITY_ICONS[priority]} size={size} />
    </span>
  );
}

/** Crítica y Alta llevan pastilla con texto; Media y Baja, solo el icono atenuado (§3.7). */
export function PriorityBadge({ priority, inline = false }: { priority: IssuePriority; inline?: boolean }) {
  if (priority === "critical" || priority === "high") {
    const style = { "--prc": `var(--gb-pr-${priority})`, "--prt": `var(--gb-pr-${priority}-text)` } as CSSProperties;
    return (
      <span className="gb-prio" style={style}>
        <Icon name={PRIORITY_ICONS[priority]} size={12} />
        {PRIORITY_LABELS[priority]}
      </span>
    );
  }
  if (inline) {
    return (
      <>
        <PriorityIcon priority={priority} muted />
        <span>{PRIORITY_LABELS[priority]}</span>
      </>
    );
  }
  return (
    <span className="gb-prio-ic">
      <PriorityIcon priority={priority} muted />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Responsable
// ---------------------------------------------------------------------------

export function initials(name: string): string {
  const words = name
    .replace(/[/.()]/g, " ")
    .split(/\s+/)
    // Sin palabras vacías ni sueltas como «-» («Ceo - cto» → CC).
    .filter((word) => /[\p{L}\p{N}]/u.test(word) && !/^(de|del|y|a|la|el)$/i.test(word));
  const first = words[0] ?? "?";
  return (first[0]! + (words[1] ? words[1][0]! : (first[1] ?? ""))).toUpperCase();
}

export function assigneeName(index: BoardIndex, issue: BoardIssue): string | null {
  const key = assigneeKey(issue);
  return key === "none" ? null : assigneeLabel(index, key);
}

export function Avatar({ name, size = 20 }: { name: string | null; size?: number }) {
  if (!name) {
    return <span className="gb-avatar is-none" style={{ width: size, height: size }} title="Sin asignar" />;
  }
  return (
    <span className="gb-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }} title={name}>
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// «Te toca», árbol y esqueleto
// ---------------------------------------------------------------------------

/** Pastilla invertida, como el contador del Inbox de Paperclip. Siempre icono + texto, salvo la versión icono. */
export function TocaPill({ label = "Te toca", small = false, iconOnly = false }: { label?: string; small?: boolean; iconOnly?: boolean }) {
  return (
    <span className={cx("gb-toca", small && "is-sm", iconOnly && "is-icon")} title={iconOnly ? "Te toca responder" : undefined}>
      <Icon name="reply" size={12} />
      {iconOnly ? <span className="gb-sr">Te toca responder</span> : label}
    </span>
  );
}

export function ProgressBar({ done, total, width = 48 }: { done: number; total: number; width?: number }) {
  if (total === 0) return null;
  return (
    <span className="gb-prog" style={{ width }} title={`${done} de ${total} hechas`}>
      <i style={{ width: `${Math.round((100 * done) / total)}%` }} />
    </span>
  );
}

export function Skeleton({ width, height, style }: { width: number | string; height: number; style?: CSSProperties }) {
  return <span className="gb-sk" style={{ width, height, ...style }} />;
}

// ---------------------------------------------------------------------------
// Navegación y tiempo
// ---------------------------------------------------------------------------

/**
 * Abre la tarea con un `href` normal (§5): la navegación del host antepone la
 * empresa activa y rompe los enlaces a otras empresas. Ctrl/⌘ abre otra pestaña.
 */
export function openHref(href: string, event?: ReactMouseEvent | KeyboardEvent): void {
  if (event && (event.metaKey || event.ctrlKey)) {
    window.open(href, "_blank", "noopener");
    return;
  }
  window.location.assign(href);
}

/** Clic que no viene de un botón, enlace o campo dentro de la tarjeta o fila. */
export function isOwnClick(event: ReactMouseEvent): boolean {
  const target = event.target as HTMLElement;
  const interactive = target.closest("button, a, input, label");
  return !interactive || interactive === event.currentTarget;
}

/** Hora actual que se refresca sola, para los «hace N min». */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
