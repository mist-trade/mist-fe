import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const appRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

function walkSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(appRoot, relativeDir);
  return readdirSync(absoluteDir).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry);
    const absolutePath = path.join(appRoot, relativePath);
    if (statSync(absolutePath).isDirectory()) {
      if (relativePath.includes("__tests__")) {
        return [];
      }
      return walkSourceFiles(relativePath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [relativePath] : [];
  });
}

describe("frontend runtime source boundaries", () => {
  it("removes the old runtime fetch module", () => {
    expect(existsSync(path.join(appRoot, "app/api/fetch.ts"))).toBe(false);
  });

  it("does not statically import fixture data from live runtime modules", () => {
    const checkedFiles = [
      "app/api/client.ts",
      "app/k/KLineLivePage.tsx",
    ];

    expect(
      checkedFiles.filter((file) => read(file).includes('from "@/test-data"'))
    ).toEqual([]);
  });

  it("does not import the old fetch module from runtime source files", () => {
    const offenders = walkSourceFiles("app").filter((file) => {
      const source = read(file);
      return /from\s+["'](?:@\/app\/api\/fetch|.*\/fetch)["']/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("removes dead test-statistics runtime code", () => {
    const panelDir = path.join(appRoot, "app/components/test-statistics-panel");
    expect(existsSync(panelDir) ? readdirSync(panelDir) : []).toEqual([]);
    expect(
      existsSync(path.join(appRoot, "app/api/types/test-statistics.types.ts"))
    ).toBe(false);
  });

  it("does not keep unconditional console calls in live chart runtime files", () => {
    const checkedFiles = [
      ...walkSourceFiles("app/components/k-panel"),
      "app/k/KLineLivePage.tsx",
      "app/api/client.ts",
    ];

    const offenders = checkedFiles.filter((file) =>
      /console\.(log|warn|error|debug|info)\s*\(/.test(read(file))
    );

    expect(offenders).toEqual([]);
  });
});
