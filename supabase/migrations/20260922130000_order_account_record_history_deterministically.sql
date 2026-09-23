-- Make equal-time Account Record history deterministic by creation sequence.
-- The existing cursor signature is retained; its id resolves the cursor row's
-- created_at without changing either client contract.

do $$
declare
  v_oid regprocedure;
  v_definition text;
  v_signature text;
begin
  foreach v_signature in array array[
    'public.get_account_record_history(uuid,timestamptz,uuid,integer,text)',
    'public.get_account_record_history(uuid,timestamptz,uuid,integer,text,text,date,date,text,uuid,uuid,numeric,numeric)'
  ] loop
    v_oid := v_signature::regprocedure;
    v_definition := pg_catalog.pg_get_functiondef(v_oid);

    if pg_catalog.strpos(v_definition, '      t.occurred_at,') = 0
      or pg_catalog.strpos(v_definition, 'or (r.occurred_at, r.id) < (p_cursor_occurred_at, p_cursor_id)') = 0
      or pg_catalog.strpos(v_definition, 'order by r.occurred_at desc, r.id desc') = 0 then
      raise exception 'unexpected Account Record history definition for %', v_signature;
    end if;

    v_definition := pg_catalog.replace(
      v_definition,
      '      t.occurred_at,',
      '      t.occurred_at,' || chr(10) || '      t.created_at,'
    );
    v_definition := pg_catalog.replace(
      v_definition,
      'or (r.occurred_at, r.id) < (p_cursor_occurred_at, p_cursor_id)',
      'or (r.occurred_at, r.created_at, r.id) < (' || chr(10) ||
      '        p_cursor_occurred_at,' || chr(10) ||
      '        (select cursor_transaction.created_at' || chr(10) ||
      '         from public.financial_transactions cursor_transaction' || chr(10) ||
      '         where cursor_transaction.id = p_cursor_id' || chr(10) ||
      '           and cursor_transaction.user_id = v_user_id' || chr(10) ||
      '           and cursor_transaction.occurred_at = p_cursor_occurred_at),' || chr(10) ||
      '        p_cursor_id' || chr(10) ||
      '      )'
    );
    v_definition := pg_catalog.replace(
      v_definition,
      'order by r.occurred_at desc, r.id desc',
      'order by r.occurred_at desc, r.created_at desc, r.id desc'
    );

    execute v_definition;
  end loop;
end;
$$;

comment on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text) is
  'Returns visible effective Account Record history for one owned Cash/Bank account using occurred_at/created_at/id keyset ordering, including complete native-currency totals for each supplied local calendar date.';

comment on function public.get_account_record_history(uuid, timestamptz, uuid, integer, text, text, date, date, text, uuid, uuid, numeric, numeric) is
  'Returns filtered effective Account Record history for one owned Cash/Bank account using occurred_at/created_at/id keyset ordering and complete filtered native-currency daily totals.';
