# Daily Word — Setup Guide

A distraction-free PWA that pulls the [Vanderbilt Library lectionary RSS feed](https://lectionary.library.vanderbilt.edu/category/daily-readings-rss-feed/feed/), extracts each day's Bible references, and renders the full CSB text from API.Bible. As of v6, all configuration lives in `api.php` on the server — end users have nothing to set up.

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The whole client app — HTML, CSS, JavaScript in one file. |
| `api.php` | **Server-side endpoint.** Holds the API.Bible key, proxies the RSS feed, and renders CSB passages. The only thing the client talks to. |
| `manifest.webmanifest` | PWA install metadata (name, icons, colors). |
| `sw.js` | Service worker — offline cache for app shell + previously-viewed passages. |
| `icon.svg`, `icon-180.png`, `icon-512.png`, `icon-maskable-512.png` | App icons. |
| `SETUP.md` | This file. |

If you have an old `proxy.php` from earlier versions on your server, **delete it** — `api.php` replaces it.

## 1. One-time configuration (5 minutes, developer only)

Open `api.php` in a text editor. Near the top you'll find two constants to fill in:

```php
const API_BIBLE_KEY = '';   // ← your API.Bible key
const BIBLE_ID      = '';   // ← the CSB Bible ID
```

### Step 1: Set your API.Bible key

Paste your key from [scripture.api.bible](https://scripture.api.bible) into `API_BIBLE_KEY`. You can also leave the constant empty and set the `API_BIBLE_KEY` environment variable on your host instead — useful if you don't want the key in the source file.

### Step 2: Find and set the CSB Bible ID

Upload `api.php` to your server, then visit:

```
https://yourdomain.example/api.php?action=bibles
```

You'll get a JSON list of every English Bible your key can access. Find the entry whose `name` contains "Christian Standard Bible" and copy its `id` field — it'll look something like `a556c5305ee15c3f-01`. Paste that ID into `BIBLE_ID` in `api.php` and re-upload.

That's it. From now on the app is fully configured server-side and any visitor just opens the page.

## 2. Hosting

You can host the whole folder on virtually any web host that supports PHP. Two options:

### Option A — Your existing PHP host (likely the easiest)

Drop the entire folder onto your web server via FTP/SFTP/cPanel. As long as the server can run PHP 7.0+ with the cURL extension (which is essentially every shared host on earth), you're done.

### Option B — Cloudflare Pages + a tiny PHP-on-Workers, or any static host with a PHP function

If you want HTTPS-with-a-CDN edge for the static pages and a serverless function for `api.php`, that works too — Cloudflare Pages, Vercel, Netlify all support this with minor adjustments to the API endpoint URL. Most users won't need this; the app expects `api.php` to live at the same origin as `index.html`.

## 3. Cache directory

`api.php` writes a `cache/` directory next to itself to memoize feed and passage responses. Make sure that directory is writable by the PHP user (typically `chmod 775 cache` after creation, or just let `api.php` create it on first request). The cache cuts down on API.Bible round trips dramatically — most passages will be served instantly from disk after the first view.

## 4. Sharing it

The app has no per-user setup. Send anyone the URL — they open it in Safari (iOS) or any browser, and they get today's reading immediately. To install on iPhone:

1. Open the URL in **Safari** (not Chrome — Safari is the only iOS browser that can install PWAs).
2. Tap Share → **Add to Home Screen** → **Add**.
3. Tap the new icon. The app opens full-screen with safe-area padding.

When you push a new version to your server, users receive it on next launch (the service worker fetches the updated shell after the cached version is served, then applies on next visit).

## 5. How it works (one paragraph)

The client (`index.html`) loads, calls `./api.php?action=feed` to get the lectionary RSS, parses the XML, and picks the item whose `pubDate` matches today (with a fallback to the most recent past item). It runs a regex over the item body to extract Bible references, converts each into API.Bible's USFM passage ID format (e.g., `Genesis 1:1-2:3` → `GEN.1.1-GEN.2.3`), and calls `./api.php?action=passage&id=GEN.1.1-GEN.2.3` for each one. The PHP layer holds the API.Bible key, prepends the `api-key` header, fetches from `https://rest.api.bible/v1`, caches the JSON response on disk, and returns it to the client. The client renders the passage HTML with custom typography. The hamburger menu lists every item from the feed (typically the last ~30 days), letting the reader tap any past day to view those passages.

## 6. Architecture choices

### Why PWA over native iOS

- **Friction-free sharing.** A URL works on any device, any OS, any browser. App Store distribution requires Apple Developer enrollment, review, and is more constrained for religious-content apps.
- **Instant updates.** Push to server → users get it on next launch. No App Store review queue.
- **CSB licensing is cleaner.** API.Bible's terms are friendlier toward private/non-commercial deployments than App Store distribution.
- **iOS 16.4+ supports web push,** so daily-reading reminders are technically possible without going native.

The codebase is structured cleanly enough that a future Swift port would only need to re-implement the UI and reference parser; the `api.php` backend stays exactly as is and the Swift app just calls the same endpoints.

### Why the API.Bible key is server-side

If the key were in client-side JS, anyone who views source could extract it and burn through your API.Bible quota under your name. Holding it in `api.php` means the key never leaves your server — the client only sees passage HTML.

### Why the cache

Lectionary readings repeat year over year. Once a verse is fetched, it shouldn't change. The `cache/` directory holds 30-day-TTL passage responses, so re-reading the same day costs nothing.

## 7. Troubleshooting

**"Couldn't load today's readings"** — your `api.php` is unreachable or returning an error. Visit `./api.php?action=feed` directly in a browser to see the actual response. If you see "Server not configured: API_BIBLE_KEY is empty," your key didn't get set.

**Passages return HTTP 401** — the API.Bible key in `api.php` is wrong or the email-verification step on your API.Bible account hasn't been completed.

**Passages return HTTP 400 "invalid passage id"** — `api.php` enforces an allowlist on the id format. If you see this, send Andrew the date so we can extend the parser.

**Cache directory not writable** — check that the `cache/` directory next to `api.php` is writable by the PHP user. The app still works without it, just slower.

**"No references found" for a specific day** — the day's lectionary entry didn't match the parser's regex. Tap *Open lectionary page* to see the source, and let Andrew know the date.

## 8. Where to go next

- **Reading history / streak tracking.** Track which days the reader has opened, show a streak counter.
- **Daily-reminder push notification.** iOS 16.4+ supports web push from PWAs; needs a small additional service-worker handler and a notification permission flow.
- **Audio readings.** API.Bible exposes audio Bibles too — could add a "listen" button per passage.
- **Native iOS port.** Becomes worthwhile if usage justifies widgets, lock-screen integration, or App Store discovery. The `api.php` backend stays unchanged.
