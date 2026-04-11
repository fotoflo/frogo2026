# Bug Fix 007: MCP OAuth Consent Redirect Used 307 Instead of 303

**Date:** 2026-04-11
**Severity:** High — Claude.ai remote connector could not complete the OAuth handshake for frogotv at all
**Status:** Fixed

---

## Symptom

Connecting frogotv as a remote MCP server in Claude.ai walked the user all the way through the OAuth flow — authorize, consent screen, click "Approve" — and then failed at the very last step with a generic Anthropic error envelope:

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Method Not Allowed"
  },
  "request_id": "req_011..."
}
```

No useful detail. Just "Method Not Allowed" attached to an Anthropic request_id, as if the failure were happening inside Anthropic's API. The consent screen itself rendered correctly and the user's approval POST hit the frogotv backend cleanly — everything on our side looked like a 200.

---

## Root Cause

`POST /api/oauth/consent` is the handler that processes the Approve / Deny button from the consent screen. On approve, it mints an authorization code and redirects the browser back to Claude.ai's callback URL (`https://claude.ai/api/mcp/auth_callback?code=...&state=...`). The redirect was written as:

```ts
// src/app/api/oauth/consent/route.ts — before
return NextResponse.redirect(callbackUrl);
```

`NextResponse.redirect()` defaults to **HTTP 307 Temporary Redirect**. 307 is the "preserve method and body" redirect — it tells the browser to repeat the exact same request (method, headers, body) at the new URL. So the chain became:

1. Browser `POST`s the approve form to `/api/oauth/consent`
2. Handler responds `307 Location: https://claude.ai/api/mcp/auth_callback?code=...`
3. Browser obediently re-issues as `POST https://claude.ai/api/mcp/auth_callback?code=...`
4. Claude.ai's callback only accepts `GET` → returns `405 Method Not Allowed`
5. Anthropic's API wraps that 405 in the generic `invalid_request_error` envelope and surfaces it as the OAuth flow's final error

The correct status for a POST handler redirecting to a GET URL is **303 See Other**. 303 explicitly tells the browser "the new resource is at this URL — go GET it" regardless of the original method. That's the whole point of Post/Redirect/Get.

---

## Why It Was Hard to Find

1. **The error surfaced inside Anthropic's infrastructure.** The failure message came back as `request_id: req_011...` from `api.anthropic.com`, not from our ngrok tunnel. It looked like an Anthropic-side bug, so early debugging hunted on the wrong server.
2. **"Method Not Allowed" gave no URL.** The error envelope doesn't say which method, which URL, or which hop failed. Could have been token exchange, could have been resource metadata, could have been the callback itself.
3. **Our handler looked fine in logs.** `POST /api/oauth/consent` returned a clean 307 with a valid `Location` header. No error was logged on our side because nothing on our side failed — we handed the browser a perfectly-formed (but wrong-coded) redirect.
4. **307 is invisible in most codebases.** Everybody writes `NextResponse.redirect(url)` without thinking about the status. It silently works for GET-to-GET flows (which is 90% of redirects), so the default is almost never questioned. The bug only bites when a POST handler redirects.
5. **End-to-end trace was required.** Diagnosing it meant tailing ngrok, watching the browser network panel, and stepping through the exact request that hit `claude.ai/api/mcp/auth_callback` to see it was a `POST` instead of a `GET`. Only then did the 307 → POST → 405 chain become visible.

---

## The Fix

Pass `303` explicitly as the redirect status for both branches of `POST /api/oauth/consent`:

### `src/app/api/oauth/consent/route.ts`

```ts
// Before — both approve and deny branches
return NextResponse.redirect(callbackUrl);

// After
return NextResponse.redirect(callbackUrl, 303);
```

303 See Other is the canonical Post/Redirect/Get status. The browser receives `303 Location: https://claude.ai/api/mcp/auth_callback?code=...`, issues a `GET` to that URL, Claude.ai's callback accepts the GET, the OAuth flow completes, and the MCP connector is installed successfully.

---

## Key Rule

**Any redirect from a POST handler must be 303, not 307.** `NextResponse.redirect()`'s default status is 307, which preserves the HTTP method — that's fine for GET-to-GET redirects but catastrophically wrong for form POST handlers, because the browser will re-POST the body to a URL that almost certainly only accepts GET.

Rule of thumb:

- `GET` handler redirecting → default (307) is fine
- `POST` / `PUT` / `DELETE` handler redirecting to a GET URL → **always pass `303` explicitly**
- `POST` handler redirecting and you genuinely want the body replayed → use `307` on purpose (rare)

And when an error comes back from an upstream API with no detail, assume it's wrapping a lower-level HTTP failure and trace the actual request chain through whatever tunnel or proxy is in the middle (`ngrok http` inspector, browser devtools network tab). The generic envelope will never tell you which hop 405'd.

---

## Files Involved

- `src/app/api/oauth/consent/route.ts` — the POST handler whose `NextResponse.redirect()` call needed an explicit `303` status on both the approve and deny branches
