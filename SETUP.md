# Daily Word — Setup Guide

A distraction-free PWA that pulls the [Vanderbilt Library lectionary RSS feed](https://lectionary.library.vanderbilt.edu/category/daily-readings-rss-feed/feed/), extracts each day's Bible references, and renders the full CSB text from API.Bible.

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The whole app — HTML, CSS, JavaScript in one file. |
| `manifest.webmanifest` | PWA install metadata (name, icons, colors). |
| `sw.js` | Service worker — offline cache so today's reading stays available. |
| `icon.svg`, `icon-180.png`, `icon-512.png`, `icon-maskable-512.png` | App icons. |
| `SETUP.md` | This file. |

## 1. Try it locally first (5 minutes)

Service workers and the "Add to Home Screen" install both require the app to be served over HTTP/HTTPS — opening `index.html` by double-clicking won't quite work. Spin up a local server:

```bash
cd ~/Documents/Claude/Projects/Bible\ Reading\ App
python3 -m http.server 8000
```

Then open `http://localhost:8000` in any browser. Tap the gear icon (top right):

1. Paste your **API.Bible key** into the API Key field.
2. Tap the refresh icon next to **Translation** — the list of Bibles your key can access will load. Pick **CSB — Christian Standard Bible**.
3. Choose theme and text size.
4. Tap **Save & reload readings**.

If your key has CSB enabled, you'll see today's lectionary readings render in full CSB text. Done.

## 2. Host it so your phone (and your family) can use it

You need a public HTTPS URL. Pick whichever path is comfortable.

### Option A — Cloudflare Pages (recommended, free)

1. Create a free account at [pages.cloudflare.com](https://pages.cloudflare.com).
2. Either drag-and-drop this folder in **"Direct Upload"**, or connect a GitHub repo containing these files.
3. Cloudflare gives you a URL like `daily-word-abc.pages.dev`. That's your app.

### Option B — GitHub Pages (free, requires GitHub)

1. Create a new GitHub repo and push these files to the root.
2. Repo Settings → Pages → Source: `main` / root → Save.
3. URL will be `https://yourusername.github.io/your-repo/`.

### Option C — Netlify Drop (fastest, free, no account needed)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag this whole folder onto the page.
3. Instant URL.

## 3. Install on your iPhone

1. Open your hosted URL in **Safari** (on iOS, only Safari can install PWAs to the home screen).
2. Tap the Share icon → **Add to Home Screen** → **Add**.
3. Tap the new icon. The app launches full-screen, no browser chrome, with safe-area padding for the notch and bottom bar.
4. Open Settings (gear icon), paste your API.Bible key once, choose CSB, you're done.

To share with friends/family/your church: just send them the URL plus a short note explaining how to install (or have them grab their own free API.Bible key — see below).

## 4. About your API.Bible key

- The key lives in your browser's `localStorage` on whatever device opened the app. It is **never** sent anywhere except to `api.scripture.api.bible`.
- If you share your hosted URL with someone, **they need their own key** — there's no shared key in the app code. That's intentional: each person enters their own key in Settings. Free keys are easy at [scripture.api.bible/signup](https://scripture.api.bible/signup).
- If your hosted app is public on the internet, treat the API.Bible terms as you would any commercial API: don't redistribute scripture content as a separate product, attribute the source, and don't strip the copyright notices that the API includes.

## 5. About the RSS proxy

Browsers can't fetch the Vanderbilt RSS feed directly because the feed doesn't send the CORS header `Access-Control-Allow-Origin: *`. The app routes the request through a proxy. The default is `https://api.allorigins.win/raw?url=` — a free public proxy that's fine for personal use but can be flaky.

**For something more reliable, deploy a 20-line Cloudflare Worker as your own proxy:**

```js
// Save as worker.js in a new Cloudflare Workers project
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('?url= required', { status: 400 });
    const allowed = ['lectionary.library.vanderbilt.edu'];
    if (!allowed.some(host => new URL(target).hostname === host)) {
      return new Response('host not allowed', { status: 403 });
    }
    const upstream = await fetch(target, { cf: { cacheTtl: 600 } });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });
  },
};
```

After deploying (`wrangler deploy`), open the app's Settings → **RSS proxy** and paste:

```
https://your-worker.your-subdomain.workers.dev/?url=
```

The free Cloudflare Workers tier covers 100,000 requests/day — far more than you'll ever need.

## 6. How it works (one paragraph)

On load, the app fetches the lectionary RSS through your proxy, parses the XML, picks the item whose `pubDate` matches today (or the most recent past item as fallback), and runs a regex over the item's body to extract Bible references. Each reference is converted to API.Bible's USFM passage ID format (e.g., `Genesis 1:1-2:3` → `GEN.1.1-GEN.2.3`), and the corresponding HTML scripture content is fetched from `api.scripture.api.bible`. The HTML uses class names like `<span class="v">1</span>` for verse numbers, which the app's CSS styles as small superscript. The service worker caches today's API responses, so once you've loaded the readings you can re-open the app offline.

## 7. Troubleshooting

**"Couldn't load today's readings"** — usually a flaky public CORS proxy. Wait a minute and tap *Try again*, or set up your own Cloudflare Worker (section 5).

**Translation list is empty** — your API.Bible key was rejected. Double-check you pasted it correctly. The list comes from `GET /v1/bibles?language=eng` with your key in the `api-key` header.

**CSB isn't in the translation list** — API.Bible periodically adjusts which translations are available on the free tier. If CSB isn't visible, check your API.Bible dashboard for which Bibles are tied to your key, or pick a near alternative (NIV, NLT, ESV) for now.

**"No references found"** — the day's lectionary entry didn't match the parser's regex. Tap *Open lectionary* to see the source, and let Andrew know the date so we can extend the parser.

**Verse numbers look weird** — the parser strips a/b/c part designators (e.g., `12:1a`) before passing to API.Bible, since API.Bible passages are whole-verse only. The reference label still shows the original form so you know what was specified.

## 8. Where to go next

- **Native iOS Swift port.** When you're ready, the full UI and logic translate cleanly to SwiftUI. The reference parser is pure JS that ports to Swift in a few hours; the API.Bible calls become `URLSession` requests.
- **Push notifications** for a daily reminder. Requires the native port (iOS Safari does not yet support web push from PWAs).
- **Reading history / streaks.** Easy add — store completed dates in `localStorage` keyed by ISO date.
- **Audio reading.** API.Bible offers audio Bibles too; some translations have audio companion `audioBibles` you could surface.
