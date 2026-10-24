begin;
-- Older databases used numeric shift IDs, while the UI uses stable string IDs.
-- No data is removed. A dependent external FK will stop this migration for review.
do $$ declare t text; typ text; ident text; begin
 foreach t in array array['work_shifts','rota_shifts'] loop
  select data_type,is_identity into typ,ident from information_schema.columns where table_schema='public' and table_name=t and column_name='id';
  if typ in ('bigint','integer','smallint') then
   if ident='YES' then execute format('alter table public.%I alter column id drop identity',t); end if;
   execute format('alter table public.%I alter column id drop default',t);
   execute format('alter table public.%I alter column id type text using id::text',t);
   execute format('alter table public.%I alter column id set default gen_random_uuid()::text',t);
  end if;
 end loop;
end $$;
alter table public.work_shifts add column if not exists pay_amount numeric,
 add column if not exists kind text default 'worked', add column if not exists leave_reason text;
alter table public.sales add column if not exists archived_at timestamptz, add column if not exists request_payload jsonb;
alter table public.orders add column if not exists request_hash text, add column if not exists approval_token uuid,
 add column if not exists discount_percent numeric default 0,
 add column if not exists cash_amount numeric, add column if not exists card_amount numeric,
 add column if not exists tendered_cash numeric, add column if not exists change_given numeric,
 add column if not exists updated_at timestamptz default now(), add column if not exists created_by_fullname text;
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='last_updated_at') then
  execute 'update orders set updated_at=last_updated_at where last_updated_at is not null';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='created_by_full_name') then
  execute 'update orders set created_by_fullname=coalesce(created_by_fullname,created_by_full_name)';
 end if;
end $$;
do $$ declare t text; begin
 foreach t in array array['products','ingredients','prepared_stock','orders','rota_shifts','app_users','work_shifts'] loop
 execute format('alter table public.%I add column if not exists revision bigint not null default 0',t);
 end loop;
end $$;
create function public.previsio_revision() returns trigger language plpgsql as $$
begin new.revision:=old.revision+1; return new; end $$;
do $$ declare t text; begin
 foreach t in array array['products','ingredients','prepared_stock','orders','rota_shifts','app_users','work_shifts'] loop
 execute format('create trigger previsio_revision before update on public.%I for each row execute function public.previsio_revision()',t);
 end loop;
end $$;
-- SECURITY INVOKER: ordinary grants, RLS, and field guards apply to every mutation.
create function public.previsio_mutate(collection text, biz text, changes jsonb) returns jsonb
language plpgsql set search_path=public as $$
declare change jsonb; row_data jsonb; result jsonb:='[]'; found_row jsonb; cols text; vals text; assignments text; affected integer;
begin
 if collection not in ('products','ingredients','prepared_stock','orders','rota_shifts','app_users','work_shifts') or jsonb_array_length(changes)>500 then raise exception 'Invalid collection'; end if;
 if previsio_role(biz) is null then raise exception 'Access denied'; end if;
 for change in select value from jsonb_array_elements(changes) loop
  row_data := change->'row';
  if row_data->>'business_id' is distinct from biz then raise exception 'Invalid business'; end if;
  execute format('select to_jsonb(t) from public.%I t where id::text=$1 and business_id::text=$2 for update',collection)
   into found_row using row_data->>'id',biz;
  if change->>'expected' is null then
   if found_row is not null then raise exception 'Conflict: record already exists'; end if;
  elsif found_row is null or (found_row->>'revision')::bigint<>(change->>'expected')::bigint then
   raise exception 'Conflict: record changed on another device. Reload before retrying';
  end if;
  if change->>'delete'='true' then
   execute format('delete from public.%I where id::text=$1 and business_id::text=$2',collection) using row_data->>'id',biz;
   get diagnostics affected=row_count;
   if affected<>1 then raise exception 'Delete denied'; end if;
   result:=result||jsonb_build_array(jsonb_build_object('id',row_data->>'id','deleted',true));
   continue;
  end if;
  select string_agg(format('%I',key),','),string_agg(format('r.%I',key),','),
    string_agg(format('%I=r.%I',key,key),',') into cols,vals,assignments
   from jsonb_object_keys(row_data-'revision') key
   where key in(select column_name from information_schema.columns where table_schema='public' and table_name=collection);
  if found_row is null then
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning to_jsonb(%I.*)',collection,cols,vals,collection,collection)
    into found_row using row_data;
  else
   execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.id::text=$2 and t.business_id::text=$3 returning to_jsonb(t.*)',collection,assignments,collection)
    into found_row using row_data,row_data->>'id',biz;
   if found_row is null then raise exception 'Update denied'; end if;
  end if;
  result:=result||jsonb_build_array(found_row);
 end loop;
 return result;
