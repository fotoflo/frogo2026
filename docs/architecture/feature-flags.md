# Feature Flags

Compile-time feature flags for toggling functionality during development.

## Overview

Feature flags live in a single file and are imported where needed. They are TypeScript `const` objects, so unused code paths can be tree-shaken in production builds. There is no runtime toggle or remote config -- flags are changed in source and deployed.

## Key Files

- `src/lib/settings.ts` — defines the `FEATURES` object with all flags

## Current Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `CLASSIC_HUD` | `boolean` | `true` | Show the classic frogo.tv HUD overlay instead of the minimal on-screen remote. When enabled, `TVClient` renders `ClassicHUD` and hides the `OnScreenRemote` + broadcast lower-third. |

## Usage Pattern

```ts
import { FEATURES } from "@/lib/settings";

// Conditional rendering
{FEATURES.CLASSIC_HUD ? <ClassicHUD ... /> : <OnScreenRemote ... />}

// Conditional logic
{!FEATURES.CLASSIC_HUD && (mouseActive || showBanner) && activeVideo && (
  <LowerThird ... />
)}
```

## Important Patterns

- The `FEATURES` object is typed `as const` for literal types and full immutability.
- Flags gate entire component trees in `TVClient.tsx`, not individual props. This keeps the conditional boundary clear and avoids partial states.
- When adding a new flag, add it to the `FEATURES` object in `settings.ts` with a JSDoc comment explaining what it controls.
