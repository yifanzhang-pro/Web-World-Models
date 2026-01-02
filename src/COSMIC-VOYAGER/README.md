# Cosmic Voyager

An interactive 3D solar system explorer powered by WebGL and Google Gemini AI. Navigate through space in multiple modes, land on planets, and receive AI-generated narration tailored to your current view.

## Features

- **Full Solar System**: All 8 planets with accurate textures, atmospheric effects, planetary rings (Saturn, Uranus), and 12 moons
- **Three Exploration Modes**:
  - **Orbit Mode**: Click to select celestial bodies, drag to rotate camera, scroll to zoom
  - **Pilot Mode**: Free-flight spaceship controls (WASD + R/F) for navigating through the system
  - **Surface Walk**: First-person exploration on planetary surfaces with procedurally generated terrain
- **AI-Powered Narration**:
  - Sidebar shows a static “Quick Summary” plus a Gemini-generated “Cosmic Guide (AI)” section for the selected body
  - "Cosmic Guide" subtitle bar that auto-refreshes every 30 seconds with view-dependent narration
  - Typewriter text reveal effect for immersive delivery
- **Asteroid Belt**: 1500 procedurally positioned asteroids with click-to-select functionality, ownership claims, and mining data
- **Dynamic Lighting**: Day/night cycles on planet surfaces with the Sun and other planets visible in the sky

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser UI                                │
│   (Mode Selection, Planet Selection, Camera Control)            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WebGL Solar System Engine                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Scene/State │ │ Procedural  │ │ Navigation  │ │ Rendering  │ │
│  │ Management  │ │ Assets      │ │ Logic       │ │ Pipeline   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gemini Flash API                              │
│  • Sidebar “Cosmic Guide (AI)” summaries (selected body)         │
│  • Cosmic Guide narration (30s refresh, view-aware)             │
│  • Terrain preference suggestions (flat/balanced/mountainous)   │
│  • Fallback to onboard descriptions when offline                │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **React 19** + **TypeScript** - UI framework
- **Three.js** + **@react-three/fiber** + **@react-three/drei** - 3D rendering
- **Google Gemini API** (`gemini-2.5-flash`) - AI narration
- **Vite** - Build tool
- **Tailwind CSS** - Styling

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your Gemini API key in `.env.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

## Controls

### Orbit Mode (Default)
| Control | Action |
|---------|--------|
| Click | Select body |
| Drag | Rotate camera |
| Scroll | Zoom in/out |

### Pilot Mode
| Control | Action |
|---------|--------|
| W / S | Forward / Backward |
| A / D | Left / Right |
| R / F | Up / Down |
| Drag | Look around |

### Surface Walk
| Control | Action |
|---------|--------|
| Click | Lock cursor |
| WASD | Walk |
| Mouse | Look around |
| ESC | Unlock cursor |

## Project Structure

```
COSMIC-VOYAGER/
├── App.tsx                 # Main app component, state management
├── index.tsx               # React entry point
├── types.ts                # TypeScript interfaces
├── constants.ts            # Planet/moon/asteroid data definitions
├── components/
│   ├── Scene.tsx           # 3D canvas orchestrator
│   ├── Planet.tsx          # Planet rendering (atmosphere, rings, moons)
│   ├── Sun.tsx             # Sun with point light
│   ├── SurfaceView.tsx     # First-person terrain exploration
│   ├── AsteroidBelt.tsx    # 1500 instanced asteroids
│   ├── MilkyWay.tsx        # Background star field
│   └── Sidebar.tsx         # Planet info panel
├── services/
│   └── geminiService.ts    # Gemini API integration + caching
└── Image_for_planet/       # Planet texture assets
```

## Celestial Bodies

**Planets**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune

**Moons**:
- Earth: Moon
- Mars: Phobos, Deimos
- Jupiter: Io, Europa, Ganymede, Callisto
- Saturn: Titan, Enceladus
- Uranus: Titania, Oberon
- Neptune: Triton

**Special Features**:
- Saturn and Uranus have visible ring systems
- Asteroid belt between Mars and Jupiter with ownership simulation
- Atmospheric effects on Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune

## Notes

- Landing is available on planets only (not moons, asteroids, or the Sun)
- AI narration requires a valid Gemini API key; without it, bundled fallback descriptions are used
- Scales and distances are compressed for usability, not scientific accuracy

### API Key Note (Important)

This project calls Gemini directly from the browser (Vite injects `GEMINI_API_KEY` into the client bundle). That means your API key is exposed to anyone who can load the app.

For production, route Gemini requests through a backend and keep the API key server-side.
