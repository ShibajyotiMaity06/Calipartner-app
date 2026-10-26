# CaliPartner — Plans, Features and Pricing Specification

**October 2026 · Official Tier and Pricing Reference**  
*Supersedes earlier pricing tables in `CaliPartner_Pricing_Plan.md` and aligns with latest room revisions (`ROOMS_V3.md`, `FRIENDS_AND_ROOM_LIMITS.md`).*

---

## 1. Pricing and Trial Overview

| Metric | Free (Basic) | Plus Plan | Pro Plan |
| :--- | :--- | :--- | :--- |
| **Positioning** | Core daily tracking and free 1-on-1 accountability | The habit and community powerhouse | The elite AI-coached nutrition and body transformation tier |
| **India Monthly** | ₹0 | **₹249** / month | **₹499** / month |
| **India Annual** | ₹0 | **₹1,499** / year | **₹2,499** / year |
| *India Annual Equivalent* | — | *₹125 / month* | *₹208 / month* |
| *India Annual Savings* | — | **~50% savings** (₹1,489 saved) | **~58% savings** (₹3,489 saved) |
| **Global (US/Intl) Monthly** | $0 | **$4.99** / month | **$9.99** / month |
| **Global (US/Intl) Annual** | $0 | **$29.99** / year | **$49.99** / year |
| *Global Annual Equivalent* | — | *$2.50 / month* | *$4.17 / month* |
| *Global Annual Savings* | — | **~50% savings** ($29.89 saved) | **~58% savings** ($69.89 saved) |
| **Free Trial** | Free forever | **7-Day Free Trial** (both Monthly and Annual) | **No Free Trial** (0 days — immediate billing) |

> [!IMPORTANT]
> **Free Trial Rule:** The 7-day free trial is available **exclusively on CaliPartner Plus**. Pro does not have a trial due to underlying vision model and LLM compute costs. On web checkouts (Dodo Payments) and store checkouts (RevenueCat / Apple / Google), the 7-day trial must be configured on the Plus products, billing ₹0 / $0 upfront.

---

## 2. Dynamic Growth Checks and Macro Recalculation

Nutrition goals are not static. As members lose fat or gain muscle, their Total Daily Energy Expenditure (TDEE) and metabolic rate shift. CaliPartner provides structured progress reviews tailored by plan tier:

| Plan | Recalculation Cadence | How It Works |
| :--- | :--- | :--- |
| **Free (Basic)** | On-Demand (Manual) | Users can manually re-trigger the onboarding calculator from settings at any time to recompute targets based on updated weight. |
| **Plus** | **Every Month (30 Days)** | At the end of each 30-day cycle, the app checks the user's weight trends and logged consistency. It prompts a **Monthly Growth Review**: requests current weight, verifies goal pace, and calculates updated calorie and macro targets. Targets are never changed silently—the user reviews and confirms before saving. |
| **Pro** | **Every Week (7 Days)** | The AI Coach conducts an active **Weekly Growth & Macro Review**. It analyzes 7-day rolling weight averages, workout volume, and adherence. If weight loss or muscle gain has stalled, the AI provides personalized adjustments (e.g., adjusting carb/fat distribution or small calorie refinements within safety floors) and provides an executive summary of progress. |

*Safety rule:* In both Plus and Pro, calorie floors (1,200 kcal women, 1,500 kcal men) and weekly rate caps (maximum 1% body weight per week) remain strictly enforced by `/packages/core` and the database.

---

## 3. Comprehensive Feature Comparison Matrix

**Legend:**  
- ✔ **Included**  
- — **Not included**  
- **Limit** indicates fair-use or plan cap  

