// This is the links.test.ts file. What this file does is automatically test the link and
// auth features: creating links, redirecting through the cache, counting clicks through
// the real BullMQ worker, and registering/logging in users. It runs against a real test
// database and real Redis (not fakes), so it catches real bugs, not just typos.

import request from "supertest"; // Bring in 'supertest', used to send fake HTTP requests to our app without a real server
import { Worker } from "bullmq"; // Bring in BullMQ's 'Worker' type, just so we can type our worker variable correctly
import jwt from "jsonwebtoken"; // Bring in 'jsonwebtoken', used to create login tokens directly for test setup
import crypto from "crypto"; // Bring in Node's built-in 'crypto' tool, used to hash a fake refresh token the same way auth.ts does
import { app } from "../app"; // Bring in the actual Express app we're testing
import { pool } from "../db/pool"; // Bring in the database connection
import { redis } from "../redis/client"; // Bring in the Redis connection
import { clickQueue } from "../queues/clickQueue"; // Bring in the click queue, so we can close it cleanly when tests finish
import { migrate } from "../db/migrate"; // Bring in the function that creates/updates database tables
import { startClickWorker } from "../workers/clickWorker"; // Bring in the function that starts the background click-saving worker

let clickWorker: Worker; // A variable to hold the running worker, so we can stop it later

beforeAll(async () => { // Before any test in this file runs, do this once
  await migrate(); // Wait while we make sure the test database has all the right tables
  clickWorker = startClickWorker(); // Start the real background worker, so click jobs actually get processed during tests
  await clickWorker.waitUntilReady(); // Wait until the worker has finished connecting and is ready to work
}); // End of the one-time setup

beforeEach(async () => { // Before every single test, do this
  // One statement, not three DELETEs — a straggling BullMQ click insert from the
  // previous test can otherwise land between separate DELETEs and violate the FK.
  await pool.query("TRUNCATE TABLE clicks, links, users RESTART IDENTITY CASCADE"); // Wait while we empty these three tables and reset their auto-counting IDs back to 1

  // Clear only our cache keys — BullMQ's queue/worker share this same Redis DB,
  // and a blanket flushdb() wipes in-flight job state mid-processing, corrupting
  // the queue (surfaces as "Missing key for job N. moveToFinished").
  const slugKeys = await redis.keys("slug:*"); // Wait while we ask Redis for every key that starts with "slug:"
  if (slugKeys.length > 0) { // If we found at least one matching key
    await redis.del(...slugKeys); // Wait while we delete all of those keys, so the cache starts empty for the next test
  } // End of the cache-clearing check
}); // End of the before-every-test setup

afterAll(async () => { // After all tests in this file are done, do this once
  await clickWorker.close(); // Wait while we shut down the background worker cleanly
  await clickQueue.close(); // Wait while we shut down the queue connection cleanly
  await redis.quit(); // Wait while we disconnect from Redis cleanly
  await pool.end(); // Wait while we close all database connections cleanly
}); // End of the one-time cleanup

// The click pipeline is async (BullMQ) — poll instead of asserting immediately.
async function waitForClickCount(slug: string, expected: number, timeoutMs = 3000): Promise<number> { // Define a helper that waits for a slug's click count to reach a target number
  const start = Date.now(); // Remember what time we started waiting
  while (Date.now() - start < timeoutMs) { // Keep looping until timeoutMs (default 3000ms) has passed
    const res = await pool.query<{ count: string }>( // Wait while we ask the database how many clicks this slug has right now
      "SELECT COUNT(*) AS count FROM clicks WHERE slug = $1", // Count every row in 'clicks' matching this slug
      [slug] // Fill in $1 with the real slug value, safely
    ); // End of the count query
    const count = Number(res.rows[0].count); // Turn the count (which comes back as text) into a real number
    if (count >= expected) return count; // If we've reached the target, stop waiting and give back the count
    await new Promise((resolve) => setTimeout(resolve, 50)); // Otherwise, pause for 50 milliseconds before checking again
  } // End of the polling loop
  const res = await pool.query<{ count: string }>( // One last check after giving up waiting, so we can report the real final count
    "SELECT COUNT(*) AS count FROM clicks WHERE slug = $1", // Count every row in 'clicks' matching this slug
    [slug] // Fill in $1 with the real slug value, safely
  ); // End of the final count query
  return Number(res.rows[0].count); // Give back whatever the count actually was, even if it never reached the target
} // End of the waitForClickCount helper

