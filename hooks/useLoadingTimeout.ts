import { useEffect, useRef } from 'react';

/** 로딩 상태가 timeoutMs 이상 지속되면 강제 해제 (무한 로딩 방지) */
export function useLoadingTimeout(
  loading: boolean,
  setLoading: (v: boolean) => void,
  timeoutMs = 60000,
) {
  const alertShownRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      alertShownRef.current = false;
      return;
    }

    const id = setTimeout(() => {
      if (!alertShownRef.current) {
        alertShownRef.current = true;
        setLoading(false);
        alert('요청 시간이 초과되었습니다. 페이지를 새로고침하고 다시 시도해주세요.');
      }
    }, timeoutMs);

    return () => clearTimeout(id);
  }, [loading, setLoading, timeoutMs]);
}
