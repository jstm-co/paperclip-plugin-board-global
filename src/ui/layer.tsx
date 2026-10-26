// Capas flotantes (menús, vista previa, tooltip y toasts). Van en un portal
// sobre `document.body` para que ningún contenedor del host las recorte; el
// envoltorio `.gb-layer` les da los tokens del plugin.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./common.js";

export function Layer({ children }: { children: ReactNode }) {
  return createPortal(<div className="gb-layer">{children}</div>, document.body);
}

/**
 * Popover anclado a un elemento. Se cierra con Esc, con un clic fuera o si el
 * ancla desaparece (p. ej. el chip que lo abrió se quitó).
 */
export function Popover({
  anchor,
  width,
  align = "start",
  className,
  role = "menu",
  label,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  width?: number;
  align?: "start" | "end";
  /** `gb-form` para los formularios (guardar y confirmar borrado). */
  className?: string;
  role?: "menu" | "dialog";
  label?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!anchor.isConnected) {
      onCloseRef.current();
      return;
    }
    const el = ref.current;
    if (!el) return;
    const rect = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    let left = align === "end" ? rect.right - w : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    const top = Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - el.offsetHeight - 8));
    if (!pos || pos.left !== left || pos.top !== top) setPos({ left, top });
  });

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const onResize = () => onCloseRef.current();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [anchor]);

  return (
    <Layer>
      <div
        ref={ref}
        className={cx("gb-menu", className)}
        role={role}
        aria-label={label}
        // Mientras se calcula la posición va transparente (no `visibility: hidden`): así
        // el campo o el botón que toma el foco al abrir (guardar, confirmar) lo recibe.
        style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999, opacity: pos ? 1 : 0 }}
      >
        {children}
      </div>
    </Layer>
  );
}

/** Tooltip que sigue al mouse (segmentos de las barras de «Abiertas por empresa»). */
export function FollowTip({ tip }: { tip: { text: string; x: number; y: number } | null }) {
  if (!tip) return null;
  return (
    <Layer>
      <div className="gb-tip" style={{ left: tip.x + 12, top: tip.y + 14 }}>
        {tip.text}
      </div>
    </Layer>
  );
}

// ---------------------------------------------------------------------------
// Toasts (§3.12): abajo al centro, 5 s, con una acción opcional
// ---------------------------------------------------------------------------

export interface ToastInput {
  content: ReactNode;
  action?: { label: string; run: () => void };
  error?: boolean;
}

interface ToastItem extends ToastInput {
  id: number;
}

const TOAST_MS = 5000;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((toast) => toast.id !== id)), []);
  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );
  return { toasts, show, dismiss };
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <Layer>
      <div className="gb-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={cx("gb-toast", toast.error && "is-error")}>
            <span>{toast.content}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  onDismiss(toast.id);
                  toast.action!.run();
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Layer>
  );
}
