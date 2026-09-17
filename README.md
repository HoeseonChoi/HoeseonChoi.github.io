# HoeseonChoi.github.io

GitHub Pages user site — serves the **home-inventory** PWA (Expo static web export).

Contents are generated: `npx expo export --platform web` → `dist/` copied here.
Do not edit files directly; re-export and redeploy instead.

- `.nojekyll` disables Jekyll so `/_expo/*` assets are served.
- `404.html` is a copy of `index.html` — SPA fallback so deep links
  (`/product/<id>`, `/auth/callback`) survive refresh on GitHub Pages.