end $$;
revoke all on function public.previsio_mutate(text,text,jsonb) from public;
grant execute on function public.previsio_mutate(text,text,jsonb) to authenticated;

create table public.previsio_discount_approvals (
 token uuid primary key default gen_random_uuid(), business_id text not null, order_id text not null,
 maximum numeric not null check(maximum>=0), approved_by uuid not null, expires_at timestamptz not null default now()+interval '90 days', used_by text
);
alter table public.previsio_discount_approvals enable row level security;
create function public.previsio_approve_discount(biz text, order_id text, maximum numeric) returns uuid
language plpgsql security definer set search_path=public as $$
declare token uuid; begin
 if coalesce(previsio_role(biz),'') not in ('owner','manager') or not previsio_active(biz) then raise exception 'Manager authorization required'; end if;
 if order_id is null or length(order_id)>200 or maximum is null or maximum<0 or maximum>100000 then raise exception 'Invalid approval'; end if;
 insert into previsio_discount_approvals(business_id,order_id,maximum,approved_by) values(biz,order_id,maximum,auth.uid()) returning previsio_discount_approvals.token into token;
 return token;
end $$;
revoke all on function public.previsio_approve_discount(text,text,numeric) from public;
grant execute on function public.previsio_approve_discount(text,text,numeric) to authenticated;

-- Trusted stock ledger records original consumption so later recipe edits cannot change refunds.
create table public.previsio_stock_ledger(sale_id text references public.sales(id), stock_table text, stock_id bigint, quantity numeric check(quantity>0), primary key(sale_id,stock_table,stock_id));
alter table public.previsio_stock_ledger enable row level security;
create function public.previsio_record_sale(biz text, sale jsonb, lines jsonb, order_row jsonb default null) returns void
language plpgsql security definer set search_path=public as $$
declare line jsonb; extra jsonb; product public.products; link jsonb; need numeric; total numeric:=0; expected numeric;
 cols text; vals text; existing public.sales; caller public.app_users; consumed record; policy jsonb; discount numeric; approval uuid; request_payload jsonb; locked_order public.orders; numeric_field text;