// Inserts a user directly and signs a token locally instead of hitting the
// rate-limited /api/auth/register endpoint — these tests only need a valid
// authenticated user, not to re-exercise registration for every link test.
async function getAuthToken(): Promise<string> { // Define a helper that creates a test user and gives back a valid login token for them
  const email = `user_${Math.random().toString(36).slice(2)}@example.com`; // Make up a random, unique email address just for this test
  const result = await pool.query<{ id: number }>( // Wait while we insert this fake user directly into the database
    "INSERT INTO users (email, app, password_hash) VALUES ($1, $2, $3) RETURNING id", // Add a new row to 'users' and ask Postgres to hand back its id
    [email, "app1", "unused-hash"] // Fill in the email, a fixed app name, and a fake password hash (never checked in these tests)
  ); // End of the insert
  const userId = result.rows[0].id; // Grab the new user's id from the result
  return jwt.sign({ userId, app: "app1" }, process.env.JWT_SECRET!, { expiresIn: "1h" }); // Build and give back a real, valid login token for this user, same shape as auth.ts creates
} // End of the getAuthToken helper

describe("POST /api/links", () => { // Group all tests about creating a link together
  it("creates a link anonymously with no auth token, owned by nobody", async () => { // Test: creating a link without logging in should still work (login is optional)
    const res = await request(app) // Wait while we send a fake request to our app
      .post("/api/links") // Send it as a POST to '/api/links'
      .send({ url: "https://example.com" }); // With this JSON body, but no Authorization header

    expect(res.status).toBe(201); // Check that the response status code was 201 (created) — anonymous creation is allowed
    const row = await pool.query<{ user_id: number | null }>( // Wait while we look the link up directly in the database
      "SELECT user_id FROM links WHERE slug = $1", // Find the row in 'links' matching the new slug
      [res.body.slug], // Fill in $1 with the slug we just got back
    ); // End of the lookup
    expect(row.rows[0].user_id).toBeNull(); // Check that nobody owns this link, since it was created anonymously
  }); // End of the anonymous-creation test

  it("creates a short link and returns slug + short URL", async () => { // Test: a logged-in user can create a link successfully
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const res = await request(app) // Wait while we send a fake request to our app
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token in the standard "Bearer" format
      .send({ url: "https://example.com" }); // With this JSON body

    expect(res.status).toBe(201); // Check that the response status code was 201 (created)
    expect(res.body).toHaveProperty("slug"); // Check that the response body includes a 'slug' field
    expect(res.body).toHaveProperty("short"); // Check that the response body includes a 'short' field
    expect(typeof res.body.slug).toBe("string"); // Check that the slug is actually text
    expect(res.body.slug).toHaveLength(6); // Check that the slug is exactly 6 characters long
  }); // End of the successful-creation test

  it("rejects an invalid URL with 400", async () => { // Test: sending something that isn't a real URL should fail
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const res = await request(app) // Wait while we send a fake request to our app
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "not-a-url" }); // With a body containing text that is not a valid URL

    expect(res.status).toBe(400); // Check that the response status code was 400 (bad request)
  }); // End of the invalid-URL test

  it("rejects a missing URL body with 400", async () => { // Test: sending no URL at all should fail
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const res = await request(app) // Wait while we send a fake request to our app
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({}); // With a completely empty body

    expect(res.status).toBe(400); // Check that the response status code was 400 (bad request)
  }); // End of the missing-body test

  it("persists the link to the database with the owning user_id", async () => { // Test: the link is actually saved, and tagged with the correct owner
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const res = await request(app) // Wait while we send a fake request to our app
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "https://example.com" }); // With this JSON body

    const { slug } = res.body; // Pull the new slug out of the response
    const row = await pool.query<{ url: string; user_id: number }>( // Wait while we look the link up directly in the database, bypassing the API
      "SELECT url, user_id FROM links WHERE slug = $1", // Find the row in 'links' matching this slug
      [slug], // Fill in $1 with the real slug value, safely
    ); // End of the lookup
    expect(row.rows).toHaveLength(1); // Check that exactly one row was found
    expect(row.rows[0].url).toBe("https://example.com"); // Check that the saved URL matches what we sent
    expect(row.rows[0].user_id).not.toBeNull(); // Check that the link has an owner (not left blank)
  }); // End of the persistence test

  it("warms the Redis cache on creation", async () => { // Test: creating a link should immediately save it in the Redis cache too
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const res = await request(app) // Wait while we send a fake request to our app
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "https://example.com" }); // With this JSON body

    const { slug } = res.body; // Pull the new slug out of the response
    const cached = await redis.get(`slug:${slug}`); // Wait while we ask Redis directly if it has this slug cached
    expect(cached).toBe("https://example.com"); // Check that Redis already has the correct URL, without needing a redirect first
  }); // End of the cache-warming test
}); // End of the "POST /api/links" test group

