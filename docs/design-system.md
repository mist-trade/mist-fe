# Mist 设计系统 — Institutional Quant Workbench

> 单一事实来源：`app/styles/tokens.ts`（TS）+ `app/styles/themes.css`（CSS 变量）。
> 本文档是面向开发者的速查与契约说明，色值以 tokens.ts 为准。

## 1. 架构总览

三处消费同一份 Token：

```
app/styles/tokens.ts (SSOT: LIGHT_TOKENS / DARK_TOKENS)
        │
        ├──► app/styles/themes.css      [data-theme="light|dark"] CSS 变量
        │       └──► globals.css @theme inline  →  Tailwind 工具类 (text-sem-up 等)
        │       └──► 组件内联样式 var(--sem-up)
        │
        ├──► app/styles/antd-theme.ts   →  antd ConfigProvider theme token
        │
        └──► app/components/charts/echarts-theme.ts  →  echarts.registerTheme("mist-light"|"mist-dark")
```

主题解析（`app/styles/ThemeProvider.tsx` + `TimeBasedThemeScript.tsx`）：
1. 用户手动覆盖（localStorage `mist-theme-manual`）— 最高优先级
2. 本地时间规则：07:00–18:00 light，其余 dark
3. 防闪烁：`TimeBasedThemeScript` 在 hydration 前同步写 `data-theme`

## 2. 颜色契约

### 业务语义（红涨绿跌，A股惯例）

| Token | Light | Dark | 语义 |
|---|---|---|---|
| `--sem-up` | `#ef5350` | `#ff6b6b` | 涨 / 正收益 |
| `--sem-down` | `#26a69a` | `#2dd4bf` | 跌 / 负收益 |
| `--sem-profit` | `#ef5350` | `#ff6b6b` | 盈（与涨同族） |
| `--sem-loss` | `#26a69a` | `#2dd4bf` | 亏 |
| `--sem-benchmark` | `#6366f1` | `#818cf8` | 基准 / 对比线（靛蓝，正交涨跌） |
| `--sem-excess` | `#8b5cf6` | `#a78bfa` | 超额收益（紫） |
| `--sem-risk` | `#f59e0b` | `#fbbf24` | 风险 / 回撤填充 |
| `--sem-warn` | `#f59e0b` | `#fbbf24` | 警告 / 延迟高 |
| `--sem-danger` | `#dc2626` | `#f87171` | 严重 / 断连 / 止损 |
| `--sem-success` | `#16a34a` | `#4ade80` | 成功 / 确认（比 down 绿更深饱和，防混淆） |

**红线**：
- 涨跌色恒为红涨绿跌，**不**与 success/danger 混用。
- 基准/超额用靛蓝/紫，正交于涨跌色族，避免双色图表歧义。
- `--sem-success` 故意比 `--sem-down` 更深更饱和——盈亏表里"绿=跌"与"绿=成功"不能撞色。

### 中性 / 表面

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--surface-base` | `#f7f8fa` | `#0e1116` | 页面底 |
| `--surface-raised` | `#ffffff` | `#161b22` | 卡片 / 面板 |
| `--surface-overlay` | `#ffffff` | `#1c2330` | 浮层 / tooltip |
| `--border-subtle` | `#e5e7eb` | `#262d3a` | 分隔线 |
| `--border-strong` | `#cbd3df` | `#3a4456` | 强调边框 |
| `--text-primary` | `#151a24` | `#e6edf3` | 主文本 |
| `--text-secondary` | `#5a6472` | `#9aa7b8` | 次文本 |
| `--text-muted` | `#8b95a5` | `#6b7689` | 辅助 / 时间戳 |

品牌色 `--brand: #1f7a8c`（青），仅用于非语义强调（选中态/链接），**不**用于涨跌/盈亏。

### 缠论结构色

| Token | 语义 |
|---|---|
| `--chan-bi-valid` / `-invalid` / `-unknown` | 有效笔（青）/ 无效（粉）/ 未知（橙） |
| `--chan-fenxing-top` / `-bottom` | 顶分型（蓝）/ 底分型（橙） |
| `--chan-zhongshu-complete` / `-uncomplete` | 中枢完成（绿）/ 未完成（琥珀） |

## 3. 字体 / 数字

- Sans：**Geist**（`next/font/google`，CSS 变量 `--font-geist-sans`）。
- Mono / 数字：**Geist Mono**（`--font-geist-mono`）。
- 所有数字加 `.tnum`（`font-variant-numeric: tabular-nums` + `"tnum"`），保证小数点 / 千分位 / 正负号对齐。
- 格式化规则（`app/dashboard/lib/format.ts`）：
  - 正数显 `+`，0 不带色；千分位逗号；百分比默认 2 位。
  - 时间用 `Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })`，**禁用** `toLocaleString`（防 hydration 不一致）。

