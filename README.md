# StudioSpace — Backend API

Express 5 + TypeScript + MongoDB API for the StudioSpace creative workspace marketplace.

## Features
- Studio discovery, details, featured studios and owner-only CRUD.
- Better Auth JWT/JWKS verification through an HttpOnly session cookie.
- Booking requests, status management and confirmed-slot collision prevention.
- Wishlist persistence and newsletter subscriptions.
- MongoDB indexes, request validation, Helmet, CORS and rate limiting.

## Local setup
1. Copy `.env.example` to `.env` and configure `MONGODB_URI`, `MONGODB_DB`, `AUTH_BASE_URL`, and `CLIENT_ORIGIN`.
2. Run `npm install`.
3. Run `npm run dev`.

## Build and test
- `npm run build`
- `npm test`

## Deployment
Use the repository root as the service root, Node.js 22, build command `npm install && npm run build`, and start command `npm start`. Configure the environment variables from `.env.example` in the hosting dashboard. Do not commit `.env` or production credentials.

Health check: `GET /health`.
