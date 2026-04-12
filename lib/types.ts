/* ─── 서비스 타입 ─── */
export type ServiceType = 'cruise' | 'airport' | 'hotel' | 'tour' | 'rentcar';

/* ─── 예약 메인 ─── */
export interface Reservation {
  re_id: string;
  re_user_id: string;
  re_type: ServiceType | 'package' | 'ticket';
  re_status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  re_quote_id?: string;
  re_created_at: string;
  re_updated_at?: string;
}

/* ─── 예약 상세 (서비스별) ─── */
export interface ReservationCruise {
  reservation_id: string;
  room_price_code?: string;
  checkin?: string;
  checkout?: string;
  guest_count?: number;
  adult_count?: number;
  child_count?: number;
  infant_count?: number;
  room_total_price?: number;
  request_note?: string;
}

export interface ReservationCruiseCar {
  reservation_id: string;
  car_price_code?: string;
  car_total_price?: number;
}

export interface ReservationAirport {
  reservation_id: string;
  service_type?: 'pickup' | 'dropoff' | 'transfer';
  flight_number?: string;
  pickup_date?: string;
  passenger_count?: number;
  total_price?: number;
  request_note?: string;
}

export interface ReservationHotel {
  reservation_id: string;
  hotel_name?: string;
  checkin?: string;
  checkout?: string;
  room_type?: string;
  room_count?: number;
  total_price?: number;
  request_note?: string;
}

export interface ReservationTour {
  reservation_id: string;
  tour_name?: string;
  tour_date?: string;
  participant_count?: number;
  total_price?: number;
  request_note?: string;
}

export interface ReservationRentcar {
  reservation_id: string;
  route?: string;
  vehicle_type?: string;
  pickup_date?: string;
  return_date?: string;
  total_price?: number;
  request_note?: string;
}

/* ─── 가격 테이블 ─── */
export interface CruiseRateCard {
  id: string;
  cruise_name: string;
  schedule_type?: string;
  room_type: string;
  room_type_en?: string;
  price_adult: number;
  price_child: number;
  price_child_extra_bed?: number;
  price_infant: number;
  price_extra_bed?: number;
  price_single?: number;
  valid_year?: number;
  valid_from?: string;
  valid_to?: string;
  season_name?: string;
  is_active?: boolean;
}

export interface CarPrice {
  id: string;
  cruise?: string;
  vehicle_type: string;
  category?: string;
  way_type?: string;
  route?: string;
  price: number;
  valid_from?: string;
  valid_to?: string;
}

export interface AirportPrice {
  id: string;
  airport_code?: string;
  service_type?: string;
  route?: string;
  vehicle_type?: string;
  price: number;
  valid_from?: string;
  valid_to?: string;
}

export interface HotelPrice {
  id: string;
  hotel_name: string;
  room_type?: string;
  room_name?: string;
  base_price: number;
  checkin_day?: string;
  checkout_day?: string;
  valid_from?: string;
  valid_to?: string;
}

export interface TourPricing {
  pricing_id: string;
  tour_id?: string;
  min_guests?: number;
  max_guests?: number;
  price_per_person: number;
}

export interface RentcarPrice {
  id: string;
  route?: string;
  vehicle_type?: string;
  way_type?: string;
  price: number;
  capacity?: number;
  valid_from?: string;
  valid_to?: string;
}

/* ─── 환율 ─── */
export interface ExchangeRate {
  currency_code: string;
  rate_to_krw: number;
  last_updated: string;
  source: string;
}

/* ─── 견적 (참조용 - 읽기전용) ─── */
export interface Quote {
  id: string;
  title?: string;
  status: string;
}
