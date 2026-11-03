#!/usr/bin/env node
// Release rules shared by CI and Publish (see CONTRIBUTING.md).
//
//   node scripts/release.mjs pr <base-sha> <head-sha>
//     Reports whether merging the pull request will publish a package.
//
//   node scripts/release.mjs main
//     Compares main with the latest published tag. When the package changed,
//     prints `publish=true` and the next UTC date version to $GITHUB_OUTPUT.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { nextReleaseVersion } from "./version.mjs";

/** Paths that do not change the published plugin. */
const NO_RELEASE = [/^\.github\//, /^tests\//, /^scripts\//, /\.md$/, /^LICENSE$/, /^\.gitignore$/, /^vitest\.config\.ts$/];

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const pkg = () => JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

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

function npmView(...args) {
  return execFileSync("npm", ["view", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function publishedVersions(name) {
  const versions = JSON.parse(npmView(name, "versions", "--json"));
  return Array.isArray(versions) ? versions : [versions];
}

const releaseFiles = (from, to) =>
  git("diff", "--name-only", from, to)
    .split("\n")
    .filter((file) => file && !NO_RELEASE.some((re) => re.test(file)));

const list = (files) => files.slice(0, 15).map((file) => `- \`${file}\``).concat(files.length > 15 ? [`- … +${files.length - 15}`] : []);

function checkPr(base, head) {
  if (!base || !head) fail(["Usage: node scripts/release.mjs pr <base-sha> <head-sha>"]);
  const files = releaseFiles(git("merge-base", base, head), head);
  if (files.length === 0) {
    summary(["No package changes: merging will not publish a new version."]);
    return;
  }
  summary([
    "Package changes detected. Merging will publish the next `YYYY.MDD.N` version automatically; no version bump is needed in this PR.",
    "",
    ...list(files),
  ]);
}

function checkMain() {
  const { name } = pkg();
  const baseVersion = npmView(name, "version");
  const baseTag = `v${baseVersion}`;
  try {
    git("rev-parse", "--verify", `${baseTag}^{commit}`);
  } catch {
    fail([`Latest npm version ${name}@${baseVersion} has no ${baseTag} tag in this checkout.`]);
  }

  const files = releaseFiles(baseTag, "HEAD");
  if (files.length === 0) {
    output({ publish: "false", version: baseVersion });
    summary([`No package changes since ${name}@${baseVersion}: nothing to publish.`]);
    return;
  }

  const version = nextReleaseVersion(publishedVersions(name));
  output({ publish: "true", version });
  summary([`Publishing ${name}@${version} (previous: ${baseVersion}).`, "", ...list(files)]);
}

const [command, ...args] = process.argv.slice(2);
if (command === "pr") checkPr(args[0], args[1]);
else if (command === "main") checkMain();
else fail(["Usage: node scripts/release.mjs pr <base> <head> | main"]);
