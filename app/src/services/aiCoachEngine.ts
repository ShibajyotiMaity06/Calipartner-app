import type { CoachSuggestion } from '@/components/coach/types';

export interface CoachContext {
  calorieTarget: number;
  proteinTarget: number;
  goal: string;
  consumedCalories?: number;
  consumedProtein?: number;
  waterMl?: number;
}

export interface CoachEngineResult {
  content: string;
  suggestions?: CoachSuggestion[];
}

const RECIPE_POOL: CoachSuggestion[] = [
  {
    id: 'sug-peanut-banana-smoothie',
    type: 'recipe',
    title: 'High-Calorie Peanut Butter Banana Mass Shake',
    portion: '1 large smoothie (450ml)',
    calories: 680,
    protein: 36,
    carbs: 78,
    fat: 26,
    recipeId: 'rec-pb-banana-shake',
  },
  {
    id: 'sug-chicken-rice-bowl',
    type: 'recipe',
    title: 'Grilled Chicken & Herb Rice Bowl',
    portion: '1 plate (350g)',
    calories: 540,
    protein: 44,
    carbs: 62,
    fat: 12,
    recipeId: 'rec-chicken-rice-bowl',
  },
  {
    id: 'sug-egg-bhurji-toast',
    type: 'recipe',
    title: 'Masala Egg Bhurji with Buttered Toast',
    portion: '3 eggs + 2 toasts',
    calories: 420,
    protein: 26,
    carbs: 34,
    fat: 20,
    recipeId: 'rec-egg-bhurji-toast',
  },
  {
    id: 'sug-soya-matar',
    type: 'recipe',
    title: 'High-Protein Soya Matar Curry & Phulka',
    portion: '1 bowl (280g) + 2 phulkas',
    calories: 440,
    protein: 34,
    carbs: 52,
    fat: 10,
    recipeId: 'rec-soya-matar',
  },
  {
    id: 'sug-oats-whey-parfait',
    type: 'recipe',
    title: 'Warm Cinnamon Oats with Whey & Almonds',
    portion: '1 bowl (300g)',
    calories: 460,
    protein: 32,
    carbs: 56,
    fat: 12,
    recipeId: 'rec-oats-whey',
  },
  {
    id: 'sug-paneer-bhurji',
    type: 'recipe',
    title: 'Spiced Paneer Bhurji with Multigrain Roti',
    portion: '1 serving (260g)',
    calories: 480,
    protein: 28,
    carbs: 42,
    fat: 22,
    recipeId: 'rec-paneer-bhurji',
  },
  {
    id: 'sug-greek-curd-berries',
    type: 'recipe',
    title: 'Thick Greek Curd with Honey & Walnuts',
    portion: '1 bowl (200g)',
    calories: 280,
    protein: 20,
    carbs: 24,
    fat: 12,
    recipeId: 'rec-greek-curd-berries',
  },
];

/**
 * Checks if the user is explicitly requesting meal ideas, recipes, or food suggestions.
 */
function isAskingForMealIdea(q: string): boolean {
  return (
    q.includes('recipe') ||
    q.includes('meal idea') ||
    q.includes('meal suggestion') ||
    q.includes('what should i eat') ||
    q.includes('what to eat') ||
    q.includes('suggest a meal') ||
    q.includes('suggest a recipe') ||
    q.includes('suggest food') ||
    q.includes('suggest something to eat') ||
    q.includes('what to cook') ||
    q.includes('healthy dish') ||
    q.includes('dinner idea') ||
    q.includes('breakfast idea') ||
    q.includes('lunch idea') ||
    q.includes('snack idea') ||
    q.includes('food idea') ||
    q.includes('high protein meal') ||
    q.includes('food options')
  );
}

/**
 * Independent, conversational fitness and nutrition engine.
 * Job 1: Answers any fitness, workout, health, or nutrition question freely, accurately, and without restrictions.
 * Job 2: Suggests relevant meal ideas ONLY if the user is asking for them.
 */
