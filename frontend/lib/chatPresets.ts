import type { CSSProperties } from 'react'

export interface ChatPreset {
  id: string
  label: string
  category: 'patterns' | 'dark' | 'gradients' | 'colorful'
  /** Color used for the small swatch thumbnail */
  swatch: string
  /** Full CSS properties applied to the chat scroll area */
  style: CSSProperties
}

// Helper: encode SVG as data URI for backgroundImage
const svg = (markup: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(markup)}")`

export const CHAT_PRESETS: ChatPreset[] = [
  // ── Patterns (CSS + SVG tile) ──────────────────────────────────────────────
  {
    id: 'dots',
    label: 'Dots',
    category: 'patterns',
    swatch: '#0f0f1a',
    style: {
      backgroundImage:
        'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
      backgroundSize: '22px 22px',
      backgroundColor: '#0f0f1a',
    },
  },
  {
    id: 'grid',
    label: 'Grid',
    category: 'patterns',
    swatch: '#0a0a14',
    style: {
      backgroundImage:
        'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
      backgroundColor: '#0a0a14',
    },
  },
  {
    id: 'circles',
    label: 'Circles',
    category: 'patterns',
    swatch: '#0c0c18',
    style: {
      backgroundImage:
        'radial-gradient(circle at center, transparent 54%, rgba(255,255,255,0.05) 55%, rgba(255,255,255,0.05) 63%, transparent 64%)',
      backgroundSize: '44px 44px',
      backgroundColor: '#0c0c18',
    },
  },
  {
    id: 'diagonal',
    label: 'Lines',
    category: 'patterns',
    swatch: '#111',
    style: {
      backgroundImage:
        'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(255,255,255,0.025) 18px, rgba(255,255,255,0.025) 19px)',
      backgroundColor: '#111',
    },
  },
  {
    id: 'cross',
    label: 'Cross',
    category: 'patterns',
    swatch: '#0d0d0d',
    style: {
      backgroundImage:
        'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
      backgroundPosition: '-1px -1px',
      backgroundColor: '#0d0d0d',
    },
  },
  // SVG tile patterns
  {
    id: 'honeycomb',
    label: 'Honeycomb',
    category: 'patterns',
    swatch: '#0a0a16',
    style: {
      backgroundImage: svg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="100"><path fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1.2" d="M28 3L53 17.5v29L28 61 3 46.5V17.5zM28 61v36M53 46.5L78 61M3 46.5L-22 61M28 99L53 84.5M28 99L3 84.5"/></svg>'
      ),
      backgroundSize: '56px 100px',
      backgroundColor: '#0a0a16',
    },
  },
  {
    id: 'triangles',
    label: 'Triangles',
    category: 'patterns',
    swatch: '#0f0c20',
    style: {
      backgroundImage: svg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="52"><polygon points="30,2 58,50 2,50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.2"/><polygon points="0,0 30,48 60,0" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/></svg>'
      ),
      backgroundSize: '60px 52px',
      backgroundColor: '#0f0c20',
    },
  },
  {
    id: 'diamonds',
    label: 'Diamonds',
    category: 'patterns',
    swatch: '#0d1520',
    style: {
      backgroundImage: svg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1" d="M20 2L38 20 20 38 2 20z"/></svg>'
      ),
      backgroundSize: '40px 40px',
      backgroundColor: '#0d1520',
    },
  },
  {
    id: 'stars',
    label: 'Stars ✨',
    category: 'patterns',
    swatch: '#07071a',
    style: {
      backgroundImage: svg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="10" cy="10" r="1" fill="rgba(255,255,255,0.5)"/><circle cx="50" cy="20" r="1.5" fill="rgba(255,255,255,0.4)"/><circle cx="30" cy="55" r="1" fill="rgba(255,255,255,0.6)"/><circle cx="70" cy="60" r="1.2" fill="rgba(255,255,255,0.35)"/><circle cx="20" cy="70" r="0.8" fill="rgba(255,255,255,0.45)"/><circle cx="65" cy="10" r="1.3" fill="rgba(255,255,255,0.3)"/><circle cx="40" cy="40" r="0.8" fill="rgba(255,255,255,0.25)"/><circle cx="75" cy="40" r="1" fill="rgba(255,255,255,0.4)"/></svg>'
      ),
      backgroundSize: '80px 80px',
      backgroundColor: '#07071a',
    },
  },
  {
    id: 'flowers',
    label: 'Flowers 🌸',
    category: 'patterns',
    swatch: '#1a0a14',
    style: {
      backgroundImage: svg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><g opacity="0.15" transform="translate(30,30)"><ellipse cx="0" cy="-10" rx="5" ry="9" fill="#ff88bb" transform="rotate(0)"/><ellipse cx="0" cy="-10" rx="5" ry="9" fill="#ff88bb" transform="rotate(60)"/><ellipse cx="0" cy="-10" rx="5" ry="9" fill="#ff88bb" transform="rotate(120)"/><ellipse cx="0" cy="-10" rx="5" ry="9" fill="#ff88bb" transform="rotate(180)"/><ellipse cx="0" cy="-10" rx="5" ry="9" fill="#ff88bb" transform="rotate(240)"/><ellipse cx="0" cy="-10" rx="5" ry="9" fill="#ff88bb" transform="rotate(300)"/><circle r="4" fill="#ffcc66"/></g></svg>'
      ),
      backgroundSize: '60px 60px',
      backgroundColor: '#1a0a14',
    },
  },
  {
    id: 'bubbles',
    label: 'Bubbles',
    category: 'patterns',
    swatch: '#08101c',
    style: {
      backgroundImage: svg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="15" cy="15" r="12" fill="none" stroke="rgba(100,180,255,0.12)" stroke-width="1.5"/><circle cx="55" cy="10" r="8" fill="none" stroke="rgba(100,180,255,0.1)" stroke-width="1.2"/><circle cx="80" cy="35" r="14" fill="none" stroke="rgba(100,180,255,0.09)" stroke-width="1.5"/><circle cx="30" cy="65" r="10" fill="none" stroke="rgba(100,180,255,0.11)" stroke-width="1.2"/><circle cx="70" cy="75" r="16" fill="none" stroke="rgba(100,180,255,0.08)" stroke-width="1.5"/><circle cx="50" cy="48" r="6" fill="none" stroke="rgba(100,180,255,0.13)" stroke-width="1"/></svg>'
      ),
      backgroundSize: '100px 100px',
      backgroundColor: '#08101c',
    },
  },
  {
    id: 'waves',
    label: 'Waves',
    category: 'patterns',
    swatch: '#050e1a',
    style: {
      backgroundImage: svg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20"><path d="M0 10 Q12.5 0 25 10 Q37.5 20 50 10 Q62.5 0 75 10 Q87.5 20 100 10" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/></svg>'
      ),
      backgroundSize: '100px 20px',
      backgroundColor: '#050e1a',
    },
  },

  // ── Dark solids ─────────────────────────────────────────────────────────
  {
    id: 'black',
    label: 'Black',
    category: 'dark',
    swatch: '#000',
    style: { backgroundColor: '#000' },
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    category: 'dark',
    swatch: '#1a1a2e',
    style: { backgroundColor: '#1a1a2e' },
  },
  {
    id: 'slate',
    label: 'Slate',
    category: 'dark',
    swatch: '#0f172a',
    style: { backgroundColor: '#0f172a' },
  },
  {
    id: 'dark-indigo',
    label: 'Indigo',
    category: 'dark',
    swatch: '#1e1b4b',
    style: { backgroundColor: '#1e1b4b' },
  },
  {
    id: 'dark-green',
    label: 'Dark Green',
    category: 'dark',
    swatch: '#0a1a10',
    style: { backgroundColor: '#0a1a10' },
  },

  // ── Gradients ────────────────────────────────────────────────────────────
  {
    id: 'midnight',
    label: 'Midnight',
    category: 'gradients',
    swatch: '#302b63',
    style: {
      background:
        'linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    category: 'gradients',
    swatch: '#0a3055',
    style: {
      background:
        'linear-gradient(160deg, #001e3c 0%, #0a3055 50%, #000d1a 100%)',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    category: 'gradients',
    swatch: '#134a2a',
    style: {
      background:
        'linear-gradient(160deg, #0a2a1a 0%, #134a2a 50%, #0d3321 100%)',
    },
  },
  {
    id: 'crimson',
    label: 'Crimson',
    category: 'gradients',
    swatch: '#5c0a0a',
    style: {
      background:
        'linear-gradient(160deg, #1a0505 0%, #5c0a0a 50%, #1a0505 100%)',
    },
  },
  {
    id: 'teal',
    label: 'Teal',
    category: 'gradients',
    swatch: '#0d4a4a',
    style: {
      background:
        'linear-gradient(160deg, #031a1a 0%, #0d4a4a 50%, #031a1a 100%)',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    category: 'gradients',
    swatch: '#4a1a2a',
    style: {
      background:
        'linear-gradient(160deg, #1a0a14 0%, #4a1a2a 50%, #1a0a14 100%)',
    },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    category: 'gradients',
    swatch: '#0f3460',
    style: {
      background:
        'linear-gradient(160deg, #0d0221 0%, #121063 30%, #0f3460 65%, #16213e 100%)',
    },
  },
  {
    id: 'galaxy',
    label: 'Galaxy',
    category: 'gradients',
    swatch: '#1a0533',
    style: {
      background:
        'radial-gradient(ellipse at 60% 20%, #4a154b 0%, #1a0533 45%, #000 100%)',
    },
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    category: 'gradients',
    swatch: '#004d5a',
    style: {
      background:
        'linear-gradient(160deg, #001a20 0%, #004d5a 40%, #006d6d 70%, #001a20 100%)',
    },
  },
  {
    id: 'bronze',
    label: 'Bronze',
    category: 'gradients',
    swatch: '#3d1a00',
    style: {
      background:
        'linear-gradient(160deg, #1a0a00 0%, #3d1a00 40%, #5c2a00 70%, #1a0a00 100%)',
    },
  },
  {
    id: 'nebula',
    label: 'Nebula',
    category: 'gradients',
    swatch: '#090979',
    style: {
      background:
        'linear-gradient(160deg, #020024 0%, #090979 35%, #00416a 70%, #020024 100%)',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    category: 'gradients',
    swatch: '#7a1e3e',
    style: {
      background:
        'linear-gradient(160deg, #1a0533 0%, #4a0e4e 30%, #7a1e3e 60%, #c0392b 100%)',
    },
  },

  // ── Colorful / Festive ───────────────────────────────────────────────────
  {
    id: 'balloon',
    label: 'Balloon 🎈',
    category: 'colorful',
    swatch: '#6b2fa0',
    style: {
      background:
        'linear-gradient(160deg, #2d1b69 0%, #6b2fa0 25%, #cc2b6f 55%, #f47c3c 80%, #2d1b69 100%)',
    },
  },
  {
    id: 'confetti',
    label: 'Confetti',
    category: 'colorful',
    swatch: '#764ba2',
    style: {
      background:
        'linear-gradient(135deg, #4a00e0 0%, #764ba2 40%, #f64f59 80%, #c471ed 100%)',
    },
  },
  {
    id: 'candy',
    label: 'Candy',
    category: 'colorful',
    swatch: '#c62a88',
    style: {
      background:
        'linear-gradient(160deg, #6a1b9a 0%, #c62a88 40%, #ff6b9d 70%, #6a1b9a 100%)',
    },
  },
  {
    id: 'fire',
    label: 'Fire 🔥',
    category: 'colorful',
    swatch: '#d4380d',
    style: {
      background:
        'linear-gradient(160deg, #1a0500 0%, #7a1a00 30%, #d4380d 60%, #ff7a00 85%, #1a0500 100%)',
    },
  },
  {
    id: 'neon',
    label: 'Neon',
    category: 'colorful',
    swatch: '#00b4d8',
    style: {
      background:
        'linear-gradient(135deg, #023e8a 0%, #0077b6 30%, #00b4d8 55%, #90e0ef 80%, #023e8a 100%)',
    },
  },
  {
    id: 'spring',
    label: 'Spring 🌸',
    category: 'colorful',
    swatch: '#4caf50',
    style: {
      background:
        'linear-gradient(160deg, #1b5e20 0%, #2e7d32 30%, #66bb6a 55%, #a5d6a7 75%, #1b5e20 100%)',
    },
  },
]

export const PRESET_STYLE_MAP: Record<string, CSSProperties> = Object.fromEntries(
  CHAT_PRESETS.map((p) => [p.id, p.style])
)

export const CATEGORY_LABELS: Record<ChatPreset['category'], string> = {
  patterns: 'Patterns & Textures',
  dark: 'Dark Solids',
  gradients: 'Gradients',
  colorful: 'Colorful',
}
