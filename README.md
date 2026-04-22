# BullBoard

Campus event finder used for the SCP × HackaBull 2026 workshop *"Hack Smarter with AI."*

## Setup

```bash
git clone <repo-url>
cd bullboard
npm install
cp .env.example .env
```

Get a free Gemini API key at https://aistudio.google.com/apikey and paste it into `.env`.

```bash
npm run dev
```

Open http://localhost:5173.

## What you'll fill in

The app runs out of the box in **Original** mode — the expensive baseline that sends all 50 events to Gemini every time. Flip to **Optimized** mode and you'll see empty results, because the optimization functions in `src/lib/search.ts` are stubs.

During the workshop we fill in five functions, in this order:

| Act | Function | What it does |
|---|---|---|
| 1 | `scoreForProfile` | Keyword-match the profile against each event |
| 2 | `preFilterForProfile` | Remove past, full, and off-interest events |
| 2 | `slimEvent` | Drop fields the AI doesn't need |
| 3A | `callWithFallback` | Try each API key until one works |
| — | `optimizedRecommend` | Compose all of the above |

Each stub has a `// TODO` comment listing the steps.