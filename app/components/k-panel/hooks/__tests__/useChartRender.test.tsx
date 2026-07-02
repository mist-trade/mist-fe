import { act, render } from "@testing-library/react";
import * as echarts from "echarts/core";
import { useChartRender } from "../useChartRender";

jest.mock("echarts/core", () => ({
  init: jest.fn(),
}));

const resize = jest.fn();
const dispose = jest.fn();
const disconnect = jest.fn();
const observe = jest.fn();
let observerCallback: ResizeObserverCallback | undefined;

class MockResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observerCallback = callback;
  }

  observe = observe;
  unobserve = jest.fn();
  disconnect = disconnect;
}

function ChartProbe() {
  const containerRef = useChartRender({
    isEnabled: true,
    setOption: jest.fn(),
  });

  return <div data-testid="chart" ref={containerRef} />;
}

describe("useChartRender", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    observerCallback = undefined;
    global.ResizeObserver = MockResizeObserver;
    (echarts.init as jest.Mock).mockReturnValue({ resize, dispose });
  });

  it("resizes the chart when its container resize observer fires", () => {
    render(<ChartProbe />);

    expect(observe).toHaveBeenCalled();
    expect(observerCallback).toBeDefined();

    act(() => {
      observerCallback?.([], {} as ResizeObserver);
    });

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("disconnects the observer and disposes the chart on unmount", () => {
    const { unmount } = render(<ChartProbe />);

    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
