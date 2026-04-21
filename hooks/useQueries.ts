import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';

/** 예약 목록 조회 */
export function useReservations(userId: string | undefined) {
  return useQuery({
    queryKey: ['reservations', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const { data, error } = await supabase
          .from('reservation')
          .select('re_id,re_type,re_status,re_created_at,re_quote_id')
          .eq('re_user_id', userId)
          .order('re_created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.error('Error loading reservations:', err);
        throw err;
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

/** 예약 상세 조회 */
export function useReservationDetail(
  reservationId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      if (!reservationId || !userId) return null;
      const { data, error } = await supabase
        .from('reservation')
        .select('*')
        .eq('re_id', reservationId)
        .eq('re_user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!reservationId && !!userId,
  });
}

/** 가격 정보 조회 (캐싱) */
export function usePriceOptions(
  service: 'room' | 'car' | 'airport' | 'hotel' | 'tour' | 'rentcar',
) {
  const tableMap: Record<string, string> = {
    room: 'cruise_rate_card',
    car: 'car_price',
    airport: 'airport_price',
    hotel: 'hotel_price',
    tour: 'tour_pricing',
    rentcar: 'rentcar_price',
  };

  const selectMap: Record<string, string> = {
    room: 'id,cruise_name,schedule_type,room_type,room_type_en,price_adult,price_child,price_child_extra_bed,price_infant,price_extra_bed,price_single,valid_year,valid_from,valid_to,season_name,is_active',
    car: 'id,cruise,vehicle_type,category,way_type,route,price,valid_from,valid_to',
    airport: 'id,airport_code,service_type,route,vehicle_type,price,valid_from,valid_to',
    hotel: 'id,hotel_name,room_type,room_name,base_price,checkin_day,checkout_day,valid_from,valid_to',
    tour: 'pricing_id,tour_id,min_guests,max_guests,price_per_person',
    rentcar: 'id,route,vehicle_type,way_type,price,capacity,valid_from,valid_to',
  };

  return useQuery({
    queryKey: ['price', service],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableMap[service])
        .select(selectMap[service]);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/** 예약 생성 mutation */
export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from('reservation')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

/** 예약 목록 추가 정보 (견적, 크루즈 메타, 금액, 결제) 병렬 조회 */
export function useReservationAdditionalData(
  reservations: Array<{ re_id: string; re_type: string; re_quote_id?: string }>,
) {
  return useQuery({
    queryKey: [
      'reservationAdditionalData',
      reservations.map((r) => r.re_id).join(','),
    ],
    queryFn: async () => {
      if (reservations.length === 0) {
        return {
          quotesById: {} as Record<string, { title: string; status: string }>,
          cruiseMeta: {} as Record<string, Record<string, unknown>>,
          amountsByReservation: {} as Record<string, number>,
          paymentStatusByReservation: {} as Record<string, { hasCompleted: boolean; payments: unknown[] }>,
        };
      }

      const ids = reservations.map((r) => r.re_id);
      const quoteIds = [
        ...new Set(
          reservations
            .map((r) => r.re_quote_id)
            .filter((id): id is string => !!id),
        ),
      ];
      const cruiseIds = reservations
        .filter((r) => r.re_type === 'cruise')
        .map((r) => r.re_id);

      const [
        quotesRes,
        cruiseMetaRes,
        cruisePriceRes,
        cruiseCarPriceRes,
        airportPriceRes,
        hotelPriceRes,
        rentPriceRes,
        tourPriceRes,
        paymentRes,
      ] = await Promise.all([
        quoteIds.length > 0
          ? supabase
              .from('quote')
              .select('id,title,status')
              .in('id', quoteIds)
          : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
        cruiseIds.length > 0
          ? supabase
              .from('reservation_cruise')
              .select(
                'reservation_id,checkin,guest_count,adult_count,child_count,infant_count',
              )
              .in('reservation_id', cruiseIds)
          : Promise.resolve({ data: [] as Record<string, unknown>[] }),
        supabase
          .from('reservation_cruise')
          .select('reservation_id,room_total_price')
          .in('reservation_id', ids),
        supabase
          .from('reservation_cruise_car')
          .select('reservation_id,car_total_price')
          .in('reservation_id', ids),
        supabase
          .from('reservation_airport')
          .select('reservation_id,total_price')
          .in('reservation_id', ids),
        supabase
          .from('reservation_hotel')
          .select('reservation_id,total_price')
          .in('reservation_id', ids),
        supabase
          .from('reservation_rentcar')
          .select('reservation_id,total_price')
          .in('reservation_id', ids),
        supabase
          .from('reservation_tour')
          .select('reservation_id,total_price')
          .in('reservation_id', ids),
        supabase
          .from('reservation_payment')
          .select(
            'reservation_id,payment_status,amount,payment_method,created_at',
          )
          .in('reservation_id', ids),
      ]);

      // 견적
      const quotesById: Record<string, { title: string; status: string }> = {};
      ((quotesRes.data as { id: string; title?: string; status: string }[] | null) ?? []).forEach((q) => {
        quotesById[q.id] = { title: q.title ?? '제목 없음', status: q.status };
      });

      // 크루즈 메타
      const cruiseMeta: Record<string, Record<string, unknown>> = {};
      ((cruiseMetaRes.data as Record<string, unknown>[] | null) ?? []).forEach((c) => {
        const rid = c.reservation_id as string;
        cruiseMeta[rid] = {
          checkin: c.checkin,
          guest_count: c.guest_count,
          adult_count: c.adult_count ?? 0,
          child_count: c.child_count ?? 0,
          infant_count: c.infant_count ?? 0,
        };
      });

      // 금액 합산
      const amountsByReservation: Record<string, number> = {};
      const sumAmt = (rows: unknown[], key: string) => {
        (rows as Record<string, unknown>[]).forEach((r) => {
          const rid = r.reservation_id as string;
          amountsByReservation[rid] =
            (amountsByReservation[rid] || 0) + Number(r[key] || 0);
        });
      };
      sumAmt(cruisePriceRes.data ?? [], 'room_total_price');
      sumAmt(cruiseCarPriceRes.data ?? [], 'car_total_price');
      sumAmt(airportPriceRes.data ?? [], 'total_price');
      sumAmt(hotelPriceRes.data ?? [], 'total_price');
      sumAmt(rentPriceRes.data ?? [], 'total_price');
      sumAmt(tourPriceRes.data ?? [], 'total_price');

      // 결제 상태
      const payRows = (paymentRes.data ?? []) as Record<string, unknown>[];
      const paymentStatusByReservation: Record<
        string,
        { hasCompleted: boolean; payments: unknown[] }
      > = {};
      reservations.forEach((r) => {
        const payments = payRows.filter(
          (p) => p.reservation_id === r.re_id,
        );
        paymentStatusByReservation[r.re_id] = {
          hasCompleted: payments.some(
            (p) => p.payment_status === 'completed',
          ),
          payments,
        };
      });

      return {
        quotesById,
        cruiseMeta,
        amountsByReservation,
        paymentStatusByReservation,
      };
    },
    enabled: reservations.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
