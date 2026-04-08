# Pairing and Remote Control Architecture

Frogo2026 pairs a TV (desktop browser) with a phone remote, similar to how Chromecast or Apple TV pairing works. The phone acts as a channel remote -- not a media controller. There is no play/pause.

## Pairing Flow

```
┌──────────┐                              ┌──────────┐
│  TV      │                              │  Phone   │
│  Screen  │                              │  Browser │
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  1. TV creates pairing session           │
     │     (4-digit code + session ID)          │
     │                                         │
     │  2. TV displays QR code + code           │
     │     on-screen (MiniQR component)         │
     │                                         │
     │                          3. User scans  │
     │                             QR or enters │
     │                             4-digit code │
     │                                         │
     │  4. Phone opens /pair with session ID    │
     │     and joins the session                │
     │                                         │
     │◄──────── Supabase Realtime ────────────►│
     │                                         │
     │  5. Phone sends commands                 │
     │     (channel up/down, number, search)    │
     │                                         │
     │  6. TV receives commands and             │
     │     switches channels                    │
     │                                         │
```

## QR Code Generation

The TV screen needs a URL that the phone can reach. This varies by environment:

- **Production (Vercel):** The public deployment URL
- **Local dev with ngrok:** The tunnel URL from `/api/tunnel-url`
- **Local dev on LAN:** The machine's network IP from `/api/network-ip`

The QR code encodes a URL like `https://<host>/pair?code=1234&session=<id>`.

### MiniQR Behavior
- Appears on mouse movement along with other on-screen chrome
- Shows the QR code and the 4-digit code in text (for manual entry)
- Lingers for 10 seconds after the rest of the chrome fades, giving the user time to grab their phone

## Phone Remote (`/pair`)

The pair page renders a TV remote interface, not a media player:

### Controls
| Control | Action |
|---------|--------|
| Channel Up | Next channel in list |
| Channel Down | Previous channel in list |
| Number Pad (1-9) | Jump directly to channel by number |
| Search | Open search overlay to find and queue videos |

### What's Absent
- No play/pause -- the TV is always playing
- No seek/scrub -- you watch what's broadcasting
- No volume -- handled by the TV's own controls

## Session Lifecycle

1. **Creation:** TV creates a session in Supabase with a random 4-digit code
2. **Pairing:** Phone joins by matching the code, linking its connection to the session
3. **Active:** Commands flow via Supabase Realtime; TV applies channel changes
4. **Expiry:** Sessions expire after 24 hours; TV generates a new code on reload

## API Endpoints

### `/api/search` (POST)
Search for YouTube videos. Used by the phone remote's search feature.

### `/api/tunnel-url` (GET)
Returns the current ngrok tunnel URL (dev only). Used by the TV to build QR codes that work from a phone on a different network.

### `/api/network-ip` (GET)
Returns the local machine's network IP. Fallback for QR codes when ngrok is not running.
