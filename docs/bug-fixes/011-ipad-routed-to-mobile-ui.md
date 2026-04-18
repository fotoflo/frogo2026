**Date**: 2026-04-18  
**Severity**: High

**Symptom**: iPad users visiting /watch/* were redirected to /mobile instead of seeing the TV interface. The ClassicHUD and YouTube player never loaded on iPad.

**Root Cause**: `src/lib/mobile-detect.ts` used a single regex that matched `iPad` alongside phone UAs:
```
/Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i
```
This sent all iPad traffic to the phone remote UI. Additionally, even if an iPad somehow reached the TV interface, tapping the screen would not summon the HUD because `useChromeVisibility.ts` only listened to `mousemove` — which never fires on touch devices. After the initial 4s banner, the HUD would fade permanently with no way to recall it.

**The Fix**:
- `mobile-detect.ts`: exclude tablets before the phone check. iPad UA token → false. Android without "Mobile" token → false (tablets omit "Mobile", phones include it).
- `useChromeVisibility.ts`: added `touchstart` + `touchmove` listeners alongside `mousemove` so tapping/dragging on iPad keeps chrome alive.

**Key Rule**: When detecting mobile vs tablet vs desktop, check for tablet UA patterns first and exclude them — don't lump them with phones.

**Files Involved**:
- src/lib/mobile-detect.ts
- src/lib/useChromeVisibility.ts
