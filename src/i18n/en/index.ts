// Catálogo en inglés: «texto en español del código → traducción». Va en partes
// por zona de la interfaz. Para sumar un idioma: copiar esta carpeta, traducir
// los valores y registrarlo en `LOCALES` y `CATALOGS` de `src/i18n.ts`.
import { board } from "./board.js";
import { core } from "./core.js";
import { create } from "./create.js";
import { dashboard } from "./dashboard.js";
import { filters } from "./filters.js";
import { logic } from "./logic.js";

/** Las partes, por separado: la prueba del catálogo revisa que no se contradigan. */
export const EN_PARTS: Readonly<Record<string, Readonly<Record<string, string>>>> = { core, logic, board, filters, create, dashboard };

export const en: Readonly<Record<string, string>> = Object.assign({}, ...Object.values(EN_PARTS));
