<p align="right">
  <strong>中文</strong> | <a href="./README.md">English</a>
</p>

# Mist Frontend (mist-fe) — A 股专业级量化可视化交易桌面

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.1-black.svg" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-blue.svg" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/TradingView-Lightweight_Charts-blue.svg" alt="Lightweight Charts" />
  <img src="https://img.shields.io/badge/License-BSD--3--Clause-green.svg" alt="License" />
</p>

Mist Frontend 是面向 A 股市场的专业量化投研分析与缠论几何可视化前端工作台，基于 Next.js 16（App Router）与 React 19 构建。通过 TradingView `lightweight-charts` 提供毫秒级高性能金融交互图表，支持纯正缠论几何图元渲染、多图层透视、流式推演仿真控制台与行情订阅运维管理。

---

## 🌟 核心特性

- **多周期金融 K 线与技术指标图表**：支持 1m/5m/15m/30m/60m/日线 周期无缝切换，基于 TradingView `lightweight-charts` 实现丝滑缩放，副图指标（MACD、RSI、KDJ、量能 VMA）多周期精准同步。
- **纯正缠论几何形态可视化**：
  - **合并 K（Merge K）**：基于包含关系动态归约展示；
  - **笔（Bi）**：区分完成笔（蓝色）、未完成笔（紫色）与初始笔；
  - **特征序列线段（Duan）**：精准标识线段走势与破坏极值点；
  - **中枢（Zhongshu）**：半透明矩形区域渲染 Phase A 候选与 Phase B 最终定点中枢；
  - **买卖点标记（BSP）**：第一类、第二类与第三类买卖点标记（`1买` / `2买` / `3买` / `1卖` / `2卖` / `3卖`），严格锚定形态极值时刻 `pivotTime`。
- **多图层透视（Multi-Layer Visualizer）**：图表工具栏支持独立勾选控制：笔折线（`chan_bi`）、笔中枢（`chan_zs_bi`）、线段（`chan_duan`）、段中枢（`chan_zs_duan`）、策略信号标记与原生买卖点（`chan_bsp`）。
- **流式推演仿真工作台（Simulation Workbench）**：
  - 本地开发环境下支持单步推演推流（SSE 长连接 `text/event-stream`）；
  - 全功能播放控制器：`play` / `pause` / `step_next` / `step_prev` / `seek` 与多档调速；
  - **环境隔离硬门禁**：通过 `isLocalDevEnvironment()` 严格守门，仅在本地开发环境激活仿真控制，线上生产环境自动切换为安全只读离线复盘模式。
- **量化策略工作台与行情订阅**：策略生命周期定义、规则配置、信号事件实时刷新、回测提交；实时查看 TDX/QMT 行情源连接状态与标的池管理。
- **React 19 现代化架构**：Server Components + 严格统一 Envelope 契约校验（`parseEnvelope`），保障跨仓通信类型安全与故障自愈。

---

## 🏛️ 应用架构与通信数据流

```text
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 16 App Router                       │
│  /k (K线)  |  /chan (双周期缠论)  |  /backtests (回测与仿真) │
│  /strategies (策略工作台)         |  /settings (订阅配置)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │     app/api/client.ts       │
                │ (统一 API Client & 严格校验) │
                │ parseEnvelope & EnvelopeVo  │
                └──────────────┬──────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │ Next.js Rewrites (同源反向代理网关) │
            ▼                                     ▼
   /api/mist/:path*                      /api/chan/:path*
            │                                     │
            └──────────────────┬──────────────────┘
                               │ HTTP (:8001)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 mist-backend (:8001)                        │
│ 主 API / 行情 Ingress / 指标 / 纯几何缠论 (/v1/chan/)       │
│ (原 chan-api :8008 已彻底收敛并入 mist-backend :8001)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 环境与依赖要求

- **Node.js**：`>= 24.0.0`
- **包管理器**：`pnpm` (`pnpm install --frozen-lockfile`)

---

## 🚀 快速上手

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制环境变量模板：
```bash
cp .env.example .env.local
```

环境变量配置示例（本地开发通过 Next.js rewrites 反向代理至后端）：
```env
NEXT_PUBLIC_MIST_API_BASE_PATH=/api/mist
NEXT_PUBLIC_CHAN_API_BASE_PATH=/api/chan
MIST_API_PROXY_TARGET=http://127.0.0.1:8001
CHAN_API_PROXY_TARGET=http://127.0.0.1:8001
NEXT_PUBLIC_API_TIMEOUT=30000
```

> [!TIP]
> 后端原 `chan-api` (8008) 已彻底合并至 `mist-backend` (8001)，`CHAN_API_PROXY_TARGET` 默认自动优雅回退至 `MIST_API_PROXY_TARGET`。

### 3. 启动开发服务器

```bash
pnpm dev
```

浏览器访问核心页面：
- **K 线与综合工作台**：`http://localhost:3000/k`
- **双周期缠论透视面板**：`http://localhost:3000/chan`
- **回测与推演仿真工作台**：`http://localhost:3000/backtests`
- **量化策略管理**：`http://localhost:3000/strategies`
- **行情订阅配置**：`http://localhost:3000/settings`
- **缠论回归测试面板**：`http://localhost:3000/chan-tests`

---

## 🧪 测试与质量门禁

```bash
# 运行全部单元测试
pnpm test

# CI 串行测试
pnpm run test:ci

# 代码格式化与类型检查
pnpm run lint
pnpm run typecheck

# 缠论回归快照生成与对比
pnpm run snapshots:generate
```

---

## 📂 页面与模块目录结构

```text
app/
├── api/                   # API 客户端、契约类型与 Envelope 解析器 (client.ts, types.ts)
├── components/            # UI 组件库 (tv-chart TradingView 图表、ErrorBoundary 等)
├── k/                     # /k 核心金融 K 线页面
├── chan/                  # /chan 双周期缠论透视主页面
├── backtests/             # /backtests 回测管理与流式推演仿真工作区
├── strategies/            # /strategies 策略管理工作台
├── settings/              # /settings 行情订阅与分配池配置
├── chan-tests/            # /chan-tests 缠论算法快照回归面板
├── dashboard/             # /dashboard 系统概览仪表盘
├── layout.tsx             # 全局根布局
└── globals.css            # Tailwind CSS 全局样式
```

---

## 📄 许可证

本项目遵循 [BSD-3-Clause](https://opensource.org/licenses/BSD-3-Clause) 开源许可证。
