
# Cosmic Voyager

Interactive 3D solar system explorer built with React + Three.js. Click planets, fly a ship, or land and walk on procedurally generated terrain. A Gemini-powered “Cosmic Guide” provides ambient narration and contextual summaries.

## Features

- Orbit view with smooth camera travel to the Sun, planets, moons, and the asteroid belt
- Pilot mode (FlyControls) for free-flight navigation
- Surface mode with pointer-lock walking and a day/night lighting cycle
- AI narration + planet summaries via Google Gemini (with fallbacks when unavailable)

## Tech Stack

- Vite + React (TypeScript)
- three.js via `@react-three/fiber` + `@react-three/drei`
- Gemini via `@google/genai`
- Tailwind (CDN in `index.html`)

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create `.env.local` and set your Gemini API key:
   `GEMINI_API_KEY=YOUR_KEY_HERE`
3. Run the dev server:
   `npm run dev`
4. Build / preview:
   `npm run build`
   `npm run preview`

## Controls

**Orbit Mode**

- Click: select planet/body
- Drag: orbit camera
- Scroll: zoom

**Pilot Mode**

- W/S: forward/back
- A/D: strafe left/right
- R/F: up/down
- Drag: look around

**Surface Mode**

- Click: lock cursor (pointer lock)
- WASD: walk
- Mouse: look
- ESC: unlock cursor

## API Key Note (Important)

This project calls Gemini directly from the browser (`vite.config.ts` injects `GEMINI_API_KEY` into the client bundle and `services/geminiService.ts` uses it). That means your API key is exposed to anyone who can load the app.

For production, route Gemini requests through a backend and keep the API key server-side.

## Customize The Solar System

- Planet data, rings, moons: `constants.ts`
- Textures: `Image_for_planet/`
