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

3. **Bump the version** if the change touches the plugin, that is, anything other than docs (`*.md`), tests (`tests/`), CI (`.github/`), `scripts/`, `LICENSE`, `.gitignore` or `vitest.config.ts`:

   ```bash
   npm version patch --no-git-tag-version   # fixes
   npm version minor --no-git-tag-version   # new features
   npm version major --no-git-tag-version   # breaking changes
   ```

   This updates `package.json`, `package-lock.json` and the version in `src/manifest.ts`. Commit the three files with your change. A change that adds a capability to the manifest is at least `minor`: Paperclip's `upgrade` rejects it and users have to uninstall (without `--force`) and install again. Say so in the pull request.

4. **Open the pull request** against `main` and fill in the template. The CI runs:
   - `test (node 22)` and `test (node 24)`: typecheck, tests, build and package contents.
   - `version`: checks the version bump and tells you what merging will do: publish `X.Y.Z` to npm, or publish nothing (docs, tests or CI only).

   The branch has to be up to date with `main` before merging. If another pull request published your version first, bump it again.

5. **A maintainer reviews and merges** with «Squash and merge»: the pull request title becomes the commit message, so make it a short sentence about the change.
6. **GitHub Actions publishes it** (`.github/workflows/publish.yml`): it runs the checks again, publishes the new version to npm with provenance, and creates the `vX.Y.Z` tag and its GitHub release. It uses npm trusted publishing, so there is no npm token in the repository.

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

3. **Sube la versión** si el cambio toca el plugin, es decir, cualquier cosa que no sea documentación (`*.md`), pruebas (`tests/`), CI (`.github/`), `scripts/`, `LICENSE`, `.gitignore` o `vitest.config.ts`:

   ```bash
   npm version patch --no-git-tag-version   # arreglos
   npm version minor --no-git-tag-version   # funciones nuevas
   npm version major --no-git-tag-version   # cambios incompatibles
   ```

   Eso actualiza `package.json`, `package-lock.json` y la versión de `src/manifest.ts`. Sube los tres archivos junto con tu cambio. Un cambio que agrega una capacidad al manifiesto es al menos `minor`: el `upgrade` de Paperclip lo rechaza y hay que desinstalar (sin `--force`) y volver a instalar. Avísalo en el pull request.

4. **Abre el pull request** contra `main` y completa la plantilla. El CI corre:
   - `test (node 22)` y `test (node 24)`: typecheck, pruebas, build y contenido del paquete.
   - `version`: revisa la subida de versión y te dice qué hará el merge: publicar `X.Y.Z` en npm, o no publicar nada (solo documentación, pruebas o CI).

   La rama tiene que estar al día con `main` antes del merge. Si otro pull request publicó tu versión antes, súbela de nuevo.

5. **Alguien del equipo lo revisa y hace merge** con «Squash and merge»: el título del pull request queda como mensaje del commit, así que escríbelo como una frase corta sobre el cambio.
6. **GitHub Actions lo publica** (`.github/workflows/publish.yml`): vuelve a correr las pruebas, publica la versión nueva en npm con procedencia (provenance) y crea el tag `vX.Y.Z` y su release en GitHub. Usa la publicación confiable de npm (trusted publishing), así que no hay ningún token de npm en el repositorio.

### Pautas

- **La interfaz está en español.** Los textos de pantalla se quedan en español. Mantén `README.md` y `README.es.md` al día si cambia el comportamiento.
- **Nada de tu instancia:** ni nombres reales de empresas, correos, IDs, URLs ni capturas con datos privados en el código, las pruebas o el pull request. Usa empresas inventadas, como las pruebas (Betacorp, El Molino, Mignon).
- **Pruebas:** la lógica fuera de React (`src/board.ts`, `src/dashboard.ts`, `src/views.ts`, el worker) tiene pruebas en `tests/`. Agrégalas o ajústalas con tu cambio.
- **No desarrolles sobre la instancia que usas a diario:** Paperclip sirve la interfaz desde `dist/ui/` de la carpeta instalada, así que un build ahí cambia de inmediato lo que ven los usuarios. Instala desde una copia aparte.

### Reportar un error

Abre un [issue](https://github.com/jstm-co/paperclip-plugin-board-global/issues) con tu versión de Paperclip, la del plugin (`npx paperclipai plugin list`), qué esperabas y qué pasó. Deja fuera los datos privados.
