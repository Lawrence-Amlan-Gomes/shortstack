import request from "supertest";
import { Worker } from "bullmq";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { app } from "../app";
import { pool } from "../db/pool";
import { redis } from "../redis/client";
import { clickQueue } from "../queues/clickQueue";
import { migrate } from "../db/migrate";
import { startClickWorker } from "../workers/clickWorker";

let clickWorker: Worker;

beforeAll(async () => {
  await migrate();
  clickWorker = startClickWorker();
  await clickWorker.waitUntilReady();
});

beforeEach(async () => {
  // One statement, not three DELETEs — a straggling BullMQ click insert from the
  // previous test can otherwise land between separate DELETEs and violate the FK.
  await pool.query("TRUNCATE TABLE clicks, links, users RESTART IDENTITY CASCADE");

  // Clear only our cache keys — BullMQ's queue/worker share this same Redis DB,
  // and a blanket flushdb() wipes in-flight job state mid-processing, corrupting
  // the queue (surfaces as "Missing key for job N. moveToFinished").
  const slugKeys = await redis.keys("slug:*");
  if (slugKeys.length > 0) {
    await redis.del(...slugKeys);
  }
});

afterAll(async () => {
  await clickWorker.close();
  await clickQueue.close();
  await redis.quit();
  await pool.end();
});

// The click pipeline is async (BullMQ) — poll instead of asserting immediately.
async function waitForClickCount(slug: string, expected: number, timeoutMs = 3000): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM clicks WHERE slug = $1",
      [slug]
    );
    const count = Number(res.rows[0].count);
    if (count >= expected) return count;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const res = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM clicks WHERE slug = $1",
    [slug]
  );
  return Number(res.rows[0].count);
}

// Inserts a user directly and signs a token locally instead of hitting the
// rate-limited /api/auth/register endpoint — these tests only need a valid
// authenticated user, not to re-exercise registration for every link test.
async function getAuthToken(): Promise<string> {
  const email = `user_${Math.random().toString(36).slice(2)}@example.com`;
  const result = await pool.query<{ id: number }>(
    "INSERT INTO users (email, app, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [email, "app1", "unused-hash"]
  );
  const userId = result.rows[0].id;
  return jwt.sign({ userId, app: "app1" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

describe("POST /api/links", () => {
  it("creates a link anonymously with no auth token, owned by nobody", async () => {
    const res = await request(app)
      .post("/api/links")
      .send({ url: "https://example.com" });

    expect(res.status).toBe(201);
    const row = await pool.query<{ user_id: number | null }>(
      "SELECT user_id FROM links WHERE slug = $1",
      [res.body.slug],
    );
    expect(row.rows[0].user_id).toBeNull();
  });

  it("creates a short link and returns slug + short URL", async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("slug");
    expect(res.body).toHaveProperty("short");
    expect(typeof res.body.slug).toBe("string");
    expect(res.body.slug).toHaveLength(6);
  });

  it("rejects an invalid URL with 400", async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "not-a-url" });

    expect(res.status).toBe(400);
  });

  it("rejects a missing URL body with 400", async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("persists the link to the database with the owning user_id", async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    const { slug } = res.body;
    const row = await pool.query<{ url: string; user_id: number }>(
      "SELECT url, user_id FROM links WHERE slug = $1",
      [slug],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].url).toBe("https://example.com");
    expect(row.rows[0].user_id).not.toBeNull();
  });

  it("warms the Redis cache on creation", async () => {
    const token = await getAuthToken();
    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    const { slug } = res.body;
    const cached = await redis.get(`slug:${slug}`);
    expect(cached).toBe("https://example.com");
  });
});

describe("GET /:slug", () => {
  it("redirects to the original URL with 301", async () => {
    const token = await getAuthToken();
    const createRes = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    const { slug } = createRes.body;

    const res = await request(app).get(`/${slug}`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("https://example.com");
  });

  it("sets X-Cache: HIT on a cached slug", async () => {
    const token = await getAuthToken();
    const createRes = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    const { slug } = createRes.body;

    const res = await request(app).get(`/${slug}`);
    expect(res.headers["x-cache"]).toBe("HIT");
  });

  it("sets X-Cache: MISS on first hit after cache eviction", async () => {
    const token = await getAuthToken();
    const createRes = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    const { slug } = createRes.body;
    await redis.del(`slug:${slug}`);

    const res = await request(app).get(`/${slug}`);
    expect(res.headers["x-cache"]).toBe("MISS");
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await request(app).get("/doesnotexist123");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/links/:slug/stats", () => {
  it("returns 0 clicks for a new link", async () => {
    const token = await getAuthToken();
    const createRes = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    const { slug } = createRes.body;
    const res = await request(app).get(`/api/links/${slug}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.clicks).toBe(0);
  });
  it("returns 404 for a slug that does not exist", async () => {
    const res = await request(app).get("/api/links/fakeslug/stats");
    expect(res.status).toBe(404);
  });

  it("counts a click after the redirect is visited (end-to-end through the BullMQ worker)", async () => {
    const token = await getAuthToken();
    const createRes = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    const { slug } = createRes.body;
    await request(app).get(`/${slug}`);

    const count = await waitForClickCount(slug, 1);
    expect(count).toBe(1);

    const res = await request(app).get(`/api/links/${slug}/stats`);
    expect(res.body.clicks).toBe(1);
  });
});

describe("POST /api/auth/register", () => {
  it("registers a new user and returns a token", async () => {
    const createRes = await request(app)
      .post("/api/auth/register")
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty("token");
  });
  it("registers with same email for same app", async () => {
    const createRes = await request(app)
      .post("/api/auth/register")
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" });

    const createRes2 = await request(app)
      .post("/api/auth/register")
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" });
    expect(createRes2.status).toBe(409);
    expect(createRes2.body.error).toBe('email already registered for this app');
  });
});

describe("POST /api/auth/login", () => {
  it("logs in and returns a token", async () => {
    const createRes = await request(app)
      .post("/api/auth/register")
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" });
    const createRes2 = await request(app)
      .post("/api/auth/login")
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" });
    expect(createRes2.status).toBe(200);
    expect(createRes2.body).toHaveProperty("token");
  });

  it("log in with wrong password", async () => {
    const createRes = await request(app)
      .post("/api/auth/register")
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" });
    const createRes2 = await request(app)
      .post("/api/auth/login")
      .send({ email: "abc@gmail.com", password: "234354543545", app: "app1" });
    expect(createRes2.status).toBe(401);
    expect(createRes2.body.error).toBe("invalid credentials");
  });
});

describe("POST /api/auth/refresh", () => {
  it("exchanges a valid refresh token for a new token pair", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ email: "refresh1@example.com", password: "12345678", app: "app1" });
    const { refreshToken } = registerRes.body;

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("rejects a refresh token that was already rotated out", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ email: "refresh2@example.com", password: "12345678", app: "app1" });
    const { refreshToken } = registerRes.body;

    await request(app).post("/api/auth/refresh").send({ refreshToken });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("refresh token already used");
  });

  it("rejects a refresh token that was never issued", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "not-a-real-token" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid refresh token");
  });

  it("rejects a refresh token that has expired", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "refresh3@example.com", password: "12345678", app: "app1" });
    const userRow = await pool.query<{ id: number }>("SELECT id FROM users WHERE email = $1", ["refresh3@example.com"]);
    const userId = userRow.rows[0].id;

    const rawToken = "expired-test-token";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() - INTERVAL '1 day')",
      [userId, tokenHash]
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rawToken });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("refresh token expired");
  });
});
