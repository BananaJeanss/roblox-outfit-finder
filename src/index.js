import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import Bottleneck from "bottleneck";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// setup cache
const cacheTime = 60 * 5; // cache responses for 5m
const cache = new NodeCache({ stdTTL: cacheTime });

// throttler setup
const limiter = new Bottleneck({
  reservoir: 1,
  reservoirRefreshAmount: 1,
  reservoirRefreshInterval: 4000,
  minTime: 4000,
  maxConcurrent: 1,
});
const limitedFetch = limiter.wrap(fetch);

// security middleware/helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xPoweredBy: false,
  })
);

// serve static files from public folder
app.use(
  express.static(join(__dirname, "public"), { maxAge: "30m", etag: false })
);

// exponential backoff fetch util
async function doFetch(
  url,
  opts = {},
  retries = 3, // retry up to 3 times
  backoff = 7000, // initial backoff in ms
  maxBackoff = 25000 // max backoff in ms
) {
  const resp = await limitedFetch(url, opts);
  if (resp.status === 429 && retries > 0) {
    const ra = resp.headers.get("retry-after");
    // respect Retry-After or fall back to jittered backoff
    const baseWait = ra
      ? parseInt(ra, 10) * 1000
      : Math.min(backoff, maxBackoff);
    // equal jitter
    const maxWait = Math.min(baseWait * 2, maxBackoff);
    const wait = baseWait + Math.random() * (maxWait - baseWait);
    console.warn(
      `Rate limited. Retrying in ${Math.round(wait / 1000)} seconds...`
    );
    await new Promise((r) => setTimeout(r, wait));
    return doFetch(url, opts, retries - 1, backoff * 2, maxBackoff);
  }
  return resp;
}

app.get("/api/user/:username", async (req, res) => {
  let { username } = req.params;

  // normalize username input
  username = username.replace(/@/g, "").trim();
  username = username.toLowerCase();

  if (!username || typeof username !== "string" || username.length > 25) {
    return res.status(400).json({ error: "Invalid username provided" });
  }

  // Support id:12345 format to bypass username to id lookup
  let userId = null;
  if (username.startsWith("id:")) {
    userId = username.slice(3);
  }

  if (userId) {
    console.log(`Fetching outfits for id: ${userId}`);
  } else {
    console.log(`Fetching outfits for username: ${username}`);
  }

  const cacheKey = userId ? `user:${userId}` : `user:${username}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let user;
    if (userId) {
      // Fetch user info by ID
      const userResp = await doFetch(
        `https://users.roblox.com/v1/users/${userId}`
      );
      const userData = await userResp.json();
      if (!userResp.ok || !userData.id) {
        return res
          .status(userResp.ok ? 404 : userResp.status)
          .json({ error: userData.error || "User not found" });
      }
      user = {
        id: userData.id,
        name: userData.name,
        displayName: userData.displayName,
        created: userData.created,
      };
    } else {
      // Username lookup
      const lookupResp = await doFetch(
        "https://users.roblox.com/v1/usernames/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: true,
          }),
        }
      );
      const lookupData = (await lookupResp.json()).data?.[0];
      if (!lookupResp.ok || !lookupData) {
        return res
          .status(lookupResp.ok ? 404 : lookupResp.status)
          .json({ error: "User not found" });
      }

      // fetch user details
      const detailResp = await doFetch(
        `https://users.roblox.com/v1/users/${lookupData.id}`
      );
      const detailData = await detailResp.json();

      user = {
        id: detailData.id,
        name: detailData.name,
        displayName: detailData.displayName,
        created: detailData.created,
      };
    }

    // fetch user headshot
    try {
      const headRes = await doFetch(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=100x100&format=png&isCircular=true`
      );
      const headJson = await headRes.json();
      user.headshotUrl = headJson.data?.[0]?.imageUrl || null;
    } catch {
      user.headshotUrl = null;
    }

    // fetch outfits
    const outfitsResp = await doFetch(
      `https://avatar.roblox.com/v1/users/${user.id}/outfits?page=1&itemsPerPage=100`
    );
    if (!outfitsResp.ok) {
      console.warn(
        `Outfits fetch failed for user ${username}: ${outfitsResp.status}`
      );
      return res
        .status(outfitsResp.status)
        .json({ error: "Failed to fetch outfits" });
    }
    const outfitsData = await outfitsResp.json();
    // filter out isEditable=false outfits
    // these are usually roblox/catalog outfits
    const outfits = (outfitsData.data || []).filter((o) => o.isEditable);

    console.log(`Found ${outfits.length} outfits for user: ${username}`);

    // fetch thumbnails
    const outfitIds = outfits.map((o) => o.id);
    if (outfitIds.length) {
      const thumbsResp = await doFetch(
        `https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${outfitIds.join(
          ","
        )}&size=150x150&format=png&isCircular=false`
      );
      const thumbsData = await thumbsResp.json();
      const byId = new Map(thumbsData.data?.map((t) => [t.targetId, t]) || []);
      outfits.forEach((o) => {
        const t = byId.get(o.id);
        if (t?.state === "Completed") {
          o.thumbnailUrl = t.imageUrl;
          o.thumbnailState = "Completed";
        } else {
          o.thumbnailUrl = null;
          o.thumbnailState = t?.state || "NotFound";
        }
      });
    }

    // successfully fetched user and outfits at this point
    const result = { user, outfits };
    // cache under numeric ID
    cache.set(`user:${user.id}`, result);
    // cache under username
    cache.set(`user:${user.name.toLowerCase()}`, result);

    res.json(result);
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Failed to fetch outfit data" });
  }
});

app.get("*", (req, res) =>
  res.sendFile(join(__dirname, "public", "index.html"))
);

app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
