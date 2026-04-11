# Life RPG Mobile (iOS-first)

This folder contains the React Native/Expo rewrite start for iPhone, with Android support ready for the next step.

## What is implemented now

- Expo app scaffold (`mobile/`)
- API integration with the existing backend (`/api/game-state`, `/api/quests/all`, `/api/quests/complete`)
- Username-based profile bootstrap (`/api/profiles/upsert`)
- Basic mobile gameplay shell:
  - load profile
  - view level/streak/tokens
  - view quests
  - complete quest
  - pull-to-refresh

## Run on iOS

From repository root:

```bash
npm run install:mobile
npm run dev:ios
```

Or run Metro only:

```bash
npm run dev:mobile
```

## Backend URL for device testing

Default API base is set in `mobile/app.json`:

- `expo.extra.apiBaseUrl`: `http://localhost:4000`

For a real iPhone device, replace `localhost` with your machine LAN IP, for example:

- `http://192.168.1.55:4000`

Then restart Expo.

## Next migration steps

1. Add Firebase auth flow for React Native (Apple + Google sign-in support).
2. Port full game state and UI modules from web (`App.jsx` and hooks) to shared application logic.
3. Add iOS navigation, modals, onboarding, pinned quests, token vault, and analytics screens.
4. Add Android-specific polish and release builds.
