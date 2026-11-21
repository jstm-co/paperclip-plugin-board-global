// Cómo se abre una tarea desde una tarjeta o una fila (JST-408): el clic normal
// la abre en el modal, sin salir del Board; con Ctrl o ⌘ (y los demás gestos del
// navegador) va la página de la tarea. Fuera de la página del Board no hay
// modal y todo sigue yendo a la página.
import { createContext, useContext, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import type { BoardIssue } from "../shared.js";
import { opensInPlace } from "../task.js";
import { openHref } from "./common.js";

const OpenTaskContext = createContext<((issue: BoardIssue) => void) | null>(null);

export const OpenTaskProvider = OpenTaskContext.Provider;

export function useOpenTask() {
  const open = useContext(OpenTaskContext);
  return useMemo(
    () => ({
      /** `onClick` del enlace de la tarea: conserva su `href` para los gestos del navegador. */
      link: (issue: BoardIssue) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
        if (!open || !opensInPlace(event)) return;
        event.preventDefault();
        open(issue);
      },
      /** Clic en el resto de la fila (los iconos que quedan sobre el enlace). */
      row: (issue: BoardIssue, href: string, event: ReactMouseEvent) => {
        if (open && opensInPlace(event)) open(issue);
        else openHref(href, event);
      },
    }),
    [open],
  );
}
