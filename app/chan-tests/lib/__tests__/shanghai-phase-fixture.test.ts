import { BiStatus } from "@/app/api/types";
import { readSnapshot } from "../load-snapshot";

it("keeps the full Shanghai Phase A and Phase B regression", () => {
  const snapshot = readSnapshot("shanghai-index-2024-2025");

  expect(snapshot?.meta.stats.phaseABiCount).toBe(35);
  expect(snapshot?.meta.stats.phaseBBiCount).toBe(25);
  expect(snapshot?.bi.phaseA).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        startTime: "2024-10-07T16:00:00.000Z",
        endTime: "2024-10-15T16:00:00.000Z",
        trend: "down",
        status: BiStatus.Invalid,
      }),
    ]),
  );
  expect(snapshot?.bi.phaseB).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        startTime: "2024-10-07T16:00:00.000Z",
        endTime: "2025-01-12T16:00:00.000Z",
        trend: "down",
        status: BiStatus.Valid,
      }),
      expect.objectContaining({
        startTime: "2025-05-26T16:00:00.000Z",
        endTime: "2025-08-25T16:00:00.000Z",
        trend: "up",
        status: BiStatus.Valid,
      }),
    ]),
  );
});
