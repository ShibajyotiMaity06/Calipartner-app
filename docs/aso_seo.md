# CaliPartner — ASO and SEO Playbook

**24 Oct 2026 · what to do, in order, with copy you can paste · cost: ₹0 for everything here except your time**

ASO (App Store Optimization) gets people to find and install the app from the Apple App Store and Google Play. SEO gets people to find your **website** on Google. They help each other: the website ranks for your brand and for Indian-food nutrition searches, and every visitor is one tap from the store.

> **What I could and could not check.** Field limits and best practice below come from current guides (sources at the end) plus the stores' own consoles, which are the final authority: **confirm every limit in App Store Connect and Play Console before you submit.** I could **not** pull real keyword search volumes from here. Section 3 shows you how to get them free in about an hour. I do not know your domain or your website's tech, so I use `yourdomain.com` and give notes for Next.js.

---

## 0. The plan in one page

1. **Pick the strategy (Section 1).** Google Play first for India (most Indian phones are Android); the App Store matters for the US, UK, Gulf and Singapore, which are your highest-paying users (about 41% of base-case cash in the pricing plan).
2. **Fix names, accounts and policy pages** (Section 2). These block submission, so do them first.
3. **Find your keywords** (Section 3), then **write the listing** (Section 4) and **make the screenshots** (Section 5).
4. **Build the website** (Section 6), then the **food pages** (Section 7), which are your biggest free search opportunity.
5. **Collect ratings the right way** (Section 8) and **measure weekly** (Section 9).
6. **Run one ASO test and one content drop a month**, tied to your feature releases (Section 10).

**Rule for everything:** only describe features that are **live in the build you submit**. You are releasing features monthly, so update the listing each time. Reviewers reject listings that promise things the app does not do.

---

## 1. Strategy

| Question | Decision |
|---|---|
| Which store first? | **Google Play** for India, **App Store** at the same time for dollar markets. Do both listings properly; do not skip iOS because India is Android-heavy |
| Which languages? | English (India) first. Add **Hindi** (listing text and screenshots) in month 2 to 3. Add English (US/UK) tweaks where the wording differs (for example "gym buddy"). Other Indian languages later |
| What do people search for? | Three groups: **tracking** ("calorie counter", "food diary", "indian food calories"), **goals** ("weight loss diet", "fat loss", "diet plan"), **social** ("gym partner", "workout buddy", "accountability partner"). You will rank easier in the social group because few apps target it, but the tracking group has the volume |
| What is your difference? | Indian food first, a **partner or room** to keep you accountable, and a free plan that really works. Say that in the first screenshot and the first line of the description |
| Where do you win early? | Long phrases with low competition: "indian food calorie counter", "gym partner app", "workout buddy", "diet partner". Do not fight "calorie counter" alone on day one |
| What not to do | No paid ads for now (the pricing plan shows they do not pay back in India). ASO and SEO are free. Test Apple Ads only with a tiny budget to learn which keywords convert |

---

## 2. Before you submit (blocking items)

### 2.1 Name, accounts and legal
- [ ] **Check "CaliPartner" is free** on both stores, on Google, and in your trademark search (India: IP India public search; also check the US). Check the domain and the Instagram, YouTube and X handles too.
- [ ] Apple Developer Program ($99 a year) and Google Play developer account ($25 once) are active; business or individual details match your bank and tax details.
- [ ] **Privacy policy URL** (public web page, not a PDF download). Must cover the data you collect: account, food logs, weight, photos, location if GPS is on, AI processing, analytics, how to delete.
- [ ] **Terms of use URL** (needed for subscriptions) and a **Support URL** (page with a real contact email or form).
- [ ] **Account-deletion page**: Google Play requires a public web URL where a person can request deletion of their account and data; Apple requires in-app deletion. Build both.
- [ ] **Apple "App Privacy" labels** and **Google "Data safety" form**: fill from your PRD data list. Health and fitness data (food, weight, steps) must be declared accurately. Google also asks health apps to complete a health apps declaration; check Play Console for the current form.
- [ ] Subscription disclosure inside the app and the listing: price, length, auto-renewal, how to cancel, links to terms and privacy (the description in 4.4 includes this).
- [ ] Age rating questionnaires completed honestly (food logging, user chat, user-generated content).
- [ ] A **demo account** and short review notes for Apple and Google (how to reach rooms, the paywall, and any Pro feature, with a test purchase path).

