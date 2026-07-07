import type { ChanTestCase } from "../index";

/**
 * 贵州茅台 2026 上半年日K
 *
 * 验证笔与中枢在 TDX 前复权数据上的识别。
 * 数据源：通达信（部署环境真实数据）。
 */
export const maotai2026: ChanTestCase = {
  key: "maotai-2026",
  name: "贵州茅台 2026",
  code: "600519",
  source: "tdx",
  period: 1440, // DAY
  startDate: "2026-01-01",
  endDate: "2026-07-07",
  desc: "贵州茅台2026上半年日K（TDX前复权），验证笔与中枢识别",
};
