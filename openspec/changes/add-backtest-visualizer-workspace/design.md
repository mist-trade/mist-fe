# Design: mist-fe 回测可视化工作台架构设计

## 1. 整体架构与数据流

```
                     ┌───────────────────────────┐
                     │   /backtests 路由工作台   │
                     └─────────────┬─────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  回测配置与轮询  │      │  多图层 K 线图表  │      │ 信号与诊断明细表 │
│  (Config & Runs) │      │  (BacktestChart) │      │ (Signals/Drawer) │
└─────────┬────────┘      └─────────┬────────┘      └─────────┬────────┘
          │ (POST/GET)              │ (Fetch Layers)          │ (Select/Focus)
          ▼                         ▼                         ▼
  /v1/strategy-backtests    /v1/indicators/k          /v1/strategy-backtests/
  (Backtest Run Lifecycle)  /v1/chan/{bi,channel,     :runId/signals
                            duan,duan-channel}
```

### 1.1 生命周期与异步轮询
1. 用户配置回测参数（策略版本、标的代码、周期、数据源、起始时间、结束时间），点击「运行回测」。
2. 前端提交 `POST /v1/strategy-backtests`，获得 `runId` 与 `status=PENDING`。
3. 前端启动 SWR 或定时探针（500ms~1000ms 递增），轮询 `GET /v1/strategy-backtests/:runId`。
4. 状态流转为 `COMPLETED` 后：
   - 自动获取信号列表 `GET /v1/strategy-backtests/:runId/signals`。
   - 自动拉取第一支标的的 K 线与完整缠论几何图层（K, mergeK, fenxing, bi, channel, duan, duan-channel）。
   - 图表呈现标的蜡烛图、缠论各层图元与买卖点标记。

## 2. 图表层多维度渲染设计 (`BacktestKPanel` / `KPanel`)

图表基于 ECharts 6 Custom Series 实现，层级（z-index）与图元映射定义如下：

| 图层名称 | ECharts Series 类型 | Z-Index | 视觉呈现与交互 |
| :--- | :--- | :--- | :--- |
| **K 线 (Candlestick)** | `candlestick` | 1 | A 股红涨绿跌，高亮开收高低价 |
| **包含合并 (MergeK)** | `custom (rect)` | 5 | 虚线边框矩形，指示 K 线合并区间 |
| **笔中枢 (Channel)** | `custom (group)` | 3 | 半透明背景填充 + ZG/ZD 虚线边界 + 完整/未完成状态色 |
| **分型 (Fenxing)** | `custom (path/circle)` | 15 | 顶分型倒三角（上方）、底分型圆点（下方） |
| **画笔 (Bi)** | `custom (line)` | 10 | 连接有效分型顶底的线段（Up/Down 双色） |
| **线段 (Duan)** | `custom (line)` | 12 | 较粗实线/双线，呈现特征序列归约后的段结构 |
| **段中枢 (DuanChannel)** | `custom (group)` | 4 | 深色调带状矩形，展示段级别无方向重叠区间 |
| **买卖点信号 (BSP Pins)** | `custom (pin/badge)` | 20 | 1买/1卖/2买/2卖/3买/3卖徽标，位于极值点上方/下方，点击打开诊断详情 |
| **成交量 / MACD** | `bar` / `line` | 副图 | 支持 Tab 切换：成交量柱状图 vs MACD (DIF/DEA/红绿动量柱) |

## 3. 信号与图表双向联动机制

1. **信号列表点击聚焦 (Pan & Zoom Focus)**：
   - 信号明细表中每行展示：标的代码、信号时间、信号类型（如 `first_sell`、`second_buy`）、触发价格、规则快照。
   - 点击某条信号行：
     - 计算该信号时间在 K 线数据数组中的下标 `signalIndex`。
     - 计算聚焦窗口 `[Math.max(0, signalIndex - 30), Math.min(totalCount - 1, signalIndex + 30)]`。
     - 调用 ECharts `dispatchAction({ type: 'dataZoom', startValue, endValue })` 实现平滑居中聚焦。
     - 在图表对应 K 棒触发临时高亮效果。
2. **图表信号 Pin 点击下钻**：
   - 点击图表上的买卖点徽标，激活右侧「缠论中枢与背驰诊断抽屉」。

## 4. 缠论中枢与背驰诊断抽屉设计

抽屉分为四大诊断卡片：
1. **信号核心概览**：买卖点类型（1买/1卖/2买/2卖/3买/3卖）、触发时间戳、触发价格、所属周期与数据源。
2. **中枢几何参数 (Zhongshu Geometry)**：
   - 关联中枢区间：$ZG = \min(g_1, g_2, \dots)$，$ZD = \max(d_1, d_2, \dots)$
   - 中枢极值：$GG = \max(g_i)$，$DD = \min(d_i)$
   - 中枢构成笔/段列表及延伸有效性状态
3. **动量力度比对 (Momentum Force / MACD)**：
   - 离开段 vs 进中枢段（$c$ vs $a$）的 MACD 绿/红柱面积衰竭率
   - DIF 极值对比与峰值绝对值
4. **原始上下文 JSON (Raw Context Snapshot)**：
   - 格式化展示后端持久化的 `contextSnapshot` 与 `ruleSnapshot`。

## 5. 设计 Token 与无障碍响应式

- 严格使用 `mist-fe/app/styles/tokens.ts` 中的设计 Token。
- 主题深浅色自动适配，支持时间段规则（07:00–18:00 浅色，其余深色）。
- 关键数据列与价格均启用 `font-variant-numeric: tabular-nums` 对齐。
