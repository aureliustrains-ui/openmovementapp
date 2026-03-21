import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const viteConfigPath = path.resolve(serverDir, "../vite.config.ts");
const apiHelperPath = path.resolve(serverDir, "../client/src/lib/api.ts");
const routesPath = path.resolve(serverDir, "../server/routes.ts");

test("vite dev config proxies /api to backend and defaults to port 5099", () => {
  const source = fs.readFileSync(viteConfigPath, "utf8");
  assert.ok(
    source.includes(
      'const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5099";',
    ),
  );
  assert.ok(source.includes('"/api": {'));
  assert.ok(source.includes("target: apiProxyTarget"));
});

test("client API helper uses /api paths and dev fallback origin defaults to 5000", () => {
  const source = fs.readFileSync(apiHelperPath, "utf8");
  assert.ok(source.includes('return "http://localhost:5000";'));
  assert.ok(source.includes("return `${protocol}//${hostname}:5000`;"));
  assert.ok(source.includes('fetchApi("/api/client-videos/upload-url"'));
});

test("client API helper retries network failures via configured dev fallback origin", () => {
  const source = fs.readFileSync(apiHelperPath, "utf8");
  assert.ok(source.includes("const fallbackUrl = resolveDevFallbackUrl(url);"));
  assert.ok(source.includes("return await requestJson(fallbackUrl, method, options);"));
  assert.ok(source.includes("failed to reach API from"));
});

test("upload init route is mounted on backend routes", () => {
  const source = fs.readFileSync(routesPath, "utf8");
  assert.ok(source.includes('app.post("/api/client-videos/upload-url"'));
  assert.ok(source.includes("Only client accounts can upload submission videos"));
});
