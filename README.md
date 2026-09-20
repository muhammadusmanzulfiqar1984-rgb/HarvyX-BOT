# HarvyX BOT

Independent AI operating system for Mian Muhammad Usman.

Manager (MIAN) orchestrates specialist Bots (OPS, Analyst) via a Bot Registry.
OPS connects to HarvYX SaaS over HTTP — this repo does **not** own HarvYX D1/leads data.

## Local

```bash
npm install
cp .dev.vars.example .dev.vars   # fill server-side keys only
npm run dev                      # http://localhost:3000
```

## Stack

- Next.js (OpenNext → Cloudflare Workers)
- D1 `crew-db` (conversations + Bot Registry)
- Groq (fast) · NVIDIA NIM / Nebius / Cloudflare Pareto (reasoning)

## Safety

Never commit `.dev.vars` or API tokens. Never expose secrets to the client (`NEXT_PUBLIC_*`).
