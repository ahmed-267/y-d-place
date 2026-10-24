-- Read-only: identify routines blocking the legacy upgrade. Returns no business rows or credentials.
select n.nspname as schema_name,
       p.proname as routine_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       case p.prokind when 'p' then 'procedure' when 'a' then 'aggregate' when 'w' then 'window function' else 'function' end as routine_kind,
       pg_get_userbyid(p.proowner) as owner,
       l.lanname as language,
       p.prosecdef as security_definer,
       (select e.extname from pg_depend d join pg_extension e on e.oid=d.refobjid
        where d.classid='pg_proc'::regclass and d.objid=p.oid
          and d.refclassid='pg_extension'::regclass and d.deptype='e' limit 1) as extension_name
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
join pg_language l on l.oid=p.prolang
where n.nspname='public' and p.prokind<>'f'
order by p.proname, arguments;
