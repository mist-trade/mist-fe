# Mist Frontend (mist-fe)

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16.1-black.svg" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-blue.svg" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/ECharts-6.0-red.svg" alt="ECharts" />
</p>

Mist Frontend 是面向 A 股市场的专业量化分析与缠论可视化前端工作台，基于 Next.js 16（App Router）与 React 19 构建。通过 Apache ECharts 实现毫秒级高性能金融交互图表，支持纯正缠论结构渲染、策略工作台及订阅运维管理。

---

## 🌟 核心特性

- **多周期金融 K 线与技术指标图表**：支持 1m/5m/15m/30m/60m/日线 等周期切换，提供 MACD、RSI、KDJ 等指标同步副图。
- **纯正缠论几何形态可视化**：
  - **合并 K（Merge K）**：基于包含关系动态归约展示。
  - **笔（Bi）**：区分完成笔（蓝色）、未完成笔（紫色）与初始笔。
  - **特征序列线段（Duan）**：精准标识线段走势与破坏点。
  - **中枢（Zhongshu）**：半透明矩形区域渲染 Phase A 候选与 Phase B 最终定点中枢。
  - **买卖点（BSP）**：标注第一类、第二类与第三类买卖点触发标记。
- **量化策略工作台**：策略生命周期定义、规则配置、信号事件实时刷新、回测提交与告警人工确认。
- **行情订阅操作台**：实时查看 TDX/QMT 行情源连接状态与 5 标的分配池，支持一键激活/停用。
- **缠论回归测试快照工作台**：内置 `/chan-tests` 页面与快照比对工具，保障算法前端呈现的一致性。
- **React 19 流式渲染**：采用 Server Components 与 `use()` Hook 传递未解析 Promise，实现骨架屏与渐进式图表流式加载。

---

## 🏛️ 应用架构与数据流

```text
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 16 App Router                       │
│  /k (K线)  |  /strategies (策略)  |  /settings (订阅)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │     app/api/client.ts       │
                │ (统一 API Client & 契约解包) │
                └──────────────┬──────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │ Next.js Rewrites (同源代理 / 生产网关)│
            ▼                                     ▼
   /api/mist/* (:8001)                   /api/chan/* (:8008)
(主后端/行情/策略/订阅)                   (缠论纯计算无状态微服务)
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

### 2. 环境配置

复制环境变量模板：
```bash
cp .env.example .env.local
```

配置示例（开发模式通过 Next.js rewrites 自动代理至后端）：
```env
NEXT_PUBLIC_MIST_API_BASE_PATH=/api/mist
NEXT_PUBLIC_CHAN_API_BASE_PATH=/api/chan
MIST_API_PROXY_TARGET=http://127.0.0.1:8001
CHAN_API_PROXY_TARGET=http://127.0.0.1:8008
NEXT_PUBLIC_API_TIMEOUT=10000
```

### 3. 启动开发服务器

```bash
pnpm dev
```

浏览器访问：
- **K 线与缠论主工作台**：`http://localhost:3000/k`
- **策略工作台**：`http://localhost:3000/strategies`
- **订阅配置**：`http://localhost:3000/settings`
- **缠论算法测试面板**：`http://localhost:3000/chan-tests`

---

## 🧪 测试与质量门禁

```bash
# 运行单元测试
pnpm test

# CI 串行测试
pnpm run test:ci

# 代码格式化与类型检查
pnpm run lint
pnpm run typecheck

# 缠论回归快照生成
pnpm run snapshots:generate
```

---

## 📂 页面与模块目录结构

```text
app/
├── api/                   # API 客户端与契约类型 (client.ts, types.ts)
├── components/            # UI 组件库
│   ├── k-panel/           # K 线与 ECharts 渲染核心组件
│   └── ErrorBoundary.tsx  # 组件级错误边界
├── k/                     # /k 核心 K 线页面
├── strategies/            # /strategies 策略管理与回测工作台
├── settings/              # /settings 行情订阅配置
├── chan-tests/            # /chan-tests 缠论回归测试面板
├── dashboard/             # /dashboard 概览仪表盘
├── layout.tsx             # 根布局
└── globals.css            # Tailwind CSS 全局样式
```

---

## 🚢 生产容器化与部署

生产镜像构建与部署由 `mist-deploy` 统一管理，构建基础镜像采用 `node:24-alpine`：

```bash
# 构建本地测试镜像
docker build -t ghcr.io/mist-trade/mist-fe:local .

# 启动容器
docker run --rm -p 3000:3000 ghcr.io/mist-trade/mist-fe:local
```

生产网关由 Nginx 统一调度，前端与后端 API 保持同源访问（`http://www.mist.local`）。

---

## 📄 许可证

本项目为私有量化系统核心组件，保留所有权利。
