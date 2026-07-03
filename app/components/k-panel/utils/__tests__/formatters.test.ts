import {
  calculatePriceRange,
  formatKTooltip,
  isKTooltipParams,
} from "../formatters";

describe("k-panel formatters", () => {
  it("returns an empty tooltip for empty params", () => {
    expect(formatKTooltip([], [], [])).toBe("");
  });

  it("returns an empty tooltip for out-of-range data index", () => {
    expect(formatKTooltip([{ dataIndex: 10 }], [], [])).toBe("");
  });

  it("guards tooltip params before formatting", () => {
    expect(isKTooltipParams([{ dataIndex: 0 }])).toBe(true);
    expect(isKTooltipParams([{ value: 0 }])).toBe(false);
  });

  it("returns a zero price range for empty K-line data", () => {
    expect(calculatePriceRange([])).toEqual({ min: 0, max: 0, range: 0 });
  });
});
