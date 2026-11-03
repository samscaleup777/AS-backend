# StudioSpace — Backend API

Production API for the StudioSpace creative workspace marketplace, built with Express 5, TypeScript, MongoDB, Better Auth JWT/JWKS verification, and Zod validation.

## Features
- Public studio discovery, featured studios, detail and review reads.
- Owner-only studio create, update and delete operations.
- Better Auth JWT verification from the HttpOnly `better_auth_jwt` cookie or a Bearer token.
- Booking requests, customer/host views, booking status lifecycle and confirmed-slot collision checks.
- Database-backed short-lived studio/date lock during host confirmations.
- Saved-studio wishlist and newsletter subscription persistence.
- MongoDB indexes, Helmet security headers, CORS allowlist and rate limiting.

## Local setup
1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `MONGODB_DB`, `AUTH_BASE_URL`, and `CLIENT_ORIGIN`.
3. Run `npm install`.
4. Run `npm run dev` (default port `4000`).

## Build and tests
- `npm run build`
- `npm test`

## Vercel
Connect this repository to Vercel and use the repository root. Vercel's Express framework detection uses `src/index.ts`, which exports the Express app as the default export. Do not add an `api/` catch-all function. Set Node.js 22 and configure the environment variables from `.env.example` in the Vercel dashboard.

## Render
Use the repository root as the service root, runtime Node, build command `npm install && npm run build`, and start command `npm start`. Configure the environment variables from `.env.example` in the hosting dashboard.

Health check: `GET /health`.

Never commit `.env`, database connection strings, OAuth credentials, or production secrets.