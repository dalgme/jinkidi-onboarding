import { expect, test } from '@playwright/test'

/**
 * E2E — 초대 → 매직링크 → 단계 체크 → 검증 1회전 (설계 문서 15장)
 *
 * 매직링크는 메일함을 거치므로 완전 자동화가 어렵다.
 * 실행 전 아래 두 값을 준비한다.
 *
 *   E2E_CLIENT_STORAGE_STATE  의뢰인으로 로그인한 뒤 저장한 storageState 경로
 *   E2E_PROJECT_CODE          테스트용 프로젝트 code
 *
 * 값이 없으면 «로그인 없이 확인 가능한 것»만 검사하고 나머지는 skip한다.
 * (CI에서 조용히 통과하는 것을 막기 위해 skip 사유를 남긴다)
 */
const PROJECT_CODE = process.env.E2E_PROJECT_CODE
const STORAGE_STATE = process.env.E2E_CLIENT_STORAGE_STATE

test.describe('공개 경로', () => {
  test('약관·개인정보처리방침이 로그인 없이 열린다', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: '이용약관', level: 1 })).toBeVisible()

    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: '개인정보처리방침', level: 1 })).toBeVisible()
  })

  test('robots.txt가 전체를 차단하고 약관만 허용한다', async ({ request }) => {
    const response = await request.get('/robots.txt')
    const body = await response.text()
    expect(body).toContain('Disallow: /')
    expect(body).toContain('/terms')
  })

  test('비로그인으로 /app에 들어가면 로그인으로 보낸다', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

  test('비로그인으로 포털에 들어가면 로그인으로 보낸다', async ({ page }) => {
    await page.goto('/p/any-project')
    await expect(page).toHaveURL(/\/login/)
  })

  test('로그인 화면에서 매직링크를 요청할 수 있다', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('이메일 주소')).toBeVisible()
    await expect(page.getByRole('button', { name: '로그인 링크 받기' })).toBeVisible()
  })
})

test.describe('의뢰인 포털', () => {
  test.skip(!PROJECT_CODE || !STORAGE_STATE, 'E2E_PROJECT_CODE / E2E_CLIENT_STORAGE_STATE 가 필요합니다')
  test.use({ storageState: STORAGE_STATE })

  test('포털 홈에서 「지금 하실 일」이 정확히 하나만 보인다', async ({ page }) => {
    await page.goto(`/p/${PROJECT_CODE}`)

    const nowDo = page.getByRole('heading', { name: '지금 하실 일' })
    await expect(nowDo).toBeVisible()

    // 「시작하기」 버튼은 한 개여야 한다.
    // 두 개 이상 보이면 의뢰인은 아무것도 시작하지 않는다.
    await expect(page.getByRole('link', { name: /시작하기/ })).toHaveCount(1)
  })

  test('의뢰인 화면 어디에도 「확인 완료」로 만드는 버튼이 없다', async ({ page }) => {
    await page.goto(`/p/${PROJECT_CODE}`)
    await page.getByRole('link', { name: /시작하기/ }).click()

    await expect(page.getByRole('button', { name: '완료했습니다' })).toBeVisible()
    // verified는 개발사만 만들 수 있다. RLS가 막지만 UI에도 노출하지 않는다.
    await expect(page.getByRole('button', { name: '확인 완료' })).toHaveCount(0)
  })

  test('단계 상세에서 조직 이름을 입력하면 딥링크 버튼이 나타난다', async ({ page }) => {
    await page.goto(`/p/${PROJECT_CODE}`)
    await page.getByRole('link', { name: /시작하기/ }).click()

    const slugInput = page.getByLabel(/이름/).first()
    if (await slugInput.isVisible().catch(() => false)) {
      // 주소창을 통째로 붙여넣어도 slug가 추출되어야 한다
      await slugInput.fill('https://github.com/orgs/e2e-test-org/people')
      await page.getByRole('button', { name: '저장하고 다음으로' }).click()
    }

    await expect(page.getByRole('link', { name: /초대 화면 열기/ })).toBeVisible()
  })

  test('모바일 375px에서 하단 버튼이 화면 안에 있다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/p/${PROJECT_CODE}`)

    const viewport = page.viewportSize()
    expect(viewport?.width).toBe(375)

    // 가로 스크롤이 생기면 안 된다
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)
  })

  test('기획 문답이 자동저장된다', async ({ page }) => {
    await page.goto(`/p/${PROJECT_CODE}/intake`)

    const firstText = page.getByRole('textbox').first()
    await firstText.fill('E2E 자동저장 확인')

    // debounce 800ms 뒤 저장 표시가 뜬다
    await expect(page.getByText(/저장됨/)).toBeVisible({ timeout: 5000 })
  })
})
