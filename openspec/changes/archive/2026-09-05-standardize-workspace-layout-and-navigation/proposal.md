# Proposal: 规范化量化工作台布局与全局统一顶栏导航

## 1. 背景与核心痛点

当前 `mist-fe` 经历多个业务特性的快速迭代，前端各页面在**顶部导航**与**界面空间布局（左右分布）**上呈现出显著的碎片化与割裂现象：

1. **缺失全局顶栏，各页面重复造轮子且路由断层**：
   - `app/layout.tsx` 未提供统一顶栏，各业务页面（`/k`、`/strategies`、`/backtests`、`/settings/realtime-subscriptions`）各自手写 `<header>` 与 `<nav className="strategy-nav">`；
   - 核心页面导航严重断层：`/chan`（双周期缠论联动）与 `/dashboard`（组合监控）在主导航中甚至没有入口链接，只能手敲 URL 访问；
   - 部分页面的 Header 职责不清（如 `/chan` 将标的搜索、数据源下拉、日期选择器全塞入 Header，占满垂直高度）。
2. **左右功能区空间分布混乱无序**：
   - `/backtests` 采用「左表单/历史 + 右图表/明细」；
   - `/strategies` 采用「左策略库 + 右多Tab表格」；
   - `/k` 采用「纯单列纵向堆叠（无侧栏）」；
   - `/chan` 采用「纯单列双图堆叠（无侧栏）」；
   - `/dashboard` 采用「左2/3图表 + 右1/3持仓（左右颠倒）」；
   - 侧边栏宽度各异（260px~340px 不等），且均不可折叠，导致主图表展示区域受限。
3. **样式与交互标准分裂**：
   - 存在大量内联 `style={{ display: "flex", ... }}` 与局部 CSS 类名重叠，缺少统一的主题变量和布局容器组件。

---

## 2. 目标与范围 (Scope & Goals)

### 2.1 核心目标
1. **统一全局顶栏 (`AppHeader`)**：
   - 在 `app/layout.tsx` 中挂载全局统一顶栏，全站路由共享；
   - 聚合 6 大核心模块入口（`/dashboard` 监控、`/k` 看盘、`/chan` 缠论、`/strategies` 策略、`/backtests` 回测、`/settings/realtime-subscriptions` 订阅）；
   - 集成实时交易时钟（北京时间 / 交易状态）、数据源连通指示灯与全局主题切换。
2. **确立标准工作台基架 (`WorkspaceShell`)**：
   - 确立金融交易终端公理：**左侧统一为「筛选、参数与目标管理」**，**右侧统一为「核心画布、时序推演与下钻明细」**；
   - 提供左侧边栏**一键收起/展开能力（Collapse/Expand）**，让交易员在深度盯盘与回测复盘时可一键最大化图表画布宽度。
3. **业务页面对齐与内联样式收敛**：
   - 将 `/backtests`、`/k`、`/chan`、`/strategies` 等主要视图迁入 `WorkspaceShell`，消除重复布局样板代码。

### 2.2 非目标 (Out of Scope)
- 暂不重构图表底层渲染引擎（Lightweight Charts 保持现有机制）；
- 暂不改动现有 REST API 契约与后端数据层。

---

## 3. 关联影响与验证
- 影响页面：`app/layout.tsx`，`/k`，`/chan`，`/strategies`，`/backtests`，`/dashboard`，`/settings/realtime-subscriptions`；
- 验收标准：全量 Jest 测试通过，TypeScript 编译通过，全站 6 大路由一键顺畅跳转，侧栏折叠平滑无跳变。
