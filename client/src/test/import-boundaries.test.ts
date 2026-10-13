/**
 * Import boundaries of the `frontend-architecture` skill (R2, 2.0.0) — a small
 * client stand-in for the server's dependency-cruiser check:
 *   - `lib/` and `components/` import neither `features/` nor `app/`;
 *   - a feature imports neither another feature nor `app/`.
 * Scans every .ts/.tsx under src/ (vendor excluded), tests included.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = resolve(__dirname, "..");
const SPECIFIER = /(?:from\s+|import\s*\(\s*|vi\.mock\(\s*)["']([^"']+)["']/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (abs !== join(SRC, "vendor")) walk(abs, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(abs);
  }
  return out;
}

/** src-relative, forward-slash path of an import target; null for packages. */
function target(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith(".")) return relative(SRC, resolve(dirname(fromFile), spec)).split(sep).join("/");
  return null;
}

const layer = (p: string) => p.split("/")[0]!;
const feature = (p: string) => (p.startsWith("features/") ? p.split("/")[1]! : null);

function violations(): string[] {
  const out: string[] = [];
  for (const file of walk(SRC)) {
    const from = relative(SRC, file).split(sep).join("/");
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(SPECIFIER)) {
      const to = target(file, m[1]!);
      if (!to) continue;
      const fromLayer = layer(from);
      const toLayer = layer(to);
      if ((fromLayer === "lib" || fromLayer === "components") && (toLayer === "features" || toLayer === "app")) {
        out.push(`${from} → ${to} (${fromLayer}/ may not import ${toLayer}/)`);
      }
      if (fromLayer === "features") {
        if (toLayer === "app") out.push(`${from} → ${to} (a feature may not import app/)`);
        const a = feature(from);
        const b = feature(to);
        if (b && a !== b) out.push(`${from} → ${to} (feature ${a} may not import feature ${b})`);
      }
    }
  }
  return out;
}

describe("client import boundaries", () => {
  it("lib/, components/ and features/ respect the layer direction", () => {
    expect(violations()).toEqual([]);
  });

  it("the scan actually sees the feature folders (guards against a silent empty pass)", () => {
    const files = walk(SRC).map((f) => relative(SRC, f).split(sep).join("/"));
    expect(files.some((f) => f.startsWith("features/reviews/"))).toBe(true);
    expect(files.some((f) => f.startsWith("lib/"))).toBe(true);
  });
});
