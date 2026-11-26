import { test, expect } from '@playwright/test';

test.describe('일반 사용자 채용공고 조회 E2E 테스트', () => {

  // ==========================================
  // 1. 해피 케이스: 일반 사용자 로그인, 공고 검증, 상세 조회 및 로그아웃
  // ==========================================
  test('해피 케이스: 일반 사용자 로그인 후 APPROVED 공고 리스트업 및 상세 페이지 이동 검증', async ({ page }) => {
    // 1-1. 로그인 페이지 접속 및 일반 사용자 로그인 시도
    await page.goto('/login');
    await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    // 일반 사용자 메인 화면('/') 진입 확인
    await expect(page).toHaveURL(/\/$/);
    
    // 1-2. APPROVED 상태인 공고들이 정상적으로 노출되는지 검증
    // 승인완료 배지를 가진 공고가 리스트에 최소 1개 이상 보이는지 확인
    const approvedBadge = page.locator('.job-card .badge-approved');
    await expect(approvedBadge.first()).toBeVisible();
    await expect(approvedBadge.first()).toContainText(/승인|완료|APPROVED/i);

    // 1-3. 기업명이 "연암공과대학교"인 채용 공고 검색 및 클릭
    const searchInput = page.locator('.search-input-control');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('연암공과대학교');

    // 연암공과대학교 채용 공고 카드 검증 및 클릭
    const targetCard = page.locator('.job-card:has-text("연암공과대학교")').first();
    await expect(targetCard).toBeVisible();
    await targetCard.click();

    // 1-4. 상세 페이지(/jobs/{id}) 진입 및 상세 항목 검증
    await expect(page).toHaveURL(/\/jobs\/\d+/);
    await expect(page.locator('.detail-company-name')).toContainText('연암공과대학교');
    await expect(page.locator('.detail-status-badge')).toContainText(/승인|완료|APPROVED/i);
    await expect(page.locator('.btn-sidebar-apply')).toBeVisible(); // 지원하기 버튼 노출 확인

    // 1-5. 로그아웃 시도 및 로그인 창 리다이렉트 확인
    const logoutBtn = page.locator('.btn-appbar-logout');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/);
  });

  // ==========================================
  // 2. 예외 케이스: 비인가 검증 및 접근 제어 테스트
  // ==========================================
  test('예외 케이스: 일반 사용자 로그인 실패 및 에러 메시지 확인', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('wrong_password'); // 오기입
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    const errorAlert = page.locator('.error-alert-box');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/(이메일|비밀번호).*(일치하지|않습니다|틀렸|확인)/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('예외 케이스: 로그인하지 않은 상태로 상세 페이지 직접 진입 시 로그인 리다이렉트 검증', async ({ page }) => {
    // 세션이 없는 상태에서 강제로 특정 공고 상세 페이지 URL 진입 시도
    await page.goto('/jobs/1');

    // 비인가 접근으로 판단되어 로그인 화면으로 즉각 튕겨내는지(Navigate) 검증
    await expect(page).toHaveURL(/\/login/);
  });

  test('예외 케이스: 구직 포털 메인 목록에 대기 상태(PENDING) 공고가 노출되지 않는지 검증', async ({ page }) => {
    // 3-1. 일반 사용자 정상 로그인
    await page.goto('/login');
    await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    // 일반 사용자 메인 화면('/') 진입
    await expect(page).toHaveURL(/\/$/);

    // 3-2. 검토중(badge-pending) 뱃지를 가진 대기 상태 채용 공고가 리스트상에 0개여야 함을 검증
    // 일반 사용자 페이지에서는 APPROVED 상태만 보여야 하므로 PENDING 배지가 존재해서는 안 됨
    const pendingBadges = page.locator('.job-card .badge-pending');
    await expect(pendingBadges).toHaveCount(0);

    // 3-3. 텍스트 기준 '검토중' 표기가 된 카드가 발견되지 않아야 함
    const pendingTexts = page.locator('.job-card').filter({ hasText: /검토중|대기|PENDING/i });
    await expect(pendingTexts).toHaveCount(0);
  });
});
