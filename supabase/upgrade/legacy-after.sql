-- Import to the current schema; the source archive remains unchanged.
create table previsio_legacy_archive.product_id_map as
 select id as legacy_id,row_number() over(order by id)::bigint as current_id from previsio_legacy_archive.products;
alter table previsio_legacy_archive.product_id_map add primary key(legacy_id), add unique(current_id);
create table previsio_legacy_archive.ingredient_id_map as
 select id as legacy_id,row_number() over(order by id)::bigint as current_id from previsio_legacy_archive.ingredients;
alter table previsio_legacy_archive.ingredient_id_map add primary key(legacy_id), add unique(current_id);
create table previsio_legacy_archive.sale_item_id_map as
 select id as legacy_id,row_number() over(order by id)::bigint as current_id from previsio_legacy_archive.sale_items;
alter table previsio_legacy_archive.sale_item_id_map add primary key(legacy_id), add unique(current_id);

insert into public.businesses(id,owner_user_id,name,owner_name,owner_email,owner_phone,venue_type,country,city,address,opening_hours,currency_code,currency_symbol,language,setup_completed,enabled_modules,plan,stripe_customer_id,stripe_subscription_id,trial_ends_at,current_period_ends_at,subscription_status)
select id::text,owner_user_id,name,owner_name,owner_email,owner_phone,venue_type,country,city,'',opening_hours,currency_code,currency_symbol,language,setup_completed,
 coalesce(enabled_modules,'{}')-'parkTickets',plan,stripe_customer_id,stripe_subscription_id,trial_ends_at,current_period_ends_at,subscription_status
from previsio_legacy_archive.businesses;
insert into public.app_users(id,business_id,username,full_name,role,hourly_rate,email)
select u.id,u.business_id::text,u.username,u.full_name,u.role::text,u.hourly_rate,to_jsonb(a)->>'email'
from previsio_legacy_archive.app_users u join auth.users a on a.id=u.id order by u.id;
create table previsio_legacy_archive.user_id_map as select id as legacy_id,numeric_id as current_id from public.app_users;
alter table previsio_legacy_archive.user_id_map add primary key(legacy_id), add unique(current_id);
insert into public.ingredients(id,business_id,name,unit,qty,low_threshold)
select m.current_id,i.business_id::text,i.name,i.unit,i.qty,i.low_threshold from previsio_legacy_archive.ingredients i join previsio_legacy_archive.ingredient_id_map m on m.legacy_id=i.id;
insert into public.products(id,business_id,name_en,translations,category,price,emoji,active,ingredient_links)
select m.current_id,p.business_id::text,p.name_en,p.translations,p.category,p.price,p.emoji,p.active,
 coalesce((select jsonb_agg(jsonb_build_object('ingredientId',im.current_id,'quantityUsed',r.quantity_used,'unit',i.unit) order by r.id)
 from previsio_legacy_archive.product_ingredients r join previsio_legacy_archive.ingredient_id_map im on im.legacy_id=r.ingredient_id
 join previsio_legacy_archive.ingredients i on i.id=r.ingredient_id where r.product_id=p.id),'[]')
from previsio_legacy_archive.products p join previsio_legacy_archive.product_id_map m on m.legacy_id=p.id;
insert into public.sales(id,business_id,subtotal,payment_method,cashier_username,cashier_fullname,created_at,timestamp)
select id::text,business_id::text,subtotal,
 case lower(payment_method::text) when 'cash' then 'Cash' when 'card' then 'Card' when 'split' then 'Split' else payment_method::text end,
 cashier_username,cashier_fullname,created_at,(extract(epoch from created_at)*1000)::bigint
from previsio_legacy_archive.sales;
insert into public.sale_items(id,sale_id,product_id,name_en,translations,qty,line_total,unit_price,extras)
select im.current_id,i.sale_id::text,pm.current_id,i.name_en,i.translations,i.qty,i.line_total,
 i.line_total/nullif(i.qty,0)-coalesce((select sum((e->>'price')::numeric) from jsonb_array_elements(i.extras) e),0),
 coalesce((select jsonb_agg((e-'product_id'-'name_en')||jsonb_build_object('productId',coalesce(em.current_id,0),'nameEN',coalesce(e->>'nameEN',e->>'name_en','Extra')))
 from jsonb_array_elements(i.extras) e left join previsio_legacy_archive.product_id_map em on em.legacy_id::text=coalesce(e->>'productId',e->>'product_id')),'[]')
from previsio_legacy_archive.sale_items i join previsio_legacy_archive.sale_item_id_map im on im.legacy_id=i.id
left join previsio_legacy_archive.product_id_map pm on pm.legacy_id=i.product_id;
select setval(pg_get_serial_sequence('public.sale_items','id'),coalesce((select max(id) from public.sale_items),1),exists(select 1 from public.sale_items));
insert into public.expenses(id,business_id,name,category,amount,date,is_recurring,frequency,receipt_image)
select id::text,business_id::text,name,initcap(category::text),amount,date,is_recurring,initcap(frequency::text),receipt_image from previsio_legacy_archive.expenses;
insert into public.work_shifts(id,business_id,user_id,username,full_name,date,start_time,end_time,break_minutes,total_hours,notes,kind)
select s.id::text,s.business_id::text,u.numeric_id,u.username,u.full_name,s.date,s.start_time::text,s.end_time::text,s.break_minutes,s.total_hours,s.notes,'worked'
from previsio_legacy_archive.work_shifts s join public.app_users u on u.id=s.user_id;

-- Reconciliation is part of the same transaction: failure restores the entire original schema.
do $$ declare t text; old_count bigint; new_count bigint; begin
 foreach t in array array['businesses','app_users','products','ingredients','sales','sale_items','expenses','work_shifts'] loop
  execute format('select count(*) from previsio_legacy_archive.%I',t) into old_count;
  execute format('select count(*) from public.%I',t) into new_count;
  if old_count<>new_count then raise exception 'Reconciliation failed for %: % vs %',t,old_count,new_count; end if;
 end loop;
 if (select coalesce(sum(subtotal),0) from public.sales)<>(select coalesce(sum(subtotal),0) from previsio_legacy_archive.sales)
 or (select coalesce(sum(amount),0) from public.expenses)<>(select coalesce(sum(amount),0) from previsio_legacy_archive.expenses)
 or (select coalesce(sum(line_total),0) from public.sale_items)<>(select coalesce(sum(line_total),0) from previsio_legacy_archive.sale_items)
 or (select coalesce(sum(qty),0) from public.ingredients)<>(select coalesce(sum(qty),0) from previsio_legacy_archive.ingredients)
 or (select coalesce(sum(total_hours),0) from public.work_shifts)<>(select coalesce(sum(total_hours),0) from previsio_legacy_archive.work_shifts) then
  raise exception 'Reconciliation failed: totals changed';
 end if;
 if (select count(*) from previsio_legacy_archive.product_ingredients)<>(select coalesce(sum(jsonb_array_length(ingredient_links)),0) from public.products) then
  raise exception 'Reconciliation failed: recipe links missing';
 end if;
end $$;
revoke all on all tables in schema previsio_legacy_archive from public,anon,authenticated,service_role;
revoke all on all sequences in schema previsio_legacy_archive from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
-- Original sale_item_extras has bigint references incompatible with its UUID parents.
-- It is retained in the private archive, never guessed onto another customer's sale.
