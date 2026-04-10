import { describe, expect, it } from "vitest";
import {
  buildChannelPath,
  descendantIds,
  findChannelByPath,
  watchHref,
} from "./channel-paths";

const channels = [
  { id: "b", slug: "business", parent_id: null },
  { id: "s", slug: "startups", parent_id: "b" },
  { id: "t", slug: "tech", parent_id: null },
  { id: "ts", slug: "startups", parent_id: "t" }, // sibling collision
  { id: "sd", slug: "deep", parent_id: "s" },
];

describe("buildChannelPath", () => {
  it("builds root channel path", () => {
    expect(buildChannelPath(channels[0], channels)).toEqual(["business"]);
  });

  it("builds nested path", () => {
    expect(buildChannelPath(channels[1], channels)).toEqual([
      "business",
      "startups",
    ]);
  });

  it("builds 3-deep path", () => {
    expect(buildChannelPath(channels[4], channels)).toEqual([
      "business",
      "startups",
      "deep",
    ]);
  });

  it("handles cycle by stopping", () => {
    const cyclic = [
      { id: "a", slug: "a", parent_id: "b" },
      { id: "b", slug: "b", parent_id: "a" },
    ];
    const result = buildChannelPath(cyclic[0], cyclic);
    expect(result.length).toBeLessThanOrEqual(32);
  });
});

describe("findChannelByPath", () => {
  it("resolves root", () => {
    expect(findChannelByPath(["business"], channels)?.id).toBe("b");
  });

  it("resolves nested", () => {
    expect(findChannelByPath(["business", "startups"], channels)?.id).toBe("s");
  });

  it("distinguishes sibling slug collisions", () => {
    expect(findChannelByPath(["business", "startups"], channels)?.id).toBe("s");
    expect(findChannelByPath(["tech", "startups"], channels)?.id).toBe("ts");
  });

  it("returns null for invalid path", () => {
    expect(findChannelByPath(["business", "tech"], channels)).toBeNull();
  });

  it("returns null for empty segments", () => {
    expect(findChannelByPath([], channels)).toBeNull();
  });
});

describe("descendantIds", () => {
  it("includes self", () => {
    expect(descendantIds("sd", channels)).toEqual(new Set(["sd"]));
  });

  it("collects grandchildren", () => {
    expect(descendantIds("b", channels)).toEqual(new Set(["b", "s", "sd"]));
  });
});

describe("watchHref", () => {
  it("builds /watch/a/b", () => {
    expect(watchHref(channels[1], channels)).toBe("/watch/business/startups");
  });
});
