# Tasks: 规范化量化工作台布局与全局统一顶栏导航

## Phase 1: 全局统一顶栏收敛 (Global Navigation Header)
- [x] 1.1 实现全局统一顶栏组件 `app/components/layout/AppHeader.tsx`，包含 6 大核心模块导航路由、高亮激活态、市场交易状态时钟与主题切换按钮。
- [x] 1.2 在 `app/layout.tsx` 中挂载 `AppHeader`，使其成为全站唯一常驻顶栏。
- [x] 1.3 在 `app/globals.css` 中添加 `AppHeader` 的标准样式规范（支持深色与浅色自适应）。
- [x] 1.4 移除各业务页面内重复手写的 private header（`/backtests`、`/k`、`/strategies`、`/settings/realtime-subscriptions`）。
- [x] 1.5 编写 `AppHeader.test.tsx` 单元测试，并更新现有受影响的页面测试。

## Phase 2: 工作台基架组件开发 (WorkspaceShell & Collapsible Sidebar)
- [x] 2.1 实现 `app/components/layout/WorkspaceShell.tsx` 双栏基架组件，支持左侧边栏一键折叠/展开、宽度平滑过渡与折叠状态提示。
- [x] 2.2 在 `app/globals.css` 中定义 `WorkspaceShell` 布局类名与响应式折叠规则。
- [x] 2.3 编写 `WorkspaceShell.test.tsx` 验证折叠行为与插槽渲染。

## Phase 3: 业务页面迁移与空间左右对齐 (Page Migration & Alignment)
- [x] 3.1 改造 `/backtests` 页面，迁入 `WorkspaceShell`，左侧为配置+历史，右侧为主图表+复盘条+信号表，支持侧栏一键折叠。
- [x] 3.2 改造 `/k` 看盘页面，抽离标的搜索至左侧边栏，右侧主区沉浸式看盘。
- [x] 3.3 改造 `/chan` 页面，将拥挤的 Header 输入移入左侧边栏，释放上下双图可视空间。
- [x] 3.4 改造 `/strategies` 页面，标准化左侧策略库与右侧工作区。
- [x] 3.5 全量测试验证（Jest 单测全过、TypeScript 零报错、Lint 零报错）。
