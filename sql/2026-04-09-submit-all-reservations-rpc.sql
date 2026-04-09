-- Phase-1: 전체 예약 신청 게이트용 원자성/중복방지 기반
-- 적용 위치: Supabase SQL Editor

create table if not exists public.direct_booking_submit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  quote_id uuid not null,
  idempotency_key text not null,
  payload jsonb null,
  created_at timestamptz not null default now(),
  unique (user_id, quote_id, idempotency_key)
);

create or replace function public.submit_all_reservations_phase1(
  p_user_id uuid,
  p_quote_id uuid,
  p_idempotency_key text,
  p_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_exists uuid;
  v_updated int;
begin
  select id into v_exists
  from public.direct_booking_submit_requests
  where user_id = p_user_id
    and quote_id = p_quote_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if v_exists is not null then
    return jsonb_build_object('ok', true, 'deduped', true, 'request_id', v_exists);
  end if;

  insert into public.direct_booking_submit_requests (user_id, quote_id, idempotency_key, payload)
  values (p_user_id, p_quote_id, p_idempotency_key, p_payload)
  returning id into v_exists;

  update public.quote
  set submitted_at = now()
  where id = p_quote_id
    and user_id = p_user_id;

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'ok', true,
    'deduped', false,
    'request_id', v_exists,
    'quote_updated', v_updated > 0
  );
end;
$$;

grant execute on function public.submit_all_reservations_phase1(uuid, uuid, text, jsonb) to anon, authenticated, service_role;