### 2.2 Things reviewers reject for (avoid)
- Screenshots or text that show features not in the build, or claims like "#1", "best", "free" in the title, price in the title, emojis or ALL CAPS in the title.
- Medical or weight-loss promises ("lose 10 kg in 10 days"). Your PRD safety rules apply to marketing too.
- Competitor names in your title, subtitle, keywords or description.
- Fake, bought or incentivised reviews, or asking only happy users to rate.

---

## 3. Keyword research (about 2 to 3 hours, free)

### 3.1 Build the list
1. **Seed list** (start here, then expand):
   - Tracking: calorie counter, calorie tracker, food diary, macro tracker, protein tracker, indian food calories, roti calories, dal calories, barcode scanner food, water tracker, step counter
   - Goals: weight loss, fat loss, diet plan, meal plan, intermittent fasting, healthy recipes indian, high protein vegetarian
   - Social: gym partner, workout buddy, accountability partner, fitness challenge, diet partner, workout with friends, streak tracker
2. **Mine competitors** (do not copy names into your listing): open HealthifyMe, MyFitnessPal, Cult.fit, FITTR and one social fitness app (Strava or Hevy) on both stores. Copy into a sheet: their title, subtitle, short description, first 3 screenshots, and **the 1-star and 3-star reviews**. Complaints ("too many ads", "can't find Indian foods", "paywall for basic logging") are your messages and your keywords.
3. **Autocomplete**: type each seed into the App Store search, Google Play search and Google; copy the suggestions. These are what real people type.

### 3.2 Get volume and difficulty (free)
- **Apple Ads (Advanced) keyword suggestions with popularity scores**: a free account is enough to see them; you do not have to spend. Check Apple's current interface.
- **Google Keyword Planner** (free with a Google Ads account) and **Google Trends** for web terms.
- **Play Console "Search terms" report** and **App Store Connect Analytics** after launch show what really brings installs. These are the best data you will get.
- Paid tools (AppTweak, Sensor Tower, AppFollow, ASOMobile) have free tiers or trials. Use one trial month if you want rank tracking.

### 3.3 Score and choose
Make a sheet with columns: keyword, popularity or volume, difficulty (how strong are the top 5 apps), relevance (1 to 3), your priority. Keep terms with **high relevance and moderate difficulty**. Group them into 3 or 4 themes. The strongest theme goes in the title, the next in the subtitle, the rest in the keyword field (Apple) or the descriptions (Google).

---

## 4. The store listing (copy you can paste)

Everything below is a **starting draft**. Character counts are checked. Replace after Section 3 shows real volumes.

### 4.1 Apple App Store (App Store Connect → App Information and the version page)

| Field | Limit | Draft | Chars |
|---|---|---|---|
| App name | 30 | `CaliPartner: Calorie Tracker` | 28 |
| Subtitle | 30 | `Diet, workouts & gym buddy` | 26 |
| Keywords | 100 | `counter,partner,fitness,macro,food,diary,indian,weight,loss,steps,water,fasting,streak,nutrition` | 96 |
| Promotional text (editable any time, not searchable) | 170 | `Log Indian meals in seconds, find a workout partner and keep each other going with streaks, rooms and a weekly leaderboard. Start your 7-day trial.` | 147 |
| Description | 4,000 | See 4.4 (not searchable on iOS; it is for conversion) | 1496 |
| What's New | 4,000 | Short, specific, human (template in 4.6) | |

**How Apple search works (practical rules):**
- The **name, subtitle and keyword field** are searchable. The description is **not**. Screenshot text is not indexed, but the first 1 to 3 screenshots appear in search results and decide whether people tap.
- Do **not repeat a word** across name, subtitle and keywords; repeating adds nothing. Separate keywords with commas and **no spaces**. Apple combines words from different fields into phrases (for example "calorie" from the name and "counter" from the keyword field gives "calorie counter").
- Use one form of a word (singular or plural); check in the console that both are covered.
- **Do not put your brand name or words already in the title** into the keyword field.
- Review text is also read by the algorithm, so what users mention in reviews (for example "indian food") helps relevance.
- Alternative if you want the social angle first: name `CaliPartner: Fitness Partner` (28 chars) with subtitle `Calorie & workout buddy` (23 chars). Test one of the two later (Section 10).

