# Glitcher

State-of-the-art glitch art tool powered by the [Noisemaker](https://noisemaker.app/) shader engine.

Stacks chains of glitch effects — datamosh, CRT, scanlines, chromatic aberration, feedback, lens distortion — over a live camera or uploaded image. Live preview, intensity dial, GLITCHIFY randomizer, photo/video capture.

## Features

- Curated glitch presets that chain multiple Noisemaker effects
- Live intensity slider (no shader recompile)
- GLITCHIFY button for random destruction
- Camera input (front/rear switch) or image upload
- Photo and video capture
- Filmstrip gallery with IndexedDB persistence
- Mobile responsive, no install, no account, no tracking

## Getting Started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

Open http://localhost:3007 in your browser. Grant camera access when prompted.

## Tech Stack

- Vanilla JavaScript (ES modules, no framework)
- [Noisemaker](https://noisemaker.app/) shader pipeline via CDN
- [Handfish](https://handfish.noisefactor.io/) design system
- Served with `http-server` — no build tools needed

## License

[MIT](LICENSE) — Copyright (c) 2026 Noise Factor LLC
