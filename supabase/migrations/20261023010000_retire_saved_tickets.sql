begin;
-- Retired feature cleanup only; completed sales and orders are unaffected.
update public.businesses set enabled_modules=enabled_modules-'parkTickets' where enabled_modules ? 'parkTickets';
update public.browser_backups set payload=payload-'parkedTickets' where payload ? 'parkedTickets';
commit;
