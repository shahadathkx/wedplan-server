import assert from "node:assert/strict";
import test from "node:test";
import { getCheckoutReturnUrls } from "./payment-urls";

test("Stripe returns to the client payment success and cancellation pages", () => {
  assert.deepEqual(
    getCheckoutReturnUrls("https://wedplan-client-eight.vercel.app/"),
    {
      successUrl:
        "https://wedplan-client-eight.vercel.app/payment-success?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://wedplan-client-eight.vercel.app/payment-cancel",
    },
  );
});
