do $$
declare t text;
begin
  foreach t in array array['collaborator_work_logs','payment_history','payment_milestones','notifications','leads','crm_follow_ups','budget_items','lead_interactions'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;