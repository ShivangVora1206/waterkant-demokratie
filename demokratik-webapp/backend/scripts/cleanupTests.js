import { getDb } from '../src/db.js';

async function cleanup() {
  const db = getDb();
  try {
    console.log("Cleaning up test responses and sessions...");
    await db('responses').del();
    await db('session_todos').del();
    await db('sessions').del();
    console.log("Successfully cleared test data. Database is ready for production.");
  } catch (error) {
    console.error("Error cleaning up:", error);
  } finally {
    process.exit(0);
  }
}

cleanup();
