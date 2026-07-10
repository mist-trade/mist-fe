import { normalizeSnapshotBiData } from "../load-snapshot";

describe("normalizeSnapshotBiData", () => {
  it("uses a legacy array for both phases", () => {
    const legacy = [{ startTime: "2024-10-07T16:00:00.000Z" }];

    expect(normalizeSnapshotBiData(legacy)).toEqual({
      phaseA: legacy,
      phaseB: legacy,
    });
  });

  it("preserves canonical phase arrays", () => {
    expect(normalizeSnapshotBiData({ phaseA: ["a"], phaseB: ["b"] })).toEqual({
      phaseA: ["a"],
      phaseB: ["b"],
    });
  });

  it("rejects a partial canonical object", () => {
    expect(() => normalizeSnapshotBiData({ phaseA: [] })).toThrow(
      "bi.json 必须是数组，或包含 phaseA 和 phaseB 数组的对象"
    );
  });
});
