import supabase from '@/lib/supabase';

/* ── 타입 ── */

export interface CruiseRateCard {
  id: string;
  cruise_name: string;
  schedule_type: string;
  room_type: string;
  room_type_en: string;
  price_adult: number;
  price_child: number;
  price_child_extra_bed: number;
  price_infant: number;
  price_extra_bed: number;
  price_single: number;
  valid_year: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  is_promotion: boolean;
}

export interface CruiseHolidaySurcharge {
  id: string;
  cruise_name: string;
  schedule_type: string;
  holiday_date: string;
  holiday_date_end: string | null;
  surcharge_per_person: number;
  surcharge_child: number;
  is_confirmed: boolean;
}

export interface CruiseTourOption {
  option_id: string;
  cruise_name: string;
  schedule_type: string;
  option_name: string;
  option_price: number;
  option_type: string;
  is_active: boolean;
}

export interface SelectedTourOption {
  option_id: string;
  option_name: string;
  option_price: number;
  quantity: number;
}

export interface PriceLineItem {
  label: string;
  unit_price: number;
  count: number;
  subtotal: number;
}

export interface SurchargeLineItem {
  label: string;
  date: string;
  amount_per_person: number;
  person_count: number;
  subtotal: number;
  is_confirmed: boolean;
}

export interface CruisePriceResult {
  primary_rate_card: CruiseRateCard;
  line_items: PriceLineItem[];
  surcharge_items: SurchargeLineItem[];
  subtotal: number;
  surcharge_total: number;
  option_total: number;
  grand_total: number;
  total_room_count: number;
  price_breakdown: Record<string, unknown>;
}

export interface CruisePriceInput {
  cruise_name: string;
  schedule: string;
  room_type: string;
  checkin_date: string;
  adult_count: number;
  child_count: number;
  child_extra_bed_count: number;
  infant_count: number;
  extra_bed_count: number;
  single_count: number;
  room_count: number;
  tour_options?: SelectedTourOption[];
}

export interface CruiseFilterInput {
  schedule?: string;
  checkin_date?: string;
  cruise_name?: string;
}

/* ── 유틸리티 ── */

function toScheduleType(schedule: string): string {
  if (schedule === '1박2일' || schedule === '1N2D') return '1N2D';
  if (schedule === '2박3일' || schedule === '2N3D') return '2N3D';
  if (schedule === '당일' || schedule === 'DAY') return 'DAY';
  return schedule;
}

function getYear(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

export function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' VND';
}

export function formatVNDKorean(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return Number.isInteger(m) ? `${m}백만 VND` : `${m.toFixed(1)}백만 VND`;
  }
  return formatVND(amount);
}

/* ── 데이터 조회 ── */

export async function getCruiseNames(filter: CruiseFilterInput): Promise<string[]> {
  if (!filter.schedule || !filter.checkin_date) return [];

  const scheduleType = toScheduleType(filter.schedule);
  const year = getYear(filter.checkin_date);

  const { data, error } = await supabase
    .from('cruise_rate_card')
    .select('cruise_name')
    .eq('schedule_type', scheduleType)
    .eq('valid_year', year)
    .eq('is_active', true)
    .lte('valid_from', filter.checkin_date)
    .gte('valid_to', filter.checkin_date);

  if (error || !data) return [];
  return [...new Set(data.map((r) => r.cruise_name))].sort();
}

export async function getRoomTypes(filter: CruiseFilterInput): Promise<CruiseRateCard[]> {
  if (!filter.schedule || !filter.checkin_date || !filter.cruise_name) return [];

  const scheduleType = toScheduleType(filter.schedule);
  const year = getYear(filter.checkin_date);

  const { data, error } = await supabase
    .from('cruise_rate_card')
    .select('*')
    .eq('cruise_name', filter.cruise_name)
    .eq('schedule_type', scheduleType)
    .eq('valid_year', year)
    .eq('is_active', true)
    .lte('valid_from', filter.checkin_date)
    .gte('valid_to', filter.checkin_date);

  if (error || !data) return [];
  return data as CruiseRateCard[];
}

export async function getTourOptions(
  cruiseName: string,
  schedule: string,
): Promise<CruiseTourOption[]> {
  const scheduleType = toScheduleType(schedule);
  const { data, error } = await supabase
    .from('cruise_tour_options')
    .select('*')
    .eq('cruise_name', cruiseName)
    .eq('schedule_type', scheduleType)
    .eq('is_active', true);

  if (error || !data) return [];
  return data as CruiseTourOption[];
}

async function getHolidaySurcharges(
  cruiseName: string,
  schedule: string,
  checkinDate: string,
): Promise<CruiseHolidaySurcharge[]> {
  const scheduleType = toScheduleType(schedule);
  const { data, error } = await supabase
    .from('cruise_holiday_surcharge')
    .select('*')
    .eq('cruise_name', cruiseName)
    .eq('schedule_type', scheduleType)
    .lte('holiday_date', checkinDate)
    .or(`holiday_date_end.is.null,holiday_date_end.gte.${checkinDate}`);

  if (error || !data) return [];
  return data as CruiseHolidaySurcharge[];
}

async function getRateCard(
  cruiseName: string,
  schedule: string,
  roomType: string,
  checkinDate: string,
): Promise<CruiseRateCard | null> {
  const scheduleType = toScheduleType(schedule);
  const year = getYear(checkinDate);

  const { data, error } = await supabase
    .from('cruise_rate_card')
    .select('*')
    .eq('cruise_name', cruiseName)
    .eq('schedule_type', scheduleType)
    .eq('room_type', roomType)
    .eq('valid_year', year)
    .eq('is_active', true)
    .lte('valid_from', checkinDate)
    .gte('valid_to', checkinDate)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as CruiseRateCard;
}

