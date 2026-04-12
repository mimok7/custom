'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { refreshAuthBeforeSubmit } from '@/lib/authHelpers';
import { Package, Info } from 'lucide-react';

interface PackageMaster {
  id: string;
  package_name: string;
  description: string;
  base_price: number;
  min_guests: number;
  max_guests: number;
  is_active: boolean;
}

export default function PackageBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [packages, setPackages] = useState<PackageMaster[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState('');

  // 신청자 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [departureDate, setDepartureDate] = useState('');

  // 인원
  const [adults, setAdults] = useState(2);
  const [childExtraBed, setChildExtraBed] = useState(0);
  const [childNoExtraBed, setChildNoExtraBed] = useState(0);
  const [infantFree, setInfantFree] = useState(0);
  const [infantTour, setInfantTour] = useState(0);
  const [infantExtraBed, setInfantExtraBed] = useState(0);
  const [infantSeat, setInfantSeat] = useState(0);

  const [additionalRequests, setAdditionalRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* ── 패키지 로드 ── */
  useEffect(() => {
    supabase
      .from('package_master')
      .select('*')
      .eq('is_active', true)
      .order('package_name')
      .then(({ data }) => {
        if (data) setPackages(data);
      });
  }, []);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPkgId) ?? null,
    [packages, selectedPkgId],
  );

  const totalGuests = adults + childExtraBed + childNoExtraBed + infantFree + infantTour + infantExtraBed + infantSeat;
  const totalPrice = (selectedPackage?.base_price ?? 0) * adults;

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (!user) return;
    if (!selectedPkgId) { alert('패키지를 선택하세요.'); return; }
    if (!departureDate) { alert('출발일을 선택하세요.'); return; }
    if (!name) { alert('신청자 이름을 입력하세요.'); return; }

    setSubmitting(true);
    try {
      await refreshAuthBeforeSubmit();
      const { error } = await submitReservation('package', {
        selectedPackage,
        applicantData: {
          name, phone, email, departureDate,
          adults, childExtraBed, childNoExtraBed,
          infantFree, infantTour, infantExtraBed, infantSeat,
        },
        totalPrice,
        additionalRequests,
      });
      if (error) { alert(`예약 오류: ${error}`); return; }
      alert('패키지 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Spinner className="h-72" />;
  if (!user) { router.replace('/login'); return null; }

  return (
    <PageWrapper title="패키지 예약" description="올인원 패키지 상품을 예약하세요">
      {/* 패키지 선택 */}
      <SectionBox title="패키지 선택">
        {packages.length === 0 ? (
          <p className="text-sm text-gray-500">현재 예약 가능한 패키지가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <button key={pkg.id}
                className={`w-full text-left card transition-colors ${selectedPkgId === pkg.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => setSelectedPkgId(pkg.id)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{pkg.package_name}</h4>
                    {pkg.description && <p className="text-sm text-gray-500 mt-0.5">{pkg.description}</p>}
                  </div>
                  <span className="text-sm font-semibold text-blue-600 whitespace-nowrap">
                    {pkg.base_price.toLocaleString()} VND/인
                  </span>
                </div>
                {pkg.min_guests > 0 && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />최소 {pkg.min_guests}명 ~ 최대 {pkg.max_guests}명
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </SectionBox>

      {/* 신청자 */}
      <SectionBox title="신청자 정보">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
        </div>
      </SectionBox>

      {/* 일정 */}
      <SectionBox title="일정">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출발일</label>
          <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
        </div>
      </SectionBox>

      {/* 인원 구성 */}
      <SectionBox title="인원 구성">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-sm text-gray-600">성인</label>
            <input type="number" min={1} value={adults || ''} onChange={(e) => setAdults(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">아동 (엑스트라베드)</label>
            <input type="number" min={0} value={childExtraBed || ''} onChange={(e) => setChildExtraBed(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">아동 (베드 미사용)</label>
            <input type="number" min={0} value={childNoExtraBed || ''} onChange={(e) => setChildNoExtraBed(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">유아 (무료)</label>
            <input type="number" min={0} value={infantFree || ''} onChange={(e) => setInfantFree(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">유아 (투어)</label>
            <input type="number" min={0} value={infantTour || ''} onChange={(e) => setInfantTour(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">유아 (엑스트라베드)</label>
            <input type="number" min={0} value={infantExtraBed || ''} onChange={(e) => setInfantExtraBed(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">유아 (카시트)</label>
            <input type="number" min={0} value={infantSeat || ''} onChange={(e) => setInfantSeat(e.target.value === '' ? 0 : Number(e.target.value))} />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">총 인원: {totalGuests}명</p>
      </SectionBox>

      {/* 요청사항 */}
      <SectionBox title="추가 요청">
        <textarea rows={3} value={additionalRequests} onChange={(e) => setAdditionalRequests(e.target.value)} placeholder="추가 요청사항을 입력하세요" />
      </SectionBox>



      <div className="flex justify-end gap-3 mt-4">
        <button className="btn btn-secondary" onClick={() => router.back()}>취소</button>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size="sm" /> : <><Package className="w-4 h-4 mr-1" />예약하기</>}
        </button>
      </div>
    </PageWrapper>
  );
}
