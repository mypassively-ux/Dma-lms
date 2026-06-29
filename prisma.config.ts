import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(process.env.MYSQL_DATABASE_URL ? {
    datasource: { url: process.env.MYSQL_DATABASE_URL }
  } : {}),
});
