\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select previsio_record_sale('A',jsonb_build_object('id',:'sale','business_id','A','subtotal',5,'payment_method','Cash'),
 jsonb_build_array(jsonb_build_object('sale_id',:'sale','product_id',1,'qty',1,'unit_price',5,'line_total',5)),null);
