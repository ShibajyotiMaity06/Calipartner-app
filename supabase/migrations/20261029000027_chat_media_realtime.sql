-- Media approval must reach readers without requiring a screen reload.
do $$begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_attachments') then
    alter publication supabase_realtime add table public.chat_attachments;
  end if;
end;$$;