export function generateCoachResponse(query: string, ctx: CoachContext): CoachEngineResult {
  const q = query.toLowerCase().trim();
  const { calorieTarget, proteinTarget, goal } = ctx;
  const wantsMeal = isAskingForMealIdea(q);

  let responseContent = '';
  let suggestedRecipes: CoachSuggestion[] | undefined = undefined;

  // 1. Weight Gain / Bulking / Gaining Faster
  if (
    q.includes('gain weight') ||
    q.includes('bulk') ||
    q.includes('weight gain') ||
    q.includes('gain 2kg') ||
    q.includes('gain mass') ||
    q.includes('gain muscle') ||
    q.includes('increase weight') ||
    (q.includes('gain') && q.includes('fast'))
  ) {
    if (
      q.includes('3 days') ||
      q.includes('2 days') ||
      q.includes('week') ||
      q.includes('2kg in')
    ) {
      responseContent = `Biologically, gaining 2kg of real muscle or lean tissue in 3 days is impossible. Gaining 2kg of real body mass requires approximately ~15,000 extra calories! Any quick weight jump in 2 to 3 days would only be temporary water retention, sodium, and digestive bloat—not quality mass. Intermittent fasting would actually work against you here, because fasting restricts your eating window and makes getting enough calories much harder.

To gain healthy weight and muscle sustainably:
1. Eat in a consistent surplus of +300 to +500 kcal above your ${calorieTarget} kcal target.
2. Aim for a realistic pace of 0.25 kg to 0.5 kg per week.
3. Drink high-calorie liquid nutrition (like milk + oats + banana + peanut butter smoothies) between meals so you don't feel uncomfortably full.
4. Hit your ${proteinTarget}g protein target daily and lift weights with progressive overload so the extra calories build muscle rather than fat.`;
    } else {
      responseContent = `To build lean muscle and gain weight, your body needs a consistent calorie surplus (+300 to +500 kcal above maintenance) alongside your target of ${proteinTarget}g of protein daily.

Focus on calorie-dense, wholesome foods that pack nutrition without excessive fullness:
• Whole milk, peanut butter, almonds, walnuts, and cashews
• Eggs, chicken breast, fish, paneer, and tofu
• Oats, bananas, sweet potatoes, and rice
• Homemade mass-builder smoothies between your main meals.

Pair this with progressive resistance training (3 to 5 sessions a week) to signal your muscles to grow.`;
    }

    if (wantsMeal) {
      suggestedRecipes = [RECIPE_POOL[0]!, RECIPE_POOL[1]!];
    }
  }

  // 2. Fasting & Meal Timing (Strict word boundary, ignores "faster")
  else if (
    /\b(fasting|fast|16:8|intermittent fasting|eating window)\b/i.test(q) &&
    !q.includes('faster')
  ) {
    responseContent = `Intermittent fasting (such as 16:8 or 14:10) is a meal-timing schedule where you consume all your daily food within an 8 to 10 hour window. 

Key facts to know:
• Fasting helps with appetite control, circadian rhythm, and managing total calories.
• Fasting does NOT create fat loss on its own—the total calories you consume still dictate whether you lose, maintain, or gain weight.
• If your goal is to gain weight or build muscle, fasting can actually make it harder because fitting a caloric surplus into a short window requires very large meals.
• During the fast, drink plenty of water, black coffee, or unsweetened green tea to stay hydrated.`;

    if (wantsMeal) {
      suggestedRecipes = [RECIPE_POOL[1]!, RECIPE_POOL[4]!];
    }
  }

  // 3. Workouts, Training Splits, Calisthenics, Exercises & Soreness
  else if (
    q.includes('workout') ||
    q.includes('exercise') ||
    q.includes('pushup') ||
    q.includes('pullup') ||
    q.includes('squat') ||
    q.includes('sore') ||
    q.includes('doms') ||
    q.includes('routine') ||
    q.includes('gym') ||
    q.includes('split') ||
    q.includes('chest') ||
    q.includes('back') ||
    q.includes('legs')
  ) {
    if (q.includes('sore') || q.includes('doms') || q.includes('pain') || q.includes('rest day')) {
      responseContent = `Muscle soreness (DOMS) typically peaks 24 to 48 hours after a tough workout, especially when introducing new exercises or increasing intensity.

Best recovery strategies:
1. Active recovery: Light walking (20-30 mins) or gentle mobility work increases blood flow and speeds recovery without fatiguing the muscle.
2. Hydration & Protein: Drink at least 2.5-3L of water and hit your ${proteinTarget}g protein target to repair damaged muscle fibers.
3. Sleep: Aim for 7 to 8 hours of quality sleep, which is when the majority of growth hormone and tissue repair occurs.
4. Don't train through sharp joint pain—take a rest day or train an unaffected muscle group.`;
    } else {
      responseContent = `For consistent training progress, structure your routine around progressive overload (adding a rep, a set, or slightly more weight each week):
• 3 to 4 days per week is plenty for great results, whether you follow Full Body, Upper/Lower, or Push/Pull/Legs.
• Prioritize compound movements: Push-ups/Bench Press for chest and triceps, Pull-ups/Rows for back and biceps, and Squats/Lunges for legs.
• Rest 1.5 to 2 minutes between heavy sets so your performance stays high throughout the session.
• Keep your daily nutrition aligned with ${calorieTarget} kcal and ${proteinTarget}g protein to fuel recovery.`;
    }

    if (wantsMeal) {
      suggestedRecipes = [RECIPE_POOL[1]!, RECIPE_POOL[2]!];
    }
  }

  // 4. Protein, Whey, Supplements & Daily Intake
  else if (
    q.includes('protein') ||
    q.includes('whey') ||
    q.includes('supplement') ||
    q.includes('creatine') ||
    q.includes('chicken') ||
    q.includes('egg') ||
    q.includes('paneer') ||
    q.includes('tofu') ||
    q.includes('soya')
  ) {
    if (q.includes('creatine')) {
      responseContent = `Creatine monohydrate is the most thoroughly researched supplement in sports science:
• Take 3 to 5 grams daily at any time with water. Consistency is what matters, not timing.
• It saturates intramuscular phosphocreatine, helping you push out 1-2 extra reps on heavy sets and supporting lean power output.
• Drink plenty of water (3+ liters) as creatine draws water into muscle cells, giving a fuller appearance and improving cellular hydration.`;
    } else if (q.includes('whey')) {
      responseContent = `Whey protein is simply a convenient, high-quality, powdered dairy protein:
• One standard scoop delivers ~24-27g of complete protein with very few calories (~120-130 kcal).
• It is not mandatory if you hit your ${proteinTarget}g target with whole foods, but it makes reaching that target much easier, especially post-workout or stirred into morning oats.`;
    } else {
      responseContent = `Your daily target is ${proteinTarget}g of protein. Distributing your intake across 3 to 4 meals (roughly 30-40g per meal) maximizes muscle protein synthesis and keeps you full throughout the day.

Top protein sources:
• Non-veg: Chicken breast (31g/100g), eggs (6g per whole egg), fish
• Dairy & Vegetarian: Paneer (18g/100g), Greek yogurt / curd (10-15g/cup), whey protein
• Plant-based: Soya chunks (52g/100g dry), tofu (17g/100g), lentils and chickpeas.`;
    }

    if (wantsMeal) {
      suggestedRecipes = [RECIPE_POOL[1]!, RECIPE_POOL[3]!];
    }
  }

  // 5. Weight Loss, Fat Loss, Calorie Deficit
  else if (
    q.includes('weight loss') ||
    q.includes('lose weight') ||
    q.includes('fat loss') ||
    q.includes('deficit') ||
    q.includes('cut') ||
    q.includes('calorie')
  ) {
    responseContent = `Sustainable fat loss comes from a moderate, consistent caloric deficit while maintaining high protein:
1. Your calorie target is ${calorieTarget} kcal. This creates a safe deficit that burns fat without sacrificing muscle or crashing your metabolic rate.
2. Keep your protein at ${proteinTarget}g daily—this preserves lean muscle and keeps cravings away.
3. Focus on food volume: fill half your plate with fibrous vegetables (cucumbers, spinach, broccoli, peppers) which keep you full on very few calories.
4. Scale weight fluctuates daily from water and sodium. Track your weekly average to see the real trend.`;

    if (wantsMeal) {
      suggestedRecipes = [RECIPE_POOL[1]!, RECIPE_POOL[6]!];
    }
  }

  // 6. Water & Hydration
  else if (
    q.includes('water') ||
    q.includes('hydrate') ||
    q.includes('hydration') ||
    q.includes('drink')
  ) {
    responseContent = `Hydration is essential for nutrient delivery, joint lubrication, and physical performance:
• Aim for 2.5 to 3.5 liters daily. On days with intense workouts or hot weather, increase by another 500ml.
• A simple guide: your urine should be light straw-colored.
• Tip: Drink one glass of water right when you wake up, and keep a bottle nearby at your desk to sip steadily throughout the day.`;
  }

  // 7. Explicit Meal Ideas / Recipes requested
  else if (wantsMeal) {
    responseContent = `Here are nutritious, balanced meal ideas tailored to fit your ${calorieTarget} kcal allowance and ${proteinTarget}g daily protein target. They provide high protein density and steady energy:`;
    suggestedRecipes = [RECIPE_POOL[1]!, RECIPE_POOL[3]!, RECIPE_POOL[4]!];
  }

  // 8. Greetings & Open Questions
  else if (
    /^(hi|hello|hey|yo|namaste|good morning|good evening|good afternoon|sup|who are you)/.test(q)
  ) {
    responseContent = `Hello! I am your personal CaliPartner AI Coach. I'm here to help you freely with whatever you need—whether that's workout advice, training tips, nutrition questions, or adjusting your daily habits to hit your ${calorieTarget} kcal and ${proteinTarget}g protein targets. What's on your mind today?`;
  }

  // 9. General, open-ended guidance (Universal friendly answer without restrictions)
  else {
    responseContent = `That's a great question! As your fitness partner, I'm here to support your journey towards your ${goal === 'cut' ? 'fat loss' : goal === 'bulk' ? 'lean muscle building' : 'fitness'} goals. 

With your daily targets set to ${calorieTarget} kcal and ${proteinTarget}g of protein, the biggest driver of results is steady consistency. Focus on getting 25-35g of protein per meal, drinking plenty of water, and keeping up your daily movement. 

If you'd like specific workout routines, nutrition advice, or meal ideas to hit your targets today, just let me know!`;
  }

  return {
    content: responseContent,
    suggestions: suggestedRecipes,
  };
}