describe("GET /:slug", () => { // Group all tests about visiting a short link together
  it("redirects to the original URL with 301", async () => { // Test: visiting a short link sends you to the real URL
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const createRes = await request(app) // Wait while we create a link to test with
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "https://example.com" }); // With this JSON body

    const { slug } = createRes.body; // Pull the new slug out of the response

    const res = await request(app).get(`/${slug}`); // Wait while we visit the short link itself, like a real browser would
    expect(res.status).toBe(301); // Check that the response status code was 301 (permanent redirect)
    expect(res.headers.location).toBe("https://example.com"); // Check that the redirect target is the original URL
  }); // End of the redirect test

  it("sets X-Cache: HIT on a cached slug", async () => { // Test: visiting a link that's already cached should say HIT
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const createRes = await request(app) // Wait while we create a link to test with
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "https://example.com" }); // With this JSON body

    const { slug } = createRes.body; // Pull the new slug out of the response

    const res = await request(app).get(`/${slug}`); // Wait while we visit the short link (creation already warmed the cache)
    expect(res.headers["x-cache"]).toBe("HIT"); // Check that the response header says the cache was used
  }); // End of the cache-HIT test

  it("sets X-Cache: MISS on first hit after cache eviction", async () => { // Test: if the cache entry is gone, the first visit should say MISS
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const createRes = await request(app) // Wait while we create a link to test with
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "https://example.com" }); // With this JSON body

    const { slug } = createRes.body; // Pull the new slug out of the response
    await redis.del(`slug:${slug}`); // Wait while we manually remove this slug from the Redis cache, to simulate it expiring

    const res = await request(app).get(`/${slug}`); // Wait while we visit the short link again, now that the cache is empty
    expect(res.headers["x-cache"]).toBe("MISS"); // Check that the response header says it had to fall back to the database
  }); // End of the cache-MISS test

  it("returns 404 for an unknown slug", async () => { // Test: visiting a slug that was never created should fail
    const res = await request(app).get("/doesnotexist123"); // Wait while we visit a made-up slug that was never saved
    expect(res.status).toBe(404); // Check that the response status code was 404 (not found)
  }); // End of the unknown-slug test
}); // End of the "GET /:slug" test group

