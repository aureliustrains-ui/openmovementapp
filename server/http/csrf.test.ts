import test from "node:test";
import assert from "node:assert/strict";
import { enforceSameOriginForApi } from "./csrf";

type MockRes = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockRes;
  json: (payload: unknown) => MockRes;
};

function createMockRes(): MockRes {
  return {
    statusCode: 200,
    body: null,
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

test("enforceSameOriginForApi allows safe methods", () => {
  const req = {
    method: "GET",
    path: "/api/users",
    get: () => undefined,
  };
  const res = createMockRes();
  let called = false;

  enforceSameOriginForApi(req as never, res as never, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test("enforceSameOriginForApi blocks cross-origin mutating calls", () => {
  const req = {
    method: "POST",
    path: "/api/messages",
    get: (name: string) => {
      if (name.toLowerCase() === "origin") return "https://attacker.example";
      if (name.toLowerCase() === "host") return "localhost:5000";
      return undefined;
    },
  };
  const res = createMockRes();
  let called = false;

  enforceSameOriginForApi(req as never, res as never, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: "Forbidden origin" });
});

test("enforceSameOriginForApi allows same-origin mutating calls", () => {
  const req = {
    method: "POST",
    path: "/api/messages",
    get: (name: string) => {
      if (name.toLowerCase() === "origin") return "http://localhost:5000";
      if (name.toLowerCase() === "host") return "localhost:5000";
      return undefined;
    },
  };
  const res = createMockRes();
  let called = false;

  enforceSameOriginForApi(req as never, res as never, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

