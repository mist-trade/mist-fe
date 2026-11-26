# Mist Frontend (mist-fe) — 架构与开发认知 (AGENTS.md)

> 本文件是 `mist-fe` 仓库（Next.js 16 + React 19）的项目级架构认知与开发守则。
> 工作区总览见根目录 `../AGENTS.md`。

---

## 一、技术栈与核心职责

- **技术栈**：Next.js 16.1 (App Router) + React 19.2 + TypeScript 5.x + Tailwind CSS v4 + TradingView `lightweight-charts` (^4.2.3) + Ant Design。
- **架构职责**：A 股专业量化交易桌面，负责多周期 K 线与指标渲染、纯正缠论几何形态呈现、多图层透视（几何形态 / 信号层 / 交易成交）、流式推演仿真与策略/订阅管理。

---

## 二、后端通信与 Envelope 统一契约（刚性守门）

数据层统一位于 `app/api/client.ts`（本项目无 `src/` 目录，禁止创建 `src/`）。所有面向后端的网络调用必须严格遵循以下通信契约：

### 1. 反向代理与后端端口统一
- 页面客户端使用 Next.js `rewrites()` 进行同源代理：
  - `/api/mist/*` $\to$ `process.env.MIST_API_PROXY_TARGET`（默认 `http://127.0.0.1:8001`）
  - `/api/chan/*` $\to$ `process.env.CHAN_API_PROXY_TARGET || process.env.MIST_API_PROXY_TARGET`（默认 `http://127.0.0.1:8001`）
- **严禁重新引入 `:8008` 端口**：原 `apps/chan` (8008) 微服务已彻底退役下线，所有缠论几何请求统一由主后端 `mist-backend:8001` 的 `/v1/chan/*` 提供服务。

### 2. 统一 Envelope 响应协议校验（`parseEnvelope`）
所有非 204 JSON 响应必须由 `parseEnvelope` 进行严格强类型断言，必须具备以下字段：
- `success: boolean`
- `statusCode: number`（必须与 HTTP 实际状态码一致）
- `message: string`
- `requestId: string`（提取自响应体或 `x-request-id` 响应头）
- `timestamp: string`
- `path: string`
- `data: T`（`success === true` 时必须存在，允许为 `null`）

### 3. 204 与空响应边界
- **`requestJson`**：接收 `HTTP 200 + data: null`，但**严格拒绝 HTTP 204 No Content**（收到 204 会抛出 `MistApiContractError`）；
- **`requestNoContent`**：仅严格接收 HTTP 204，拒绝任何其他状态码；
- 业务拒绝（`success === false` 且 `HTTP 200`）由客户端抛出 `MistApiError`；格式不符合规范时抛出 `MistApiContractError`。

---

## 三、流式推演仿真与开发/生产环境刚性隔离

推演仿真引擎（`/v1/simulation/*`）为量化策略研发提供了以 Bar 为粒度的单步推流和 SSE 长连接同步机制：

1. **环境硬门禁（`isLocalDevEnvironment()`）**：
   - 仿真推演控制（`startSimulation`, `controlSimulation`, `stopSimulation`, `getSimulationStreamUrl`）**仅限本地开发环境（`process.env.NODE_ENV === "development"` 或显式开启 `NEXT_PUBLIC_ENABLE_LOCAL_SIMULATION === "true"`）可用**；
   - 线上生产环境中，上述函数直接通过 Promise.reject 拒绝，前端自动切换为安全只读的离线历史复盘模式，杜绝向生产环境发送推演控制命令。
2. **Agent 专属调试快照（`fetchSimulationDump`）**：
   - 诊断快照端点（`/v1/simulation/dump`）专供 Agent 和底层算法排查游标、滑窗切片与几何残影；
   - **绝对禁止在前端用户界面上暴露任何 dump 相关按钮或入口**。

---

## 四、两层架构多图层透视与双时间戳契约

图表展示与回测工作台（`app/backtests/`）严格遵循后端 **「信号层 → 完整交易引擎」** 两层单向架构与双时间戳契约（原 `TacticalEvent` 中间层已于 2026-11-24 退役）：

1. **图层物理隔离与按需透视**：
   - 信号层（`chan_bsp` / 历史遗留图层名 `tactical_events`）：展示策略内核发射的原始买卖点与归因轨迹（后端已直接消费 `StrategySignal` + `decisionTrace.trace`，前端图层参数名待重构为 `backtest_signals`）；
   - 交易引擎成交标记：对应完整交易引擎经聚合、裁决与 Next-Bar 撮合后产出的真实成交/指令结果；
   - 几何形态层：笔（`chan_bi`）、笔中枢（`chan_zs_bi`）、线段（`chan_duan`）、段中枢（`chan_zs_duan`）。
2. **双时间戳法定对齐**：
   - **图表 Marker 绘制**：视觉标签必须锚定在极值点时间戳 `pivotTime` 与极值价格 `pivotPrice` 上（无结构锚点时回退 `signalTime`），确保图形与 K 线形态对齐；
   - **决策状态与回放进度**：决策生效时刻严格锚定右侧确立时刻 `signalTime`，与交易引擎 Next-Bar 撮合逻辑严格因果闭合，严禁视觉与逻辑倒错。

---

## 五、开源合规与保密红线

1. **私有策略绝不硬编码**：`mist-fe` 为公共开源前端，严禁将私有插件仓库 `mist-alpha-private` 中的任何专有策略、alpha 计算逻辑或特定标的经验参数写入前端代码。
2. **组件复用规范**：K 线图表相关逻辑优先复用 `app/components/tv-chart/` 下的 TradingView 组件，禁止手写 DOM 绘制循环。