begin
 select * into caller from app_users where id::text=auth.uid()::text and business_id::text=biz;
 if caller.id is null or not previsio_active(biz) then raise exception 'Active business membership required'; end if;
 if coalesce(jsonb_typeof(sale->'subtotal'),'')<>'number' then raise exception 'Invalid subtotal'; end if;
 foreach numeric_field in array array['discount_amount','discount_percent','tip_amount','cash_amount','card_amount','tendered_cash','change_given'] loop
  if sale ? numeric_field and sale->numeric_field <> 'null'::jsonb then
   if jsonb_typeof(sale->numeric_field)<>'number' or (sale->>numeric_field)::numeric<0 then raise exception 'Invalid monetary value'; end if;
  end if;
 end loop;
 if coalesce((sale->>'discount_percent')::numeric,0)>100 then raise exception 'Invalid discount percentage'; end if;
 if sale->>'business_id' is distinct from biz or jsonb_array_length(lines)<1 or jsonb_array_length(lines)>100 then raise exception 'Invalid sale'; end if;
 request_payload:=jsonb_build_object('sale',sale-array['created_at','timestamp','cashier_username','cashier_fullname'],'lines',lines,'order_id',order_row->>'id');
 perform pg_advisory_xact_lock(hashtextextended(biz,0));
 select * into existing from sales where id=sale->>'id';
 if found then
  if existing.business_id::text<>biz then raise exception 'Invalid sale identifier'; end if;
  if existing.request_payload is distinct from request_payload then raise exception 'This sale identifier was already used for a different checkout. Reload and review the saved sale'; end if;
  return; -- Only identical retries are idempotent.
 end if;
 if order_row is not null then
  select * into locked_order from orders where id=order_row->>'id' for update;
  if found and (locked_order.business_id::text<>biz or locked_order.sale_id is not null or locked_order.revision is distinct from (order_row->>'revision')::bigint) then raise exception 'Order changed on another device. Reload before checkout'; end if;
 end if;
 for line in select value from jsonb_array_elements(lines) loop
  if coalesce(jsonb_typeof(line->'qty'),'')<>'number' or coalesce(jsonb_typeof(line->'unit_price'),'')<>'number' or coalesce(jsonb_typeof(line->'line_total'),'')<>'number' or (line->>'qty')::numeric<>floor((line->>'qty')::numeric) then raise exception 'Invalid numeric line values'; end if;
  if jsonb_array_length(coalesce(line->'extras','[]'))<>(select count(distinct value->>'productId') from jsonb_array_elements(coalesce(line->'extras','[]'))) then raise exception 'Duplicate extras'; end if;
  if line->>'sale_id' is distinct from sale->>'id' or (line->>'qty')::numeric<=0 or (line->>'qty')::numeric>999 then raise exception 'Invalid line'; end if;
  select * into product from products where id=(line->>'product_id')::bigint and business_id::text=biz;
  if not found or not product.active then raise exception 'Product unavailable'; end if;
  if (line->>'unit_price')::numeric<>product.price then raise exception 'Price changed; refresh the menu'; end if;
  expected:=product.price;
  for extra in select value from jsonb_array_elements(coalesce(line->'extras','[]')) loop
   if coalesce(jsonb_typeof(extra->'price'),'')<>'number' or extra->>'productId'=line->>'product_id' then raise exception 'Invalid extra price or self-reference'; end if;
   if not coalesce(product.extra_ids,'[]') @> jsonb_build_array((extra->>'productId')::bigint) then raise exception 'Invalid extra'; end if;
   select price into need from products where id=(extra->>'productId')::bigint and business_id::text=biz and active;
   if not found or need<>(extra->>'price')::numeric then raise exception 'Extra unavailable or price changed'; end if;
   expected:=expected+need;
  end loop;
  if abs(expected*(line->>'qty')::numeric-(line->>'line_total')::numeric)>0.005 then raise exception 'Invalid line total'; end if;
  total:=total+(line->>'line_total')::numeric;
 end loop;
 if abs(total-(sale->>'subtotal')::numeric)>0.005 or coalesce((sale->>'discount_amount')::numeric,0)<0
 or coalesce((sale->>'discount_amount')::numeric,0)>total or coalesce((sale->>'tip_amount')::numeric,0)<0 then raise exception 'Invalid totals'; end if;
 discount:=coalesce((sale->>'discount_amount')::numeric,0);
 select discount_policy into policy from businesses where id::text=biz;
 if caller.role='staff' and (discount>coalesce((policy->>'staffMaxAmount')::numeric,5) or
     coalesce((sale->>'discount_percent')::numeric,0)>coalesce((policy->>'staffMaxPercent')::numeric,10)) then
  if not coalesce((policy->>'requireManagerPinAboveLimit')::boolean,true) then raise exception 'Discount exceeds staff limit'; end if;
  update previsio_discount_approvals set used_by=sale->>'id'
   where token::text=sale->>'approval_token' and business_id=biz and order_id=order_row->>'id'
     and maximum>=discount and expires_at>now() and used_by is null returning token into approval;
  if approval is null then raise exception 'Valid manager approval required'; end if;
 end if;
 if coalesce(sale->>'payment_method','') not in ('Cash','Card','Split') then raise exception 'Invalid payment method'; end if;
 if sale->>'payment_method'='Split' and abs(coalesce((sale->>'cash_amount')::numeric,0)+coalesce((sale->>'card_amount')::numeric,0)-(total-discount+coalesce((sale->>'tip_amount')::numeric,0)))>0.005 then raise exception 'Split payment must match payable'; end if;
 sale:=sale||jsonb_build_object('request_payload',request_payload,'status','completed','cashier_username',caller.username,'cashier_fullname',caller.full_name);
 select string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') into cols,vals from jsonb_object_keys(sale) key
 where key in(select column_name from information_schema.columns where table_schema='public' and table_name='sales');
 execute format('insert into sales (%s) select %s from jsonb_populate_record(null::sales,$1) r',cols,vals) using sale;
 for line in select value from jsonb_array_elements(lines) loop
  insert into sale_items(sale_id,product_id,qty,unit_price,line_total,extras,name_en,translations,note)
  select sale->>'id',r.product_id,r.qty,r.unit_price,r.line_total,r.extras,r.name_en,r.translations,r.note from jsonb_populate_record(null::sale_items,line) r;
  for product in select p.* from products p where p.business_id::text=biz and
   (p.id=(line->>'product_id')::bigint or p.id in(select (value->>'productId')::bigint from jsonb_array_elements(coalesce(line->'extras','[]')))) loop
   for link in select value from jsonb_array_elements(coalesce(product.ingredient_links,'[]')) loop
    need:=(link->>'quantityUsed')::numeric*(line->>'qty')::numeric;
    if need is null or need<=0 then raise exception 'Invalid recipe quantity'; end if;
    insert into previsio_stock_ledger values(sale->>'id','ingredients',(link->>'ingredientId')::bigint,need)
     on conflict(sale_id,stock_table,stock_id) do update set quantity=previsio_stock_ledger.quantity+excluded.quantity;
   end loop;
   for link in select value from jsonb_array_elements(coalesce(product.prepared_stock_links,'[]')) loop
    need:=(link->>'portionsPerSale')::numeric*(line->>'qty')::numeric;
    if need is null or need<=0 then raise exception 'Invalid recipe quantity'; end if;
    insert into previsio_stock_ledger values(sale->>'id','prepared_stock',(link->>'preparedStockId')::bigint,need)
     on conflict(sale_id,stock_table,stock_id) do update set quantity=previsio_stock_ledger.quantity+excluded.quantity;
   end loop;
  end loop;
 end loop;
 for consumed in select * from previsio_stock_ledger where sale_id=sale->>'id' order by stock_table,stock_id loop
  if consumed.stock_table='ingredients' then
   update ingredients set qty=qty-consumed.quantity where id=consumed.stock_id and business_id::text=biz and qty>=consumed.quantity;
  else
   update prepared_stock set portions=portions-consumed.quantity where id=consumed.stock_id and business_id::text=biz and portions>=consumed.quantity;
  end if;
  if not found then raise exception 'Insufficient or missing stock'; end if;
 end loop;
 if order_row is not null then
  if order_row->>'business_id' is distinct from biz then raise exception 'Invalid order'; end if;
  if exists(select 1 from orders where id=order_row->>'id' and (business_id::text<>biz or sale_id is not null)) then raise exception 'Order already completed'; end if;
  order_row:=order_row||jsonb_build_object('sale_id',sale->>'id','status','Completed','completed_at',now());
  select string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') into cols,vals from jsonb_object_keys(order_row-'revision') key
  where key in(select column_name from information_schema.columns where table_schema='public' and table_name='orders');
  execute format('insert into orders (%s) select %s from jsonb_populate_record(null::orders,$1) r on conflict(id) do update set status=''Completed'',sale_id=excluded.sale_id,completed_at=excluded.completed_at,updated_at=now()',cols,vals) using order_row;
 end if;