### 3.1 Core Tracking and Daily Diary
| Feature | Free | Plus | Pro | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Food Diary** (Breakfast, Lunch, Dinner, Snacks, Extra) | ✔ | ✔ | ✔ | 5 meal slots; 100% offline-first |
| **Food Search & Nutrition Database** | ✔ | ✔ | ✔ | Over 70,000 foods (IFCT Indian foods first) |
| **Barcode Scanner** | ✔ | ✔ | ✔ | Camera and image gallery barcode scanning |
| **Custom Foods & "My Meals"** | ✔ | ✔ | ✔ | Save personal foods and recurring meals |
| **Calorie & Macro Targets** | ✔ | ✔ | ✔ | Energy, protein, carbs, fats with safety floors |
| **Water Logging & Hydration Reminders** | ✔ | ✔ | ✔ | Daily volume targets and reminder schedule |
| **Steps & Distance Tracking** | ✔ | ✔ | ✔ | Native pedometer & Health Connect / Apple Health |
| **GPS Activity Tracking** | ✔ | ✔ | ✔ | Walks, runs, rides (live route, distance, pace) |
| **Workout Logging** | ✔ | ✔ | ✔ | Exercise catalog, sets, reps, weight, history |
| **Weight Tracking & Trends** | ✔ | ✔ | ✔ | Log weight, BMI, moving average trend line |
| **Personal Progress Graphs** | ✔ | ✔ | ✔ | Nutrition adherence, calorie intake, weight graph |
| **Personal Focus Timer & Stopwatch** | ✔ | ✔ | ✔ | Study/work focus sessions with personal log |
| **Habit Streaks & Consistency Score** | ✔ | ✔ | ✔ | Daily streaks, weekly composite consistency score |
| **Weekly Community Leaderboard** | ✔ | ✔ | ✔ | Top 10 leaderboard and your cohort position |
| **Offline-First SQLite Logging** | ✔ | ✔ | ✔ | Logging never blocks or requires internet |

---

### 3.2 Social, Accountability and Rooms
| Feature | Free | Plus | Pro | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Hosted Rooms Count** | **1 room** | **3 rooms** | **5 rooms** | Rooms hosted by you simultaneously |
| **Capacity Per Room** | **2 people** | **5 people** | **20 people** | Max members per hosted room |
| **Member Free Join** | ✔ | ✔ | ✔ | Members join any paid room free (host pays) |
| **Free 1-on-1 Partner Room** | ✔ | ✔ | ✔ | Free pair room with your accountability partner |
| **Shared Nutrition in Room** | Basic | Full | Full | Free shares cal/protein/fibre/carbs; Plus/Pro share full diary |
| **Room Text Chat** | Read-only | **Send & Read** | **Send & Read** | Plus/Pro required to post text messages |
| **Room Media Sharing** (Photos & Videos) | — | — | **✔** | Pro exclusive; Cloudflare R2 signed uploads |
| **Shared Workouts** | Read-only | **Share & Read** | **Share & Read** | Share full routines/exercises to room feed |
| **Live Shared Focus Sessions** | — | **✔** | **✔** | Live synchronized focus rooms with room peers |
| **Room-Only Leaderboard** | — | **✔** | **✔** | Filtered leaderboard for just your room |
| **Pair Challenges** (1, 7, 30 days) | — | **✔** | **✔** | Custom accountability challenges with partner |
| **Seasonal Challenges** (Winter Arc, etc.) | — | **✔** | **✔** | Platform-wide quarterly motivational events |
| **Username Search & Friendships** | 3 requests / 7d | **Unlimited** | **Unlimited** | Find friends by @username without limits |
| **Partner Finder** | Receive & Accept | **Browse & Send** | **Browse & Send** | Deterministic match engine (gender, goal, age band) |

---

### 3.3 Nutrition, Wellness and Content
| Feature | Free | Plus | Pro | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Recipe Library** | 10 starter | **Full (150+)** | **Full (150+)** | Macro-balanced fitness & Indian recipes |
| **"Fits My Day" AI Recipe Collections** | — | — | **✔** | Smart recipes fitting remaining daily macros |
| **Fasting Tracker & Eating Windows** | — | **✔** | **✔** | 16:8, 18:6, custom intermittent fasting timers |
| **Advanced Micronutrient Tracking** | — | **✔** | **✔** | Fibre, saturated fat, sodium, cholesterol, sugar |
| **Meal Planner & Auto Grocery Lists** | — | **✔** | **✔** | Plan week meals; compile grocery ingredients |
| **Workout Routines & Exercise Programs** | — | **✔** | **✔** | Save full multi-day split programs |
| **Workout Rest Timer & Personal Records** | — | **✔** | **✔** | Auto-rest countdowns and 1RM / PR tracking |
| **Body Circumferences** (Chest, Waist, Hips) | — | **✔** | **✔** | Detailed tape measurement trend logs |
| **Private Progress Photo Vault** | — | **✔** | **✔** | Encrypted side-by-side visual progress photos |
| **Full Data Export** (JSON/CSV) | — | **✔** | **✔** | Export all nutrition, workout and biometric data |

