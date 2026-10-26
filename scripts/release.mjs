#!/usr/bin/env node
// Release rules shared by the CI and Publish workflows (see CONTRIBUTING.md).
//
//   node scripts/release.mjs pr <base-sha> <head-sha>
//     Pull request check. A PR that changes the package (anything outside the
//     paths in NO_RELEASE) must bump the version, and the new version must not
//     be on npm yet. Tells whether merging will publish.
//
//   node scripts/release.mjs main
//     Push to main. Prints `publish=true|false` and `version=X.Y.Z` to
//     $GITHUB_OUTPUT. Fails if main got package changes without a new version,
//     so the change does not sit unpublished without anyone noticing.
//
//   node scripts/release.mjs sync [--check]
//     Copies the version in package.json to src/manifest.ts (`npm version`
//     runs it). With --check it only verifies that both match.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

/** Paths that do not change the published plugin: no new version needed. */
const NO_RELEASE = [/^\.github\//, /^tests\//, /^scripts\//, /\.md$/, /^LICENSE$/, /^\.gitignore$/, /^vitest\.config\.ts$/];
const MANIFEST = new URL("../src/manifest.ts", import.meta.url);
const MANIFEST_VERSION = /(\n\s*version:\s*")([^"]+)(")/;
const PLAIN_VERSION = /^\d+\.\d+\.\d+$/;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const pkgAt = (rev) => JSON.parse(rev ? git("show", `${rev}:package.json`) : readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function summary(lines) {
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function output(values) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

function fail(lines) {
  summary(lines);
  console.log(`::error::${lines[0].replace(/^[^\w¿¡]+/, "")}`);
  process.exit(1);
}

function isPublished(name, version) {
  try {
    return execFileSync("npm", ["view", `${name}@${version}`, "version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() !== "";
  } catch {
    return false; // E404: the package or that version does not exist
  }
}

/** a > b for plain x.y.z versions. */
function greater(a, b) {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

const releaseFiles = (from, to) =>
  git("diff", "--name-only", from, to)
    .split("\n")
    .filter((f) => f && !NO_RELEASE.some((re) => re.test(f)));

const list = (files) => files.slice(0, 15).map((f) => `- \`${f}\``).concat(files.length > 15 ? [`- … +${files.length - 15}`] : []);

const BUMP = "`npm version patch --no-git-tag-version` (o `minor` / `major`)";

function checkPr(base, head) {
  if (!base || !head) fail(["Uso: node scripts/release.mjs pr <base-sha> <head-sha>"]);
  const { name, version } = pkgAt(head);
  const baseVersion = pkgAt(base).version;
  const files = releaseFiles(git("merge-base", base, head), head);

  if (version === baseVersion) {
    if (files.length === 0) {
      summary([`✅ Al hacer merge no se publica nada: el PR solo cambia docs, pruebas o CI (versión ${version}).`, "", `Merging does not publish anything: this PR only touches docs, tests or CI.`]);
      return;
    }
    fail([
      `❌ Este PR cambia el plugin y no sube la versión (sigue en ${version}).`,
      "",
      `Corre ${BUMP} y sube el commit. Así, al hacer merge se publica la versión nueva en npm.`,
      "",
      `This PR changes the plugin but keeps version ${version}. Run \`npm version patch --no-git-tag-version\` (or minor / major) and push the commit, so merging publishes the new version to npm.`,
      "",
      ...list(files),
    ]);
  }
  if (!PLAIN_VERSION.test(version)) fail([`❌ La versión ${version} no tiene la forma X.Y.Z. · Version ${version} is not X.Y.Z.`]);
  if (!greater(version, baseVersion)) fail([`❌ La versión ${version} no es mayor que la de main (${baseVersion}). · Version ${version} is not greater than main's ${baseVersion}.`]);
  if (isPublished(name, version)) fail([`❌ ${name}@${version} ya está en npm: usa una versión mayor. · ${name}@${version} is already on npm: use a greater version.`]);
  summary([`🚀 Al hacer merge se publica **${name}@${version}** en npm (antes ${baseVersion}).`, "", `Merging publishes ${name}@${version} to npm.`]);
}

function checkMain() {
  const { name, version } = pkgAt();
  if (!PLAIN_VERSION.test(version)) fail([`❌ La versión ${version} no tiene la forma X.Y.Z. · Version ${version} is not X.Y.Z.`]);
  if (!isPublished(name, version)) {
    output({ publish: "true", version });
    summary([`🚀 Publicando **${name}@${version}** en npm. · Publishing ${name}@${version} to npm.`]);
    return;
  }
  output({ publish: "false", version });
  const before = process.env.BEFORE_SHA ?? "";
  let files = [];
  if (before && !/^0+$/.test(before)) {
    try {
      files = releaseFiles(before, "HEAD");
    } catch {
      files = []; // `before` is not in the clone (force push): nothing to compare
    }
  }
  if (files.length > 0) {
    fail([
      `❌ main tiene cambios del plugin, pero ${version} ya estaba en npm: no se publicó nada.`,
      "",
      `Abre un PR que suba la versión con ${BUMP}.`,
      "",
      `main has plugin changes but ${version} was already on npm, so nothing was published. Open a PR that bumps the version.`,
      "",
      ...list(files),
    ]);
  }
  summary([`✅ ${name}@${version} ya está en npm: nada que publicar. · Already on npm: nothing to publish.`]);
}

function sync(check) {
  const { version } = pkgAt();
  const src = readFileSync(MANIFEST, "utf8");
  const match = src.match(MANIFEST_VERSION);
  if (!match) fail(["❌ No encuentro `version: \"…\"` en src/manifest.ts. · `version` not found in src/manifest.ts."]);
  if (match[2] === version) return console.log(`src/manifest.ts = package.json = ${version}`);
  if (check) fail([`❌ src/manifest.ts dice ${match[2]} y package.json dice ${version}. Corre \`npm run sync-version\`. · src/manifest.ts says ${match[2]} but package.json says ${version}.`]);
  writeFileSync(MANIFEST, src.replace(MANIFEST_VERSION, `$1${version}$3`));
  console.log(`src/manifest.ts → ${version}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "pr") checkPr(args[0], args[1]);
else if (command === "main") checkMain();
else if (command === "sync") sync(args.includes("--check"));
else fail(["Uso: node scripts/release.mjs pr <base> <head> | main | sync [--check]"]);
