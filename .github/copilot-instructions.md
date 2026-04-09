# Copilot Instructions for AI Agents

## 프로젝트 개요
**스테이하롱 간소화 예약 시스템** - Next.js App Router + Supabase PostgreSQL 기반 다이렉트 예약 웹앱.

## 프로젝트 및 도메인 맵핑
- **sht-customer**: `customer2.stayhalong.com` (풀 기능 고객 예약 시스템)
- **sht-custom**: `customer.stayhalong.com` (간소화된 다이렉트 예약 시스템)
- 두 프로젝트는 동일한 Supabase DB를 공유하며 변경사항은 항상 동기화 유지

## 핵심 기능
- **직접 예약**: 다이렉트 예약만 지원 (cruise, airport, hotel, tour, rentcar, package, ticket)
- **예약 확인**: 예약 내역 조회 및 상세 보기
- **예약확인서**: 결제 완료된 예약 확인서 조회

## 데이터베이스 구조
- **예약 구조**: `reservation` (메인) → `reservation_*` (서비스별 상세: `reservation_cruise`, `reservation_airport` 등)
- **가격 시스템**: `*_price` 테이블 (room_price, car_price 등)로 동적 가격 계산
- 동일한 Supabase 인스턴스 사용 - sht-customer와 모든 데이터 공유

## Draft 저장 시스템
**다이렉트 예약의 드래프트 저장 시스템이 적용되었습니다:**
- 각 서비스별로 입력 중에는 로컬 draft로 저장
- 하단 "전체 예약 신청" 버튼에서만 최종 제출
- 서비스 타입: `'cruise' | 'airport' | 'hotel' | 'rentcar' | 'tour' | 'package' | 'ticket'`

### Draft 저장 흐름
```tsx
// 각 서비스 페이지에서 draft 저장
const draftEnvelope: DraftEnvelope = {
  quoteId,
  userId: user.id,
  serviceType: 'cruise',
  payload: { ... },
  updatedAt: new Date().toISOString(),
};

localStorage.setItem(getDraftStorageKey(quoteId, 'cruise'), JSON.stringify(draftEnvelope));
```

## 개발 워크플로우

### 주요 명령어
```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드 (타입 체크 무시)
npm run typecheck    # TypeScript 타입 체크만
npm run lint:fix     # ESLint 자동 수정
```

### 환경 변수 (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 코드 관례

### 인증 확인
```tsx
// lib/authHelpers.ts 사용
import { getSessionUser, refreshAuthBeforeSubmit } from '@/lib/authHelpers';

const { user, error } = await getSessionUser();
if (error || !user) {
  router.push('/login');
  return;
}
```

### UI 컴포넌트 구조
```tsx
import PageWrapper from '@/components/PageWrapper';
import SectionBox from '@/components/SectionBox';

<PageWrapper>
  <SectionBox title="섹션 제목">
    {loading ? <Spinner /> : <Content />}
  </SectionBox>
</PageWrapper>
```

### 로딩 상태 표준화
```tsx
if (loading) return (
  <div className="flex justify-center items-center h-72">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
  </div>
);
```

## 프로젝트 구조
```
sht-custom/
├── app/                      # Next.js App Router
│   ├── mypage/              # 사용자 페이지
│   │   └── direct-booking/ # 직접 예약 (cruise, airport, hotel, tour, rentcar, package, ticket)
│   │   ├── reservations/   # 예약 확인
│   │   └── confirmations/  # 예약확인서
│   ├── login/              # 로그인 페이지
│   └── api/                # API Routes
├── components/              # 재사용 컴포넌트
│   ├── PageWrapper.tsx
│   ├── SectionBox.tsx
│   └── ...
├── hooks/                   # 커스텀 훅
│   └── useLoadingTimeout.ts
├── lib/                     # Supabase 클라이언트 및 유틸리티
│   ├── supabase.ts
│   ├── bookingDraftMapper.ts # Draft 타입 정의
│   ├── submitAllReservations.ts # Draft 제출 헬퍼
│   └── authHelpers.ts       # 인증 헬퍼
└── sql/                     # DB 스키마 및 마이그레이션
    └── 2026-04-09-submit-all-reservations-rpc.sql
```

## 중요 제약 사항
- **폴더 구조 변경 금지**: 기존 구조 유지, 새 폴더 생성 자제
- **DB 스키마 참조**: sql 폴더의 스키마 파일 참조
- **타입 체크**: 빌드 시 무시 설정됨 (`typescript.ignoreBuildErrors: true`)

## 멀티 프로젝트 동기화
- `sht-customer`와 `sht-custom`은 수정사항을 항상 함께 반영 (한쪽만 수정 금지)
- UI 개선, 버그 수정, 기능 추가는 양쪽 모두에 적용
- 반드시 각 저장소에 개별 커밋 및 푸시 실행

## Git 정책
- 작업 완료 후 `git add`, `git commit`, `git push` 자동 실행
- 각 저장소별 독립적인 커밋 메시지 작성
- 두 프로젝트의 동기화 작업은 명확한 메시지로 기록
