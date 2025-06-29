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
const cache = new NodeCache({ stdTTL: 120 }); // cache responses for 120s

// setup throttler: max 4 req/sec
const limiter = new Bottleneck({ minTime: 250, maxConcurrent: 1 });
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
  backoff = 2000, // initial backoff in ms
  maxBackoff = 16000 // max backoff in ms
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
    await new Promise((r) => setTimeout(r, wait));
    return doFetch(url, opts, retries - 1, backoff * 2, maxBackoff);
  }
  return resp;
}

app.get("/api/user/:username", async (req, res) => {
  const { username } = req.params;
  if (!username || typeof username !== "string" || username.length > 25) {
    return res.status(400).json({ error: "Invalid username provided" });
  }

  console.log(`Fetching outfits for user: ${username}`);

  const cacheKey = `user:${username}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // fetch user
    const userResp = await doFetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(
        username
      )}&limit=10`
    );
    const userData = await userResp.json();
    if (!userResp.ok || !userData.data?.length) {
      return res
        .status(userResp.ok ? 404 : userResp.status)
        .json({ error: userData.error || "User not found" });
    }
    const user = userData.data[0];

    // fetch outfits
    const outfitsResp = await doFetch(
      `https://avatar.roblox.com/v1/users/${user.id}/outfits?page=1&itemsPerPage=500`
    );
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

    const result = { user, outfits };
    cache.set(cacheKey, result);
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
