import { describe, expect, it } from "vitest";
import { developmentVersion, nextReleaseVersion } from "../scripts/version.mjs";

describe("nextReleaseVersion", () => {
  const novemberThird = new Date("2026-11-03T12:00:00Z");

  it("uses zero for the first release of the UTC day", () => {
    expect(nextReleaseVersion([], novemberThird)).toBe("2026.1103.0");
    expect(nextReleaseVersion(["0.7.0", "2026.1102.4"], novemberThird)).toBe("2026.1103.0");
  });

  it("increments the counter when one or two versions are already published", () => {
    expect(nextReleaseVersion(["2026.1103.0"], novemberThird)).toBe("2026.1103.1");
    expect(nextReleaseVersion(["2026.1103.0", "2026.1103.1"], novemberThird)).toBe("2026.1103.2");
  });

  it("does not zero-pad January dates", () => {
    expect(nextReleaseVersion([], new Date("2027-01-05T12:00:00Z"))).toBe("2027.105.0");
  });

  it("includes the year in the prefix", () => {
    expect(nextReleaseVersion(["2026.1231.0", "2026.1231.1"], new Date("2027-01-01T00:00:00Z"))).toBe("2027.101.0");
  });

  it("uses UTC around midnight, regardless of the local timezone", () => {
    expect(nextReleaseVersion([], new Date("2026-11-03T23:59:59Z"))).toBe("2026.1103.0");
    expect(nextReleaseVersion([], new Date("2026-11-04T00:00:00Z"))).toBe("2026.1104.0");
    expect(nextReleaseVersion([], new Date("2027-01-01T02:30:00+03:00"))).toBe("2026.1231.0");
  });
});

describe("developmentVersion", () => {
  it("uses the daily zero release with dev metadata and the short commit", () => {
    expect(developmentVersion({ date: new Date("2026-11-03T12:00:00Z"), commit: "abc1234" })).toBe(
      "2026.1103.0-dev+abc1234",
    );
  });

  it("marks uncommitted changes as dirty", () => {
    expect(developmentVersion({ date: new Date("2027-01-05T12:00:00Z"), commit: "abc1234", dirty: true })).toBe(
      "2027.105.0-dev+abc1234.dirty",
    );
  });
});
