-- Preserve the supplied recipe data, including unmapped ingredient amounts.
alter table public.recipes add column source_recipe jsonb;
alter table public.recipes drop constraint recipes_meal_type_check;
alter table public.recipes add constraint recipes_meal_type_check check(meal_type in ('breakfast','lunch','dinner','snack','dessert','beverage','unspecified'));
alter table public.recipes drop constraint recipes_difficulty_check;
alter table public.recipes add constraint recipes_difficulty_check check(difficulty in ('easy','medium','hard','unspecified'));
insert into public.recipes(id,title,cuisine,diet_tags,meal_type,prep_minutes,cook_minutes,difficulty,servings,steps,tips,image_urls,status,nutrition_per_serving,nutrition_override_reason,source_recipe)
select (r->>'id')::uuid,r->>'name',r->>'region',
 array[case lower(r->>'type') when 'veg' then 'vegetarian' when 'egg' then 'eggetarian' else 'non_vegetarian' end],
 'unspecified',0,(r->>'time_minutes')::integer,'unspecified',(r->>'serves')::numeric,r->'steps','[]'::jsonb,'[]'::jsonb,'published',
 jsonb_build_object('calories',r->'macros'->'calories','protein',r->'macros'->'protein_g','carbs',r->'macros'->'carbs_g','fat',r->'macros'->'fat_g','fiber',r->'macros'->'fiber_g'),
 'Owner-supplied reci.txt nutrition per '||(r->'macros'->>'per'),r
