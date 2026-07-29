# DynaX Scanner — mobile (Expo / React Native)

Cross-platform (iOS + Android) scanner app for the DynaX ecosystem, built with
**Expo SDK 54** and **expo-router**. It signs in with a DynaX account, captures or
picks a short orbit video, uploads it to the single DynaX backend for KIRI
reconstruction, tracks status live, and shows the resulting 3D model with a
glass/floating UI.

Verified here: `tsc --noEmit` clean, and `expo export` builds **iOS + Android**
bundles with no errors (all dependencies pinned to their SDK-54 versions).

## Run it (Expo Go — easiest)

```bash
npm install
npx expo start
```

Scan the QR with **Expo Go** (latest) on iOS or Android. Set the backend URL if it
isn't the default:

```bash
EXPO_PUBLIC_API_URL="https://dynax.app/api/v1" npx expo start
# or for a local backend from a device on the same network:
EXPO_PUBLIC_API_URL="http://<your-computer-ip>:8080/api/v1" npx expo start
```

## What's inside

- `app/` — expo-router screens: `sign-in`, `(app)/index` (scan list),
  `(app)/new` (capture), `(app)/scan/[id]` (status + 3D viewer + share).
- `src/api/` — client (secure-store JWT) + scanner endpoints.
- `src/auth/` — Sign in with DynaX.
- `src/components/` — glass UI (BlurView cards, buttons, status pills), the camera
  recorder, and a WebView Three.js model viewer.
- Branded icon + splash in `assets/`.

## Notes

- **Expo Go path = video capture → backend reconstruction** (works on both
  platforms with no custom native code). The backend transcodes non-MP4 (Android
  WebM) automatically.
- **On-device LiDAR/TrueDepth scanning** (the native StandardCyborg pipeline in the
  separate Swift app) needs custom native modules, so it can't run in Expo Go — it
  would be added later via an Expo **dev client** / config plugin. This app already
  shares the same backend, so those scans appear in the same list.
- All dependencies are pinned to Expo SDK 54 versions; run `npx expo install --check`
  after any upgrade to keep them aligned.
