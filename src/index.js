import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import helmet from "helmet";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

let isRateLimited = false;
const rateLimitTimeout = 15 * 1000; // 15 seconds

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
  express.static(path.join(__dirname, "public"), {
    maxAge: "30m",
    etag: false,
  })
);

// api endpoint to handle Roblox data
app.get("/api/user/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // sanitize username input before anything else
    if (
      !username ||
      typeof username !== "string" ||
      username.length < 1 ||
      username.length > 25
    ) {
      return res.status(400).json({ error: "Invalid username provided" });
    }

    console.log(`Fetching outfits for user: ${username}`);

    // check if ratelimited
    if (isRateLimited) {
      console.warn(`Rate limit active, returning 429 for ${username}`);
      return res.status(429).json({
        error: "Still ratelimited, try again after ~15 seconds (429)",
      });
    }

    // get user data
    const userResponse = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(
        username
      )}&limit=10`
    );
    const userData = await userResponse.json();

    // check for "too many requests" error, if so, set isRateLimited to true for rateLimitTimeout
    // to prevent a infinite ratelimit loop somewhat
    if (
      userData.errors &&
      userData.errors.some((error) => error.message === "Too many requests")
    ) {
      if (!isRateLimited) {
        isRateLimited = true;
        console.warn(
          `Rate limit reached, setting isRateLimited to true for ${
            rateLimitTimeout / 1000
          } seconds`
        );
        setTimeout(() => {
          isRateLimited = false;
        }, rateLimitTimeout);
      }
      return res.status(429).json({
        error: "Ratelimited, try again after 15 seconds (429)",
      });
    }

    if (userData.errors && userData.errors.length > 0) {
      console.error("Error fetching user data:", userData.errors);
      return res.status(500).json({
        error: "Failed to fetch user data",
      });
    }

    if (!userData.data || userData.data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userData.data[0].id;

    // get outfits
    const outfitsResponse = await fetch(
      `https://avatar.roblox.com/v1/users/${userId}/outfits?page=1&itemsPerPage=500`
    );
    const outfitsData = await outfitsResponse.json();

    // clear outfits that have isEditable set to false
    if (outfitsData.data) {
      outfitsData.data = outfitsData.data.filter((outfit) => outfit.isEditable);
    }

    // get thumbnails for each outfit
    if (outfitsData.data && outfitsData.data.length > 0) {
      const outfitIds = outfitsData.data.map((outfit) => outfit.id);
      let thumbnailData = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        const thumbnailResponse = await fetch(
          `https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${outfitIds.join(
            ","
          )}&size=150x150&format=Png&isCircular=false`
        );
        thumbnailData = await thumbnailResponse.json();

        // check if any thumbnails are still pending
        const pendingCount = thumbnailData.data
          ? thumbnailData.data.filter((thumb) => thumb.state === "Pending")
              .length
          : 0;

        // all thumbnails are either completed or failed
        if (pendingCount === 0) {
          break;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          // Wait 2 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // map thumbnails to outfits
      if (thumbnailData && thumbnailData.data) {
        outfitsData.data.forEach((outfit) => {
          const thumbnail = thumbnailData.data.find(
            (thumb) => thumb.targetId === outfit.id
          );
          if (
            thumbnail &&
            thumbnail.state === "Completed" &&
            thumbnail.imageUrl
          ) {
            outfit.thumbnailUrl = thumbnail.imageUrl;
            outfit.thumbnailState = "Completed";
          } else if (thumbnail) {
            outfit.thumbnailUrl = null;
            outfit.thumbnailState = thumbnail.state; // pending, error, blocked, etc.
          } else {
            outfit.thumbnailUrl = null;
            outfit.thumbnailState = "NotFound";
          }
        });
      }
    }

    res.json({
      user: userData.data[0],
      outfits: outfitsData.data || [],
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch outfit data" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

