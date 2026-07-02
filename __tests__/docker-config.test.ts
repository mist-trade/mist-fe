import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("frontend Docker image configuration", () => {
  it("builds a standalone Next.js runtime image", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("ARG NODE_IMAGE=node:24-alpine");
    expect(dockerfile).toContain("ARG NPM_REGISTRY=https://registry.npmjs.org");
    expect(dockerfile).toContain("FROM ${NODE_IMAGE} AS base");
    expect(dockerfile).toContain("npm install -g pnpm@11.7.0 --registry=${NPM_REGISTRY}");
    expect(dockerfile).toContain("pnpm config set registry ${NPM_REGISTRY}");
    expect(dockerfile).toContain("FROM base AS deps");
    expect(dockerfile).toContain(
      "pnpm install --frozen-lockfile --registry=${NPM_REGISTRY} --config.dangerouslyAllowAllBuilds=true"
    );
    expect(dockerfile).toContain("RUN pnpm build");
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain('EXPOSE 3000');
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });

  it("publishes SHA-tagged frontend images to GHCR", () => {
    const workflow = read(".github/workflows/docker.yml");

    expect(workflow).toContain("Build Frontend Docker Image");
    expect(workflow).toContain("ghcr.io/mist-trade/mist-fe");
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("${image_repository}:${GITHUB_SHA}");
    expect(workflow).toContain("${image_repository}:latest");
    expect(workflow).toContain("docker/build-push-action@v6");
    expect(workflow).toContain("validate:");
    expect(workflow).toContain("needs: validate");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm run typecheck");
    expect(workflow).toContain("pnpm run test:ci");
  });

  it("allows manual workflow builds to override Docker and npm registries", () => {
    const workflow = read(".github/workflows/docker.yml");

    expect(workflow).toContain("node_image:");
    expect(workflow).toContain("default: node:24-alpine");
    expect(workflow).toContain("npm_registry:");
    expect(workflow).toContain("default: https://registry.npmjs.org");
    expect(workflow).toContain("node_image=${node_image}");
    expect(workflow).toContain("npm_registry=${npm_registry}");
    expect(workflow).toContain("NODE_IMAGE=${{ steps.meta.outputs.node_image }}");
    expect(workflow).toContain("NPM_REGISTRY=${{ steps.meta.outputs.npm_registry }}");
  });

  it("keeps generated and local-only files out of the Docker context", () => {
    const dockerignore = read(".dockerignore");

    expect(dockerignore).toContain("node_modules");
    expect(dockerignore).toContain(".next");
    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain("*.tsbuildinfo");
  });
});
