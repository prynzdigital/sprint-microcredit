# sprintmicrocredit.com

Mobile-first, SEO-optimised website for **Sprint Micro-Credit** (Accra, Ghana). It's a static site with no frameworks or runtime dependencies, so it loads fast on mobile data and runs on any cheap host.

## Quick start

```bash
node build.mjs --serve    # build + preview at http://localhost:8080
node build.mjs            # build only -> dist/
python tools/make_images.py   # regenerate icons + social image (needs Pillow)
python tools/optimize_photos.py   # resize the owner's photos into responsive WebP/JPG sets + logo + video
```

### Photos

Original photos sit in the project root, exactly as Sprint supplied them. They're kept out of git (see `.gitignore`), so keep a local copy to re-run the optimiser. **Don't upload these; only `dist/` goes online.** `tools/optimize_photos.py` has a `PHOTOS` table that maps each original to a short slug. Running it writes 480–1600px WebP + JPG/PNG versions to `src/public/assets/img/photos/` and a manifest to `src/photos.json`.

In any page, insert a responsive, lazy-loaded photo with:

```html
<!--img src="team-group" alt="Describe the photo" sizes="(min-width: 960px) 540px, 100vw" pos="50% 30%"-->
```

`pos` sets the crop focus; add `eager` for above-the-fold images.

### Icons and brand graphics

Icons are a custom SVG set in `src/partials/icons.html`. Use them anywhere with `<!--icon bolt-->`; the build stops if a name doesn't exist. The logo-inspired graphics (`speed-lines.svg`, `swoosh.svg`, `brush.svg` in `assets/img/`) are applied through CSS masks, so they can take any colour. A page's `"image": "slug"` front-matter value becomes its WhatsApp/Facebook share image.

Upload the contents of **`dist/`** to the web root (cPanel `public_html`, Netlify, Cloudflare Pages, GitHub Pages, etc.). `.htaccess` (included) handles HTTPS, `www` → bare domain, old `*.html` URL redirects, caching and compression on Apache/cPanel.

## Structure

| Path | What it is |
|---|---|
| `src/site.json` | **Single source of truth** for phone, email, address, hours, calculator limits and rate. Edit this, rebuild, done. |
| `src/pages/` | One file per page: JSON front matter (title, description, breadcrumbs…) + HTML body |
| `src/partials/` | Shared head, header, footer, calculator, article sidebar (`<!--include:name-->`) |
| `src/public/` | Static assets copied as-is (CSS, JS, images, `.htaccess`, manifest) |
| `build.mjs` | Builder: templating, JSON-LD structured data, FAQ schema, breadcrumbs, `sitemap.xml`, `robots.txt` |

## Features

- **Sales:** sticky mobile action bar (Call · WhatsApp · Calculate · Apply), Apply form that sends a pre-written application to WhatsApp (or email), CTAs on every page, and calculator → apply prefill.
- **Interactive:** loan calculator with affordability meter and repayment schedule, 4-question eligibility checker, budget planner, flat-vs-reducing interest comparator, emergency-fund planner, 6-question money quiz with WhatsApp sharing.
- **Educative:** a Learn hub with 5 Ghana-specific guides (budgeting, interest, responsible borrowing, loan scams, emergency fund).
- **SEO:** unique titles and descriptions, canonical URLs, Open Graph and Twitter cards, `FinancialService`/`LocalBusiness`, `LoanOrCredit`, `FAQPage`, `Article` and `BreadcrumbList` schema, sitemap, clean URLs, `en-GH` locale and geo tags.
- **Privacy-friendly:** no database, no cookies, no tracking. Form data only leaves the visitor's phone when they press Send.

## ⚠️ Owner to confirm

Confirmed by the owner (Oct 2026): rate 4.5%/month, the requirements list, "Ghana Card required", the call number 030 804 8980 and the address 306L Orinoco Close, Lakeside Estate, Ashale Botwe.

Still assumptions. Update them in `src/site.json` or the named page:

1. **WhatsApp number:** `whatsapp` / `whatsappDisplay` (still 059 211 1441). Every apply and contact form sends to this number.
2. **Rate basis:** 4.5% is treated as *flat per month on the amount borrowed*. If it's charged differently, the calculators and the "What you'll pay" example need changing.
3. **Affordability guideline:** `calc.affordComfortablePct` (30) and `calc.affordStretchPct` (40). This is a general guide, not Sprint's lending rule; set your own thresholds here.
4. **Loan limits and term:** `calc.min` / `calc.max` (GH₵500–20,000) and `minMonths` / `maxMonths` (1–12).
5. **Office hours:** `hoursLabel` and `hours` (Mon–Fri 8am–5pm, weekends shown as closed). If you change them, also update the two weekend rows in the hours table on the Contact page.
6. **Licence and registration:** add your Bank of Ghana licence number, if applicable. MCAG membership is taken from the 2023 MCAG good-standing list.
7. **Claims** such as "same-day payout" and "no hidden charges": keep them only if they hold in practice.

## After launch

1. Submit `https://sprintmicrocredit.com/sitemap.xml` in **Google Search Console**.
2. Create or claim a **Google Business Profile** for the Ashaley Botwe office, using the same name, address and phone as the site.
3. Put the website link in the Facebook page's About section.
4. Optional: add privacy-friendly analytics (e.g. Plausible, Cloudflare Web Analytics) to the head partial.
