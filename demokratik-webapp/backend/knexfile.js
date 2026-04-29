import path from "node:path";

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "../data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "db.sqlite");

export default {
  client: "sqlite3",
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true,
  migrations: {
    directory: "./migrations"
  }
};
