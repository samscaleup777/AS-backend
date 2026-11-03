import "dotenv/config";
import app from "./app.js";

// Vercel runs api/[...path].ts as a serverless function; local/Render runs this listener.
if (process.env.VERCEL !== "1") {
  const port = Number(process.env.PORT || 4000);
  app.listen(port, "0.0.0.0", () => console.log(`StudioSpace API listening on ${port}`));
}
export default app;