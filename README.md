# roblox-outfit-finder 👖

A simple web app to find and display a Roblox user's saved outfits by their username.

<div align="center">

![MIT License](https://img.shields.io/github/license/BananaJeanss/roblox-outfit-finder?style=flat-square&color=blue)
![Issues](https://img.shields.io/github/issues/BananaJeanss/roblox-outfit-finder?style=flat-square&color=red)
![Last Commit](https://img.shields.io/github/last-commit/BananaJeanss/roblox-outfit-finder?style=flat-square&color=lightblue)
![Stars](https://img.shields.io/github/stars/BananaJeanss/roblox-outfit-finder?style=flat-square&color=orange)
[![Deploy to Nest](https://github.com/BananaJeanss/roblox-outfit-finder/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/BananaJeanss/roblox-outfit-finder/actions/workflows/main.yml)

</div>

## Features

- Find any roblox user's saved outfits by username or user ID
- Caches results for each user for up to 5 minutes by default
- Rate limit handling & throttling to avoid hitting roblox API limits
- Light/dark theme toggle

## Usage

1. Go to [https://outfitfinder.bnajns.hackclub.app](https://outfitfinder.bnajns.hackclub.app)
2. Enter the username (`@username`, not display name) or `id:1234567890`
3. Click **Find outfits** to view the user's saved outfits

## Rate Limits

> [!IMPORTANT]  
> The roblox API has a strict ratelimit. If you see a "ratelimited" message, wait about 17 seconds and try again.
> If you repeatedly get rate-limited, consider enabling proxies (see below).

## Caching

- User and outfit data is cached in memory for 5 minutes to reduce API calls and speed up repeat lookups.
- If you search for the same user again within 5 minutes, results will be served instantly from cache.

## Local Setup

Clone the repository and run the app locally:

```bash
git clone https://github.com/BananaJeanss/roblox-outfit-finder.git
cd roblox-outfit-finder
npm install
cp .env.example .env
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000) by default.

## Proxies

If you want to use proxies, set `USE_PROXIES=true` in your `.env` file and list your proxies (one per line) in [`proxies.txt`](proxies.txt).

Supported formats: `ip:port` or `http://ip:port`.

## Contributing

Contributions are welcome! If you have suggestions or improvements, feel free to open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).
