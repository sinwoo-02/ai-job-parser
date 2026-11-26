import { test, expect, Page, Dialog } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe.configure({ mode: 'serial' });

test.describe('채용 포털 E2E 테스트 - 시나리오 5', () => {

  // 다이얼로그 수락 핸들러 등록 헬퍼
  const registerDialogHandler = (page: Page) => {
    page.on('dialog', async (dialog: Dialog) => {
      try {
        await dialog.accept();
      } catch (err) {
        // 다이얼로그 처리 중 에러 방지
      }
    });
  };



  test.describe('1. 일반 사용자 로그인 및 공고 다중 필터링 테스트', () => {

    test('해피 케이스: 일반 사용자 로그인 후 APPROVED 공고 다중 필터링(기업명, 오름차순) 검증', async ({ page }) => {
      // 1-1. 로그인 페이지 접속
      await page.goto('/login');

      // 1-2. 일반 사용자 정보 입력 및 로그인
      await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
      await page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("확인")').first().click();

      // 1-3. 로그인 성공 후 메인 페이지 리다이렉션 검증 (URL이 / 이며 APPROVED 배지 보임)
      await expect(page).toHaveURL(/\/$/);
      const approvedBadge = page.locator('.job-card .badge-approved');
      await expect(approvedBadge.first()).toBeVisible();

      // 1-4. 다중 필터링 수행: 기업명 검색어 입력 ("테크")
      const searchInput = page.locator('.search-input-control');
      await expect(searchInput).toBeVisible();
      await searchInput.fill('테크');

      // 1-5. 정렬 기준 변경: "회사명순" 선택
      // JobListPage.jsx 상에서 두 번째 select가 sortBy임
      const sortBySelect = page.locator('.filter-select-control').nth(1);
      await sortBySelect.selectOption('회사명순');

      // 1-6. 정렬 순서 변경: "오름차순" 선택
      // JobListPage.jsx 상에서 세 번째 select가 sortOrder임
      const sortOrderSelect = page.locator('.filter-select-control').nth(2);
      await sortOrderSelect.selectOption('오름차순');

      // 1-7. 필터링 및 오름차순 정렬 결과 검증
      // 렌더링된 채용 카드의 회사명 리스트가 오름차순 순서로 정렬되어 표시되는지 확인
      await page.waitForTimeout(2000); // 렌더링 안정화를 위해 충분히 대기
      const companyNames = await page.locator('.job-card .card-company-name').allTextContents();
      
      if (companyNames.length > 0) {
        const sortedNames = [...companyNames].sort((a, b) => a.localeCompare(b, 'ko'));
        expect(companyNames).toEqual(sortedNames);
      }

      // 1-8. 로그아웃 수행
      const logoutBtn = page.locator('.btn-appbar-logout');
      await expect(logoutBtn).toBeVisible();
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/);
    });

    test('예외 케이스: 존재하지 않는 기업명 검색 시 검색 결과 없음 화면 검증', async ({ page }) => {
      // 1-1. 일반 사용자 로그인
      await page.goto('/login');
      await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
      await page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("확인")').first().click();
      await expect(page).toHaveURL(/\/$/);

      // 1-2. 존재할 수 없는 검색어 입력
      const searchInput = page.locator('.search-input-control');
      await searchInput.fill('존재하지않는회사명9999');

      // 1-3. 빈 화면 상태 박스 노출 및 문구 확인
      const emptyStateBox = page.locator('.empty-state-box');
      await expect(emptyStateBox).toBeVisible();
      await expect(emptyStateBox).toContainText(/존재하지 않습니다/);

      // 로그아웃
      await page.locator('.btn-appbar-logout').click();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('2. 관리자 로그인 및 채용공고 필수값 누락 수정 테스트', () => {

    test('예외 케이스: SK키파운드리 공고 수정 중 위치(근무지역) 공란 입력 시 저장 방지 팝업창 노출 검증', async ({ page }) => {
      // 다이얼로그 이벤트를 감지하기 위한 핸들러
      let alertMessage = '';
      page.on('dialog', async (dialog: Dialog) => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      // 2-1. 관리자 로그인
      await page.goto('/login');
      await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('1234');
      await page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("확인")').first().click();
      await expect(page).toHaveURL(/\/$/);

      // 2-2. 공고 목록 페이지 이동
      await page.goto('/jobs');
      await expect(page.locator('.table-loading-state-box')).toBeHidden();

      // 2-3. "SK키파운드리" 공고 검색 및 수정 페이지 진입
      await page.locator('.search-input-field').fill('SK키파운드리');
      const skRow = page.locator('tbody tr:has-text("SK키파운드리")').first();
      await expect(skRow).toBeVisible();
      await skRow.locator('button[aria-label="공고 수정"]').click();
      
      // 수정 상세 페이지 진입 확인
      await expect(page).toHaveURL(/\/jobs\/edit\/\d+/);

      // 2-4. 근무지역 필드를 공란으로 지움
      const locationInput = page.locator('.location-input-control');
      await expect(locationInput).toBeVisible();
      await locationInput.fill('');

      // 2-5. 설정 저장하기 클릭
      await page.locator('.btn-bottom-submit').click();

      // 2-6. 팝업 메시지 내용 확인 및 저장 실패 후 수정 페이지 유지 여부 검증
      expect(alertMessage).toMatch(/(모든|값을|입력|필수|정보)/);
      await expect(page).toHaveURL(/\/jobs\/edit\/\d+/);
    });

    test('해피 케이스: SK키파운드리 공고 수정 시 올바른 근무지역 정보 입력 후 정상 저장 및 목록 이동 검증', async ({ page }) => {
      // 다이얼로그 수락 핸들러 등록
      registerDialogHandler(page);

      // 2-1. 관리자 로그인
      await page.goto('/login');
      await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('1234');
      await page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("확인")').first().click();
      await expect(page).toHaveURL(/\/$/);

      // 2-2. 공고 목록 페이지 이동
      await page.goto('/jobs');
      await expect(page.locator('.table-loading-state-box')).toBeHidden();

      // 2-3. "SK키파운드리" 공고 검색 및 수정 페이지 진입
      await page.locator('.search-input-field').fill('SK키파운드리');
      const skRow = page.locator('tbody tr:has-text("SK키파운드리")').first();
      await expect(skRow).toBeVisible();
      await skRow.locator('button[aria-label="공고 수정"]').click();
      await expect(page).toHaveURL(/\/jobs\/edit\/\d+/);

      // 2-4. 근무지역 필드를 유효한 값으로 수정 및 마감일 설정 (400 방지)
      const locationInput = page.locator('.location-input-control');
      await locationInput.fill('충북 청주시 흥덕구');

      const closingDateInput = page.locator('label:has-text("마감일") + input');
      await closingDateInput.fill('2026-12-31');

      // 2-5. 설정 저장하기 클릭
      await page.locator('.btn-bottom-submit').click();

      // 2-6. 저장 완료 후 /jobs 리다이렉션 검증
      await expect(page).toHaveURL(/\/jobs$/);
      await expect(page.locator('.table-loading-state-box')).toBeHidden();

      // 2-7. 검색을 통해 다시 수정 페이지로 들어가 값 반영 확인
      await page.locator('.search-input-field').fill('SK키파운드리');
      const updatedSkRow = page.locator('tbody tr:has-text("SK키파운드리")').first();
      await expect(updatedSkRow).toBeVisible();
      await updatedSkRow.locator('button[aria-label="공고 수정"]').click();
      
      await expect(page).toHaveURL(/\/jobs\/edit\/\d+/);
      const updatedLocationInput = page.locator('.location-input-control');
      await expect(updatedLocationInput).toHaveValue('충북 청주시 흥덕구');
    });
  });
});