### 4.2 Google Play (Play Console → Grow → Store presence → Main store listing)

| Field | Limit | Draft | Chars |
|---|---|---|---|
| App name | 30 | `CaliPartner: Calorie Counter` | 28 |
| Short description | 80 | `Track Indian food & workouts with a partner. Streaks, rooms and leaderboards.` | 77 |
| Full description | 4,000 | See 4.4 | 1496 |
| Feature graphic | 1024 × 500 | Silver-on-steel brand image with the app name and one line | |
| Icon | 512 × 512 | Same as Apple's | |

**How Google Play search works:** Google reads the **full text of the title, short description and full description** (there is no hidden keyword field). Put your main phrases in the title and short description, then use the keywords **naturally** a few times in the full description. Stuffing hurts both ranking and approval. Ratings, install volume, retention and update freshness also matter, so ship updates regularly (your monthly release plan covers this).

### 4.3 Hindi listing (month 2 to 3; have a native speaker check every line)

| Field | Draft | Chars |
|---|---|---|
| Apple name / Play title | `CaliPartner: कैलोरी ट्रैकर` | 26 |
| Apple subtitle | `डाइट, वर्कआउट और जिम पार्टनर` | 28 |
| Play short description | `भारतीय खाना और वर्कआउट ट्रैक करें, पार्टनर के साथ। स्ट्रीक, रूम, लीडरबोर्ड।` | 75 |

Also add a Hinglish keyword set in the Hindi listing (for example `kaise,khana,calorie,vajan,gym`), since many Indians type Hindi words in English letters. Localise the **screenshots** too, not just the text.

### 4.4 Description draft (works for both stores)

Edit the bracketed lines. The first 3 lines are what shows before "more", so the hook is in the first sentence.

```text
Eating well and training are easier with someone on your side. CaliPartner is a calorie tracker and workout app built for Indian food, with a partner or a small room to keep you going.

TRACK WHAT YOU EAT
• Log breakfast, lunch, dinner and snacks in seconds
• Search Indian foods first: roti, dal, sabzi, idli, biryani and more
• Scan barcodes, save your own foods and re-log favourites in one tap
• See calories, protein, carbs and fat against your daily target
• Water, steps and distance in one place

TRAIN AND MOVE
• Log workouts, sets and your weight
• Follow your progress in simple graphs
• [Add only when live] Track walks, runs and rides with GPS

KEEP EACH OTHER GOING
• Find a partner or start a room with friends
• See your day and theirs side by side
• Streaks, a weekly leaderboard and challenges
• [Add only when live] Focus sessions you can run together

GO FURTHER WITH PLUS AND PRO
• Plus: rooms, Partner Finder, the full recipe library, fasting, meal planner and workout routines
• Pro: AI photo logging and an AI coach (daily limits apply)
Both start with a 7-day free trial.

SAFE BY DESIGN
Calorie targets stay within safe weekly rates. CaliPartner is not medical advice. Talk to a doctor or dietitian before changing your diet.

Subscriptions: Plus and Pro renew automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel in your App Store or Google Play account settings. Terms: [your terms URL]. Privacy: [your privacy URL].
```

### 4.5 Page checklist (both stores)
- [ ] Icon: simple, one shape, readable at small size, uses your **Steel + Silver** palette (no tiny text). Apple 1024 × 1024 with no rounded corners and no transparency; Google 512 × 512.
- [ ] First 3 screenshots tell the whole story (Section 5).
- [ ] **App preview video**: reuse your 20-second reel, cut to 15 to 30 seconds with captions (many people watch without sound). Apple allows up to 3 previews; Google uses a YouTube link.
- [ ] Category: **Health & Fitness** on both. Add Food & Drink as secondary only if the store lets you and it fits.
- [ ] Contact email, website, privacy URL, support URL set.
- [ ] Pricing shown correctly; subscription names match the paywall (Plus, Pro).
- [ ] Country availability: start with India plus the dollar markets you can support in English.

### 4.6 "What's New" template (every release)
```text
New this month: [one feature, in plain words].
Also: [two fixes or improvements, in plain words].
Thank you for your feedback. Reply from Settings > Help.
```
Do not write "bug fixes and performance improvements" alone; users and the algorithm both notice updates, so say what changed.

