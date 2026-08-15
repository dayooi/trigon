/**
 * Themes: one palette for the interface, one for the pieces.
 *
 * `vars` are written onto the root element as custom properties, so the
 * stylesheet never names a colour of its own beyond the defaults in :root.
 * `pieces` is the palette a piece draws its colour from.
 *
 * Pieces store an index into that palette rather than a hex value, so
 * switching theme recolours the board and tray in place — see `pieceColor`.
 */

export const THEMES = [
  {
    id: 'midnight',
    label: 'Midnight',
    vars: {
      bg: '#1b1b1b',
      cell: '#333333',
      text: '#f2f2f2',
      muted: '#bdbdbd',
      score: '#3ddc97',
      best: '#ef5f78',
      gold: '#ffc93c',
      panel: '#242424',
      pill: '#141414',
      btn: '#3a3a3a',
      'btn-ink': '#f2f2f2',
      'btn-off': '#333333',
      'btn-off-ink': '#6f6f6f',
      primary: '#3ddc97',
      'primary-ink': '#10261d',
      scrim: 'rgba(12, 12, 12, 0.82)',
      pause: '#7ed957',
      flash: '#ffffff',
      glow: 'rgba(255, 201, 60, 0.55)',
      glow0: 'rgba(255, 201, 60, 0)',
      shadow: 'rgba(0, 0, 0, 0.45)',
    },
    pieces: [
      '#ef5f78', '#f7b23b', '#8bd450', '#2ecc8f',
      '#3fa9f5', '#a77bf3', '#ff8a5b', '#39c7c7',
    ],
  },

  {
    // Shallow water over pale sand, palm shade, and a sunset that goes coral
    // to peach. Ink is the deep teal of water past the reef.
    id: 'summer',
    label: 'Summer',
    vars: {
      bg: '#fbeada',
      cell: '#ecd5b6',
      text: '#1f4b53',
      muted: '#6d7f76',
      score: '#0f9aa8',
      best: '#ef6f61',
      gold: '#e8952f',
      panel: '#fff7ec',
      pill: '#fffdf8',
      btn: '#e7d2b6',
      'btn-ink': '#1f4b53',
      'btn-off': '#e3d4c1',
      'btn-off-ink': '#a99880',
      primary: '#0f9aa8',
      'primary-ink': '#f4fbfb',
      scrim: 'rgba(31, 75, 83, 0.58)',
      pause: '#0f9aa8',
      flash: '#ffffff',
      glow: 'rgba(232, 149, 47, 0.5)',
      glow0: 'rgba(232, 149, 47, 0)',
      shadow: 'rgba(31, 75, 83, 0.32)',
    },
    pieces: [
      '#22b3c4', // shallow turquoise
      '#0d7f96', // deeper water
      '#7fae4a', // palm frond
      '#f2c14e', // sunlit sand
      '#f2846b', // sunset coral
      '#f4a9b8', // cloud pink
      '#f7b98a', // peach
      '#5fa8d3', // sky blue
    ],
  },

  {
    // Overcast ice: pale sky, frozen water, and the blue-grey of shadow on snow.
    id: 'winter',
    label: 'Winter',
    vars: {
      bg: '#eef4f9',
      cell: '#d5e1ec',
      text: '#22384c',
      muted: '#6d8296',
      score: '#2f8fbf',
      best: '#8a6fb0',
      gold: '#7fa8c9',
      panel: '#ffffff',
      pill: '#f7fbff',
      btn: '#dbe6f0',
      'btn-ink': '#22384c',
      'btn-off': '#dde5ed',
      'btn-off-ink': '#9aabba',
      primary: '#2f8fbf',
      'primary-ink': '#f2f9fd',
      scrim: 'rgba(34, 56, 76, 0.55)',
      pause: '#2f8fbf',
      flash: '#ffffff',
      glow: 'rgba(127, 168, 201, 0.55)',
      glow0: 'rgba(127, 168, 201, 0)',
      shadow: 'rgba(34, 56, 76, 0.28)',
    },
    pieces: [
      '#5b9bd5', '#8fc7e8', '#3f6f9c', '#a9b8d8',
      '#77c2c0', '#b9a8d4', '#c3d5e4', '#4c6b8a',
    ],
  },

  {
    // Late leaves against bark: rust, amber, olive, and the plum of early dusk.
    id: 'autumn',
    label: 'Autumn',
    vars: {
      bg: '#fbeeda',
      cell: '#e8d0ae',
      text: '#4a2b1c',
      muted: '#8a6a52',
      score: '#c25a24',
      best: '#a63a4a',
      gold: '#d9922b',
      panel: '#fff8ec',
      pill: '#fffdf6',
      btn: '#e6cfae',
      'btn-ink': '#4a2b1c',
      'btn-off': '#e3d3ba',
      'btn-off-ink': '#a99075',
      primary: '#c25a24',
      'primary-ink': '#fdf3ea',
      scrim: 'rgba(74, 43, 28, 0.58)',
      pause: '#c25a24',
      flash: '#fffaf0',
      glow: 'rgba(217, 146, 43, 0.5)',
      glow0: 'rgba(217, 146, 43, 0)',
      shadow: 'rgba(74, 43, 28, 0.3)',
    },
    pieces: [
      '#d9642f', '#e3a12b', '#a8462a', '#7f8b3a',
      '#c98b4b', '#b23a48', '#8a5a2b', '#d8b45c',
    ],
  },

  {
    // First growth: new leaf, blossom, and a washed morning sky.
    id: 'spring',
    label: 'Spring',
    vars: {
      bg: '#f3f9ec',
      cell: '#dcebd1',
      text: '#2c4a33',
      muted: '#6f8a72',
      score: '#4ea64e',
      best: '#e0729a',
      gold: '#efc14e',
      panel: '#ffffff',
      pill: '#fbfff7',
      btn: '#e2eeda',
      'btn-ink': '#2c4a33',
      'btn-off': '#e4ebdf',
      'btn-off-ink': '#9db09f',
      primary: '#4ea64e',
      'primary-ink': '#f4fbf3',
      scrim: 'rgba(44, 74, 51, 0.55)',
      pause: '#4ea64e',
      flash: '#ffffff',
      glow: 'rgba(239, 193, 78, 0.55)',
      glow0: 'rgba(239, 193, 78, 0)',
      shadow: 'rgba(44, 74, 51, 0.26)',
    },
    pieces: [
      '#7cc36a', '#aad86b', '#f2a3c0', '#f6d774',
      '#86c8e0', '#c8a6dd', '#5aa88a', '#f0997a',
    ],
  },
];

export const DEFAULT_THEME = THEMES[0].id;

let active = THEMES[0];

export function activeTheme() {
  return active;
}

export function useTheme(id) {
  active = THEMES.find((theme) => theme.id === id) ?? THEMES[0];
  return active;
}

/** Resolve a piece's palette index against the theme in force right now. */
export function pieceColor(tint) {
  const palette = active.pieces;
  return palette[((tint % palette.length) + palette.length) % palette.length];
}

export function randomTint() {
  return (Math.random() * active.pieces.length) | 0;
}
