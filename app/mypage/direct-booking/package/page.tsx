'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import supabase from '@/lib/supabase';
import { submitReservation } from '@/lib/submitReservation';
import { Package, Info, Users, Calendar } from 'lucide-react';

interface PackagePriceConfigEntry {
  per_person?: number;
}

interface PackageMaster {
  id: string;
  package_code: string;
  name: string;
  description: string | null;
  base_price: number | null;
  is_active: boolean | null;
  price_config?: Record<string, number | PackagePriceConfigEntry> | null;
  price_child_extra_bed?: number | null;
  price_child_no_extra_bed?: number | null;
  price_infant_tour?: number | null;
  price_infant_extra_bed?: number | null;
  price_infant_seat?: number | null;
}

export default function PackageBookingPage() {
  const { user, loading: authLoading } = useAuth(undefined, '/login', true);
  const router = useRouter();

  const [packages, setPackages] = useState<PackageMaster[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 신청자 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [departureDate, setDepartureDate] = useState('');

  // 인원 구성
  const [adults, setAdults] = useState(2);
  const [totalChildren, setTotalChildren] = useState(0);
  const [childExtraBed, setChildExtraBed] = useState(0);
  const [childNoExtraBed, setChildNoExtraBed] = useState(0);
  const [childOptions, setChildOptions] = useState({ extraBed: false, noExtraBed: false });

  const [totalInfants, setTotalInfants] = useState(0);
  const [infantFree, setInfantFree] = useState(0);
  const [infantTour, setInfantTour] = useState(0);
  const [infantExtraBed, setInfantExtraBed] = useState(0);
  const [infantSeat, setInfantSeat] = useState(0);
  const [infantOptions, setInfantOptions] = useState({ free: false, tour: false, extraBed: false, seat: false });

  const [additionalRequests, setAdditionalRequests] = useState('');

  // 패키지 로드 및 사용자 정보 설정
  useEffect(() => {
    const loadData = async () => {
      try {
        if (!user) return;

        // 사용자 프로필 로드
        const { data: profileData } = await supabase
          .from('users')
          .select('name, email, phone_number')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setName(profileData.name || '');
          setEmail(profileData.email || user.email || '');
          setPhone(profileData.phone_number || '');
        }

        // 패키지 로드
        const { data: pkgData } = await supabase
          .from('package_master')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (pkgData) {
          // 엠바사더 패키지 제외
          const filtered = (pkgData as PackageMaster[]).filter(
            (p) =>
              !p.name?.toLowerCase().includes('ambassador') &&
              !p.name?.includes('엠바사더') &&
              !p.package_code?.toLowerCase().includes('ambassador')
          );
          setPackages(filtered);

          // 고객 프로젝트와 동일하게 그랜드 파이어니스 기본 선택
          if (filtered.length > 0) {
            const defaultPkg = filtered.find((p) => p.name.includes('그랜드 파이어니스')) || filtered[0];
            setSelectedPkgId(defaultPkg.id);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const selectedPackage = packages.find((p) => p.id === selectedPkgId);

  const getAdultPrice = useCallback((pkg: PackageMaster | undefined, adultCount: number) => {
    if (!pkg) return 0;

    if (pkg.price_config && typeof pkg.price_config === 'object') {
      const config = pkg.price_config[adultCount.toString()];
      if (config) {
        if (typeof config === 'object' && typeof config.per_person === 'number') {
          return Number(config.per_person);
        }
        return Number(config);
      }

      const keys = Object.keys(pkg.price_config).map(Number).sort((a, b) => b - a);
      const maxKey = keys[0];
      if (maxKey && adultCount > maxKey) {
        const maxConfig = pkg.price_config[maxKey.toString()];
        if (typeof maxConfig === 'object' && typeof maxConfig.per_person === 'number') {
          return Number(maxConfig.per_person);
        }
        return Number(maxConfig || 0);
      }
    }

    return Number(pkg.base_price || 0);
  }, []);

  const totalGuests = adults + totalChildren + totalInfants;
  const adultUnitPrice = getAdultPrice(selectedPackage, adults);
  const totalPrice =
    adults * adultUnitPrice +
    childExtraBed * Number(selectedPackage?.price_child_extra_bed || 6900000) +
    childNoExtraBed * Number(selectedPackage?.price_child_no_extra_bed || 5850000) +
    infantTour * Number(selectedPackage?.price_infant_tour || 900000) +
    infantExtraBed * Number(selectedPackage?.price_infant_extra_bed || 4200000) +
    infantSeat * Number(selectedPackage?.price_infant_seat || 800000);

  // 아동 옵션 토글
  const handleChildrenChange = useCallback((val: number) => {
    setTotalChildren(val);
    if (val === 0) {
      setChildOptions({ extraBed: false, noExtraBed: false });
      setChildExtraBed(0);
      setChildNoExtraBed(0);
    }
  }, []);

  // 유아 옵션 토글
  const handleInfantsChange = useCallback((val: number) => {
    setTotalInfants(val);
    if (val === 0) {
      setInfantOptions({ free: false, tour: false, extraBed: false, seat: false });
      setInfantFree(0);
      setInfantTour(0);
      setInfantExtraBed(0);
      setInfantSeat(0);
    }
  }, []);

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;
    if (!selectedPkgId) {
      alert('패키지를 선택해주세요.');
      return;
    }
    if (!departureDate) {
      alert('출발일을 선택해주세요.');
      return;
    }
    if (!name) {
      alert('신청자 이름을 입력해주세요.');
      return;
    }

    // 아동 검증
    if (totalChildren > 0) {
      const selectedChildCount = childExtraBed + childNoExtraBed;
      if (selectedChildCount !== totalChildren) {
        alert(`아동 ${totalChildren}명에 대한 옵션을 모두 선택해주세요.\n현재 선택: ${selectedChildCount}명 (엑스트라베드 사용 ${childExtraBed}명 + 미사용 ${childNoExtraBed}명)`);
        return;
      }
    }

    // 유아 검증
    if (totalInfants > 0) {
      const requiredInfantCount = infantFree + infantTour;
      if (requiredInfantCount !== totalInfants) {
        alert(`유아 ${totalInfants}명에 대한 필수 옵션을 선택해주세요.\n현재 선택: ${requiredInfantCount}명 (신장 미만 ${infantFree}명 + 신장 이상 ${infantTour}명)\n※ 엑스트라베드와 리무진 좌석은 선택사항입니다.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error } = await submitReservation('package', {
        selectedPackage,
        applicantData: {
          name,
          phone,
          email,
          departureDate,
          adults,
          childExtraBed,
          childNoExtraBed,
          infantFree,
          infantTour,
          infantExtraBed,
          infantSeat,
        },
        totalPrice,
        additionalRequests,
      });

      if (error) {
        alert(`예약 오류: ${error}`);
        return;
      }

      alert('패키지 예약이 완료되었습니다! 다른 서비스를 계속 예약할 수 있습니다.');
      router.push('/mypage/direct-booking?completed=package');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <Spinner className="h-72" />;
  if (!user) return null;

  return (
    <PageWrapper title="패키지 예약" description="올인원 패키지 상품을 예약하세요">
      {/* 패키지 선택 */}
      <SectionBox title={<><Package className="w-5 h-5 inline mr-2" />원하시는 패키지를 선택하세요</>}>
        {packages.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Info className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>사용 가능한 패키지 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPkgId(pkg.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedPkgId === pkg.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded mb-2">
                      {pkg.package_code}
                    </span>
                    <h4 className="font-bold text-gray-900">{pkg.name}</h4>
                    {pkg.description && (
                      <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                    )}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-sm text-gray-500">{adults}인 기준 성인 단가</div>
                    <div className="text-lg font-bold text-blue-600">
                      {getAdultPrice(pkg, adults).toLocaleString()} VND
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionBox>

      {/* 신청자 정보 */}
      <SectionBox title="신청자 정보">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </SectionBox>

      {/* 일정 */}
      <SectionBox title={<><Calendar className="w-5 h-5 inline mr-2" />일정</>}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            출발일 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </SectionBox>

      {/* 인원 구성 */}
      <SectionBox title={<><Users className="w-5 h-5 inline mr-2" />인원 구성</>}>
        <div className="space-y-4">
          {/* 성인 */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">성인 (12세 이상)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-bold"
                />
                <span className="text-gray-600">명</span>
              </div>
            </div>
          </div>

          {/* 아동 */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-700">아동 (5세~11세)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={totalChildren}
                  onChange={(e) => handleChildrenChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-bold"
                />
                <span className="text-gray-600">명</span>
              </div>
            </div>

            {totalChildren > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <p className="text-xs text-gray-600 font-medium">
                  옵션 선택 <span className="text-red-500">(필수)</span>
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={childOptions.extraBed}
                    onChange={(e) => {
                      setChildOptions({ ...childOptions, extraBed: e.target.checked });
                      if (!e.target.checked) {
                        setChildExtraBed(0);
                      } else if (childExtraBed === 0) {
                        setChildExtraBed(1);
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">엑스트라 베드 사용</span>
                  <span className="ml-auto text-sm text-blue-600 font-semibold">
                    {childExtraBed}명
                  </span>
                </label>
                {childOptions.extraBed && (
                  <input
                    type="number"
                    min="1"
                    max={totalChildren}
                    value={childExtraBed}
                    onChange={(e) => setChildExtraBed(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                    placeholder="0"
                  />
                )}

                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={childOptions.noExtraBed}
                    onChange={(e) => {
                      setChildOptions({ ...childOptions, noExtraBed: e.target.checked });
                      if (!e.target.checked) {
                        setChildNoExtraBed(0);
                      } else if (childNoExtraBed === 0) {
                        setChildNoExtraBed(1);
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">엑스트라 베드 미사용</span>
                  <span className="ml-auto text-sm text-blue-600 font-semibold">
                    {childNoExtraBed}명
                  </span>
                </label>
                {childOptions.noExtraBed && (
                  <input
                    type="number"
                    min="1"
                    max={totalChildren}
                    value={childNoExtraBed}
                    onChange={(e) => setChildNoExtraBed(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                    placeholder="0"
                  />
                )}
              </div>
            )}
          </div>

          {/* 유아 */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-700">유아 (5세 미만)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={totalInfants}
                  onChange={(e) => handleInfantsChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center font-bold"
                />
                <span className="text-gray-600">명</span>
              </div>
            </div>

            {totalInfants > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <p className="text-xs text-gray-600 font-medium mb-2">
                  필수 옵션 <span className="text-red-500">(신장 기준 선택)</span>
                </p>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={infantOptions.free}
                    onChange={(e) => {
                      setInfantOptions({ ...infantOptions, free: e.target.checked });
                      if (!e.target.checked) {
                        setInfantFree(0);
                      } else if (infantFree === 0) {
                        setInfantFree(1);
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">신장 1.1m 미만 (무료)</span>
                  <span className="ml-auto text-sm text-green-600 font-semibold">
                    {infantFree}명
                  </span>
                </label>
                {infantOptions.free && (
                  <input
                    type="number"
                    min="1"
                    max={totalInfants}
                    value={infantFree}
                    onChange={(e) => setInfantFree(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-green-300 rounded text-sm"
                  />
                )}

                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={infantOptions.tour}
                    onChange={(e) => {
                      setInfantOptions({ ...infantOptions, tour: e.target.checked });
                      if (!e.target.checked) {
                        setInfantTour(0);
                      } else if (infantTour === 0) {
                        setInfantTour(1);
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">신장 1.1m 이상 (투어 포함)</span>
                  <span className="ml-auto text-sm text-blue-600 font-semibold">
                    {infantTour}명
                  </span>
                </label>
                {infantOptions.tour && (
                  <input
                    type="number"
                    min="1"
                    max={totalInfants}
                    value={infantTour}
                    onChange={(e) => setInfantTour(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                )}

                <p className="text-xs text-gray-600 font-medium mt-3 mb-2">
                  선택 옵션 (추가 요청)
                </p>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={infantOptions.extraBed}
                    onChange={(e) => {
                      setInfantOptions({ ...infantOptions, extraBed: e.target.checked });
                      if (!e.target.checked) {
                        setInfantExtraBed(0);
                      } else if (infantExtraBed === 0) {
                        setInfantExtraBed(1);
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">엑스트라 베드 사용</span>
                  <span className="ml-auto text-sm text-blue-600 font-semibold">
                    {infantExtraBed}명
                  </span>
                </label>
                {infantOptions.extraBed && (
                  <input
                    type="number"
                    min="1"
                    max={totalInfants}
                    value={infantExtraBed}
                    onChange={(e) => setInfantExtraBed(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                )}

                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={infantOptions.seat}
                    onChange={(e) => {
                      setInfantOptions({ ...infantOptions, seat: e.target.checked });
                      if (!e.target.checked) {
                        setInfantSeat(0);
                      } else if (infantSeat === 0) {
                        setInfantSeat(1);
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">리무진 좌석</span>
                  <span className="ml-auto text-sm text-blue-600 font-semibold">
                    {infantSeat}명
                  </span>
                </label>
                {infantOptions.seat && (
                  <input
                    type="number"
                    min="1"
                    max={totalInfants}
                    value={infantSeat}
                    onChange={(e) => setInfantSeat(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                )}
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600 mt-2">총 인원: {totalGuests}명</p>
        </div>
      </SectionBox>

      {/* 추가 요청사항 */}
      <SectionBox title="추가 요청사항">
        <textarea
          value={additionalRequests}
          onChange={(e) => setAdditionalRequests(e.target.value)}
          placeholder="특별히 요청하실 내용을 입력하세요."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </SectionBox>

      {/* 가격 요약 및 제출 */}
      {selectedPackage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">패키지:</span>
            <span className="text-gray-900 font-semibold">{selectedPackage.name}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">성인 단가:</span>
            <span className="text-blue-600 font-semibold">
              {adultUnitPrice.toLocaleString()} VND
            </span>
          </div>
          <div className="text-xs text-gray-600 mb-2 space-y-1">
            <p>아동(엑스트라베드): {childExtraBed}명</p>
            <p>아동(베드미사용): {childNoExtraBed}명</p>
            <p>유아(투어): {infantTour}명 / 유아(엑스트라베드): {infantExtraBed}명 / 유아(좌석): {infantSeat}명</p>
          </div>
          <div className="flex justify-between items-center border-t border-blue-200 pt-2">
            <span className="text-gray-900 font-bold text-lg">
              총 예상 금액:
            </span>
            <span className="text-blue-600 font-bold text-xl">
              {totalPrice.toLocaleString()} VND
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedPkgId}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Spinner size="sm" /> 예약 중...
            </>
          ) : (
            <>
              <Package className="w-4 h-4" /> 예약하기
            </>
          )}
        </button>
      </div>
    </PageWrapper>
  );
}
