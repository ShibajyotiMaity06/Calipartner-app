-- Optional default meal slot for custom saved meals (CreateMeal screen)
alter table public.saved_meals
  add column if not exists default_meal_section text
  check (default_meal_section in ('breakfast', 'lunch', 'dinner', 'snacks', 'extra'));
