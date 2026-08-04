import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Offline digest verification for the pinned realtime-subscription contract
 * fixtures.
 *
 * The owning backend change (`integrate-production-realtime-subscription-lifecycle`
 * task 1.4) froze OpenAPI envelopes, examples, the expected-error table and the
 * state table, each with a sibling `.sha256` sidecar. This frontend change pins
 * byte-for-byte copies under `__fixtures__/contracts/realtime-subscriptions/`.
 *
 * Both the fixture and its sidecar are first-class inputs here: a one-sided edit
 * (changing either the fixture content OR the digest value) must fail this test.
 * Any field/enum/nullability/error-code change must land in the owning OpenSpec
 * change first, then both sides are refreshed together.
 */
const FIXTURE_DIR = join(
  __dirname,
  "..",
  "__fixtures__",
  "contracts",
  "realtime-subscriptions"
);

const PINNED_CONTRACT_FILES = [
  "openapi.yaml",
  "fixtures.json",
  "state-table.md",
  "error-codes.md",
] as const;

const readSidecarDigest = (file: string): string => {
  const raw = readFileSync(join(FIXTURE_DIR, `${file}.sha256`), "utf8").trim();
  // Sidecar is in `shasum` format: "<digest>  <filename>" (two-space separator,
  // optional binary marker `*`). Accept a bare digest as a fallback.
  const match = raw.match(/^([0-9a-f]{64})(?:\s+\*?[^*\s]+)?$/i);
  if (!match) {
    throw new Error(`sidecar for ${file} is not a valid sha256 digest line`);
  }
  return match[1];
};

const computeDigest = (file: string): string => {
  const buffer = readFileSync(join(FIXTURE_DIR, file));
  return createHash("sha256").update(buffer).digest("hex");
};

describe("pinned realtime-subscription contract fixtures", () => {
  it.each(PINNED_CONTRACT_FILES)(
    "%s matches its pinned .sha256 sidecar (one-sided edits must fail)",
    (file) => {
      const expected = readSidecarDigest(file);
      const actual = computeDigest(file);
      expect(actual).toBe(expected);
      expect(expected).toMatch(/^[0-9a-f]{64}$/i);
    }
  );

  it("exposes every expected pinned fixture file", () => {
    // Guards against an accidental rename or deletion silently weakening the
    // contract gate. Missing files throw on read above, but this makes the
    // intent explicit and keeps the failure message readable.
    for (const file of PINNED_CONTRACT_FILES) {
      expect(() => readFileSync(join(FIXTURE_DIR, file))).not.toThrow();
      expect(() => readFileSync(join(FIXTURE_DIR, `${file}.sha256`))).not.toThrow();
    }
  });
});
