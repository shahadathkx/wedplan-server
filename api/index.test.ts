import assert from "node:assert/strict";
import test from "node:test";
import type { Application } from "express";

const handler: Application = require("./index");

test("Vercel entry exports the Express app as a CommonJS handler", () => {
  assert.equal(typeof handler, "function");
  assert.equal(typeof handler.listen, "function");
});
