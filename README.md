# roblox-outfit-finder

A simple web app to find and display a Roblox user's saved outfits by their username.

## Usage

1. Go to the website: [https://outfitfinder.bnajns.hackclub.app](https://outfitfinder.bnajns.hackclub.app)
2. Input the username (@username, not display name).
3. Click "Find outfits" to view the user's outfits

> **Note:** Roblox API rate limits may be somewhat strict, if you get ratelimited, wait about 15 seconds and then try again.

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

## License

This project is licensed under the [MIT License](LICENSE).