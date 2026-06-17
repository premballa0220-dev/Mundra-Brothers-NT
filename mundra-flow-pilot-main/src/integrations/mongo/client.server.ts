import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;
let db: Db | undefined;

export async function getMongoDb() {
  if (db) return db;

  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "mundra";

  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: "1",
        strict: true,
        deprecationErrors: true,
      },
    });
    await client.connect();
  }

  db = client.db(MONGODB_DB_NAME);
  return db;
}
