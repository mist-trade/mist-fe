/**
 * 缠论回归测试用例注册表
 *
 * 每个用例声明：测哪只票、什么数据源、什么周期、什么时间范围。
 * 快照生成脚本（scripts/generate-snapshots.mjs）遍历这些用例，
 * 调部署后端 /v1/chan/* 接口，把返回结果存为快照。
 */

export type ChanSource = "tdx";

export interface ChanTestCase {
  /** 唯一标识，用作快照目录名，如 'shanghai-index-2025' */
  key: string;
  /** 显示名，如 '上证指数 2025' */
  name: string;
  /** 证券代码，如 '000001.SH' */
  code: string;
  /** 数据源（本方案聚焦 tdx） */
  source: ChanSource;
  /** 周期（数字，DAY=1440, WEEK=10080, FIVE_MIN=5 等） */
  period: number;
  /** 起始日期 'YYYY-MM-DD' */
  startDate: string;
  /** 结束日期 'YYYY-MM-DD' */
  endDate: string;
  /** 用例说明 */
  desc?: string;
}

import { shanghaiIndex2025 } from "./chan/shanghai-index-2025";

export const chanTestCases: ChanTestCase[] = [shanghaiIndex2025];

/** 按 key 查找用例 */
export function findCase(key: string): ChanTestCase | undefined {
  return chanTestCases.find((c) => c.key === key);
}
