/**
 * 自定义 ESM 解析器：让 --experimental-strip-types 能解析 .ts 文件的无扩展名 import。
 *
 * Node 的 strip-types 不会做模块解析重写，所以 `import "./chan/maotai-2026"`（TS 惯例，无扩展名）
 * 在 Node 里找不到模块。这个 resolver 把以 .ts 存在的无扩展名 specifiers 补上 .ts 扩展名。
 *
 * 仅作用于 __fixtures__/cases/ 目录下的相对导入，不影响其他模块解析。
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CASES_DIR = fileURLToPath(
  new URL("../__fixtures__/cases/", import.meta.url),
);

export async function resolve(specifier, context, nextResolve) {
  // 只处理 cases 目录内的相对导入
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    fileURLToPath(context.parentURL).startsWith(CASES_DIR)
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const candidateTs = path.join(parentDir, `${specifier}.ts`);
    if (existsSync(candidateTs)) {
      return nextResolve(pathToFileURL(candidateTs).href, context);
    }
  }
  return nextResolve(specifier, context);
}
