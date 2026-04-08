# Pairing and Remote Control Architecture

Frogo2026 pairs a TV (desktop browser) with a phone remote, similar to how Chromecast or Apple TV pairing works. The phone acts as a channel remote — not a media controller.

## Key Files

- `src/app/watch/[slug]/TVClient.tsx` — creates pairing session, holds Realtime subscription, handles commands
- `src/app/pair/page.tsx` — phone remote UI: code entry, command sending, search
- `src/app/api/pair/route.ts` — POST creates pairing session, returns `{ code, sessionId }`
- `src/app/api/pair/join/route.ts` — POST looks up session by code, marks `paired=true`
- `src/app/api/tunnel-url/route.ts` — GET returns ngrok URL from `.ngrok-url` file
- `src/app/api/network-ip/route.ts` — GET returns LAN IP as fallback
- `src/components/MiniQR.tsx` — QR code overlay on TV screen
- `src/lib/pairing.e2e.test.ts` — e2e tests for the full pairing lifecycle

## Pairing Flow

```
┌──────────┐                              ┌──────────┐
│  TV      │                              │  Phone   │
│  Screen  │                              │  Browser │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  1. TVClient POSTs /api/pair on mount   │
     │     → 4-digit code + session UUID        │
     │     stored in pairing_sessions table     │
     │                                         │
     │  2. TV displays MiniQR (QR + code)       │
     │                                         │
     │                          3. User scans  │
     │                             QR or types  │
     │                             code at /pair│
     │                                         │
     │  4. Phone POSTs /api/pair/join           │
     │     → session marked paired=true         │
     │     → phone gets sessionId               │
     │                                         │
     │◄──────── Supabase Realtime ────────────►│
     │     TV: postgres_changes UPDATE          │
     │         on pairing_sessions row          │
     │                                         │
     │  5. Phone writes last_command +          │
     │     last_command_at directly to          │
     │     Supabase (anon client)               │
     │                                         │
     │  6. TV Realtime fires, deduplicates      │
     │     by last_command_at, calls            │
     │     handleCommand(last_command)           │
     │                                         │
```

## Command Deduplication

The TV deduplicates commands using a ref:

```ts
const lastCommandAtRef = useRef<string | null>(null);
// In Realtime handler:
if (newRow.last_command_at !== lastCommandAtRef.current) {
  lastCommandAtRef.current = newRow.last_command_at;
  handleCommand(newRow.last_command);
}
```

This prevents the same command from firing twice if the Realtime subscription reconnects or the effect re-runs.

## Realtime Subscription Lifecycle

`TVClient` creates **one persistent Realtime subscription** after the pairing session is created. The subscription is never torn down on channel switches (because `TVClient` never unmounts — channel switching is pure state). It is only cleaned up when the component unmounts (browser tab close/navigate away).

Subscription channel name: `pairing:${sessionId}`, filtering on `pairing_sessions.id = sessionId`.

## Commands Reference

| Command | Action |
|---------|--------|
| `next` | Next channel (wraps around) |
| `prev` | Previous channel (wraps around) |
| `channel_1` … `channel_9` | Jump to channel by 1-based number |
| `navigate_{slug}` | Jump to channel by slug (used by search results) |

There is no play/pause command — the TV is always broadcasting. The phone remote also does not expose volume.

## QR Code URL Resolution

The TV screen needs a URL that the phone can reach. `MiniQR` resolves the host in priority order:

1. `/api/tunnel-url` — ngrok URL written to `.ngrok-url` by `scripts/dev.mjs` (works cross-network)
2. `/api/network-ip` — LAN IP (works on same WiFi)
3. `window.location.host` — localhost fallback

The QR code encodes `https://<host>/pair?code=XXXX`. Scanning it opens `/pair` with the code pre-filled, triggering auto-pair on mount.

## Phone Remote UI (`/pair`)

### Pre-pairing screen
- 4-digit numeric input with large font
- Debug log panel showing request/response details
- Auto-pairs immediately if `?code=XXXX` is in the URL (from QR scan)

### Post-pairing remote
- **Status bar**: green pulse, "Connected - live" when Realtime is subscribed; Unpair button resets all state to show the code entry screen again
- **Search panel** (toggle): debounced 300ms search via `/api/search?q=`, results navigate by `navigate_{slug}` command
- **Channel Up/Down**: large touch targets, sends `prev`/`next`
- **Number pad 1–9**: sends `channel_N`
- **Debug toast**: 2-second overlay confirming each command sent or showing Supabase error

Commands are written directly to Supabase via the anon client (no API route hop):

```ts
await supabase.from("pairing_sessions").update({
  last_command: command,
  last_command_at: new Date().toISOString(),
}).eq("id", sessionId);
```

## Session Lifecycle

1. **Creation**: TV POSTs `/api/pair` on mount (never repeated — component never remounts on channel switch)
2. **Pairing**: Phone POSTs `/api/pair/join` with code → session row updated: `paired=true`, `mobile_session_id` set
3. **Active**: Commands flow via Supabase Realtime UPDATE events; TV applies channel changes
4. **Expiry**: Sessions have an `expires_at` column; `/api/pair/join` rejects expired sessions. TV generates a new code on browser reload.
5. **Unpair**: Phone-side only — clears local state, returns to code entry. No server-side session deletion.

## Supabase Setup Requirements

- Table: `pairing_sessions` — columns: `id` (uuid), `code` (text), `desktop_session_id` (uuid), `mobile_session_id` (uuid), `paired` (bool), `last_command` (text), `last_command_at` (timestamptz), `expires_at` (timestamptz)
- Realtime must be enabled with `REPLICA IDENTITY FULL` (so `payload.new` contains all columns)
- RLS: open SELECT/INSERT/UPDATE policies (session UUID is the security boundary)
- Two clients: anon client for phone writes + Realtime; service role client for session creation in API routes

## E2E Tests (`src/lib/pairing.e2e.test.ts`)

Five tests covering the full lifecycle against a live Supabase instance:

1. Creates a pairing session
2. Phone joins session by code and marks paired
3. Command flows from phone to TV via Realtime (single command)
4. Multiple commands in sequence
5. Expired session rejects join

Tests load `.env.local` directly (no dotenv dependency) and clean up created rows in `afterEach`.

Run: `npx vitest run src/lib/pairing.e2e.test.ts`

## API Endpoints

### `POST /api/pair`
Creates a pairing session. Called by `TVClient` on mount. Returns `{ code, sessionId }`.

### `POST /api/pair/join`
Looks up session by 4-digit code, validates not expired, marks `paired=true`. Returns `{ sessionId }` or `{ error }`.

### `GET /api/tunnel-url`
Returns the current ngrok tunnel URL read from `.ngrok-url` file (dev only).

### `GET /api/network-ip`
Returns the local machine's network IP. Fallback for QR codes when ngrok is not running.

### `GET /api/search?q=`
Full-text search across videos. Used by the phone remote's search feature.
