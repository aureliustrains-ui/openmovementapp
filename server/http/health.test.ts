import test from "node:test";
import assert from "node:assert/strict";
import { createHealthHandlers } from "./health";

type MockRes = {
  statusCode: number;
  payload: unknown;
  status: (code: number) => MockRes;
  json: (body: unknown) => MockRes;
};

function buildRes(): MockRes {
  return {
    statusCode: 200,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
  };
}

test("liveness returns ok", () => {
  const handlers = createHealthHandlers({
    startedAt: Date.now() - 1200,
    checkReadiness: async () => {},
  });
  const res = buildRes();

  handlers.liveness({} as never, res as never);

  assert.equal(res.statusCode, 200);
  assert.equal((res.payload as { status: string }).status, "ok");
});

test("readiness returns degraded when dependency check fails", async () => {
  const handlers = createHealthHandlers({
    startedAt: Date.now() - 1200,
    checkReadiness: async () => {
      throw new Error("db unavailable");
    },
  });
  const res = buildRes();

  await handlers.readiness({} as never, res as never);

  assert.equal(res.statusCode, 503);
  assert.equal((res.payload as { status: string }).status, "degraded");
});
