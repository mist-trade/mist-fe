# __fixtures__ — 缠论回归测试数据

## 目录结构

```
__fixtures__/
├── cases/              # 测试用例定义（人写，声明式）
│   ├── index.ts        # 用例注册表 + ChanTestCase 类型
│   └── chan/
│       └── *.ts        # 各用例定义
└── snapshots/          # 后端API返回快照（机器生成，golden files）
    └── chan/
        └── <key>/      # 目录名 = 用例 key
            ├── meta.json
            ├── k.json
            ├── merge-k.json
            ├── bi.json
            ├── fenxing.json
            └── channel.json
```

## 新增测试用例

1. 在 `cases/chan/` 下新建文件，导出一个 `ChanTestCase`（参考 `shanghai-index-2025.ts`）。
2. 在 `cases/index.ts` 的 `chanTestCases` 数组里加入。
3. 运行 `pnpm run snapshots:generate -- --case=<key>` 生成快照。
4. 访问 `/chan-tests` 查看结果。

## 生成快照

```bash
# 全部用例
pnpm run snapshots:generate

# 单个用例
pnpm run snapshots:generate -- --case=shanghai-index-2025
```

默认后端地址 `https://www.moyui.mist`，可通过环境变量覆盖：

```bash
SNAPSHOT_BACKEND_URL=http://127.0.0.1:8008 pnpm run snapshots:generate
```

## 回归对比

算法改动后重新生成快照，用 `git diff` 对比新旧 JSON：

```bash
pnpm run snapshots:generate -- --case=<key>
git diff __fixtures__/snapshots/chan/<key>/
```
