import { test, expect, Page, Dialog } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 이 테스트 파일 내의 시나리오들은 DB 상태 변화(생성 -> 만료 -> 조회 차단)에 순차적으로 의존하므로 serial 모드로 설정합니다.
test.describe.configure({ mode: 'serial' });

test.describe('채용공고 만료 처리 및 일반 사용자 노출 제한 E2E 테스트', () => {

  let expiredJobId: string = '';

  // 다이얼로그 수락 핸들러를 등록하는 헬퍼 함수
  const registerDialogHandler = (page: Page) => {
    page.on('dialog', async (dialog: Dialog) => {
      try {
        await dialog.accept();
      } catch (err) {
        // 다이얼로그 수락 예외 처리
      }
    });
  };

  // ==========================================
  // 1. 해피 케이스: 기존 SK키파운드리 공고 탐색 -> EXPIRED 만료 처리 -> 구직자 로그인 -> SK키파운드리 노출 제한 검증
  // ==========================================
  test('해피 케이스: 관리자 공고 EXPIRED 변경 시 일반 사용자 대시보드 미노출 검증', async ({ page }) => {
    // 다이얼로그 수락 핸들러 등록
    registerDialogHandler(page);

    // 1-1. 관리자 로그인
    await page.goto('/login');
    await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();
    await expect(page).toHaveURL(/\/$/);

    // 1-2. 공고 목록 페이지(/jobs)로 이동하여 기존에 이미 존재하는 "SK키파운드리" 공고 검색 및 수정 진입
    await page.goto('/jobs');
    await expect(page.locator('.table-loading-state-box')).toBeHidden();

    await page.locator('.search-input-field').fill('SK키파운드리');
    const skRowBefore = page.locator('tbody tr:has-text("SK키파운드리")').first();
    await expect(skRowBefore).toBeVisible();

    // 상세 수정 화면 진입 (ID 추출을 위함)
    await skRowBefore.locator('button[aria-label="공고 수정"]').click();
    await expect(page).toHaveURL(/\/jobs\/edit\/\d+/);

    // 공고 수정 상세 화면에서 ID 추출
    const currentUrl = page.url();
    expiredJobId = currentUrl.split('/').pop() || '1';

    // 1-3. 마감일을 시작일 이후로 정정하여 400 에러를 방지하고 저장
    const closingDateInput = page.locator('label:has-text("마감일") + input');
    await closingDateInput.fill('2026-12-31');
    await page.locator('.btn-bottom-submit').click();
    await expect(page).toHaveURL(/\/jobs/);
    await expect(page.locator('.table-loading-state-box')).toBeHidden();

    // 1-4. "SK키파운드리" 공고 상태를 EXPIRED로 변경
    await page.locator('.search-input-field').fill('SK키파운드리');
    const skRow = page.locator('tbody tr:has-text("SK키파운드리")').first();
    await expect(skRow).toBeVisible();

    await skRow.locator('button[aria-label="메뉴 열기"]').click();
    await page.locator('button').filter({ hasText: /EXPIRED|만료/i }).click();

    // 상태 배지가 EXPIRED로 바뀌었는지 검증
    await expect(skRow.locator('.status-pill-badge')).toContainText(/EXPIRED|만료/i);

    // 1-5. 관리자 로그아웃
    await page.goto('/');
    const adminLogoutBtn = page.getByRole('button', { name: /로그아웃/ });
    await expect(adminLogoutBtn).toBeVisible();
    await adminLogoutBtn.click();
    await expect(page).toHaveURL(/\/login/);

    // 1-6. 일반 사용자(구직자) 로그인
    await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();
    await expect(page).toHaveURL(/\/$/);

    // 1-7. 일반 사용자 구직 포털에서 "SK키파운드리" 노출 제한 검증
    const searchInput = page.locator('.search-input-control');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('SK키파운드리');

    const skCard = page.locator('.job-card:has-text("SK키파운드리")');
    await expect(skCard).toHaveCount(0);

    // 일반 사용자 로그아웃
    const userLogoutBtn = page.locator('.btn-appbar-logout');
    await expect(userLogoutBtn).toBeVisible();
    await userLogoutBtn.click();
    await expect(page).toHaveURL(/\/login/);
  });

  // ==========================================
  // 2. 예외 케이스: 권한 및 데이터 격리 검증
  // ==========================================
  test('예외 케이스: 일반 사용자 권한으로 관리자 전용 공고 수정 URL 직접 접근 시 리다이렉트 검증', async ({ page }) => {
    // 일반 사용자 로그인
    await page.goto('/login');
    await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();
    await expect(page).toHaveURL(/\/$/);

    // 관리자 전용 공고 수정 페이지로 강제 주소 진입
    const targetId = expiredJobId || '1';
    await page.goto(`/jobs/edit/${targetId}`);

    // 보안 필터로 인해 대시보드(/)로 강제 복귀되는지 검증
    await expect(page).toHaveURL(/\/$/);
  });

  test('예외 케이스: 비승인(EXPIRED) 상태인 채용 공고 상세 직접 접근 차단 검증', async ({ page }) => {
    // 2-1. 일반 구직자로 로그인
    await page.goto('/login');
    await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();
    await expect(page).toHaveURL(/\/$/);

    // 2-2. 앞선 테스트에서 만료시킨 SK키파운드리 공고 상세 페이지 URL 직접 진입 시도
    const targetId = expiredJobId || '1';
    await page.goto(`/jobs/${targetId}`);

    // 상세 정보를 그리지 않고 찾을 수 없다는 에러 박스(.detail-empty-box)가 노출되는지 검증
    const emptyBox = page.locator('.detail-empty-box');
    await expect(emptyBox).toBeVisible();
    await expect(emptyBox.locator('h3')).toContainText(/찾을 수 없습니다|존재하지|오류|에러|empty/i);
  });
});