describe("GET /api/links/:slug/stats", () => { // Group all tests about the click-count stats endpoint together
  it("returns 0 clicks for a new link", async () => { // Test: a brand-new link should show zero clicks
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const createRes = await request(app) // Wait while we create a link to test with
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "https://example.com" }); // With this JSON body

    const { slug } = createRes.body; // Pull the new slug out of the response
    const res = await request(app).get(`/api/links/${slug}/stats`); // Wait while we ask for this link's stats
    expect(res.status).toBe(200); // Check that the response status code was 200 (ok)
    expect(res.body.clicks).toBe(0); // Check that the click count is exactly 0, since nobody has visited it yet
  }); // End of the zero-clicks test
  it("returns 404 for a slug that does not exist", async () => { // Test: asking for stats on a made-up slug should fail
    const res = await request(app).get("/api/links/fakeslug/stats"); // Wait while we ask for stats on a slug that was never created
    expect(res.status).toBe(404); // Check that the response status code was 404 (not found)
  }); // End of the not-found stats test

  it("counts a click after the redirect is visited (end-to-end through the BullMQ worker)", async () => { // Test: a real visit should end up as a real row in the clicks table
    const token = await getAuthToken(); // Wait while we create a fake logged-in user and get their token
    const createRes = await request(app) // Wait while we create a link to test with
      .post("/api/links") // Send it as a POST to '/api/links'
      .set("Authorization", `Bearer ${token}`) // Attach the login token
      .send({ url: "https://example.com" }); // With this JSON body

    const { slug } = createRes.body; // Pull the new slug out of the response
    await request(app).get(`/${slug}`); // Wait while we visit the short link, which should queue a click job in the background

    const count = await waitForClickCount(slug, 1); // Wait (polling) until the click count reaches 1, since the worker processes it asynchronously
    expect(count).toBe(1); // Check that exactly one click was recorded

    const res = await request(app).get(`/api/links/${slug}/stats`); // Wait while we ask the stats endpoint for the same count
    expect(res.body.clicks).toBe(1); // Check that the stats endpoint also reports 1 click
  }); // End of the end-to-end click-count test
}); // End of the "GET /api/links/:slug/stats" test group

describe("POST /api/auth/register", () => { // Group all tests about registering a new account together
  it("registers a new user and returns a token", async () => { // Test: registering with fresh details should succeed
    const createRes = await request(app) // Wait while we send a fake request to our app
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" }); // With a brand-new email, password, and app name
    expect(createRes.status).toBe(201); // Check that the response status code was 201 (created)
    expect(createRes.body).toHaveProperty("token"); // Check that the response body includes a login token
  }); // End of the successful-registration test
  it("registers with same email for same app", async () => { // Test: registering the same email twice for the same app should fail the second time
    const createRes = await request(app) // Wait while we register the user the first time
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" }); // With this email/password/app

    const createRes2 = await request(app) // Wait while we try to register the exact same email again
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" }); // With the same email/password/app as before
    expect(createRes2.status).toBe(409); // Check that the second attempt's status code was 409 (conflict)
    expect(createRes2.body.error).toBe('email already registered for this app'); // Check that the error message explains why
  }); // End of the duplicate-registration test
}); // End of the "POST /api/auth/register" test group

describe("POST /api/auth/login", () => { // Group all tests about logging in together
  it("logs in and returns a token", async () => { // Test: logging in with correct details should succeed
    const createRes = await request(app) // Wait while we register a user first, so we have someone to log in as
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" }); // With this email/password/app
    const createRes2 = await request(app) // Wait while we try logging in with the same details
      .post("/api/auth/login") // Send it as a POST to '/api/auth/login'
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" }); // Using the exact same email/password/app
    expect(createRes2.status).toBe(200); // Check that the login response status code was 200 (ok)
    expect(createRes2.body).toHaveProperty("token"); // Check that the login response includes a token
  }); // End of the successful-login test

  it("log in with wrong password", async () => { // Test: logging in with the wrong password should fail
    const createRes = await request(app) // Wait while we register a user first, so we have someone to log in as
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "abc@gmail.com", password: "12345678", app: "app1" }); // With this email/password/app
    const createRes2 = await request(app) // Wait while we try logging in with a wrong password
      .post("/api/auth/login") // Send it as a POST to '/api/auth/login'
      .send({ email: "abc@gmail.com", password: "234354543545", app: "app1" }); // Same email/app, but a different, wrong password
    expect(createRes2.status).toBe(401); // Check that the response status code was 401 (not allowed)
    expect(createRes2.body.error).toBe("invalid credentials"); // Check that the error message doesn't reveal which part was wrong
  }); // End of the wrong-password test
}); // End of the "POST /api/auth/login" test group

