# Contributing

**English** · [Español](#español)

Thanks for helping. Every change goes through a pull request: nobody pushes to `main`, not even the maintainers.

## How a change gets published

1. **Fork** the repository and create a branch from `main`.
2. **Make the change** and check it locally:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   ```

   A local build injects `YYYY.MDD.0-dev+<sha7>` into the manifest, plus `.dirty` when there are uncommitted changes. It does not modify source files, `package.json` or the lockfile.

3. **Open the pull request** against `main` and fill in the template. Do not bump the version by hand. The CI runs:
   - `test (node 22)` and `test (node 24)`: typecheck, tests, build and package contents.
   - `version`: reports whether the pull request changes the published package and merging will publish a release. It is informational; it does not require a version change.

   The branch has to be up to date with `main` before merging.

4. **A maintainer reviews and merges** with «Squash and merge»: the pull request title becomes the commit message, so make it a short sentence about the change.
5. **GitHub Actions publishes package changes** (`.github/workflows/publish.yml`). It compares `main` with the latest published tag, calculates the next `YYYY.MDD.N` version in UTC (month × 100 + day, without a leading zero), and sets that version only inside the runner with `npm version --no-git-tag-version`. Then it runs the checks, builds, publishes to npm with provenance, and creates the `vYYYY.MDD.N` tag and GitHub release. Documentation, tests, CI and script-only changes do not publish a release. Publishing uses npm trusted publishing, so there is no npm token in the repository.

## Guidelines

- **The interface is in Spanish.** On-screen texts stay in Spanish. Keep `README.md` and `README.es.md` in sync when the behavior changes.
- **No data from your instance:** no real company names, emails, IDs, URLs or screenshots of private data in code, tests or the pull request. Use made-up companies, like the tests do (Betacorp, El Molino, Mignon).
- **Tests:** the logic outside React (`src/board.ts`, `src/dashboard.ts`, `src/views.ts`, the worker) has tests in `tests/`. Add or update them with your change.
- **Do not develop on the instance you use every day:** Paperclip serves the interface from `dist/ui/` of the installed folder, so a build there changes what users see right away. Install from a separate copy.

## Reporting a bug

Open an [issue](https://github.com/jstm-co/paperclip-plugin-board-global/issues) with your Paperclip version, the plugin version (`npx paperclipai plugin list`), what you expected and what happened. Leave out private data.

---

## Español

[English](#contributing) · **Español**

Gracias por ayudar. Todo cambio entra por un pull request: nadie sube directo a `main`, ni siquiera el equipo.

### Cómo se publica un cambio

1. **Haz un fork** del repositorio y crea una rama desde `main`.
2. **Haz el cambio** y revísalo en tu máquina:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   ```

   Un build local inyecta `AAAA.MDD.0-dev+<sha7>` en el manifiesto, con `.dirty` si hay cambios sin commit. No modifica el código fuente, `package.json` ni el lockfile.

3. **Abre el pull request** contra `main` y completa la plantilla. No subas la versión a mano. El CI corre:
   - `test (node 22)` y `test (node 24)`: typecheck, pruebas, build y contenido del paquete.
   - `version`: informa si el PR cambia el paquete publicado y si el merge generará una release. Es solo informativo; no exige cambiar la versión.

   La rama tiene que estar al día con `main` antes del merge.

4. **Alguien del equipo lo revisa y hace merge** con «Squash and merge»: el título del pull request queda como mensaje del commit, así que escríbelo como una frase corta sobre el cambio.
5. **GitHub Actions publica los cambios del paquete** (`.github/workflows/publish.yml`). Compara `main` con el tag de la última versión publicada, calcula la siguiente versión `AAAA.MDD.N` en UTC (mes × 100 + día, sin cero delante) y la escribe solo dentro del runner con `npm version --no-git-tag-version`. Después corre las pruebas, construye, publica en npm con procedencia (provenance) y crea el tag `vAAAA.MDD.N` y su release. Los cambios solo de documentación, pruebas, CI o scripts no publican. Usa publicación confiable de npm (trusted publishing), así que no hay ningún token de npm en el repositorio.

### Pautas

- **La interfaz está en español.** Los textos de pantalla se quedan en español. Mantén `README.md` y `README.es.md` al día si cambia el comportamiento.
- **Nada de tu instancia:** ni nombres reales de empresas, correos, IDs, URLs ni capturas con datos privados en el código, las pruebas o el pull request. Usa empresas inventadas, como las pruebas (Betacorp, El Molino, Mignon).
- **Pruebas:** la lógica fuera de React (`src/board.ts`, `src/dashboard.ts`, `src/views.ts`, el worker) tiene pruebas en `tests/`. Agrégalas o ajústalas con tu cambio.
- **No desarrolles sobre la instancia que usas a diario:** Paperclip sirve la interfaz desde `dist/ui/` de la carpeta instalada, así que un build ahí cambia de inmediato lo que ven los usuarios. Instala desde una copia aparte.

### Reportar un error

Abre un [issue](https://github.com/jstm-co/paperclip-plugin-board-global/issues) con tu versión de Paperclip, la del plugin (`npx paperclipai plugin list`), qué esperabas y qué pasó. Deja fuera los datos privados.
