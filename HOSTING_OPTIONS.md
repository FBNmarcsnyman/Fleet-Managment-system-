# FBN Fleet — Hosting Options (plain English)

The app is a **static web app** (built files + talks to Supabase). Any static
host works. What differs: free-tier size, auto-deploy, cost, and setup effort.
Scale assumed: internal team app (handful–dozens of users), modest traffic, but
**frequent rebuilds while we're actively building**.

| | Cost at FBN scale | Auto-deploy on push | Setup effort | Commercial use OK | Notes |
|---|---|---|---|---|---|
| **Cloudflare Pages** | **$0** (unlimited bandwidth) | ✅ built-in | Low (~10 min) | ✅ yes | Biggest free tier; 500 builds/mo; your domain free |
| **Firebase Hosting (Google)** | $0 free tier, or ~a few $/mo if it grows | ✅ via a GitHub Action I add | Medium | ✅ yes | Under your FBN Google org; one bill with Gemini + Maps |
| **Vercel (current)** | Free tier **hit its limit**; Pro ~$20/user/mo | ✅ built-in | None (already set up) | ⚠️ Hobby is **non-commercial**; a company should be on Pro | Easiest, but free plan isn't really meant for company use |
| **xneelo (your web host)** | $0 extra (already paid) | ⚠️ only via a GitHub Action FTP upload | High (fiddly) | ✅ yes | No native deploy; needs FTP automation + .htaccess |

## What "who manages what" looks like
- **Cloudflare Pages:** you create a free Cloudflare account → connect the GitHub repo → I set the build settings (`vite build`, output `dist`) → you paste the 4 env vars (Gemini, Maps, Supabase URL + key) → point your domain. Done.
- **Firebase:** you/IT create a Firebase project under the FBN Google org + turn on billing → I add a GitHub Action + config → you add one Google "service account" secret to GitHub → env vars as Action secrets. More moving parts, all Google.
- **Vercel Pro:** click upgrade, pay ~$20/mo, everything we built goes live immediately. Zero migration.
- **xneelo:** I add a GitHub Action that builds and FTPs to your hosting → you give the FTP details as GitHub secrets → I add an `.htaccess`. Most fiddly.

## Honest recommendation
1. **Cheapest + least likely to ever hit a limit + easy:** **Cloudflare Pages** ($0, unlimited bandwidth, commercial OK).
2. **If you want everything under Google** (since AI + Maps are already Google): **Firebase Hosting** — likely free or a few rand/dollars a month, just a bit more setup.
3. **Fastest right now, zero migration:** **upgrade Vercel to Pro** (~$20/mo) — but note the free plan you're on isn't intended for company use anyway, so you'd want Pro to stay.

**Important:** Vercel's free (Hobby) plan is for personal/non-commercial use. An FBN
company app should be on Vercel **Pro**, or moved to Cloudflare/Firebase. That —
not a bug — is most likely why it got limited.

Key takeaway: **all of these keep the same push-to-deploy workflow** you already
have. The only question is free-tier size, which ecosystem, and a one-time setup.
