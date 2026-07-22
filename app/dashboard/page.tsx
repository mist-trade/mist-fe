import type { Metadata } from "next";
import { DashboardView } from "./components/DashboardView";

export const metadata: Metadata = {
  title: "组合监控 · Mist",
  description: "Institutional quant workbench — portfolio monitoring overview",
};

/**
 * /dashboard 概览页（样板页）。
 *
 * Server Component 入口，渲染客户端 DashboardView。
 * 当前用 mock 数据（data/mock.ts）；后端实盘监控接口就绪后，
 * 在此处做服务端数据预取并作为 props 下传。
 */
export default function DashboardPage() {
  return <DashboardView />;
}
