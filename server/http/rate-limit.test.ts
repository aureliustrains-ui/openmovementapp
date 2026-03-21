import test from "node:test";
import assert from "node:assert/strict";
import { clearRateLimitState, createRateLimitMiddleware } from "./rate-limit";

type MockRes = {
  statusCode: number;
  headers: Map<string, string>;
  body: unknown;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
};

function createMockRes(): MockRes {
  return {
    statusCode: 200,
    headers: new Map(),
    body: null,
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

test("createRateLimitMiddleware blocks requests over the limit", () => {
  clearRateLimitState();
  const limiter = createRateLimitMiddleware({ key: "auth", windowMs: 60_000, max: 2 });
  const req = {
    ip: "127.0.0.1",
    get: () => undefined,
  };
  const res = createMockRes();

  let calls = 0;
  limiter(req as never, res as never, () => {
    calls += 1;
  });
  limiter(req as never, res as never, () => {
    calls += 1;
  });
  limiter(req as never, res as never, () => {
    calls += 1;
  });

  assert.equal(calls, 2);
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, { message: "Too many requests" });
  assert.equal(res.headers.has("Retry-After"), true);
});