---

### 3.4 AI Intelligence and Coaching
| Feature | Free | Plus | Pro | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Personal AI Nutrition & Fitness Coach** | Locked preview | — | **✔ (10 msgs/day)** | Claude Haiku 5.5; context-aware AI coach |
| **AI Photo Food Logging** | 3 one-time trial | — | **✔ (5 scans/day)** | Camera food scan; multi-item macro detection |
| **Chat-to-Log** (*"I ate 2 eggs and toast"*) | — | — | **✔** | Natural language logging parsed by AI |
| **Macro Growth Recalculation** | Manual | **Monthly (30d)** | **Weekly (7d)** | Proactive target updates to prevent plateaus |
| **Weekly AI Progress Summary** | — | — | **✔** | Deep-dive adherence and metabolic analysis |
| **Priority Support** | Standard | Standard | **✔** | Priority customer support queue |

---

## 4. Key Rules, Architecture and Billing Logic

1. **Room Sponsorship Model (Host Pays):**
   * The room creator/host's plan determines the room capacity (Free: 2, Plus: 5, Pro: 20).
   * Invited members do not need their own plan to join and experience room progress.
   * If a host's plan lapses, the room enters a 30-day grace/paused state where any member can upgrade to sponsor it, preserving all streaks and history.

2. **Dodo Payments Product ID Registry:**

| Product Name in Dodo | Product ID | Price | Plan & Cadence | Trial |
| :--- | :--- | :--- | :--- | :--- |
| `Plusmonthlyrupees` | `pdt_0NqYkFnrBtumqnnW6amME` | ₹249.00 | Plus Monthly (INR) | 7 Days |
| `Plusyearlyrupees` | `pdt_0NqYjxau37A8F15U4ovnt` | ₹1,499.00 | Plus Annual (INR) | 7 Days |
| `Promonthlyrupees` | `pdt_0NqYkgvwBKDtjSQRQxwbm` | ₹499.00 | Pro Monthly (INR) | 0 Days |
| `Proyearlyrupees` | `pdt_0NqYkSYMM9n1wJoZLJp9Y` | ₹2,499.00 | Pro Annual (INR) | 0 Days |
| `Plusmonthlydollar` | `pdt_0Np8JSfvie3Eqg47kDEzZ` | $4.99 | Plus Monthly (USD) | 7 Days |
| `Plusyearlydollars` | `pdt_0Np8JdWRcfrMJqyruTzkE` | $29.99 | Plus Annual (USD) | 7 Days |
| `Promonthlydollar` | `pdt_0Np8JFZXhiKHXsUJH9GD8` | $9.99 | Pro Monthly (USD) | 0 Days |
| `Proyearlydollar` | `pdt_0Np8IxfM0q2BFdPQHPMDC` | $49.99 | Pro Annual (USD) | 0 Days |

> [!WARNING]
> **Currency Verification Warning for `Proyearlyrupees`:**
> In your Dodo dashboard, check the currency for product `pdt_0NqYkSYMM9n1wJoZLJp9Y`. Ensure its currency is set to **INR (₹)** and not **USD ($)**, so Indian customers are charged ₹2,499 INR rather than $2,499 USD!

**Edge Function Secret (`DODO_PRODUCTS_JSON` for India INR):**
```json
{
  "plus_monthly": "pdt_0NqYkFnrBtumqnnW6amME",
  "plus_annual": "pdt_0NqYjxau37A8F15U4ovnt",
  "pro_monthly": "pdt_0NqYkgvwBKDtjSQRQxwbm",
  "pro_annual": "pdt_0NqYkSYMM9n1wJoZLJp9Y"
}
```

3. **Privacy and Safety Rules:**
   * Room members never read each other's database records directly; all data passes through security-definer views respecting member privacy toggles.
   * In Partner Finder, strangers only see banded demographics (age bracket, fitness goal, training style, city, language) — never weight, calories, exact location, or contact info before mutual acceptance.
   * Calorie floors and rate limits are hard product rules that cannot be bypassed by any user or AI recommendation.
