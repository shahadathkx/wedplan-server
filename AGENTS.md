PROJECT: WedPlan — role-based wedding planning platform (Customer, Vendor, Admin).
REPOS: wedplan-client (Next.js App Router + TypeScript + ShadCN + Tailwind + Motion + Better Auth) and wedplan-server (Express + TypeScript + MongoDB native driver + Stripe).

ARCHITECTURE DECISIONS (follow exactly):
- Better Auth runs inside the Next.js client app with the MongoDB adapter and the JWT plugin. Google OAuth + email/password.
- Express never trusts the client for roles. It verifies the Better Auth JWT (jose + the JWKS from the client app), then loads the user from the `user` collection and uses THAT role/isBlocked/subscription data.
- Roles: customer | vendor | admin. Signup may only choose customer or vendor (reject anything else server-side). Admin is created only by a seed script (`npm run seed:admin`) using env vars. Users can never change role, isBlocked, or subscription fields via profile update.
- Client sends `Authorization: Bearer <jwt>` to Express. Express CORS allows only CLIENT_URL.
- Image uploads go through a Next.js route handler (`/api/upload`) that calls ImgBB with IMGBB_API_KEY server-side. The key is never exposed to the browser.
- Stripe: Checkout Session in subscription mode (Premium). Premium is activated ONLY by verified webhook events (checkout.session.completed, invoice.paid, customer.subscription.deleted/updated) using the raw body + signature check. The success page never grants anything; it only polls /api/me.
- Collections: Better Auth's `user` (extra fields: role, isBlocked, businessName, subscriptionPlan 'free'|'premium', subscriptionExpiresAt), plus `services`, `bookings`, `transactions`. No other collections.
- services: vendorId, serviceName, category, description, price, location, images[], status 'pending'|'approved'|'rejected', isAvailable (bool), createdAt.
  Public visibility = status 'approved' AND isAvailable true.
  Free vendors: max 3 non-rejected available services. Premium: unlimited.
- bookings: serviceId, vendorId, customerId, eventDate, eventLocation, message, status 'pending'|'accepted'|'rejected'|'cancelled', createdAt.
  Rules: no self-booking, no admin booking, only public-visible services, no duplicate active (pending/accepted) booking for the same customer + service + eventDate; only pending can be accepted/rejected/cancelled; ownership checked on every update.
- transactions: vendorId, plan, amount, currency, stripeSessionId (unique, idempotent), stripeSubscriptionId, status, createdAt. Written only by the webhook; no endpoint can edit them.
- Categories: Photography & Videography, Wedding Venues, Decoration & Florist, Catering Services, Makeup & Styling, Wedding Fashion.

API CONTRACT (server implements, client consumes):
Public: GET /api/services?q&category&location&sort=price_asc|price_desc&page&limit · GET /api/services/featured · GET /api/services/:id (400 on invalid id, 404 if not public)
Any auth: GET /api/me · PATCH /api/me (name, image, businessName only)
Vendor: GET|POST /api/vendor/services · PATCH|DELETE /api/vendor/services/:id · PATCH /api/vendor/services/:id/availability · GET /api/vendor/bookings · PATCH /api/vendor/bookings/:id {action:'accept'|'reject'} · GET /api/vendor/stats · POST /api/payments/checkout
Customer: POST /api/bookings · GET /api/customer/bookings · PATCH /api/customer/bookings/:id/cancel · GET /api/customer/stats
Admin: GET /api/admin/stats · GET /api/admin/users?q&role · GET /api/admin/users/:id · PATCH /api/admin/users/:id/block {isBlocked} · GET /api/admin/services?q&status · PATCH /api/admin/services/:id/status · DELETE /api/admin/services/:id · GET /api/admin/transactions
Webhook: POST /api/webhooks/stripe (raw body, no JWT)
Errors: consistent JSON {message}; 400 validation, 401 missing/invalid/expired token, 403 wrong role or blocked, 404 missing record.

NON-NEGOTIABLES: all secrets in env vars, commit a `.env.example`, never commit `.env`. Fully responsive, toast notifications (no alert()), loading/empty/error states, no reload/404/CORS issues on production routes, README with all required sections.

GIT RULE: after each logical unit of work, make a small commit with a descriptive message (e.g. "feat: add JWT verification middleware with JWKS"). Never a vague message. Aim for many small meaningful commits (server ≥12, client ≥20).
