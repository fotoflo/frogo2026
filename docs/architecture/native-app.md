# Native App Architecture

## Overview

The React Native app lives in `native/` and uses Expo SDK 54 with Expo Router for file-based navigation. It connects to the same Supabase backend as the web app.

## Structure

```
native/
├── app/                    # Expo Router file-based routes
│   ├── _layout.tsx         # Root layout (Stack navigator, dark theme)
│   ├── index.tsx           # Channel list (home screen)
│   ├── pair.tsx            # TV pairing remote control
│   ├── channel/
│   │   └── [slug].tsx      # Channel detail with video list
│   └── watch/
│       └── [slug]/
│           └── [videoId].tsx   # Video player (WebView YouTube embed)
├── components/
│   └── TVFocusable.tsx     # Focus-aware wrapper for TV d-pad navigation
├── lib/
│   ├── supabase.ts         # Supabase client (reads config from app.json extra)
│   └── types.ts            # Shared TypeScript interfaces
├── app.json                # Expo config (iOS, Android, Android TV intent filters)
└── package.json
```

## Platform Targets

| Platform    | Status | Notes |
|-------------|--------|-------|
| iOS         | Ready  | Standard Expo build |
| Android     | Ready  | Standard Expo build |
| Apple TV    | Planned | Requires react-native-tvos fork via expo-custom-dev-client |
| Android TV  | Ready  | LEANBACK_LAUNCHER intent filter configured |

## How It Works

1. **Data**: All screens fetch from Supabase directly using the anon key
2. **Video**: YouTube videos play in a WebView embed (not native player)
3. **Pairing**: Mobile sends commands by writing to `pairing_sessions` table; desktop subscribes via Supabase Realtime
4. **TV Navigation**: TVFocusable component handles focus/blur for d-pad remote control

## Building

```bash
cd native
npm install
npx expo start           # Dev (Expo Go)
npx expo run:ios         # iOS native build
npx expo run:android     # Android native build
npx eas build            # Cloud build (requires EAS setup)
```

## Apple TV Notes

Full Apple TV support requires:
1. Switch to `react-native-tvos` fork
2. Use `expo-custom-dev-client` or bare workflow
3. Add tvOS target in Xcode project
4. All screens already use focus-aware components

## Android TV Notes

- `LEANBACK_LAUNCHER` intent filter is configured in app.json
- TVFocusable component handles d-pad focus highlighting
- WebView YouTube player works on Android TV
- Standard Expo build process works for Android TV APKs
