
## Overview

AI SPIRE is a browser-based roguelike deckbuilder where **Gemini generates new content as you play**: card rewards after battles, shop inventories, and elite relic drops. There’s also a **Wish** input that turns a player prompt into a single custom card.

If you don’t provide an API key, the game falls back to built-in mock content so you can still play locally.

## Gameplay

- **Map progression** with nodes: Monster, Elite, Rest, Shop, and Boss (every 10 floors).
- **Turn-based combat** with energy, a draw pile/hand/discard pile/exhaust pile, and card keywords (Exhaust, Ethereal, Innate, Retain).
- **Status effects** (examples): poison, burn, freeze, weak, vulnerable, frail, strength, dexterity, reflect, metallicize, regen.
- **Relics and powers** that trigger on events (start of combat, start of turn, playing a card, end of combat).

## Tech Stack

- React + TypeScript + Vite
- `@google/genai` (Gemini) with JSON-schema outputs + sanitization
- Tailwind CSS via CDN (loaded in `index.html`)
- `lucide-react` icons

## Run Locally

**Prerequisites:** Node.js (18+ recommended)

1. Install dependencies:
   `npm install`
2. Create `.env.local` and set your Gemini key:
   `GEMINI_API_KEY=...`
3. Start the dev server:
   `npm run dev`

Open http://localhost:3000

## Environment Variables

- `GEMINI_API_KEY`: Used client-side to call Gemini.

Important: this project calls Gemini directly from the browser, so any API key you bundle is visible to users. For a public deployment, use a server-side proxy (or another key-management approach) instead of shipping your key.

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally

## Repo Structure

- `App.tsx` — core game state machine (menu/map/combat/shop/rest/rewards) + UI
- `services/geminiService.ts` — Gemini prompting + schema enforcement + sanitization + mock fallbacks
- `components/Card.tsx` — card renderer
- `types.ts` / `constants.ts` — shared types + balance constants

## Disclaimer

This is a fan-inspired prototype and is not affiliated with “Slay the Spire”.
