# BullBoard

Campus event finder used for the SCP × HackaBull 2026 workshop *"Hack Smarter with AI."*

## Setup

```bash
git clone https://github.com/usf-scp/bullboard.git
cd bullboard
npm install
cp .env.example .env
```

Get a free Gemini API key at https://aistudio.google.com/apikey, then paste it into `.env`.

```bash
npm run dev
```

Open http://localhost:5173.

## What you'll fill in

When you clone the project, you will see that both **Original** mode and **Optimized** mode produce the same expensive AI calls. This is because the optimization functions in `src/lib/search.ts` are initially code stubs that fall through to the baseline path.

During the workshop we fill in four functions, and then wire them together:

| Act | What you'll write | What it does |
|---|---|---|
| 1 | `scoreForProfile` | Keyword-match the profile against each event |
| 2 | `preFilterForProfile` | Remove past, full, and off-interest events |
| 2 | `slimEvent` | Drop fields the AI doesn't need |
| 3A | `callWithFallback` | Try each API key until one works |
| 3A | Wire-up in `optimizedRecommend` | Compose all of the above into the full pipeline |

Each stub has a `// TODO` comment listing the steps. Search the file for `TODO` to find them all.

As you fill in each function, flip to Optimized mode and watch the cost dashboard change.

## Troubleshooting

**"Missing API Key" error on load.** Check that your `.env` file exists in the project root (not inside `src/`), and that the variable is named exactly `VITE_GEMINI_API_KEY`. The `VITE_` prefix is required.

**Changes to `.env` not taking effect.** Vite reads environment variables at startup. Stop the dev server with Ctrl+C and run `npm run dev` again.

**Port 5173 already in use.** Something else is using that port. Either close it or run `npm run dev -- --port 5174`.

## Stuck or want to check your work?

The completed version of `src/lib/search.ts` lives on the `completed` branch:

\`\`\`bash
git checkout completed
\`\`\`