import supabase from '@/lib/supabase';
import type { DraftEnvelope } from '@/lib/bookingDraftMapper';
import { buildReservationInsert } from '@/lib/bookingDraftMapper';

export interface SubmitAllResult {
  created: number;
  errors: string[];
}

async function ensureReservationSubmitUser(): Promise<string | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return '로그인 세션 확인에 실패했습니다.';
  }

  const authUser = authData.user;
  const now = new Date().toISOString();

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingUserError) {
    return `사용자 정보 확인 실패: ${existingUserError.message}`;
  }

  if (!existingUser) {
    const { error: insertUserError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        role: 'member',
        created_at: now,
        updated_at: now,
      });

    if (insertUserError) {
      return `사용자 등록 실패: ${insertUserError.message}`;
    }

    return null;
  }

  if (!existingUser.role || existingUser.role === 'guest') {
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        role: 'member',
        updated_at: now,
      })
      .eq('id', authUser.id);

    if (updateUserError) {
      return `사용자 권한 갱신 실패: ${updateUserError.message}`;
    }
  }

  return null;
}

// ── 서비스별 상세 테이블 저장 ──

async function saveCruiseDetail(reservationId: string, payload: any): Promise<string | null> {
  const { form, roomSelections, priceResult, vehicleForm, selectedTourOptions, childExtraBedBirthDates, selectedShtSeat } = payload;
  if (!form || !priceResult) return null; // 데이터 없으면 스킵

  const totalAdultCount = (roomSelections || []).reduce((s: number, r: any) => s + (r.adult_count || 0), 0);
  const totalChildCount = (roomSelections || []).reduce((s: number, r: any) => s + (r.child_count || 0), 0);
  const totalChildExtraBedCount = (roomSelections || []).reduce((s: number, r: any) => s + (r.child_extra_bed_count || 0), 0);
  const totalInfantCount = (roomSelections || []).reduce((s: number, r: any) => s + (r.infant_count || 0), 0);
  const totalExtraBedCount = (roomSelections || []).reduce((s: number, r: any) => s + (r.extra_bed_count || 0), 0);
  const totalSingleCount = (roomSelections || []).reduce((s: number, r: any) => s + (r.single_count || 0), 0);
  const totalRoomCount = priceResult.total_room_count || (roomSelections || []).length || 1;

  // request_note 구성
  const noteParts: string[] = [];
  if (form.room_request_note) noteParts.push(form.room_request_note);
  if (Array.isArray(selectedTourOptions) && selectedTourOptions.length > 0) {
    noteParts.push('당일투어: ' + selectedTourOptions.map((o: any) => `${o.option_name} x${o.quantity}`).join(', '));
  }
  if (Array.isArray(childExtraBedBirthDates) && childExtraBedBirthDates.length > 0) {
    noteParts.push('아동엑베 생년월일: ' + childExtraBedBirthDates.join(', '));
  }

  const { error } = await supabase.from('reservation_cruise').insert({
    reservation_id: reservationId,
    room_price_code: priceResult.primary_rate_card?.id || null,
    adult_count: totalAdultCount,
    child_count: totalChildCount,
    child_extra_bed_count: totalChildExtraBedCount,
    infant_count: totalInfantCount,
    extra_bed_count: totalExtraBedCount,
    single_count: totalSingleCount,
    room_count: totalRoomCount,
    checkin: form.checkin || null,
    request_note: noteParts.join('\n') || null,
    connecting_room: form.connecting_room || false,
    birthday_event: form.birthday_event || false,
    birthday_name: form.birthday_name || '',
    room_total_price: priceResult.grand_total || 0,
    price_breakdown: priceResult.price_breakdown || null,
    accommodation_info: form.pickup_location || null,
  });

  if (error) return `reservation_cruise: ${error.message}`;

  // SHT 차량 좌석
  if (selectedShtSeat?.seat) {
    await supabase.from('reservation_car_sht').insert({
      reservation_id: reservationId,
      vehicle_number: selectedShtSeat.vehicle || null,
      seat_number: selectedShtSeat.seat,
    });
  }

  return null;
}

