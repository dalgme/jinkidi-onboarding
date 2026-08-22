-- ─────────────────────────────────────────────────────────────
-- seed.sql — 기본 데이터
--
-- 자사 전용 내부 도구이므로 개발사(agency)는 회원가입 플로우 없이 수동 시딩한다.
-- (설계 문서 1.2)
--
-- 실행: supabase db reset  또는  psql -f supabase/seed.sql
-- 개발사 멤버 추가는 아래 마지막 블록의 안내를 참고한다.
-- ─────────────────────────────────────────────────────────────

-- 1. 개발사
insert into public.agencies (id, name, slug, plan, invite_contact_email)
values (
  '00000000-0000-4000-a000-000000000001',
  '달그미',
  'dalgme',
  'internal',
  'onboarding@example.com'
)
on conflict (slug) do nothing;

-- 2. 기본 온보딩 템플릿
insert into public.onboarding_templates (id, agency_id, name, description, is_default)
values (
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000001',
  '표준 온보딩',
  '계정 개설 4단계 + 기획 문답 + 개발사 내부 단계. 대부분의 의뢰에 그대로 쓴다.',
  true
)
on conflict (id) do nothing;

-- 3. 템플릿 단계
--    안내문(description_md)은 의뢰인이 읽는 «유일한» 설명이다.
--    비개발자가 그대로 따라 할 수 있는 수준으로 쓴다.
insert into public.onboarding_template_steps
  (template_id, order_index, key, title, description_md, owner_side, verify_type, est_minutes, is_required)
select '00000000-0000-4000-a000-000000000002', v.order_index, v.key, v.title,
       v.description_md, v.owner_side, v.verify_type, v.est_minutes, true
