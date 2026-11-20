# WedPlan Server

The WedPlan server is the Express and TypeScript API for the WedPlan wedding
planning platform. It uses MongoDB's native driver and verifies Better Auth JWTs
issued by the client application.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB
- A running WedPlan client application that exposes a JWKS endpoint

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set the required values.
3. Start the API in development with `npm run dev`.

The API connects to MongoDB and creates the required collection indexes before
it starts listening.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (defaults to `5000`) |
| `MONGODB_URI` | MongoDB connection URI |
| `DB_NAME` | MongoDB database name |
| `CLIENT_URL` | Allowed client origin for CORS |
| `JWKS_URL` | Better Auth JSON Web Key Set endpoint |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe Premium subscription price ID |
| `ADMIN_NAME` | Name for the initial seeded admin; used only by the seed command |
| `ADMIN_EMAIL` | Email for the initial seeded admin; used only by the seed command |

The server validates its runtime configuration at startup. The admin seed
command validates its MongoDB and admin-specific variables independently.
Never commit `.env`; `.env.example` contains placeholders only.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the TypeScript server with watch mode |
| `npm run build` | Type-check and compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run seed:admin` | Create the first admin user, without elevating an existing non-admin |
| `npm test` | Run service validation and access-rule unit tests |

## API

- `GET /health` returns `{ "status": "ok" }`.
- `GET /api/services` lists public services with name, category, location,
  price sorting, and bounded pagination filters.
- `GET /api/services/featured` lists up to six recently created public services.
- `GET /api/services/:id` returns a public service; invalid IDs return 400 and
  missing or non-public services return 404.
- Vendors can list/create/update/delete their services at
  `/api/vendor/services`; `PATCH /:id/availability` toggles availability.
- New vendor services start with `pending` moderation status. Free vendors may
  have at most three non-rejected available services; the limit is checked on
  creation and when enabling availability.
- Admins can filter services at `/api/admin/services`, change status with
  `PATCH /:id/status`, and delete services with `DELETE /:id`.
- Service bodies, filters, status values, and MongoDB ObjectIds are validated
  server-side. Service text searches are treated literally.
- Unknown routes return a JSON 404 response.
- Errors use the `{ "message": "..." }` response shape.

The API includes MongoDB connection/index setup, authentication middleware, and
shared error handling.

## Authentication and authorization

Protected routes should use `verifyJwt` before `requireRole(...)`. The server
verifies the bearer token against the client JWKS, then loads the user from the
MongoDB `user` collection. Authorization uses the database user's role and
blocked status, never role claims supplied by the client.

The admin seed is idempotent for an existing admin email. It refuses to promote
an existing non-admin user.

## Project structure

```text
src/
  controllers/
  lib/
  middleware/
  routes/
  app.ts
  server.ts
scripts/
  seed-admin.ts
```

## Deployment

Set all runtime environment variables in the deployment platform, build with
`npm run build`, and start with `npm start`. Configure `CLIENT_URL` to the exact
production client origin and `JWKS_URL` to the client application's production
JWKS endpoint. Provide Stripe secrets through the platform's secret manager.