async function saveAirportDetail(reservationId: string, payload: any): Promise<string | null> {
  const { form, price1, price2 } = payload;
  if (!form) return null;

  const insertRows: any[] = [];

  // 픽업 행
  if (form.serviceType === 'pickup' || form.serviceType === 'both') {
    insertRows.push({
      reservation_id: reservationId,
      airport_price_code: form.airportCode1 || null,
      ra_airport_location: form.pickupAirportName || form.airportName || null,
      accommodation_info: form.pickupLocation || null,
      ra_flight_number: form.pickupFlightNumber || null,
      ra_datetime: form.pickupDatetime || null,
      ra_passenger_count: form.passengerCount || 1,
      ra_luggage_count: form.luggageCount || 0,
      ra_car_count: 1,
      way_type: 'pickup',
      unit_price: price1 || 0,
      total_price: price1 || 0,
    });
  }

  // 샌딩 행
  if (form.serviceType === 'sending' || form.serviceType === 'both') {
    const airportCode = form.serviceType === 'both' ? form.airportCode2 : form.airportCode1;
    const price = form.serviceType === 'both' ? (price2 || 0) : (price1 || 0);
    insertRows.push({
      reservation_id: reservationId,
      airport_price_code: airportCode || null,
      ra_airport_location: form.sendingAirportName || form.airportName || null,
      accommodation_info: form.sendingLocation || null,
      ra_flight_number: form.sendingFlightNumber || null,
      ra_datetime: form.sendingDatetime || null,
      ra_passenger_count: form.passengerCount || 1,
      ra_luggage_count: form.luggageCount || 0,
      ra_car_count: 1,
      way_type: 'sending',
      unit_price: price,
      total_price: price,
    });
  }

  for (const row of insertRows) {
    const { error } = await supabase.from('reservation_airport').insert(row);
    if (error) return `reservation_airport: ${error.message}`;
  }

  return null;
}

async function saveHotelDetail(reservationId: string, payload: any): Promise<string | null> {
  const { formData, selectedHotel, nights, schedule } = payload;
  if (!formData || !selectedHotel) return null;

  const unitPrice = selectedHotel.base_price || selectedHotel.price || 0;
  const roomCount = formData.room_count || 1;
  const totalPrice = unitPrice * roomCount * (nights || 1);
  const totalGuests = (formData.adult_count || 0) + (formData.child_count || 0);

  const { error } = await supabase.from('reservation_hotel').insert({
    reservation_id: reservationId,
    hotel_price_code: selectedHotel.hotel_price_code || null,
    schedule: schedule || null,
    room_count: roomCount,
    guest_count: totalGuests || 1,
    checkin_date: formData.checkin_date || null,
    unit_price: unitPrice,
    total_price: totalPrice,
    request_note: formData.special_requests || null,
  });

  if (error) return `reservation_hotel: ${error.message}`;
  return null;
}

async function saveRentcarDetail(reservationId: string, payload: any): Promise<string | null> {
  const { vehicles, requestNote } = payload;
  if (!Array.isArray(vehicles) || vehicles.length === 0) return null;

  const ROUND_TRIP_TYPES = ['당일왕복', '다른날왕복'];

  for (const vehicle of vehicles) {
    const isRoundTrip = ROUND_TRIP_TYPES.includes(vehicle.wayType);
    const unitPrice = vehicle.rentcar?.price || 0;

    const { error } = await supabase.from('reservation_rentcar').insert({
      reservation_id: reservationId,
      rentcar_price_code: vehicle.rentcar?.rent_code || null,
      pickup_datetime: vehicle.pickup_datetime ? new Date(vehicle.pickup_datetime).toISOString() : null,
      pickup_location: vehicle.pickup_location || null,
      destination: vehicle.destination || null,
      via_location: vehicle.via_location || null,
      via_waiting: vehicle.via_waiting || null,
      return_datetime: isRoundTrip && vehicle.return_datetime ? new Date(vehicle.return_datetime).toISOString() : null,
      return_pickup_location: isRoundTrip ? (vehicle.return_pickup_location || null) : null,
      return_destination: isRoundTrip ? (vehicle.return_destination || null) : null,
      return_via_location: isRoundTrip ? (vehicle.return_via_location || null) : null,
      return_via_waiting: isRoundTrip ? (vehicle.return_via_waiting || null) : null,
      luggage_count: vehicle.luggage_count || 0,
      passenger_count: vehicle.passenger_count || 1,
      car_count: vehicle.car_count || 1,
      unit_price: unitPrice,
      total_price: unitPrice * (vehicle.car_count || 1),
      request_note: requestNote || null,
      way_type: vehicle.wayType || '편도',
    });

    if (error) return `reservation_rentcar: ${error.message}`;
  }

  return null;
}

