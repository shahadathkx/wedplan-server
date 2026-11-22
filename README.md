# WedPlan Server

## Name and description

**WedPlan Server** is the Express API for WedPlan, a role-based wedding planning
platform that connects couples with wedding vendors and provides administration
tools for platform staff.

## Live application

- **Live API:** [https://your-api-domain.example](https://your-api-domain.example)
- **Client application:** [https://your-client-domain.example](https://your-client-domain.example)

Replace these example links with the deployed application URLs.

## Repositories

- **Server:** [wedplan-server](https://github.com/shahadathkx/wedplan-server)
- **Client:** [wedplan-client](https://github.com/shahadathkx/wedplan-client)

## Features

- Public service discovery with category, location, search, price sorting, and
  pagination.
- Vendor service management, moderation status, availability limits, booking
  management, dashboard stats, and Premium checkout.
- Customer booking creation, history, cancellation, and dashboard stats.
- Admin service moderation, platform stats, searchable and filterable user
  management, block/unblock actions, and transaction history joined with vendor
  information.
- Better Auth JWT verification against the client JWKS; roles and blocked status
  are loaded from MongoDB and never trusted from client claims.
- Stripe subscription webhooks with signature verification and idempotent
  transaction records.
- Consistent JSON errors and role-protected API routes.

## Stack

- Node.js 20+
- Express 5 and TypeScript
- MongoDB native driver
- Better Auth JWT verification with `jose`
- Stripe
- Zod validation

## Installation

Requirements: Node.js 20 or newer, npm, MongoDB, and the Stripe CLI for local
webhook testing.

```powershell
git clone https://github.com/shahadathkx/wedplan-server.git
cd wedplan-server
npm install
Copy-Item .env.example .env
```

Fill in the environment variables in `.env` before starting the API.

## Run locally

Start MongoDB and the WedPlan client first. From the server repository:

```powershell
npm run dev
```

The API listens on port `5000` by default. `GET /health` is the health check.
MongoDB indexes are created when the application connects.

To create the initial admin account and password credential, set `ADMIN_NAME`,
`ADMIN_EMAIL`, and `ADMIN_PASSWORD` and run:

```powershell
npm run seed:admin
```

The command creates an admin only when the email is unused; it never elevates an
existing non-admin user.

Other useful commands:

```powershell
npm test
npm run build
npm start
```

## Environment variables

Set secrets in your local `.env` or deployment secret manager. Do not commit
`.env` or paste real secret values into documentation.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `5000` |
| `MONGODB_URI` | Yes | MongoDB connection URI |
| `DB_NAME` | Yes | MongoDB database name |
| `CLIENT_URL` | Yes | Exact client origin allowed by CORS, such as `https://<client-domain>` |
| `JWKS_URL` | Yes | Client Better Auth JWKS endpoint, such as `https://<client-domain>/api/auth/jwks` |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret for the configured Stripe webhook endpoint |
| `STRIPE_PRICE_ID` | Yes | Stripe Premium recurring price ID |
| `ADMIN_NAME` | Seed only | Name for the initial admin user |
| `ADMIN_EMAIL` | Seed only | Email for the initial admin user |
| `ADMIN_PASSWORD` | Seed only | Admin password; at least 6 characters with uppercase and lowercase letters |

### Required production URLs

- Set `CLIENT_URL` to
  `https://wedplan-client-eight.vercel.app` (origin only).
- Set `JWKS_URL` to
  `https://wedplan-client-eight.vercel.app/api/auth/jwks`.
- Set the client app's `NEXT_PUBLIC_API_URL` to
  `https://wedplan-server-skhe.vercel.app`.
- Register the deployed server's `/api/webhooks/stripe` endpoint with Stripe.
- Set server runtime variables in this **server** Vercel project's Settings.
  `MONGODB_URI`, `DB_NAME`, `CLIENT_URL`, `JWKS_URL`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` are required. `PORT` is
  optional and unnecessary on Vercel. `ADMIN_NAME`, `ADMIN_EMAIL`, and
  `ADMIN_PASSWORD` are only needed when running `npm run seed:admin`.

  The server validates database, JWT, and Stripe settings when each feature uses
  them, rather than crashing the serverless function during startup. `/health`
  does not require database or Stripe settings; service endpoints require
  `MONGODB_URI` and `DB_NAME`.

## Stripe webhook setup

The server handles verified `checkout.session.completed`, `invoice.paid`,
`customer.subscription.deleted`, and `customer.subscription.updated` events.
Premium access is changed only by these verified webhook events.
Successful Checkout returns to `/payment-success`; cancelled Checkout returns
to `/payment-cancel`. The client confirms Premium by polling `/api/me`.

For local development, install and authenticate the
[Stripe CLI](https://docs.stripe.com/stripe-cli), then run:

```powershell
stripe listen --events checkout.session.completed,invoice.paid,customer.subscription.deleted,customer.subscription.updated --forward-to localhost:5000/api/webhooks/stripe
```

The CLI prints a local webhook signing secret. Put that value in
`STRIPE_WEBHOOK_SECRET` in `.env`, restart the server, and keep `stripe listen`
running while testing checkout. Use your Stripe test-mode secret and recurring
Premium price ID for local testing.

## API overview

- Public services: `GET /api/services`, `GET /api/services/featured`, and
  `GET /api/services/:id`.
- Authenticated profile: `GET|PATCH /api/me`; profile updates accept only
  `name`, `image`, and `businessName`.
- Vendor: `/api/vendor/services`, `/api/vendor/bookings`,
  `GET /api/vendor/stats`, and `POST /api/payments/checkout`.
- Customer: `/api/bookings`, `/api/customer/bookings`, and
  `GET /api/customer/stats`.
- Admin: `/api/admin/stats`, `/api/admin/users`, `/api/admin/users/:id`,
  `/api/admin/users/:id/block`, `/api/admin/services`, and
  `/api/admin/transactions`. Paid revenue statistics are grouped by currency.
- Stripe webhook: `POST /api/webhooks/stripe` (raw request body; no JWT).

Protected requests use `Authorization: Bearer <jwt>`. Errors use
`{ "message": "..." }`.

## Deployment

Vercel auto-detects the root `index.ts` CommonJS export as the Express
application entry point. No custom build or rewrite rules are required; the app
connects to MongoDB on demand and reuses the connection within a warm function
instance.

1. Import the `wedplan-server` repository into Vercel.
2. Set `MONGODB_URI`, `DB_NAME`, `CLIENT_URL`,
   `JWKS_URL=https://wedplan-client-eight.vercel.app/api/auth/jwks`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID`. Set
   `CLIENT_URL=https://wedplan-client-eight.vercel.app`. Add `ADMIN_NAME` and
   `ADMIN_EMAIL` only if you will run the seed script locally against the
   production database.
3. Deploy. The rewrite in `vercel.json` forwards API paths to the Express
   function.
4. Configure Stripe to send the required events to
   `https://<your-api-domain>/api/webhooks/stripe`; set its endpoint signing
   secret as `STRIPE_WEBHOOK_SECRET`.
5. Set the client app's API base URL to `https://<your-api-domain>` and verify
   `CLIENT_URL` and `JWKS_URL` point to the deployed client.

For a traditional Node host instead, build with `npm run build`, set the same
environment variables, and run `npm start`; the HTTP server listens on
`PORT` (default `5000`).
