import KLineLivePage from "./KLineLivePage";

/**
 * /k 路由入口。
 *
 * 不再额外包 ErrorBoundary：App Router 的 app/error.tsx 已提供路由级错误边界，
 * 重复包裹是冗余的（见审计风险#7）。
 */
export default function K() {
  return <KLineLivePage />;
}
