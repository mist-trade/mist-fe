"use client";

type RouteError = Error & { digest?: string };

interface ErrorProps {
  error: RouteError;
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-base)] px-5 text-[var(--text-primary)]">
      <section
        role="alert"
        className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-[0_16px_42px_rgb(20_28_40_/_12%)]"
      >
        <p className="mb-2 text-sm font-semibold text-[var(--brand)]">
          Mist K-line
        </p>
        <h1 className="mb-3 text-2xl font-bold">无法显示当前页面</h1>
        <p className="mb-5 text-sm leading-6 text-[var(--text-secondary)]">
          图表页面加载失败，请重试当前操作。
        </p>
        {error.digest ? (
          <p className="mb-5 rounded-md bg-[var(--surface-overlay)] px-3 py-2 text-xs font-semibold text-[var(--brand)]">
            错误编号 {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--brand-fg)] hover:opacity-90"
        >
          重试
        </button>
      </section>
    </main>
  );
}
