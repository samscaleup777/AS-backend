import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import studiosRouter from "./routes/studios.js";
import bookingsRouter from "./routes/bookings.js";
import wishlistRouter from "./routes/wishlist.js";
import newsletterRouter from "./routes/newsletter.js";
import adminRouter from "./routes/admin.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const helmetMiddleware = helmet as unknown as (options?: Record<string, unknown>) => express.RequestHandler;
app.use(helmetMiddleware({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",").map((x) => x.trim()),
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/", (_req, res) => res.status(200).json({
  name: "StudioSpace API",
  status: "online",
  description: "Peer-to-peer creative workspace and production studio marketplace API.",
  version: "1.0.0",
  health: "/health",
  endpoints: {
    studios: "/api/studios",
    featuredStudios: "/api/studios/featured",
    bookings: "/api/bookings",
    wishlist: "/api/wishlist",
    newsletter: "/api/newsletter",
  },
  documentation: "https://github.com/samscaleup777/AS-backend",
}));
app.get("/api", (_req, res) => res.status(200).json({
  name: "StudioSpace API",
  status: "online",
  endpoints: ["/api/studios", "/api/studios/featured", "/api/bookings", "/api/wishlist", "/api/newsletter"],
  health: "/health",
}));
app.get("/health", (_req, res) => res.json({
  status: "ok",
  service: "studiospace-api",
  time: new Date().toISOString(),
}));
app.use("/api/studios", studiosRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/admin", adminRouter);
app.use((_req, res) => res.status(404).json({ message: "API route not found." }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API error:", error instanceof Error ? error.message : "Unknown error");
  res.status(500).json({ message: "The server could not complete this request." });
});

export default app;