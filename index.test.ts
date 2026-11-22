import assert from "node:assert/strict";
import test from "node:test";
import type { Application } from "express";

import handler from "./src/index";

test("Vercel Express entry exports the app as a handler", () => {
  assert.equal(typeof handler, "function");
  assert.equal(typeof handler.listen, "function");
});

test("Vercel Express entry serves the landing page and health route", async () => {
  const server = handler.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const home = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("content-type")?.includes("text/html"), true);
    assert.match(await home.text(), /WEDPLAN-SERVER/);

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