---

## 5. Screenshots, video and icon

The first 3 screenshots decide most installs. Use big captions of **6 words or fewer**, a phone frame, and the Steel + Silver palette (steel background, silver caption text, seafoam only for the partner's data).

| # | Caption | Show | Why |
|---|---|---|---|
| 1 | **Log Indian food in seconds** | Today screen with the calorie ring and roti or dal search | Your main use and your difference |
| 2 | **Train with a partner** | Side-by-side view of you and your partner | Your unique idea |
| 3 | **Keep each other on track** | Streak, weekly leaderboard, room | Retention story |
| 4 | **Scan, search, re-log** | Barcode scan and quick re-log | Speed |
| 5 | **Workouts and progress** | Workout log and weight graph | Breadth |
| 6 | **Healthy Indian recipes** | Recipe library (Plus) | A reason to pay |
| 7 | **Rooms for friends and family** | Room chat and progress | Social |
| 8 | **Free plan that works** | Free vs Plus summary | Trust (only if you want to say it) |

Add a Pro screenshot ("Snap your meal, we log it") **only after Pro is live**.

**Sizes:** App Store Connect shows the exact required sizes (currently the largest iPhone size, plus iPad only if the app supports iPad). Google needs 2 to 8 phone screenshots; export at high resolution. Use real screens from the app, not mock features. Build all captions in one Figma file so Hindi versions are a text swap.

**Do:** consistent style, readable on a small screen, one idea per screenshot.
**Don't:** crowd the frame, show features not live, put a price or "free" claim that is not true.

---

## 6. Website SEO (technical and structure)

### 6.1 Pages to build (launch)
| URL | Purpose |
|---|---|
| `/` | Home: one-line promise, 3 benefits, screenshots, store buttons, "Free plan, Plus and Pro" summary |
| `/features` | Food tracking, partner and rooms, workouts, recipes (one section each, with its own heading) |
| `/pricing` | Free, Plus, Pro, FAQ (what happens after the trial, how to cancel) |
| `/download` | Store buttons and a QR code |
| `/foods/` | Indian food nutrition pages (Section 7) |
| `/blog/` | Guides and articles (Section 7.4) |
| `/about`, `/contact`, `/support` | Trust pages, with a real name and email |
| `/privacy`, `/terms`, `/delete-account` | Required by the stores |
| `/join/[code]` | Invite landing page (opens the app or shows store buttons; **noindex**) |

### 6.2 Technical checklist
- [ ] HTTPS everywhere; one canonical domain (choose `www` or not and redirect the other).
- [ ] **Server-rendered or statically generated pages** (Next.js `generateMetadata`, `sitemap`, `robots`). Do not rely on client-only rendering for page content.
- [ ] Unique **title** (about 50 to 60 characters) and **meta description** (about 150 to 160 characters) on every page; one `h1` per page; clear `h2` structure.
- [ ] `sitemap.xml` listing all indexable pages; `robots.txt` that allows the site and links to the sitemap.
- [ ] Canonical tag on every page; no duplicate pages for the same food.
- [ ] **Core Web Vitals in the "good" range** (Google's thresholds: largest paint 2.5 s or less, interaction delay 200 ms or less, layout shift 0.1 or less). Compress images (WebP or AVIF), set image sizes, use few scripts, host on a fast CDN (Cloudflare or Vercel).
- [ ] Mobile-first design; test on a mid-range Android phone on 4G.
- [ ] Open Graph and Twitter card tags with a clean image for sharing.
- [ ] Alt text on images; descriptive link text.
- [ ] `hreflang` tags when the Hindi pages exist (`en-IN`, `hi-IN`, plus `en` for others).
- [ ] 301 redirects when a URL changes; custom 404 page with search and links.
- [ ] Register **Google Search Console** (domain property) and **Bing Webmaster Tools**; submit the sitemap; check "Pages" and "Core Web Vitals" weekly.
- [ ] Analytics (PostHog or GA4) with a consent banner if needed for your audience.

### 6.3 Structured data (JSON-LD)
Add `Organization` (name, logo, links) on every page and `BreadcrumbList` on inner pages. For the app, add `MobileApplication` on `/` and `/download` only when you have **real** rating data (Google needs genuine ratings for the app rich result; never invent them). Check each page in Google's **Rich Results Test**.

```json
{
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "name": "CaliPartner",
  "operatingSystem": "iOS, Android",
  "applicationCategory": "HealthApplication",
  "description": "Calorie tracker and workout app for Indian food, with a partner or room to keep you going.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "REAL_VALUE", "ratingCount": "REAL_COUNT" }
}
```
Remove `aggregateRating` until you have real ratings.

### 6.4 Connect the website to the apps
- **Universal links (iOS) and App Links (Android)** so invite links open the app: host `/.well-known/apple-app-site-association` (JSON, no file extension) and `/.well-known/assetlinks.json`, then add the associated domain in the iOS config and `autoVerify` intent filters in the Android config (Expo supports both).
- **Smart App Banner** meta tag for Safari on iPhone: `<meta name="apple-itunes-app" content="app-id=YOUR_APP_ID">`.
- Invite links look like `yourdomain.com/join/CODE`. If the app is not installed, the page shows the store buttons and keeps the code (deferred deep link) so the person lands in the room after install.
- Tag links with **UTM parameters** for the website, **Apple campaign tokens** for App Store links and the **Play install referrer** for Google Play, so you see which page or post produced installs.
- Show the same name, icon and one-line promise on the site, the store and social profiles (brand consistency helps people trust and search for you).

---

## 7. Content: the food pages are your biggest free opportunity

People in India search "[food] calories" constantly, and your app has the data and the audience. Done carefully, pages for Indian foods can bring steady organic installs. Done carelessly (thousands of near-identical pages), Google treats them as spam. So: **start small, make every page genuinely useful, and expand only what works.**

### 7.1 Page plan
1. **Pilot: 30 to 50 pages** (the foods people eat daily): roti or chapati, paratha, rice, dal, rajma, chole, sambar, idli, dosa, poha, upma, paneer, egg, chicken curry, biryani, samosa, banana, milk, curd, and so on.
2. **Wait 6 to 8 weeks.** Look in Search Console at which pages get impressions and clicks and which are indexed.
3. **Expand to 300 to 500 pages** in the types that work. Improve or remove pages that earn nothing after a fair test (do not keep thin pages).
4. Add Hindi versions (`/hi/foods/...`) for the best pages.

### 7.2 What every food page contains (template)
- **H1**: "[Food] calories and nutrition" (example: "Roti calories and nutrition").
- **Quick answer box** at the top: calories, protein, carbs and fat for **one common serving** and per 100 g, with the serving size in grams.
- **Table**: per 100 g and per serving; fibre, sugar, sodium where you have them.
- **Variations** that change the numbers (whole wheat vs refined flour, with or without ghee, homemade vs restaurant, small vs large).
- **Short, original notes** written for this food (how people usually portion it, what it pairs with, how to fit it into a day). Not the same paragraph with numbers swapped.
- **Related foods** (links) and **"How to log this in CaliPartner"** with a button that opens the app (or the store).
- **FAQ** of 2 to 4 real questions with direct answers.
- **Source line**: "Data from IFCT 2017 (NIN, ICMR) and USDA; last reviewed [date] by [name, credentials]". Check IFCT's reuse terms and cite it properly.
- **Disclaimer**: general information, not medical advice.

**Title tag pattern:** `Roti calories: 1 roti (40 g) = X kcal | CaliPartner` (keep within about 60 characters). **Meta description:** the answer plus protein, carbs and fat, within about 155 characters.

### 7.3 Quality rules (health content is held to a higher standard)
- Health and nutrition pages are "your money or your life" content, so Google looks for **expertise and trust**: have a registered dietitian review the templates and a sample of pages, show author and reviewer names with credentials, cite sources, and show update dates.
- Keep numbers consistent with what the app shows (one data source, one rounding rule).
- Do not make disease or treatment claims.
- Refresh the data on a schedule; stale numbers hurt trust.
- Link every food page from a category page (`/foods/breads`, `/foods/dals`) and from related pages, so every page is reachable in 3 clicks.

### 7.4 Blog and guides (1 per week is enough)
Pick topics that match what your app does and that people really ask. Examples to start:
- "How many calories should I eat? A simple guide for Indians" (explain the method, link to your calculator)
- "Calorie deficit on a vegetarian Indian diet: a sample day"
- "How to find a gym or workout partner (and stay consistent)"
- "How to count calories for homemade food like dal, sabzi and roti"
- "High-protein Indian vegetarian foods"
- "Winter Arc and New Year challenges: how to start with a friend" (publish before each in-app event)
- "Intermittent fasting for beginners: what to know and who should avoid it"

Each article: a clear answer in the first paragraph, headings that match the questions, one image or table, a link to a relevant food page and a soft call to action. **Link out to trustworthy sources**; do not copy other sites.

### 7.5 Free tools that earn links
Small tools often earn more links than articles: a **calorie target calculator** (using your existing safe-rate logic), a **protein target calculator**, a **"how much to eat to lose X kg safely"** estimator, and a **water intake calculator**. Put each on its own URL with a short explanation and a CTA to the app.

### 7.6 Links and mentions (off-site)
- Ask partners you collaborate with (creators, gyms, colleges, dietitians) to link to the site or the store page. This pairs with the collaboration codes in the pricing plan.
- List the app on relevant directories (Product Hunt, startup lists, Indian app and fitness roundups); write to fitness bloggers and newsletters with one useful angle (your food data or a free tool).
- A short, factual **press page** with screenshots, logo files and a founder story.
- Do not buy links or join link schemes.

### 7.7 Pitfalls to avoid
- Thousands of near-identical pages generated at once. Test about 10 pages first, then 30 to 50, then grow only what earns traffic.
- Pages where only the numbers change. Write original notes and variations per food.
- AI-written text published unchecked. If you use AI to draft, verify every number and claim and have a person edit.
- Blocking Google in `robots.txt` by mistake, or leaving `noindex` on live pages after testing.

---

## 8. Ratings and reviews

Ratings affect both ranking and how many people tap Install. Aim for **4.5 stars or more**; very low ratings reduce visibility.

- **Ask at a happy moment, not at launch:** after a 7-day streak, a completed week, or a successful partner match. Apple's in-app prompt (`SKStoreReviewController`, or `expo-store-review`) is limited by Apple to about 3 prompts a year per person; Google's in-app review API also limits how often it appears. You cannot force it, so choose the moment carefully.
- **Rules:** do not offer rewards for reviews, do not show the prompt only to happy users and a different link to unhappy ones (Apple and Google both forbid gating), and never fake reviews.
- **Give unhappy users a better path first:** a "Report a problem" or "Help" button in Settings goes to support, not the store.
- **Reply to reviews** within 48 hours, especially the 1 to 3 star ones. Replies do not change ranking directly on iOS, but they raise conversion and often lead to an updated rating.
- **Review reply templates:**
  - Bug: "Sorry about that, [name]. We found the cause and a fix is coming in the next update. Email [support email] and we will help you now."
  - Missing food: "Thanks. We're adding Indian foods every week; send us the name from Settings > Request a food and we'll add it."
  - Price: "Food and workout tracking, search and barcode scanning are free forever. Plus adds rooms and planning tools, with a 7-day free trial."
- Read reviews weekly: they are free user research and show you which words to use in your listing.

---

## 9. Measure (30 minutes a week)

### 9.1 App stores
| Metric | Where | What to look for |
|---|---|---|
| Impressions → product page views → installs | App Store Connect Analytics; Play Console "Store listing acquisition" | Conversion at each step; find where people drop |
| Which searches bring installs | Apple Analytics (search terms), Play "Search terms" | Add winners to your title and keywords |
| Keyword rankings | A free-tier ASO tool, or search manually weekly | Rank for your 10 target phrases |
| Ratings (average and recent) | Both consoles | 4.5 or more; watch the last 30 days |
| Retention (day 1, day 7) | PostHog or the store analytics | Stores treat retention as a quality signal |
| Installs by source | UTM, campaign tokens, install referrer | Which post, page or partner works |

### 9.2 Website
- Search Console: impressions, clicks, average position, pages indexed, "Crawled but not indexed" (a warning for thin pages).
- Which pages lead to a store-button click (track the click as an event).
- Core Web Vitals report.

### 9.3 A simple weekly routine
1. Check ratings and reply to new reviews (10 minutes).
2. Look at last week's installs by source and top search terms (10 minutes).
3. Write down one change to test this month (5 minutes).
4. Publish one article or five food pages (your main time).

---

## 10. Testing and the monthly rhythm

**Test one thing at a time** and wait until the console reports a result you can trust before you change the next thing.

| Test | Tool | Idea |
|---|---|---|
| Icon, screenshots, short description, feature graphic | Google **Store Listing Experiments** | First screenshot: "Log Indian food in seconds" vs "Train with a partner" |
| Screenshots and text per audience | Apple **Custom Product Pages** (up to 70 per app according to one source; older guides say 35; your console shows the limit) and Google **Custom Store Listings** | A page for partner invites, one for food tracking, one for each creator or college |
| Events | Apple **In-App Events** and Google **Promotional content** | Winter Arc (December) and New Year (January) challenges; add a tagged event for each feature drop |
| Title and subtitle | Change one at a time and watch rankings for 2 to 4 weeks | "Calorie Tracker" vs "Fitness Partner" in the title |

**Monthly rhythm (matches your release plan):**
| Month | ASO | SEO |
|---|---|---|
| Before launch | Listing, screenshots, policies, review notes | Site, legal pages, Search Console, 30 to 50 food pages |
| Launch month | Submit, collect first reviews (Section 8), fix what reviews show | Publish 4 articles, submit sitemap, start link outreach |
| Month 2 | Hindi listing; first screenshot test | Review which food pages index; add 100 more of the types that work |
| Month 3 | Custom product pages for partner invites; event for Winter Arc | Calorie and protein calculators; first links from partners |
| Month 4 | Event for New Year; test title | Hindi pages for the top 20 foods |
| Month 5 and after | One test a month; update screenshots with each big feature (GPS, AI) | Prune weak pages, expand strong ones, refresh data |

---

## 11. Do-first checklist (copy this into your task list)

**Week 1**
- [ ] Name, domain, handles and trademark check
- [ ] Developer accounts active
- [ ] Privacy, terms, support, delete-account pages live
- [ ] Search Console and Bing set up

**Week 2**
- [ ] Keyword sheet (Section 3), final title, subtitle, keywords, short description
- [ ] Icon final
- [ ] First 5 screenshots and the app preview video (reuse the 20 s reel)

**Week 3**
- [ ] Website live with home, features, pricing, download
- [ ] Deep links and invite page working; smart app banner
- [ ] 30 to 50 food pages, 2 articles
- [ ] Store listings filled in, privacy labels and data safety form done, demo account and review notes ready

**Week 4 (launch)**
- [ ] Submit to Apple and Google
- [ ] Reply to every review for the first 30 days
- [ ] Ask partners and communities for links and shares
- [ ] First weekly metrics check

---

## Sources

- Google Play listing limits (title 30, short description 80, full description 4,000; full text indexed; no keyword field; ranking signals; experiments; feature graphic 1024 × 500): [AppLaunchFlow, Google Play Store Optimization 2026](https://www.applaunchflow.com/blog/google-play-store-optimization-2026)
- App Store indexed fields and limits (title 30, subtitle 30, keywords 100; description not indexed; screenshots not text-indexed; ratings and retention signals; Custom Product Pages): [ASOMobile, App Store listing 2026](https://asomobile.net/en/blog/app-store-listing-2026-what-actually-affects-rankings/)
- 2026 platform and analytics changes (App Store Connect analytics update, Custom Product Pages, In-App Events): [AppFollow ASO news](https://appfollow.io/blog/aso-news)
- Programmatic SEO process and risks: [Ahrefs](https://ahrefs.com/blog/programmatic-seo/)
- Other guides used for cross-checking: [AppFollow title playbook](https://appfollow.io/blog/app-store-optimization-title), [Asodesk Google Play checklist](https://asodesk.com/blog/checklist-for-aso-in-google-play/), [AppRadar ranking factors](https://appradar.com/academy/app-store-ranking-factors)

**Reliability notes:** the guides above are practitioner blogs, not Apple or Google; they disagree on some numbers (for example the number of Custom Product Pages) and on how much ratings and recency count. Apple's promotional text limit (170), the review-prompt limits, Google's data-safety and health declarations, and screenshot size rules come from the stores' own consoles and documentation, which I could not open from here, so **check each in App Store Connect and Play Console.** Keyword volumes and competitor positions were not available to me and must be looked up with the free tools in Section 3. Hindi text is a draft and needs a native speaker.