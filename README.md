# StudioSpace — Backend API

The Express API for **StudioSpace**, a peer-to-peer creative workspace and production studio marketplace.

- **Frontend:** https://as-kappa-six.vercel.app
- **API root:** https://as-two-lac.vercel.app/
- **Health:** https://as-two-lac.vercel.app/health
- **Source repository:** https://github.com/samscaleup777/AS-backend

## Features

- Public studio directory, featured listings, studio details and review retrieval.
- Date-specific availability lookup that returns already-confirmed time windows.
- Owner-only studio create, update and delete operations with account ownership checks.
- Better Auth JWT/JWKS verification from the HttpOnly `better_auth_jwt` cookie or an Authorization Bearer token.
- Booking requests with server-calculated duration and total, Pending/Confirmed/Completed/Cancelled lifecycle and confirmed-slot overlap prevention.
- Database-backed studio/date locks to serialize host booking confirmations.
- Persistent saved-studio wishlist and newsletter subscription endpoints.
- MongoDB indexes, Zod request validation, Helmet security headers, CORS allowlist and rate limiting.

## Technology

Express 5, Node.js 22, TypeScript 5, MongoDB 6, Zod 4, jose, Helmet, CORS, cookie-parser and express-rate-limit.

## Local setup

1. Install Node.js 22.
2. Clone this repository.
3. Copy `.env.example` to `.env`.
4. Configure `MONGODB_URI`, `MONGODB_DB=studiospace`, `AUTH_BASE_URL` (the frontend origin), `CLIENT_ORIGIN` (the frontend origin), and `ADMIN_EMAILS` (a comma-separated list of approved administrator email addresses). Configure the exact same `ADMIN_EMAILS` value in the frontend auth project. Public registration always receives the `user` role; the server-issued JWT marks an account as `admin` only when its verified email is on the frontend allowlist, and this API independently checks its own allowlist. If either allowlist is missing or does not match, admin access is denied.
5. Run `npm install`.
6. Run `npm run dev` to start the API on port 4000.

## Build and tests

```bash
npm run build
npm test
npm start
```

The isolated booking-rule suite covers calendar-date validation, 24-hour time windows, overlap detection, booking duration and price calculation.

## API routes

- `GET /` — API status and endpoint directory.
- `GET /health` — health status.
- `GET /api/studios` and `GET /api/studios/featured` — public studio directory and featured listings.
- `GET /api/studios/:id` and `GET /api/studios/:id/reviews` — public details and reviews.
- `GET /api/studios/:id/availability?date=YYYY-MM-DD` — confirmed occupied time windows for a date.
- `POST /api/studios`, `PATCH /api/studios/:id`, `DELETE /api/studios/:id` — authenticated owner operations.
- `POST /api/bookings`, `GET /api/bookings/me`, `GET /api/bookings/host` and booking status endpoints — authenticated booking lifecycle.
- `GET /api/wishlist`, `POST /api/wishlist` — authenticated saved studios.
- `POST /api/newsletter` — newsletter subscription.
- `GET /api/admin/me`, `/overview`, `/users`, `/studios`, `/bookings` — administrator-only operations.
- `DELETE /api/admin/studios/:id` — administrator-only listing moderation.

## Vercel deployment

The production backend is hosted in the Vercel project named `as`, connected to this repository. Vercel detects the Express app from the default export in `src/index.ts`. Set the repository root, Node.js 22 and the environment variables shown in `.env.example`.

## Examiner test account

The assessment demo account is created in the shared StudioSpace auth database:

- Email: `examiner@studiospace.demo`
- Password: `StudioSpace!2026`

This account is for assessment only. Sign in through the frontend; protected API routes require a valid Better Auth session and its HTTPOnly JWT cookie.

Never commit `.env`, database connection strings, OAuth client secrets or private production credentials.
