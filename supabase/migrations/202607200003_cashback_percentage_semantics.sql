-- Alinha campanhas de cashback ao percentual do valor dos produtos.
-- Exemplo: multiplier = 1 significa 1% do subtotal elegível.

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.sync_order_cashback_wallet()'::regprocedure
  ) into current_definition;

  updated_definition := replace(
    current_definition,
    'select coalesce(sum(item.quantity * item.unit_cashback), 0)',
    'select coalesce(sum(item.quantity * item.unit_price), 0)'
  );
  updated_definition := replace(
    updated_definition,
    'v_bonus := round(v_matching_base * (v_campaign.multiplier - 1) + v_campaign.fixed_bonus, 2);',
    'v_bonus := round(v_matching_base * v_campaign.multiplier / 100 + v_campaign.fixed_bonus, 2);'
  );
  updated_definition := replace(
    updated_definition,
    '''multiplier'', v_campaign.multiplier',
    '''percentage'', v_campaign.multiplier'
  );

  if updated_definition = current_definition
    or position('v_campaign.multiplier / 100' in updated_definition) = 0
  then
    raise exception 'Não foi possível alinhar o cashback ao percentual do produto';
  end if;

  execute updated_definition;
end;
$$;