export async function getRateCardInclusions(
  rateCardIds: string[],
): Promise<Record<string, string[]>> {
  if (!rateCardIds.length) return {};
  const { data, error } = await supabase
    .from('cruise_rate_card_inclusions')
    .select('rate_card_id, inclusion_text, display_order')
    .in('rate_card_id', rateCardIds)
    .order('display_order');

  if (error || !data) return {};
  const map: Record<string, string[]> = {};
  for (const row of data) {
    if (!map[row.rate_card_id]) map[row.rate_card_id] = [];
    map[row.rate_card_id].push(row.inclusion_text);
  }
  return map;
}

/* ── 가격 계산 ── */

export async function calculateCruisePrice(
  input: CruisePriceInput,
): Promise<CruisePriceResult | null> {
  // 병렬 쿼리: rate card + surcharges + tour options 동시 조회
  const [rateCard, surcharges, tourOpts] = await Promise.all([
    getRateCard(input.cruise_name, input.schedule, input.room_type, input.checkin_date),
    getHolidaySurcharges(input.cruise_name, input.schedule, input.checkin_date),
    input.schedule === '당일'
      ? getTourOptions(input.cruise_name, input.schedule)
      : Promise.resolve([]),
  ]);

  if (!rateCard) return null;

  const lineItems: PriceLineItem[] = [];
  let subtotal = 0;

  // 성인
  if (input.adult_count > 0) {
    const amt = rateCard.price_adult * input.adult_count;
    lineItems.push({ label: '성인', unit_price: rateCard.price_adult, count: input.adult_count, subtotal: amt });
    subtotal += amt;
  }

  // 아동
  if (input.child_count > 0) {
    const amt = rateCard.price_child * input.child_count;
    lineItems.push({ label: '아동', unit_price: rateCard.price_child, count: input.child_count, subtotal: amt });
    subtotal += amt;
  }

  // 아동 엑스트라 베드
  if (input.child_extra_bed_count > 0) {
    const amt = rateCard.price_child_extra_bed * input.child_extra_bed_count;
    lineItems.push({ label: '아동(엑스트라)', unit_price: rateCard.price_child_extra_bed, count: input.child_extra_bed_count, subtotal: amt });
    subtotal += amt;
  }

  // 유아 (첫째 무료)
  if (input.infant_count > 0) {
    const chargeableInfants = Math.max(0, input.infant_count - 1);
    if (chargeableInfants > 0) {
      const amt = rateCard.price_infant * chargeableInfants;
      lineItems.push({ label: '유아(추가)', unit_price: rateCard.price_infant, count: chargeableInfants, subtotal: amt });
      subtotal += amt;
    }
  }

  // 엑스트라 베드
  if (input.extra_bed_count > 0) {
    const amt = rateCard.price_extra_bed * input.extra_bed_count;
    lineItems.push({ label: '엑스트라 베드', unit_price: rateCard.price_extra_bed, count: input.extra_bed_count, subtotal: amt });
    subtotal += amt;
  }

  // 싱글 차지
  if (input.single_count > 0) {
    const amt = rateCard.price_single * input.single_count;
    lineItems.push({ label: '싱글 차지', unit_price: rateCard.price_single, count: input.single_count, subtotal: amt });
    subtotal += amt;
  }

  // 공휴일 할증
  const surchargeItems: SurchargeLineItem[] = [];
  let surchargeTotal = 0;

  for (const s of surcharges) {
    const isInfantOnly = s.surcharge_per_person === 0 && s.surcharge_child === 0;
    if (isInfantOnly) continue;

    const adultAmt = s.surcharge_per_person * input.adult_count;
    const childAmt = (s.surcharge_child || s.surcharge_per_person) * input.child_count;
    const totalAmt = adultAmt + childAmt;

    surchargeItems.push({
      label: '공휴일 할증',
      date: s.holiday_date,
      amount_per_person: s.surcharge_per_person,
      person_count: input.adult_count + input.child_count,
      subtotal: totalAmt,
      is_confirmed: s.is_confirmed,
    });

    if (s.is_confirmed) surchargeTotal += totalAmt;
  }

  // 투어 옵션
  let optionTotal = 0;
  const selectedOpts = input.tour_options ?? [];
  for (const opt of selectedOpts) {
    optionTotal += opt.option_price * opt.quantity;
  }

  // 객실 수 곱하기
  const roomMultiplied = subtotal * (input.room_count || 1);
  const grandTotal = roomMultiplied + surchargeTotal + optionTotal;

  return {
    primary_rate_card: rateCard,
    line_items: lineItems,
    surcharge_items: surchargeItems,
    subtotal,
    surcharge_total: surchargeTotal,
    option_total: optionTotal,
    grand_total: grandTotal,
    total_room_count: input.room_count || 1,
    price_breakdown: {
      rate_card_id: rateCard.id,
      cruise_name: input.cruise_name,
      schedule: input.schedule,
      room_type: input.room_type,
      checkin_date: input.checkin_date,
      line_items: lineItems,
      surcharge_items: surchargeItems,
      option_items: selectedOpts,
      subtotal,
      surcharge_total: surchargeTotal,
      option_total: optionTotal,
      room_count: input.room_count || 1,
      grand_total: grandTotal,
    },
  };
}
