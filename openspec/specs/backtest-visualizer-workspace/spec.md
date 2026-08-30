# backtest-visualizer-workspace Specification

## Purpose
TBD - created by archiving change add-backtest-visualizer-workspace. Update Purpose after archive.
## Requirements
### Requirement: Backtest Visualizer SHALL Support Second-Level Time Precision And Full Chan Layer Rendering

The backtest configuration form SHALL accept time ranges with second-level precision and submit ISO-8601 date-time values; the chart SHALL render all Chan layers with toggleable legend controls; and clicking a signal row SHALL focus the chart on the triggering K-line.

#### Scenario: A backtest time range is configured with second precision
- **WHEN** the user configures a backtest run time range (e.g. `2026-08-26 13:00:00` to `2026-08-26 15:00:00`)
- **THEN** the form MUST accept second-level precision
- **AND** the submitted date-time MUST be ISO-8601 formatted
- **AND** the frontend MUST NOT truncate to `substring(0,10)`; visual queries MUST use `formatShanghaiDateTime(...).replace(/\//g,'-')` via `app/lib/time.ts` (`Asia/Shanghai`) at second precision for `fetchK`+`fetchVisualCommands` dual-request parity with `MarketDataPipeline`

#### Scenario: All Chan layers render with toggleable legend controls
- **WHEN** the workspace loads a K-line chart for a backtest run
- **THEN** the chart MUST support showing/hiding each layer via legend or switch: Candlestick, Volume/MACD momentum sub-chart (tab-switchable), MergeK, Fenxing, Bi, Bi-channel (ZG-ZD-GG-DD), Duan, Duan-channel, and buy/sell Pin markers (1买/1卖/2买/2卖/3买/3卖 badges)

#### Scenario: A signal row click focuses the chart on the triggering bar
- **WHEN** the user clicks any signal record in the signal table
- **THEN** the chart MUST center on the triggering K-line via `dispatchAction({ type: 'dataZoom' })`
- **AND** a highlight guide MUST be shown

### Requirement: Backtest Visualizer SHALL Expose Chan API And Backtest Endpoints Through The Shared Client

The frontend client SHALL support the Chan structure endpoints and the strategy backtest lifecycle endpoints so the workspace can fetch structure layers and replay signals through one typed client.

#### Scenario: Chan structure endpoints are called through the client
- **WHEN** the workspace needs K, merge-K, fenxing, bi, channel, duan or duan-channel data
- **THEN** `client.ts` MUST provide typed fetchers for the dual-request path `POST /v1/indicators/k` (`fetchK`) and `GET /v1/visual/commands` (`fetchVisualCommands`) sharing the same `{code, period, source, startDate, endDate}` query at second precision via `app/lib/time.ts` (`Asia/Shanghai`) and the unified `MarketDataPipeline` (co-consumed with `visual.controller`), and MUST treat legacy `POST /v1/chan/*` 7-request fetchers as debug-only

#### Scenario: Backtest lifecycle endpoints are called through the client
- **WHEN** the workspace creates, polls or queries signals of a backtest run
- **THEN** `client.ts` MUST support `POST /v1/strategy-backtests`, `GET /v1/strategy-backtests/:runId` and `GET /v1/strategy-backtests/:runId/signals`

### Requirement: Diagnostic Drawer SHALL Expose Central Zone Geometry And Divergence Details

Selecting a signal or clicking a buy/sell badge SHALL open a right-side drawer showing the central-zone geometry, preceding first-class point relationship, MACD momentum divergence comparison and a formatted JSON snapshot.

#### Scenario: A signal is selected for diagnosis
- **WHEN** the user selects a signal or clicks a buy/sell badge on the chart
- **THEN** the right drawer MUST show central zone bounds (ZG/ZD/GG/DD), the related preceding first-buy/sell point, the MACD momentum divergence comparison
- **AND** a formatted JSON snapshot MUST be displayed

