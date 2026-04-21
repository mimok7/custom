# E2E 체크리스트 - 탭 절전/유휴 복귀 시나리오

> **대상 프로젝트**: sht-customer, sht-customer3  
> **검증 목적**: 사용자가 30분 이상 유휴 상태 후 탭으로 돌아왔을 때 무한 로딩 없이 정상 동작하는지 확인  
> **최초 작성**: 2026-04-21

---

## 사전 준비

- [ ] 브라우저 개발자도구 → Network 탭 열기 (요청 로그 확인용)
- [ ] Console 탭 열기 (오류 확인용)
- [ ] 테스트 계정으로 로그인 완료 상태

---

## 시나리오 A: 30분 유휴 후 탭 포커스 복귀

### 절차
1. [ ] 로그인 후 `/mypage` 접근
2. [ ] 브라우저 탭을 그대로 두고 30분 이상 다른 작업 진행  
   *(또는 DevTools → Application → Session Storage → `app:auth:cache` 항목을 직접 삭제하여 캐시 만료 시뮬레이션)*
3. [ ] 30분 후 해당 탭 클릭 (포커스 복귀)

### 기대 결과
- [ ] 스피너가 잠깐 표시됐다가 마이페이지 콘텐츠 정상 렌더
- [ ] 콘솔에 `AUTH_LOADING_TIMEOUT` 에러 없음
- [ ] 화면 우하단에 "인증 확인 시간이 초과되었습니다" 토스트 **표시되지 않음**  
  (재인증 성공 시 토스트 불필요)
- [ ] Network 탭에서 Supabase `/auth/v1/user` 또는 `/auth/v1/token` 요청 확인됨

---

## 시나리오 B: 30분 유휴 후 새로고침(F5)

### 절차
1. [ ] 시나리오 A와 동일하게 캐시 만료 상태로 세팅
2. [ ] `F5` (또는 `Ctrl+R`) 새로고침

### 기대 결과
- [ ] 페이지 로딩 후 로그인 상태 유지됨
- [ ] `/login` 으로 리다이렉트되지 않음
- [ ] 마이페이지 콘텐츠 정상 출력

---

## 시나리오 C: 30분 유휴 후 내비게이션 메뉴 클릭

### 절차
1. [ ] 캐시 만료 상태 세팅
2. [ ] 메뉴에서 "직접예약" 또는 "예약 목록" 클릭

### 기대 결과
- [ ] 목적 페이지 정상 이동
- [ ] `if (!user) return null` 상태에서 깜박임 후 자동 `/login` 리다이렉트  
  (세션이 실제 만료된 경우에만 - useAuth 내부 loginRequired=true 처리)
- [ ] 세션 유효한 경우: 스피너 짧게 표시 후 콘텐츠 정상 렌더

---

## 시나리오 D: 네트워크 오프라인 후 복귀

### 절차
1. [ ] 로그인 후 `/mypage/direct-booking` 접근
2. [ ] DevTools → Network → "Offline" 모드로 전환
3. [ ] 5분 대기
4. [ ] "Online" 모드로 복귀

### 기대 결과
- [ ] 온라인 복귀 시 스피너 짧게 표시 후 콘텐츠 재렌더
- [ ] "인증 확인 시간이 초과" 토스트가 표시되지 않음 (빠른 재인증 성공)
- [ ] 오프라인 중 토스트 표시 없음 (watchdog 아직 미발동 상태)

---

## 시나리오 E: 인증 타임아웃 강제 발생 (토스트 확인)

### 절차 (개발 환경에서만)
1. [ ] `hooks/useAuth.ts` 에서 워치독 타임아웃을 임시로 `500` ms 으로 변경
2. [ ] 새로고침
3. [ ] (Supabase 요청이 500ms 안에 완료되지 않으면) 화면 우하단 토스트 확인
4. [ ] 테스트 후 원복 (`12000`)

### 기대 결과
- [ ] 화면 우하단에 주황색(warning) 토스트 표시
- [ ] 메시지: "인증 확인 시간이 초과되었습니다. 페이지를 새로고침해 주세요."
- [ ] "페이지 새로고침" 버튼 클릭 시 `window.location.reload()` 동작
- [ ] × 버튼으로 토스트 수동 닫기 가능

---

## 시나리오 F: 로그인 만료 후 보호 페이지 직접 URL 접근

### 절차
1. [ ] 다른 탭 또는 DevTools → Application → Cookies 에서 `sb-*-auth-token` 삭제
2. [ ] 보호 페이지 직접 URL 입력 (예: `/mypage/direct-booking/cruise`)

### 기대 결과
- [ ] 스피너 표시 후 `/login` 으로 `router.replace` 리다이렉트
- [ ] 브라우저 히스토리에 보호 페이지 URL이 남지 않음 (`replace` 사용 확인)

---

## 자동화 참고 (Playwright)

> 아래는 향후 Playwright E2E로 전환 시 참고할 의사코드입니다.

```ts
// e2e/idle-tab-resume.spec.ts (예시)
test('30분 유휴 후 포커스 복귀 - 무한 로딩 없음', async ({ page, context }) => {
  await page.goto('/mypage');
  await page.waitForSelector('[data-testid="mypage-content"]');

  // 캐시 만료 시뮬레이션
  await page.evaluate(() => sessionStorage.removeItem('app:auth:cache'));

  // 탭 포커스 해제 후 재포커스
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  // 12초 이내에 로딩 완료 확인
  await expect(page.locator('[data-testid="mypage-content"]')).toBeVisible({ timeout: 13000 });
  await expect(page.locator('[data-testid="auth-timeout-toast"]')).not.toBeVisible();
});
```

---

## 체크리스트 버전

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-04-21 | 최초 작성 (focus/online/visibilitychange 재인증 + loginRequired 패턴 반영) |
