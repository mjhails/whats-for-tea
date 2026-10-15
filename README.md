# What's for Tea?

Plan the week's family teas, get the shopping list and keep your favourite meals in one place. Built for low-calorie, budget-friendly meals using everyday Aldi ingredients that get reused across the week.

Live at **https://mjhails.github.io/whats-for-tea/**

## What it does

- **Week**: a grid of meal tiles, colour-coded by main ingredient. Plan a whole week in one tap. It picks meals that share ingredients, avoids the same main twice in a row, and sets up leftovers nights (cook double chilli Monday, chilli jackets Tuesday). Swap, lock or take a night off on any day.
- **Shopping**: the week's ingredients added up, scaled to your portions and grouped by aisle, with tick-off circles and a copy button.
- **Meals**: a library of 50 familiar budget teas plus your own. Add meals by hand, import them from a recipe card or screenshots, or ask Claude for ideas.
- **Shared**: everyone signed in sees the same plan, library and ticks, live.

## How it's built

- Vite + plain JavaScript, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.
- Uses the **Kcal Tracker Firebase project**, so the same accounts work in both apps. Data lives in `tea/week`, `tea/library` and `teaImages/*`.
- The Claude features go through a Cloudflare Worker in `worker/` that keeps the Anthropic API key private. Without it, the app works fine and simply hides the Ideas and Import buttons.

## One-time setup

1. **Firestore rules**: paste `firestore.rules.txt` into Firebase console → Firestore Database → Rules, then Publish. This keeps the Kcal Tracker rules and adds the new ones.
2. **GitHub Pages**: in this repo, go to Settings → Pages → Source and choose **GitHub Actions**.
3. **Claude features (optional)**: follow `worker/README.md`, then put the worker's address in `src/config.js`.

## Run it locally

```
npm install
npm run dev
```