from jsonb_array_elements($recipes$[
  {
    "name": "Grilled Chicken with Chimichurri",
    "region": "Argentina",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "400 g"
      },
      {
        "item": "Fresh parsley, chopped",
        "qty": "1 cup"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Olive oil",
        "qty": "3 tbsp"
      },
      {
        "item": "Red wine vinegar",
        "qty": "2 tbsp"
      },
      {
        "item": "Dried oregano",
        "qty": "1 tsp"
      },
      {
        "item": "Salt and pepper",
        "qty": "to taste"
      }
    ],
    "steps": [
      "Pound the chicken to an even thickness and season with salt and pepper.",
      "Mix parsley, garlic, olive oil, vinegar and oregano to make the chimichurri.",
      "Grill the chicken for 6 minutes per side until cooked through.",
      "Rest for 5 minutes, slice and spoon chimichurri over."
    ],
    "macros": {
      "per": "1 breast with sauce",
      "calories": 345,
      "protein_g": 46,
      "carbs_g": 2,
      "fat_g": 17,
      "fiber_g": 1
    },
    "id": "a14774c2-3cc4-50b2-b734-dc27182a725e"
  },
  {
    "name": "Chicken Teriyaki Rice Bowl",
    "region": "Japan",
    "type": "Non-Veg",
    "time_minutes": 30,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Chicken breast, sliced",
        "qty": "300 g"
      },
      {
        "item": "Soy sauce",
        "qty": "3 tbsp"
      },
      {
        "item": "Honey",
        "qty": "1 tbsp"
      },
      {
        "item": "Grated ginger",
        "qty": "1 tsp"
      },
      {
        "item": "Garlic",
        "qty": "2 cloves"
      },
      {
        "item": "Cooked rice",
        "qty": "300 g"
      },
      {
        "item": "Broccoli florets",
        "qty": "150 g"
      },
      {
        "item": "Sesame seeds",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Mix soy sauce, honey, ginger and garlic for the teriyaki sauce.",
      "Sear the chicken in a non-stick pan for 6 minutes.",
      "Add the sauce and simmer until glossy and thick.",
      "Steam the broccoli for 4 minutes.",
      "Serve over rice and top with sesame seeds."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 480,
      "protein_g": 42,
      "carbs_g": 62,
      "fat_g": 7,
      "fiber_g": 4
    },
    "id": "078ec7bd-e678-559f-ae45-b3b29d8b7445"
  },
  {
    "name": "Chicken Souvlaki with Tzatziki",
    "region": "Greece",
    "type": "Non-Veg",
    "time_minutes": 35,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Chicken breast, cubed",
        "qty": "500 g"
      },
      {
        "item": "Lemon juice",
        "qty": "3 tbsp"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Dried oregano",
        "qty": "1 tsp"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Greek yogurt",
        "qty": "150 g"
      },
      {
        "item": "Cucumber, grated",
        "qty": "1/2"
      },
      {
        "item": "Whole wheat pita",
        "qty": "3"
      }
    ],
    "steps": [
      "Marinate the chicken in lemon juice, oil, oregano and garlic for 20 minutes.",
      "Thread onto skewers.",
      "Grill for 10 minutes, turning often.",
      "Mix yogurt, cucumber and a little garlic for the tzatziki.",
      "Serve with warm pita."
    ],
    "macros": {
      "per": "2 skewers + 1 pita",
      "calories": 395,
      "protein_g": 42,
      "carbs_g": 30,
      "fat_g": 12,
      "fiber_g": 4
    },
    "id": "01d61940-f3e7-592e-b354-b8f464b47884"
  },
  {
    "name": "Shakshuka",
    "region": "Israel",
    "type": "Egg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Eggs",
        "qty": "6"
      },
      {
        "item": "Canned chopped tomatoes",
        "qty": "400 g"
      },
      {
        "item": "Bell pepper",
        "qty": "1"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Garlic",
        "qty": "2 cloves"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Smoked paprika",
        "qty": "1 tsp"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Feta",
        "qty": "40 g"
      }
    ],
    "steps": [
      "Saute onion and bell pepper in oil until soft.",
      "Add garlic, cumin and paprika, then the tomatoes. Simmer 10 minutes.",
      "Make wells and crack in the eggs.",
      "Cover and cook 5 to 6 minutes until whites set. Top with feta."
    ],
    "macros": {
      "per": "3 eggs with sauce",
      "calories": 325,
      "protein_g": 22,
      "carbs_g": 14,
      "fat_g": 20,
      "fiber_g": 4
    },
    "id": "a1fc5edc-a917-562b-bfa4-7c72e3bb765d"
  },
  {
    "name": "Gambas al Ajillo (Garlic Prawns)",
    "region": "Spain",
    "type": "Non-Veg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Prawns, peeled",
        "qty": "300 g"
      },
      {
        "item": "Garlic, sliced",
        "qty": "5 cloves"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Chilli flakes",
        "qty": "1/2 tsp"
      },
      {
        "item": "Parsley",
        "qty": "2 tbsp"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      }
    ],
    "steps": [
      "Warm oil with garlic and chilli over low heat for 2 minutes.",
      "Add the prawns and cook 2 to 3 minutes per side until pink.",
      "Finish with parsley and lemon juice."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 280,
      "protein_g": 32,
      "carbs_g": 4,
      "fat_g": 15,
      "fiber_g": 1
    },
    "id": "53a82f21-5636-518a-9196-5691c07d8a6c"
  },
  {
    "name": "Lemon Dill Salmon with Asparagus",
    "region": "Norway",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Salmon fillets",
        "qty": "300 g (2 pieces)"
      },
      {
        "item": "Asparagus",
        "qty": "200 g"
      },
      {
        "item": "Lemon",
        "qty": "1"
      },
      {
        "item": "Fresh dill",
        "qty": "2 tbsp"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Garlic",
        "qty": "2 cloves"
      }
    ],
    "steps": [
      "Heat the oven to 200 C.",
      "Place salmon and asparagus on a tray, drizzle with oil and add garlic and lemon slices.",
      "Bake 12 to 15 minutes.",
      "Top with fresh dill and serve."
    ],
    "macros": {
      "per": "1 fillet with asparagus",
      "calories": 360,
      "protein_g": 36,
      "carbs_g": 5,
      "fat_g": 22,
      "fiber_g": 3
    },
    "id": "3eb218fa-9324-5e01-abe5-fa145ab3bb98"
  },
  {
    "name": "Chicken Fajitas",
    "region": "Mexico",
    "type": "Non-Veg",
    "time_minutes": 30,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Chicken breast, strips",
        "qty": "450 g"
      },
      {
        "item": "Bell peppers",
        "qty": "2"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Fajita spice mix",
        "qty": "2 tsp"
      },
      {
        "item": "Lime",
        "qty": "1"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Whole wheat tortillas",
        "qty": "6"
      }
    ],
    "steps": [
      "Toss chicken with fajita spice and lime juice.",
      "Sear in a hot pan for 6 minutes and set aside.",
      "Cook peppers and onion in the same pan for 5 minutes.",
      "Return chicken, warm the tortillas and serve."
    ],
    "macros": {
      "per": "2 fajitas",
      "calories": 345,
      "protein_g": 34,
      "carbs_g": 32,
      "fat_g": 9,
      "fiber_g": 5
    },
    "id": "cf7b028a-385d-5ea0-9984-955809c76ea1"
  },
  {
    "name": "Turkey Meatballs in Marinara",
    "region": "Italy",
    "type": "Non-Veg",
    "time_minutes": 40,
    "serves": 4,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Lean ground turkey",
        "qty": "500 g"
      },
      {
        "item": "Egg",
        "qty": "1"
      },
      {
        "item": "Rolled oats",
        "qty": "3 tbsp"
      },
      {
        "item": "Grated parmesan",
        "qty": "2 tbsp"
      },
      {
        "item": "Marinara sauce",
        "qty": "400 g"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Fresh basil",
        "qty": "1 handful"
      },
      {
        "item": "Italian seasoning",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Mix turkey, egg, oats, parmesan, garlic and seasoning. Roll into 16 balls.",
      "Bake at 200 C for 15 minutes.",
      "Warm the marinara in a pan and add the meatballs.",
      "Simmer 10 minutes and top with basil."
    ],
    "macros": {
      "per": "4 meatballs with sauce",
      "calories": 275,
      "protein_g": 32,
      "carbs_g": 12,
      "fat_g": 11,
      "fiber_g": 3
    },
    "id": "8c349d74-b9ea-5b6a-8429-17e1835a5a35"
  },
  {
    "name": "Bulgogi Beef Bowl",
    "region": "South Korea",
    "type": "Non-Veg",
    "time_minutes": 30,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Beef sirloin, thinly sliced",
        "qty": "400 g"
      },
      {
        "item": "Soy sauce",
        "qty": "3 tbsp"
      },
      {
        "item": "Grated pear",
        "qty": "1/2"
      },
      {
        "item": "Sesame oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Spring onions",
        "qty": "2"
      },
      {
        "item": "Cooked rice",
        "qty": "300 g"
      },
      {
        "item": "Sesame seeds",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Marinate beef in soy sauce, pear, sesame oil and garlic for 15 minutes.",
      "Sear beef in a very hot pan for 3 to 4 minutes.",
      "Serve over rice with spring onions and sesame seeds."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 435,
      "protein_g": 34,
      "carbs_g": 48,
      "fat_g": 12,
      "fiber_g": 2
    },
    "id": "4e712e55-ee1c-5b45-b93c-0f489165f0d4"
  },
  {
    "name": "Thai Basil Chicken (Pad Kra Pao)",
    "region": "Thailand",
    "type": "Non-Veg",
    "time_minutes": 20,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Chicken mince",
        "qty": "300 g"
      },
      {
        "item": "Holy basil leaves",
        "qty": "1 cup"
      },
      {
        "item": "Garlic",
        "qty": "4 cloves"
      },
      {
        "item": "Thai chillies",
        "qty": "3"
      },
      {
        "item": "Soy sauce",
        "qty": "1 tbsp"
      },
      {
        "item": "Oyster sauce",
        "qty": "1 tbsp"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Cooked rice",
        "qty": "200 g"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Pound garlic and chillies together.",
      "Stir-fry in oil for 30 seconds, add chicken and cook 5 minutes.",
      "Add soy and oyster sauce, then toss in basil until wilted.",
      "Fry the eggs and serve over rice."
    ],
    "macros": {
      "per": "1 plate with 1 fried egg",
      "calories": 450,
      "protein_g": 40,
      "carbs_g": 32,
      "fat_g": 18,
      "fiber_g": 2
    },
    "id": "59ef272d-6d99-5272-be68-5214f924f50b"
  },
  {
    "name": "Tuna Poke Bowl",
    "region": "USA",
    "type": "Non-Veg",
    "time_minutes": 20,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Sushi-grade tuna, cubed",
        "qty": "250 g"
      },
      {
        "item": "Cooked rice",
        "qty": "200 g"
      },
      {
        "item": "Shelled edamame",
        "qty": "100 g"
      },
      {
        "item": "Cucumber",
        "qty": "1/2"
      },
      {
        "item": "Avocado",
        "qty": "1/2"
      },
      {
        "item": "Soy sauce",
        "qty": "2 tbsp"
      },
      {
        "item": "Sesame oil",
        "qty": "1 tsp"
      },
      {
        "item": "Sesame seeds",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Toss tuna with soy sauce and sesame oil.",
      "Arrange rice, edamame, cucumber and avocado in bowls.",
      "Top with tuna and sesame seeds."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 460,
      "protein_g": 38,
      "carbs_g": 45,
      "fat_g": 14,
      "fiber_g": 7
    },
    "id": "61c4c8fd-920b-5deb-adb0-56616d181714"
  },
  {
    "name": "French Herb Omelette with Spinach",
    "region": "France",
    "type": "Egg",
    "time_minutes": 10,
    "serves": 1,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Whole eggs",
        "qty": "2"
      },
      {
        "item": "Egg whites",
        "qty": "4"
      },
      {
        "item": "Spinach",
        "qty": "1 cup"
      },
      {
        "item": "Fresh herbs (chives, parsley)",
        "qty": "1 tbsp"
      },
      {
        "item": "Butter",
        "qty": "1 tsp"
      },
      {
        "item": "Salt and pepper",
        "qty": "to taste"
      }
    ],
    "steps": [
      "Whisk eggs, whites, herbs, salt and pepper.",
      "Melt butter in a pan and wilt the spinach.",
      "Pour in the eggs, cook gently and fold when just set."
    ],
    "macros": {
      "per": "1 omelette",
      "calories": 240,
      "protein_g": 30,
      "carbs_g": 3,
      "fat_g": 12,
      "fiber_g": 1
    },
    "id": "d551da16-14ce-58d4-9399-95a91dbf99e3"
  },
  {
    "name": "Chicken Caesar Wrap",
    "region": "USA",
    "type": "Non-Veg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Grilled chicken breast, sliced",
        "qty": "250 g"
      },
      {
        "item": "Romaine lettuce",
        "qty": "2 cups"
      },
      {
        "item": "Greek yogurt",
        "qty": "3 tbsp"
      },
      {
        "item": "Grated parmesan",
        "qty": "2 tbsp"
      },
      {
        "item": "Lemon juice",
        "qty": "1 tbsp"
      },
      {
        "item": "Garlic",
        "qty": "1 clove"
      },
      {
        "item": "Whole wheat wraps",
        "qty": "2"
      }
    ],
    "steps": [
      "Mix yogurt, parmesan, lemon and garlic into a light Caesar dressing.",
      "Toss chicken and lettuce with the dressing.",
      "Fill the wraps and roll tightly."
    ],
    "macros": {
      "per": "1 wrap",
      "calories": 370,
      "protein_g": 40,
      "carbs_g": 30,
      "fat_g": 10,
      "fiber_g": 5
    },
    "id": "a70890ff-5bfc-5ef9-ad9a-4ad25bd79339"
  },
  {
    "name": "Ginger Garlic Tofu Stir-Fry",
    "region": "China",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Firm tofu, cubed",
        "qty": "400 g"
      },
      {
        "item": "Broccoli florets",
        "qty": "150 g"
      },
      {
        "item": "Bell pepper",
        "qty": "1"
      },
      {
        "item": "Soy sauce",
        "qty": "2 tbsp"
      },
      {
        "item": "Grated ginger",
        "qty": "1 tbsp"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Sesame oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Cooked brown rice",
        "qty": "150 g"
      }
    ],
    "steps": [
      "Press tofu for 10 minutes and pan-fry until golden.",
      "Stir-fry ginger, garlic, broccoli and pepper for 4 minutes.",
      "Add tofu and soy sauce and toss.",
      "Serve with brown rice."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 415,
      "protein_g": 28,
      "carbs_g": 38,
      "fat_g": 17,
      "fiber_g": 7
    },
    "id": "2c48a0cc-5a46-5f8b-bafd-54a1e895c98c"
  },
  {
    "name": "Syrniki (Cottage Cheese Pancakes)",
    "region": "Russia",
    "type": "Egg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Low-fat cottage cheese",
        "qty": "250 g"
      },
      {
        "item": "Egg",
        "qty": "1"
      },
      {
        "item": "Oat flour",
        "qty": "4 tbsp"
      },
      {
        "item": "Honey",
        "qty": "1 tsp"
      },
      {
        "item": "Vanilla extract",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Mash cottage cheese with egg, oat flour, honey and vanilla.",
      "Shape into 6 small patties.",
      "Pan-fry in a little oil for 3 minutes per side until golden."
    ],
    "macros": {
      "per": "3 pancakes",
      "calories": 270,
      "protein_g": 28,
      "carbs_g": 26,
      "fat_g": 6,
      "fiber_g": 2
    },
    "id": "26a83ebd-8794-57a7-b639-41511942408f"
  },
  {
    "name": "Chicken Shawarma Plate",
    "region": "Lebanon",
    "type": "Non-Veg",
    "time_minutes": 40,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Skinless chicken thigh",
        "qty": "500 g"
      },
      {
        "item": "Greek yogurt",
        "qty": "3 tbsp"
      },
      {
        "item": "Shawarma spice mix",
        "qty": "2 tbsp"
      },
      {
        "item": "Lemon",
        "qty": "1"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Cucumber tomato salad",
        "qty": "2 cups"
      },
      {
        "item": "Small pita",
        "qty": "3"
      }
    ],
    "steps": [
      "Marinate chicken in yogurt, spices, lemon, garlic and oil for 20 minutes.",
      "Roast at 220 C for 20 minutes until charred.",
      "Slice and serve with salad and pita."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 415,
      "protein_g": 40,
      "carbs_g": 32,
      "fat_g": 14,
      "fiber_g": 4
    },
    "id": "177514d5-9897-5a1d-9084-6c907af75ee2"
  },
  {
    "name": "Beef and Broccoli Stir-Fry",
    "region": "China",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Flank steak, sliced",
        "qty": "400 g"
      },
      {
        "item": "Broccoli florets",
        "qty": "300 g"
      },
      {
        "item": "Soy sauce",
        "qty": "3 tbsp"
      },
      {
        "item": "Oyster sauce",
        "qty": "1 tbsp"
      },
      {
        "item": "Cornflour",
        "qty": "1 tsp"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Grated ginger",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Toss beef with 1 tbsp soy sauce and the cornflour.",
      "Sear beef in a hot wok for 2 minutes and set aside.",
      "Stir-fry garlic, ginger and broccoli with a splash of water for 4 minutes.",
      "Return beef, add remaining sauces and toss."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 295,
      "protein_g": 33,
      "carbs_g": 12,
      "fat_g": 13,
      "fiber_g": 3
    },
    "id": "83341f1b-56a4-53aa-82e5-8f0a8ed1c9f1"
  },
  {
    "name": "Pork Tenderloin with Roasted Apples",
    "region": "Germany",
    "type": "Non-Veg",
    "time_minutes": 40,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Pork tenderloin",
        "qty": "500 g"
      },
      {
        "item": "Apples, wedges",
        "qty": "2"
      },
      {
        "item": "Onion, wedges",
        "qty": "1"
      },
      {
        "item": "Dijon mustard",
        "qty": "1 tbsp"
      },
      {
        "item": "Fresh thyme",
        "qty": "1 tsp"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Rub pork with mustard, thyme and salt.",
      "Sear on all sides in an oven-safe pan.",
      "Add apples and onion around the pork and roast at 200 C for 20 minutes.",
      "Rest 5 minutes and slice."
    ],
    "macros": {
      "per": "1/3 of the dish",
      "calories": 295,
      "protein_g": 38,
      "carbs_g": 16,
      "fat_g": 9,
      "fiber_g": 3
    },
    "id": "ca57e494-800e-5a3c-864d-fecc68164a14"
  },
  {
    "name": "Mediterranean Baked Cod",
    "region": "Italy",
    "type": "Non-Veg",
    "time_minutes": 30,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Cod fillets",
        "qty": "350 g"
      },
      {
        "item": "Cherry tomatoes",
        "qty": "200 g"
      },
      {
        "item": "Black olives",
        "qty": "8"
      },
      {
        "item": "Capers",
        "qty": "1 tbsp"
      },
      {
        "item": "Garlic",
        "qty": "2 cloves"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Fresh basil",
        "qty": "1 handful"
      }
    ],
    "steps": [
      "Heat the oven to 200 C.",
      "Scatter tomatoes, olives, capers and garlic in a dish with oil.",
      "Nestle in the cod and bake 15 to 18 minutes.",
      "Top with basil."
    ],
    "macros": {
      "per": "1 fillet with vegetables",
      "calories": 255,
      "protein_g": 34,
      "carbs_g": 7,
      "fat_g": 10,
      "fiber_g": 2
    },
    "id": "e48381f4-d8bf-5d85-aa7b-7ec682817880"
  },
  {
    "name": "Turkey Burger Lettuce Wraps",
    "region": "USA",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Lean ground turkey",
        "qty": "450 g"
      },
      {
        "item": "Onion, grated",
        "qty": "1/4"
      },
      {
        "item": "Lettuce leaves",
        "qty": "6 large"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Mustard",
        "qty": "1 tbsp"
      },
      {
        "item": "Avocado",
        "qty": "1/2"
      },
      {
        "item": "Salt and pepper",
        "qty": "to taste"
      }
    ],
    "steps": [
      "Mix turkey, onion, salt and pepper and shape into 6 small patties.",
      "Grill or pan-cook 5 minutes per side.",
      "Wrap each patty in lettuce with tomato, mustard and avocado."
    ],
    "macros": {
      "per": "2 wraps",
      "calories": 275,
      "protein_g": 33,
      "carbs_g": 6,
      "fat_g": 13,
      "fiber_g": 3
    },
    "id": "12eed5f2-f0cc-553e-88ac-2f6055e860d5"
  },
  {
    "name": "Baked Chicken Katsu",
    "region": "Japan",
    "type": "Non-Veg",
    "time_minutes": 35,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "350 g (2 pieces)"
      },
      {
        "item": "Panko breadcrumbs",
        "qty": "60 g"
      },
      {
        "item": "Egg",
        "qty": "1"
      },
      {
        "item": "Whole wheat flour",
        "qty": "2 tbsp"
      },
      {
        "item": "Shredded cabbage",
        "qty": "2 cups"
      },
      {
        "item": "Tonkatsu sauce",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Flatten chicken to 1.5 cm thickness.",
      "Coat in flour, then egg, then panko.",
      "Bake at 210 C for 20 minutes, flipping once.",
      "Slice and serve with cabbage and sauce."
    ],
    "macros": {
      "per": "1 cutlet with cabbage",
      "calories": 355,
      "protein_g": 44,
      "carbs_g": 24,
      "fat_g": 9,
      "fiber_g": 3
    },
    "id": "560fe74f-dcdd-51b7-95e4-d19d03da737b"
  },
  {
    "name": "Greek Yogurt Protein Pancakes",
    "region": "USA",
    "type": "Egg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Rolled oats",
        "qty": "60 g"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Greek yogurt",
        "qty": "150 g"
      },
      {
        "item": "Banana",
        "qty": "1"
      },
      {
        "item": "Baking powder",
        "qty": "1 tsp"
      },
      {
        "item": "Mixed berries",
        "qty": "50 g"
      }
    ],
    "steps": [
      "Blend oats, eggs, yogurt, banana and baking powder into a batter.",
      "Cook small pancakes on a lightly greased pan, 2 minutes per side.",
      "Top with berries."
    ],
    "macros": {
      "per": "3 pancakes",
      "calories": 310,
      "protein_g": 24,
      "carbs_g": 38,
      "fat_g": 7,
      "fiber_g": 5
    },
    "id": "a31f9511-37cf-50f0-9f5d-3474668428fc"
  },
  {
    "name": "Steak with Roasted Sweet Potato",
    "region": "USA",
    "type": "Non-Veg",
    "time_minutes": 35,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Sirloin steak",
        "qty": "300 g"
      },
      {
        "item": "Sweet potato, cubed",
        "qty": "300 g"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Garlic",
        "qty": "2 cloves"
      },
      {
        "item": "Fresh rosemary",
        "qty": "1 tsp"
      },
      {
        "item": "Green beans",
        "qty": "100 g"
      }
    ],
    "steps": [
      "Roast sweet potato with half the oil and rosemary at 210 C for 25 minutes.",
      "Sear the steak 3 to 4 minutes per side with garlic.",
      "Rest 5 minutes and slice.",
      "Blanch the green beans and serve everything together."
    ],
    "macros": {
      "per": "150 g steak with sides",
      "calories": 450,
      "protein_g": 38,
      "carbs_g": 38,
      "fat_g": 16,
      "fiber_g": 6
    },
    "id": "74ae02ab-bd8b-5185-bad2-f7b87f96a0ff"
  },
  {
    "name": "Pho Ga (Vietnamese Chicken Noodle Soup)",
    "region": "Vietnam",
    "type": "Non-Veg",
    "time_minutes": 45,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "400 g"
      },
      {
        "item": "Chicken stock",
        "qty": "1.2 l"
      },
      {
        "item": "Dry rice noodles",
        "qty": "150 g"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Ginger",
        "qty": "3 cm"
      },
      {
        "item": "Star anise",
        "qty": "2"
      },
      {
        "item": "Fish sauce",
        "qty": "1 tbsp"
      },
      {
        "item": "Bean sprouts",
        "qty": "1 cup"
      },
      {
        "item": "Lime, coriander and basil",
        "qty": "to serve"
      }
    ],
    "steps": [
      "Simmer stock with charred onion, ginger, star anise and the chicken for 25 minutes.",
      "Remove and shred the chicken; season the broth with fish sauce.",
      "Cook noodles per pack instructions.",
      "Assemble bowls with noodles, chicken, broth, sprouts and herbs."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 330,
      "protein_g": 32,
      "carbs_g": 42,
      "fat_g": 4,
      "fiber_g": 3
    },
    "id": "97380059-d6a3-5b36-a55b-b00d328713a0"
  },
  {
    "name": "Tuna Nicoise Salad",
    "region": "France",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Canned tuna in water, drained",
        "qty": "250 g"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Baby potatoes",
        "qty": "200 g"
      },
      {
        "item": "Green beans",
        "qty": "100 g"
      },
      {
        "item": "Cherry tomatoes",
        "qty": "100 g"
      },
      {
        "item": "Black olives",
        "qty": "8"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Dijon mustard",
        "qty": "1 tsp"
      },
      {
        "item": "Lemon juice",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Boil potatoes 12 minutes, adding green beans for the last 3.",
      "Boil the eggs for 8 minutes and halve them.",
      "Whisk oil, mustard and lemon for the dressing.",
      "Arrange everything on a plate and drizzle with dressing."
    ],
    "macros": {
      "per": "1 large salad",
      "calories": 380,
      "protein_g": 36,
      "carbs_g": 25,
      "fat_g": 15,
      "fiber_g": 6
    },
    "id": "78f919cb-1710-5193-b414-8e355bfe9d8f"
  },
  {
    "name": "Lomo Saltado",
    "region": "Peru",
    "type": "Non-Veg",
    "time_minutes": 30,
    "serves": 3,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Beef sirloin, strips",
        "qty": "400 g"
      },
      {
        "item": "Red onion",
        "qty": "1"
      },
      {
        "item": "Tomatoes",
        "qty": "2"
      },
      {
        "item": "Soy sauce",
        "qty": "2 tbsp"
      },
      {
        "item": "Red wine vinegar",
        "qty": "1 tbsp"
      },
      {
        "item": "Chilli paste (aji amarillo)",
        "qty": "1 tbsp"
      },
      {
        "item": "Potatoes, wedges",
        "qty": "300 g"
      },
      {
        "item": "Cooked rice",
        "qty": "300 g"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Bake potato wedges at 220 C for 25 minutes.",
      "Sear beef in a very hot wok for 2 minutes.",
      "Add onion, tomatoes, soy, vinegar and chilli paste and toss 2 minutes.",
      "Mix in the wedges and serve with rice."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 485,
      "protein_g": 32,
      "carbs_g": 62,
      "fat_g": 12,
      "fiber_g": 5
    },
    "id": "6d8bcb2c-66ff-5ed5-9195-8a0a587e416a"
  },
  {
    "name": "Italian Vegetable Frittata",
    "region": "Italy",
    "type": "Egg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Protein",
    "ingredients": [
      {
        "item": "Eggs",
        "qty": "5"
      },
      {
        "item": "Spinach",
        "qty": "1 cup"
      },
      {
        "item": "Zucchini, sliced",
        "qty": "1 small"
      },
      {
        "item": "Cherry tomatoes",
        "qty": "100 g"
      },
      {
        "item": "Grated parmesan",
        "qty": "2 tbsp"
      },
      {
        "item": "Olive oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Saute zucchini and spinach in oil for 3 minutes.",
      "Pour over beaten eggs mixed with parmesan, add tomatoes.",
      "Cook on low heat 6 minutes, then finish under a grill for 3 minutes."
    ],
    "macros": {
      "per": "1/2 frittata",
      "calories": 260,
      "protein_g": 21,
      "carbs_g": 6,
      "fat_g": 17,
      "fiber_g": 2
    },
    "id": "2b80405e-c47a-55e5-bf72-aae7a8b858e3"
  },
  {
    "name": "Spaghetti Pomodoro",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Spaghetti",
        "qty": "200 g dry"
      },
      {
        "item": "Crushed tomatoes",
        "qty": "400 g"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Fresh basil",
        "qty": "1 handful"
      },
      {
        "item": "Grated parmesan",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Boil spaghetti until al dente.",
      "Saute garlic in oil, add tomatoes and simmer 12 minutes.",
      "Toss pasta in the sauce with basil.",
      "Top with parmesan."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 520,
      "protein_g": 17,
      "carbs_g": 88,
      "fat_g": 11,
      "fiber_g": 5
    },
    "id": "c5aa87c4-2651-5cd3-b284-8d6861d6270e"
  },
  {
    "name": "Chicken Fried Rice",
    "region": "China",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 3,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Cooked cold rice",
        "qty": "450 g"
      },
      {
        "item": "Chicken breast, diced",
        "qty": "250 g"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Peas and carrots",
        "qty": "1 cup"
      },
      {
        "item": "Spring onions",
        "qty": "3"
      },
      {
        "item": "Soy sauce",
        "qty": "2 tbsp"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Stir-fry chicken in oil until cooked and set aside.",
      "Scramble the eggs in the same wok.",
      "Add rice, vegetables and soy sauce and stir-fry on high heat 4 minutes.",
      "Return chicken and finish with spring onions."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 435,
      "protein_g": 28,
      "carbs_g": 58,
      "fat_g": 10,
      "fiber_g": 4
    },
    "id": "6808186e-bf3b-5782-8b3a-ff0e70e96f34"
  },
  {
    "name": "Mushroom Risotto",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 3,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Arborio rice",
        "qty": "200 g"
      },
      {
        "item": "Mushrooms, sliced",
        "qty": "250 g"
      },
      {
        "item": "Vegetable stock, hot",
        "qty": "800 ml"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Parmesan",
        "qty": "40 g"
      },
      {
        "item": "Butter",
        "qty": "1 tbsp"
      },
      {
        "item": "Garlic",
        "qty": "2 cloves"
      }
    ],
    "steps": [
      "Saute mushrooms until golden and set aside.",
      "Cook onion and garlic in butter, add rice and toast 1 minute.",
      "Add stock a ladle at a time, stirring, for about 18 minutes.",
      "Fold in mushrooms and parmesan."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 420,
      "protein_g": 12,
      "carbs_g": 66,
      "fat_g": 12,
      "fiber_g": 3
    },
    "id": "ae595e4c-afc1-59ab-ad29-cc8842609e25"
  },
  {
    "name": "Oyakodon (Chicken and Egg Rice Bowl)",
    "region": "Japan",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Chicken thigh, sliced",
        "qty": "250 g"
      },
      {
        "item": "Eggs",
        "qty": "3"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Dashi stock",
        "qty": "150 ml"
      },
      {
        "item": "Soy sauce",
        "qty": "2 tbsp"
      },
      {
        "item": "Mirin",
        "qty": "1 tbsp"
      },
      {
        "item": "Cooked rice",
        "qty": "400 g"
      }
    ],
    "steps": [
      "Simmer dashi, soy sauce and mirin with the onion for 3 minutes.",
      "Add chicken and cook 6 minutes.",
      "Pour beaten eggs over the top, cover and cook 1 to 2 minutes until just set.",
      "Slide over bowls of hot rice."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 575,
      "protein_g": 36,
      "carbs_g": 78,
      "fat_g": 13,
      "fiber_g": 3
    },
    "id": "9b27cf16-e4c8-5e46-b878-ae59cb41d6e3"
  },
  {
    "name": "Vegetable Paella",
    "region": "Spain",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Short-grain (bomba) rice",
        "qty": "300 g"
      },
      {
        "item": "Red pepper",
        "qty": "1"
      },
      {
        "item": "Green beans",
        "qty": "150 g"
      },
      {
        "item": "Tomatoes, grated",
        "qty": "2"
      },
      {
        "item": "Saffron",
        "qty": "1 pinch"
      },
      {
        "item": "Smoked paprika",
        "qty": "1 tsp"
      },
      {
        "item": "Vegetable stock",
        "qty": "900 ml"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Peas",
        "qty": "100 g"
      }
    ],
    "steps": [
      "Saute pepper and green beans in oil, then add tomato and paprika.",
      "Stir in the rice, saffron and hot stock.",
      "Simmer without stirring for 18 minutes, adding peas near the end.",
      "Rest 5 minutes before serving."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 390,
      "protein_g": 10,
      "carbs_g": 70,
      "fat_g": 8,
      "fiber_g": 6
    },
    "id": "d971bafc-323f-5a25-88d1-59e016543a2c"
  },
  {
    "name": "Banana Oat Pancakes",
    "region": "USA",
    "type": "Egg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Rolled oats",
        "qty": "80 g"
      },
      {
        "item": "Ripe bananas",
        "qty": "2"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Milk",
        "qty": "100 ml"
      },
      {
        "item": "Baking powder",
        "qty": "1 tsp"
      },
      {
        "item": "Cinnamon",
        "qty": "1/2 tsp"
      },
      {
        "item": "Honey",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Blend oats, bananas, eggs, milk, baking powder and cinnamon.",
      "Cook pancakes on a non-stick pan for 2 minutes per side.",
      "Drizzle with honey."
    ],
    "macros": {
      "per": "3 pancakes",
      "calories": 345,
      "protein_g": 14,
      "carbs_g": 56,
      "fat_g": 7,
      "fiber_g": 6
    },
    "id": "0779d716-2e5e-5a0f-b5e7-621d9c99a500"
  },
  {
    "name": "Whole Wheat Penne Arrabbiata",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Whole wheat penne",
        "qty": "180 g dry"
      },
      {
        "item": "Crushed tomatoes",
        "qty": "400 g"
      },
      {
        "item": "Garlic",
        "qty": "4 cloves"
      },
      {
        "item": "Dried red chillies",
        "qty": "2"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Fresh parsley",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Boil the penne until al dente.",
      "Fry garlic and chillies in oil, add tomatoes and simmer 12 minutes.",
      "Toss pasta through the sauce and top with parsley."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 490,
      "protein_g": 16,
      "carbs_g": 86,
      "fat_g": 9,
      "fiber_g": 10
    },
    "id": "f4d095f0-f04b-575f-931e-11ac0d73b011"
  },
  {
    "name": "Mexican Rice and Beans",
    "region": "Mexico",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Long-grain rice",
        "qty": "250 g"
      },
      {
        "item": "Cooked pinto beans",
        "qty": "250 g"
      },
      {
        "item": "Tomato puree",
        "qty": "150 g"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Vegetable stock",
        "qty": "500 ml"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Fresh coriander",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Toast rice in oil until lightly golden.",
      "Add onion, garlic, cumin and tomato puree, then the stock.",
      "Cover and cook 15 minutes.",
      "Fold in the beans and coriander."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 395,
      "protein_g": 12,
      "carbs_g": 76,
      "fat_g": 5,
      "fiber_g": 9
    },
    "id": "c96ef332-ade7-5894-a66c-506e620b2348"
  },
  {
    "name": "Chicken Pad Thai",
    "region": "Thailand",
    "type": "Non-Veg",
    "time_minutes": 30,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Dry rice noodles",
        "qty": "120 g"
      },
      {
        "item": "Chicken breast, sliced",
        "qty": "200 g"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Bean sprouts",
        "qty": "1 cup"
      },
      {
        "item": "Tamarind paste",
        "qty": "2 tbsp"
      },
      {
        "item": "Fish sauce",
        "qty": "1 tbsp"
      },
      {
        "item": "Brown sugar",
        "qty": "1 tbsp"
      },
      {
        "item": "Crushed peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Spring onions",
        "qty": "2"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Lime",
        "qty": "1"
      }
    ],
    "steps": [
      "Soak noodles in warm water for 20 minutes.",
      "Stir-fry chicken in oil, push aside and scramble the eggs.",
      "Add noodles, tamarind, fish sauce and sugar and toss 3 minutes.",
      "Add sprouts and spring onions; top with peanuts and lime."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 590,
      "protein_g": 34,
      "carbs_g": 78,
      "fat_g": 16,
      "fiber_g": 5
    },
    "id": "785f51c1-3672-5276-975d-0944ab997e4e"
  },
  {
    "name": "Potato Gnocchi in Tomato Basil Sauce",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Potato gnocchi",
        "qty": "500 g"
      },
      {
        "item": "Passata",
        "qty": "400 g"
      },
      {
        "item": "Garlic",
        "qty": "2 cloves"
      },
      {
        "item": "Fresh basil",
        "qty": "1 handful"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Grated parmesan",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Simmer garlic and passata in oil for 10 minutes.",
      "Boil the gnocchi until they float, about 2 minutes.",
      "Toss in the sauce and top with basil and parmesan."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 410,
      "protein_g": 14,
      "carbs_g": 70,
      "fat_g": 8,
      "fiber_g": 5
    },
    "id": "e04face0-7cb1-567d-a010-d4b5b5ba313c"
  },
  {
    "name": "Loaded Baked Potato with Cottage Cheese",
    "region": "Ireland",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Large potatoes",
        "qty": "2 (500 g)"
      },
      {
        "item": "Cottage cheese",
        "qty": "200 g"
      },
      {
        "item": "Chives",
        "qty": "2 tbsp"
      },
      {
        "item": "Butter",
        "qty": "2 tsp"
      },
      {
        "item": "Steamed broccoli",
        "qty": "100 g"
      },
      {
        "item": "Black pepper",
        "qty": "to taste"
      }
    ],
    "steps": [
      "Prick potatoes and bake at 200 C for 50 minutes.",
      "Split open and mash lightly with butter.",
      "Top with cottage cheese, broccoli, chives and pepper."
    ],
    "macros": {
      "per": "1 potato",
      "calories": 415,
      "protein_g": 22,
      "carbs_g": 68,
      "fat_g": 6,
      "fiber_g": 8
    },
    "id": "09baf264-7f2b-55cb-b11c-4eae3c36d97d"
  },
  {
    "name": "Bircher Muesli",
    "region": "Switzerland",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Rolled oats",
        "qty": "100 g"
      },
      {
        "item": "Grated apple",
        "qty": "1"
      },
      {
        "item": "Greek yogurt",
        "qty": "150 g"
      },
      {
        "item": "Milk",
        "qty": "150 ml"
      },
      {
        "item": "Almonds, chopped",
        "qty": "20 g"
      },
      {
        "item": "Raisins",
        "qty": "2 tbsp"
      },
      {
        "item": "Honey",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Mix oats, apple, yogurt and milk.",
      "Refrigerate overnight.",
      "Top with almonds, raisins and honey before serving."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 435,
      "protein_g": 18,
      "carbs_g": 64,
      "fat_g": 12,
      "fiber_g": 8
    },
    "id": "63bd2c66-f579-55a0-a550-b6f5d51d01b3"
  },
  {
    "name": "Chicken Burrito",
    "region": "Mexico",
    "type": "Non-Veg",
    "time_minutes": 30,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Large whole wheat tortillas",
        "qty": "2"
      },
      {
        "item": "Chicken breast, grilled",
        "qty": "250 g"
      },
      {
        "item": "Cooked rice",
        "qty": "200 g"
      },
      {
        "item": "Black beans",
        "qty": "150 g"
      },
      {
        "item": "Tomato salsa",
        "qty": "4 tbsp"
      },
      {
        "item": "Grated cheese",
        "qty": "40 g"
      },
      {
        "item": "Lettuce",
        "qty": "1 cup"
      }
    ],
    "steps": [
      "Warm the tortillas.",
      "Layer rice, beans, sliced chicken, salsa, cheese and lettuce.",
      "Fold in the sides, roll tightly and toast seam-side down for 1 minute."
    ],
    "macros": {
      "per": "1 burrito",
      "calories": 615,
      "protein_g": 42,
      "carbs_g": 82,
      "fat_g": 13,
      "fiber_g": 11
    },
    "id": "612460c3-eb65-5110-9295-b1b7709a1a40"
  },
  {
    "name": "Bibimbap",
    "region": "South Korea",
    "type": "Non-Veg",
    "time_minutes": 40,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Cooked short-grain rice",
        "qty": "400 g"
      },
      {
        "item": "Beef mince",
        "qty": "150 g"
      },
      {
        "item": "Spinach",
        "qty": "100 g"
      },
      {
        "item": "Carrot, julienned",
        "qty": "1"
      },
      {
        "item": "Zucchini, sliced",
        "qty": "1"
      },
      {
        "item": "Bean sprouts",
        "qty": "100 g"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Gochujang",
        "qty": "2 tbsp"
      },
      {
        "item": "Sesame oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Cook beef with a little soy sauce.",
      "Quickly saute each vegetable separately.",
      "Fry the eggs sunny-side up.",
      "Arrange everything over rice and serve with gochujang."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 615,
      "protein_g": 32,
      "carbs_g": 84,
      "fat_g": 17,
      "fiber_g": 7
    },
    "id": "eed15ba0-e597-5d50-9f67-f9568495fd88"
  },
  {
    "name": "Tuna Onigiri",
    "region": "Japan",
    "type": "Non-Veg",
    "time_minutes": 25,
    "serves": 4,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Cooked sushi rice",
        "qty": "500 g"
      },
      {
        "item": "Canned tuna",
        "qty": "120 g"
      },
      {
        "item": "Light mayo or Greek yogurt",
        "qty": "2 tbsp"
      },
      {
        "item": "Nori sheets",
        "qty": "2"
      },
      {
        "item": "Soy sauce",
        "qty": "1 tsp"
      },
      {
        "item": "Salt",
        "qty": "1 pinch"
      }
    ],
    "steps": [
      "Mix tuna with mayo and soy sauce.",
      "With damp hands, shape rice around a spoon of tuna into triangles.",
      "Wrap each with a strip of nori."
    ],
    "macros": {
      "per": "2 rice balls",
      "calories": 315,
      "protein_g": 14,
      "carbs_g": 58,
      "fat_g": 3,
      "fiber_g": 1
    },
    "id": "27a6fe67-1271-58eb-8f73-84a915fee274"
  },
  {
    "name": "Whole Wheat French Toast with Berries",
    "region": "France",
    "type": "Egg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Whole wheat bread",
        "qty": "4 slices"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Milk",
        "qty": "100 ml"
      },
      {
        "item": "Cinnamon",
        "qty": "1/2 tsp"
      },
      {
        "item": "Mixed berries",
        "qty": "100 g"
      },
      {
        "item": "Honey",
        "qty": "1 tbsp"
      },
      {
        "item": "Butter",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Whisk eggs, milk and cinnamon.",
      "Soak bread slices for 30 seconds per side.",
      "Cook in a buttered pan until golden.",
      "Serve with berries and honey."
    ],
    "macros": {
      "per": "2 slices",
      "calories": 355,
      "protein_g": 18,
      "carbs_g": 48,
      "fat_g": 10,
      "fiber_g": 7
    },
    "id": "4c496769-4ed7-50b9-90e8-98fbf4006e0c"
  },
  {
    "name": "Chicken Congee",
    "region": "China",
    "type": "Non-Veg",
    "time_minutes": 50,
    "serves": 3,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Jasmine rice",
        "qty": "150 g"
      },
      {
        "item": "Chicken breast",
        "qty": "250 g"
      },
      {
        "item": "Water or stock",
        "qty": "1.5 l"
      },
      {
        "item": "Ginger",
        "qty": "3 cm"
      },
      {
        "item": "Spring onions",
        "qty": "2"
      },
      {
        "item": "Soy sauce",
        "qty": "1 tbsp"
      },
      {
        "item": "Sesame oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Simmer rice with stock and ginger for 35 minutes until creamy.",
      "Add the whole chicken breast for the last 15 minutes, then shred it.",
      "Season with soy sauce and top with spring onion and sesame oil."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 340,
      "protein_g": 24,
      "carbs_g": 50,
      "fat_g": 5,
      "fiber_g": 1
    },
    "id": "0d77bf55-5f59-5598-9ad7-9c4231c66064"
  },
  {
    "name": "Brazilian Tapioca Crepe with Egg and Cheese",
    "region": "Brazil",
    "type": "Egg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Tapioca starch",
        "qty": "100 g"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Cheese, grated",
        "qty": "40 g"
      },
      {
        "item": "Tomato, sliced",
        "qty": "1"
      },
      {
        "item": "Salt",
        "qty": "1 pinch"
      }
    ],
    "steps": [
      "Sieve tapioca starch into a dry non-stick pan and let it set into a crepe, about 1 minute per side.",
      "Scramble the eggs separately.",
      "Fill the crepes with egg, cheese and tomato and fold."
    ],
    "macros": {
      "per": "1 crepe",
      "calories": 370,
      "protein_g": 20,
      "carbs_g": 46,
      "fat_g": 12,
      "fiber_g": 1
    },
    "id": "fa23caef-3344-5014-897f-a6e1bd416116"
  },
  {
    "name": "Protein Mac and Cheese",
    "region": "USA",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Whole wheat macaroni",
        "qty": "250 g"
      },
      {
        "item": "Cottage cheese",
        "qty": "200 g"
      },
      {
        "item": "Cheddar",
        "qty": "80 g"
      },
      {
        "item": "Milk",
        "qty": "150 ml"
      },
      {
        "item": "Mustard",
        "qty": "1 tsp"
      },
      {
        "item": "Garlic powder",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Boil macaroni until tender.",
      "Blend cottage cheese with milk and mustard until smooth.",
      "Warm the sauce with cheddar and garlic powder.",
      "Toss with the pasta."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 500,
      "protein_g": 28,
      "carbs_g": 66,
      "fat_g": 14,
      "fiber_g": 8
    },
    "id": "d0fec993-ad67-5360-8ff1-429ad4941146"
  },
  {
    "name": "Swiss Rosti with Fried Egg",
    "region": "Switzerland",
    "type": "Egg",
    "time_minutes": 30,
    "serves": 2,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Potatoes, grated",
        "qty": "500 g"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Butter",
        "qty": "1 tbsp"
      },
      {
        "item": "Onion, finely sliced",
        "qty": "1/2"
      },
      {
        "item": "Salt and pepper",
        "qty": "to taste"
      }
    ],
    "steps": [
      "Squeeze grated potato dry and mix with onion, salt and pepper.",
      "Fry in butter pressed into a flat cake for 8 minutes per side.",
      "Fry the eggs and serve on top."
    ],
    "macros": {
      "per": "1/2 rosti with 1 egg",
      "calories": 385,
      "protein_g": 14,
      "carbs_g": 48,
      "fat_g": 15,
      "fiber_g": 5
    },
    "id": "c316d823-d564-5041-97dd-39178401a14f"
  },
  {
    "name": "Moroccan Couscous with Chickpeas",
    "region": "Morocco",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "focus": "High Carb",
    "ingredients": [
      {
        "item": "Couscous",
        "qty": "240 g dry"
      },
      {
        "item": "Cooked chickpeas",
        "qty": "250 g"
      },
      {
        "item": "Zucchini",
        "qty": "1"
      },
      {
        "item": "Carrot",
        "qty": "1"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Raisins",
        "qty": "2 tbsp"
      },
      {
        "item": "Ras el hanout",
        "qty": "2 tsp"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Saute onion, carrot and zucchini with the spice in oil.",
      "Add chickpeas and raisins and warm through.",
      "Pour boiling water over couscous, cover for 5 minutes and fluff.",
      "Combine and serve."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 475,
      "protein_g": 16,
      "carbs_g": 80,
      "fat_g": 10,
      "fiber_g": 10
    },
    "id": "97246493-e41d-58ff-afd2-fd8b52f2511f"
  },
  {
    "name": "Black Bean Burrito Bowl",
    "region": "Mexico",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 2,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Cooked black beans",
        "qty": "300 g"
      },
      {
        "item": "Cooked brown rice",
        "qty": "200 g"
      },
      {
        "item": "Sweet corn",
        "qty": "100 g"
      },
      {
        "item": "Avocado",
        "qty": "1"
      },
      {
        "item": "Tomato salsa",
        "qty": "4 tbsp"
      },
      {
        "item": "Lime",
        "qty": "1"
      },
      {
        "item": "Fresh coriander",
        "qty": "2 tbsp"
      },
      {
        "item": "Red onion",
        "qty": "1/2"
      }
    ],
    "steps": [
      "Warm beans with a pinch of cumin.",
      "Layer rice, beans, corn and salsa in bowls.",
      "Top with sliced avocado, onion, coriander and lime juice."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 525,
      "protein_g": 20,
      "carbs_g": 78,
      "fat_g": 15,
      "fiber_g": 20
    },
    "id": "6276e249-ef92-59ec-9f73-38c38d936c6c"
  },
  {
    "name": "Hummus with Veggie Plate",
    "region": "Lebanon",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Canned chickpeas, drained",
        "qty": "400 g"
      },
      {
        "item": "Tahini",
        "qty": "2 tbsp"
      },
      {
        "item": "Lemon juice",
        "qty": "1 lemon"
      },
      {
        "item": "Garlic",
        "qty": "1 clove"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Cumin",
        "qty": "1/2 tsp"
      },
      {
        "item": "Carrot, cucumber and pepper sticks",
        "qty": "300 g"
      }
    ],
    "steps": [
      "Blend chickpeas, tahini, lemon, garlic, cumin and 3 tbsp water until smooth.",
      "Spread in a bowl and drizzle with oil.",
      "Serve with the raw vegetable sticks."
    ],
    "macros": {
      "per": "1/2 portion",
      "calories": 330,
      "protein_g": 14,
      "carbs_g": 32,
      "fat_g": 16,
      "fiber_g": 11
    },
    "id": "ad43bd30-e031-5c2e-8cbe-388e67053c16"
  },
  {
    "name": "Baked Falafel Bowl",
    "region": "Egypt",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 3,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Dried chickpeas, soaked overnight",
        "qty": "200 g"
      },
      {
        "item": "Parsley and coriander",
        "qty": "1 cup"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Baking powder",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Cooked quinoa",
        "qty": "300 g"
      },
      {
        "item": "Cucumber tomato salad",
        "qty": "2 cups"
      }
    ],
    "steps": [
      "Blitz chickpeas, herbs, onion, garlic and spices into a coarse mix.",
      "Shape into 12 balls and brush with oil.",
      "Bake at 200 C for 25 minutes, turning once.",
      "Serve over quinoa with salad."
    ],
    "macros": {
      "per": "1 bowl (4 falafel)",
      "calories": 370,
      "protein_g": 18,
      "carbs_g": 52,
      "fat_g": 10,
      "fiber_g": 14
    },
    "id": "6f9d778a-7f50-5605-aa86-d51d23fda0d5"
  },
  {
    "name": "Minestrone Soup",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Carrot, celery and onion, diced",
        "qty": "300 g"
      },
      {
        "item": "Zucchini",
        "qty": "1"
      },
      {
        "item": "Cannellini beans",
        "qty": "250 g"
      },
      {
        "item": "Whole wheat small pasta",
        "qty": "80 g"
      },
      {
        "item": "Chopped tomatoes",
        "qty": "400 g"
      },
      {
        "item": "Vegetable stock",
        "qty": "1 l"
      },
      {
        "item": "Kale",
        "qty": "100 g"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Saute carrot, celery and onion in oil for 5 minutes.",
      "Add zucchini, tomatoes and stock and simmer 15 minutes.",
      "Add beans, pasta and kale and cook 10 minutes more."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 260,
      "protein_g": 13,
      "carbs_g": 38,
      "fat_g": 6,
      "fiber_g": 11
    },
    "id": "7ae60d3d-a4d3-5980-8493-a886a9c55747"
  },
  {
    "name": "Ribollita (Tuscan Bean Soup)",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Cannellini beans",
        "qty": "400 g"
      },
      {
        "item": "Kale",
        "qty": "200 g"
      },
      {
        "item": "Carrot, celery and onion",
        "qty": "300 g"
      },
      {
        "item": "Chopped tomatoes",
        "qty": "200 g"
      },
      {
        "item": "Whole grain bread",
        "qty": "4 slices"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Saute the vegetable base in oil for 8 minutes.",
      "Add tomatoes, beans, kale and 800 ml water and simmer 25 minutes.",
      "Tear in the bread and cook until thick and stew-like."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 305,
      "protein_g": 16,
      "carbs_g": 42,
      "fat_g": 8,
      "fiber_g": 14
    },
    "id": "07d0595f-9235-52ff-8943-bba3f4ebe9fc"
  },
  {
    "name": "Turkish Red Lentil Soup",
    "region": "Turkey",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Red lentils",
        "qty": "200 g"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Carrot",
        "qty": "1"
      },
      {
        "item": "Small potato",
        "qty": "1"
      },
      {
        "item": "Tomato paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Paprika",
        "qty": "1 tsp"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Lemon",
        "qty": "1"
      }
    ],
    "steps": [
      "Saute onion, carrot and potato in oil with the spices and tomato paste.",
      "Add lentils and 1 l water and simmer 20 minutes.",
      "Blend until smooth and finish with lemon juice."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 270,
      "protein_g": 16,
      "carbs_g": 40,
      "fat_g": 5,
      "fiber_g": 12
    },
    "id": "4d18bb7f-47f6-5468-809b-1a5d7be1f6db"
  },
  {
    "name": "Fasolada (Greek White Bean Soup)",
    "region": "Greece",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Dried white beans, soaked overnight",
        "qty": "250 g"
      },
      {
        "item": "Carrot, celery and onion",
        "qty": "300 g"
      },
      {
        "item": "Tomato paste",
        "qty": "2 tbsp"
      },
      {
        "item": "Olive oil",
        "qty": "3 tbsp"
      },
      {
        "item": "Bay leaf",
        "qty": "1"
      },
      {
        "item": "Fresh parsley",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Boil beans for 10 minutes and drain.",
      "Return to the pot with vegetables, tomato paste, bay leaf and fresh water.",
      "Simmer 40 minutes until soft.",
      "Finish with olive oil and parsley."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 330,
      "protein_g": 15,
      "carbs_g": 40,
      "fat_g": 12,
      "fiber_g": 14
    },
    "id": "8c0823f6-7cb8-5052-a56e-3c4808e57fd4"
  },
  {
    "name": "Chickpea Greek Salad",
    "region": "Greece",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Cooked chickpeas",
        "qty": "250 g"
      },
      {
        "item": "Cucumber",
        "qty": "1"
      },
      {
        "item": "Tomatoes",
        "qty": "2"
      },
      {
        "item": "Red onion",
        "qty": "1/2"
      },
      {
        "item": "Black olives",
        "qty": "10"
      },
      {
        "item": "Feta",
        "qty": "60 g"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Dried oregano",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Chop the cucumber, tomatoes and onion.",
      "Toss with chickpeas, olives and feta.",
      "Dress with oil and oregano."
    ],
    "macros": {
      "per": "1 large bowl",
      "calories": 375,
      "protein_g": 18,
      "carbs_g": 38,
      "fat_g": 17,
      "fiber_g": 11
    },
    "id": "3ad71708-1dfb-5142-997d-a4bb570a6264"
  },
  {
    "name": "Quinoa Black Bean Stuffed Peppers",
    "region": "USA",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Large bell peppers",
        "qty": "4"
      },
      {
        "item": "Cooked quinoa",
        "qty": "300 g"
      },
      {
        "item": "Black beans",
        "qty": "250 g"
      },
      {
        "item": "Sweet corn",
        "qty": "100 g"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Tomato salsa",
        "qty": "150 g"
      },
      {
        "item": "Grated cheese",
        "qty": "60 g"
      }
    ],
    "steps": [
      "Halve and deseed the peppers.",
      "Mix quinoa, beans, corn, cumin and salsa.",
      "Stuff the peppers, top with cheese and bake at 190 C for 30 minutes."
    ],
    "macros": {
      "per": "1 stuffed pepper",
      "calories": 290,
      "protein_g": 15,
      "carbs_g": 40,
      "fat_g": 8,
      "fiber_g": 12
    },
    "id": "d3362d77-8ffa-525c-af1a-00af077cd826"
  },
  {
    "name": "Mediterranean Quinoa Salad",
    "region": "Greece",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Dry quinoa",
        "qty": "150 g"
      },
      {
        "item": "Cucumber",
        "qty": "1"
      },
      {
        "item": "Cherry tomatoes",
        "qty": "150 g"
      },
      {
        "item": "Cooked chickpeas",
        "qty": "200 g"
      },
      {
        "item": "Fresh parsley",
        "qty": "1 cup"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Lemon",
        "qty": "1"
      },
      {
        "item": "Feta",
        "qty": "50 g"
      }
    ],
    "steps": [
      "Cook quinoa in 300 ml water for 15 minutes and cool.",
      "Chop the vegetables and herbs.",
      "Toss everything with oil, lemon juice and feta."
    ],
    "macros": {
      "per": "1/3 of the salad",
      "calories": 375,
      "protein_g": 16,
      "carbs_g": 46,
      "fat_g": 14,
      "fiber_g": 9
    },
    "id": "0eafc7c7-2eb3-5d75-8bdd-f6a0f9e30412"
  },
  {
    "name": "Farro and Roasted Vegetable Bowl",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 3,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Farro",
        "qty": "180 g"
      },
      {
        "item": "Zucchini",
        "qty": "1"
      },
      {
        "item": "Bell pepper",
        "qty": "1"
      },
      {
        "item": "Small eggplant",
        "qty": "1"
      },
      {
        "item": "Cherry tomatoes",
        "qty": "150 g"
      },
      {
        "item": "White beans",
        "qty": "150 g"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Balsamic vinegar",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Cook farro for 25 minutes and drain.",
      "Roast chopped vegetables with oil at 210 C for 25 minutes.",
      "Toss with farro, beans and balsamic vinegar."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 385,
      "protein_g": 14,
      "carbs_g": 60,
      "fat_g": 10,
      "fiber_g": 12
    },
    "id": "6e678833-8be1-5b3b-9f8f-f5eca755d812"
  },
  {
    "name": "Avocado Toast with Poached Egg",
    "region": "Australia",
    "type": "Egg",
    "time_minutes": 15,
    "serves": 2,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Whole grain bread",
        "qty": "4 slices"
      },
      {
        "item": "Avocado",
        "qty": "1"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Chilli flakes",
        "qty": "1/2 tsp"
      },
      {
        "item": "Lemon juice",
        "qty": "1 tsp"
      },
      {
        "item": "Mixed seeds",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Toast the bread.",
      "Mash avocado with lemon and spread over the toast.",
      "Poach the eggs for 3 minutes.",
      "Top with eggs, seeds and chilli flakes."
    ],
    "macros": {
      "per": "2 slices with 1 egg",
      "calories": 370,
      "protein_g": 16,
      "carbs_g": 34,
      "fat_g": 19,
      "fiber_g": 11
    },
    "id": "4c054fae-429b-5720-8d0f-7ce213c29da7"
  },
  {
    "name": "Chia Pudding with Berries",
    "region": "Mexico",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 2,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Chia seeds",
        "qty": "50 g"
      },
      {
        "item": "Milk",
        "qty": "300 ml"
      },
      {
        "item": "Mixed berries",
        "qty": "100 g"
      },
      {
        "item": "Honey",
        "qty": "1 tsp"
      },
      {
        "item": "Vanilla extract",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Stir chia seeds into milk with honey and vanilla.",
      "Refrigerate overnight, stirring once after 30 minutes.",
      "Top with berries."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 260,
      "protein_g": 9,
      "carbs_g": 27,
      "fat_g": 13,
      "fiber_g": 12
    },
    "id": "4c3db31c-df45-50f3-841c-bd1dec8f01af"
  },
  {
    "name": "Scottish Porridge with Berries and Flax",
    "region": "Scotland",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 1,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Rolled oats",
        "qty": "60 g"
      },
      {
        "item": "Milk",
        "qty": "250 ml"
      },
      {
        "item": "Ground flaxseed",
        "qty": "1 tbsp"
      },
      {
        "item": "Mixed berries",
        "qty": "80 g"
      },
      {
        "item": "Walnuts",
        "qty": "10 g"
      }
    ],
    "steps": [
      "Cook oats with milk over medium heat for 5 minutes, stirring.",
      "Stir in flaxseed.",
      "Top with berries and walnuts."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 400,
      "protein_g": 16,
      "carbs_g": 55,
      "fat_g": 13,
      "fiber_g": 10
    },
    "id": "f6977864-066a-5708-a362-ecbe9d46ad92"
  },
  {
    "name": "Soba and Edamame Salad",
    "region": "Japan",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 2,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Buckwheat soba",
        "qty": "150 g dry"
      },
      {
        "item": "Shelled edamame",
        "qty": "150 g"
      },
      {
        "item": "Cucumber",
        "qty": "1/2"
      },
      {
        "item": "Carrot",
        "qty": "1"
      },
      {
        "item": "Soy sauce",
        "qty": "2 tbsp"
      },
      {
        "item": "Rice vinegar",
        "qty": "1 tbsp"
      },
      {
        "item": "Sesame oil",
        "qty": "1 tsp"
      },
      {
        "item": "Sesame seeds",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Cook soba for 5 minutes, rinse under cold water and drain.",
      "Boil edamame for 3 minutes.",
      "Toss noodles, edamame and vegetables with soy, vinegar and sesame oil.",
      "Top with sesame seeds."
    ],
    "macros": {
      "per": "1 large bowl",
      "calories": 425,
      "protein_g": 20,
      "carbs_g": 66,
      "fat_g": 9,
      "fiber_g": 9
    },
    "id": "646ecf9b-ff66-5efa-8c3d-e9569ca43d83"
  },
  {
    "name": "Ratatouille with White Beans",
    "region": "France",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 3,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Eggplant",
        "qty": "1"
      },
      {
        "item": "Zucchini",
        "qty": "2"
      },
      {
        "item": "Bell peppers",
        "qty": "2"
      },
      {
        "item": "Chopped tomatoes",
        "qty": "400 g"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "White beans",
        "qty": "250 g"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Fresh thyme",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Saute onion and garlic in oil.",
      "Add the chopped vegetables and thyme and cook 10 minutes.",
      "Add tomatoes and simmer 25 minutes.",
      "Stir in the beans and heat through."
    ],
    "macros": {
      "per": "1/3 of the pot",
      "calories": 300,
      "protein_g": 14,
      "carbs_g": 38,
      "fat_g": 10,
      "fiber_g": 14
    },
    "id": "8c2626b0-372e-54c6-96ca-442c08cc3c42"
  },
  {
    "name": "Moroccan Chickpea Tagine",
    "region": "Morocco",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Cooked chickpeas",
        "qty": "500 g"
      },
      {
        "item": "Sweet potato, cubed",
        "qty": "300 g"
      },
      {
        "item": "Carrot",
        "qty": "1"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Chopped tomatoes",
        "qty": "400 g"
      },
      {
        "item": "Dried apricots",
        "qty": "6"
      },
      {
        "item": "Ras el hanout",
        "qty": "2 tsp"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Saute onion with spices in oil.",
      "Add carrot, sweet potato, tomatoes and apricots with 200 ml water.",
      "Simmer 20 minutes, add chickpeas and cook 10 minutes more."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 330,
      "protein_g": 15,
      "carbs_g": 52,
      "fat_g": 7,
      "fiber_g": 14
    },
    "id": "ebe646b4-8c3b-5ccd-a37f-97c828ce66d5"
  },
  {
    "name": "Cuban Black Bean Soup",
    "region": "Cuba",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Dried black beans, soaked overnight",
        "qty": "250 g"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Green pepper",
        "qty": "1"
      },
      {
        "item": "Garlic",
        "qty": "4 cloves"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Dried oregano",
        "qty": "1 tsp"
      },
      {
        "item": "Bay leaf",
        "qty": "1"
      },
      {
        "item": "Vinegar",
        "qty": "1 tbsp"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Saute onion, pepper and garlic in oil with the spices.",
      "Add beans, bay leaf and 1.2 l water and simmer 40 minutes until tender.",
      "Stir in vinegar and mash a few beans to thicken."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 300,
      "protein_g": 17,
      "carbs_g": 42,
      "fat_g": 7,
      "fiber_g": 16
    },
    "id": "23ba6cde-7c97-56af-9acc-14994a1d060f"
  },
  {
    "name": "Espinacas con Garbanzos",
    "region": "Spain",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Cooked chickpeas",
        "qty": "400 g"
      },
      {
        "item": "Fresh spinach",
        "qty": "300 g"
      },
      {
        "item": "Garlic",
        "qty": "4 cloves"
      },
      {
        "item": "Smoked paprika",
        "qty": "1 tsp"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Whole wheat bread",
        "qty": "1 slice"
      },
      {
        "item": "Olive oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Sherry vinegar",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Fry the bread and garlic in oil, then blend with paprika, cumin and vinegar into a paste.",
      "Wilt the spinach in a pan.",
      "Add chickpeas and the paste with a splash of water and simmer 10 minutes."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 300,
      "protein_g": 14,
      "carbs_g": 34,
      "fat_g": 12,
      "fiber_g": 12
    },
    "id": "72e063c7-18f5-5770-be0b-32952026d2b8"
  },
  {
    "name": "Roasted Brussels Sprouts and Sweet Potato Bowl",
    "region": "USA",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 2,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Brussels sprouts",
        "qty": "250 g"
      },
      {
        "item": "Sweet potato, cubed",
        "qty": "300 g"
      },
      {
        "item": "Cooked quinoa",
        "qty": "200 g"
      },
      {
        "item": "Cooked chickpeas",
        "qty": "150 g"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Tahini",
        "qty": "1 tbsp"
      },
      {
        "item": "Lemon juice",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Roast sprouts, sweet potato and chickpeas with oil at 210 C for 25 minutes.",
      "Mix tahini, lemon juice and a little water for the dressing.",
      "Serve over quinoa and drizzle with dressing."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 460,
      "protein_g": 16,
      "carbs_g": 70,
      "fat_g": 13,
      "fiber_g": 15
    },
    "id": "aedd63bf-0543-504a-952e-eb6b84b562c9"
  },
  {
    "name": "Whole Wheat Spaghetti with Lentil Bolognese",
    "region": "Italy",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 3,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Whole wheat spaghetti",
        "qty": "240 g dry"
      },
      {
        "item": "Cooked green lentils",
        "qty": "300 g"
      },
      {
        "item": "Crushed tomatoes",
        "qty": "400 g"
      },
      {
        "item": "Carrot, celery and onion, diced",
        "qty": "250 g"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Olive oil",
        "qty": "1 tbsp"
      },
      {
        "item": "Dried oregano",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Saute the diced vegetables and garlic in oil for 8 minutes.",
      "Add tomatoes, lentils and oregano and simmer 20 minutes.",
      "Boil spaghetti and toss through the sauce."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 480,
      "protein_g": 22,
      "carbs_g": 82,
      "fat_g": 7,
      "fiber_g": 16
    },
    "id": "c4ba1789-c0e3-5564-bee9-e2c6b156ef85"
  },
  {
    "name": "Split Pea Soup",
    "region": "Canada",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 4,
    "focus": "High Fibre",
    "ingredients": [
      {
        "item": "Green split peas",
        "qty": "250 g"
      },
      {
        "item": "Carrots",
        "qty": "2"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Celery",
        "qty": "2 stalks"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Vegetable stock",
        "qty": "1.2 l"
      },
      {
        "item": "Bay leaf",
        "qty": "1"
      },
      {
        "item": "Fresh thyme",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Saute the vegetables and garlic for 5 minutes.",
      "Add peas, stock, bay leaf and thyme.",
      "Simmer 45 minutes until the peas break down.",
      "Blend partially for a thick texture."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 275,
      "protein_g": 18,
      "carbs_g": 44,
      "fat_g": 3,
      "fiber_g": 14
    },
    "id": "93958c1e-62fc-564a-aacd-1e8f2f8984bf"
  },
  {
    "name": "Idli (3 pieces)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Idli rice",
        "qty": "2 katori"
      },
      {
        "item": "Urad dal",
        "qty": "1/2 katori"
      },
      {
        "item": "Salt",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Soak rice and urad dal separately for 5 hours, then grind each to a smooth batter.",
      "Mix both batters with salt and ferment overnight until it rises and turns airy.",
      "Grease the idli moulds and pour a ladle of batter into each.",
      "Steam on high heat for 12 minutes until a toothpick comes out clean.",
      "Serve hot with sambar and coconut chutney."
    ],
    "macros": {
      "per": "3 idlis",
      "calories": 150,
      "protein_g": 5,
      "carbs_g": 31,
      "fat_g": 0.5,
      "fiber_g": 2
    },
    "id": "b269fa2c-840f-5ab9-aa27-dc5b15848128"
  },
  {
    "name": "Plain Dosa (1 large)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 4,
    "ingredients": [
      {
        "item": "Dosa rice",
        "qty": "2 katori"
      },
      {
        "item": "Urad dal",
        "qty": "1/2 katori"
      },
      {
        "item": "Methi seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      },
      {
        "item": "Salt",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Soak rice, urad dal and methi for 5 hours and grind to a fine batter.",
      "Ferment overnight, then add salt and thin with water to a pouring consistency.",
      "Heat a tawa, wipe with oil and spread a ladle of batter in a thin circle.",
      "Drizzle a little oil on the edges and cook until golden and crisp.",
      "Fold and serve with chutney and sambar."
    ],
    "macros": {
      "per": "1 dosa",
      "calories": 130,
      "protein_g": 3,
      "carbs_g": 24,
      "fat_g": 2.5,
      "fiber_g": 1
    },
    "id": "10191373-167b-55cd-b865-38e126df4d6a"
  },
  {
    "name": "Masala Dosa",
    "region": "South",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "ingredients": [
      {
        "item": "Dosa batter",
        "qty": "4 ladles"
      },
      {
        "item": "Boiled potatoes",
        "qty": "3 medium"
      },
      {
        "item": "Onion",
        "qty": "2 medium sliced"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "10 leaves"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Heat 1 tbsp oil, crackle mustard seeds, then add curry leaves, chilli and onion.",
      "Add turmeric, salt and mashed potatoes and mix well to make the filling.",
      "Spread a ladle of batter thinly on a hot tawa and drizzle oil around it.",
      "Cook until crisp, place the potato filling in the centre and fold.",
      "Serve hot with chutney and sambar."
    ],
    "macros": {
      "per": "1 dosa with filling",
      "calories": 300,
      "protein_g": 7,
      "carbs_g": 48,
      "fat_g": 9,
      "fiber_g": 4
    },
    "id": "b7420508-9f2e-592d-9a93-2ba78badcb7f"
  },
  {
    "name": "Rava Dosa",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Rava (sooji)",
        "qty": "1 katori"
      },
      {
        "item": "Rice flour",
        "qty": "1/2 katori"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Onion",
        "qty": "1 small chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Mix rava, rice flour, curd and salt with water to make a very thin, runny batter.",
      "Rest for 15 minutes and stir in onion, chilli, cumin and pepper.",
      "Heat a tawa and pour the batter from a height to form a lacy net pattern.",
      "Drizzle oil and cook on medium heat until crisp and golden.",
      "Fold and serve right away with chutney."
    ],
    "macros": {
      "per": "1 dosa",
      "calories": 180,
      "protein_g": 4,
      "carbs_g": 28,
      "fat_g": 6,
      "fiber_g": 1
    },
    "id": "cec6529c-c220-5c5e-bc45-6362de57327c"
  },
  {
    "name": "Onion Uttapam",
    "region": "South",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 4,
    "ingredients": [
      {
        "item": "Dosa batter",
        "qty": "4 ladles"
      },
      {
        "item": "Onion",
        "qty": "1 large chopped"
      },
      {
        "item": "Tomato",
        "qty": "1 chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Heat a tawa and pour a ladle of batter, spreading it thick and small.",
      "Sprinkle onion, tomato, chilli and coriander on top and press lightly.",
      "Drizzle oil around the edges and cook covered for 2 minutes.",
      "Flip and cook the other side until golden.",
      "Serve hot with coconut chutney."
    ],
    "macros": {
      "per": "1 uttapam",
      "calories": 190,
      "protein_g": 5,
      "carbs_g": 30,
      "fat_g": 5,
      "fiber_g": 2.5
    },
    "id": "de8f9dc6-cfe8-5dcc-8a48-d6a32d7432d5"
  },
  {
    "name": "Pesarattu (2 pieces)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Whole green moong",
        "qty": "1 katori"
      },
      {
        "item": "Rice",
        "qty": "1 tbsp"
      },
      {
        "item": "Ginger",
        "qty": "1 inch"
      },
      {
        "item": "Green chilli",
        "qty": "3"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Onion",
        "qty": "1 chopped"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Soak moong and rice for 4 hours and grind with ginger, chilli and cumin into a batter.",
      "Add salt and water to get a pouring consistency.",
      "Spread a ladle of batter thinly on a hot tawa and sprinkle chopped onion.",
      "Drizzle oil and cook until the underside is crisp and the top is set.",
      "Serve with ginger chutney or allam pachadi."
    ],
    "macros": {
      "per": "2 pesarattu",
      "calories": 260,
      "protein_g": 14,
      "carbs_g": 38,
      "fat_g": 6,
      "fiber_g": 7
    },
    "id": "dd198815-dcf1-569b-b783-6f458697f6a3"
  },
  {
    "name": "Ragi Dosa (2 pieces)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Ragi flour",
        "qty": "1 katori"
      },
      {
        "item": "Rice flour",
        "qty": "1/4 katori"
      },
      {
        "item": "Curd",
        "qty": "1/4 katori"
      },
      {
        "item": "Onion",
        "qty": "1 small chopped"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      },
      {
        "item": "Oil",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Whisk ragi flour, rice flour, curd, salt and water into a thin batter.",
      "Rest for 10 minutes and add onion and curry leaves.",
      "Pour the batter in a circular motion on a hot tawa.",
      "Drizzle oil and cook until crisp at the edges.",
      "Serve hot with chutney."
    ],
    "macros": {
      "per": "2 dosas",
      "calories": 200,
      "protein_g": 4,
      "carbs_g": 38,
      "fat_g": 4,
      "fiber_g": 4
    },
    "id": "f07a1047-8bb2-5cce-b3cb-aed2172eeb33"
  },
  {
    "name": "Medu Vada (2 pieces)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Urad dal",
        "qty": "1 katori"
      },
      {
        "item": "Green chilli",
        "qty": "2 chopped"
      },
      {
        "item": "Curry leaves",
        "qty": "8 chopped"
      },
      {
        "item": "Ginger",
        "qty": "1/2 inch"
      },
      {
        "item": "Black pepper",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil for frying",
        "qty": "1.5 katori"
      }
    ],
    "steps": [
      "Soak urad dal for 3 hours and grind with very little water to a thick fluffy batter.",
      "Mix in chilli, curry leaves, ginger, pepper and salt.",
      "Wet your palm, shape a ball, flatten it and make a hole in the centre.",
      "Slide into hot oil and fry on medium heat until golden and crisp.",
      "Serve hot with sambar and chutney."
    ],
    "macros": {
      "per": "2 vadas",
      "calories": 240,
      "protein_g": 9,
      "carbs_g": 28,
      "fat_g": 11,
      "fiber_g": 4
    },
    "id": "f74f9eda-a18b-5fb5-8ec9-b30107c6ae27"
  },
  {
    "name": "Rava Upma",
    "region": "South",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Rava",
        "qty": "1 katori"
      },
      {
        "item": "Onion",
        "qty": "1 chopped"
      },
      {
        "item": "Carrot and beans",
        "qty": "1/2 katori chopped"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Chana dal",
        "qty": "1 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      },
      {
        "item": "Oil or ghee",
        "qty": "2 tbsp"
      },
      {
        "item": "Water",
        "qty": "2.5 katori"
      }
    ],
    "steps": [
      "Dry roast rava until fragrant and set aside.",
      "Temper mustard, chana dal, curry leaves and green chilli in hot oil, then add onion and vegetables.",
      "Pour in hot water with salt and bring to a rolling boil.",
      "Add rava slowly while stirring to avoid lumps.",
      "Cover and cook 3 minutes, then finish with a squeeze of lemon."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 250,
      "protein_g": 6,
      "carbs_g": 40,
      "fat_g": 8,
      "fiber_g": 3
    },
    "id": "719d76d8-7656-5c44-bbcf-ebda9a461fe3"
  },
  {
    "name": "Ven Pongal",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Raw rice",
        "qty": "3/4 katori"
      },
      {
        "item": "Yellow moong dal",
        "qty": "1/4 katori"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      },
      {
        "item": "Black pepper",
        "qty": "1 tsp"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Ginger",
        "qty": "1 tsp grated"
      },
      {
        "item": "Cashews",
        "qty": "8"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      }
    ],
    "steps": [
      "Dry roast the moong dal lightly and pressure cook it with the washed rice and 4 katori water until very soft.",
      "Mash the rice and dal well and adjust salt.",
      "Heat ghee and fry cashews, pepper, cumin, ginger and curry leaves.",
      "Pour the tempering over the pongal and mix.",
      "Serve hot with sambar and chutney."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 290,
      "protein_g": 8,
      "carbs_g": 42,
      "fat_g": 10,
      "fiber_g": 3
    },
    "id": "044cf6b1-a760-5247-be87-3f787d6b2a4f"
  },
  {
    "name": "Sambar",
    "region": "South",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Toor dal",
        "qty": "1/2 katori"
      },
      {
        "item": "Mixed vegetables (drumstick, carrot, brinjal)",
        "qty": "1.5 katori"
      },
      {
        "item": "Tamarind pulp",
        "qty": "2 tbsp"
      },
      {
        "item": "Sambar powder",
        "qty": "2 tsp"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Pressure cook toor dal with turmeric until completely soft and mash it.",
      "Boil the vegetables in tamarind water with salt and sambar powder until tender.",
      "Add the mashed dal and simmer for 8 minutes.",
      "Heat oil and crackle mustard, dry red chilli and curry leaves.",
      "Pour the tempering over the sambar and serve with idli or rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 100,
      "protein_g": 5,
      "carbs_g": 15,
      "fat_g": 3,
      "fiber_g": 4
    },
    "id": "475671e5-3356-5db6-8388-0b6a1f58f149"
  },
  {
    "name": "Tomato Rasam",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 4,
    "ingredients": [
      {
        "item": "Tomato",
        "qty": "3 medium"
      },
      {
        "item": "Tamarind pulp",
        "qty": "1 tbsp"
      },
      {
        "item": "Rasam powder",
        "qty": "1.5 tsp"
      },
      {
        "item": "Cooked toor dal water",
        "qty": "1/2 katori"
      },
      {
        "item": "Garlic",
        "qty": "4 cloves crushed"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      }
    ],
    "steps": [
      "Boil crushed tomatoes with tamarind, salt, turmeric and rasam powder for 8 minutes.",
      "Add the dal water and garlic and let it come to a froth without boiling hard.",
      "Temper mustard, cumin and curry leaves in hot ghee or oil.",
      "Pour the tempering over the rasam.",
      "Garnish with coriander and serve with rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 45,
      "protein_g": 2,
      "carbs_g": 7,
      "fat_g": 1.5,
      "fiber_g": 1
    },
    "id": "e14101a7-fa8a-5477-9fe7-f4eb0d143bab"
  },
  {
    "name": "Coconut Chutney",
    "region": "South",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 4,
    "ingredients": [
      {
        "item": "Fresh grated coconut",
        "qty": "1 katori"
      },
      {
        "item": "Roasted chana dal",
        "qty": "2 tbsp"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Ginger",
        "qty": "1/2 inch"
      },
      {
        "item": "Mustard seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "6"
      }
    ],
    "steps": [
      "Grind coconut, roasted chana dal, chilli, ginger and salt with a little water into a smooth paste.",
      "Transfer to a bowl and adjust consistency with water.",
      "Heat a spoon of oil and crackle mustard seeds and curry leaves.",
      "Pour the tempering over the chutney.",
      "Serve with idli, dosa or vada."
    ],
    "macros": {
      "per": "2 tbsp",
      "calories": 60,
      "protein_g": 1,
      "carbs_g": 3,
      "fat_g": 5,
      "fiber_g": 1.5
    },
    "id": "dd5178cf-4ca9-5b02-a61f-26f84ed88de9"
  },
  {
    "name": "Tomato Pappu (Andhra)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Toor dal",
        "qty": "3/4 katori"
      },
      {
        "item": "Tomato",
        "qty": "3 chopped"
      },
      {
        "item": "Onion",
        "qty": "1 chopped"
      },
      {
        "item": "Green chilli",
        "qty": "3"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Garlic",
        "qty": "5 cloves"
      },
      {
        "item": "Mustard and cumin",
        "qty": "1 tsp each"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Pressure cook dal with tomato, onion, chilli and turmeric until very soft.",
      "Mash lightly and add salt and a little water to adjust consistency.",
      "Heat oil and crackle mustard, cumin, dry red chilli, garlic and curry leaves.",
      "Pour the tempering into the dal and simmer for 3 minutes.",
      "Serve with hot rice and ghee."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 150,
      "protein_g": 7,
      "carbs_g": 22,
      "fat_g": 4,
      "fiber_g": 5
    },
    "id": "97727a14-dd35-5497-8ad6-c8de48680765"
  },
  {
    "name": "Gongura Mutton",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 60,
    "serves": 4,
    "ingredients": [
      {
        "item": "Mutton",
        "qty": "500 g"
      },
      {
        "item": "Gongura leaves",
        "qty": "2 handfuls"
      },
      {
        "item": "Onion",
        "qty": "2 chopped"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1.5 tbsp"
      },
      {
        "item": "Red chilli powder",
        "qty": "2 tsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Pressure cook mutton with ginger-garlic paste, turmeric and salt until 80 percent tender.",
      "Saute gongura leaves in a little oil until they melt into a paste.",
      "Fry onions until golden, add chilli powder and the cooked mutton with its stock.",
      "Mix in the gongura paste and simmer until the oil separates.",
      "Serve with steamed rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 350,
      "protein_g": 28,
      "carbs_g": 8,
      "fat_g": 22,
      "fiber_g": 2
    },
    "id": "4adc5bca-fe0d-5c16-818c-5619adc502a5"
  },
  {
    "name": "Andhra Chicken Curry (Kodi Kura)",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chicken",
        "qty": "500 g"
      },
      {
        "item": "Onion",
        "qty": "2 large"
      },
      {
        "item": "Tomato",
        "qty": "2"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Red chilli powder",
        "qty": "2 tsp"
      },
      {
        "item": "Coriander powder",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Heat oil and fry sliced onions until deep golden.",
      "Add ginger-garlic paste, tomatoes and spice powders and cook until oil separates.",
      "Add chicken and salt and saute for 8 minutes.",
      "Pour in half a katori water, cover and simmer until chicken is cooked.",
      "Finish with coriander and garam masala and serve with rice or roti."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 330,
      "protein_g": 26,
      "carbs_g": 9,
      "fat_g": 22,
      "fiber_g": 2
    },
    "id": "8eda2a3b-1f2e-57c1-8b3f-6ba701a5795e"
  },
  {
    "name": "Chicken 65",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 3,
    "ingredients": [
      {
        "item": "Boneless chicken",
        "qty": "300 g"
      },
      {
        "item": "Curd",
        "qty": "2 tbsp"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Red chilli powder",
        "qty": "2 tsp"
      },
      {
        "item": "Corn flour",
        "qty": "2 tbsp"
      },
      {
        "item": "Curry leaves",
        "qty": "10"
      },
      {
        "item": "Oil for frying",
        "qty": "1 katori"
      }
    ],
    "steps": [
      "Marinate chicken with curd, ginger-garlic, chilli powder, salt and corn flour for 30 minutes.",
      "Heat oil and deep fry the pieces until crisp and cooked through.",
      "In a little oil, fry curry leaves and green chillies.",
      "Toss the fried chicken in with a squeeze of lemon.",
      "Serve hot with onion rings."
    ],
    "macros": {
      "per": "6 pieces",
      "calories": 300,
      "protein_g": 24,
      "carbs_g": 8,
      "fat_g": 19,
      "fiber_g": 1
    },
    "id": "12b2c66b-6a52-52b9-8f99-aeec2d39f239"
  },
  {
    "name": "Hyderabadi Chicken Dum Biryani",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 90,
    "serves": 4,
    "ingredients": [
      {
        "item": "Basmati rice",
        "qty": "2 katori"
      },
      {
        "item": "Chicken",
        "qty": "500 g"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Fried onion",
        "qty": "1 katori"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1.5 tbsp"
      },
      {
        "item": "Biryani masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Mint and coriander",
        "qty": "1 handful each"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Marinate chicken with curd, ginger-garlic, biryani masala, half the fried onion and herbs for 1 hour.",
      "Parboil the soaked rice with whole spices and salt until 70 percent cooked.",
      "Layer the marinated chicken at the bottom of a heavy pot and cover with rice.",
      "Top with fried onion, ghee, mint and saffron milk and seal the lid with dough.",
      "Cook on high for 5 minutes, then on low for 30 minutes and rest before serving."
    ],
    "macros": {
      "per": "1 plate (about 1.5 katori)",
      "calories": 520,
      "protein_g": 26,
      "carbs_g": 62,
      "fat_g": 18,
      "fiber_g": 2
    },
    "id": "c8d8fe95-dba2-5681-9073-4f61cd308960"
  },
  {
    "name": "Hyderabadi Veg Biryani",
    "region": "South",
    "type": "Veg",
    "time_minutes": 75,
    "serves": 4,
    "ingredients": [
      {
        "item": "Basmati rice",
        "qty": "2 katori"
      },
      {
        "item": "Mixed vegetables",
        "qty": "2 katori"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Fried onion",
        "qty": "1 katori"
      },
      {
        "item": "Biryani masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Mint",
        "qty": "1 handful"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Marinate vegetables in curd, ginger-garlic, biryani masala and salt for 30 minutes.",
      "Parboil soaked rice with whole spices until 70 percent done.",
      "Layer vegetables and rice in a heavy pot with mint, fried onion and ghee.",
      "Seal and cook on dum for 25 minutes on low flame.",
      "Rest for 10 minutes, mix gently and serve with raita."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 400,
      "protein_g": 9,
      "carbs_g": 62,
      "fat_g": 13,
      "fiber_g": 5
    },
    "id": "41432be5-5b99-5f9f-b3cb-71fb497f7621"
  },
  {
    "name": "Mirchi Ka Salan",
    "region": "South",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Large green chillies",
        "qty": "8"
      },
      {
        "item": "Peanuts",
        "qty": "3 tbsp"
      },
      {
        "item": "Sesame seeds",
        "qty": "2 tbsp"
      },
      {
        "item": "Dry coconut",
        "qty": "2 tbsp"
      },
      {
        "item": "Tamarind pulp",
        "qty": "1 tbsp"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Dry roast peanuts, sesame and coconut, then grind with fried onion into a smooth paste.",
      "Slit the chillies and shallow fry them until blistered.",
      "Temper mustard, cumin and curry leaves in oil, add the paste and cook until the oil separates.",
      "Add tamarind water, salt and turmeric and simmer 10 minutes.",
      "Add the chillies and cook 5 more minutes; serve with biryani."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 200,
      "protein_g": 5,
      "carbs_g": 10,
      "fat_g": 16,
      "fiber_g": 3
    },
    "id": "c382b08c-b1d4-59c8-89d4-4572a1dc5722"
  },
  {
    "name": "Hyderabadi Haleem",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 180,
    "serves": 6,
    "ingredients": [
      {
        "item": "Mutton",
        "qty": "500 g"
      },
      {
        "item": "Broken wheat",
        "qty": "1 katori"
      },
      {
        "item": "Mixed dals (chana, masoor, moong)",
        "qty": "1 katori"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "2 tbsp"
      },
      {
        "item": "Garam masala",
        "qty": "2 tsp"
      },
      {
        "item": "Fried onion",
        "qty": "1 katori"
      },
      {
        "item": "Ghee",
        "qty": "4 tbsp"
      }
    ],
    "steps": [
      "Soak the wheat and dals for 4 hours.",
      "Pressure cook mutton with ginger-garlic paste and salt until falling off the bone.",
      "Cook the wheat and dals with the mutton and stock until very soft.",
      "Mash everything with a heavy masher until thick and stretchy and add garam masala.",
      "Serve topped with fried onion, ghee, lemon and mint."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 300,
      "protein_g": 22,
      "carbs_g": 22,
      "fat_g": 14,
      "fiber_g": 4
    },
    "id": "7061098d-9ea4-5e19-a24e-4cc325f174a6"
  },
  {
    "name": "Baghara Baingan",
    "region": "South",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Small brinjals",
        "qty": "8"
      },
      {
        "item": "Peanuts",
        "qty": "3 tbsp"
      },
      {
        "item": "Sesame seeds",
        "qty": "2 tbsp"
      },
      {
        "item": "Dry coconut",
        "qty": "2 tbsp"
      },
      {
        "item": "Tamarind pulp",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Slit the brinjals and shallow fry until lightly browned.",
      "Roast peanuts, sesame and coconut and grind to a paste with fried onion.",
      "Cook the paste with chilli, turmeric, coriander powder and salt until oil separates.",
      "Add tamarind water and the brinjals and simmer for 12 minutes.",
      "Serve with biryani or rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 200,
      "protein_g": 4,
      "carbs_g": 12,
      "fat_g": 15,
      "fiber_g": 4
    },
    "id": "23660661-5e43-581a-a555-a586f783e343"
  },
  {
    "name": "Lemon Rice",
    "region": "South",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Cooked rice",
        "qty": "3 katori"
      },
      {
        "item": "Lemon juice",
        "qty": "2 tbsp"
      },
      {
        "item": "Peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Chana dal and urad dal",
        "qty": "1 tsp each"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Heat oil and fry peanuts, chana dal, urad dal and mustard seeds until golden.",
      "Add curry leaves, green chilli and turmeric.",
      "Add cooked rice and salt and toss gently on low heat.",
      "Switch off the flame and mix in the lemon juice.",
      "Serve with papad or pickle."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 320,
      "protein_g": 6,
      "carbs_g": 52,
      "fat_g": 9,
      "fiber_g": 2
    },
    "id": "2a5fbb6f-4823-5593-a51a-2113cfbd4f0e"
  },
  {
    "name": "Curd Rice",
    "region": "South",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 2,
    "ingredients": [
      {
        "item": "Cooked soft rice",
        "qty": "2 katori"
      },
      {
        "item": "Curd",
        "qty": "1 katori"
      },
      {
        "item": "Milk",
        "qty": "1/4 katori"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "6"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Ginger",
        "qty": "1/2 tsp grated"
      }
    ],
    "steps": [
      "Mash the warm rice well and mix in milk and salt.",
      "Let it cool and stir in the curd.",
      "Heat a spoon of oil, crackle mustard seeds and add chilli, ginger and curry leaves.",
      "Pour the tempering over the rice and mix.",
      "Serve chilled with pickle."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 260,
      "protein_g": 8,
      "carbs_g": 38,
      "fat_g": 8,
      "fiber_g": 1
    },
    "id": "a645d2d4-5249-5c7c-9e3a-f716815c3ab6"
  },
  {
    "name": "Puliyogare (Tamarind Rice)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Cooked rice",
        "qty": "3 katori"
      },
      {
        "item": "Tamarind pulp",
        "qty": "3 tbsp"
      },
      {
        "item": "Peanuts",
        "qty": "3 tbsp"
      },
      {
        "item": "Sesame seeds",
        "qty": "1 tbsp"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Dry red chilli",
        "qty": "4"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Dry roast sesame, chilli and coriander seeds and grind to a powder.",
      "Heat oil and fry mustard, peanuts, chana dal and curry leaves.",
      "Add tamarind pulp, turmeric, salt and jaggery and cook until thick.",
      "Mix in the ground powder and cook until oil separates.",
      "Toss with cooked rice and let it rest 15 minutes before serving."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 340,
      "protein_g": 6,
      "carbs_g": 56,
      "fat_g": 10,
      "fiber_g": 3
    },
    "id": "094ef674-38df-5bce-8b01-89466c811bf4"
  },
  {
    "name": "Bisi Bele Bath",
    "region": "South",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Rice",
        "qty": "1 katori"
      },
      {
        "item": "Toor dal",
        "qty": "1/2 katori"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1.5 katori"
      },
      {
        "item": "Bisi bele bath masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Tamarind pulp",
        "qty": "2 tbsp"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Pressure cook rice, dal and chopped vegetables together with 5 katori water until mushy.",
      "Add tamarind pulp, salt, jaggery and the masala and simmer for 10 minutes.",
      "Mix well to a porridge-like consistency, adding hot water if needed.",
      "Temper mustard, cashews, curry leaves and dry chilli in ghee.",
      "Pour the tempering on top and serve hot with boondi."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 340,
      "protein_g": 10,
      "carbs_g": 52,
      "fat_g": 10,
      "fiber_g": 6
    },
    "id": "487029ee-1bdc-5bbe-b095-7eb2cdea8f22"
  },
  {
    "name": "Kerala Fish Curry (Meen Curry)",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Fish pieces (seer or mackerel)",
        "qty": "500 g"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "2 tbsp"
      },
      {
        "item": "Kudampuli or tamarind",
        "qty": "3 pieces"
      },
      {
        "item": "Coconut oil",
        "qty": "2 tbsp"
      },
      {
        "item": "Shallots",
        "qty": "6 sliced"
      },
      {
        "item": "Ginger and garlic",
        "qty": "1 tbsp sliced"
      },
      {
        "item": "Curry leaves",
        "qty": "10"
      }
    ],
    "steps": [
      "Heat coconut oil and saute shallots, ginger, garlic and curry leaves.",
      "Add chilli powder, turmeric and coriander powder and fry for a minute on low heat.",
      "Pour in a katori of water with the kudampuli and salt and bring to a boil.",
      "Add the fish and simmer gently for 10 to 12 minutes.",
      "Rest for an hour if possible for the best flavour and serve with rice."
    ],
    "macros": {
      "per": "1 katori with 2 pieces",
      "calories": 220,
      "protein_g": 24,
      "carbs_g": 6,
      "fat_g": 11,
      "fiber_g": 1
    },
    "id": "344ebb9d-c072-5ffe-9383-6b4c54ee0e17"
  },
  {
    "name": "Appam (2 pieces)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Raw rice",
        "qty": "2 katori"
      },
      {
        "item": "Cooked rice",
        "qty": "1/4 katori"
      },
      {
        "item": "Grated coconut",
        "qty": "1/2 katori"
      },
      {
        "item": "Sugar",
        "qty": "1 tbsp"
      },
      {
        "item": "Yeast",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Soak rice for 4 hours and grind with coconut and cooked rice to a smooth batter.",
      "Add sugar, yeast and salt and ferment 6 to 8 hours.",
      "Heat an appam pan and pour a ladle of batter, swirling to coat the sides.",
      "Cover and cook for 2 minutes until the edges are crisp and the centre is fluffy.",
      "Serve with vegetable stew or egg curry."
    ],
    "macros": {
      "per": "2 appams",
      "calories": 200,
      "protein_g": 4,
      "carbs_g": 40,
      "fat_g": 3,
      "fiber_g": 1
    },
    "id": "95bbcb8d-081b-570a-bf77-771f7c84d524"
  },
  {
    "name": "Kerala Vegetable Stew",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Potato, carrot, beans",
        "qty": "2 katori chopped"
      },
      {
        "item": "Onion",
        "qty": "1 sliced"
      },
      {
        "item": "Thick coconut milk",
        "qty": "1 katori"
      },
      {
        "item": "Thin coconut milk",
        "qty": "1 katori"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Whole spices (cinnamon, clove, cardamom)",
        "qty": "1 tsp"
      },
      {
        "item": "Coconut oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Heat coconut oil, add whole spices, onion, ginger and chilli and saute without browning.",
      "Add vegetables and thin coconut milk with salt and simmer until tender.",
      "Pour in the thick coconut milk and warm gently without boiling.",
      "Finish with curry leaves and a few drops of coconut oil.",
      "Serve with appam or idiyappam."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 180,
      "protein_g": 4,
      "carbs_g": 18,
      "fat_g": 10,
      "fiber_g": 4
    },
    "id": "4764520b-4447-51b7-a1b3-e52515f9985e"
  },
  {
    "name": "Avial",
    "region": "South",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Mixed vegetables (raw banana, yam, drumstick, beans)",
        "qty": "3 katori"
      },
      {
        "item": "Grated coconut",
        "qty": "3/4 katori"
      },
      {
        "item": "Green chilli",
        "qty": "3"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Coconut oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Cook the vegetables with salt and turmeric in a little water until just tender.",
      "Grind coconut, chilli and cumin coarsely.",
      "Add the paste to the vegetables and cook for 3 minutes.",
      "Stir in whisked curd and switch off the flame.",
      "Drizzle raw coconut oil and curry leaves and serve with rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 160,
      "protein_g": 4,
      "carbs_g": 14,
      "fat_g": 10,
      "fiber_g": 5
    },
    "id": "ac5b8bf3-8e28-5116-831e-e6c082e723ee"
  },
  {
    "name": "Chettinad Chicken Curry",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 55,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chicken",
        "qty": "500 g"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "2"
      },
      {
        "item": "Coconut",
        "qty": "1/2 katori grated"
      },
      {
        "item": "Chettinad masala (pepper, fennel, star anise, cinnamon)",
        "qty": "2 tbsp"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Dry roast and grind the Chettinad spices with coconut into a fine paste.",
      "Saute onions, ginger-garlic paste and tomatoes in oil until soft.",
      "Add the chicken and the ground masala and cook for 10 minutes.",
      "Add a katori water and salt, cover and simmer until the chicken is tender.",
      "Finish with curry leaves and a crack of black pepper."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 360,
      "protein_g": 27,
      "carbs_g": 10,
      "fat_g": 24,
      "fiber_g": 3
    },
    "id": "dc4438cb-762f-5d95-9cf5-a946b9963c02"
  },
  {
    "name": "Puttu with Kadala Curry",
    "region": "South",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 3,
    "ingredients": [
      {
        "item": "Puttu flour",
        "qty": "1.5 katori"
      },
      {
        "item": "Grated coconut",
        "qty": "1/2 katori"
      },
      {
        "item": "Black chickpeas",
        "qty": "1 katori soaked"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Garam masala",
        "qty": "1 tsp"
      },
      {
        "item": "Coconut oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Sprinkle salted water over the puttu flour and rub to get a crumbly texture.",
      "Layer flour and coconut in a puttu maker and steam for 8 minutes.",
      "Pressure cook the chickpeas and simmer with sauteed onion, tomato, chilli powder and garam masala.",
      "Temper with mustard and curry leaves in coconut oil.",
      "Serve the puttu hot with the kadala curry."
    ],
    "macros": {
      "per": "1 puttu with 1/2 katori curry",
      "calories": 330,
      "protein_g": 11,
      "carbs_g": 56,
      "fat_g": 7,
      "fiber_g": 8
    },
    "id": "7c1d607d-cc07-5d57-b294-8de6e761c653"
  },
  {
    "name": "Kerala Parotta (1 piece)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 6,
    "ingredients": [
      {
        "item": "Maida",
        "qty": "3 katori"
      },
      {
        "item": "Oil",
        "qty": "4 tbsp"
      },
      {
        "item": "Sugar",
        "qty": "1 tsp"
      },
      {
        "item": "Milk",
        "qty": "1/2 katori"
      },
      {
        "item": "Salt",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Knead maida with milk, water, sugar, salt and oil into a soft dough and rest for 2 hours.",
      "Divide into balls, flatten and roll very thin, brushing with oil.",
      "Pleat the sheet, coil it into a spiral and rest for 15 minutes.",
      "Roll each spiral out gently and cook on a hot tawa with a little oil.",
      "Clap the parotta to separate the layers and serve with curry."
    ],
    "macros": {
      "per": "1 parotta",
      "calories": 300,
      "protein_g": 6,
      "carbs_g": 42,
      "fat_g": 12,
      "fiber_g": 1.5
    },
    "id": "3549282f-525e-5aa3-a0fd-da8567a6cad1"
  },
  {
    "name": "Kerala Egg Roast",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Boiled eggs",
        "qty": "6"
      },
      {
        "item": "Onion",
        "qty": "3 sliced"
      },
      {
        "item": "Tomato",
        "qty": "2"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "1.5 tsp"
      },
      {
        "item": "Garam masala",
        "qty": "1 tsp"
      },
      {
        "item": "Coconut oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Saute onions in coconut oil until deep brown with curry leaves and ginger-garlic.",
      "Add tomatoes, chilli powder, coriander powder, turmeric and salt and cook until the oil separates.",
      "Add a splash of water and the garam masala and simmer for 3 minutes.",
      "Slit the boiled eggs and toss them in the masala.",
      "Serve with parotta or appam."
    ],
    "macros": {
      "per": "2 eggs with masala",
      "calories": 270,
      "protein_g": 14,
      "carbs_g": 10,
      "fat_g": 20,
      "fiber_g": 2
    },
    "id": "f559ccf6-fc2f-5adf-9629-9c7c7c681fd0"
  },
  {
    "name": "Neer Dosa (2 pieces)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "ingredients": [
      {
        "item": "Raw rice",
        "qty": "1 katori"
      },
      {
        "item": "Grated coconut",
        "qty": "1/4 katori"
      },
      {
        "item": "Salt",
        "qty": "1 tsp"
      },
      {
        "item": "Water",
        "qty": "as needed"
      }
    ],
    "steps": [
      "Soak the rice for 3 hours and grind with coconut into a very smooth batter.",
      "Thin it with water to a watery consistency and add salt.",
      "Heat a tawa, pour the batter from the edge inwards and tilt to spread.",
      "Cover and cook for 1 minute without flipping.",
      "Fold into quarters and serve with coconut chutney or chicken curry."
    ],
    "macros": {
      "per": "2 dosas",
      "calories": 140,
      "protein_g": 3,
      "carbs_g": 28,
      "fat_g": 1.5,
      "fiber_g": 1
    },
    "id": "1a43c7a2-c819-56a2-91c0-2761a49099c4"
  },
  {
    "name": "Ragi Mudde with Saaru",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 2,
    "ingredients": [
      {
        "item": "Ragi flour",
        "qty": "1 katori"
      },
      {
        "item": "Water",
        "qty": "2 katori"
      },
      {
        "item": "Toor dal saaru",
        "qty": "1 katori"
      },
      {
        "item": "Salt",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Boil water with salt and drop in the ragi flour in the centre.",
      "Let it cook covered for 3 minutes without stirring.",
      "Stir vigorously with a wooden spoon into a smooth thick dough.",
      "Wet your hands and shape into balls.",
      "Serve with hot saaru or sambar and swallow without chewing."
    ],
    "macros": {
      "per": "1 ball with saaru",
      "calories": 210,
      "protein_g": 6,
      "carbs_g": 40,
      "fat_g": 2,
      "fiber_g": 6
    },
    "id": "9b847373-6457-58c2-a44c-32c8946cb08f"
  },
  {
    "name": "Beans Poriyal",
    "region": "South",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "French beans",
        "qty": "2 katori chopped"
      },
      {
        "item": "Grated coconut",
        "qty": "1/4 katori"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Urad dal",
        "qty": "1 tsp"
      },
      {
        "item": "Dry red chilli",
        "qty": "2"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Heat oil and crackle mustard, urad dal and dry red chilli.",
      "Add curry leaves and the chopped beans with salt.",
      "Sprinkle a little water, cover and cook on low for 8 minutes.",
      "Stir in the grated coconut and cook uncovered for 2 minutes.",
      "Serve as a side with rice and sambar."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 90,
      "protein_g": 3,
      "carbs_g": 9,
      "fat_g": 5,
      "fiber_g": 3
    },
    "id": "fb0e8ebc-c15a-51fb-afcd-4bcbaab267c0"
  },
  {
    "name": "Semiya Payasam",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 4,
    "ingredients": [
      {
        "item": "Vermicelli",
        "qty": "1 katori"
      },
      {
        "item": "Milk",
        "qty": "3 katori"
      },
      {
        "item": "Sugar",
        "qty": "1/2 katori"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      },
      {
        "item": "Cashews and raisins",
        "qty": "2 tbsp"
      },
      {
        "item": "Cardamom powder",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Fry cashews and raisins in ghee and set aside.",
      "Roast the vermicelli in the same ghee until light golden.",
      "Add boiling milk and cook until the vermicelli turns soft.",
      "Stir in sugar and cardamom and simmer for 5 minutes.",
      "Add the fried nuts and serve warm or chilled."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 260,
      "protein_g": 6,
      "carbs_g": 38,
      "fat_g": 9,
      "fiber_g": 1
    },
    "id": "2f313c9b-0a23-5017-a734-e0692f0031d3"
  },
  {
    "name": "Sundal (Chickpea)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "ingredients": [
      {
        "item": "Kala chana or white chickpeas",
        "qty": "1 katori soaked"
      },
      {
        "item": "Grated coconut",
        "qty": "2 tbsp"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Dry red chilli",
        "qty": "2"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Pressure cook the soaked chickpeas with salt until soft and drain.",
      "Heat oil and crackle mustard, red chilli and curry leaves.",
      "Add the chickpeas and toss on high heat for 2 minutes.",
      "Mix in the coconut and a squeeze of lemon.",
      "Serve warm as an evening snack."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 150,
      "protein_g": 7,
      "carbs_g": 22,
      "fat_g": 4,
      "fiber_g": 6
    },
    "id": "5edab44d-4f86-5ad3-ac36-b11ad516376e"
  },
  {
    "name": "Mysore Pak (1 piece)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 8,
    "ingredients": [
      {
        "item": "Besan",
        "qty": "1 katori"
      },
      {
        "item": "Ghee",
        "qty": "1.5 katori"
      },
      {
        "item": "Sugar",
        "qty": "1.5 katori"
      },
      {
        "item": "Water",
        "qty": "1/2 katori"
      }
    ],
    "steps": [
      "Roast besan in a spoon of ghee on low heat until fragrant.",
      "Boil sugar with water to a one-string consistency.",
      "Add the besan to the syrup and stir continuously.",
      "Add hot ghee in batches until the mixture froths and leaves the sides.",
      "Pour into a greased tray, cut into squares and cool."
    ],
    "macros": {
      "per": "1 piece",
      "calories": 180,
      "protein_g": 2,
      "carbs_g": 18,
      "fat_g": 11,
      "fiber_g": 1
    },
    "id": "31075dde-0246-5c5f-9db1-612fca66f99f"
  },
  {
    "name": "Aloo Paratha (1 piece)",
    "region": "North",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "2 katori"
      },
      {
        "item": "Boiled potatoes",
        "qty": "3 medium"
      },
      {
        "item": "Green chilli",
        "qty": "2 chopped"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      },
      {
        "item": "Ajwain",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee or oil",
        "qty": "4 tsp"
      }
    ],
    "steps": [
      "Knead atta with water and salt into a soft dough and rest for 15 minutes.",
      "Mash the potatoes with chilli, coriander, ajwain, salt and amchur powder.",
      "Stuff a ball of the filling into a dough ball, seal and roll gently into a paratha.",
      "Cook on a hot tawa, applying ghee on both sides until golden spots appear.",
      "Serve hot with curd, butter and pickle."
    ],
    "macros": {
      "per": "1 paratha",
      "calories": 300,
      "protein_g": 7,
      "carbs_g": 42,
      "fat_g": 11,
      "fiber_g": 4
    },
    "id": "c6a9ec86-c66b-5dd3-acca-7d1582ca6f6b"
  },
  {
    "name": "Paneer Paratha (1 piece)",
    "region": "North",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "2 katori"
      },
      {
        "item": "Paneer, grated",
        "qty": "150 g"
      },
      {
        "item": "Onion",
        "qty": "1 small chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      },
      {
        "item": "Ghee",
        "qty": "4 tsp"
      }
    ],
    "steps": [
      "Knead a soft atta dough with salt and water and rest it.",
      "Mix grated paneer with onion, chilli, coriander, salt and chaat masala.",
      "Stuff the filling inside a dough ball, seal and roll out evenly.",
      "Cook on a hot tawa with ghee until both sides are golden and crisp.",
      "Serve with curd or mint chutney."
    ],
    "macros": {
      "per": "1 paratha",
      "calories": 340,
      "protein_g": 13,
      "carbs_g": 36,
      "fat_g": 16,
      "fiber_g": 4
    },
    "id": "aad1cec1-ee29-5bfe-923e-0b8200ffc201"
  },
  {
    "name": "Phulka / Chapati (1 piece)",
    "region": "North",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 4,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "2 katori"
      },
      {
        "item": "Water",
        "qty": "3/4 katori"
      },
      {
        "item": "Salt",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Knead atta with water and salt into a soft dough and rest for 20 minutes.",
      "Divide into small balls and roll each into a thin round.",
      "Cook on a hot tawa for 20 seconds per side.",
      "Place directly on a medium flame so it puffs up.",
      "Serve hot, with or without ghee."
    ],
    "macros": {
      "per": "1 phulka",
      "calories": 100,
      "protein_g": 3,
      "carbs_g": 19,
      "fat_g": 1,
      "fiber_g": 3
    },
    "id": "86359bdd-da2b-5fbe-8bd1-2074e5359bf5"
  },
  {
    "name": "Dal Tadka",
    "region": "North",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Toor and moong dal mix",
        "qty": "1 katori"
      },
      {
        "item": "Onion",
        "qty": "1 chopped"
      },
      {
        "item": "Tomato",
        "qty": "2 chopped"
      },
      {
        "item": "Garlic",
        "qty": "5 cloves"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Dry red chilli",
        "qty": "2"
      },
      {
        "item": "Ghee",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Pressure cook dal with turmeric and salt until soft and whisk smooth.",
      "Saute onion, tomato and ginger in a little ghee until mushy.",
      "Add the mixture to the dal with water and simmer for 8 minutes.",
      "Heat ghee, fry cumin, garlic, dry red chilli and Kashmiri chilli powder.",
      "Pour the tadka over the dal and finish with coriander."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 150,
      "protein_g": 8,
      "carbs_g": 22,
      "fat_g": 4,
      "fiber_g": 5
    },
    "id": "398c1811-2340-5f4c-85e2-de8d1aa06c33"
  },
  {
    "name": "Dal Makhani",
    "region": "North",
    "type": "Veg",
    "time_minutes": 90,
    "serves": 4,
    "ingredients": [
      {
        "item": "Whole black urad",
        "qty": "3/4 katori"
      },
      {
        "item": "Rajma",
        "qty": "2 tbsp"
      },
      {
        "item": "Tomato puree",
        "qty": "1 katori"
      },
      {
        "item": "Butter",
        "qty": "2 tbsp"
      },
      {
        "item": "Cream",
        "qty": "3 tbsp"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Soak urad and rajma overnight and pressure cook until very soft.",
      "Fry ginger-garlic paste in butter, add tomato puree and chilli powder and cook until thick.",
      "Add the cooked dal with its liquid and mash a few beans against the pot.",
      "Simmer on low heat for 30 to 40 minutes, stirring often.",
      "Finish with cream, butter and kasuri methi before serving."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 230,
      "protein_g": 9,
      "carbs_g": 24,
      "fat_g": 11,
      "fiber_g": 7
    },
    "id": "991011f4-622e-56ff-afa9-43831d7ffb27"
  },
  {
    "name": "Rajma Masala",
    "region": "North",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 4,
    "ingredients": [
      {
        "item": "Rajma",
        "qty": "1 katori soaked overnight"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "3"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Rajma masala or garam masala",
        "qty": "2 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Pressure cook the soaked rajma with salt until completely soft.",
      "Fry onions until golden and add ginger-garlic paste and pureed tomatoes.",
      "Add chilli, coriander and garam masala and cook until oil separates.",
      "Add the rajma with its water and simmer for 15 minutes, mashing a few beans.",
      "Garnish with coriander and serve with rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 220,
      "protein_g": 10,
      "carbs_g": 32,
      "fat_g": 6,
      "fiber_g": 9
    },
    "id": "d77b1e6b-2276-5fe3-b7fe-00cebf103203"
  },
  {
    "name": "Chole (Chana Masala)",
    "region": "North",
    "type": "Veg",
    "time_minutes": 55,
    "serves": 4,
    "ingredients": [
      {
        "item": "Kabuli chana",
        "qty": "1 katori soaked overnight"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "3"
      },
      {
        "item": "Chole masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Tea bag",
        "qty": "1"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Pressure cook chana with salt and a tea bag for a dark colour until soft.",
      "Fry onion until deep golden, add ginger-garlic paste and tomatoes.",
      "Add chole masala, chilli and amchur and cook until the oil leaves the sides.",
      "Add the chana with some cooking water and simmer for 15 minutes.",
      "Garnish with ginger and coriander and serve with bhature or rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 240,
      "protein_g": 10,
      "carbs_g": 34,
      "fat_g": 8,
      "fiber_g": 9
    },
    "id": "7cdac0f7-2f8e-5856-bf11-35ab1f371529"
  },
  {
    "name": "Chole Bhature (1 bhatura with chole)",
    "region": "North",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 4,
    "ingredients": [
      {
        "item": "Maida",
        "qty": "2 katori"
      },
      {
        "item": "Curd",
        "qty": "1/4 katori"
      },
      {
        "item": "Chole",
        "qty": "2 katori cooked"
      },
      {
        "item": "Baking soda",
        "qty": "1/4 tsp"
      },
      {
        "item": "Oil for frying",
        "qty": "1.5 katori"
      }
    ],
    "steps": [
      "Knead maida with curd, baking soda, salt, sugar and water into a soft dough and rest for 2 hours.",
      "Prepare the chole as a thick gravy with chole masala.",
      "Roll the dough into thick ovals.",
      "Deep fry in hot oil, pressing gently so each bhatura puffs up.",
      "Serve hot with chole, onion rings and pickle."
    ],
    "macros": {
      "per": "1 bhatura with 1/2 katori chole",
      "calories": 480,
      "protein_g": 13,
      "carbs_g": 60,
      "fat_g": 21,
      "fiber_g": 8
    },
    "id": "d35f2cad-a30d-5c50-a752-6d4ad71a4204"
  },
  {
    "name": "Paneer Butter Masala",
    "region": "North",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Paneer",
        "qty": "250 g"
      },
      {
        "item": "Tomato puree",
        "qty": "1.5 katori"
      },
      {
        "item": "Cashew paste",
        "qty": "2 tbsp"
      },
      {
        "item": "Butter",
        "qty": "2 tbsp"
      },
      {
        "item": "Cream",
        "qty": "3 tbsp"
      },
      {
        "item": "Kasuri methi",
        "qty": "1 tsp"
      },
      {
        "item": "Sugar",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Heat butter, add ginger-garlic paste, tomato puree, chilli powder and salt and cook until thick.",
      "Add cashew paste and a little water and simmer for 8 minutes.",
      "Blend the gravy smooth and return it to the pan.",
      "Add paneer cubes, sugar, kasuri methi and garam masala and simmer 5 minutes.",
      "Finish with cream and serve with naan or roti."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 330,
      "protein_g": 13,
      "carbs_g": 14,
      "fat_g": 25,
      "fiber_g": 2
    },
    "id": "1c536a6e-a51a-5bab-9be5-1b96881e39a1"
  },
  {
    "name": "Palak Paneer",
    "region": "North",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Spinach",
        "qty": "4 katori packed"
      },
      {
        "item": "Paneer",
        "qty": "200 g"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Cream",
        "qty": "2 tbsp"
      },
      {
        "item": "Oil or ghee",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Blanch spinach in boiling water for 2 minutes and blend with green chilli to a smooth puree.",
      "Fry cumin, onion, ginger-garlic paste and tomato until soft.",
      "Add the spinach puree, salt and garam masala and cook for 6 minutes.",
      "Add paneer cubes and simmer for 3 minutes.",
      "Stir in cream and serve with roti."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 250,
      "protein_g": 13,
      "carbs_g": 10,
      "fat_g": 18,
      "fiber_g": 4
    },
    "id": "e43eecf4-a0d4-5cb8-84f9-277c8b3be539"
  },
  {
    "name": "Matar Paneer",
    "region": "North",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Paneer",
        "qty": "200 g"
      },
      {
        "item": "Green peas",
        "qty": "1 katori"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "3"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Fry onion paste in oil until golden and add ginger-garlic paste.",
      "Add tomato puree, turmeric, chilli and coriander powder and cook until oil separates.",
      "Add the peas with a katori of water and cook 8 minutes.",
      "Add paneer cubes and garam masala and simmer for 4 minutes.",
      "Garnish with coriander and serve with chapati."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 260,
      "protein_g": 12,
      "carbs_g": 16,
      "fat_g": 16,
      "fiber_g": 5
    },
    "id": "9515521b-a0a9-50b8-9c37-95fcbf7b1113"
  },
  {
    "name": "Kadai Paneer",
    "region": "North",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Paneer",
        "qty": "250 g"
      },
      {
        "item": "Capsicum",
        "qty": "1 large"
      },
      {
        "item": "Onion",
        "qty": "1 large"
      },
      {
        "item": "Tomato",
        "qty": "3"
      },
      {
        "item": "Kadai masala (coriander, red chilli)",
        "qty": "2 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Dry roast and crush coriander seeds and dry red chillies for kadai masala.",
      "Saute onion, ginger-garlic and tomato puree in oil until thick.",
      "Add the crushed masala, salt and capsicum cubes and cook 4 minutes.",
      "Add paneer and a splash of water and simmer for 3 minutes.",
      "Finish with kasuri methi and coriander."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 280,
      "protein_g": 14,
      "carbs_g": 12,
      "fat_g": 20,
      "fiber_g": 3
    },
    "id": "9bccd0d6-c264-5d9a-9ec1-c3ba04a55815"
  },
  {
    "name": "Paneer Bhurji",
    "region": "North",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 2,
    "ingredients": [
      {
        "item": "Paneer, crumbled",
        "qty": "200 g"
      },
      {
        "item": "Onion",
        "qty": "1 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1 chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Turmeric",
        "qty": "1/4 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Heat oil and saute cumin, onion and green chilli until golden.",
      "Add tomato, turmeric, chilli powder and salt and cook until soft.",
      "Add the crumbled paneer and mix well.",
      "Cook for 3 minutes on medium heat.",
      "Finish with kasuri methi and coriander and serve with roti or toast."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 270,
      "protein_g": 15,
      "carbs_g": 8,
      "fat_g": 20,
      "fiber_g": 2
    },
    "id": "5e7fd683-a063-5c42-bd8a-ccfe0ed990f9"
  },
  {
    "name": "Aloo Gobi",
    "region": "North",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Cauliflower florets",
        "qty": "3 katori"
      },
      {
        "item": "Potatoes",
        "qty": "2 medium cubed"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Heat oil and crackle cumin, then saute onion and ginger until golden.",
      "Add tomato, turmeric, chilli and coriander powder and cook until soft.",
      "Add potatoes and cauliflower with salt and mix well.",
      "Cover and cook on low heat for 15 minutes until tender, stirring occasionally.",
      "Finish with garam masala and coriander."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 140,
      "protein_g": 3,
      "carbs_g": 18,
      "fat_g": 6,
      "fiber_g": 4
    },
    "id": "5ac4fcf8-a70b-56f6-800e-6655daaf01f9"
  },
  {
    "name": "Jeera Aloo",
    "region": "North",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Boiled potatoes",
        "qty": "4 medium"
      },
      {
        "item": "Cumin",
        "qty": "1.5 tsp"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Amchur",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil or ghee",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Cube the boiled potatoes.",
      "Heat ghee and crackle cumin seeds with green chilli.",
      "Add turmeric, red chilli powder and salt.",
      "Toss the potatoes and saute on medium heat until lightly crisp.",
      "Finish with amchur and coriander and serve."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 130,
      "protein_g": 2,
      "carbs_g": 20,
      "fat_g": 5,
      "fiber_g": 2.5
    },
    "id": "1480ef2a-2dcb-539d-bd1f-18fc28293947"
  },
  {
    "name": "Bhindi Masala",
    "region": "North",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "ingredients": [
      {
        "item": "Bhindi (okra)",
        "qty": "300 g"
      },
      {
        "item": "Onion",
        "qty": "2 sliced"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Amchur",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Wash and dry the bhindi completely and cut into pieces.",
      "Fry the bhindi in oil on medium heat until the stickiness is gone and set aside.",
      "Saute onion and tomato with turmeric, chilli and coriander powder.",
      "Return the bhindi and toss gently with salt.",
      "Finish with amchur and serve with roti."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 110,
      "protein_g": 3,
      "carbs_g": 11,
      "fat_g": 6,
      "fiber_g": 5
    },
    "id": "4099e25d-1dd0-5e0e-9eac-1e1bcb6b34be"
  },
  {
    "name": "Baingan Bharta",
    "region": "North",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 3,
    "ingredients": [
      {
        "item": "Large brinjal",
        "qty": "1 big"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "2"
      },
      {
        "item": "Garlic",
        "qty": "5 cloves"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Roast the whole brinjal directly on a flame until the skin chars and the inside is soft.",
      "Peel and mash the pulp.",
      "Saute garlic, green chilli and onion in oil until golden.",
      "Add tomato, turmeric and chilli powder and cook until soft.",
      "Add the brinjal pulp and salt, cook for 5 minutes and serve with roti."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 110,
      "protein_g": 3,
      "carbs_g": 13,
      "fat_g": 6,
      "fiber_g": 6
    },
    "id": "2788f618-b767-576f-8d8b-52a5de53b80c"
  },
  {
    "name": "Butter Chicken",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 60,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chicken",
        "qty": "500 g"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Tomato puree",
        "qty": "1.5 katori"
      },
      {
        "item": "Butter",
        "qty": "3 tbsp"
      },
      {
        "item": "Cream",
        "qty": "1/4 katori"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "2 tsp"
      },
      {
        "item": "Kasuri methi",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Marinate chicken in curd, ginger-garlic paste, chilli powder and salt for 1 hour and grill or pan-sear it.",
      "Cook tomato puree with butter, whole spices and cashew paste until thick.",
      "Blend the gravy until smooth and return it to the pan.",
      "Add the chicken, garam masala and kasuri methi and simmer for 10 minutes.",
      "Finish with cream and butter and serve with naan."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 380,
      "protein_g": 27,
      "carbs_g": 10,
      "fat_g": 26,
      "fiber_g": 2
    },
    "id": "9eee7728-498d-5362-b25c-b68238ce6551"
  },
  {
    "name": "Chicken Tikka",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 40,
    "serves": 3,
    "ingredients": [
      {
        "item": "Boneless chicken",
        "qty": "400 g"
      },
      {
        "item": "Hung curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "2 tsp"
      },
      {
        "item": "Lemon juice",
        "qty": "1 tbsp"
      },
      {
        "item": "Mustard oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Mix curd, ginger-garlic paste, chilli, garam masala, lemon juice, oil and salt.",
      "Coat the chicken pieces and marinate for at least 2 hours.",
      "Thread onto skewers.",
      "Grill or bake at high heat for 15 to 18 minutes, turning once.",
      "Serve hot with onion rings and mint chutney."
    ],
    "macros": {
      "per": "6 pieces",
      "calories": 220,
      "protein_g": 28,
      "carbs_g": 4,
      "fat_g": 9,
      "fiber_g": 1
    },
    "id": "a6c56d52-3d1f-5176-86e6-05202e3c4ba0"
  },
  {
    "name": "Tandoori Chicken (1 leg piece)",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chicken leg pieces",
        "qty": "4"
      },
      {
        "item": "Hung curd",
        "qty": "3/4 katori"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "2 tbsp"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "2 tbsp"
      },
      {
        "item": "Lemon juice",
        "qty": "2 tbsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Slash the chicken and rub with lemon juice and salt for 15 minutes.",
      "Mix curd with spices and oil and coat the chicken well.",
      "Marinate in the fridge for at least 4 hours.",
      "Roast in a hot oven or tandoor at 220 degrees for 25 minutes, basting with butter.",
      "Serve with onion rings, chutney and lemon wedges."
    ],
    "macros": {
      "per": "1 leg piece",
      "calories": 260,
      "protein_g": 30,
      "carbs_g": 4,
      "fat_g": 14,
      "fiber_g": 0.5
    },
    "id": "3de7b69c-aa1f-5bc5-9428-e4a4d24f59ed"
  },
  {
    "name": "Rogan Josh (Kashmiri)",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 75,
    "serves": 4,
    "ingredients": [
      {
        "item": "Mutton",
        "qty": "500 g"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "2 tbsp"
      },
      {
        "item": "Fennel powder",
        "qty": "1 tbsp"
      },
      {
        "item": "Dry ginger powder",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Heat mustard oil and fry whole spices and asafoetida.",
      "Add the mutton and brown it well on high heat.",
      "Add whisked curd, Kashmiri chilli powder, fennel and dry ginger powder and mix.",
      "Add water, cover and cook on low for 45 minutes until the meat is tender.",
      "Finish with garam masala and serve with rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 340,
      "protein_g": 28,
      "carbs_g": 8,
      "fat_g": 22,
      "fiber_g": 2
    },
    "id": "7b15d794-c3ea-5481-a3d5-8b89177c1e85"
  },
  {
    "name": "Keema Matar",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Mutton keema",
        "qty": "400 g"
      },
      {
        "item": "Green peas",
        "qty": "1 katori"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "2"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Fry onions in oil until golden and add ginger-garlic paste.",
      "Add keema and cook on high heat until the water dries and it browns.",
      "Add tomatoes, chilli, coriander powder, turmeric and salt and cook until soft.",
      "Add peas and a katori of water and cook covered for 15 minutes.",
      "Finish with garam masala and coriander."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 340,
      "protein_g": 24,
      "carbs_g": 12,
      "fat_g": 22,
      "fiber_g": 4
    },
    "id": "6141428f-aa04-50e3-acd3-e245ed159ccb"
  },
  {
    "name": "Punjabi Kadhi Pakora",
    "region": "North",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Sour curd",
        "qty": "2 katori"
      },
      {
        "item": "Besan",
        "qty": "1/2 katori"
      },
      {
        "item": "Onion for pakora",
        "qty": "1 sliced"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Methi seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 katori for frying"
      }
    ],
    "steps": [
      "Whisk curd, besan, turmeric and salt with 3 katori water until smooth.",
      "Cook on medium heat, stirring continuously, until it thickens and simmers for 25 minutes.",
      "Mix besan, onion, chilli and salt and fry small pakoras until golden.",
      "Add the pakoras to the kadhi.",
      "Temper with cumin, methi seeds and dry red chilli and pour over before serving."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 220,
      "protein_g": 8,
      "carbs_g": 18,
      "fat_g": 13,
      "fiber_g": 3
    },
    "id": "f9be0662-244f-5ad9-b233-99d3d634c257"
  },
  {
    "name": "Jeera Rice",
    "region": "North",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "ingredients": [
      {
        "item": "Basmati rice",
        "qty": "1 katori"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tbsp"
      },
      {
        "item": "Bay leaf",
        "qty": "1"
      },
      {
        "item": "Water",
        "qty": "2 katori"
      }
    ],
    "steps": [
      "Wash and soak the rice for 20 minutes.",
      "Heat ghee and splutter cumin seeds and a bay leaf.",
      "Add the drained rice, salt and water.",
      "Cook covered on low heat until the water is absorbed.",
      "Rest for 5 minutes and fluff with a fork."
    ],
    "macros": {
      "per": "1 katori cooked",
      "calories": 230,
      "protein_g": 4,
      "carbs_g": 42,
      "fat_g": 5,
      "fiber_g": 1
    },
    "id": "1b888687-9fdb-577e-b424-7d73f1fa4a01"
  },
  {
    "name": "Vegetable Pulao",
    "region": "North",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 3,
    "ingredients": [
      {
        "item": "Basmati rice",
        "qty": "1.5 katori"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion",
        "qty": "1 sliced"
      },
      {
        "item": "Whole spices (bay leaf, cloves, cinnamon)",
        "qty": "1 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Soak the rice and heat ghee with whole spices.",
      "Fry onions until golden and add the vegetables.",
      "Add the drained rice, salt and 3 katori water.",
      "Cover and cook on low until the rice is done and each grain is separate.",
      "Rest for 5 minutes and serve with raita."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 290,
      "protein_g": 6,
      "carbs_g": 48,
      "fat_g": 8,
      "fiber_g": 4
    },
    "id": "0b60ba0c-3faa-55dc-b22f-3b56746a0a7c"
  },
  {
    "name": "Moong Dal Khichdi",
    "region": "North",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Rice",
        "qty": "1/2 katori"
      },
      {
        "item": "Yellow moong dal",
        "qty": "1/2 katori"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Ginger",
        "qty": "1 tsp grated"
      },
      {
        "item": "Ghee",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Wash rice and moong dal together.",
      "Heat ghee and splutter cumin, ginger and hing.",
      "Add the rice and dal, turmeric, salt and 4 katori water.",
      "Pressure cook for 3 whistles until soft and mushy.",
      "Serve hot with a spoon of ghee, curd and papad."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 280,
      "protein_g": 11,
      "carbs_g": 46,
      "fat_g": 6,
      "fiber_g": 5
    },
    "id": "f40f8dfd-e1ed-5f95-891b-939a3ec73e7e"
  },
  {
    "name": "Sarson Ka Saag with Makki Roti",
    "region": "North",
    "type": "Veg",
    "time_minutes": 75,
    "serves": 4,
    "ingredients": [
      {
        "item": "Sarson leaves",
        "qty": "3 bunches"
      },
      {
        "item": "Spinach and bathua",
        "qty": "1 bunch"
      },
      {
        "item": "Makki atta",
        "qty": "2 katori"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Cook the chopped greens with ginger, chilli and salt until soft and mash coarsely.",
      "Add a tablespoon of makki atta and simmer until thick.",
      "Fry onion, garlic and ginger in ghee and mix into the saag.",
      "Knead makki atta with warm water and pat into rotis on a tawa.",
      "Serve hot with white butter, jaggery and onion."
    ],
    "macros": {
      "per": "1 roti with 1 katori saag",
      "calories": 380,
      "protein_g": 9,
      "carbs_g": 48,
      "fat_g": 16,
      "fiber_g": 9
    },
    "id": "b1dbb9ae-ed74-5236-9e8b-ab74bd5ffaea"
  },
  {
    "name": "Sweet Lassi",
    "region": "North",
    "type": "Veg",
    "time_minutes": 5,
    "serves": 2,
    "ingredients": [
      {
        "item": "Fresh curd",
        "qty": "1.5 katori"
      },
      {
        "item": "Cold water or milk",
        "qty": "1/2 katori"
      },
      {
        "item": "Sugar",
        "qty": "2 tbsp"
      },
      {
        "item": "Cardamom powder",
        "qty": "a pinch"
      }
    ],
    "steps": [
      "Add curd, sugar and cardamom to a blender.",
      "Pour in cold water or milk.",
      "Blend until frothy.",
      "Pour into tall glasses.",
      "Top with malai and a few pistachios."
    ],
    "macros": {
      "per": "1 glass",
      "calories": 200,
      "protein_g": 7,
      "carbs_g": 29,
      "fat_g": 6,
      "fiber_g": 0
    },
    "id": "09e739e3-258d-5824-93ad-b9cc55d02b99"
  },
  {
    "name": "Gajar Ka Halwa",
    "region": "North",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 5,
    "ingredients": [
      {
        "item": "Grated carrot",
        "qty": "4 katori"
      },
      {
        "item": "Milk",
        "qty": "2 katori"
      },
      {
        "item": "Sugar",
        "qty": "1/2 katori"
      },
      {
        "item": "Ghee",
        "qty": "3 tbsp"
      },
      {
        "item": "Khoya (optional)",
        "qty": "50 g"
      },
      {
        "item": "Cashews and raisins",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Cook the grated carrots in milk on medium heat until the milk reduces.",
      "Add ghee and fry until the carrots turn glossy.",
      "Stir in sugar and cook until the moisture evaporates.",
      "Mix in khoya and cardamom powder.",
      "Garnish with fried cashews and raisins and serve warm."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 280,
      "protein_g": 5,
      "carbs_g": 36,
      "fat_g": 13,
      "fiber_g": 4
    },
    "id": "9a8dd035-7f36-58e4-81e0-706d5380b721"
  },
  {
    "name": "Rice Kheer",
    "region": "North",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 5,
    "ingredients": [
      {
        "item": "Full-fat milk",
        "qty": "5 katori"
      },
      {
        "item": "Basmati rice",
        "qty": "1/4 katori"
      },
      {
        "item": "Sugar",
        "qty": "1/3 katori"
      },
      {
        "item": "Cardamom powder",
        "qty": "1/2 tsp"
      },
      {
        "item": "Almonds and raisins",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Wash the rice and boil it in the milk on low heat, stirring often.",
      "Cook for 35 minutes until the rice is soft and the milk is thick.",
      "Add sugar and cardamom powder.",
      "Simmer for 5 more minutes.",
      "Garnish with almonds and raisins and serve warm or chilled."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 260,
      "protein_g": 7,
      "carbs_g": 37,
      "fat_g": 9,
      "fiber_g": 1
    },
    "id": "0e2d9f0b-a9fc-50c1-95c2-33dbe335e96a"
  },
  {
    "name": "Egg Bhurji (2 eggs)",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 15,
    "serves": 2,
    "ingredients": [
      {
        "item": "Eggs",
        "qty": "4"
      },
      {
        "item": "Onion",
        "qty": "1 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1 chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Turmeric",
        "qty": "1/4 tsp"
      },
      {
        "item": "Oil",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Heat oil and saute onion, green chilli and ginger until soft.",
      "Add tomato, turmeric, chilli powder and salt and cook for 2 minutes.",
      "Crack the eggs in and stir continuously.",
      "Cook until the eggs are scrambled and just set.",
      "Garnish with coriander and serve with pav or roti."
    ],
    "macros": {
      "per": "2 eggs",
      "calories": 220,
      "protein_g": 14,
      "carbs_g": 5,
      "fat_g": 16,
      "fiber_g": 1
    },
    "id": "7f362ab5-35c4-56d8-8bce-6db047b73cfd"
  },
  {
    "name": "Egg Curry (2 eggs)",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 3,
    "ingredients": [
      {
        "item": "Boiled eggs",
        "qty": "6"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "3"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Coriander powder",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Fry onions in oil until golden and add ginger-garlic paste.",
      "Add tomato puree, chilli, turmeric and coriander powder and cook until the oil separates.",
      "Add a katori of water and salt and simmer for 8 minutes.",
      "Add the halved boiled eggs and garam masala.",
      "Simmer for 3 minutes and serve with rice or roti."
    ],
    "macros": {
      "per": "2 eggs with gravy",
      "calories": 280,
      "protein_g": 15,
      "carbs_g": 12,
      "fat_g": 20,
      "fiber_g": 3
    },
    "id": "6373088e-fac7-5e1a-881d-5de4d9f43472"
  },
  {
    "name": "Kashmiri Dum Aloo",
    "region": "North",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "ingredients": [
      {
        "item": "Baby potatoes",
        "qty": "500 g"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "2 tsp"
      },
      {
        "item": "Fennel powder",
        "qty": "1 tbsp"
      },
      {
        "item": "Dry ginger powder",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Boil the baby potatoes, prick them all over and fry in mustard oil until golden.",
      "Whisk curd with Kashmiri chilli, fennel and dry ginger powder.",
      "Heat oil with whole spices and pour in the curd mixture on low heat, stirring.",
      "Add the potatoes and a katori of water and simmer covered for 15 minutes.",
      "Finish with garam masala and serve with rice or naan."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 230,
      "protein_g": 5,
      "carbs_g": 30,
      "fat_g": 10,
      "fiber_g": 4
    },
    "id": "0c66181a-1f47-50a1-b956-187480c6799f"
  },
  {
    "name": "Lauki Sabzi",
    "region": "North",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "ingredients": [
      {
        "item": "Lauki (bottle gourd)",
        "qty": "3 katori cubed"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Heat oil and crackle cumin seeds.",
      "Add onion, ginger and tomato and saute until soft.",
      "Add lauki, turmeric, coriander powder and salt.",
      "Cover and cook on low heat for 12 minutes without adding water.",
      "Finish with garam masala and coriander."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 70,
      "protein_g": 1.5,
      "carbs_g": 8,
      "fat_g": 4,
      "fiber_g": 3
    },
    "id": "91cc8cfc-8c95-554e-84bf-8f23a679c4d0"
  },
  {
    "name": "Mixed Vegetable Curry",
    "region": "North",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Mixed vegetables (carrot, beans, peas, cauliflower)",
        "qty": "3 katori"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "2"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Coriander powder",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Fry onions in oil until golden and add ginger-garlic paste.",
      "Add tomato puree and the spice powders and cook until thick.",
      "Add the chopped vegetables with salt and half a katori water.",
      "Cover and cook until the vegetables are tender.",
      "Finish with garam masala and coriander."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 130,
      "protein_g": 4,
      "carbs_g": 18,
      "fat_g": 6,
      "fiber_g": 5
    },
    "id": "40322345-b9bc-537b-a30b-4622206bac3f"
  },
  {
    "name": "Dahi Bhalla",
    "region": "North",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Urad dal",
        "qty": "1 katori"
      },
      {
        "item": "Curd",
        "qty": "2 katori"
      },
      {
        "item": "Sugar",
        "qty": "1 tbsp"
      },
      {
        "item": "Tamarind chutney",
        "qty": "3 tbsp"
      },
      {
        "item": "Roasted cumin powder",
        "qty": "1 tsp"
      },
      {
        "item": "Oil for frying",
        "qty": "1 katori"
      }
    ],
    "steps": [
      "Soak the urad dal for 4 hours and grind to a fluffy batter.",
      "Drop spoonfuls into hot oil and fry until golden.",
      "Soak the vadas in warm salted water for 10 minutes and squeeze gently.",
      "Whisk the curd with sugar and salt and pour over the vadas.",
      "Top with tamarind chutney, cumin powder and red chilli powder."
    ],
    "macros": {
      "per": "2 bhallas",
      "calories": 260,
      "protein_g": 10,
      "carbs_g": 28,
      "fat_g": 12,
      "fiber_g": 3
    },
    "id": "419c3105-2efe-5e30-90b9-9fb3ca29ef62"
  },
  {
    "name": "Machher Jhol (Bengali Fish Curry)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Rohu or katla fish pieces",
        "qty": "500 g"
      },
      {
        "item": "Potato",
        "qty": "2 medium wedges"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Nigella seeds (kalonji)",
        "qty": "1/2 tsp"
      },
      {
        "item": "Turmeric",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "4 tbsp"
      }
    ],
    "steps": [
      "Marinate the fish with turmeric and salt and fry lightly in mustard oil, then set aside.",
      "In the same oil, splutter kalonji and add the potato wedges and fry until golden.",
      "Add ginger paste, tomato, cumin powder, chilli powder and turmeric and cook for 3 minutes.",
      "Add 3 katori hot water and simmer until the potatoes are tender.",
      "Gently slide in the fish and green chillies and cook for 5 minutes."
    ],
    "macros": {
      "per": "1 katori with 2 pieces",
      "calories": 250,
      "protein_g": 24,
      "carbs_g": 9,
      "fat_g": 13,
      "fiber_g": 2
    },
    "id": "f17de075-8b79-536c-a3d0-c67765732fbe"
  },
  {
    "name": "Shorshe Ilish (Hilsa in Mustard)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Hilsa pieces",
        "qty": "500 g"
      },
      {
        "item": "Yellow and black mustard seeds",
        "qty": "3 tbsp"
      },
      {
        "item": "Green chilli",
        "qty": "4"
      },
      {
        "item": "Turmeric",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "4 tbsp"
      }
    ],
    "steps": [
      "Grind mustard seeds with green chilli, salt and a little water into a smooth paste.",
      "Marinate the hilsa with turmeric and salt.",
      "Heat mustard oil, add nigella seeds and the mustard paste and a katori of water.",
      "Gently place the fish pieces in and cook covered for 8 to 10 minutes.",
      "Drizzle raw mustard oil on top and serve with steamed rice."
    ],
    "macros": {
      "per": "1 katori with 2 pieces",
      "calories": 380,
      "protein_g": 26,
      "carbs_g": 4,
      "fat_g": 29,
      "fiber_g": 1
    },
    "id": "7ec657db-ea28-5bea-b52d-27c5b04a6f3e"
  },
  {
    "name": "Chingri Malai Curry (Prawn in Coconut)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Large prawns",
        "qty": "400 g"
      },
      {
        "item": "Thick coconut milk",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion paste",
        "qty": "3 tbsp"
      },
      {
        "item": "Ginger paste",
        "qty": "1 tsp"
      },
      {
        "item": "Sugar",
        "qty": "1/2 tsp"
      },
      {
        "item": "Mustard oil or ghee",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Marinate the prawns with turmeric and salt and fry lightly in oil.",
      "Fry whole spices, onion paste and ginger paste until the raw smell goes.",
      "Add turmeric, chilli powder and a little water and cook for 3 minutes.",
      "Add coconut milk, sugar and salt and simmer on low flame.",
      "Add prawns and cook for 4 minutes, then finish with ghee and garam masala."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 290,
      "protein_g": 22,
      "carbs_g": 8,
      "fat_g": 19,
      "fiber_g": 2
    },
    "id": "ef00fb88-460e-512f-9d5a-22c395efb9a1"
  },
  {
    "name": "Kosha Mangsho (Bengali Mutton)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 90,
    "serves": 5,
    "ingredients": [
      {
        "item": "Mutton",
        "qty": "600 g"
      },
      {
        "item": "Onion",
        "qty": "3 sliced"
      },
      {
        "item": "Potato",
        "qty": "2"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "2 tbsp"
      },
      {
        "item": "Mustard oil",
        "qty": "4 tbsp"
      }
    ],
    "steps": [
      "Marinate the mutton with curd, ginger-garlic paste, turmeric, chilli and salt for 1 hour.",
      "Fry sliced onions in mustard oil until deep brown with a pinch of sugar.",
      "Add the mutton and bhuno on medium heat for 20 minutes.",
      "Add potatoes and a katori of water, cover and cook until the mutton is tender.",
      "Finish with garam masala and ghee and serve with luchi or rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 360,
      "protein_g": 28,
      "carbs_g": 12,
      "fat_g": 23,
      "fiber_g": 2
    },
    "id": "96561d42-ec7f-5c47-91cc-240ec155984f"
  },
  {
    "name": "Aloo Posto",
    "region": "East",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "ingredients": [
      {
        "item": "Potatoes",
        "qty": "3 medium cubed"
      },
      {
        "item": "Poppy seeds (posto)",
        "qty": "3 tbsp"
      },
      {
        "item": "Green chilli",
        "qty": "3"
      },
      {
        "item": "Nigella seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Soak the poppy seeds for 30 minutes and grind with green chilli and salt to a smooth paste.",
      "Heat mustard oil and splutter nigella seeds.",
      "Add the potatoes and fry until lightly golden.",
      "Add the posto paste and half a katori of water and cover.",
      "Cook on low flame until the potatoes are tender and the gravy is dry, then drizzle raw mustard oil."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 210,
      "protein_g": 4,
      "carbs_g": 25,
      "fat_g": 11,
      "fiber_g": 3
    },
    "id": "e803e83e-0cd0-5032-91c4-0f807d567319"
  },
  {
    "name": "Shukto",
    "region": "East",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "ingredients": [
      {
        "item": "Mixed vegetables (raw banana, bitter gourd, drumstick, brinjal, potato)",
        "qty": "3 katori"
      },
      {
        "item": "Milk",
        "qty": "1/2 katori"
      },
      {
        "item": "Mustard paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Panch phoron",
        "qty": "1 tsp"
      },
      {
        "item": "Ginger paste",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil or ghee",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Fry the bitter gourd first in oil, set aside, and then lightly fry the other vegetables.",
      "Splutter panch phoron in oil and add ginger paste.",
      "Add the vegetables, salt and enough water, and cook until just tender.",
      "Add milk, a pinch of sugar and the mustard paste and simmer for 5 minutes.",
      "Finish with a spoon of ghee and serve at the start of the meal."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 140,
      "protein_g": 3,
      "carbs_g": 15,
      "fat_g": 8,
      "fiber_g": 5
    },
    "id": "d86957f6-7875-5251-8ae0-3bda966e83bd"
  },
  {
    "name": "Begun Bhaja",
    "region": "East",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 3,
    "ingredients": [
      {
        "item": "Brinjal",
        "qty": "1 large sliced into rounds"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Red chilli powder",
        "qty": "1/2 tsp"
      },
      {
        "item": "Rice flour",
        "qty": "1 tbsp"
      },
      {
        "item": "Mustard oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Slice the brinjal into thick rounds and rub with salt and turmeric.",
      "Let it rest for 10 minutes and pat dry.",
      "Dust lightly with rice flour and chilli powder.",
      "Shallow fry in mustard oil until golden on both sides.",
      "Serve hot with dal and rice."
    ],
    "macros": {
      "per": "3 slices",
      "calories": 110,
      "protein_g": 1.5,
      "carbs_g": 8,
      "fat_g": 8,
      "fiber_g": 3
    },
    "id": "bfac3ea5-772f-5c7b-90be-489aeecaf47b"
  },
  {
    "name": "Luchi (2 pieces)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Maida",
        "qty": "2 katori"
      },
      {
        "item": "Ghee or oil",
        "qty": "2 tbsp in the dough"
      },
      {
        "item": "Salt",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil for frying",
        "qty": "1 katori"
      }
    ],
    "steps": [
      "Knead maida with ghee, salt and water into a smooth firm dough and rest for 30 minutes.",
      "Make small balls and roll each into a thin round.",
      "Heat oil to medium-high.",
      "Slide in a luchi and gently press so it puffs up.",
      "Fry until pale golden and serve with aloo dum or cholar dal."
    ],
    "macros": {
      "per": "2 luchis",
      "calories": 260,
      "protein_g": 5,
      "carbs_g": 32,
      "fat_g": 12,
      "fiber_g": 1
    },
    "id": "485162d5-980a-549f-bf95-cab9ef6d16bd"
  },
  {
    "name": "Cholar Dal (Bengali Chana Dal)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chana dal",
        "qty": "1 katori"
      },
      {
        "item": "Coconut slices",
        "qty": "2 tbsp"
      },
      {
        "item": "Ginger paste",
        "qty": "1 tsp"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Bay leaf",
        "qty": "1"
      },
      {
        "item": "Ghee",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Pressure cook chana dal with turmeric and salt until soft but whole.",
      "Heat ghee, add bay leaf, dry red chilli, cumin and coconut slices.",
      "Add ginger paste and a pinch of sugar and the cooked dal.",
      "Simmer for 8 minutes, adding water if needed.",
      "Finish with garam masala and a spoon of ghee."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 210,
      "protein_g": 10,
      "carbs_g": 28,
      "fat_g": 7,
      "fiber_g": 7
    },
    "id": "c981ea7b-38fa-5ee3-b851-055fb7868142"
  },
  {
    "name": "Bhoger Khichuri",
    "region": "East",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Gobindobhog rice",
        "qty": "1 katori"
      },
      {
        "item": "Roasted moong dal",
        "qty": "1/2 katori"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1 katori"
      },
      {
        "item": "Ginger paste",
        "qty": "1 tsp"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      },
      {
        "item": "Bay leaf and whole spices",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Dry roast the moong dal until fragrant and wash with the rice.",
      "Heat ghee, add bay leaf, cumin and whole spices, then ginger paste.",
      "Add vegetables and the rice-dal mixture with turmeric.",
      "Pour 5 katori water, add salt and sugar and cook until soft.",
      "Finish with a spoon of ghee and serve with begun bhaja."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 320,
      "protein_g": 10,
      "carbs_g": 50,
      "fat_g": 8,
      "fiber_g": 5
    },
    "id": "c14bf100-4ec9-550d-a935-34713c1078d5"
  },
  {
    "name": "Mishti Doi",
    "region": "East",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Full-fat milk",
        "qty": "3 katori"
      },
      {
        "item": "Sugar",
        "qty": "5 tbsp"
      },
      {
        "item": "Curd as starter",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Boil the milk until reduced by a quarter.",
      "Caramelise the sugar until light brown and carefully pour in the milk.",
      "Cool until lukewarm and whisk in the curd starter.",
      "Pour into clay or steel cups and cover.",
      "Set for 8 to 10 hours in a warm place, then chill."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 210,
      "protein_g": 6,
      "carbs_g": 31,
      "fat_g": 7,
      "fiber_g": 0
    },
    "id": "03865735-25ff-56cc-bf97-fcd21dfd5d5d"
  },
  {
    "name": "Rasgulla (2 pieces)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 5,
    "ingredients": [
      {
        "item": "Full-fat milk",
        "qty": "4 katori"
      },
      {
        "item": "Lemon juice",
        "qty": "2 tbsp"
      },
      {
        "item": "Sugar",
        "qty": "1 katori"
      },
      {
        "item": "Water",
        "qty": "4 katori"
      },
      {
        "item": "Cardamom",
        "qty": "2"
      }
    ],
    "steps": [
      "Boil the milk and curdle it with lemon juice, then strain through muslin and rinse.",
      "Hang the chhena for 30 minutes and knead it smooth for 8 minutes.",
      "Shape into smooth small balls.",
      "Boil sugar syrup and drop in the balls, cooking covered for 15 minutes.",
      "Cool in the syrup and serve chilled."
    ],
    "macros": {
      "per": "2 pieces",
      "calories": 190,
      "protein_g": 5,
      "carbs_g": 33,
      "fat_g": 4,
      "fiber_g": 0
    },
    "id": "4ba1414f-4b70-5253-9a34-3007f2d20bb0"
  },
  {
    "name": "Sandesh (2 pieces)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 5,
    "ingredients": [
      {
        "item": "Fresh chhena",
        "qty": "1.5 katori"
      },
      {
        "item": "Powdered sugar",
        "qty": "4 tbsp"
      },
      {
        "item": "Cardamom powder",
        "qty": "1/4 tsp"
      }
    ],
    "steps": [
      "Knead fresh chhena with the heel of the palm until smooth and grain-free.",
      "Cook with powdered sugar in a pan on low heat for 4 minutes.",
      "Add cardamom powder and mix well.",
      "Cool slightly and press into moulds.",
      "Chill and serve."
    ],
    "macros": {
      "per": "2 pieces",
      "calories": 140,
      "protein_g": 6,
      "carbs_g": 17,
      "fat_g": 5,
      "fiber_g": 0
    },
    "id": "47a9d298-4705-53fe-9503-1cf6a9999e05"
  },
  {
    "name": "Payesh (Bengali Rice Pudding)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 5,
    "ingredients": [
      {
        "item": "Full-fat milk",
        "qty": "5 katori"
      },
      {
        "item": "Gobindobhog rice",
        "qty": "1/4 katori"
      },
      {
        "item": "Nolen gur or sugar",
        "qty": "1/3 katori"
      },
      {
        "item": "Bay leaf",
        "qty": "1"
      },
      {
        "item": "Cardamom",
        "qty": "3"
      }
    ],
    "steps": [
      "Boil the milk with a bay leaf and cardamom, reducing it slightly.",
      "Add washed rice and cook on low heat until very soft.",
      "Keep stirring so it doesn't catch at the bottom.",
      "Switch off the flame, cool slightly and stir in the jaggery or sugar.",
      "Serve warm or chilled."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 270,
      "protein_g": 7,
      "carbs_g": 39,
      "fat_g": 9,
      "fiber_g": 1
    },
    "id": "531cc4b9-29c2-52d2-8996-6e7476359e39"
  },
  {
    "name": "Dalma (Odisha)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Toor dal",
        "qty": "1 katori"
      },
      {
        "item": "Raw banana, pumpkin, brinjal",
        "qty": "2 katori chopped"
      },
      {
        "item": "Grated coconut",
        "qty": "3 tbsp"
      },
      {
        "item": "Panch phoron",
        "qty": "1 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Pressure cook dal with turmeric until soft.",
      "Add the chopped vegetables and cook until tender.",
      "Add salt, ginger and roasted cumin and coriander powder and simmer 5 minutes.",
      "Heat ghee and temper with panch phoron and dry red chilli.",
      "Pour over the dal and top with coconut."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 210,
      "protein_g": 9,
      "carbs_g": 28,
      "fat_g": 7,
      "fiber_g": 7
    },
    "id": "ab780179-8945-5950-8515-1536ef6a3a24"
  },
  {
    "name": "Pakhala Bhata",
    "region": "East",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 2,
    "ingredients": [
      {
        "item": "Cooked rice",
        "qty": "2 katori"
      },
      {
        "item": "Water",
        "qty": "2 katori"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Roasted cumin powder",
        "qty": "1/2 tsp"
      },
      {
        "item": "Green chilli, onion, mint",
        "qty": "to taste"
      }
    ],
    "steps": [
      "Soak the cooked rice in water overnight for fermented pakhala, or for 2 hours for a quick version.",
      "Add salt, curd and roasted cumin.",
      "Garnish with crushed mint, chilli and sliced onion.",
      "Serve chilled.",
      "Eat with badi chura, saag or fried fish."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 240,
      "protein_g": 6,
      "carbs_g": 46,
      "fat_g": 3,
      "fiber_g": 2
    },
    "id": "62654ce0-5c6e-5b0f-baf6-acd1fafd9242"
  },
  {
    "name": "Litti Chokha (2 litti)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 4,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "2 katori"
      },
      {
        "item": "Sattu",
        "qty": "3/4 katori"
      },
      {
        "item": "Ajwain and kalonji",
        "qty": "1 tsp each"
      },
      {
        "item": "Brinjal and tomato for chokha",
        "qty": "1 each"
      },
      {
        "item": "Mustard oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Mix sattu with ginger, garlic, chilli, ajwain, lemon juice and mustard oil for the stuffing.",
      "Knead atta dough with salt and ajwain and stuff each ball with sattu.",
      "Roast the littis on a flame or in the oven until brown and cracked.",
      "Roast brinjal, tomato and potato and mash with garlic, chilli and mustard oil for the chokha.",
      "Dip the littis in ghee and serve with chokha."
    ],
    "macros": {
      "per": "2 litti with chokha",
      "calories": 400,
      "protein_g": 14,
      "carbs_g": 58,
      "fat_g": 12,
      "fiber_g": 10
    },
    "id": "73b7d211-4349-5ac5-b020-c69dad72557b"
  },
  {
    "name": "Sattu Paratha (1 piece)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "2 katori"
      },
      {
        "item": "Sattu",
        "qty": "3/4 katori"
      },
      {
        "item": "Onion",
        "qty": "1 small chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Mustard oil",
        "qty": "1 tsp"
      },
      {
        "item": "Ghee",
        "qty": "4 tsp"
      }
    ],
    "steps": [
      "Make a soft atta dough and rest it.",
      "Mix sattu with onion, chilli, ajwain, lemon, salt and mustard oil.",
      "Stuff the sattu mix into dough balls and roll out.",
      "Cook on a tawa with ghee until golden.",
      "Serve with curd or pickle."
    ],
    "macros": {
      "per": "1 paratha",
      "calories": 260,
      "protein_g": 10,
      "carbs_g": 38,
      "fat_g": 8,
      "fiber_g": 6
    },
    "id": "6f310695-a832-56b1-8eae-45fb19e3be07"
  },
  {
    "name": "Thekua (1 piece)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 8,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "2 katori"
      },
      {
        "item": "Jaggery",
        "qty": "3/4 katori"
      },
      {
        "item": "Ghee",
        "qty": "4 tbsp"
      },
      {
        "item": "Grated dry coconut",
        "qty": "3 tbsp"
      },
      {
        "item": "Fennel seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Oil for frying",
        "qty": "1 katori"
      }
    ],
    "steps": [
      "Melt jaggery in water and cool it.",
      "Mix atta, ghee, coconut and fennel and knead with the jaggery water into a stiff dough.",
      "Shape into rounds and press with a thekua mould.",
      "Deep fry on low heat until deep brown and crisp.",
      "Cool and store in an airtight box."
    ],
    "macros": {
      "per": "1 piece",
      "calories": 210,
      "protein_g": 3,
      "carbs_g": 30,
      "fat_g": 9,
      "fiber_g": 2
    },
    "id": "234b06ec-9291-5cd7-8297-8261b5563bf5"
  },
  {
    "name": "Masor Tenga (Assamese Sour Fish Curry)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Rohu pieces",
        "qty": "500 g"
      },
      {
        "item": "Tomato",
        "qty": "3"
      },
      {
        "item": "Lemon",
        "qty": "1"
      },
      {
        "item": "Fenugreek seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Fry the turmeric-marinated fish lightly in mustard oil and set aside.",
      "Splutter methi seeds in the oil and add chopped tomato.",
      "Cook the tomato until soft and add 3 katori water.",
      "Slide in the fish and simmer gently for 8 minutes.",
      "Add the lemon juice and coriander and serve with rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 210,
      "protein_g": 24,
      "carbs_g": 7,
      "fat_g": 9,
      "fiber_g": 2
    },
    "id": "3a2b2bbd-1f01-57a7-b477-9ab0b86090c0"
  },
  {
    "name": "Aloo Pitika (Assamese Mashed Potato)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Boiled potatoes",
        "qty": "3 medium"
      },
      {
        "item": "Onion",
        "qty": "1 small chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      },
      {
        "item": "Raw mustard oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Peel and mash the boiled potatoes.",
      "Add chopped onion, green chilli and coriander.",
      "Mix in salt and raw mustard oil.",
      "Mash and combine well by hand.",
      "Serve with dal and rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 150,
      "protein_g": 2.5,
      "carbs_g": 22,
      "fat_g": 6,
      "fiber_g": 3
    },
    "id": "96e45526-e5ac-5e66-9e93-ed3bd62672dd"
  },
  {
    "name": "Chicken Momos (6 pieces)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 45,
    "serves": 4,
    "ingredients": [
      {
        "item": "Maida",
        "qty": "1.5 katori"
      },
      {
        "item": "Chicken mince",
        "qty": "250 g"
      },
      {
        "item": "Onion",
        "qty": "1 small finely chopped"
      },
      {
        "item": "Ginger-garlic",
        "qty": "1 tbsp"
      },
      {
        "item": "Spring onion",
        "qty": "2 stalks"
      },
      {
        "item": "Soy sauce",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Knead maida with water and salt into a firm dough and rest 30 minutes.",
      "Mix chicken mince with onion, ginger-garlic, spring onion, soy sauce and pepper.",
      "Roll thin circles and put a spoon of filling in each.",
      "Pleat and seal into dumplings.",
      "Steam for 12 minutes and serve with spicy red chutney."
    ],
    "macros": {
      "per": "6 momos",
      "calories": 260,
      "protein_g": 18,
      "carbs_g": 30,
      "fat_g": 7,
      "fiber_g": 1.5
    },
    "id": "3a7013c0-5b9a-593c-85a1-0eb0329698bf"
  },
  {
    "name": "Veg Thukpa",
    "region": "East",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Noodles",
        "qty": "2 handfuls"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1.5 katori"
      },
      {
        "item": "Garlic",
        "qty": "4 cloves"
      },
      {
        "item": "Ginger",
        "qty": "1 inch"
      },
      {
        "item": "Soy sauce",
        "qty": "1 tsp"
      },
      {
        "item": "Vegetable stock",
        "qty": "4 katori"
      }
    ],
    "steps": [
      "Saute garlic, ginger and onion in a little oil.",
      "Add the vegetables and cook briefly.",
      "Pour in vegetable stock, soy sauce, salt and pepper and bring to a boil.",
      "Add the boiled noodles and simmer for 3 minutes.",
      "Serve hot with a squeeze of lemon and spring onion greens."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 240,
      "protein_g": 7,
      "carbs_g": 40,
      "fat_g": 5,
      "fiber_g": 5
    },
    "id": "940bb942-b0d3-5281-88c1-3bac1263c6c5"
  },
  {
    "name": "Jadoh (Meghalaya Pork Rice)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Red rice or short grain rice",
        "qty": "1.5 katori"
      },
      {
        "item": "Pork pieces",
        "qty": "400 g"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Ginger and garlic",
        "qty": "1 tbsp"
      },
      {
        "item": "Black pepper",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Fry onions, ginger and garlic in mustard oil until golden.",
      "Add the pork with turmeric and pepper and cook until browned.",
      "Add water and cook the pork until tender.",
      "Add the washed rice and enough stock to cook it.",
      "Cook covered until the rice absorbs the stock and serve hot."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 480,
      "protein_g": 23,
      "carbs_g": 50,
      "fat_g": 20,
      "fiber_g": 2
    },
    "id": "966df0db-ab4f-5b55-9f30-b289cf72eccf"
  },
  {
    "name": "Smoked Pork with Bamboo Shoot (Nagaland)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 60,
    "serves": 4,
    "ingredients": [
      {
        "item": "Smoked pork",
        "qty": "400 g"
      },
      {
        "item": "Fermented bamboo shoot",
        "qty": "1/2 katori"
      },
      {
        "item": "Raja mirchi or green chilli",
        "qty": "3"
      },
      {
        "item": "Garlic and ginger",
        "qty": "1 tbsp"
      },
      {
        "item": "Mustard oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Boil the smoked pork until tender and drain.",
      "Heat mustard oil and fry garlic, ginger and chillies.",
      "Add the pork pieces and brown them.",
      "Add the bamboo shoot and a katori of water.",
      "Simmer for 20 minutes and serve with sticky rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 380,
      "protein_g": 22,
      "carbs_g": 4,
      "fat_g": 31,
      "fiber_g": 2
    },
    "id": "c0cc1bd0-4f6d-563c-a1c8-a9ae34e044d0"
  },
  {
    "name": "Eromba (Manipur)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Boiled potato and vegetables",
        "qty": "2 katori"
      },
      {
        "item": "Fermented fish (ngari) or substitute",
        "qty": "1 tbsp"
      },
      {
        "item": "Bird's eye chilli",
        "qty": "3"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      }
    ],
    "steps": [
      "Boil potato, beans and other vegetables until soft.",
      "Roast the chillies and fermented fish and crush them.",
      "Mash the vegetables and mix with the crushed paste.",
      "Add salt, a little water and coriander.",
      "Simmer for 5 minutes and serve with rice."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 120,
      "protein_g": 4,
      "carbs_g": 20,
      "fat_g": 2.5,
      "fiber_g": 4
    },
    "id": "009ecc35-4e52-54cc-adb6-022db3bb5570"
  },
  {
    "name": "Chana Ghugni",
    "region": "East",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "ingredients": [
      {
        "item": "Dried white peas",
        "qty": "1 katori soaked overnight"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Ginger paste",
        "qty": "1 tsp"
      },
      {
        "item": "Ghugni masala or garam masala",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Pressure cook the soaked peas with salt and turmeric until soft.",
      "Fry chopped onion in oil until golden and add ginger paste.",
      "Add tomato and the spice powders and cook until soft.",
      "Add the peas with water and simmer until thick.",
      "Top with onion, green chilli, coriander and tamarind chutney."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 210,
      "protein_g": 10,
      "carbs_g": 30,
      "fat_g": 6,
      "fiber_g": 8
    },
    "id": "9a88d0d8-1d38-5066-aa65-1cb5eee0c869"
  },
  {
    "name": "Jhal Muri",
    "region": "East",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 2,
    "ingredients": [
      {
        "item": "Puffed rice (muri)",
        "qty": "3 katori"
      },
      {
        "item": "Onion",
        "qty": "1 small chopped"
      },
      {
        "item": "Cucumber",
        "qty": "1/2 chopped"
      },
      {
        "item": "Roasted peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Mustard oil",
        "qty": "1 tsp"
      },
      {
        "item": "Chaat masala",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Take the puffed rice in a large bowl.",
      "Add chopped onion, cucumber, green chilli and peanuts.",
      "Drizzle raw mustard oil and add salt and chaat masala.",
      "Squeeze in lemon juice and add coriander.",
      "Toss quickly and serve immediately so it stays crisp."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 170,
      "protein_g": 4,
      "carbs_g": 28,
      "fat_g": 5,
      "fiber_g": 2.5
    },
    "id": "e3032c18-a1fe-5d1a-864f-f9dc430f9f89"
  },
  {
    "name": "Egg Roll (Kolkata Style)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 20,
    "serves": 2,
    "ingredients": [
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Maida or paratha",
        "qty": "2"
      },
      {
        "item": "Onion",
        "qty": "1 sliced"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Cook plain parathas on a tawa with oil until half done.",
      "Beat the eggs with salt, chilli and onion.",
      "Pour the egg mixture on a hot tawa and place a paratha on top.",
      "Flip, add onion rings, lemon juice and chaat masala.",
      "Roll tightly and serve with tomato sauce."
    ],
    "macros": {
      "per": "1 roll",
      "calories": 340,
      "protein_g": 12,
      "carbs_g": 36,
      "fat_g": 16,
      "fiber_g": 2
    },
    "id": "a019f77d-0a52-56ad-813a-9969fc455e62"
  },
  {
    "name": "Mochar Ghonto (Banana Flower)",
    "region": "East",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Banana flower",
        "qty": "1 medium chopped"
      },
      {
        "item": "Potato",
        "qty": "1 cubed"
      },
      {
        "item": "Grated coconut",
        "qty": "3 tbsp"
      },
      {
        "item": "Panch phoron",
        "qty": "1 tsp"
      },
      {
        "item": "Ginger paste",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Clean and chop the banana flower and boil it for 10 minutes.",
      "Splutter panch phoron in mustard oil and add ginger paste.",
      "Add potato, turmeric and the drained banana flower.",
      "Add salt, cumin powder and a little water.",
      "Cook until dry and finish with coconut and ghee."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 150,
      "protein_g": 3,
      "carbs_g": 19,
      "fat_g": 7,
      "fiber_g": 6
    },
    "id": "d40a19b7-4acc-50eb-b78d-5018451ff58f"
  },
  {
    "name": "Chhena Poda",
    "region": "East",
    "type": "Veg",
    "time_minutes": 70,
    "serves": 6,
    "ingredients": [
      {
        "item": "Fresh chhena",
        "qty": "2 katori"
      },
      {
        "item": "Sugar",
        "qty": "1/2 katori"
      },
      {
        "item": "Semolina",
        "qty": "2 tbsp"
      },
      {
        "item": "Cardamom powder",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Knead the chhena with sugar until smooth.",
      "Mix in semolina, cardamom and a few cashews and raisins.",
      "Pour into a greased tin lined with a banana leaf if available.",
      "Bake at 180 degrees for 45 minutes until the top turns caramel brown.",
      "Cool and slice."
    ],
    "macros": {
      "per": "1 slice",
      "calories": 210,
      "protein_g": 8,
      "carbs_g": 26,
      "fat_g": 8,
      "fiber_g": 0.5
    },
    "id": "2140f741-58ec-51a6-b576-b445cb394790"
  },
  {
    "name": "Khaman Dhokla",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Besan",
        "qty": "1.5 katori"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Eno or baking soda",
        "qty": "1 tsp"
      },
      {
        "item": "Sugar",
        "qty": "1 tbsp"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Green chilli",
        "qty": "3"
      },
      {
        "item": "Oil",
        "qty": "1.5 tbsp"
      }
    ],
    "steps": [
      "Whisk besan, curd, sugar, salt, turmeric and water into a smooth batter and rest 10 minutes.",
      "Add Eno just before steaming and mix gently until frothy.",
      "Pour into a greased plate and steam for 15 minutes.",
      "Heat oil and crackle mustard seeds, green chilli and curry leaves with a little water and sugar.",
      "Pour the tempering over the cut dhokla and serve with coriander chutney."
    ],
    "macros": {
      "per": "4 pieces",
      "calories": 190,
      "protein_g": 9,
      "carbs_g": 24,
      "fat_g": 6,
      "fiber_g": 4
    },
    "id": "aeec8f68-7391-539c-a20b-6acf6a08c087"
  },
  {
    "name": "Khandvi (4 rolls)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Besan",
        "qty": "1 katori"
      },
      {
        "item": "Sour curd",
        "qty": "1 katori"
      },
      {
        "item": "Water",
        "qty": "2 katori"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Mustard seeds",
        "qty": "1 tsp"
      },
      {
        "item": "Grated coconut",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Whisk besan, curd, water, turmeric and salt until lump-free.",
      "Cook on medium flame, stirring constantly, until very thick and glossy.",
      "Spread thin on greased plates quickly and let it cool.",
      "Cut into strips and roll each tightly.",
      "Temper with mustard, sesame and curry leaves and top with coconut and coriander."
    ],
    "macros": {
      "per": "4 rolls",
      "calories": 180,
      "protein_g": 8,
      "carbs_g": 20,
      "fat_g": 7,
      "fiber_g": 3
    },
    "id": "d33f3bf7-e48c-548d-b48d-cfa218314fba"
  },
  {
    "name": "Methi Thepla (2 pieces)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 4,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "2 katori"
      },
      {
        "item": "Fresh methi leaves",
        "qty": "1.5 katori chopped"
      },
      {
        "item": "Curd",
        "qty": "3 tbsp"
      },
      {
        "item": "Besan",
        "qty": "2 tbsp"
      },
      {
        "item": "Turmeric and chilli powder",
        "qty": "1/2 tsp each"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Mix atta, besan, methi, curd, spices and salt.",
      "Add oil and knead a soft dough with water.",
      "Roll thin rounds and cook on a hot tawa.",
      "Brush with oil and cook until brown spots appear.",
      "Serve with curd, pickle or chunda."
    ],
    "macros": {
      "per": "2 theplas",
      "calories": 220,
      "protein_g": 7,
      "carbs_g": 34,
      "fat_g": 7,
      "fiber_g": 6
    },
    "id": "feb30a34-1892-50b3-9dc2-5e2c9cb0b9ea"
  },
  {
    "name": "Handvo",
    "region": "West",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 6,
    "ingredients": [
      {
        "item": "Rice",
        "qty": "1 katori"
      },
      {
        "item": "Mixed dals",
        "qty": "1/2 katori"
      },
      {
        "item": "Grated bottle gourd",
        "qty": "1 katori"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Sesame seeds",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Soak rice and dals together for 5 hours and grind coarsely.",
      "Ferment with curd overnight.",
      "Mix in grated lauki, ginger, chilli, salt and Eno.",
      "Temper oil with mustard and sesame and pour half into a pan, then add the batter.",
      "Cook covered on low flame for 20 minutes per side until crusty."
    ],
    "macros": {
      "per": "1 slice",
      "calories": 220,
      "protein_g": 7,
      "carbs_g": 30,
      "fat_g": 8,
      "fiber_g": 4
    },
    "id": "3500bf4a-5ff7-5166-a9da-a17e74b108d5"
  },
  {
    "name": "Undhiyu",
    "region": "West",
    "type": "Veg",
    "time_minutes": 75,
    "serves": 5,
    "ingredients": [
      {
        "item": "Surti papdi, raw banana, sweet potato, brinjal, potato",
        "qty": "4 katori mixed"
      },
      {
        "item": "Muthia (methi dumplings)",
        "qty": "10 small"
      },
      {
        "item": "Green masala (coconut, coriander, green chilli)",
        "qty": "1 katori"
      },
      {
        "item": "Sesame seeds",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "4 tbsp"
      }
    ],
    "steps": [
      "Make small methi muthia and deep fry them.",
      "Mix the green masala with salt, sugar and lemon and stuff the vegetables.",
      "Heat oil, add ajwain and asafoetida and layer the vegetables in a pot.",
      "Add the remaining masala, cover and cook on low heat for 40 minutes without stirring much.",
      "Add the muthia in the last 5 minutes and serve with puri."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 280,
      "protein_g": 6,
      "carbs_g": 30,
      "fat_g": 15,
      "fiber_g": 8
    },
    "id": "805f32a8-43a1-569e-bca0-a817059a307a"
  },
  {
    "name": "Gujarati Kadhi",
    "region": "West",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 4,
    "ingredients": [
      {
        "item": "Sour curd",
        "qty": "2 katori"
      },
      {
        "item": "Besan",
        "qty": "2 tbsp"
      },
      {
        "item": "Sugar or jaggery",
        "qty": "1 tbsp"
      },
      {
        "item": "Mustard and cumin",
        "qty": "1 tsp each"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      },
      {
        "item": "Ghee",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Whisk curd, besan, sugar, salt, ginger-green chilli paste and 3 katori water.",
      "Cook on medium heat, stirring constantly, until it boils and thickens slightly.",
      "Simmer for 10 minutes.",
      "Temper ghee with mustard, cumin, cloves, cinnamon, dry chilli and curry leaves.",
      "Pour the tadka over the kadhi and serve with khichdi."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 120,
      "protein_g": 5,
      "carbs_g": 12,
      "fat_g": 6,
      "fiber_g": 1
    },
    "id": "784efef0-2da2-5e7b-8f02-df69a5240c87"
  },
  {
    "name": "Sev Tamatar Sabzi",
    "region": "West",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Tomato",
        "qty": "4"
      },
      {
        "item": "Sev",
        "qty": "1 katori"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Mustard and cumin",
        "qty": "1 tsp each"
      },
      {
        "item": "Sugar",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Heat oil and crackle mustard, cumin and curry leaves.",
      "Add onion, tomato and spices with a pinch of sugar and cook until pulpy.",
      "Add water and bring the gravy to a boil.",
      "Switch off the flame and stir in the sev just before serving.",
      "Serve at once with roti or bhakri."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 220,
      "protein_g": 6,
      "carbs_g": 20,
      "fat_g": 13,
      "fiber_g": 4
    },
    "id": "4323f905-ceb1-5aef-9412-b01cf58cfcbc"
  },
  {
    "name": "Kanda Poha",
    "region": "West",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Thick poha",
        "qty": "2 katori"
      },
      {
        "item": "Onion",
        "qty": "2 chopped"
      },
      {
        "item": "Potato",
        "qty": "1 small cubed"
      },
      {
        "item": "Peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Rinse the poha gently and drain; mix with salt, sugar and turmeric.",
      "Heat oil and fry peanuts, then crackle mustard seeds, curry leaves and chilli.",
      "Add onion and potato and cook until soft.",
      "Add the poha and mix gently, cover for 2 minutes.",
      "Finish with lemon juice, coriander and sev."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 280,
      "protein_g": 6,
      "carbs_g": 44,
      "fat_g": 10,
      "fiber_g": 4
    },
    "id": "92f07974-61e9-5cc6-a804-d4bd58fb10d7"
  },
  {
    "name": "Misal Pav (with 2 pav)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Sprouted matki",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Tomato",
        "qty": "2"
      },
      {
        "item": "Misal masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Farsan",
        "qty": "1 katori"
      },
      {
        "item": "Pav",
        "qty": "8"
      }
    ],
    "steps": [
      "Pressure cook the sprouted matki with turmeric and salt until tender.",
      "Make a spicy kat with sauteed onion, tomato, coconut and misal masala.",
      "Combine with the matki and simmer for 10 minutes.",
      "Add water to make a thin red-orange rassa.",
      "Serve topped with farsan, onion, lemon and coriander with buttered pav."
    ],
    "macros": {
      "per": "1 plate with 2 pav",
      "calories": 450,
      "protein_g": 16,
      "carbs_g": 62,
      "fat_g": 15,
      "fiber_g": 12
    },
    "id": "eaa4514c-bbd5-5246-9ff6-71668843d018"
  },
  {
    "name": "Vada Pav",
    "region": "West",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Boiled potatoes",
        "qty": "4 medium"
      },
      {
        "item": "Besan",
        "qty": "1 katori"
      },
      {
        "item": "Garlic",
        "qty": "6 cloves"
      },
      {
        "item": "Green chilli",
        "qty": "3"
      },
      {
        "item": "Pav",
        "qty": "4"
      },
      {
        "item": "Oil for frying",
        "qty": "1 katori"
      }
    ],
    "steps": [
      "Mash potatoes with garlic-chilli paste, mustard tempering, turmeric, salt and coriander.",
      "Shape into balls and dip in thick besan batter.",
      "Deep fry on medium heat until golden.",
      "Slit the pav, spread green chutney and dry garlic chutney.",
      "Place the vada inside and serve hot with fried green chillies."
    ],
    "macros": {
      "per": "1 vada pav",
      "calories": 330,
      "protein_g": 8,
      "carbs_g": 42,
      "fat_g": 14,
      "fiber_g": 4
    },
    "id": "82c64263-4d7c-5f55-8b2f-3c9c7b7e892e"
  },
  {
    "name": "Pav Bhaji (with 2 pav)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 4,
    "ingredients": [
      {
        "item": "Potatoes",
        "qty": "3 medium"
      },
      {
        "item": "Cauliflower",
        "qty": "1 katori"
      },
      {
        "item": "Green peas",
        "qty": "1/2 katori"
      },
      {
        "item": "Tomato",
        "qty": "3"
      },
      {
        "item": "Pav bhaji masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Butter",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Boil the potato, cauliflower and peas until soft and mash well.",
      "Saute onions, capsicum and tomatoes in butter until soft.",
      "Add pav bhaji masala, chilli powder and the mashed vegetables.",
      "Add water and simmer for 10 minutes, mashing again.",
      "Serve with butter-toasted pav, onion and lemon."
    ],
    "macros": {
      "per": "1 plate with 2 pav",
      "calories": 450,
      "protein_g": 12,
      "carbs_g": 66,
      "fat_g": 16,
      "fiber_g": 7
    },
    "id": "4be794a2-97a1-536e-8a53-5a1b3aaaadf7"
  },
  {
    "name": "Bhel Puri",
    "region": "West",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 2,
    "ingredients": [
      {
        "item": "Puffed rice",
        "qty": "3 katori"
      },
      {
        "item": "Sev",
        "qty": "1/2 katori"
      },
      {
        "item": "Onion",
        "qty": "1 small chopped"
      },
      {
        "item": "Tomato",
        "qty": "1 small"
      },
      {
        "item": "Boiled potato",
        "qty": "1 small"
      },
      {
        "item": "Tamarind and green chutney",
        "qty": "2 tbsp each"
      }
    ],
    "steps": [
      "Take puffed rice in a bowl and add chopped onion, tomato and potato.",
      "Add tamarind chutney, green chutney and a little chaat masala.",
      "Toss quickly.",
      "Add sev and crushed papdi.",
      "Top with coriander and a squeeze of lemon and eat right away."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 270,
      "protein_g": 6,
      "carbs_g": 48,
      "fat_g": 6,
      "fiber_g": 4
    },
    "id": "f125b618-2c3f-5ba8-9880-c0e189582824"
  },
  {
    "name": "Pani Puri (6 pieces)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Puri shells",
        "qty": "18"
      },
      {
        "item": "Boiled potato and chana",
        "qty": "1 katori"
      },
      {
        "item": "Mint and coriander",
        "qty": "1 bunch each"
      },
      {
        "item": "Tamarind pulp",
        "qty": "2 tbsp"
      },
      {
        "item": "Jaljeera powder",
        "qty": "1 tbsp"
      },
      {
        "item": "Cold water",
        "qty": "4 katori"
      }
    ],
    "steps": [
      "Grind mint, coriander, green chilli and ginger into a paste.",
      "Mix the paste with tamarind pulp, jaljeera powder, black salt and cold water.",
      "Chill the pani for an hour.",
      "Mash potato and chana with salt and chaat masala.",
      "Crack each puri, stuff the filling and fill with pani before eating."
    ],
    "macros": {
      "per": "6 puris",
      "calories": 230,
      "protein_g": 5,
      "carbs_g": 34,
      "fat_g": 8,
      "fiber_g": 4
    },
    "id": "c81c0656-3355-591d-b8b0-0cbbc1d49998"
  },
  {
    "name": "Sabudana Khichdi",
    "region": "West",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 3,
    "ingredients": [
      {
        "item": "Sabudana",
        "qty": "1 katori soaked 5 hours"
      },
      {
        "item": "Roasted peanuts",
        "qty": "1/3 katori crushed"
      },
      {
        "item": "Potato",
        "qty": "1 small cubed"
      },
      {
        "item": "Cumin",
        "qty": "1 tsp"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Ghee",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Drain the soaked sabudana and mix with crushed peanuts, salt and sugar.",
      "Heat ghee, crackle cumin and fry the potato and chilli until soft.",
      "Add the sabudana mixture.",
      "Cook on low flame, stirring gently, for 5 minutes until translucent.",
      "Finish with lemon juice and coriander."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 340,
      "protein_g": 6,
      "carbs_g": 48,
      "fat_g": 14,
      "fiber_g": 3
    },
    "id": "67820829-0d98-5cc6-8051-ad116f68ae95"
  },
  {
    "name": "Thalipeeth (2 pieces)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Bhajani flour (multigrain)",
        "qty": "2 katori"
      },
      {
        "item": "Onion",
        "qty": "1 chopped"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      },
      {
        "item": "Cumin and ajwain",
        "qty": "1/2 tsp each"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Mix bhajani flour with onion, coriander, chilli, spices and salt.",
      "Add water and knead into a soft dough.",
      "Pat the dough on a wet cloth or plastic sheet into a thin round and poke holes.",
      "Cook on a hot tawa with oil in the holes and around the edges.",
      "Serve with white butter or curd."
    ],
    "macros": {
      "per": "2 pieces",
      "calories": 280,
      "protein_g": 8,
      "carbs_g": 40,
      "fat_g": 10,
      "fiber_g": 7
    },
    "id": "1da4787c-9336-5691-9da1-77703f7e6b71"
  },
  {
    "name": "Varan Bhaat",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 3,
    "ingredients": [
      {
        "item": "Toor dal",
        "qty": "3/4 katori"
      },
      {
        "item": "Rice",
        "qty": "1 katori"
      },
      {
        "item": "Ghee",
        "qty": "1 tbsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      },
      {
        "item": "Salt",
        "qty": "to taste"
      }
    ],
    "steps": [
      "Pressure cook the toor dal with turmeric and a few drops of oil until mushy.",
      "Whisk the dal smooth and add salt.",
      "Cook the rice separately and fluff it.",
      "Serve the plain dal over rice with a generous spoon of ghee.",
      "Squeeze lemon on top and eat with pickle."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 330,
      "protein_g": 11,
      "carbs_g": 54,
      "fat_g": 7,
      "fiber_g": 5
    },
    "id": "f9bb1fc9-f19d-5069-999a-209b377e96e3"
  },
  {
    "name": "Puran Poli (1 piece)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 75,
    "serves": 6,
    "ingredients": [
      {
        "item": "Chana dal",
        "qty": "1 katori"
      },
      {
        "item": "Jaggery",
        "qty": "3/4 katori"
      },
      {
        "item": "Maida or atta",
        "qty": "1.5 katori"
      },
      {
        "item": "Cardamom and nutmeg",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "4 tbsp"
      }
    ],
    "steps": [
      "Cook chana dal until soft, drain and mash it with jaggery over low heat until thick and dry.",
      "Add cardamom and nutmeg and cool the puran.",
      "Knead a soft dough of flour, oil and water and rest it.",
      "Stuff a ball of puran into a dough ball and roll gently without tearing.",
      "Cook on a hot tawa with ghee until golden on both sides."
    ],
    "macros": {
      "per": "1 poli",
      "calories": 290,
      "protein_g": 6,
      "carbs_g": 48,
      "fat_g": 8,
      "fiber_g": 4
    },
    "id": "ada3dcf1-3c52-5f9a-84e1-d79bc37e35ba"
  },
  {
    "name": "Shrikhand",
    "region": "West",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 4,
    "ingredients": [
      {
        "item": "Hung curd",
        "qty": "2 katori"
      },
      {
        "item": "Powdered sugar",
        "qty": "4 tbsp"
      },
      {
        "item": "Saffron milk",
        "qty": "2 tbsp"
      },
      {
        "item": "Cardamom powder",
        "qty": "1/2 tsp"
      },
      {
        "item": "Chopped pistachios",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Hang curd in muslin for 4 hours until thick.",
      "Mix with powdered sugar and whisk until smooth.",
      "Add saffron milk and cardamom powder.",
      "Chill for 2 hours.",
      "Garnish with pistachios and serve with puri."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 220,
      "protein_g": 8,
      "carbs_g": 28,
      "fat_g": 8,
      "fiber_g": 0
    },
    "id": "9afdc815-99cd-5b87-a436-c206abe3cd86"
  },
  {
    "name": "Ukadiche Modak (2 pieces)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Rice flour",
        "qty": "1 katori"
      },
      {
        "item": "Fresh coconut",
        "qty": "1 katori grated"
      },
      {
        "item": "Jaggery",
        "qty": "3/4 katori"
      },
      {
        "item": "Ghee",
        "qty": "1 tbsp"
      },
      {
        "item": "Cardamom",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Cook coconut and jaggery together until sticky and add cardamom.",
      "Boil water with ghee and salt and stir in the rice flour to make a dough.",
      "Knead the warm dough smooth.",
      "Make small cups, fill with the coconut mixture and pleat to seal.",
      "Steam for 12 minutes and serve with ghee."
    ],
    "macros": {
      "per": "2 modaks",
      "calories": 260,
      "protein_g": 3,
      "carbs_g": 44,
      "fat_g": 9,
      "fiber_g": 3
    },
    "id": "16276228-164a-50aa-95bd-43e2e98d9d82"
  },
  {
    "name": "Kolhapuri Chicken",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 55,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chicken",
        "qty": "500 g"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Dry coconut",
        "qty": "3 tbsp"
      },
      {
        "item": "Kolhapuri masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Roast onion, dry coconut, sesame and whole spices and grind to a thick paste.",
      "Heat oil and fry ginger-garlic paste, then add the masala paste.",
      "Cook until the oil separates and add the Kolhapuri masala and chilli.",
      "Add the chicken, salt and a katori water and cook covered until tender.",
      "Finish with coriander and serve with bhakri."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 370,
      "protein_g": 27,
      "carbs_g": 9,
      "fat_g": 25,
      "fiber_g": 3
    },
    "id": "8404c1fc-dd15-57f4-beaf-59a3b80f60a4"
  },
  {
    "name": "Goan Fish Curry",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 4,
    "ingredients": [
      {
        "item": "Fish pieces (kingfish or pomfret)",
        "qty": "500 g"
      },
      {
        "item": "Grated coconut",
        "qty": "1 katori"
      },
      {
        "item": "Kashmiri chilli",
        "qty": "6 dry"
      },
      {
        "item": "Tamarind pulp",
        "qty": "1.5 tbsp"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Oil",
        "qty": "2 tbsp"
      }
    ],
    "steps": [
      "Grind coconut, dry chillies, coriander seeds, turmeric and garlic into a smooth paste.",
      "Fry the onion in oil until soft and add the paste.",
      "Add water, tamarind pulp and salt and bring to a boil.",
      "Slide in the fish and simmer gently for 8 minutes.",
      "Rest and serve with steamed rice."
    ],
    "macros": {
      "per": "1 katori with 2 pieces",
      "calories": 280,
      "protein_g": 25,
      "carbs_g": 8,
      "fat_g": 16,
      "fiber_g": 3
    },
    "id": "51e8433f-f784-5d94-91ea-a0c7b018cc35"
  },
  {
    "name": "Pork Vindaloo",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 80,
    "serves": 4,
    "ingredients": [
      {
        "item": "Pork",
        "qty": "500 g"
      },
      {
        "item": "Vinegar",
        "qty": "3 tbsp"
      },
      {
        "item": "Kashmiri chilli",
        "qty": "8 dry"
      },
      {
        "item": "Garlic",
        "qty": "10 cloves"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Grind the soaked chillies, garlic, cumin, pepper, cinnamon and cloves with vinegar to a thick paste.",
      "Marinate the pork pieces with the paste and salt for at least 2 hours.",
      "Fry the onions in oil until golden and add the marinated pork.",
      "Cook on low heat with a little water for 45 minutes until tender.",
      "Rest overnight if possible for the best flavour."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 420,
      "protein_g": 26,
      "carbs_g": 8,
      "fat_g": 32,
      "fiber_g": 2
    },
    "id": "6f4abb3b-b51c-516f-8a3c-d1534b8f2bc2"
  },
  {
    "name": "Chicken Xacuti",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 60,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chicken",
        "qty": "500 g"
      },
      {
        "item": "Grated coconut",
        "qty": "1 katori roasted"
      },
      {
        "item": "Poppy seeds",
        "qty": "1 tbsp"
      },
      {
        "item": "Dry Kashmiri chilli",
        "qty": "6"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Dry roast coconut, poppy seeds, coriander seeds, chillies, pepper and whole spices.",
      "Grind with tamarind water into a smooth masala.",
      "Fry onion in oil and add the chicken and ginger-garlic paste.",
      "Add the masala paste, salt and water.",
      "Simmer covered for 25 minutes until the chicken is tender and the gravy is thick."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 390,
      "protein_g": 26,
      "carbs_g": 10,
      "fat_g": 28,
      "fiber_g": 4
    },
    "id": "89671c94-efa1-5531-955d-4bb76b67d74f"
  },
  {
    "name": "Dal Baati Churma (2 baati)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 90,
    "serves": 4,
    "ingredients": [
      {
        "item": "Coarse wheat flour",
        "qty": "2.5 katori"
      },
      {
        "item": "Ghee",
        "qty": "1/2 katori"
      },
      {
        "item": "Mixed dals (toor, moong, chana, masoor)",
        "qty": "1.5 katori"
      },
      {
        "item": "Jaggery for churma",
        "qty": "1/3 katori"
      },
      {
        "item": "Ajwain",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Knead the flour with ghee, ajwain, salt and water into a firm dough and shape into balls.",
      "Bake at 200 degrees for 35 minutes until browned and cracked.",
      "Cook the mixed dals until soft and temper with ghee, cumin, garlic and chilli.",
      "Crush a few baatis, mix with ghee and jaggery for churma.",
      "Dunk the baatis in ghee and serve with dal and churma."
    ],
    "macros": {
      "per": "2 baatis with 1 katori dal",
      "calories": 620,
      "protein_g": 18,
      "carbs_g": 80,
      "fat_g": 26,
      "fiber_g": 10
    },
    "id": "a0d1d082-5c5a-56ee-abbb-ae6bf5f192e9"
  },
  {
    "name": "Gatte Ki Sabzi",
    "region": "West",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 4,
    "ingredients": [
      {
        "item": "Besan",
        "qty": "1.5 katori"
      },
      {
        "item": "Curd",
        "qty": "1 katori"
      },
      {
        "item": "Ajwain",
        "qty": "1/2 tsp"
      },
      {
        "item": "Red chilli powder",
        "qty": "1.5 tsp"
      },
      {
        "item": "Coriander powder",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Knead besan with ajwain, chilli, salt and oil into a firm dough and roll into logs.",
      "Boil the logs in water for 12 minutes, then cut into pieces.",
      "Whisk curd with the spice powders and cook it in hot oil with cumin.",
      "Add water and boil to a gravy.",
      "Add the gatte and simmer for 8 minutes before serving."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 250,
      "protein_g": 10,
      "carbs_g": 22,
      "fat_g": 14,
      "fiber_g": 4
    },
    "id": "cd57b8e7-153e-5aa4-a06d-77f9e5b68779"
  },
  {
    "name": "Laal Maas",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 90,
    "serves": 5,
    "ingredients": [
      {
        "item": "Mutton",
        "qty": "600 g"
      },
      {
        "item": "Mathania chilli or Kashmiri chilli",
        "qty": "10 dry"
      },
      {
        "item": "Curd",
        "qty": "3/4 katori"
      },
      {
        "item": "Garlic paste",
        "qty": "2 tbsp"
      },
      {
        "item": "Ghee",
        "qty": "4 tbsp"
      }
    ],
    "steps": [
      "Soak the dry chillies and blend into a smooth red paste.",
      "Marinate the mutton with curd, garlic paste and salt for 1 hour.",
      "Heat ghee with whole spices and brown the mutton on high heat.",
      "Add the chilli paste and cook covered on low heat with a little water for 50 minutes.",
      "Finish with a smoky coal dhungar if desired and serve with bajra roti."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 400,
      "protein_g": 27,
      "carbs_g": 6,
      "fat_g": 30,
      "fiber_g": 2
    },
    "id": "7b90dfe6-2e65-55a6-a2df-d85d3888060d"
  },
  {
    "name": "Pyaaz Ki Kachori (1 piece)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 60,
    "serves": 6,
    "ingredients": [
      {
        "item": "Maida",
        "qty": "2 katori"
      },
      {
        "item": "Onion",
        "qty": "3 chopped"
      },
      {
        "item": "Besan",
        "qty": "2 tbsp"
      },
      {
        "item": "Fennel and cumin",
        "qty": "1 tsp each"
      },
      {
        "item": "Ghee",
        "qty": "3 tbsp in dough"
      },
      {
        "item": "Oil for frying",
        "qty": "1.5 katori"
      }
    ],
    "steps": [
      "Knead maida with ghee, salt and water into a firm dough.",
      "Roast fennel, cumin, besan and spices with onion until dry for the filling.",
      "Stuff a ball of filling inside the dough and flatten gently.",
      "Deep fry on low heat for 10 minutes until crisp and golden.",
      "Serve with tamarind chutney."
    ],
    "macros": {
      "per": "1 kachori",
      "calories": 280,
      "protein_g": 5,
      "carbs_g": 32,
      "fat_g": 15,
      "fiber_g": 2
    },
    "id": "be4319e9-6f68-522e-adf6-4d7cd30e0800"
  },
  {
    "name": "Bajra Roti (1 piece)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 3,
    "ingredients": [
      {
        "item": "Bajra flour",
        "qty": "1.5 katori"
      },
      {
        "item": "Warm water",
        "qty": "3/4 katori"
      },
      {
        "item": "Salt",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Knead the bajra flour with warm water and salt into a soft dough.",
      "Pat the dough into a thick round roti by hand.",
      "Cook on a hot tawa.",
      "Flip once and finish on a flame until it puffs.",
      "Serve hot with ghee, jaggery and garlic chutney."
    ],
    "macros": {
      "per": "1 roti",
      "calories": 140,
      "protein_g": 4,
      "carbs_g": 28,
      "fat_g": 2,
      "fiber_g": 4
    },
    "id": "c4134eed-b173-5b89-b83b-1b26428baad3"
  },
  {
    "name": "Sol Kadhi",
    "region": "West",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 3,
    "ingredients": [
      {
        "item": "Coconut milk",
        "qty": "1.5 katori"
      },
      {
        "item": "Kokum (soaked)",
        "qty": "6 petals"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      }
    ],
    "steps": [
      "Soak the kokum in warm water for 20 minutes and squeeze out the juice.",
      "Grind garlic, green chilli and coriander to a paste.",
      "Mix coconut milk, kokum water and the paste.",
      "Add salt and a pinch of sugar.",
      "Chill and serve as a digestive drink with rice."
    ],
    "macros": {
      "per": "1 glass",
      "calories": 120,
      "protein_g": 1,
      "carbs_g": 5,
      "fat_g": 11,
      "fiber_g": 1
    },
    "id": "06480497-ea63-5b12-b17e-b66379fa074f"
  },
  {
    "name": "Bharli Vangi (Stuffed Brinjal)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 4,
    "ingredients": [
      {
        "item": "Small brinjals",
        "qty": "8"
      },
      {
        "item": "Grated coconut",
        "qty": "1/2 katori"
      },
      {
        "item": "Peanut powder",
        "qty": "3 tbsp"
      },
      {
        "item": "Goda masala",
        "qty": "2 tsp"
      },
      {
        "item": "Jaggery",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Slit the brinjals into four, keeping the stem intact.",
      "Mix coconut, peanut powder, goda masala, jaggery, tamarind and salt for the stuffing.",
      "Fill the slits with the masala.",
      "Heat oil, add mustard and arrange the brinjals with leftover masala.",
      "Cover and cook on low flame for 20 minutes until tender."
    ],
    "macros": {
      "per": "2 brinjals",
      "calories": 200,
      "protein_g": 4,
      "carbs_g": 14,
      "fat_g": 14,
      "fiber_g": 5
    },
    "id": "8a60669d-ebc7-53f8-8fb4-72bc64e8b5a1"
  },
  {
    "name": "Chicken Sukka (Maharashtrian Dry Chicken)",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 45,
    "serves": 4,
    "ingredients": [
      {
        "item": "Chicken",
        "qty": "500 g"
      },
      {
        "item": "Dry coconut",
        "qty": "3 tbsp"
      },
      {
        "item": "Onion",
        "qty": "2"
      },
      {
        "item": "Malvani masala",
        "qty": "2 tbsp"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "3 tbsp"
      }
    ],
    "steps": [
      "Roast dry coconut and onion until golden and grind with the Malvani masala.",
      "Fry ginger-garlic paste and add the chicken to brown lightly.",
      "Add the masala paste and salt.",
      "Add a little water and cook covered until the chicken is done and the masala is dry.",
      "Garnish with coriander and serve with bhakri."
    ],
    "macros": {
      "per": "1 katori",
      "calories": 340,
      "protein_g": 28,
      "carbs_g": 8,
      "fat_g": 22,
      "fiber_g": 3
    },
    "id": "da496f6b-ce69-536f-b281-919397620f7f"
  },
  {
    "name": "Egg Bhurji Pav",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 15,
    "serves": 2,
    "ingredients": [
      {
        "item": "Eggs",
        "qty": "4"
      },
      {
        "item": "Onion",
        "qty": "1"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Pav",
        "qty": "4"
      },
      {
        "item": "Butter",
        "qty": "1 tbsp"
      },
      {
        "item": "Pav bhaji masala",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Heat butter and saute onion, chilli and tomato until soft.",
      "Add turmeric, chilli powder and pav bhaji masala.",
      "Crack in the eggs and scramble until just set.",
      "Toast the pav in butter on a tawa.",
      "Serve the bhurji hot with the toasted pav."
    ],
    "macros": {
      "per": "2 eggs with 2 pav",
      "calories": 420,
      "protein_g": 18,
      "carbs_g": 44,
      "fat_g": 19,
      "fiber_g": 3
    },
    "id": "8aabb3c1-c46a-5fc6-9b2d-ee490eeb9dda"
  },
  {
    "name": "Egg White Bhurji with Veggies",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 15,
    "serves": 1,
    "ingredients": [
      {
        "item": "Egg whites",
        "qty": "6"
      },
      {
        "item": "Whole egg",
        "qty": "1"
      },
      {
        "item": "Onion",
        "qty": "1/2 small chopped"
      },
      {
        "item": "Tomato",
        "qty": "1/2 chopped"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Heat the oil and saute onion and green chilli for 2 minutes.",
      "Add tomato, turmeric, a pinch of chilli powder and salt and cook until soft.",
      "Whisk the egg whites with the whole egg and pour into the pan.",
      "Stir continuously on medium heat until the eggs are scrambled and just set.",
      "Finish with coriander and serve with 1 phulka or on its own."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 225,
      "protein_g": 28,
      "carbs_g": 5,
      "fat_g": 10,
      "fiber_g": 1
    },
    "focus": [
      "high-protein"
    ],
    "id": "5dcd4783-412d-5af8-8a3c-97fd0e1bac47"
  },
  {
    "name": "Chicken Tikka Salad Bowl",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "150 g cubed"
      },
      {
        "item": "Hung curd",
        "qty": "3 tbsp"
      },
      {
        "item": "Tandoori masala",
        "qty": "1 tsp"
      },
      {
        "item": "Cucumber, tomato, onion",
        "qty": "1 katori chopped"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Mix chicken with hung curd, tandoori masala, lemon juice, ginger-garlic paste and salt.",
      "Marinate for at least 20 minutes.",
      "Cook on a hot non-stick pan with the oil until charred and cooked through, about 8 minutes.",
      "Toss cucumber, tomato and onion with salt, pepper and lemon juice.",
      "Top the salad with the hot chicken tikka and mint chutney."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 275,
      "protein_g": 38,
      "carbs_g": 8,
      "fat_g": 10,
      "fiber_g": 2
    },
    "focus": [
      "high-protein"
    ],
    "id": "8b41f12f-5911-5295-b5f3-e41903e50e82"
  },
  {
    "name": "Low-Fat Paneer Tikka (8 pieces)",
    "region": "North",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Low-fat paneer",
        "qty": "150 g in 8 cubes"
      },
      {
        "item": "Capsicum and onion",
        "qty": "1/2 katori squares"
      },
      {
        "item": "Hung curd",
        "qty": "2 tbsp"
      },
      {
        "item": "Tandoori masala",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Mix hung curd with tandoori masala, ginger-garlic paste, lemon juice and salt.",
      "Coat the paneer, capsicum and onion and rest for 15 minutes.",
      "Thread onto skewers alternating paneer and vegetables.",
      "Cook on a hot pan or grill with the oil for 8 minutes, turning on all sides.",
      "Sprinkle chaat masala and serve with mint chutney."
    ],
    "macros": {
      "per": "8 pieces",
      "calories": 290,
      "protein_g": 28,
      "carbs_g": 9,
      "fat_g": 15,
      "fiber_g": 2
    },
    "focus": [
      "high-protein"
    ],
    "id": "013e4f41-839d-51f4-9150-7e109e0e642f"
  },
  {
    "name": "Andhra Soya Chunks Fry",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 1,
    "ingredients": [
      {
        "item": "Soya chunks (dry)",
        "qty": "40 g (about 1 handful)"
      },
      {
        "item": "Onion",
        "qty": "1/2 sliced"
      },
      {
        "item": "Tomato",
        "qty": "1/2 chopped"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      },
      {
        "item": "Red chilli powder",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Boil the soya chunks for 5 minutes, then squeeze out all the water.",
      "Heat oil and crackle mustard seeds, curry leaves and green chilli.",
      "Add onion and tomato and cook until soft with turmeric and chilli powder.",
      "Add the soya chunks and salt and fry on medium heat for 8 minutes until the edges crisp.",
      "Finish with a squeeze of lemon and serve."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 225,
      "protein_g": 22,
      "carbs_g": 22,
      "fat_g": 5.5,
      "fiber_g": 7
    },
    "focus": [
      "high-protein"
    ],
    "id": "9ac8e48e-142a-56fe-8c1e-219f10c4c597"
  },
  {
    "name": "Moong Dal Chilla (2) with Paneer Stuffing",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Yellow moong dal (soaked)",
        "qty": "1/2 katori"
      },
      {
        "item": "Paneer, crumbled",
        "qty": "40 g"
      },
      {
        "item": "Green chilli and ginger",
        "qty": "1 tsp paste"
      },
      {
        "item": "Coriander",
        "qty": "1 handful"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Soak the moong dal for 3 hours and grind with ginger, green chilli and salt into a smooth batter.",
      "Spread half the batter on a hot non-stick tawa into a thin round.",
      "Drizzle oil and cook until the underside is golden.",
      "Spread crumbled paneer mixed with coriander and chaat masala in the centre and fold.",
      "Repeat for the second chilla and serve with mint chutney."
    ],
    "macros": {
      "per": "2 chillas",
      "calories": 355,
      "protein_g": 21.5,
      "carbs_g": 37,
      "fat_g": 13.5,
      "fiber_g": 10
    },
    "focus": [
      "high-fiber"
    ],
    "id": "58564301-3cde-5420-9d94-e42a3db41c98"
  },
  {
    "name": "Kala Chana Chaat Bowl",
    "region": "North",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 1,
    "ingredients": [
      {
        "item": "Boiled kala chana",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1/2 chopped"
      },
      {
        "item": "Cucumber",
        "qty": "1/4 chopped"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      },
      {
        "item": "Chaat masala",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Pressure cook soaked kala chana with salt until soft and drain well.",
      "Add chopped onion, tomato, cucumber and green chilli to a bowl.",
      "Add the warm chana and mix.",
      "Squeeze lemon, add chaat masala and roasted cumin powder.",
      "Garnish with coriander and eat immediately."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 405,
      "protein_g": 20.5,
      "carbs_g": 66,
      "fat_g": 6.5,
      "fiber_g": 18
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "7c38d95e-3bbd-5230-a7ea-3ae850f7f566"
  },
  {
    "name": "Chettinad Pepper Chicken",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "150 g cubed"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Crushed black pepper",
        "qty": "1.5 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "10"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Marinate chicken with turmeric, ginger-garlic paste and salt for 10 minutes.",
      "Heat oil, add fennel and curry leaves and fry the onion until golden.",
      "Add the chicken and cook on medium heat until it turns white.",
      "Add crushed pepper, a splash of water and cover for 5 minutes.",
      "Cook uncovered until dry and glossy and serve with a squeeze of lemon."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 240,
      "protein_g": 35,
      "carbs_g": 6,
      "fat_g": 8.5,
      "fiber_g": 1.5
    },
    "focus": [
      "high-protein"
    ],
    "id": "e7886f95-be32-58d6-b01c-ad5224cdc364"
  },
  {
    "name": "Tandoori Fish Tikka",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Surmai or basa fish pieces",
        "qty": "150 g"
      },
      {
        "item": "Hung curd",
        "qty": "2 tbsp"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "1 tsp"
      },
      {
        "item": "Ajwain",
        "qty": "1/4 tsp"
      },
      {
        "item": "Lemon juice",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Pat the fish dry and rub with lemon juice and salt for 10 minutes.",
      "Mix hung curd, chilli powder, ajwain, ginger-garlic paste and besan.",
      "Coat the fish well and marinate for 20 minutes.",
      "Cook on a hot greased pan or grill for 4 minutes per side.",
      "Serve hot with onion rings and mint chutney."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 225,
      "protein_g": 33,
      "carbs_g": 3,
      "fat_g": 9,
      "fiber_g": 0.5
    },
    "focus": [
      "high-protein"
    ],
    "id": "43b3c555-d1ef-526f-978c-b4b233099f73"
  },
  {
    "name": "Chicken Yakhni Soup",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "100 g"
      },
      {
        "item": "Carrot, beans, cabbage",
        "qty": "1 katori chopped"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Pepper",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      },
      {
        "item": "Water",
        "qty": "2.5 katori"
      }
    ],
    "steps": [
      "Boil the chicken with garlic, pepper, bay leaf and salt in water for 15 minutes.",
      "Remove and shred the chicken and keep the stock.",
      "Saute the vegetables in ghee for 2 minutes.",
      "Add the stock and simmer until the vegetables are tender.",
      "Return the chicken, add a squeeze of lemon and serve hot."
    ],
    "macros": {
      "per": "1 large bowl",
      "calories": 200,
      "protein_g": 25,
      "carbs_g": 9,
      "fat_g": 7,
      "fiber_g": 3
    },
    "focus": [
      "high-protein"
    ],
    "id": "3ab5ab0c-82e9-515b-8928-e043db80b1db"
  },
  {
    "name": "Egg White Curry",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Boiled whole eggs",
        "qty": "2"
      },
      {
        "item": "Boiled egg whites",
        "qty": "4"
      },
      {
        "item": "Onion",
        "qty": "1 medium"
      },
      {
        "item": "Tomato",
        "qty": "1 medium"
      },
      {
        "item": "Curry masala",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Heat oil and saute onion and ginger-garlic paste until golden.",
      "Add tomato, curry masala, turmeric and salt and cook to a thick masala.",
      "Add half a katori of water and simmer for 5 minutes.",
      "Add the halved eggs and egg whites and coat gently.",
      "Simmer for 3 minutes and garnish with coriander."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 290,
      "protein_g": 26,
      "carbs_g": 11.5,
      "fat_g": 15.5,
      "fiber_g": 2.5
    },
    "focus": [
      "high-protein"
    ],
    "id": "a8f1bf79-ddcd-5b37-b71f-f3793cbc2d6d"
  },
  {
    "name": "Lean Chicken Keema Matar",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chicken breast mince",
        "qty": "150 g"
      },
      {
        "item": "Green peas",
        "qty": "1/4 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1/2 chopped"
      },
      {
        "item": "Garam masala",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Heat oil and saute onion with ginger-garlic paste until golden.",
      "Add tomato, turmeric, chilli and coriander powder and cook until soft.",
      "Add the chicken mince and cook on high heat for 6 minutes, breaking up lumps.",
      "Add peas and a splash of water and cover for 8 minutes.",
      "Finish with garam masala and coriander."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 280,
      "protein_g": 37,
      "carbs_g": 14,
      "fat_g": 8.5,
      "fiber_g": 4
    },
    "focus": [
      "high-protein"
    ],
    "id": "b4939a3c-bb3c-5c92-8472-c561482b0dce"
  },
  {
    "name": "Dal Palak",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Toor dal (cooked)",
        "qty": "1.5 katori"
      },
      {
        "item": "Spinach",
        "qty": "1 katori chopped"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Cumin",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Pressure cook toor dal with turmeric until soft and mash lightly.",
      "Heat ghee and splutter cumin, garlic and dry red chilli.",
      "Add the chopped spinach and cook for 2 minutes until wilted.",
      "Add the dal and salt and simmer for 5 minutes.",
      "Finish with lemon juice and serve with rice or roti."
    ],
    "macros": {
      "per": "1.5 katori",
      "calories": 250,
      "protein_g": 13,
      "carbs_g": 34,
      "fat_g": 7,
      "fiber_g": 9
    },
    "focus": [
      "high-fiber"
    ],
    "id": "a72bc872-a666-540c-ad62-481b251f4549"
  },
  {
    "name": "Tofu Bhurji",
    "region": "West",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 1,
    "ingredients": [
      {
        "item": "Firm tofu, crumbled",
        "qty": "200 g"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1/2 chopped"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Turmeric",
        "qty": "1/4 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Press the tofu to remove water and crumble it.",
      "Heat oil and saute onion and green chilli until soft.",
      "Add tomato, turmeric, chilli powder and salt and cook for 2 minutes.",
      "Add the tofu and toss on medium heat for 5 minutes.",
      "Finish with kasuri methi and coriander."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 305,
      "protein_g": 26,
      "carbs_g": 9,
      "fat_g": 18.5,
      "fiber_g": 2.5
    },
    "focus": [
      "high-protein"
    ],
    "id": "cdd768d5-f70f-553f-80fa-e9a09e885c05"
  },
  {
    "name": "Whey Protein Lassi",
    "region": "North",
    "type": "Veg",
    "time_minutes": 5,
    "serves": 1,
    "ingredients": [
      {
        "item": "Toned curd",
        "qty": "1 katori"
      },
      {
        "item": "Whey protein (vanilla)",
        "qty": "1 scoop (30 g)"
      },
      {
        "item": "Cold water",
        "qty": "1/2 katori"
      },
      {
        "item": "Cardamom powder",
        "qty": "a pinch"
      }
    ],
    "steps": [
      "Add curd, whey, cold water and cardamom to a blender.",
      "Blend for 20 seconds until smooth.",
      "Add ice if you like it thick and cold.",
      "Pour into a glass.",
      "Drink within 30 minutes of your workout."
    ],
    "macros": {
      "per": "1 large glass",
      "calories": 210,
      "protein_g": 29,
      "carbs_g": 10,
      "fat_g": 6,
      "fiber_g": 0
    },
    "focus": [
      "high-protein"
    ],
    "id": "ebb0712d-7d9f-5f88-9dab-e44f5b263f10"
  },
  {
    "name": "Peanut Butter Banana Oats Protein Shake",
    "region": "South",
    "type": "Veg",
    "time_minutes": 5,
    "serves": 1,
    "ingredients": [
      {
        "item": "Banana",
        "qty": "1 medium"
      },
      {
        "item": "Rolled oats",
        "qty": "3 tbsp (40 g)"
      },
      {
        "item": "Toned milk",
        "qty": "1 glass (250 ml)"
      },
      {
        "item": "Peanut butter",
        "qty": "2 tbsp"
      },
      {
        "item": "Whey protein",
        "qty": "1 scoop (30 g)"
      }
    ],
    "steps": [
      "Add the banana, oats, milk and peanut butter to a blender.",
      "Add the whey scoop.",
      "Blend for 40 seconds until completely smooth.",
      "Add a few ice cubes if you want it thicker.",
      "Drink right away as a bulking meal or pre-workout shake."
    ],
    "macros": {
      "per": "1 large glass (about 450 ml)",
      "calories": 705,
      "protein_g": 46,
      "carbs_g": 70,
      "fat_g": 27,
      "fiber_g": 5
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "1acb51b5-4b59-5a19-8d10-642d1b92c0af"
  },
  {
    "name": "Andhra Chicken Rice Bowl",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "200 g cubed"
      },
      {
        "item": "Cooked rice",
        "qty": "2 katori"
      },
      {
        "item": "Carrot and beans",
        "qty": "1/2 katori chopped"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Red chilli powder",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Marinate chicken with chilli powder, turmeric, ginger-garlic paste and salt for 10 minutes.",
      "Heat oil and fry onion and curry leaves until golden.",
      "Add the chicken and vegetables and cook covered for 12 minutes until tender.",
      "Cook uncovered until the masala coats the chicken.",
      "Serve over the steamed rice with a lemon wedge."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 595,
      "protein_g": 52,
      "carbs_g": 74,
      "fat_g": 10,
      "fiber_g": 5
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "e812d854-b253-5e40-87b5-ea8d38a8c2ee"
  },
  {
    "name": "Desi Egg Fried Rice",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 20,
    "serves": 1,
    "ingredients": [
      {
        "item": "Cooked rice (cold)",
        "qty": "2 katori"
      },
      {
        "item": "Eggs",
        "qty": "3"
      },
      {
        "item": "Carrot, beans, capsicum",
        "qty": "1/2 katori chopped"
      },
      {
        "item": "Spring onion",
        "qty": "2 stalks"
      },
      {
        "item": "Soy sauce",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Heat the oil on high and scramble the eggs with a pinch of salt; set aside.",
      "Stir-fry the chopped vegetables for 2 minutes keeping them crunchy.",
      "Add the cold rice and toss on high heat.",
      "Add soy sauce, pepper and the scrambled egg.",
      "Finish with spring onion greens and serve hot."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 620,
      "protein_g": 24,
      "carbs_g": 73,
      "fat_g": 25.5,
      "fiber_g": 4
    },
    "focus": [
      "high-carb"
    ],
    "id": "ec00461f-8375-5917-8d2e-7d0c22a56140"
  },
  {
    "name": "High-Protein Paneer Pulao",
    "region": "North",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Cooked basmati rice",
        "qty": "2 katori"
      },
      {
        "item": "Paneer",
        "qty": "100 g cubed"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1/2 katori"
      },
      {
        "item": "Whole spices (bay leaf, cumin, cloves)",
        "qty": "1 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Lightly sear the paneer cubes in a dry non-stick pan until golden.",
      "Heat ghee and add the whole spices and vegetables.",
      "Cook for 3 minutes with salt and garam masala.",
      "Add the rice and paneer and toss gently.",
      "Cover for 2 minutes and serve with raita."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 620,
      "protein_g": 25,
      "carbs_g": 72,
      "fat_g": 26,
      "fiber_g": 4
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "179208af-3680-52dd-91f8-7cd98a58e6c8"
  },
  {
    "name": "Rajma Chawal Gym Bowl",
    "region": "North",
    "type": "Veg",
    "time_minutes": 50,
    "serves": 1,
    "ingredients": [
      {
        "item": "Boiled rajma",
        "qty": "1.5 katori"
      },
      {
        "item": "Cooked rice",
        "qty": "2 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Rajma masala",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tbsp"
      }
    ],
    "steps": [
      "Fry onion in oil until golden and add ginger-garlic paste.",
      "Add pureed tomato and rajma masala and cook until the oil separates.",
      "Add the boiled rajma with some cooking water and simmer for 15 minutes, mashing a few beans.",
      "Adjust salt and garnish with coriander.",
      "Serve over the steamed rice."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 705,
      "protein_g": 25,
      "carbs_g": 117,
      "fat_g": 15,
      "fiber_g": 17
    },
    "focus": [
      "high-protein",
      "high-carb",
      "high-fiber"
    ],
    "id": "13b9cfe4-68da-556e-a94e-c46e62e7877d"
  },
  {
    "name": "Chole with 2 Phulka",
    "region": "North",
    "type": "Veg",
    "time_minutes": 45,
    "serves": 1,
    "ingredients": [
      {
        "item": "Boiled chickpeas",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2"
      },
      {
        "item": "Tomato",
        "qty": "1"
      },
      {
        "item": "Chole masala",
        "qty": "2 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      },
      {
        "item": "Phulka",
        "qty": "2"
      }
    ],
    "steps": [
      "Heat oil and saute onion until golden with ginger-garlic paste.",
      "Add tomato, chole masala, chilli and salt and cook until thick.",
      "Add the boiled chickpeas with a little water.",
      "Simmer for 12 minutes, mashing a few chana to thicken the gravy.",
      "Serve with the hot phulkas and an onion salad."
    ],
    "macros": {
      "per": "1 plate with 2 phulka",
      "calories": 700,
      "protein_g": 27,
      "carbs_g": 107,
      "fat_g": 18,
      "fiber_g": 23
    },
    "focus": [
      "high-protein",
      "high-carb",
      "high-fiber"
    ],
    "id": "2cbeb43a-f3f7-50d5-bfee-6a7994b3affb"
  },
  {
    "name": "Sattu Paratha (2) Gym Plate",
    "region": "East",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Atta",
        "qty": "1/2 katori"
      },
      {
        "item": "Sattu",
        "qty": "4 tbsp (60 g)"
      },
      {
        "item": "Onion",
        "qty": "1/2 small chopped"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Mustard oil",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Knead a soft dough with the atta, salt and water and rest it.",
      "Mix sattu with onion, chilli, ajwain, lemon, salt and mustard oil.",
      "Stuff half the sattu into each dough ball and roll out gently.",
      "Cook on a hot tawa with ghee until golden on both sides.",
      "Serve with a katori of curd or pickle."
    ],
    "macros": {
      "per": "2 parathas",
      "calories": 580,
      "protein_g": 21,
      "carbs_g": 90,
      "fat_g": 15,
      "fiber_g": 12
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "7aa768a7-edef-58d1-a754-7c86153a47a5"
  },
  {
    "name": "Ragi Mudde with Chicken Curry",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 45,
    "serves": 1,
    "ingredients": [
      {
        "item": "Ragi flour",
        "qty": "1 katori (80 g)"
      },
      {
        "item": "Chicken breast",
        "qty": "150 g"
      },
      {
        "item": "Onion",
        "qty": "1/2"
      },
      {
        "item": "Tomato",
        "qty": "1/2"
      },
      {
        "item": "Curry masala",
        "qty": "1 tbsp"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Boil water with salt, add the ragi flour in the centre and cook covered for 3 minutes.",
      "Stir vigorously into a smooth dough and shape into a ball.",
      "Saute onion and tomato in oil with masala and ginger-garlic paste.",
      "Add the chicken and half a katori water and cook until tender.",
      "Serve the mudde with the hot chicken curry."
    ],
    "macros": {
      "per": "1 ball with 1 katori curry",
      "calories": 555,
      "protein_g": 40,
      "carbs_g": 66,
      "fat_g": 14.5,
      "fiber_g": 11
    },
    "focus": [
      "high-protein",
      "high-carb",
      "high-fiber"
    ],
    "id": "56be63dc-e469-5606-9773-5f4ad6120de7"
  },
  {
    "name": "Lean Chicken Pulao",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 40,
    "serves": 1,
    "ingredients": [
      {
        "item": "Basmati rice (cooked)",
        "qty": "2 katori"
      },
      {
        "item": "Chicken breast",
        "qty": "150 g"
      },
      {
        "item": "Onion",
        "qty": "1/2 sliced"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1/4 katori"
      },
      {
        "item": "Whole spices",
        "qty": "1 tsp"
      },
      {
        "item": "Ghee",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Heat ghee and fry whole spices and the sliced onion until golden.",
      "Add the chicken, ginger-garlic paste, vegetables and salt.",
      "Cook covered until the chicken is done, about 12 minutes.",
      "Fold in the cooked rice and garam masala.",
      "Rest for 3 minutes and serve with cucumber raita."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 570,
      "protein_g": 41,
      "carbs_g": 72,
      "fat_g": 13,
      "fiber_g": 3
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "2456c91b-712f-53c5-80ea-a47d009c8937"
  },
  {
    "name": "Egg Dalia Upma",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 25,
    "serves": 1,
    "ingredients": [
      {
        "item": "Dalia (broken wheat)",
        "qty": "1/2 katori"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1/2 katori"
      },
      {
        "item": "Mustard seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "6"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Heat oil and crackle mustard seeds, curry leaves and green chilli.",
      "Add vegetables and the dalia and roast for 2 minutes.",
      "Add 1.5 katori hot water and salt and cook covered until the dalia is soft.",
      "Scramble the eggs in a corner of the pan and mix them through.",
      "Garnish with coriander and serve."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 425,
      "protein_g": 19,
      "carbs_g": 51,
      "fat_g": 16,
      "fiber_g": 9
    },
    "focus": [
      "high-fiber"
    ],
    "id": "c544e389-6c53-50fa-b29e-0920927068c0"
  },
  {
    "name": "Dalia Moong Khichdi",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Dalia",
        "qty": "1/3 katori (50 g)"
      },
      {
        "item": "Yellow moong dal",
        "qty": "1/4 katori"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1/2 katori"
      },
      {
        "item": "Cumin",
        "qty": "1/2 tsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/4 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Wash the dalia and moong dal together.",
      "Heat ghee and splutter cumin and ginger.",
      "Add the vegetables, dal, dalia, turmeric and salt with 2.5 katori water.",
      "Pressure cook for 3 whistles until soft.",
      "Serve hot with curd or pickle."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 390,
      "protein_g": 16,
      "carbs_g": 67,
      "fat_g": 6.5,
      "fiber_g": 15
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "3fb951e0-0777-5a23-b2c2-237be1ff1d07"
  },
  {
    "name": "Oats Upma with Peanuts",
    "region": "South",
    "type": "Veg",
    "time_minutes": 15,
    "serves": 1,
    "ingredients": [
      {
        "item": "Rolled oats",
        "qty": "4 tbsp (60 g)"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1/2 katori"
      },
      {
        "item": "Peanuts",
        "qty": "2 tsp"
      },
      {
        "item": "Mustard seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "6"
      },
      {
        "item": "Oil",
        "qty": "1.5 tsp"
      }
    ],
    "steps": [
      "Dry roast the oats for 2 minutes and set aside.",
      "Heat oil and crackle mustard, peanuts, curry leaves and green chilli.",
      "Add vegetables with salt and half a katori of water and cook until soft.",
      "Add the oats and mix until the water is absorbed.",
      "Finish with lemon juice and coriander."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 360,
      "protein_g": 11,
      "carbs_g": 47,
      "fat_g": 14,
      "fiber_g": 9
    },
    "focus": [
      "high-fiber"
    ],
    "id": "af21a205-35af-5a45-8249-9c535be687d4"
  },
  {
    "name": "Masala Oats with 3 Eggs",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 15,
    "serves": 1,
    "ingredients": [
      {
        "item": "Rolled oats",
        "qty": "1/3 katori (50 g)"
      },
      {
        "item": "Eggs",
        "qty": "3"
      },
      {
        "item": "Onion, tomato, capsicum",
        "qty": "1/2 katori chopped"
      },
      {
        "item": "Turmeric and chilli powder",
        "qty": "1/4 tsp each"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Cook the oats in 1 katori water with salt until soft and creamy.",
      "Heat oil and saute onion, tomato and capsicum with the spices.",
      "Add the cooked oats and mix.",
      "Make a well, crack in the eggs and scramble into the oats.",
      "Cook for 2 minutes and finish with coriander."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 470,
      "protein_g": 25,
      "carbs_g": 38.5,
      "fat_g": 24,
      "fiber_g": 7
    },
    "focus": [
      "high-protein"
    ],
    "id": "834a4aa8-b77d-53c1-a641-2167221688a7"
  },
  {
    "name": "Ragi Idli (4 pieces)",
    "region": "South",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 2,
    "ingredients": [
      {
        "item": "Ragi flour",
        "qty": "1 katori (80 g)"
      },
      {
        "item": "Urad dal (soaked, ground)",
        "qty": "1/4 katori"
      },
      {
        "item": "Curd",
        "qty": "2 tbsp"
      },
      {
        "item": "Eno or baking soda",
        "qty": "1/2 tsp"
      },
      {
        "item": "Salt",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Grind the soaked urad dal into a fluffy batter and mix with ragi flour, curd and salt.",
      "Rest for 6 to 8 hours to ferment slightly.",
      "Add the Eno just before steaming and mix gently.",
      "Pour into greased idli moulds.",
      "Steam for 12 minutes and serve with peanut chutney and sambar."
    ],
    "macros": {
      "per": "4 idlis",
      "calories": 290,
      "protein_g": 10,
      "carbs_g": 57,
      "fat_g": 2.5,
      "fiber_g": 9
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "c5ab61ed-b93b-50ca-812c-de691da891d7"
  },
  {
    "name": "Jowar Bhakri (2) with Dal Palak",
    "region": "West",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 1,
    "ingredients": [
      {
        "item": "Jowar flour",
        "qty": "1 katori (80 g)"
      },
      {
        "item": "Toor dal (cooked)",
        "qty": "1 katori"
      },
      {
        "item": "Spinach",
        "qty": "1/2 katori chopped"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Knead jowar flour with hot water and salt into a soft dough.",
      "Pat into thin rounds and cook on a hot tawa, finishing on the flame.",
      "Temper ghee with garlic and cumin and add the spinach.",
      "Add the cooked dal and simmer for 5 minutes.",
      "Serve the bhakri with the dal palak."
    ],
    "macros": {
      "per": "2 bhakri with 1 katori dal",
      "calories": 450,
      "protein_g": 17,
      "carbs_g": 80,
      "fat_g": 7,
      "fiber_g": 14
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "b7fdf648-cbc3-5acf-92b4-39363379d16c"
  },
  {
    "name": "Bajra Moong Khichdi",
    "region": "West",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 1,
    "ingredients": [
      {
        "item": "Bajra (soaked 4 hours)",
        "qty": "1/3 katori (60 g)"
      },
      {
        "item": "Yellow moong dal",
        "qty": "1/4 katori"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1/2 katori"
      },
      {
        "item": "Cumin",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Coarsely crush the soaked bajra and wash with the moong dal.",
      "Heat ghee and splutter cumin, ginger and green chilli.",
      "Add the vegetables, bajra, dal, turmeric and salt.",
      "Add 3 katori water and pressure cook for 4 whistles.",
      "Mash lightly and serve with curd and a spoon of ghee."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 420,
      "protein_g": 17,
      "carbs_g": 68,
      "fat_g": 9,
      "fiber_g": 15
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "2948b4f7-8c94-5a10-ba8a-a5c77fa044a3"
  },
  {
    "name": "Quinoa Paneer Pulao",
    "region": "West",
    "type": "Veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Cooked quinoa",
        "qty": "1.5 katori"
      },
      {
        "item": "Paneer",
        "qty": "50 g cubed"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1/2 katori"
      },
      {
        "item": "Cumin",
        "qty": "1/2 tsp"
      },
      {
        "item": "Garam masala",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Rinse the quinoa well and cook it with 2 parts water and salt until fluffy.",
      "Heat oil and splutter cumin, then add vegetables and cook for 3 minutes.",
      "Add the paneer cubes and garam masala.",
      "Fold in the quinoa gently.",
      "Cover for 2 minutes and serve with raita."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 465,
      "protein_g": 20,
      "carbs_g": 54,
      "fat_g": 19,
      "fiber_g": 8
    },
    "focus": [
      "high-fiber"
    ],
    "id": "173b4acd-b420-5191-b5e4-bd014fcccaea"
  },
  {
    "name": "Soya Chunks Pulao",
    "region": "South",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 1,
    "ingredients": [
      {
        "item": "Soya chunks (dry)",
        "qty": "50 g"
      },
      {
        "item": "Cooked basmati rice",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2 sliced"
      },
      {
        "item": "Curd",
        "qty": "2 tbsp"
      },
      {
        "item": "Biryani masala",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Boil the soya chunks for 5 minutes and squeeze out the water.",
      "Marinate with curd, biryani masala, ginger-garlic paste and salt.",
      "Fry onion in oil until golden, add the soya and cook for 8 minutes.",
      "Fold in the cooked rice with mint and coriander.",
      "Cover and rest for 5 minutes before serving."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 585,
      "protein_g": 33,
      "carbs_g": 86,
      "fat_g": 12,
      "fiber_g": 9
    },
    "focus": [
      "high-protein",
      "high-carb",
      "high-fiber"
    ],
    "id": "07a9fb17-8be7-504a-a93f-1d60e6cc97f2"
  },
  {
    "name": "Paneer Bhurji Roti Wrap",
    "region": "West",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 1,
    "ingredients": [
      {
        "item": "Paneer, crumbled",
        "qty": "100 g"
      },
      {
        "item": "Phulka",
        "qty": "2"
      },
      {
        "item": "Onion and tomato",
        "qty": "1/2 katori chopped"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Heat oil and saute onion and green chilli until soft.",
      "Add tomato, turmeric and salt and cook for 2 minutes.",
      "Add the crumbled paneer and toss for 3 minutes.",
      "Place the bhurji on warm phulkas with mint chutney.",
      "Roll tightly and serve."
    ],
    "macros": {
      "per": "2 wraps",
      "calories": 510,
      "protein_g": 25,
      "carbs_g": 44,
      "fat_g": 26,
      "fiber_g": 5
    },
    "focus": [
      "high-protein"
    ],
    "id": "9403da83-f766-5bf7-8abc-76be880654ab"
  },
  {
    "name": "Besan Chilla (3) with Hung Curd",
    "region": "North",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 1,
    "ingredients": [
      {
        "item": "Besan",
        "qty": "1/2 katori (60 g)"
      },
      {
        "item": "Chopped onion, tomato, coriander",
        "qty": "1/2 katori"
      },
      {
        "item": "Ajwain",
        "qty": "1/4 tsp"
      },
      {
        "item": "Hung curd",
        "qty": "1/2 katori"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Whisk besan with water, salt, turmeric and ajwain into a smooth batter.",
      "Stir in the chopped vegetables and green chilli.",
      "Pour three small rounds onto a hot non-stick tawa with a few drops of oil.",
      "Cook until golden on both sides.",
      "Serve with the hung curd on the side."
    ],
    "macros": {
      "per": "3 chillas with curd",
      "calories": 375,
      "protein_g": 21,
      "carbs_g": 44,
      "fat_g": 13,
      "fiber_g": 8
    },
    "focus": [
      "high-fiber"
    ],
    "id": "48a99e5d-0838-5c9f-9a57-51b206d21e72"
  },
  {
    "name": "Poha with Sprouts and Peanuts",
    "region": "West",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 1,
    "ingredients": [
      {
        "item": "Thick poha",
        "qty": "1 katori (60 g)"
      },
      {
        "item": "Moong sprouts",
        "qty": "1/2 katori"
      },
      {
        "item": "Roasted peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Mustard seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Rinse the poha and let it soften for 5 minutes with salt and turmeric.",
      "Heat oil and crackle mustard, curry leaves and onion until soft.",
      "Add the sprouts with a splash of water and cook for 4 minutes.",
      "Add the poha and peanuts and mix gently.",
      "Finish with lemon juice and coriander."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 430,
      "protein_g": 13,
      "carbs_g": 61,
      "fat_g": 15,
      "fiber_g": 7
    },
    "focus": [
      "high-carb"
    ],
    "id": "a85e2f39-6699-5e25-bd54-2c9a27d8fbd4"
  },
  {
    "name": "Chicken Tikka Roti Wrap",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "120 g"
      },
      {
        "item": "Hung curd",
        "qty": "2 tbsp"
      },
      {
        "item": "Tandoori masala",
        "qty": "1 tsp"
      },
      {
        "item": "Phulka",
        "qty": "2"
      },
      {
        "item": "Onion and mint chutney",
        "qty": "1 tbsp each"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Marinate the chicken with curd, tandoori masala, lemon and salt for 20 minutes.",
      "Cook in a hot pan with oil until charred and fully cooked.",
      "Warm the phulkas on a tawa.",
      "Spread mint chutney and place the sliced chicken with onions.",
      "Roll up and serve."
    ],
    "macros": {
      "per": "2 wraps",
      "calories": 415,
      "protein_g": 36,
      "carbs_g": 41,
      "fat_g": 12,
      "fiber_g": 5
    },
    "focus": [
      "high-protein"
    ],
    "id": "70510969-ec6b-521d-9aaf-437a5cf57691"
  },
  {
    "name": "Tuna Chana Chaat",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 10,
    "serves": 1,
    "ingredients": [
      {
        "item": "Canned tuna in water",
        "qty": "100 g drained"
      },
      {
        "item": "Boiled chickpeas",
        "qty": "1/2 katori"
      },
      {
        "item": "Onion, tomato, cucumber",
        "qty": "1/2 katori chopped"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      },
      {
        "item": "Olive oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Drain the tuna and flake it with a fork.",
      "Combine with the boiled chickpeas and chopped vegetables.",
      "Add green chilli, coriander and chaat masala.",
      "Drizzle olive oil and lemon juice.",
      "Toss and serve immediately."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 295,
      "protein_g": 31,
      "carbs_g": 25,
      "fat_g": 8,
      "fiber_g": 7
    },
    "focus": [
      "high-protein"
    ],
    "id": "cd5d9a06-2711-5524-8d03-aea6b73d3032"
  },
  {
    "name": "Kerala Fish Curry with Rice (Gym Portion)",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 1,
    "ingredients": [
      {
        "item": "Fish pieces (seer or rohu)",
        "qty": "200 g"
      },
      {
        "item": "Cooked rice",
        "qty": "2 katori"
      },
      {
        "item": "Coconut, grated",
        "qty": "2 tbsp"
      },
      {
        "item": "Kashmiri chilli powder",
        "qty": "1 tsp"
      },
      {
        "item": "Kudampuli or tamarind",
        "qty": "1 piece"
      },
      {
        "item": "Coconut oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Heat coconut oil and saute shallots, ginger and curry leaves.",
      "Add chilli powder, turmeric and coriander powder for a minute on low heat.",
      "Add the coconut paste, kudampuli, salt and a katori water and bring to a boil.",
      "Slide in the fish and simmer for 10 minutes.",
      "Serve with the steamed rice."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 560,
      "protein_g": 40,
      "carbs_g": 70,
      "fat_g": 13.5,
      "fiber_g": 4
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "f3ae2fec-df94-5325-b5a0-c4c4f92995c9"
  },
  {
    "name": "Royyala Iguru with Brown Rice",
    "region": "South",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Prawns, cleaned",
        "qty": "150 g"
      },
      {
        "item": "Brown rice (cooked)",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1/2"
      },
      {
        "item": "Curry leaves",
        "qty": "8"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Marinate the prawns with turmeric, chilli powder and salt for 10 minutes.",
      "Heat oil and fry onion and curry leaves until golden.",
      "Add tomato and cook until soft with coriander powder and chilli.",
      "Add the prawns and cook on high heat for 4 to 5 minutes until dry.",
      "Serve over the brown rice with lemon."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 495,
      "protein_g": 33,
      "carbs_g": 60,
      "fat_g": 13.5,
      "fiber_g": 6
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "c7f6c038-13f3-5d42-863f-380421ef4bd8"
  },
  {
    "name": "Lean Mutton Keema with 2 Phulka",
    "region": "North",
    "type": "Non-veg",
    "time_minutes": 45,
    "serves": 1,
    "ingredients": [
      {
        "item": "Lean mutton keema",
        "qty": "150 g"
      },
      {
        "item": "Green peas",
        "qty": "2 tbsp"
      },
      {
        "item": "Onion",
        "qty": "1/2"
      },
      {
        "item": "Tomato",
        "qty": "1/2"
      },
      {
        "item": "Garam masala",
        "qty": "1/2 tsp"
      },
      {
        "item": "Phulka",
        "qty": "2"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Fry onion in oil with ginger-garlic paste until golden.",
      "Add the keema and cook on high heat until browned and dry.",
      "Add tomato, turmeric, chilli and coriander powder and cook until soft.",
      "Add peas and half a katori of water and cook covered for 20 minutes.",
      "Finish with garam masala and serve with the phulkas."
    ],
    "macros": {
      "per": "1 plate with 2 phulka",
      "calories": 520,
      "protein_g": 38.5,
      "carbs_g": 50,
      "fat_g": 18.5,
      "fiber_g": 7
    },
    "focus": [
      "high-protein"
    ],
    "id": "22229a36-1d78-5278-a8d5-5686dbf13b8c"
  },
  {
    "name": "Bhuna Chana and Peanut Chaat",
    "region": "West",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 1,
    "ingredients": [
      {
        "item": "Roasted chana",
        "qty": "1/3 katori (50 g)"
      },
      {
        "item": "Roasted peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Onion",
        "qty": "1/4 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1/4 chopped"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      },
      {
        "item": "Chaat masala",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Mix the roasted chana and peanuts in a bowl.",
      "Add chopped onion, tomato and green chilli.",
      "Sprinkle chaat masala and salt.",
      "Squeeze the lemon.",
      "Toss and eat right away so it stays crunchy."
    ],
    "macros": {
      "per": "1 bowl",
      "calories": 305,
      "protein_g": 16,
      "carbs_g": 33,
      "fat_g": 12,
      "fiber_g": 11
    },
    "focus": [
      "high-fiber"
    ],
    "id": "bbda648d-e1d1-5008-83a3-7ff4a088243f"
  },
  {
    "name": "Palak Moong Dal Soup",
    "region": "North",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 1,
    "ingredients": [
      {
        "item": "Yellow moong dal",
        "qty": "3 tbsp (40 g)"
      },
      {
        "item": "Spinach",
        "qty": "1 katori chopped"
      },
      {
        "item": "Garlic",
        "qty": "3 cloves"
      },
      {
        "item": "Black pepper",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Pressure cook the moong dal with turmeric and 2 katori water until very soft.",
      "Add the spinach and cook for 2 minutes.",
      "Blend lightly or mash to a thick soup.",
      "Heat ghee and fry garlic and cumin, then pour over the soup.",
      "Finish with pepper and lemon juice."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 200,
      "protein_g": 11,
      "carbs_g": 27,
      "fat_g": 5.5,
      "fiber_g": 9
    },
    "focus": [
      "high-fiber"
    ],
    "id": "d7196a78-20de-54c5-b646-28abf56db68c"
  },
  {
    "name": "Lauki Chana Dal",
    "region": "South",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chana dal",
        "qty": "1/4 katori soaked (50 g)"
      },
      {
        "item": "Lauki (bottle gourd)",
        "qty": "1/2 katori cubed"
      },
      {
        "item": "Tamarind pulp",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard seeds",
        "qty": "1/2 tsp"
      },
      {
        "item": "Curry leaves",
        "qty": "6"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Pressure cook the chana dal with lauki and turmeric until soft.",
      "Add tamarind, salt and chilli powder.",
      "Simmer for 5 minutes.",
      "Heat oil and crackle mustard, cumin, dry red chilli and curry leaves.",
      "Pour the tempering over the dal and serve with 1 phulka."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 260,
      "protein_g": 11,
      "carbs_g": 38,
      "fat_g": 7,
      "fiber_g": 9
    },
    "focus": [
      "high-fiber"
    ],
    "id": "23b4e89b-e38c-5c5c-b863-edcffdde6398"
  },
  {
    "name": "Goan Surmai Recheado Fry",
    "region": "West",
    "type": "Non-veg",
    "time_minutes": 25,
    "serves": 1,
    "ingredients": [
      {
        "item": "Surmai (kingfish) steaks",
        "qty": "150 g"
      },
      {
        "item": "Recheado masala",
        "qty": "1 tsp"
      },
      {
        "item": "Vinegar",
        "qty": "1 tsp"
      },
      {
        "item": "Rava (optional)",
        "qty": "1 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Mix the recheado masala with vinegar and salt.",
      "Rub it all over the fish and marinate for 15 minutes.",
      "Dust lightly with rava for a crisp crust.",
      "Shallow fry in a little oil for 4 minutes per side.",
      "Serve with lemon and a salad."
    ],
    "macros": {
      "per": "1 steak",
      "calories": 215,
      "protein_g": 31,
      "carbs_g": 3,
      "fat_g": 9,
      "fiber_g": 0.5
    },
    "focus": [
      "high-protein"
    ],
    "id": "01363020-7ceb-5302-83bd-76de5be9696f"
  },
  {
    "name": "Oats Peanut Ladoo (2 big)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 20,
    "serves": 1,
    "ingredients": [
      {
        "item": "Rolled oats",
        "qty": "3 tbsp (40 g)"
      },
      {
        "item": "Roasted peanuts",
        "qty": "3 tbsp (30 g)"
      },
      {
        "item": "Jaggery",
        "qty": "1 tbsp (20 g)"
      },
      {
        "item": "Dates",
        "qty": "2"
      },
      {
        "item": "Cardamom powder",
        "qty": "a pinch"
      }
    ],
    "steps": [
      "Dry roast the oats and grind them coarsely.",
      "Grind the peanuts and dates to a coarse paste.",
      "Melt the jaggery with 1 tbsp water and mix in the oats, peanuts and cardamom.",
      "Let it cool until warm.",
      "Shape into two big ladoos and store in an airtight box."
    ],
    "macros": {
      "per": "2 ladoos",
      "calories": 450,
      "protein_g": 13,
      "carbs_g": 61,
      "fat_g": 17,
      "fiber_g": 7
    },
    "focus": [
      "high-carb"
    ],
    "id": "7e4ba3b2-07ed-571c-8e55-d62a2dd99dc9"
  },
  {
    "name": "Kesar Badam Protein Milkshake",
    "region": "West",
    "type": "Veg",
    "time_minutes": 5,
    "serves": 1,
    "ingredients": [
      {
        "item": "Toned milk",
        "qty": "1.5 glass (300 ml)"
      },
      {
        "item": "Whey protein",
        "qty": "1 scoop (30 g)"
      },
      {
        "item": "Rolled oats",
        "qty": "2 tbsp"
      },
      {
        "item": "Dates",
        "qty": "3"
      },
      {
        "item": "Almonds",
        "qty": "8"
      },
      {
        "item": "Saffron",
        "qty": "a few strands"
      }
    ],
    "steps": [
      "Soak the saffron in 2 tbsp warm milk for 5 minutes.",
      "Add milk, whey, oats, dates and almonds to the blender.",
      "Add the saffron milk.",
      "Blend for 40 seconds until smooth.",
      "Serve chilled."
    ],
    "macros": {
      "per": "1 large glass",
      "calories": 525,
      "protein_g": 41,
      "carbs_g": 52,
      "fat_g": 17,
      "fiber_g": 4
    },
    "focus": [
      "high-protein"
    ],
    "id": "8d874153-051c-5cf1-88da-e369701ff8d1"
  },
  {
    "name": "Egg Paratha with Curd",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 25,
    "serves": 1,
    "ingredients": [
      {
        "item": "Atta dough",
        "qty": "1/2 katori flour (70 g)"
      },
      {
        "item": "Eggs",
        "qty": "2"
      },
      {
        "item": "Onion",
        "qty": "1 tbsp chopped"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      },
      {
        "item": "Curd",
        "qty": "1/2 katori"
      }
    ],
    "steps": [
      "Roll out the atta dough into a thin round.",
      "Cook on a tawa with a little oil until half done.",
      "Beat the eggs with onion, green chilli and salt and pour over the paratha.",
      "Fold the edges to seal and cook until the egg is set and the paratha is crisp.",
      "Serve hot with the curd."
    ],
    "macros": {
      "per": "1 large paratha with curd",
      "calories": 535,
      "protein_g": 23.5,
      "carbs_g": 55.5,
      "fat_g": 24.5,
      "fiber_g": 8
    },
    "focus": [
      "high-fiber"
    ],
    "id": "805b53ad-486d-59b0-aa9f-f693e3727921"
  },
  {
    "name": "Moong Dal Dhokla (6 pieces)",
    "region": "West",
    "type": "Veg",
    "time_minutes": 35,
    "serves": 1,
    "ingredients": [
      {
        "item": "Yellow moong dal (soaked 4 hours)",
        "qty": "1/3 katori (80 g)"
      },
      {
        "item": "Curd",
        "qty": "2 tbsp"
      },
      {
        "item": "Ginger and green chilli",
        "qty": "1 tsp paste"
      },
      {
        "item": "Eno",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Grind the soaked moong dal with ginger, green chilli and curd into a smooth batter.",
      "Add salt, turmeric and Eno and mix gently.",
      "Pour into a greased plate and steam for 12 minutes.",
      "Cut into pieces.",
      "Temper with mustard, sesame and curry leaves in oil and pour over."
    ],
    "macros": {
      "per": "6 pieces",
      "calories": 335,
      "protein_g": 20.5,
      "carbs_g": 50,
      "fat_g": 6,
      "fiber_g": 13
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "81237b51-d265-57a2-ae0c-b46e9da00f52"
  },
  {
    "name": "Ragi Dosa (3) with Peanut Chutney",
    "region": "South",
    "type": "Veg",
    "time_minutes": 25,
    "serves": 1,
    "ingredients": [
      {
        "item": "Ragi flour",
        "qty": "1 katori (80 g)"
      },
      {
        "item": "Rice flour",
        "qty": "1 tbsp"
      },
      {
        "item": "Roasted peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Garlic and red chilli",
        "qty": "2 cloves and 2"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Mix ragi flour, rice flour, salt and water into a thin batter and rest for 10 minutes.",
      "Pour onto a hot tawa in a circular motion and drizzle oil.",
      "Cook until crisp and golden and make three dosas.",
      "Grind peanuts with garlic, chilli, tamarind and salt into chutney.",
      "Serve the dosas with the chutney."
    ],
    "macros": {
      "per": "3 dosas with chutney",
      "calories": 470,
      "protein_g": 11,
      "carbs_g": 62,
      "fat_g": 20,
      "fiber_g": 10
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "d386e695-6ff4-52a9-bc90-b63eff20fcd4"
  },
  {
    "name": "Machher Jhol with Rice (Gym Portion)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 35,
    "serves": 1,
    "ingredients": [
      {
        "item": "Rohu pieces",
        "qty": "200 g"
      },
      {
        "item": "Potato",
        "qty": "1 small wedges"
      },
      {
        "item": "Tomato",
        "qty": "1/2"
      },
      {
        "item": "Cooked rice",
        "qty": "1.5 katori"
      },
      {
        "item": "Mustard oil",
        "qty": "1 tsp"
      },
      {
        "item": "Turmeric",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Rub the fish with turmeric and salt and sear lightly in mustard oil.",
      "Fry the potato wedges and add kalonji, ginger and tomato.",
      "Add cumin, chilli and turmeric and cook for 2 minutes.",
      "Add 2 katori water and simmer until the potato is tender.",
      "Add the fish and cook for 5 minutes and serve with rice."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 545,
      "protein_g": 41,
      "carbs_g": 77,
      "fat_g": 8,
      "fiber_g": 4
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "6d91de09-319a-533b-aa22-1dc13819c694"
  },
  {
    "name": "Yellow Pea Ghugni Bowl",
    "region": "East",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 1,
    "ingredients": [
      {
        "item": "Boiled dried yellow peas",
        "qty": "1.5 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2 chopped"
      },
      {
        "item": "Tomato",
        "qty": "1/2 chopped"
      },
      {
        "item": "Ginger paste",
        "qty": "1 tsp"
      },
      {
        "item": "Garam masala",
        "qty": "1/2 tsp"
      },
      {
        "item": "Oil",
        "qty": "2 tsp"
      }
    ],
    "steps": [
      "Heat oil and fry onion until golden with ginger paste.",
      "Add tomato, turmeric, cumin and chilli powder and cook until soft.",
      "Add the boiled peas with a little water.",
      "Simmer for 10 minutes until thick.",
      "Top with onion, lemon, coriander and tamarind chutney."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 425,
      "protein_g": 19.5,
      "carbs_g": 62,
      "fat_g": 11,
      "fiber_g": 15
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "00f04e35-9524-522e-9f92-4e6ab8f47772"
  },
  {
    "name": "High-Protein Egg Roll (3 eggs, Whole Wheat)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 20,
    "serves": 1,
    "ingredients": [
      {
        "item": "Eggs",
        "qty": "3"
      },
      {
        "item": "Atta paratha",
        "qty": "1 large (70 g flour)"
      },
      {
        "item": "Onion",
        "qty": "1/4 sliced"
      },
      {
        "item": "Green chilli",
        "qty": "1"
      },
      {
        "item": "Lemon",
        "qty": "1/2"
      },
      {
        "item": "Oil",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Cook a whole wheat paratha on a tawa until done.",
      "Beat the eggs with salt, chilli and a little onion.",
      "Pour onto the tawa with oil and place the paratha over the egg.",
      "Flip, add onion rings, lemon juice and chaat masala.",
      "Roll tightly and serve."
    ],
    "macros": {
      "per": "1 large roll",
      "calories": 515,
      "protein_g": 26,
      "carbs_g": 54.5,
      "fat_g": 21.5,
      "fiber_g": 8
    },
    "focus": [
      "high-protein",
      "high-fiber"
    ],
    "id": "05d4ca96-2e17-56cc-90ea-8b6c64faee2a"
  },
  {
    "name": "Chicken Thukpa (Whole Wheat Noodles)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Whole wheat noodles",
        "qty": "1 handful (60 g)"
      },
      {
        "item": "Chicken breast",
        "qty": "100 g sliced"
      },
      {
        "item": "Mixed vegetables",
        "qty": "1 katori"
      },
      {
        "item": "Garlic and ginger",
        "qty": "1 tsp each"
      },
      {
        "item": "Soy sauce",
        "qty": "1 tsp"
      },
      {
        "item": "Water or stock",
        "qty": "2.5 katori"
      }
    ],
    "steps": [
      "Boil the noodles until just cooked and drain.",
      "Saute garlic and ginger with a few drops of oil and add the chicken.",
      "Add vegetables and the stock and simmer for 8 minutes.",
      "Season with soy sauce, pepper and salt.",
      "Add the noodles, simmer for 1 minute and serve hot."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 350,
      "protein_g": 30,
      "carbs_g": 49,
      "fat_g": 3.5,
      "fiber_g": 5
    },
    "focus": [
      "high-protein",
      "high-carb"
    ],
    "id": "d395b174-cf74-5385-9185-4b04799921a8"
  },
  {
    "name": "Fish Paturi (Steamed in Mustard)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Bhetki or basa fillet",
        "qty": "200 g"
      },
      {
        "item": "Mustard paste",
        "qty": "1 tbsp"
      },
      {
        "item": "Green chilli",
        "qty": "2"
      },
      {
        "item": "Mustard oil",
        "qty": "1 tsp"
      },
      {
        "item": "Banana leaf",
        "qty": "1 piece"
      }
    ],
    "steps": [
      "Marinate the fish with mustard paste, turmeric, salt and green chilli.",
      "Place on a banana leaf and drizzle mustard oil.",
      "Fold and tie the leaf into a parcel.",
      "Steam for 15 minutes or cook on a covered tawa on low heat.",
      "Serve with a small helping of rice."
    ],
    "macros": {
      "per": "1 fillet",
      "calories": 280,
      "protein_g": 36,
      "carbs_g": 3,
      "fat_g": 14,
      "fiber_g": 1
    },
    "focus": [
      "high-protein"
    ],
    "id": "7c76a0c8-2ae2-5f55-8197-11a9a48a5a8a"
  },
  {
    "name": "Dalma Bowl with Brown Rice",
    "region": "East",
    "type": "Veg",
    "time_minutes": 40,
    "serves": 1,
    "ingredients": [
      {
        "item": "Toor dal (cooked)",
        "qty": "1 katori"
      },
      {
        "item": "Raw banana, pumpkin, brinjal",
        "qty": "1 katori chopped"
      },
      {
        "item": "Brown rice (cooked)",
        "qty": "1 katori"
      },
      {
        "item": "Panch phoron",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Pressure cook toor dal with turmeric and the chopped vegetables until soft.",
      "Add salt, ginger and roasted cumin powder and simmer for 5 minutes.",
      "Heat ghee and splutter panch phoron with dry red chilli.",
      "Pour the tempering over the dalma.",
      "Serve over the brown rice."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 375,
      "protein_g": 14,
      "carbs_g": 65,
      "fat_g": 6.5,
      "fiber_g": 11
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "b6314207-2b04-53f4-8464-8ac95ead89a4"
  },
  {
    "name": "Masoor Dal with Egg and Brown Rice",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 30,
    "serves": 1,
    "ingredients": [
      {
        "item": "Masoor dal (cooked)",
        "qty": "1.5 katori"
      },
      {
        "item": "Boiled egg",
        "qty": "1"
      },
      {
        "item": "Brown rice (cooked)",
        "qty": "1 katori"
      },
      {
        "item": "Onion and tomato",
        "qty": "2 tbsp chopped"
      },
      {
        "item": "Cumin",
        "qty": "1/2 tsp"
      },
      {
        "item": "Ghee",
        "qty": "1 tsp"
      }
    ],
    "steps": [
      "Boil masoor dal with turmeric and salt until soft.",
      "Heat ghee and splutter cumin, onion, tomato and green chilli.",
      "Pour the tempering over the dal and simmer for 3 minutes.",
      "Halve the boiled egg.",
      "Serve the dal over the brown rice with the egg on top."
    ],
    "macros": {
      "per": "1 big plate",
      "calories": 465,
      "protein_g": 23,
      "carbs_g": 66,
      "fat_g": 12,
      "fiber_g": 9
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "9d8db922-d4f6-5a0c-bbff-daca89527a1f"
  },
  {
    "name": "Doi Chicken (Lean Yogurt Chicken)",
    "region": "East",
    "type": "Non-veg",
    "time_minutes": 40,
    "serves": 1,
    "ingredients": [
      {
        "item": "Chicken breast",
        "qty": "200 g"
      },
      {
        "item": "Curd",
        "qty": "1/3 katori"
      },
      {
        "item": "Onion",
        "qty": "1/2 grated"
      },
      {
        "item": "Ginger-garlic paste",
        "qty": "1 tsp"
      },
      {
        "item": "Mustard oil",
        "qty": "2 tsp"
      },
      {
        "item": "Garam masala",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Marinate the chicken in curd, ginger-garlic paste, turmeric and salt for 30 minutes.",
      "Heat mustard oil and fry grated onion with bay leaf until golden.",
      "Add the chicken with its marinade and cook on medium heat.",
      "Cover and cook for 15 minutes until tender and the gravy thickens.",
      "Finish with garam masala and coriander."
    ],
    "macros": {
      "per": "1 plate",
      "calories": 380,
      "protein_g": 49,
      "carbs_g": 10,
      "fat_g": 16,
      "fiber_g": 1
    },
    "focus": [
      "high-protein"
    ],
    "id": "03f075f0-63a1-59bc-8275-3715c72a7002"
  },
  {
    "name": "Muri Chana Peanut Bowl",
    "region": "East",
    "type": "Veg",
    "time_minutes": 10,
    "serves": 1,
    "ingredients": [
      {
        "item": "Puffed rice (muri)",
        "qty": "2 katori (40 g)"
      },
      {
        "item": "Roasted chana",
        "qty": "3 tbsp (30 g)"
      },
      {
        "item": "Roasted peanuts",
        "qty": "2 tbsp"
      },
      {
        "item": "Moong sprouts",
        "qty": "1/3 katori"
      },
      {
        "item": "Onion",
        "qty": "1/4 chopped"
      },
      {
        "item": "Mustard oil",
        "qty": "1/2 tsp"
      }
    ],
    "steps": [
      "Take the puffed rice in a large bowl.",
      "Add the roasted chana, peanuts and sprouts.",
      "Mix in onion, green chilli and coriander.",
      "Drizzle raw mustard oil and add salt, chaat masala and lemon.",
      "Toss quickly and eat immediately."
    ],
    "macros": {
      "per": "1 big bowl",
      "calories": 400,
      "protein_g": 17,
      "carbs_g": 58,
      "fat_g": 11,
      "fiber_g": 9
    },
    "focus": [
      "high-carb",
      "high-fiber"
    ],
    "id": "6c0f845d-7199-5838-a814-3498c8e5a776"
  }
]
$recipes$::jsonb) r
on conflict(id) do nothing;

-- A retry-safe favorite command avoids treating the composite key as an id column.
create or replace function public.set_recipe_favorite(p_recipe_id uuid,p_favorite boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_favorite then
   if not public.can_read_recipe(p_recipe_id) or not exists(select 1 from public.recipes where id=p_recipe_id and status='published' and deleted_at is null) then raise exception 'RECIPE_UNAVAILABLE'; end if;
   insert into public.recipe_favorites(user_id,recipe_id) values(auth.uid(),p_recipe_id) on conflict do nothing;
 else
   delete from public.recipe_favorites where user_id=auth.uid() and recipe_id=p_recipe_id;
 end if;
end; $$;
revoke all on function public.set_recipe_favorite(uuid,boolean) from public,anon;
grant execute on function public.set_recipe_favorite(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