## 4. 间距 / 圆角 / 阴影 / 密度

| 维度 | 值 |
|---|---|
| 间距阶（4px） | `4 / 8 / 12 / 16 / 24 / 32 / 48` |
| 圆角 | 控件 `6` / 卡片 `8` / 大面板 `12` / 图表容器 `0` |
| 阴影 | `--shadow-card`（克制）/ `--shadow-overlay`（浮层） |
| 密度 | 表格行高 36px，KPI padding 16，栅格 12 列 gutter 16，max-width 1440 |

**禁**：玻璃拟态、霓虹发光、大范围渐变、装饰性动画。

## 5. ECharts 主题契约

- `app/components/charts/echarts-theme.ts` 注册 `mist-light` / `mist-dark`，色值取自 Token。
- 所有图表经 `ChartContainer`（统一 loading/empty/error 态 + 主题上下文）。
- `useChartRender` / 图表 hook 用 `useThemeName()` 读主题，`echarts.init(container, themeName)`；主题切换时 dispose + 重建。
- **交互**：tooltip（trigger axis + cross，背景 `--surface-overlay`）、dataZoom（inside + slider）、legend 筛选、多 grid axisPointer link。
- **数据时间**：tooltip 头部显示 `数据时间 HH:mm:ss · 时区 · 延迟 Nms`。
- **视觉稳定（实时）**：图表用 `setOption()`（merge 模式）增量更新，**不**用 `notMerge:true` 全量替换；动效 ≤300ms cubicOut，实时流期间关动画。
- **新增图表类型**：line（收益/基准/超额）、area（回撤）。注册时进 `echarts.use([...])`。

## 6. 状态系统

| 状态 | 组件 | 规则 |
|---|---|---|
| Loading | antd `Skeleton` / `KPanelSkeleton` / `ChartContainer` 骨架 | shimmer，颜色随主题 |
| Empty | `EmptyState`（图标 + 文案 + 可选操作） | 取代散落"暂无…"字符串 |
| Error | 路由级 `error.tsx` + 内联 antd `Alert`（含重试） | 不再用自定义 ErrorBoundary 包路由（与 error.tsx 冗余） |
| 断连 / 延迟 | `ConnectionBadge`（online/reconnecting/disconnected + ms 分级） | 由 `useConnectionStatus`（HEAD 探测 + SWR 错误事件）驱动 |
| 时区 / 更新时间 | `DataFreshnessLabel`（固定时区时间 + 客户端相对时间） | 固定时区格式化 |

## 7. 数据层（SWR）

- `SWRProvider`（layout 内）：dedup、`keepPreviousData`（刷新不闪屏）、指数退避重试、失败广播 `mist:request-error` 事件。
- `useApi<T>(fetcher, { refreshInterval, disabled, deps })`：把任意 `api/client.ts` 函数包成 SWR hook。
- `useConnectionStatus`：探测 `/api/mist/health` HEAD RTT + 监听 SWR 错误事件 → 连接状态机。
- 现有命令式 fetch（KLineLivePage 等）保留可用；新监控代码用 `useApi`。

## 8. 红线（设计契约，全员遵守）

1. 禁赛博朋克 / 霓虹 / 玻璃拟态 / 装饰动画 / 大范围渐变；动效 ≤300ms、cubicOut、实时流关动画。
2. 涨跌色恒为红涨绿跌，**不**与 success/danger 语义混用。
3. 基准 / 超额用靛蓝 / 紫，正交于涨跌色族。
4. 所有数字 tabular-nums；正数带 `+`；千分位；价格按品种精度。
5. **任何新颜色必须经 Token，不得裸 hex 进组件**（ESLint 规则待落地，见 Phase 5）。
6. 深浅双主题必须同等完整，图表深色辨识度优先（提亮 + 降饱和 + AA 对比 ≥4.5:1）。
7. 时间一律固定时区格式化，杜绝 `toLocaleString` 跨端不一致。

## 9. 新页面 / 组件落地清单

1. 新颜色：先加到 `tokens.ts`（+ `themes.css`），再消费。不裸 hex。
2. 图表：经 `ChartContainer`，用 `useThemeName()` + 主题色，`setOption` merge 模式。
3. 表格：antd `Table`，数字列加 `.tnum`，盈亏列用 `--sem-profit`/`--sem-loss`。
4. 数据获取：用 `useApi`；实时用 `refreshInterval`；连接态挂 `ConnectionBadge`。
5. 状态：Loading（Skeleton）/ Empty（EmptyState）/ Error（Alert+重试）三态齐全。
6. 响应式：≥1280 多栏，768–1280 两栏，<768 单栏。