end $$;
create function public.previsio_reverse_sale(biz text, sale_id text, new_status text, reason text default null, order_status text default 'Cancelled') returns void
language plpgsql security definer set search_path=public as $$
declare existing public.sales; consumed record; begin
 if coalesce(previsio_role(biz),'') not in ('owner','manager') or not previsio_active(biz) then raise exception 'Manager access required'; end if;
 if coalesce(order_status,'') not in ('Cancelled','Preparing','Ready') then raise exception 'Invalid order status'; end if;
 if new_status not in ('voided','refunded') then raise exception 'Invalid status'; end if;
 perform pg_advisory_xact_lock(hashtextextended(biz,0));
 select * into existing from sales s where s.id=sale_id and s.business_id::text=biz for update;
 if not found then raise exception 'Sale not found'; end if;
 if existing.status not in ('voided','refunded') then
 for consumed in select * from previsio_stock_ledger l where l.sale_id=previsio_reverse_sale.sale_id order by stock_table,stock_id loop
  if consumed.stock_table='ingredients' then update ingredients set qty=qty+consumed.quantity where id=consumed.stock_id and business_id::text=biz;
  else update prepared_stock set portions=portions+consumed.quantity where id=consumed.stock_id and business_id::text=biz; end if;
  if not found then raise exception 'Original stock item missing; restore it before reversing the sale'; end if;
 end loop;
 update sales s set status=new_status,void_reason=reason,refunded_at=case when new_status='refunded' then now() else null end where s.id=sale_id;
 end if;
 update orders o set status=order_status,void_reason=reason,updated_at=now(),
 sale_id=case when order_status='Cancelled' then o.sale_id else null end, completed_at=null where o.sale_id=previsio_reverse_sale.sale_id and o.business_id::text=biz;