from (values
  (1, 'github', 'GitHub Organization 개설 및 초대', '### 무엇을 하는 단계인가요

앞으로 만들어질 **소스 코드가 보관될 공간**을 대표님 명의로 먼저 만듭니다.
개발사는 그 공간에 «초대받은 손님»으로 들어갑니다. 계약이 끝나면 저희를 내보내시면 되고,
코드는 처음부터 끝까지 대표님 것으로 남습니다.

### 따라 하실 순서

1. [github.com](https://github.com) 에 접속해 계정이 없으시면 먼저 가입하세요. (무료)
2. 오른쪽 위 프로필 사진 → **Your organizations** → **New organization** 을 누릅니다.
3. 요금제는 **Free** 를 고르셔도 충분합니다.
4. 조직 이름(Organization name)을 정합니다. 영문 소문자와 하이픈만 쓸 수 있습니다.
   회사명이나 서비스명을 그대로 쓰시면 됩니다.
5. 만드신 조직 이름을 아래 입력란에 적어주세요. 그러면 초대 화면으로 바로 가는 버튼이 나타납니다.
6. 초대 화면에서 **Invite member** → 아래 «초대할 이메일 복사» 버튼으로 복사한 주소를 붙여넣습니다.
7. 역할(Role)은 **Owner** 로 지정해주세요.

### 자주 막히는 곳

- **조직 이름이 이미 사용 중이라고 나옵니다** — 전 세계에서 하나뿐인 이름이어야 합니다.
  뒤에 회사 약자나 `-team` 을 붙여보세요.
- **초대 메일이 안 갔대요** — 이메일 주소에 오타가 있을 가능성이 가장 큽니다.
  직접 입력하지 마시고 아래 복사 버튼을 쓰세요.', 'client', 'github_member', 6, true),
  (2, 'vercel', 'Vercel Team 개설·결제수단 등록·초대', '### 무엇을 하는 단계인가요

만들어진 사이트가 **실제로 인터넷에 올라가는 곳**입니다. 이 계정도 대표님 명의로 만듭니다.
결제수단을 대표님 카드로 등록해두셔야, 계약이 끝난 뒤에도 사이트가 그대로 살아 있습니다.

> 개발사 카드로 결제해두면 계약 종료 시 카드를 빼는 순간 사이트가 멈춥니다.
> 처음부터 대표님 명의로 두는 이유입니다.

### 따라 하실 순서

1. [vercel.com](https://vercel.com) 에서 **Continue with GitHub** 으로 가입하세요.
   앞 단계에서 만드신 GitHub 계정을 그대로 쓰시면 됩니다.
2. 왼쪽 위 팀 선택 메뉴 → **Create Team** 을 누릅니다.
3. 팀 이름을 정하고, 요금제는 **Pro** 를 선택합니다. (월 $20 부터, 실제 청구는 사용량에 따릅니다)
4. 결제수단(카드)을 등록합니다.
5. 만드신 팀 이름을 아래 입력란에 적어주세요.
6. 나타나는 버튼으로 멤버 초대 화면에 들어가 개발사 이메일을 초대합니다.
7. 역할(Role)은 **Member** 로 충분합니다.

### 자주 막히는 곳

- **카드가 거부됩니다** — 해외 결제 차단이 걸려 있는 경우가 많습니다.
  카드사 앱에서 «해외 온라인 결제»를 켜신 뒤 다시 시도해보세요.
- **Hobby 요금제로 만들었습니다** — 상업용 서비스는 Pro가 필요합니다.
  팀 설정에서 나중에 올리셔도 됩니다.', 'client', 'vercel_member', 5, true),
  (3, 'supabase', 'Supabase Organization 개설·결제·초대', '### 무엇을 하는 단계인가요

회원 정보·게시물 같은 **데이터가 저장되는 곳**입니다. 가장 중요한 자산이므로 반드시 대표님 명의여야 합니다.

### 따라 하실 순서

1. [supabase.com](https://supabase.com) 에서 GitHub 계정으로 가입하세요.
2. 왼쪽 위 조직 선택 → **New organization** 을 누릅니다.
3. 조직 이름과 요금제를 정합니다. 서비스 오픈 전이라면 **Free** 로 시작해도 됩니다.
4. 만드신 조직 이름을 아래 입력란에 적어주세요.
5. 나타나는 버튼으로 팀 화면에 들어가 개발사 이메일을 초대합니다.
6. 역할(Role)은 **Administrator** 로 지정해주세요.

### 꼭 확인해주세요

프로젝트를 만드실 때 **Region 은 반드시 «Northeast Asia (Seoul)»** 로 선택해야 합니다.
한 번 정하면 나중에 바꿀 수 없고, 국내 이용자 정보를 국외로 보내지 않으려면 서울이어야 합니다.
저희가 대신 만들어 드릴 수도 있으니, 헷갈리시면 그냥 조직만 만들고 알려주세요.', 'client', 'supabase_member', 5, true),
  (4, 'domain', '도메인 구매(의뢰인 명의) 및 DNS 연결', '### 무엇을 하는 단계인가요

사이트 주소(예: `mycompany.com`)를 **대표님 명의로** 구입하고, 그 주소가 새 사이트를 가리키도록 연결합니다.

> 도메인은 회사의 이름값 그 자체입니다. 개발사 명의로 사두면 나중에 이전 절차가 번거롭고,
> 연락이 닿지 않으면 되찾기 어려워집니다.

### 따라 하실 순서

1. 원하는 주소를 정하고 등록 업체에서 구입합니다.
   국내는 [가비아](https://www.gabia.com), 해외는 [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)
   나 [Namecheap](https://www.namecheap.com) 을 많이 씁니다. 연 2만원 안팎입니다.
2. 구입한 주소를 아래 입력란에 적어주세요.
3. **DNS 연결은 저희가 안내드립니다.** 등록 업체 관리 화면에 접속하실 수 있도록 준비만 해주세요.
   저희가 입력하실 값(CNAME 또는 A 레코드)을 코멘트로 정확히 알려드립니다.
4. 값을 입력하신 뒤 알려주시면 저희가 연결 상태를 확인합니다.

### 자주 막히는 곳

- **연결했는데 사이트가 안 열립니다** — DNS는 반영까지 최대 24시간이 걸립니다.
  보통은 10분 안에 되지만, 하루는 기다려보셔야 합니다.
- **어떤 주소가 좋을지 모르겠습니다** — 코멘트로 물어봐 주세요. 함께 정하면 됩니다.', 'both', 'dns', 4, true),
  (5, 'intake', '기획 정보 문답 작성', '### 무엇을 하는 단계인가요

만들려는 서비스에 대해 여덟 가지 영역으로 나누어 여쭙습니다. **총 32문항**이고,
대부분 고르기만 하시면 됩니다.

한 번에 다 채우지 않으셔도 됩니다. 적으신 내용은 자동으로 저장되니
중간에 닫으셨다가 편하실 때 이어서 작성하세요.

모르는 항목에는 **«잘 모르겠어요 — 추천받을게요»** 를 고르시면 됩니다.
저희가 근거와 함께 제안을 채워 드립니다. 억지로 답하지 않으셔도 괜찮습니다.', 'client', 'manual', 25, true),
  (6, 'intake-review', '기획 정보 검토 및 추천 작성', '개발사가 처리하는 단계입니다.

의뢰인이 제출한 문답을 검토하고, «추천 필요»로 표시된 문항에 근거와 함께 제안을 작성합니다.', 'agency', 'manual', 60, true),
  (7, 'architecture', '아키텍처 확정 및 착수 보고', '개발사가 처리하는 단계입니다.

문답 결과를 바탕으로 기술 구조를 확정하고, 일정과 범위를 정리해 산출물로 공유합니다.', 'agency', 'manual', 120, true)
) as v(order_index, key, title, description_md, owner_side, verify_type, est_minutes, is_required)
on conflict (template_id, key) do nothing;

-- 4. 인테이크 문답 스키마 (8단계 32문항)
insert into public.intake_forms (agency_id, version, schema, is_default)
values (
  '00000000-0000-4000-a000-000000000001',
  'v1',
  '{
  "version": "v1",
  "title": "기획 정보 문답",
  "description": "서비스를 만들기 전에 확인해야 하는 것들을 여덟 가지로 나누어 여쭤봅니다. 정답을 맞히는 문답이 아니니 편하게 답해주세요. 모르는 항목은 «잘 모르겠어요 — 추천받을게요»를 고르시면 저희가 제안을 드립니다.",
  "stages": [
    {
      "key": "business",
      "title": "사업 모델",
      "summary": "누구에게 무엇을 팔거나 제공하는지 확인합니다.",
      "questions": [
        {
          "key": "one_liner",
          "type": "text",
          "label": "만들려는 서비스를 한 줄로 설명해주세요",
          "help": "«OO한 사람들이 OO를 할 수 있는 곳» 정도면 충분합니다.",
          "required": true
        },
        {
          "key": "target_customer",
          "type": "single",
          "label": "주 고객은 누구인가요?",
          "required": true,
          "options": [
            { "value": "b2c", "label": "일반 소비자 (B2C)" },
            { "value": "b2b", "label": "기업·사업자 (B2B)" },
            { "value": "b2b2c", "label": "둘 다 (중개·플랫폼)" },
            { "value": "internal", "label": "내부 직원만 쓰는 도구" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "revenue_model",
          "type": "multi",
          "label": "수익은 어떻게 발생하나요? (복수 선택)",
          "required": true,
          "options": [
            { "value": "subscription", "label": "구독 (월·연 정기 결제)" },
            { "value": "one_time", "label": "단건 판매" },
            { "value": "commission", "label": "거래 수수료" },
            { "value": "ads", "label": "광고" },
            { "value": "free", "label": "무료 — 수익 모델 없음" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "competitors",
          "type": "longtext",
          "label": "비슷한 서비스가 있다면 알려주세요",
          "help": "이름이나 주소만 적어주셔도 됩니다. 참고할 만한 점도 함께 적어주시면 좋습니다.",
          "required": false
        }
      ]
    },
    {
      "key": "product",
      "title": "제품 구조",
      "summary": "화면에 무엇이 담기고 어떻게 분류되는지 확인합니다.",
      "questions": [
        {
          "key": "core_offering",
          "type": "longtext",
          "label": "사용자에게 제공하는 핵심 항목은 무엇인가요?",
          "help": "예: 강의, 상품, 예약 슬롯, 문서, 프로필 등",
          "required": true
        },
        {
          "key": "taxonomy",
          "type": "single",
          "label": "그 항목을 어떻게 분류하나요?",
          "required": true,
          "options": [
            { "value": "category", "label": "카테고리 (계층 구조)" },
            { "value": "tag", "label": "태그 (자유 조합)" },
            { "value": "both", "label": "카테고리 + 태그" },
            { "value": "none", "label": "분류가 필요 없음" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "main_flow",
          "type": "longtext",
          "label": "사용자가 처음 들어와서 목적을 이루기까지의 흐름을 적어주세요",
          "help": "예: 검색 → 상세 보기 → 문의 → 예약 확정",
          "required": true
        },
        {
          "key": "content_volume",
          "type": "single",
          "label": "오픈 시점에 등록될 항목은 몇 개쯤인가요?",
          "required": false,
          "options": [
            { "value": "under_50", "label": "50개 미만" },
            { "value": "under_500", "label": "50 ~ 500개" },
            { "value": "under_5000", "label": "500 ~ 5,000개" },
            { "value": "over_5000", "label": "5,000개 이상" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        }
      ]
    },
    {
      "key": "members",
      "title": "회원·권한",
      "summary": "누가 가입하고 무엇을 할 수 있는지 확인합니다.",
      "questions": [
        {
          "key": "signup_required",
          "type": "single",
          "label": "가입이 꼭 필요한가요?",
          "required": true,
          "options": [
            { "value": "required", "label": "네, 가입해야 이용할 수 있습니다" },
            { "value": "optional", "label": "둘러보기는 가입 없이, 이용은 가입 후" },
            { "value": "none", "label": "가입 없이 모두 이용" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "member_types",
          "type": "multi",
          "label": "회원 유형은 어떻게 나뉘나요?",
          "required": true,
          "options": [
            { "value": "general", "label": "일반 회원 한 종류" },
            { "value": "seller_buyer", "label": "판매자 / 구매자" },
            { "value": "org", "label": "기업 계정 (여러 명이 한 계정 그룹)" },
            { "value": "admin_only", "label": "관리자만 별도" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "login_methods",
          "type": "multi",
          "label": "로그인 방식은 무엇을 쓰고 싶으신가요?",
          "required": true,
          "options": [
            { "value": "email_password", "label": "이메일 + 비밀번호" },
            { "value": "magic_link", "label": "이메일 링크 (비밀번호 없음)" },
            { "value": "kakao", "label": "카카오" },
            { "value": "naver", "label": "네이버" },
            { "value": "google", "label": "구글" },
            { "value": "apple", "label": "애플" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "identity_verification",
          "type": "single",
          "label": "본인 확인(휴대폰 인증)이 필요한가요?",
          "help": "법적으로 필요한 경우가 아니면 가입 이탈이 크게 늘어납니다.",
          "required": true,
          "options": [
            { "value": "yes", "label": "네, 필요합니다" },
            { "value": "no", "label": "아니요" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "permission_notes",
          "type": "longtext",
          "label": "회원 유형별로 못 하게 막아야 하는 것이 있다면 적어주세요",
          "required": false
        }
      ]
    },
    {
      "key": "payment",
      "title": "결제",
      "summary": "돈이 오가는 방식과 환불 정책을 확인합니다.",
      "questions": [
        {
          "key": "payment_needed",
          "type": "single",
          "label": "서비스 안에서 결제가 일어나나요?",
          "required": true,
          "options": [
            { "value": "yes", "label": "네" },
            { "value": "later", "label": "지금은 아니지만 나중에 필요합니다" },
            { "value": "no", "label": "아니요" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "pg",
          "type": "single",
          "label": "결제대행사(PG)를 정해두셨나요?",
          "required": false,
          "options": [
            { "value": "toss", "label": "토스페이먼츠" },
            { "value": "portone", "label": "포트원(아임포트)" },
            { "value": "nice", "label": "나이스페이" },
            { "value": "stripe", "label": "Stripe (해외 결제)" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "b2b_billing",
          "type": "multi",
          "label": "사업자 고객을 위한 처리가 필요한가요?",
          "required": false,
          "options": [
            { "value": "tax_invoice", "label": "세금계산서 발행" },
            { "value": "bank_transfer", "label": "계좌이체·무통장 입금" },
            { "value": "quote", "label": "견적서 발행" },
            { "value": "none", "label": "필요 없음" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "refund_policy",
          "type": "longtext",
          "label": "환불 정책이 있다면 적어주세요",
          "help": "전자상거래법상 필수 고지 사항입니다. 아직 없으시면 비워두세요.",
          "required": false
        }
      ]
    },
    {
      "key": "structure",
      "title": "정보 구조",
      "summary": "메뉴와 화면이 어떻게 배치될지 확인합니다.",
      "questions": [
        {
          "key": "menu",
          "type": "longtext",
          "label": "상단 메뉴에 무엇이 들어가면 좋을까요?",
          "help": "떠오르는 대로 쉼표로 나열해주세요. 순서도 함께 적어주시면 좋습니다.",
          "required": true
        },
        {
          "key": "mypage",
          "type": "multi",
          "label": "마이페이지에 무엇이 필요할까요?",
          "required": false,
          "options": [
            { "value": "profile", "label": "내 정보 수정" },
            { "value": "orders", "label": "주문·이용 내역" },
            { "value": "bookmarks", "label": "찜·즐겨찾기" },
            { "value": "notifications", "label": "알림 설정" },
            { "value": "none", "label": "마이페이지가 필요 없음" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "seo_priority",
          "type": "single",
          "label": "검색(네이버·구글)에서 유입되는 것이 얼마나 중요한가요?",
          "required": true,
          "options": [
            { "value": "critical", "label": "가장 중요합니다 — 검색이 주 유입 경로" },
            { "value": "moderate", "label": "어느 정도 중요합니다" },
            { "value": "low", "label": "중요하지 않습니다 — 로그인 후 쓰는 서비스" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "landing_goal",
          "type": "single",
          "label": "첫 화면에서 방문자가 하기를 바라는 단 하나의 행동은?",
          "required": true,
          "options": [
            { "value": "signup", "label": "가입하기" },
            { "value": "inquiry", "label": "문의·상담 신청" },
            { "value": "browse", "label": "둘러보기·검색" },
            { "value": "purchase", "label": "바로 구매" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        }
      ]
    },
    {
      "key": "content",
      "title": "콘텐츠·소통",
      "summary": "글이 올라가는 곳과 문의 받는 경로를 확인합니다.",
      "questions": [
        {
          "key": "content_areas",
          "type": "multi",
          "label": "글·자료가 올라가는 영역이 있나요?",
          "required": false,
          "options": [
            { "value": "notice", "label": "공지사항" },
            { "value": "blog", "label": "블로그·아티클" },
            { "value": "faq", "label": "자주 묻는 질문" },
            { "value": "community", "label": "커뮤니티 게시판" },
            { "value": "none", "label": "없음" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "support_channel",
          "type": "multi",
          "label": "고객 문의는 어디로 받으시겠어요?",
          "required": true,
          "options": [
            { "value": "form", "label": "사이트 내 문의 폼" },
            { "value": "email", "label": "이메일" },
            { "value": "kakao", "label": "카카오톡 채널" },
            { "value": "phone", "label": "전화" },
            { "value": "chat", "label": "채팅 상담 도구(채널톡 등)" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "reviews",
          "type": "single",
          "label": "후기·평점 기능이 필요한가요?",
          "required": true,
          "options": [
            { "value": "yes", "label": "네, 필요합니다" },
            { "value": "later", "label": "나중에 추가하고 싶습니다" },
            { "value": "no", "label": "아니요" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        }
      ]
    },
    {
      "key": "operation",
      "title": "운영·백오피스",
      "summary": "오픈 이후 누가 무엇을 관리할지 확인합니다.",
      "questions": [
        {
          "key": "operators",
          "type": "single",
          "label": "오픈 후 사이트를 관리할 인원은 몇 명인가요?",
          "required": true,
          "options": [
            { "value": "one", "label": "1명 (대표님 본인)" },
            { "value": "few", "label": "2 ~ 3명" },
            { "value": "team", "label": "4명 이상 — 역할 구분 필요" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "stats_needed",
          "type": "multi",
          "label": "관리자 화면에서 어떤 숫자를 보고 싶으신가요?",
          "required": false,
          "options": [
            { "value": "visitors", "label": "방문자 수" },
            { "value": "signups", "label": "가입자 수" },
            { "value": "sales", "label": "매출·주문" },
            { "value": "content", "label": "등록된 항목 수" },
            { "value": "inquiries", "label": "문의 건수" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "manual_tasks",
          "type": "longtext",
          "label": "관리자가 손으로 처리해야 하는 일이 있다면 적어주세요",
          "help": "예: 입점 승인, 환불 처리, 게시물 검수",
          "required": false
        }
      ]
    },
    {
      "key": "nonfunctional",
      "title": "비기능 요건",
      "summary": "화면 환경, 법적 요건, 디자인 톤을 확인합니다.",
      "questions": [
        {
          "key": "mobile_priority",
          "type": "single",
          "label": "이용자는 주로 어떤 기기로 접속할까요?",
          "required": true,
          "options": [
            { "value": "mobile", "label": "대부분 휴대폰" },
            { "value": "pc", "label": "대부분 PC" },
            { "value": "both", "label": "반반" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "languages",
          "type": "multi",
          "label": "한국어 외 언어가 필요한가요?",
          "required": true,
          "options": [
            { "value": "ko_only", "label": "한국어만" },
            { "value": "en", "label": "영어" },
            { "value": "ja", "label": "일본어" },
            { "value": "zh", "label": "중국어" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "legal_requirements",
          "type": "multi",
          "label": "해당되는 법적 요건이 있나요?",
          "help": "확실하지 않으면 «잘 모르겠어요»를 고르세요. 저희가 확인해 드립니다.",
          "required": false,
          "options": [
            { "value": "ecommerce", "label": "전자상거래 (통신판매업 신고)" },
            { "value": "privacy", "label": "개인정보 수집 (처리방침 필요)" },
            { "value": "minors", "label": "만 14세 미만 이용 가능" },
            { "value": "medical", "label": "의료·금융 등 규제 업종" },
            { "value": "none", "label": "해당 없음" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "design_tone",
          "type": "single",
          "label": "원하시는 디자인 분위기에 가장 가까운 것은?",
          "required": true,
          "options": [
            { "value": "clean", "label": "깔끔하고 담백한" },
            { "value": "trendy", "label": "감각적이고 트렌디한" },
            { "value": "trustworthy", "label": "신뢰감 있고 단정한" },
            { "value": "friendly", "label": "친근하고 부드러운" },
            { "value": "need_advice", "label": "잘 모르겠어요 — 추천받을게요" }
          ]
        },
        {
          "key": "reference_sites",
          "type": "longtext",
          "label": "«이런 느낌이면 좋겠다» 싶은 사이트 주소를 알려주세요",
          "help": "두세 개면 충분합니다. 어떤 점이 마음에 드셨는지도 함께 적어주세요.",
          "required": false
        }
      ]
    }
  ]
}
'::jsonb,
  true
)
on conflict (agency_id, version) do update set schema = excluded.schema;

-- 5. 고정비 요율 (2026-08 기준)
--    ⚠ 요율은 계속 바뀐다. 코드에 하드코딩하지 않고 이 테이블에서만 읽는다.
--       요율이 바뀌면 기존 행을 고치지 말고 새 effective_from으로 행을 추가한다.
insert into public.cost_rates
  (agency_id, service, plan, item_key, label, unit, included_qty, unit_price_usd, fixed_price_usd, effective_from)
select '00000000-0000-4000-a000-000000000001', v.service, v.plan, v.item_key, v.label,
       v.unit, v.included_qty, v.unit_price_usd, v.fixed_price_usd, v.effective_from
from (values
  ('vercel', 'pro', 'seat', '팀 좌석', 'seat', 0, 20, 0, date '2026-08-01'),
  ('vercel', 'pro', 'bandwidth_gb', '전송량 (1TB 포함)', 'GB', 1000, 0.15, 0, date '2026-08-01'),
  ('vercel', 'pro', 'function_gb_hours', '함수 실행 (1,000GB-h 포함)', 'GB-hour', 1000, 0.18, 0, date '2026-08-01'),
  ('supabase', 'pro', 'base', '기본요금', 'month', 0, 0, 25, date '2026-08-01'),
  ('supabase', 'pro', 'db_size_gb', 'DB 용량 (8GB 포함)', 'GB', 8, 0.125, 0, date '2026-08-01'),
  ('supabase', 'pro', 'storage_gb', '파일 저장 (100GB 포함)', 'GB', 100, 0.021, 0, date '2026-08-01'),
  ('supabase', 'pro', 'bandwidth_gb', '전송량 (250GB 포함)', 'GB', 250, 0.09, 0, date '2026-08-01'),
  ('domain', 'standard', 'registration', '도메인 등록 (연 $15 을 12개월로 안분)', 'month', 0, 0, 1.25, date '2026-08-01'),
  ('resend', 'free', 'emails', '메일 발송 (월 3,000통 포함)', 'email', 3000, 0, 0, date '2026-08-01'),
  ('resend', 'pro', 'emails', '메일 발송 초과분 (Pro 월 $20, 50,000통 포함)', 'email', 50000, 0.0004, 20, date '2026-08-01')
) as v(service, plan, item_key, label, unit, included_qty, unit_price_usd, fixed_price_usd, effective_from)
on conflict (agency_id, service, plan, item_key, effective_from) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 6. 개발사 멤버 시딩 (수동)
--
-- Supabase Dashboard → Authentication → Users 에서 개발사 구성원을 «Invite user»로
-- 추가한 뒤, 아래 쿼리의 이메일만 바꿔 실행한다.
--
--   insert into public.agency_members (agency_id, user_id, role, display_name)
--   select '00000000-0000-4000-a000-000000000001', id, 'owner', '이름'
--     from auth.users where email = 'you@example.com'
--   on conflict (agency_id, user_id) do nothing;
--
-- ─────────────────────────────────────────────────────────────
