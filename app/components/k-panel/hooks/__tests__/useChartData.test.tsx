import { act, render, screen } from "@testing-library/react";
import { useChartData } from "../useChartData";
import { BiStatus, BiType, TrendDirection } from "@/app/api/types";
import type { IFetchBi, IFetchK, IMergeK } from "@/app/api/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

const k: IFetchK[] = [
  {
    id: 1,
    symbol: "000001",
    time: "2026-01-01",
    amount: 1,
    open: 1,
    close: 2,
    highest: 3,
    lowest: 1,
  },
  {
    id: 2,
    symbol: "000001",
    time: "2026-01-02",
    amount: 1,
    open: 2,
    close: 3,
    highest: 4,
    lowest: 2,
  },
];

const bi: IFetchBi[] = [
  {
    startTime: "2026-01-01",
    endTime: "2026-01-02",
    highest: 4,
    lowest: 1,
    trend: TrendDirection.Up,
    type: BiType.Complete,
    status: BiStatus.Valid,
    independentCount: 2,
    originIds: [1, 2],
    originData: k,
    startFenxing: null,
    endFenxing: null,
  },
];

const emptyFenxing = Promise.resolve([]);
const emptyChannel = Promise.resolve([]);

function Probe(props: {
  mergeK: Promise<IMergeK[]>;
  bi: Promise<IFetchBi[]>;
}) {
  const result = useChartData(
    k,
    props.mergeK,
    props.bi,
    emptyFenxing,
    emptyChannel
  );
  return <div data-testid="bi-count">{result.data?.biData.length ?? "none"}</div>;
}

describe("useChartData", () => {
  it("ignores stale promise inputs after newer data resolves", async () => {
    const oldMergeK = deferred<IMergeK[]>();
    const oldBi = deferred<IFetchBi[]>();
    const newMergeK = deferred<IMergeK[]>();
    const newBi = deferred<IFetchBi[]>();

    const { rerender } = render(
      <Probe mergeK={oldMergeK.promise} bi={oldBi.promise} />
    );
    rerender(<Probe mergeK={newMergeK.promise} bi={newBi.promise} />);

    await act(async () => {
      newMergeK.resolve([]);
      newBi.resolve([]);
      await Promise.resolve();
    });
    expect(screen.getByTestId("bi-count")).toHaveTextContent("0");

    await act(async () => {
      oldMergeK.resolve([]);
      oldBi.resolve(bi);
      await Promise.resolve();
    });

    expect(screen.getByTestId("bi-count")).toHaveTextContent("0");
  });
});