async function saveTourDetail(reservationId: string, payload: any): Promise<string | null> {
  const { formData, matchedPricing, guestCount, finalPrice, totalPrice, requestNote } = payload;
  if (!formData) return null;

  const { error } = await supabase.from('reservation_tour').insert({
    reservation_id: reservationId,
    tour_price_code: matchedPricing?.pricing_id || null,
    tour_capacity: guestCount || 1,
    usage_date: formData.tour_date || null,
    pickup_location: formData.pickup_location || null,
    dropoff_location: formData.dropoff_location || null,
    request_note: requestNote || null,
    unit_price: finalPrice || 0,
    total_price: totalPrice || (finalPrice || 0) * (guestCount || 1),
  });

  if (error) return `reservation_tour: ${error.message}`;
  return null;
}

async function saveTicketDetail(reservationId: string, payload: any): Promise<string | null> {
  const { ticketType, formData, requestNote } = payload;
  if (!formData) return null;

  const { error } = await supabase.from('reservation_tour').insert({
    reservation_id: reservationId,
    tour_capacity: formData.ticket_quantity || 1,
    usage_date: formData.ticket_date || null,
    pickup_location: formData.pickup_location || null,
    dropoff_location: formData.dropoff_location || null,
    request_note: requestNote || null,
  });

  if (error) return `reservation_tour(ticket): ${error.message}`;
  return null;
}

async function savePackageDetail(reservationId: string, payload: any): Promise<string | null> {
  const { selectedPackage, applicantData, additionalRequests, totalPrice } = payload;
  if (!selectedPackage || !applicantData) return null;

  const { error } = await supabase.from('reservation_package').insert({
    reservation_id: reservationId,
    package_id: selectedPackage.id || null,
    adult_count: applicantData.adults || 0,
    child_extra_bed: applicantData.childExtraBed || 0,
    child_no_extra_bed: applicantData.childNoExtraBed || 0,
    infant_free: applicantData.infantFree || 0,
    infant_tour: applicantData.infantTour || 0,
    infant_extra_bed: applicantData.infantExtraBed || 0,
    infant_seat: applicantData.infantSeat || 0,
    total_price: totalPrice || 0,
    additional_requests: additionalRequests || null,
  });

  if (error) return `reservation_package: ${error.message}`;
  return null;
}

// 서비스 타입별 상세 저장 라우터
async function saveServiceDetail(reservationId: string, envelope: DraftEnvelope): Promise<string | null> {
  const payload = envelope.payload;
  if (!payload) return null;

  switch (envelope.serviceType) {
    case 'cruise': return saveCruiseDetail(reservationId, payload);
    case 'airport': return saveAirportDetail(reservationId, payload);
    case 'hotel': return saveHotelDetail(reservationId, payload);
    case 'rentcar': return saveRentcarDetail(reservationId, payload);
    case 'tour': return saveTourDetail(reservationId, payload);
    case 'ticket': return saveTicketDetail(reservationId, payload);
    case 'package': return savePackageDetail(reservationId, payload);
    default: return null;
  }
}

// Phase-2: draft envelope를 reservation 메인행 + 서비스 상세 테이블에 저장
export async function submitAllDraftReservations(envelopes: DraftEnvelope[]): Promise<SubmitAllResult> {
  const errors: string[] = [];
  let created = 0;

  const ensureUserError = await ensureReservationSubmitUser();
  if (ensureUserError) {
    return { created, errors: [ensureUserError] };
  }

  for (const envelope of envelopes) {
    // 1. reservation 메인 행 INSERT + re_id 반환
    const { data: reservationData, error: reservationError } = await supabase
      .from('reservation')
      .insert(buildReservationInsert(envelope))
      .select('re_id')
      .single();

    if (reservationError || !reservationData?.re_id) {
      errors.push(`${envelope.serviceType}: ${reservationError?.message || 'reservation INSERT 실패'}`);
      continue;
    }

    // 2. 서비스별 상세 테이블 INSERT
    const detailError = await saveServiceDetail(reservationData.re_id, envelope);
    if (detailError) {
      errors.push(`${envelope.serviceType} 상세: ${detailError}`);
      // 메인 행은 이미 생성됨 - 상세 실패해도 created 카운트
    }

    created += 1;
  }

  return { created, errors };
}