describe("POST /api/auth/refresh", () => { // Group all tests about refreshing tokens together
  it("exchanges a valid refresh token for a new token pair", async () => { // Test: a fresh, unused refresh token should work
    const registerRes = await request(app) // Wait while we register a new user
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "refresh1@example.com", password: "12345678", app: "app1" }); // With a brand-new email, password, and app name
    const { refreshToken } = registerRes.body; // Pull the refresh token out of the registration response

    const res = await request(app) // Wait while we try to use it to get a new token pair
      .post("/api/auth/refresh") // Send it as a POST to '/api/auth/refresh'
      .send({ refreshToken }); // With the refresh token we just got

    expect(res.status).toBe(200); // Check that the response status code was 200 (ok)
    expect(res.body).toHaveProperty("token"); // Check that a new access token came back
    expect(res.body).toHaveProperty("refreshToken"); // Check that a new refresh token came back too
    expect(res.body.refreshToken).not.toBe(refreshToken); // Check that the new refresh token is different from the old one (rotation happened)
  }); // End of the successful-refresh test

  it("rejects a refresh token that was already rotated out", async () => { // Test: reusing a spent refresh token should fail
    const registerRes = await request(app) // Wait while we register a new user
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "refresh2@example.com", password: "12345678", app: "app1" }); // With a brand-new email, password, and app name
    const { refreshToken } = registerRes.body; // Pull the original refresh token out of the registration response

    await request(app).post("/api/auth/refresh").send({ refreshToken }); // Wait while we use it once, which rotates it out

    const res = await request(app) // Wait while we try to use the exact same, now-spent token again
      .post("/api/auth/refresh") // Send it as a POST to '/api/auth/refresh'
      .send({ refreshToken }); // With the same, already-used refresh token

    expect(res.status).toBe(401); // Check that the response status code was 401 (not allowed)
    expect(res.body.error).toBe("refresh token already used"); // Check that the error explains this was a reuse, not just an unknown token
  }); // End of the reuse-rejection test

  it("rejects a refresh token that was never issued", async () => { // Test: a made-up refresh token should fail
    const res = await request(app) // Wait while we try to refresh using a completely made-up token
      .post("/api/auth/refresh") // Send it as a POST to '/api/auth/refresh'
      .send({ refreshToken: "not-a-real-token" }); // With text that was never actually issued to anyone

    expect(res.status).toBe(401); // Check that the response status code was 401 (not allowed)
    expect(res.body.error).toBe("invalid refresh token"); // Check that the error explains the token is unknown
  }); // End of the invalid-token test

  it("rejects a refresh token that has expired", async () => { // Test: an old, expired refresh token should fail even though it was never used
    await request(app) // Wait while we register a new user
      .post("/api/auth/register") // Send it as a POST to '/api/auth/register'
      .send({ email: "refresh3@example.com", password: "12345678", app: "app1" }); // With a brand-new email, password, and app name
    const userRow = await pool.query<{ id: number }>("SELECT id FROM users WHERE email = $1", ["refresh3@example.com"]); // Wait while we look up this new user's id directly in the database
    const userId = userRow.rows[0].id; // Pull the id out of the lookup result

    const rawToken = "expired-test-token"; // Make up a raw token's text, just for this test
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex"); // Hash it the exact same way auth.ts does, so the refresh route's lookup will find it
    await pool.query( // Wait while we insert an already-expired refresh token directly into the database
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() - INTERVAL '1 day')", // Add a row whose expiry was set to 1 day ago
      [userId, tokenHash] // Fill in the owner and the hash, safely
    ); // End of the insert

    const res = await request(app) // Wait while we try to refresh using this expired token
      .post("/api/auth/refresh") // Send it as a POST to '/api/auth/refresh'
      .send({ refreshToken: rawToken }); // With the raw (un-hashed) token text, same as a real client would send

    expect(res.status).toBe(401); // Check that the response status code was 401 (not allowed)
    expect(res.body.error).toBe("refresh token expired"); // Check that the error explains it's expired, not just unknown
  }); // End of the expired-token test
}); // End of the "POST /api/auth/refresh" test group
