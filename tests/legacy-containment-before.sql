-- Synthetic reproduction of the reported exposed table; no business data.
create table public.sale_item_extras(id bigserial primary key,sale_item_id bigint not null,product_id bigint,name_en text not null,price numeric check(price>=0));
insert into public.sale_item_extras(sale_item_id,name_en,price) values(123,'Synthetic extra',1.50);
grant all on public.sale_item_extras to anon,authenticated;
grant all on sequence public.sale_item_extras_id_seq to anon,authenticated;
set role anon;
select test_assert((select count(*)=1 from sale_item_extras),'fixture reproduces anonymous exposure');
reset role;
