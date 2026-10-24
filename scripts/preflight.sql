-- READ ONLY. Run the whole file once. It returns ONE row with every section.
-- Export/copy the entire report cell as JSON. No business records or credentials are queried.
-- A single row avoids SQL editor result tabs and the 100-row display limit.
select jsonb_build_object(
 'columns', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
   select table_name,column_name,data_type,udt_name,is_nullable,column_default
   from information_schema.columns where table_schema='public' order by table_name,ordinal_position
 ) x),
 'policies', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
   select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
   where schemaname='public' order by tablename,policyname
 ) x),
 'triggers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
   select event_object_table,trigger_name,action_statement from information_schema.triggers
   where event_object_schema='public' order by event_object_table,trigger_name
 ) x),
 'grants', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
   select grantee,table_name,privilege_type from information_schema.role_table_grants
   where table_schema='public' and grantee in ('anon','authenticated') order by table_name,grantee,privilege_type
 ) x),
 'constraints', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
   select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) as constraint_definition
   from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text,conname
 ) x),
 'enums', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
   select t.typname,e.enumlabel,e.enumsortorder from pg_type t join pg_enum e on e.enumtypid=t.oid
   join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' order by t.typname,e.enumsortorder
 ) x),
 'rls', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
   select relname,relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' order by relname
 ) x)
) as report;
