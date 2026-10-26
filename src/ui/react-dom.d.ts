// El host provee `react-dom` en tiempo de ejecución (el bundler lo deja como
// externo). Solo se usa `createPortal`; esta declaración evita sumar
// `@types/react-dom` como dependencia.
declare module "react-dom" {
  import type { ReactNode, ReactPortal } from "react";
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null): ReactPortal;
}
