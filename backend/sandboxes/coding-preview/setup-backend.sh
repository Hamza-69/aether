#!/usr/bin/env bash
set -e

# ─── Args ────────────────────────────────────────────────────────────────────
PROJECT_NAME="${1:-backend}"

echo "▶ Creating project: $PROJECT_NAME"
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

# ─── package.json ────────────────────────────────────────────────────────────
npm init -y
npm pkg set name="$PROJECT_NAME"
npm pkg set type="module"
npm pkg set scripts.dev="tsx watch src/index.ts"
npm pkg set scripts.build="tsup src/index.ts --format esm --out-dir dist --no-splitting"
npm pkg set scripts.start="node dist/index.js"

# ─── Dependencies (pinned) ───────────────────────────────────────────────────
npm install --save-exact \
  express@5.2.1 \
  cors@2.8.6 \
  dotenv@17.4.1 \
  @prisma/client@7.7.0 \
  @prisma/adapter-better-sqlite3@7.6.0

npm install --save-dev --save-exact \
  typescript@6.0.2 \
  tsup@8.4.0 \
  tsx@4.21.0 \
  @types/node@22.15.21 \
  @types/express@5.0.6 \
  @types/cors@2.8.19 \
  @types/better-sqlite3@7.6.13 \
  prisma@7.7.0

# ─── tsconfig.json (ESM – required by Prisma 7) ──────────────────────────────
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "ignoreDeprecations": "6.0"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
EOF

# ─── .env ────────────────────────────────────────────────────────────────────
cat > .env <<'EOF'
DATABASE_URL="file:./dev.db"
PORT=3000
CORS_ALLOWED_ORIGINS=
EOF

# ─── .gitignore ──────────────────────────────────────────────────────────────
cat > .gitignore <<'EOF'
node_modules/
dist/
.env
*.db
src/generated/
EOF

# ─── Prisma init ─────────────────────────────────────────────────────────────
# --output sets the generated client path (required in Prisma 7)
npx prisma init --datasource-provider sqlite --output ./src/generated/prisma

# Restore .env after prisma init (it may overwrite ours)
cat > .env <<'EOF'
DATABASE_URL="file:./dev.db"
PORT=3000
CORS_ALLOWED_ORIGINS=
EOF

# ─── prisma/schema.prisma – starter model ────────────────────────────────────
cat > prisma/schema.prisma <<'EOF'
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

// ── Add your models below ────────────────────────────────────────────────────
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
EOF

# ─── prisma.config.ts – required by Prisma 7 CLI ─────────────────────────────
cat > prisma.config.ts <<'EOF'
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] || "file:./dev.db",
  },
});
EOF

# ─── Run first migration ──────────────────────────────────────────────────────
npx prisma migrate dev --name init

# ─── src/lib/prisma.ts ────────────────────────────────────────────────────────
mkdir -p src/lib
cat > src/lib/prisma.ts <<'EOF'
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

export const prisma = new PrismaClient({ adapter });
EOF

# ─── src/index.ts ─────────────────────────────────────────────────────────────
cat > src/index.ts <<'EOF'
import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = process.env.PORT ?? 3000;
const previewCorsOrigin = process.env.PREVIEW_CORS_ORIGIN?.trim();
const allowedOrigins = new Set(
  [...(process.env.CORS_ALLOWED_ORIGINS ?? "").split(","), previewCorsOrigin]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "OK" });
});

// Example route – list all users
app.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
EOF
# --- generate prisma client ────────────────────────────────────────────────────
npx prisma generate
echo ""
echo "✅ Done! Project created in ./$PROJECT_NAME"
echo ""
echo "   cd $PROJECT_NAME"
echo "   npm run dev"
