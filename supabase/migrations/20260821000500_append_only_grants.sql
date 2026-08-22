-- ─────────────────────────────────────────────────────────────
-- audit_logs · consents 불변성을 트리거가 아니라 «권한»으로 강제한다
--
-- 문제
--   기존 reject_mutation 트리거는 UPDATE·DELETE를 무조건 막았는데,
--   이것이 외래 키의 참조 동작까지 함께 막았다.
--
--     · projects 삭제 → audit_logs.project_id ON DELETE CASCADE
--       → 자식 행 DELETE 시도 → 트리거가 예외 → 프로젝트 삭제 자체가 실패
--     · auth.users 삭제 → audit_logs.actor_user_id / consents.user_id
--       ON DELETE SET NULL → 자식 행 UPDATE 시도 → 트리거가 예외
--       → 사용자 삭제 자체가 실패 (탈퇴·파기 요청을 처리할 수 없게 된다)
--
--   개인정보처리방침 2.7·2.8이 약속한 「삭제 요구」와 「보유 기간 경과 시 파기」를
--   시스템이 이행하지 못하게 되는 문제라 그냥 두면 안 된다.
--
-- 해결
--   참조 동작(ON DELETE CASCADE·SET NULL)은 테이블 소유자 권한으로 실행되어
--   RLS와 GRANT를 우회한다. 반면 사용자의 직접 UPDATE·DELETE는 둘 다 통과해야 한다.
--   따라서 트리거를 걷어내고 다음 두 겹으로 막는다.
--
--     1. RLS에 UPDATE·DELETE 정책이 «없다» (정책 부재 = 거부)
--     2. authenticated·anon·service_role에서 UPDATE·DELETE 권한을 회수
--
--   1번만으로도 일반 사용자는 막히지만, service_role은 RLS를 우회하므로
--   2번이 있어야 서버 코드의 실수까지 막힌다.
-- ─────────────────────────────────────────────────────────────

drop trigger if exists audit_logs_append_only on public.audit_logs;
drop trigger if exists consents_append_only on public.consents;

revoke update, delete on public.audit_logs from authenticated, anon, service_role;
revoke update, delete on public.consents from authenticated, anon, service_role;

-- 기록 자체는 계속 쌓여야 한다
grant insert, select on public.audit_logs to authenticated, service_role;
grant insert, select on public.consents to authenticated, service_role;

-- reject_mutation은 더 이상 쓰이지 않는다.
-- 남겨두면 다음 사람이 다시 붙일 위험이 있으므로 함께 제거한다.
drop function if exists public.reject_mutation();
