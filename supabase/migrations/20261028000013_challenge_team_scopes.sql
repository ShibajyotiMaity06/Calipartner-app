-- Duels always need a consenting opponent; co-op needs teammates.
update public.challenge_templates set scope_options=array['pair'],version=version+1 where slug='steps-duel';
update public.challenge_templates set scope_options=array['pair','room'],version=version+1 where slug='move-together';
