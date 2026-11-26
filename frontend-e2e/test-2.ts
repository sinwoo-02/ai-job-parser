import { test, expect } from '@playwright/test';

test.describe('관리자 로그인 및 모바일 반응형 레이아웃 E2E 테스트', () => {

  // 각 테스트 실행 전 로그인 페이지로 이동합니다.
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // ==========================================
  // 1. 해피 케이스: 로그인 성공, 햄버거 메뉴 작동, 가로/세로 레이아웃 반응형 변환 검증
  // ==========================================
  test('해피 케이스: 올바른 계정 정보로 로그인 시 대시보드 진입 및 767px 이하 반응형 요소 검증', async ({ page }) => {
    // 1-1. 관리자 로그인 시도
    await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    // 로그인 완료 및 대시보드 리다이렉션 검증
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /대시보드/ })).toBeVisible();

    // 1-2. PC 해상도 검증 (기본 뷰포트 1280px)
    // PC 화면에서는 모바일용 햄버거 토글 버튼이 화면에 보이지 않아야 합니다.
    const hamburgerBtn = page.locator('.mobile-hamburger-btn');
    await expect(hamburgerBtn).toBeHidden();

    // 벤토 요약 그리드 내 카드 2개를 추적하여 가로 배열 여부 검증
    const cards = page.locator('.bento-summary-grid .bento-card');
    const firstCard = cards.nth(0);
    const secondCard = cards.nth(1);

    const pcBox1 = await firstCard.boundingBox();
    const pcBox2 = await secondCard.boundingBox();
    if (pcBox1 && pcBox2) {
      // PC 해상도에서는 두 카드가 가로로 나란히 배치되므로 y좌표 차이가 거의 없고 x좌표는 다릅니다.
      expect(Math.abs(pcBox1.y - pcBox2.y)).toBeLessThan(10);
      expect(pcBox1.x).toBeLessThan(pcBox2.x);
    }

    // 1-3. 모바일 해상도 검증 (767px 이하로 강제 조정)
    await page.setViewportSize({ width: 767, height: 800 });

    // 화면 폭이 767px 이하일 때 햄버거 버튼이 나타나는지 검증
    await expect(hamburgerBtn).toBeVisible();

    // 햄버거 토글 클릭 시 사이드 메뉴 드로어가 열리고 닫히는지 동작 검증
    const sidebar = page.locator('aside.side-nav-bar');
    await expect(sidebar).not.toHaveClass(/open/); // 닫혀있는 초기 상태

    await hamburgerBtn.click();
    await expect(sidebar).toHaveClass(/open/); // 열림 상태 확인

    // 반투명 백드롭 영역을 클릭하여 모바일 사이드바를 다시 닫습니다.
    await page.locator('.nav-backdrop').click();
    await expect(sidebar).not.toHaveClass(/open/); // 정상 닫힘 확인

    // 화면 폭이 767px 이하일 때 벤토 카드 레이아웃이 세로(Column) 배열로 전환되는지 검증
    const mobBox1 = await firstCard.boundingBox();
    const mobBox2 = await secondCard.boundingBox();
    if (mobBox1 && mobBox2) {
      // 세로 배열이므로 x좌표 차이가 거의 없고 y좌표는 첫 번째 카드가 위(작은 값)에 쌓입니다.
      expect(Math.abs(mobBox1.x - mobBox2.x)).toBeLessThan(15);
      expect(mobBox1.y).toBeLessThan(mobBox2.y);
    }

    // 1-4. 데스크톱 뷰포트로 원복 및 로그아웃 기능 검증
    await page.setViewportSize({ width: 1280, height: 800 });
    const logoutBtn = page.getByRole('button', { name: /로그아웃/ });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/);
  });

  // ==========================================
  // 2. 예외 케이스: 로그인 실패 및 입력값 누락 제어 검증
  // ==========================================
  test('예외 케이스: 비밀번호 불일치 시 로그인 실패 및 에러 피드백 노출', async ({ page }) => {
    await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('wrong_password');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    const errorAlert = page.locator('.error-alert-box');
    await expect(errorAlert).toContainText(/(이메일|비밀번호).*(일치하지|않습니다|틀렸|확인)/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('예외 케이스: 필수 입력 항목(비밀번호) 누락 시 로그인 요청 전송 차단', async ({ page }) => {
    await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    // HTML5 required 유효성 또는 프론트엔드 유효성 방어로 인해 에러 메시지 팝업 없이 로그인 창 유지
    const errorAlert = page.locator('.error-alert-box');
    await expect(errorAlert).not.toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('예외 케이스: 모바일(767px 이하) 환경에서 로그인 실패 시 에러 피드백 노출 및 레이아웃 깨짐(가로스크롤)이 없는지 검증', async ({ page }) => {
    // 뷰포트 크기를 모바일 스케일로 지정
    await page.setViewportSize({ width: 767, height: 800 });

    await page.getByLabel('이메일 주소', { exact: true }).fill('nonexistent_admin@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    const errorAlert = page.locator('.error-alert-box');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/(이메일|비밀번호).*(일치하지|않습니다|틀렸|확인)/);

    // 모바일 레이아웃 반응형 최적화 확인을 위한 가로 스크롤 발생 검증 (가로스크롤바 비활성화 상태 확인)
    const isHorizontalScrollbarActive = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isHorizontalScrollbarActive).toBe(false);
  });
});
