# Nutrition, Squad and food logging follow-up — 4 November 2026

This owner follow-up supersedes the older empty-discovery, two-section You, food-method and Squad selected-border decisions within this scope.

- Nutrition labels and amounts use shared `nutritionColors`: protein green, carbs white, calories yellow and fat red. These are nutrient identities and never performance judgements. Keep explicit labels, on-brand button contrast and error styling. Person identity hues retain their existing meanings.
- With no Squad, the Home create card fills the same content width as Your part today. Existing Squad carousels remain horizontal. Home Squad Open/See all actions are green.
- Discover initially asks the existing privacy-enforcing SQL projection for at most five profiles with the viewer’s current goal. No goal or no match produces an honest empty state. Explicit username search remains universal. Empty-query pagination is disabled server-side.
- Squad leaderboard summaries contain overall goal-completion percentages without raw calorie totals. Individual metric comparisons show percent of each member’s own goal. The selected Overview/Leaderboard/Chat label is yellow; no selected top border is added. Member-picker dismissal preserves the current section. Compare uses smaller name-only selectors.
- You has Diary, Progress and Challenges. The existing real challenge system, invitations and plan/privacy gates are reused.
- Food logging offers Search, Recipes, Favourites, Photo and Scan. Custom food is directly accessible from Search. Favourites contains foods and recipes, retaining existing recipe access rules. A heart changes state only after server acknowledgement.
- Recent searches are recorded when a search is submitted or a result is chosen. Clear search history clears those queries, keeping recent logged foods, diary entries and favourites. History and food favourites are private to their owner and are acknowledged online.
- Search/barcode portion sheets and AI-result items expose editable calories, protein, carbs and fat. Changes belong to the logged portion; catalog nutrition is retained. Invalid values block saving. AI portion adjustments retain corrections. Saves and retries use stable IDs; large-portion confirmation is retained on web and native.

All new controls use i18n, semantic accessibility labels and test IDs. Nutrition math remains in `packages/core`; no calorie targets, ranking formula, entitlements, or unrelated feature phases change.