end $$;
revoke all on function public.previsio_record_sale(text,jsonb,jsonb,jsonb),public.previsio_reverse_sale(text,text,text,text,text) from public;
grant execute on function public.previsio_record_sale(text,jsonb,jsonb,jsonb),public.previsio_reverse_sale(text,text,text,text,text) to authenticated;
create function public.previsio_amend_sale(biz text, sale_id text, payment text, expected_subtotal numeric, archive boolean) returns void
language plpgsql security definer set search_path=public as $$
declare current_sale public.sales; begin
 if coalesce(previsio_role(biz),'') not in ('owner','manager') or not previsio_active(biz) then raise exception 'Manager access required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(biz,0));
 select * into current_sale from sales s where s.id=sale_id and business_id::text=biz for update;
 if not found then raise exception 'Sale not found'; end if;
 if archive then
  perform previsio_reverse_sale(biz,sale_id,'voided','Sale record removed');
  update sales s set archived_at=now() where s.id=sale_id;
 else
  if expected_subtotal is distinct from current_sale.subtotal then raise exception 'Historical totals must match original line items; refund and create a corrected sale'; end if;
  if payment not in ('Cash','Card','Split') or payment is null then raise exception 'Invalid payment'; end if;
  if payment='Split' and current_sale.payment_method<>'Split' then raise exception 'Split amounts must be recorded at checkout'; end if;
  update sales s set payment_method=payment,
    cash_amount=case when payment='Cash' then subtotal-discount_amount+tip_amount when payment='Card' then 0 else cash_amount end,
    card_amount=case when payment='Card' then subtotal-discount_amount+tip_amount when payment='Cash' then 0 else card_amount end where s.id=sale_id;
 end if;
end $$;
revoke all on function public.previsio_amend_sale(text,text,text,numeric,boolean) from public;
grant execute on function public.previsio_amend_sale(text,text,text,numeric,boolean) to authenticated;
commit;
