"use client";

type RouteError = Error & { digest?: string };

interface ErrorProps {
  error: RouteError;
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fa] px-5 text-[#151a24]">
      <section
        role="alert"
        className="w-full max-w-md rounded-lg border border-[#d8dee8] bg-white p-6 shadow-[0_16px_42px_rgb(20_28_40_/_12%)]"
      >
        <p className="mb-2 text-sm font-semibold text-[#1f7a8c]">
          Mist K-line
        </p>
        <h1 className="mb-3 text-2xl font-bold">无法显示当前页面</h1>
        <p className="mb-5 text-sm leading-6 text-[#5a6472]">
          图表页面加载失败，请重试当前操作。
        </p>
        {error.digest ? (
          <p className="mb-5 rounded-md bg-[#eef7f8] px-3 py-2 text-xs font-semibold text-[#176675]">
            错误编号 {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="h-10 rounded-md bg-[#1f7a8c] px-4 text-sm font-bold text-white hover:bg-[#176675]"
        >
          重试
        </button>
      </section>
    </main>
  );
}
