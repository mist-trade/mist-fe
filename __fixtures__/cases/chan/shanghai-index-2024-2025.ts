import type { ChanTestCase } from "../index";

/**
 * 上证指数 2024-2025 两年日K
 *
 * 验证笔与中枢在 TDX 前复权数据上的识别。
 * 数据源：通达信（部署环境真实数据）。
 */
export const shanghaiIndex2024_2025: ChanTestCase = {
  key: "shanghai-index-2024-2025",
  name: "上证指数 2024-2025",
  code: "000001",
  source: "tdx",
  period: 1440, // DAY
  startDate: "2024-01-01",
  endDate: "2025-12-31",
  desc: "上证指数2024-2025两年日K（TDX前复权），验证笔与中枢识别",
};
