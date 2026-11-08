-- Apply stable, input-derived bounds after the existing paid/safety guard.
-- Custom edits cannot move their own anchor by repeatedly saving another override.
create or replace function public.guard_macro_adjustment_bounds()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
 previous public.goal_profiles;
 sex text; profile public.profiles; raw_bmr numeric; reference_tdee numeric; minimum numeric; maximum_rate numeric; rate numeric;
 calories numeric; protein numeric; fat numeric; carbs numeric;
begin
 if not new.custom_macros then return new; end if;
 -- Historical retries/habit-only edits retain their already accepted exact targets.
 select * into previous from public.goal_profiles where user_id=new.user_id
  order by effective_from desc limit 1;
 if previous.id is not null and
  (previous.daily_calorie_target,previous.protein_grams,previous.carb_grams,previous.fat_grams,
   previous.current_weight_kg,previous.tdee,previous.goal,previous.gym_days)
  is not distinct from
  (new.daily_calorie_target,new.protein_grams,new.carb_grams,new.fat_grams,
   new.current_weight_kg,new.tdee,new.goal,new.gym_days) then return new; end if;
 select * into profile from public.profiles p where p.id=new.user_id;
 sex:=profile.sex;
 -- Derive the anchor from verified profile/planning inputs rather than client-supplied TDEE.
 raw_bmr:=case when new.gym_days is null and new.body_fat_percentage is not null
  then 370+21.6*new.current_weight_kg*(1-new.body_fat_percentage/100)
  else 10*new.current_weight_kg+6.25*coalesce(new.input_height_cm,profile.height_cm)
   -5*extract(year from age((now() at time zone coalesce(profile.timezone,'UTC'))::date,profile.date_of_birth))
   +case sex when 'male' then 5 when 'female' then -161 else -78 end end;
 reference_tdee:=round(raw_bmr*case when new.gym_days is not null then 1.35+0.04*new.gym_days
  else case new.activity_level when 'sedentary' then 1.2 when 'light' then 1.375 when 'moderate' then 1.55
   when 'very_active' then 1.725 else 1.9 end end);
 if reference_tdee is null then raise exception 'UNSAFE_MACROS'; end if;
 minimum:=greatest(case sex when 'male' then 1500 when 'female' then 1200 else 1350 end,
  case when new.gym_days is not null then new.current_weight_kg*19.6 else 0 end);
 maximum_rate:=greatest(0,least(new.current_weight_kg*0.01,(reference_tdee-minimum)/1100));
 rate:=case new.goal when 'cut' then floor(least(0.5,maximum_rate)*100)/100
  when 'bulk' then floor(least(new.current_weight_kg*0.005,new.current_weight_kg*0.01)*100)/100 else 0 end;
 calories:=round(reference_tdee+case new.goal when 'cut' then -1 else 1 end*round(rate*1100));
 protein:=round(new.current_weight_kg*case when new.gym_days is not null then 2.2
  when new.goal='cut' then 2 when new.goal='bulk' then 1.8 else 1.6 end);
 fat:=case when new.gym_days is not null then round(new.current_weight_kg*1.2)
  else greatest(round(calories*0.25/9),round(new.current_weight_kg*0.6)) end;
 carbs:=greatest(0,round((calories-protein*4-fat*9)/4));
 if abs(new.daily_calorie_target-calories)>500 then raise exception 'MACRO_RANGE_CALORIES'; end if;
 if abs(new.protein_grams-protein)>50 then raise exception 'MACRO_RANGE_PROTEIN'; end if;
 if abs(new.carb_grams-carbs)>125 then raise exception 'MACRO_RANGE_CARBS'; end if;
 if abs(new.fat_grams-fat)>55 then raise exception 'MACRO_RANGE_FAT'; end if;
 return new;
end; $$;
revoke all on function public.guard_macro_adjustment_bounds() from public,anon,authenticated;
create trigger b_guard_macro_adjustment_bounds before insert or update on public.goal_profiles
 for each row execute function public.guard_macro_adjustment_bounds();
notify pgrst,'reload schema';
