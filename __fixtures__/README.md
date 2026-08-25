# __fixtures__ — 缠论前端回归测试数据与快照

`__fixtures__` 维护了缠论（Chan Theory）算法在前端渲染验证的声明式测试用例与后端返回的黄金基线快照（Golden Files）。

---

## 🎯 模块职责

- **声明式用例管理**：定义标准 A 股走势样本（如 `shanghai-index-2025` 等典型历史走势）。
- **快照基线对比**：在算法迭代或重构后，通过 `git diff` 快速比对合并 K、笔、线段与中枢的几何输出变更。

---

## 📂 目录结构速查

```text
__fixtures__/
├── cases/              # 测试用例定义（TypeScript）
│   ├── index.ts        # 用例注册表
│   └── chan/           # 各具体标的用例
└── snapshots/          # 后端 API 黄金快照（JSON）
    └── chan/<case-key>/# (k.json, merge-k.json, bi.json, channel.json 等)
```

---

## 🛠️ 快照生成与对比命令

```bash
# 全量重新生成快照 (默认连接本地或生产 chan-api)
pnpm run snapshots:generate

# 指定单个用例生成快照
pnpm run snapshots:generate -- --case=shanghai-index-2025

# 覆盖后端请求地址
SNAPSHOT_BACKEND_URL=http://127.0.0.1:8008 pnpm run snapshots:generate
```

---

## 🔗 关联页面

- 前端可视化查看入口：启动前端后访问 `http://localhost:3000/chan-tests`。
