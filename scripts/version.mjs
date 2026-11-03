import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function datePrefix(date = new Date()) {
  const monthDay = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  return `${date.getUTCFullYear()}.${monthDay}`;
}

export function nextReleaseVersion(publishedVersions, date = new Date()) {
  const prefix = datePrefix(date);
  let last = -1;
  for (const version of publishedVersions) {
    const match = /^(\d{4})\.(\d{3,4})\.(\d+)$/.exec(version);
    if (!match || `${match[1]}.${Number(match[2])}` !== prefix) continue;
    last = Math.max(last, Number(match[3]));
  }
  return `${prefix}.${last + 1}`;
}

export function developmentVersion({ date = new Date(), commit, dirty = false }) {
  return `${datePrefix(date)}.0-dev+${commit}${dirty ? ".dirty" : ""}`;
}

export function getBuildInfo(releaseVersion = process.env.BOARD_GLOBAL_RELEASE_VERSION) {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const commit = git("rev-parse", "HEAD").slice(0, 7);
  if (releaseVersion) {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    if (pkg.version !== releaseVersion) {
      throw new Error(`Release version ${releaseVersion} does not match package.json (${pkg.version})`);
    }
    return { version: releaseVersion, commit };
  }
  const dirty = git("status", "--porcelain").length > 0;
  return { version: developmentVersion({ commit, dirty }), commit };
}
