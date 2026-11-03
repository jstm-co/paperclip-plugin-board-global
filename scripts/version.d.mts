export interface BuildInfo {
  version: string;
  commit: string;
}

export function datePrefix(date?: Date): string;
export function nextReleaseVersion(publishedVersions: string[], date?: Date): string;
export function developmentVersion(options: { date?: Date; commit: string; dirty?: boolean }): string;
export function getBuildInfo(releaseVersion?: string): BuildInfo;
