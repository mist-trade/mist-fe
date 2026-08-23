import type { ChanTestCase } from "../index";

/**
 * 贵州茅台 2024-2026 日K（审计真实数据）
 *
 * 覆盖扩张中枢区间（2024-05 ~ 2025-02 的 6 个基础中枢扩张为 1 个 expanded 中枢），
 * 用于可视化验证笔中枢扩张合并（central-expansion）的正确性。
 * 数据源：通达信（部署环境真实数据）。
 */
export const maotai2024_2026: ChanTestCase = {
  key: "maotai-2024-2026",
  name: "贵州茅台 2024-2026",
  code: "600519",
  source: "tdx",
  period: 1440, // DAY
  startDate: "2024-01-01",
  endDate: "2026-08-21",
  desc: "贵州茅台2024-2026日K（TDX），含6→1中枢扩张，验证扩张合并",
};
