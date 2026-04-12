import supabase from '@/lib/supabase';

export interface SubmitResult {
  reservationId: string | null;
  error: string | null;
}

/** 예약자 users 테이블 등록/승격 */
async function ensureUser(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return '로그인 세션 확인에 실패했습니다.';

    const user = data.user;
    const now = new Date().toISOString();

    const { data: existing, error: fetchErr } = await supabase
      .from('users')
      .select('id,role')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchErr) return `사용자 정보 확인 실패: ${fetchErr.message}`;

    if (!existing) {
      const { error: insertErr } = await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        role: 'member',
        created_at: now,
        updated_at: now,
      });
      if (insertErr) return `사용자 등록 실패: ${insertErr.message}`;
    } else if (!existing.role || existing.role === 'guest') {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ role: 'member', updated_at: now })
        .eq('id', user.id);
      if (updateErr) return `사용자 권한 갱신 실패: ${updateErr.message}`;
    }

    return null;
  } catch (err: unknown) {
    return `사용자 확인 중 오류: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** 메인 reservation 행 생성 */
async function createReservation(
  userId: string,
  serviceType: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('reservation')
    .insert({
      re_user_id: userId,
      re_type: serviceType,
      re_status: 'pending',
    })
    .select('re_id')
    .single();

  if (error) return { id: null, error: `reservation 생성 실패: ${error.message}` };
  return { id: data.re_id as string, error: null };
}

/* ─────── 서비스별 상세 저장 ─────── */

export async function saveCruiseDetail(
  reservationId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const form = payload.form as Record<string, unknown> | undefined;
    const roomSelections = (payload.roomSelections ?? []) as Record<string, unknown>[];
    const priceResult = (payload.priceResult ?? {}) as Record<string, unknown>;
    const selectedTourOptions = payload.selectedTourOptions as Record<string, unknown>[] | undefined;

    const sum = (key: string) =>
      roomSelections.reduce((s, r) => s + (Number(r[key]) || 0), 0);

    const totalAdult = sum('adult_count');
    const totalChild = sum('child_count');
    const totalChildExtra = sum('child_extra_bed_count');
    const totalInfant = sum('infant_count');
    const totalExtra = sum('extra_bed_count');
    const totalSingle = sum('single_count');
    const totalGuest = totalAdult + totalChild + totalInfant;

    const noteParts: string[] = [];
    if (form?.room_request_note) noteParts.push(String(form.room_request_note));
    if (selectedTourOptions?.length) {
      noteParts.push(
        '당일투어: ' +
          selectedTourOptions
            .map((o) => `${o.option_name} x${o.quantity}`)
            .join(', '),
      );
    }

    const rateCard = priceResult.primary_rate_card as Record<string, unknown> | undefined;

    const { error } = await supabase.from('reservation_cruise').insert({
      reservation_id: reservationId,
      room_price_code: rateCard?.id ?? '',
      adult_count: totalAdult,
      child_count: totalChild,
      child_extra_bed_count: totalChildExtra,
      infant_count: totalInfant,
      extra_bed_count: totalExtra,
      single_count: totalSingle,
      room_count: Number(priceResult.total_room_count) || roomSelections.length || 1,
      guest_count: totalGuest || 1,
      unit_price: Number(rateCard?.price ?? priceResult.unit_price ?? 0),
      checkin: form?.checkin ?? new Date().toISOString().slice(0, 10),
      request_note: noteParts.join('\n') || null,
      connecting_room: form?.connecting_room ?? false,
      birthday_event: form?.birthday_event ?? false,
      birthday_name: form?.birthday_name ?? '',
      room_total_price: Number(priceResult.grand_total) || 0,
      accommodation_info: form?.pickup_location ?? null,
    });

    if (error) return `reservation_cruise: ${error.message}`;

    if (priceResult.price_breakdown) {
      await supabase
        .from('reservation')
        .update({ price_breakdown: priceResult.price_breakdown })
        .eq('re_id', reservationId);
    }

    /* ── 크루즈 차량 저장 ── */
    const carData = payload.carData as Record<string, unknown> | null;
    if (carData && carData.car_code) {
      const isShuttle = String(carData.car_type ?? '').includes('셔틀') && !String(carData.car_type ?? '').includes('단독');
      const inputCount = Number(carData.car_count) || 1;

      // 차량 가격 조회
      const { data: carPriceData } = await supabase
        .from('rentcar_price')
        .select('*')
        .eq('rent_code', carData.car_code)
        .maybeSingle();

      const unitPrice = Number((carPriceData as Record<string, unknown>)?.price ?? 0);
      const totalPrice = unitPrice * inputCount;

      // 차량 전용 reservation 생성
      const { data: user } = await supabase.auth.getUser();
      if (user?.user) {
        const { data: carRes } = await supabase.from('reservation').insert({
          re_user_id: user.user.id,
          re_type: 'car',
          re_status: 'pending',
          total_amount: totalPrice,
        }).select('re_id').single();

        if (carRes) {
          // 반환일 계산
          let returnDatetime: string | null = null;
          const carCat = String(carData.car_category ?? '');
          if (carCat === '당일왕복') {
            returnDatetime = form?.checkin as string ?? null;
          } else if (carCat === '다른날왕복') {
            const rd = new Date(form?.checkin as string ?? '');
            rd.setDate(rd.getDate() + (form?.schedule === '2박3일' ? 2 : 1));
            returnDatetime = rd.toISOString().split('T')[0];
          }

          await supabase.from('reservation_cruise_car').insert({
            reservation_id: carRes.re_id,
            car_price_code: carData.car_code,
            way_type: carData.car_category,
            route: carData.car_route,
            vehicle_type: carData.car_type,
            car_count: isShuttle ? 0 : inputCount,
            passenger_count: isShuttle ? inputCount : 0,
            pickup_datetime: form?.checkin ?? null,
            pickup_location: form?.pickup_location ?? null,
            return_datetime: returnDatetime,
            unit_price: unitPrice,
            car_total_price: totalPrice,
          });
        }
      }
    }

    return null;
  } catch (err: unknown) {
    return `reservation_cruise 예외: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function saveAirportDetail(
  reservationId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const form = payload.form as Record<string, unknown>;
    if (!form) return null;

    const rows: Record<string, unknown>[] = [];
    const svc = form.serviceType as string;

    if (svc === 'pickup' || svc === 'both') {
      rows.push({
        reservation_id: reservationId,
        airport_price_code: form.airportCode1 ?? null,
        ra_airport_location: form.pickupAirportName ?? form.airportName ?? null,
        accommodation_info: form.pickupLocation ?? null,
        ra_flight_number: form.pickupFlightNumber ?? null,
        ra_datetime: form.pickupDatetime ?? null,
        ra_passenger_count: form.passengerCount ?? 1,
        ra_luggage_count: form.luggageCount ?? 0,
        ra_car_count: 1,
        way_type: 'pickup',
        unit_price: Number(payload.price1) || 0,
        total_price: Number(payload.price1) || 0,
      });
    }

    if (svc === 'sending' || svc === 'both') {
      const code = svc === 'both' ? form.airportCode2 : form.airportCode1;
      const price = svc === 'both' ? Number(payload.price2) || 0 : Number(payload.price1) || 0;
      rows.push({
        reservation_id: reservationId,
        airport_price_code: code ?? null,
        ra_airport_location: form.sendingAirportName ?? form.airportName ?? null,
        accommodation_info: form.sendingLocation ?? null,
        ra_flight_number: form.sendingFlightNumber ?? null,
        ra_datetime: form.sendingDatetime ?? null,
        ra_passenger_count: form.passengerCount ?? 1,
        ra_luggage_count: form.luggageCount ?? 0,
        ra_car_count: 1,
        way_type: 'sending',
        unit_price: price,
        total_price: price,
      });
    }

    for (const row of rows) {
      const { error } = await supabase.from('reservation_airport').insert(row);
      if (error) return `reservation_airport: ${error.message}`;
    }
    return null;
  } catch (err: unknown) {
    return `reservation_airport 예외: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function saveHotelDetail(
  reservationId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const formData = payload.formData as Record<string, unknown>;
    const hotel = payload.selectedHotel as Record<string, unknown>;
    if (!formData || !hotel) return null;

    const unitPrice = Number(hotel.base_price ?? hotel.price ?? 0);
    const roomCount = Number(formData.room_count) || 1;
    const nights = Number(payload.nights) || 1;

    const { error } = await supabase.from('reservation_hotel').insert({
      reservation_id: reservationId,
      hotel_price_code: hotel.hotel_price_code ?? null,
      schedule: payload.schedule ?? null,
      room_count: roomCount,
      guest_count: (Number(formData.adult_count) || 0) + (Number(formData.child_count) || 0) || 1,
      checkin_date: formData.checkin_date ?? null,
      unit_price: unitPrice,
      total_price: unitPrice * roomCount * nights,
      request_note: formData.special_requests ?? null,
    });

    if (error) return `reservation_hotel: ${error.message}`;
    return null;
  } catch (err: unknown) {
    return `reservation_hotel 예외: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function saveRentcarDetail(
  reservationId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const vehicles = payload.vehicles as Record<string, unknown>[];
    if (!vehicles?.length) return null;

    const ROUND_TRIP = ['당일왕복', '다른날왕복'];

    for (const v of vehicles) {
      const isRound = ROUND_TRIP.includes(v.wayType as string);
      const rentcar = (v.rentcar ?? {}) as Record<string, unknown>;
      const unitPrice = Number(rentcar.price) || 0;

      const { error } = await supabase.from('reservation_rentcar').insert({
        reservation_id: reservationId,
        rentcar_price_code: rentcar.rent_code ?? null,
        pickup_datetime: v.pickup_datetime ? new Date(v.pickup_datetime as string).toISOString() : null,
        pickup_location: v.pickup_location ?? null,
        destination: v.destination ?? null,
        via_location: v.via_location ?? null,
        via_waiting: v.via_waiting ?? null,
        return_datetime: isRound && v.return_datetime ? new Date(v.return_datetime as string).toISOString() : null,
        return_pickup_location: isRound ? (v.return_pickup_location ?? null) : null,
        return_destination: isRound ? (v.return_destination ?? null) : null,
        return_via_location: isRound ? (v.return_via_location ?? null) : null,
        return_via_waiting: isRound ? (v.return_via_waiting ?? null) : null,
        luggage_count: Number(v.luggage_count) || 0,
        passenger_count: Number(v.passenger_count) || 1,
        car_count: Number(v.car_count) || 1,
        unit_price: unitPrice,
        total_price: unitPrice * (Number(v.car_count) || 1),
        request_note: payload.requestNote ?? null,
        way_type: v.wayType ?? '편도',
      });
      if (error) return `reservation_rentcar: ${error.message}`;
    }
    return null;
  } catch (err: unknown) {
    return `reservation_rentcar 예외: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function saveTourDetail(
  reservationId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const formData = payload.formData as Record<string, unknown>;
    if (!formData) return null;

    const pricing = payload.matchedPricing as Record<string, unknown> | undefined;
    const guests = Number(payload.guestCount) || 1;
    const finalPrice = Number(payload.finalPrice) || 0;

    const { error } = await supabase.from('reservation_tour').insert({
      reservation_id: reservationId,
      tour_price_code: pricing?.pricing_id ?? null,
      tour_capacity: guests,
      usage_date: formData.tour_date ?? null,
      pickup_location: formData.pickup_location ?? null,
      dropoff_location: formData.dropoff_location ?? null,
      request_note: payload.requestNote ?? null,
      unit_price: finalPrice,
      total_price: Number(payload.totalPrice) || finalPrice * guests,
    });

    if (error) return `reservation_tour: ${error.message}`;
    return null;
  } catch (err: unknown) {
    return `reservation_tour 예외: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function savePackageDetail(
  reservationId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const pkg = payload.selectedPackage as Record<string, unknown>;
    const applicant = payload.applicantData as Record<string, unknown>;
    if (!pkg || !applicant) return null;

    const { error } = await supabase.from('reservation_package').insert({
      reservation_id: reservationId,
      package_id: pkg.id ?? null,
      adult_count: Number(applicant.adults) || 0,
      child_extra_bed: Number(applicant.childExtraBed) || 0,
      child_no_extra_bed: Number(applicant.childNoExtraBed) || 0,
      infant_free: Number(applicant.infantFree) || 0,
      infant_tour: Number(applicant.infantTour) || 0,
      infant_extra_bed: Number(applicant.infantExtraBed) || 0,
      infant_seat: Number(applicant.infantSeat) || 0,
      total_price: Number(payload.totalPrice) || 0,
      additional_requests: payload.additionalRequests ?? null,
    });

    if (error) return `reservation_package: ${error.message}`;
    return null;
  } catch (err: unknown) {
    return `reservation_package 예외: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** 서비스별 상세 저장 디스패치 */
type SaveFn = (id: string, p: Record<string, unknown>) => Promise<string | null>;
const SAVE_MAP: Record<string, SaveFn> = {
  cruise: saveCruiseDetail,
  airport: saveAirportDetail,
  hotel: saveHotelDetail,
  rentcar: saveRentcarDetail,
  tour: saveTourDetail,
  ticket: (id, p) => saveTourDetail(id, p), // ticket → tour 테이블 재사용
  package: savePackageDetail,
};

/**
 * 단일 서비스 직접예약 제출
 * 1. 사용자 등록/승격
 * 2. reservation 메인 행 생성
 * 3. 서비스별 상세 저장
 */
export async function submitReservation(
  serviceType: string,
  payload: Record<string, unknown>,
): Promise<SubmitResult> {
  const userErr = await ensureUser();
  if (userErr) return { reservationId: null, error: userErr };

  const { data } = await supabase.auth.getUser();
  if (!data.user) return { reservationId: null, error: '사용자 정보를 가져올 수 없습니다.' };

  const { id, error: createErr } = await createReservation(data.user.id, serviceType);
  if (createErr || !id) return { reservationId: null, error: createErr ?? '예약 생성 실패' };

  const saveFn = SAVE_MAP[serviceType];
  if (saveFn) {
    const detailErr = await saveFn(id, payload);
    if (detailErr) return { reservationId: id, error: detailErr };
  }

  return { reservationId: id, error: null };
}
