# Copilot Instructions for sht-customer3

## 프로젝트 개요
**스테이하롱 크루즈 예약 시스템** - Next.js 15.3.5 App Router + Supabase PostgreSQL 기반 예약 관리 웹앱.

## 핵심 원칙

### 고객 프로젝트 참고 시
- **꼭 필요한 코드만** 선택적으로 가져올 것
- 전체 페이지를 복사하지 말 것
- 불필요한 코드는 제외할 것

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

### 수정 후 자동 푸시
- 변경 작업을 완료하면 에이전트에게 자동 푸시를 요청할 수 있습니다.

## 프로젝트 구조
```
sht-customer3/
├── app/                    # Next.js App Router
│   ├── mypage/            # 사용자 페이지
│   │   ├── direct-booking/ # 예약하기 (cruise, airport, hotel, tour, rentcar, package, ticket)
│   │   ├── reservations/  # 예약 관리
│   │   └── confirmations/ # 확인 페이지
│   └── api/               # API Routes
├── components/            # 재사용 컴포넌트
│   ├── layout/           # 레이아웃 컴포넌트
│   ├── providers/        # Context Providers
│   └── ui/               # UI 컴포넌트
├── hooks/                # 커스텀 훅
│   ├── useAuth.ts        # 인증
│   └── useQueries.ts     # React Query 훅
├── lib/                  # 라이브러리 및 유틸
│   ├── supabase.ts       # Supabase 클라이언트
│   ├── cruisePriceCalculator.ts  # 가격 계산
│   └── queryClient.ts    # React Query 설정
└── sql/                  # DB 스키마
```

## 코드 관례

### 데이터 조회
```tsx
import { useQueries } from '@/hooks/useQueries';
const { data, isLoading } = useQueries();
```

### 인증 체크
```tsx
import { useAuth } from '@/hooks/useAuth';
const { user, loading } = useAuth();
```

### UI 컴포넌트 구조
```tsx
import PageWrapper from '@/components/layout/PageWrapper';
import SectionBox from '@/components/layout/SectionBox';

<PageWrapper title="제목">
  <SectionBox title="섹션">
    {/* 콘텐츠 */}
  </SectionBox>
</PageWrapper>
```

### 로딩 상태
```tsx
import Spinner from '@/components/ui/Spinner';
if (loading) return <Spinner className="h-72" />;
```

## 성능 최적화

### 쿼리 병렬화
```tsx
const [result1, result2] = await Promise.all([
  query1,
  query2
]);
```

### 메모이제이션
```tsx
const memoized = useMemo(() => compute(deps), [deps]);
const callback = useCallback(() => fn(deps), [deps]);
```

## 중요 제약 사항
- 폴더 구조 변경 금지
- 빌드 및 타입체크 명령 실행 금지
- 고객 프로젝트 참고 시 필요한 코드만 선택적으로 가져올 것
