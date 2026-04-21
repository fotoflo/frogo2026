import { describe, expect, it } from "vitest";
import {
  buildChannelPath,
  descendantIds,
  findChannelByPath,
  getAncestors,
  getSiblingsAt,
  hasChildren,
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
  it("builds /a/b", () => {
    expect(watchHref(channels[1], channels)).toBe("/business/startups");
  });
});

describe("getSiblingsAt", () => {
  it("returns root-level channels for null scope", () => {
    expect(getSiblingsAt(null, channels).map((c) => c.id)).toEqual(["b", "t"]);
  });

  it("returns children of a folder", () => {
    expect(getSiblingsAt("b", channels).map((c) => c.id)).toEqual(["s"]);
  });

  it("distinguishes same-slug siblings under different parents", () => {
    expect(getSiblingsAt("t", channels).map((c) => c.id)).toEqual(["ts"]);
  });

  it("returns empty array for leaf scope", () => {
    expect(getSiblingsAt("sd", channels)).toEqual([]);
  });
});

describe("getAncestors", () => {
  it("returns empty for null scope", () => {
    expect(getAncestors(null, channels)).toEqual([]);
  });

  it("returns single ancestor for root folder", () => {
    expect(getAncestors("b", channels).map((c) => c.id)).toEqual(["b"]);
  });

  it("returns root→leaf chain for nested scope", () => {
    expect(getAncestors("sd", channels).map((c) => c.id)).toEqual([
      "b",
      "s",
      "sd",
    ]);
  });

  it("returns empty for unknown scope id", () => {
    expect(getAncestors("nope", channels)).toEqual([]);
  });
});

describe("hasChildren", () => {
  it("true for folder channel", () => {
    expect(hasChildren("b", channels)).toBe(true);
    expect(hasChildren("s", channels)).toBe(true);
  });

  it("false for leaf channel", () => {
    expect(hasChildren("sd", channels)).toBe(false);
    expect(hasChildren("ts", channels)).toBe(false);
  });
});
