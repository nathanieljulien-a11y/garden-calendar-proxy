# Garden Calendar — Deployment Guide

Two repos, ~45 minutes of setup. Your API key never touches the browser.

---

## Repo 1: Proxy Server (`garden-proxy/`)

### 1. Create GitHub repo
Push the contents of `garden-proxy/` to a new GitHub repo (e.g. `garden-calendar-proxy`).

### 2. Deploy to Railway
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select your `garden-calendar-proxy` repo
3. Railway auto-detects Node.js and runs `npm start`
4. Go to **Variables** tab, add:
   ```
   ANTHROPIC_API_KEY   = sk-ant-your-key-here
   ALLOWED_ORIGIN      = https://your-frontend.vercel.app   ← fill in after step 2 below
   ```
5. Copy the Railway public URL (e.g. `https://garden-calendar-proxy.up.railway.app`)

### 3. Test the proxy
```
curl https://your-proxy.railway.app/api/health
# Should return: {"ok":true,"globalGenToday":0,"cap":30}
```

---

## Repo 2: Frontend (`garden-frontend/`)

### 1. Create GitHub repo
Push the contents of `garden-frontend/` to a new GitHub repo (e.g. `garden-calendar`).

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select `garden-calendar` repo
3. Framework preset: **Vite** (auto-detected)
4. Add environment variable:
   ```
   VITE_PROXY_URL = https://your-proxy.railway.app   ← from step 1.5 above
   ```
5. Deploy. Copy the Vercel URL (e.g. `https://garden-calendar.vercel.app`)

### 3. Update proxy ALLOWED_ORIGIN
Go back to Railway → Variables → update `ALLOWED_ORIGIN` to your Vercel URL → redeploy.

---

## Anthropic Console — Set Spending Cap
1. Go to [console.anthropic.com](https://console.anthropic.com) → Settings → Billing
2. Set a monthly spending limit of **£20** (or currency equivalent)

---

## Local Development

### Proxy
```bash
cd garden-proxy
npm install
cp .env.example .env      # fill in ANTHROPIC_API_KEY, set ALLOWED_ORIGIN=*
node server.js
```

### Frontend
```bash
cd garden-frontend
npm install
cp .env.example .env.local   # set VITE_PROXY_URL=http://localhost:3001
npm run dev
```

---

## Rate limits (default)
| Limit | Value |
|---|---|
| Generations per user per day | 3 |
| Requests per user per hour | 10 |
| Global generations per day | 30 |

Adjust via Railway environment variables: `DAILY_GEN_CAP`, `IP_DAILY_GEN`, `IP_HOURLY_CAP`.

---

## Monitoring
- Railway logs: real-time in Railway dashboard. Each generation logs `[gen] ip=x globalToday=n/30`
- Health check: `GET /api/health` returns current daily generation count
- Anthropic usage: [console.anthropic.com](https://console.anthropic.com) → Usage
