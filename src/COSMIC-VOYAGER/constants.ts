import { PlanetData } from './types';
import MercuryTexture from './Image_for_planet/Mercury.jpg';
import VenusTexture from './Image_for_planet/Venus.jpg';
import EarthTexture from './Image_for_planet/Earth.jpeg';
import MarsTexture from './Image_for_planet/Mars.jpg';
import JupiterTexture from './Image_for_planet/Jupiter.jpg';
import SaturnTexture from './Image_for_planet/Saturn.jpg';
import UranusTexture from './Image_for_planet/Uranus.jpeg';
import NeptuneTexture from './Image_for_planet/Neptune.png';

// Distances and sizes are scaled for visual usability, not scientific accuracy
export const SOLAR_SYSTEM_DATA: PlanetData[] = [
  {
    name: "Mercury",
    color: "#A5A5A5",
    radius: 0.8,
    distance: 15,
    speed: 1.5,
    type: 'planet',
    description: "The smallest planet in our solar system and closest to the Sun.",
    textureUrl: MercuryTexture,
    hasAtmosphere: false
  },
  {
    name: "Venus",
    color: "#E3BB76",
    radius: 1.5,
    distance: 22,
    speed: 1.2,
    type: 'planet',
    description: "Second planet from the Sun. It spins in the opposite direction to most other planets.",
    textureUrl: VenusTexture,
    hasAtmosphere: true
  },
  {
    name: "Earth",
    color: "#22A6B3",
    radius: 1.6,
    distance: 30,
    speed: 1.0,
    type: 'planet',
    description: "Our home planet. The only place we know of so far that’s inhabited by living things.",
    textureUrl: EarthTexture,
    hasAtmosphere: true,
    moons: [
      { 
        name: "The Moon", 
        radius: 0.45, 
        distance: 3.5, 
        speed: 2, 
        color: "#dddddd",
        description: "Earth's only natural satellite. It is the fifth-largest satellite in the Solar System."
      }
    ]
  },
  {
    name: "Mars",
    color: "#EB4D4B",
    radius: 1.2,
    distance: 40,
    speed: 0.8,
    type: 'planet',
    description: "The Red Planet. Dusty, cold, desert world with a very thin atmosphere.",
    textureUrl: MarsTexture,
    hasAtmosphere: true,
    moons: [
      { 
        name: "Phobos", 
        radius: 0.15, 
        distance: 2.2, 
        speed: 3, 
        color: "#bfa596",
        description: "The larger and inner of the two natural satellites of Mars."
      },
      { 
        name: "Deimos", 
        radius: 0.12, 
        distance: 2.8, 
        speed: 2.5, 
        color: "#e3d1c5",
        description: "The smaller and outer of the two natural satellites of Mars."
      }
    ]
  },
  {
    name: "Jupiter",
    color: "#F0932B",
    radius: 4.5,
    distance: 60,
    speed: 0.4,
    type: 'planet',
    description: "Fifth planet from the Sun and the largest in the Solar System.",
    textureUrl: JupiterTexture,
    hasAtmosphere: true,
    hasRings: false,
    moons: [
      { 
        name: "Io", 
        radius: 0.5, 
        distance: 6, 
        speed: 1.5, 
        color: "#fcf0a4",
        description: "The most geologically active object in the Solar System, with over 400 active volcanoes."
      },
      { 
        name: "Europa", 
        radius: 0.45, 
        distance: 7.5, 
        speed: 1.2, 
        color: "#a8b5b8",
        description: "Has the smoothest surface of any known solid object in the Solar System, hiding a subsurface ocean."
      },
      { 
        name: "Ganymede", 
        radius: 0.7, 
        distance: 9.5, 
        speed: 0.9, 
        color: "#9e978e",
        description: "The largest and most massive moon of Jupiter and in the Solar System."
      },
      { 
        name: "Callisto", 
        radius: 0.65, 
        distance: 12, 
        speed: 0.7, 
        color: "#756e66",
        description: "The second-largest moon of Jupiter and the third-largest in the Solar System."
      }
    ]
  },
  {
    name: "Saturn",
    color: "#F6E58D",
    radius: 3.8,
    distance: 85,
    speed: 0.3,
    type: 'planet',
    description: "Adorned with a dazzling, complex system of icy rings.",
    textureUrl: SaturnTexture,
    hasAtmosphere: true,
    hasRings: true,
    ringColor: "#Dcdde1",
    moons: [
      { 
        name: "Titan", 
        radius: 0.75, 
        distance: 8, 
        speed: 1.1, 
        color: "#e3a857",
        description: "The largest moon of Saturn and the only moon known to have a dense atmosphere."
      },
      { 
        name: "Enceladus", 
        radius: 0.2, 
        distance: 5.5, 
        speed: 1.8, 
        color: "#ffffff",
        description: "Covered by fresh, clean ice, making it one of the most reflective bodies of the Solar System."
      }
    ]
  },
  {
    name: "Uranus",
    color: "#7ED6DF",
    radius: 2.5,
    distance: 105,
    speed: 0.2,
    type: 'planet',
    description: "The seventh planet from the Sun with the third-largest diameter in our solar system.",
    textureUrl: UranusTexture,
    hasAtmosphere: true,
    hasRings: true,
    ringColor: "#82ccdd",
    moons: [
      { 
        name: "Titania", 
        radius: 0.3, 
        distance: 4.5, 
        speed: 1.4, 
        color: "#d1d1d1",
        description: "The largest of the moons of Uranus and the eighth largest moon in the Solar System."
      },
      { 
        name: "Oberon", 
        radius: 0.28, 
        distance: 5.5, 
        speed: 1.1, 
        color: "#c4c4c4",
        description: "The outermost major moon of the planet Uranus."
      }
    ]
  },
  {
    name: "Neptune",
    color: "#4834D4",
    radius: 2.4,
    distance: 125,
    speed: 0.15,
    type: 'planet',
    description: "Dark, cold, and whipped by supersonic winds, ice giant Neptune is the eighth planet.",
    textureUrl: NeptuneTexture,
    hasAtmosphere: true,
    moons: [
      { 
        name: "Triton", 
        radius: 0.5, 
        distance: 4, 
        speed: -1.0, 
        color: "#e0dceb",
        description: "The largest natural satellite of the planet Neptune, with a retrograde orbit."
      } 
    ]
  }
];

export const CLAIMED_ASTEROIDS = [
  { name: "Ceres-X42", owner: "Elon M.", desc: "Rich in water ice and potential rocket fuel." },
  { name: "Vesta-Alpha", owner: "Weyland Corp", desc: "Primary mining outpost for heavy metals." },
  { name: "Pallas-9", owner: "Nasa Deep Space", desc: "Research station monitoring solar activity." },
  { name: "Hygiea-Prime", owner: "Blue Origin", desc: "Luxury resort for low-gravity golf." },
  { name: "Eros-77", owner: "Independent Miners", desc: "A hollowed-out asteroid serving as a refueling station." },
  { name: "Psyche-16", owner: "Galactic Bank", desc: "Estimated value: $10,000 quadrillion due to gold core." },
  { name: "Juno-Base", owner: "SpaceX", desc: "Terraforming experiment in progress." },
  { name: "Davida-5", owner: "Unknown", desc: "Strange signals detected from the core." },
  { name: "Interamnia-Z", owner: "Starlink Hub", desc: "Main communications relay for the outer rim." },
];
