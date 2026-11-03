import { MongoClient, Db } from "mongodb";

let client: MongoClient | undefined;
let database: Db | undefined;

export async function getDb(): Promise<Db> {
  if (database) return database;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured on the API server.");

  client ??= new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  database = client.db(process.env.MONGODB_DB || "studiospace");

  await Promise.all([
    database.collection("studios").createIndex({ createdAt: -1 }, { name: "studios_createdAt_desc" }),
    database.collection("studios").createIndex({ category: 1, location: 1 }, { name: "studios_category_location" }),
    database.collection("studios").createIndex({ ownerEmail: 1 }, { name: "studios_ownerEmail" }),
    database.collection("bookings").createIndex({ studioId: 1, date: 1, status: 1, startTime: 1, endTime: 1 }, { name: "bookings_studio_date_status_time" }),
    database.collection("bookings").createIndex({ customerEmail: 1, createdAt: -1 }, { name: "bookings_customer_createdAt" }),
    database.collection("bookings").createIndex({ ownerEmail: 1, createdAt: -1 }, { name: "bookings_owner_createdAt" }),
    database.collection("bookingLocks").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection("wishlists").createIndex({ userEmail: 1 }, { unique: true }),
    database.collection("newsletters").createIndex({ email: 1 }, { unique: true }),
  ]);

  return database;
}