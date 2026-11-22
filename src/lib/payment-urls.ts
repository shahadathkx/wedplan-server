export function getCheckoutReturnUrls(clientUrl: string): {
  successUrl: string;
  cancelUrl: string;
} {
  const clientOrigin = new URL(clientUrl).origin;
  return {
    successUrl: `${clientOrigin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${clientOrigin}/payment-cancel`,
  };
}
