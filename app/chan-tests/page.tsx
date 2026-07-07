import { listCasesWithMeta, readSnapshot } from "./lib/load-snapshot";
import { ChanTestsPage } from "./ChanTestsPage";

export const dynamic = "force-dynamic";

export default function Page() {
  const cases = listCasesWithMeta();
  // 预加载所有用例的快照（用例数量少，全量加载可接受）
  const snapshots: Record<string, NonNullable<ReturnType<typeof readSnapshot>>> = {};
  for (const { testCase } of cases) {
    const snap = readSnapshot(testCase.key);
    if (snap) snapshots[testCase.key] = snap;
  }
  return <ChanTestsPage cases={cases} snapshots={snapshots} />;
}
