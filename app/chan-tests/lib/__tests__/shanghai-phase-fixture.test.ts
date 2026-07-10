import { BiStatus } from "@/app/api/types";
import { readSnapshot } from "../load-snapshot";

it("keeps the leading invalid Phase A Bi and long valid Phase B Bi", () => {
  const snapshot = readSnapshot("shanghai-index-2024-2025");

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
    ]),
  );
});
