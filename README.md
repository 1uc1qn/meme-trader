# Meme Trade Bot — Solana Meme Coin Auto Trader

Demo paper-trading bot with Start/Stop, USD balance, and strategy settings.  
Inspired by open-source Solana trading projects.

---

## Features

- Paper wallet (starts with 10 SOL ≈ $1,750)
- Real-time simulated token discovery
- Auto buy / sell with Stop-Loss & Take-Profit
- Start / Stop controls
- Strategy settings (size, max positions, filters)
- **PWA** — installable on iPhone / Android home screen
- Ready for free web deployment

---

## Run Locally

```bash
cd meme-trade-bot
node server.js
```

Open → http://localhost:3000

---

## Install as App on iPhone (Free)

1. Deploy the bot to the web (see below) **or** open the local version in Safari.
2. In Safari, tap the **Share** button.
3. Scroll and tap **Add to Home Screen**.
4. Name it “MemeBot” and confirm.

It will open full-screen like a normal app (thanks to the PWA setup).

---

## Free Web Deployment

### Option A — Render (recommended, free tier)

1. Go to https://render.com and create a free account.
2. Click **New +** → **Web Service**.
3. Connect your GitHub repo (or upload the folder).
4. Settings:
   - **Runtime**: Node
   - **Build Command**: leave empty or `echo "ready"`
   - **Start Command**: `node server.js`
5. Click **Create Web Service**.

Your bot will be live at a free `*.onrender.com` URL.

### Option B — Railway

1. Go to https://railway.app
2. New Project → Deploy from GitHub (or local)
3. It usually auto-detects Node. Set start command to `node server.js` if needed.
4. Generate a public domain.

### Option C — Vercel

```bash
npm i -g vercel
cd meme-trade-bot
vercel
```

Follow the prompts. The included `vercel.json` routes everything through the server.

---

## Project Structure

```
meme-trade-bot/
├── server.js          # Backend + trading simulation
├── public/
│   ├── index.html     # Dashboard (PWA ready)
│   ├── styles.css
│   ├── app.js
│   ├── manifest.json  # PWA manifest
│   ├── sw.js          # Service worker
│   └── icon-*.svg     # App icons
├── vercel.json
├── render.yaml
└── package.json
```

---

## Security & Disclaimer

- This is a **demo** with fake money only.
- Never put real private keys into this version.
- Meme coin trading is extremely high risk.
- For educational purposes only.

---

Enjoy the bot!
