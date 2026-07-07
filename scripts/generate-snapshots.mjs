#!/usr/bin/env node
/**
 * 缠论回归测试快照生成器
 *
 * 遍历 __fixtures__/cases/ 下的用例，调部署后端的 /v1/indicators/k 和 /v1/chan/* 接口，
 * 把返回结果存为快照（golden files）。
 *
 * 用法:
 *   pnpm run snapshots:generate                    # 全部用例
 *   pnpm run snapshots:generate -- --case=maotai-2026   # 单个用例
 *
 * 环境变量:
 *   SNAPSHOT_BACKEND_URL  chan app 地址（默认 http://192.168.31.182:8008）
 *
 * 注意: chan app 返回裸数组（不是 {success,data} 包裹），本脚本兼容裸数组和包裹两种格式。
 *
 * 运行依赖 Node --experimental-strip-types（见 package.json 的 snapshots:generate 脚本），
 * 并通过本目录下 ts-extension-resolver.mjs 解析 .ts 文件的无扩展名 import。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..");
const CASES_ENTRY = path.join(REPO_ROOT, "__fixtures__", "cases", "index.ts");
const SNAPSHOTS_DIR = path.join(REPO_ROOT, "__fixtures__", "snapshots", "chan");

// 默认指向部署环境的 chan app（HTTP，非 HTTPS）
const BACKEND_URL = (
  process.env.SNAPSHOT_BACKEND_URL || "http://192.168.31.182:8008"
).replace(/\/+$/, "");

// ---- 参数解析 ----
const args = process.argv.slice(2);
const caseArg = args.find((a) => a.startsWith("--case="));
const filterKey = caseArg ? caseArg.split("=")[1] : null;

// ---- 加载用例 ----
// cases/index.ts 是 TS，通过 --experimental-strip-types 加载（剥离类型注解）。
async function loadCases() {
  const mod = await import(CASES_ENTRY);
  if (!Array.isArray(mod.chanTestCases)) {
    throw new Error("cases/index.ts 未导出 chanTestCases 数组");
  }
  return mod.chanTestCases;
}

// ---- 调后端 ----
async function callBackend(endpoint, body) {
  const url = `${BACKEND_URL}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${endpoint} HTTP ${res.status}: 非 JSON 响应（前 100 字符: ${text.slice(0, 100)}）`);
  }
  if (!res.ok) {
    const msg =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : JSON.stringify(payload).slice(0, 200);
    throw new Error(`${endpoint} HTTP ${res.status}: ${msg}`);
  }
  // chan app 返回裸数组；若返回 { success, data } 包裹则解包
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "success" in payload &&
    typeof payload.success === "boolean"
  ) {
    if (!payload.success) {
      throw new Error(
        `${endpoint} 业务失败: ${payload.message || payload.error?.message}`
      );
    }
    return payload.data;
  }
  return payload;
}

function buildQuery(testCase) {
  return {
    code: testCase.code,
    source: testCase.source,
    period: testCase.period,
    startDate: testCase.startDate,
    endDate: testCase.endDate,
  };
}

// ---- 生成单个用例快照 ----
async function generateSnapshot(testCase) {
  const outDir = path.join(SNAPSHOTS_DIR, testCase.key);
  fs.mkdirSync(outDir, { recursive: true });

  const query = buildQuery(testCase);
  console.log(`\n[${testCase.key}] 生成快照...`);
  console.log(
    `  ${testCase.name} | ${testCase.code} | ${testCase.source} | period=${testCase.period} | ${testCase.startDate} ~ ${testCase.endDate}`
  );

  const k = await callBackend("/v1/indicators/k", query);
  const mergeK = await callBackend("/v1/chan/merge-k", query);
  const bi = await callBackend("/v1/chan/bi", query);
  const fenxing = await callBackend("/v1/chan/fenxing", query);
  const channel = await callBackend("/v1/chan/channel", query);

  const meta = {
    key: testCase.key,
    name: testCase.name,
    generatedAt: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    testCase: {
      code: testCase.code,
      source: testCase.source,
      period: testCase.period,
      startDate: testCase.startDate,
      endDate: testCase.endDate,
    },
    stats: {
      kCount: Array.isArray(k) ? k.length : 0,
      mergeKCount: Array.isArray(mergeK) ? mergeK.length : 0,
      biCount: Array.isArray(bi) ? bi.length : 0,
      channelCount: Array.isArray(channel) ? channel.length : 0,
      fenxingCount: Array.isArray(fenxing) ? fenxing.length : 0,
    },
  };

  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "k.json"), JSON.stringify(k, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "merge-k.json"), JSON.stringify(mergeK, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "bi.json"), JSON.stringify(bi, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "fenxing.json"), JSON.stringify(fenxing, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "channel.json"), JSON.stringify(channel, null, 2) + "\n");

  console.log(
    `  ✅ ${meta.stats.kCount} K线 → ${meta.stats.mergeKCount} 合并K → ${meta.stats.biCount} 笔 → ${meta.stats.channelCount} 中枢 / ${meta.stats.fenxingCount} 分型`
  );

  if (meta.stats.kCount === 0) {
    console.log(`  ⚠️  K线为空，该用例可能在该数据源/时间段无数据`);
  }
}

// ---- 主流程 ----
async function main() {
  console.log(`后端地址: ${BACKEND_URL}`);
  console.log(`快照目录: ${SNAPSHOTS_DIR}`);

  const cases = await loadCases();
  const targets = filterKey
    ? cases.filter((c) => c.key === filterKey)
    : cases;

  if (targets.length === 0) {
    console.error(filterKey ? `未找到用例: ${filterKey}` : "无测试用例");
    process.exit(1);
  }

  let failed = 0;
  for (const tc of targets) {
    try {
      await generateSnapshot(tc);
    } catch (err) {
      console.error(`  ❌ [${tc.key}] 失败: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n完成。成功 ${targets.length - failed}/${targets.length}。`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
