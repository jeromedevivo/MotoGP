import { describe, expect, it } from "vitest";
import {
  RANKINGS,
  constructorColor,
  formatPercent,
  gridRows,
  ordinal,
  plateColors,
  scenarioFromWeight,
} from "./insights";

describe("constructorColor", () => {
  it("gives every constructor one fixed colour whatever the casing", () => {
    expect(constructorColor("Ducati")).toBe(constructorColor("DUCATI"));
    expect(constructorColor("Ducati")).not.toBe(constructorColor("Yamaha"));
  });

  it("falls back to a neutral colour", () => {
    expect(constructorColor(undefined)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(constructorColor("Unknown Works")).toBe(constructorColor(undefined));
  });
});

describe("plateColors", () => {
  it("uses the team livery when the API gives one", () => {
    expect(plateColors({ color: "#0c368c", text_color: "#ffffff" }, "Yamaha")).toEqual({ bg: "#0c368c", fg: "#ffffff" });
  });

  it("derives a readable plate from the constructor otherwise", () => {
    const plate = plateColors(undefined, "Ducati");
    expect(plate.bg).toBe(constructorColor("Ducati"));
    expect(["#ffffff", "#111111"]).toContain(plate.fg);
  });
});

describe("formatPercent", () => {
  it("formats in French with one decimal", () => {
    expect(formatPercent(0.3123)).toBe("31,2 %");
  });

  it("flags tiny probabilities instead of showing zero", () => {
    expect(formatPercent(0.0004)).toBe("<0,1 %");
  });
});

describe("gridRows", () => {
  it("splits a classification into rows of three like a MotoGP grid", () => {
    expect(gridRows([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
});

describe("ordinal", () => {
  it("writes French ordinals", () => {
    expect(ordinal(1)).toBe("1er");
    expect(ordinal(3)).toBe("3e");
  });
});

describe("scenarioFromWeight", () => {
  it("maps rain weight to a scenario", () => {
    expect(scenarioFromWeight(0.1)).toBe("dry");
    expect(scenarioFromWeight(0.5)).toBe("mixed");
    expect(scenarioFromWeight(0.8)).toBe("wet");
  });
});

describe("RANKINGS", () => {
  it("describes every ranking the backend returns", () => {
    const keys = ["wet", "dry", "hot", "cold", "bike", "qualifying", "positions", "consistency", "reliability",
      "sprint", "momentum", "home", "fast", "technical", "left", "right"];
    for (const key of keys) {
      expect(RANKINGS[key], key).toBeDefined();
      expect(RANKINGS[key].label.length).toBeGreaterThan(2);
    }
    expect(RANKINGS.reliability.higherIsBetter).toBe(false);
    expect(RANKINGS.consistency.higherIsBetter).toBe(false);
  });
});
