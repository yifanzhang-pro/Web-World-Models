

# AI Alchemy

AI Alchemy is a browser-based 2D “falling sand” sandbox where Gemini acts as the rule engine: when elements touch, Gemini decides whether they react and can invent brand-new elements on the fly.


## What You Can Do

- Paint elements into a pixel world (powder/liquid/gas/energy/life/bots) and watch them simulate in real time.
- Discover reactions by mixing elements; newly discovered results get added to the palette and logged.
- Use the “Creator Console” to create or update elements via natural language (e.g. “Create Acid that melts stone”, “Make Fire blue”).
- Toggle the “AI Supervisor” to periodically steer the world by drawing actions (or inventing a balancing element) based on the current state.

## How It Works (High Level)

- The simulation runs on a `120x100` grid rendered into an HTML canvas (`components/Sandbox.tsx`).
- There are two layers:
  - Material grid: solids, powders, liquids, gases, life, bots.
  - Energy grid: overlays like Fire/Electricity.
- Reactions are a mix of:
  - Hardcoded interactions (e.g. Electricity can split Water into Hydrogen/Oxygen; Hydrogen can ignite).
  - Gemini-discovered reactions for everything else, cached per element-pair to avoid re-querying.
- “Life” elements consume Water to grow (growth styles like surface/vertical/cling/spread), with safety limits to prevent runaway growth.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Create or edit `.env.local` and set `GEMINI_API_KEY`:
   - `GEMINI_API_KEY=YOUR_KEY_HERE`
3. Start the dev server: `npm run dev`
   - Vite runs on `http://localhost:3000` (see `vite.config.ts`).

Build and preview:

- `npm run build`
- `npm run preview`

## Controls

- Left panel: element picker, brush size, Creator Console, and “Reset World”.
- Canvas: click/drag to paint the selected element.
- Header: toggle “AI Supervisor”; when enabled, you can send it guidance (“Build a forest”, “Floods”, etc).
- Right panel (desktop): an “Alchemist Log” of discovered reactions and AI actions.

## Key Files

- `App.tsx`: app state, element palette, logs, supervisor loop.
- `components/Sandbox.tsx`: physics rules, rendering, reaction queue + caching.
- `services/geminiService.ts`: Gemini prompts + JSON schemas (reaction discovery, element commands, supervisor decisions).
- `constants.ts`: initial elements and grid constants.
- `types.ts`: shared types (physics categories, growth styles, element definitions).
- `vite.config.ts`: maps `GEMINI_API_KEY` into the client bundle as `process.env.API_KEY` for `@google/genai`.

