import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { DASHBOARD_ROUTE, PAGE_ROUTE } from "./shared.js";

const manifest: PaperclipPluginManifestV1 = {
  id: "jstm.board-global",
  apiVersion: 1,
  version: "0.6.2",
  displayName: "Board global",
  description: "Tareas y Dashboard de todas las empresas de la instancia en una sola vista (kanban, lista y comparativa).",
  author: "JSTM",
  categories: ["ui"],
  // Las tareas, solo lectura. El cambio de estado y los nombres de proyectos y
  // agentes los resuelve la UI con la API nativa (sesión del usuario): así el
  // plugin no necesita `issues.update`, `projects.read` ni `agents.read`.
  // `plugin.state.*` guarda las vistas guardadas, compartidas en la instancia
  // (Fase 2, JST-21). Agregar capacidades obliga a desinstalar y reinstalar
  // (el upgrade lo rechaza).
  capabilities: [
    "companies.read",
    "issues.read",
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
    "ui.sidebar.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "page",
        id: "board-global-page",
        displayName: "Board global",
        exportName: "BoardGlobalPage",
        routePath: PAGE_ROUTE,
      },
      {
        type: "sidebar",
        id: "board-global-sidebar",
        displayName: "Board global",
        exportName: "BoardGlobalSidebarLink",
      },
      {
        type: "page",
        id: "dashboard-global-page",
        displayName: "Dashboard global",
        exportName: "DashboardGlobalPage",
        routePath: DASHBOARD_ROUTE,
      },
      {
        type: "sidebar",
        id: "dashboard-global-sidebar",
        displayName: "Dashboard global",
        exportName: "DashboardGlobalSidebarLink",
      },
    ],
  },
};

export default manifest;
