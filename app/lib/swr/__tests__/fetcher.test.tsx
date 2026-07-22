import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useApi } from "../fetcher";
import type { ReactNode } from "react";

/** 隔离 SWR 缓存的 wrapper，避免测试间相互污染。 */
function makeWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
    );
  };
}

describe("useApi", () => {
  it("resolves data from the wrapped fetcher", async () => {
    const fetcher = () => Promise.resolve([{ id: 1, name: "茅台" }]);
    const { result } = renderHook(() => useApi(fetcher), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ id: 1, name: "茅台" }]);
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("exposes error when fetcher rejects", async () => {
    const fetcher = () => Promise.reject(new Error("boom"));
    const { result } = renderHook(() => useApi(fetcher), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.data).toBeUndefined();
  });

  it("stays idle when disabled", async () => {
    const fetcher = jest.fn(() => Promise.resolve("should-not-call"));
    const { result } = renderHook(() => useApi(fetcher, { disabled: true }), {
      wrapper: makeWrapper(),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
