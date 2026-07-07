# Mist Frontend (mist-fe)

<p align="center">
  <strong>智能股票市场分析与预警系统 - 前端应用</strong>
</p>

<p align="center">
  基于 Next.js 的金融图表与技术分析应用，专为中文股票市场数据可视化设计
</p>

---

## 📖 项目简介

Mist Frontend 是一个基于 Next.js 的金融图表和技术分析应用，专为中文股票市场数据可视化而设计。使用 ECharts 实现高级图表功能，支持自定义缠论（缠论）模式展示。

### ✨ 核心特性

- **K 线图表可视化**：交互式蜡烛图与成交量指标
- **合并 K（合并K）**：基于包含关系对连续 K 线进行分组
- **趋势线（笔）**：使用颜色编码状态可视化显著价格变动
- **中枢（中枢）**：展示由交替笔形成的整理区间
- **策略工作台**：管理策略定义、版本、信号、告警确认和 signal-level 回测
- **实时数据处理**：客户端计算与流式传输支持
- **错误边界**：优雅的错误处理与降级 UI
- **环境配置**：通过环境变量灵活配置 API

---

## 🚀 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Next.js](https://nextjs.org) | 16.1.4 | React 框架（App Router） |
| [React](https://react.dev) | 19.2.3 | UI 库 |
| [TypeScript](https://www.typescriptlang.org) | 5.9.3 | 类型安全开发 |
| [ECharts](https://echarts.apache.org) | 6.0.0 | 图表库 |
| [Tailwind CSS](https://tailwindcss.com) | 4.x | 原子化 CSS |
| [Jest](https://jestjs.io) | 30.2.0 | 测试框架 |

---

## 🏗️ 项目结构

```
app/
├── api/                   # API 路由与数据获取
│   ├── fetch.ts           # API 客户端与数据获取
│   └── mock-data/         # 开发用模拟数据
│       └── index.ts       # 统一模拟数据源
├── components/
│   ├── k-panel/           # 主 K 线图组件
│   │   ├── index.tsx      # K 线图主组件
│   │   ├── hooks/         # 自定义 React Hooks
│   │   │   ├── useChartData.ts      # 数据处理
│   │   │   ├── useChartConfig.ts    # 图表配置
│   │   │   └── useChartRender.ts    # ECharts 渲染
│   │   ├── utils/        # 工具函数
│   │   │   ├── dataProcessor.ts     # 纯计算函数
│   │   │   └── formatters.ts        # 数据格式化
│   │   ├── config/       # 配置常量
│   │   │   ├── chartColors.ts       # 颜色方案
│   │   │   └── chartOptions.ts      # 图表选项
│   │   ├── types/        # TypeScript 类型定义
│   │   ├── __tests__/    # 单元测试
│   │   └── skeleton.tsx  # 加载骨架屏
│   └── ErrorBoundary.tsx # 错误边界组件
├── k/
│   └── page.tsx           # K 线图页面路由
├── strategies/
│   ├── page.tsx           # 策略工作台页面路由
│   └── StrategiesWorkspace.tsx
├── layout.tsx             # 根布局
└── globals.css            # 全局样式
```

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm 8+

### 安装依赖

```bash
pnpm install
```

### 环境配置

创建 `.env.local` 文件（参考 `.env.example`）：

```env
# API 配置
NEXT_PUBLIC_MIST_API_BASE_PATH=/api/mist
NEXT_PUBLIC_CHAN_API_BASE_PATH=/api/chan
MIST_API_PROXY_TARGET=http://127.0.0.1:8001
CHAN_API_PROXY_TARGET=http://127.0.0.1:8008
NEXT_PUBLIC_API_TIMEOUT=10000
NEXT_PUBLIC_ENABLE_MOCK_KLINE_FALLBACK=false

# 环境
NODE_ENV=development
```

### 开发

```bash
# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000/k 查看 K 线图，访问
http://localhost:3000/strategies 打开策略工作台。

策略工作台只通过 `NEXT_PUBLIC_MIST_API_BASE_PATH` 或
`NEXT_PUBLIC_MIST_API_BASE_URL` 访问 Mist 后端 `/v1/*` 策略 API。生产默认走
同源 `/api/mist` 网关路径，不直连 datasource 或 raw provider 服务。

### 生产构建

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

### Docker 镜像

生产部署使用 `ghcr.io/mist-trade/mist-fe`。GitHub Actions 工作流
`Build Frontend Docker Image` 会发布当前提交 SHA tag，`master` 分支额外发布
`latest`。

本地构建与 smoke：

```bash
docker build -t ghcr.io/mist-trade/mist-fe:local .
docker run --rm -p 3000:3000 ghcr.io/mist-trade/mist-fe:local
curl http://127.0.0.1:3000/
```

默认基础镜像固定为 `node:22.13-alpine`，匹配 `pnpm@11.7.0` 的 Node
版本要求。如果本机访问 Docker Hub 慢，可以临时换源，但仍要使用 Node
`22.13` 或更高版本：

```bash
docker build \
  --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22.13-alpine \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  -t ghcr.io/mist-trade/mist-fe:local .
```

容器默认使用同源网关路径：

```env
NEXT_PUBLIC_MIST_API_BASE_PATH=/api/mist
NEXT_PUBLIC_CHAN_API_BASE_PATH=/api/chan
```

---

## 📚 可用脚本

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | 运行 ESLint |
| `pnpm test` | 运行 Jest 测试 |
| `pnpm test:watch` | 监听模式运行测试 |
| `pnpm test:coverage` | 生成测试覆盖率报告 |

---

## 🏛️ 架构设计

### 数据流模式

**核心架构**：Server components 通过 `app/api/fetch.ts` 获取初始数据，将**未解析的 Promises** 传递给 client components，后者使用 React 19 的 `use()` hook 来解包 Promises。

**为什么使用这种模式**：支持流式传输和渐进式渲染。`use()` hook 会暂停组件直到数据可用。

```
Server Component (page.tsx)
    ↓
fetch.ts 返回 Promises
    ↓
Client Component (KPanel) 接收 Promises
    ↓
use() hook 解包 Promises
    ↓
ECharts 渲染图表
```

### 组件架构

KPanel 组件遵循模块化架构：

```typescript
<KPanel>
  ├── useChartData       // 数据处理与转换
  ├── useChartConfig     // 图表配置与系列创建
  └── useChartRender     // ECharts 初始化与更新
</KPanel>
```

**关注点分离**：
- **useChartData**：将原始数据处理为图表就绪格式
- **useChartConfig**：创建 ECharts 配置和系列
- **useChartRender**：管理 ECharts 生命周期

---

## 📊 缠论实现

### 数据结构

```typescript
// K 线数据
interface IFetchK {
  id: number;
  symbol: string;
  time: Date;
  amount: number;
  open: number;
  close: number;
  highest: number;
  lowest: number;
}

// 合并 K
interface IMergeK {
  startTime: Date;
  endTime: Date;
  highest: number;
  lowest: number;
  trend: TrendDirection;  // 'up' | 'down' | 'none'
  mergedCount: number;
  mergedIds: number[];
  mergedData: IFetchK[];
}

// 笔
interface IFetchBi {
  startTime: Date;
  endTime: Date;
  highest: number;
  lowest: number;
  trend: TrendDirection;
  type: BiType;  // 'initial' | 'uncomplete' | 'complete'
  independentCount: number;
  originIds: number[];
  originData: IFetchK[];
}

// 中枢
interface IFetchChannel {
  zg: number;           // 中枢上沿（中枢最低的高点）
  zd: number;           // 中枢下沿（中枢最高的低点）
  gg: number;           // 中枢最高（所有笔的最高点）
  dd: number;           // 中枢最低（所有笔的最低点）
  level: ChannelLevel;  // 'bi' | 'duan'
  type: ChannelType;    // 'complete' | 'uncomplete'
  startId: number;
  endId: number;
  trend: TrendDirection;
  bis: IFetchBi[];
}
```

### 可视化元素

**合并 K（合并K）**：基于包含关系对连续 K 线进行分组

**笔**：识别显著价格变动

| 类型 | 颜色 | 描述 |
|------|------|------|
| 完成 | 蓝色 (#2196f3) | 完全形成的趋势线 |
| 未完成 | 紫色 (#9c27b0) | 未完成的趋势线 |
| 初始 | 橙色 (#ff9800) | 初始趋势线 |

**中枢**：由交替笔形成的整理区间

| 类型 | 颜色 | 透明度 |
|------|------|--------|
| 完成 | 绿色 (#4caf50) | 15% |
| 未完成 | 橙色 (#ff9800) | 8% |

**趋势颜色**：
- 上涨：红色 (#ef5350)
- 下跌：青色 (#26a69a)

---

## 🔌 API 集成

### 后端 API

生产部署默认走同源 nginx 网关：

- Mist 后端：`/api/mist`
- Chan 分析服务：`/api/chan`

本地开发如果没有启动 nginx，推荐保持浏览器同源请求，并让 Next dev server 代理到后端：

```env
MIST_API_PROXY_TARGET=http://127.0.0.1:8001
CHAN_API_PROXY_TARGET=http://127.0.0.1:8008
```

如果后端明确允许 CORS，也可以让浏览器直连绝对 URL：

```env
NEXT_PUBLIC_MIST_API_BASE_URL=http://127.0.0.1:8001
NEXT_PUBLIC_CHAN_API_BASE_URL=http://127.0.0.1:8008
```

### 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/mist/security/v1/all` | GET | 获取股票列表 |
| `/api/mist/v1/collector/collect` | POST | 触发指定股票与周期的 K 线采集 |
| `/api/chan/indicator/k` | POST | 获取 K 线数据 |
| `/api/chan/chan/merge-k` | POST | 计算合并 K |
| `/api/chan/chan/bi` | POST | 计算笔 |
| `/api/chan/chan/fenxing` | POST | 计算分型 |
| `/api/chan/chan/channel` | POST | 计算中枢 |

### 配置

统一 API 边界在 `app/api/client.ts` 中配置。默认使用相对路径以保持浏览器单 origin；本地直连时再设置 `NEXT_PUBLIC_MIST_API_BASE_URL` 和 `NEXT_PUBLIC_CHAN_API_BASE_URL`。

```typescript
const mistBase = getMistApiBase(); // /api/mist
const chanBase = getAnalysisApiBase(); // /api/chan
```

---

## 🧪 测试

### 测试结构

单元测试位于源文件旁的 `__tests__` 目录中：

```
app/components/k-panel/
├── utils/
│   └── __tests__/
│       └── dataProcessor.test.ts
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage
```

### 当前覆盖率

- 数据处理函数：100% 覆盖率
- 11 个通过的测试

---

## 🧪 测试数据管理

### 目录结构

```
test-data/
├── fixtures/              # 静态 fixtures（本地）
│   └── k-line/           # K 线 fixtures
└── results/              # 从后端同步
    ├── json/             # 原始 JSON 结果
    └── types/            # TypeScript 定义
```

### 从后端同步

```bash
# 从后端拉取最新数据
pnpm run sync:from-backend

# 同步 + 启动开发服务器
pnpm run dev:sync
```

### 使用方式

```typescript
// 导入同步的结果
import { shanghaiIndex20242025Results } from '@/test-data/results/types';

// 使用数据
const kData = shanghaiIndex20242025Results.data.originalKLines;
const summary = shanghaiIndex20242025Results.summary;
```

---

## ⚙️ 配置

### 环境变量

创建 `.env.local` 文件（参考 `.env.example`）：

```env
# API 配置
NEXT_PUBLIC_MIST_API_BASE_PATH=/api/mist
NEXT_PUBLIC_CHAN_API_BASE_PATH=/api/chan
MIST_API_PROXY_TARGET=http://127.0.0.1:8001
CHAN_API_PROXY_TARGET=http://127.0.0.1:8008
NEXT_PUBLIC_API_TIMEOUT=10000
NEXT_PUBLIC_ENABLE_MOCK_KLINE_FALLBACK=false

# 环境
NODE_ENV=development
```

`NEXT_PUBLIC_ENABLE_MOCK_KLINE_FALLBACK=true` 仅用于开发调试。当实时 K 线请求失败时，页面会显示 fallback 状态，避免误认为是真实行情。

### TypeScript 路径别名

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Tailwind CSS v4

使用新的 `@import "tailwindcss"` 语法与 CSS 变量进行主题化。

---

## 🛠️ 错误处理

### 错误边界

应用实现了多层错误处理：

1. **API 层**：`fetch.ts` 中的 try/catch 与超时处理
2. **组件层**：ErrorBoundary 包装图表组件
3. **用户反馈**：优雅的降级 UI 与重试选项

### 错误边界位置

`app/components/ErrorBoundary.tsx` 包装主 KPanel 组件。

---

## 📝 开发注意事项

### 关键路由

`/k` 路由显示主 K 线图

### 图表计算

图表计算（合并 K、趋势线）在客户端实时进行

### 模拟数据

开发中，应用使用来自 `app/api/mock-data/` 的模拟数据。可通过以下方式配置活动数据集：

```env
NEXT_PUBLIC_MOCK_DATASET=development  # 或 'testing', 'production'
```

---

## 🔑 关键依赖

| 包 | 版本 | 用途 |
|------|------|------|
| next | 16.1.4 | React 框架 |
| react | 19.2.3 | UI 库 |
| echarts | 6.0.0 | 图表库 |
| tailwindcss | 4.x | 原子化 CSS |
| typescript | 5.9.3 | 类型安全开发 |
| jest | 30.2.0 | 测试框架 |

---

## 🐛 已知问题

- 开发中使用模拟数据（后端集成进行中）
- 数据集很大时图表性能可能下降

---

## 📝 许可证

本项目为私有项目，版权所有。

---

## 📮 相关文档

- [后端项目](../mist/)
- [主目录文档](../)
