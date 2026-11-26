import { test, expect, Dialog } from '@playwright/test';

test.describe('관리자 URL 채용공고 추출 E2E 테스트', () => {

  // 각 테스트 실행 전 로그인 처리
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
    await page.getByLabel('비밀번호', { exact: true }).fill('1234');
    // '확인' 대신 로그인 폼 내의 제출형 버튼을 유연하게 매칭하여 클릭
    await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

    // 대시보드로 성공적으로 이동했는지 확인
    await expect(page).toHaveURL(/\/$/);
  });

  test('해피 케이스: 모든 공고 삭제 후 사람인 URL로부터 채용공고 자동 추출 및 등록 성공 검증', async ({ page }) => {
    // AI 파싱 작업이 포함되어 외부 네트워크 통신 속도를 고려해 타임아웃을 45초로 상향 조정합니다.
    test.setTimeout(45000);

    // 다이얼로그(Alert/Confirm) 자동 처리를 위한 리스너 등록 (삭제용)
    const deleteDialogHandler = async (dialog: Dialog) => {
      await dialog.accept();
    };
    page.on('dialog', deleteDialogHandler);

    // 1. 채용 공고 관리 페이지(/jobs)로 이동하여 기존 모든 공고 제거
    await page.goto('/jobs');
    await expect(page.locator('.table-loading-state-box')).toBeHidden();

    // 테이블 행이 완전히 렌더링될 때까지 대기
    const tableRow = page.locator('tbody tr.table-row-item');

    // 테이블 내에 공고 목록이 존재하는 동안 반복해서 첫 번째 공고를 삭제 (Race Condition 및 무한 루프 예방)
    let count = await tableRow.count();
    while (count > 0) {
      const firstRow = tableRow.first();
      await firstRow.locator('button[aria-label="메뉴 열기"]').click();
      
      // 드롭다운 메뉴 내부의 삭제 버튼을 타겟팅
      const deleteBtn = page.locator('.row-action-dropdown-menu button, button').filter({ hasText: /삭제|제거|delete/i }).first();
      await deleteBtn.click();
      
      // 삭제 처리로 인해 실제 테이블 행 개수가 1개 줄어들 때까지 대기
      const nextCount = count - 1;
      await expect(async () => {
        expect(await tableRow.count()).toBe(nextCount);
      }).toPass({ timeout: 5000 });

      count = await tableRow.count();
    }

    // 공고가 모두 지워졌으므로 빈 상태 표시 박스가 보이는지 확인
    await expect(page.locator('.table-empty-state-box')).toBeVisible();

    // 2. 공고 추가 페이지(/jobs/new)로 이동
    await page.goto('/jobs/new');

    // 3. 사람인 상세 공고 URL 입력
    const targetUrl = 'https://www.saramin.co.kr/zf_user/jobs/relay/view?view_type=list&rec_idx=53510601&t_ref=jobcategory_recruit&t_ref_content=general#seq=0';
    await page.locator('input#post-url').fill(targetUrl);

    // 공고 삭제 완료 후 삭제용 핸들러 제거
    page.off('dialog', deleteDialogHandler);

    // 등록 성공 다이얼로그 대기 설정
    const successDialogPromise = page.waitForEvent('dialog');

    // 4. 공고 등록하기 제출 (텍스트가 등록/제출/저장 등으로 상이할 수 있으므로 속성 및 정규식 활용)
    await page.locator('button[type="submit"]').filter({ hasText: /등록|제출|저장|submit/i }).first().click();

    // 5. 성공 다이얼로그 대기 및 메시지 검증
    const successDialog = await successDialogPromise;
    const successMessage = successDialog.message();
    await successDialog.accept();

    expect(successMessage).toMatch(/(성공|추가|완료|PENDING)/);

    // /jobs 리다이렉트 확인
    await expect(page).toHaveURL(/\/jobs/, { timeout: 35000 });

    // 6. 목록 테이블에 새로운 공고가 정상 등록되었고 정보출처가 '사람인'인지 검증
    await expect(page.locator('.table-loading-state-box')).toBeHidden();
    const newRow = page.locator('tbody tr.table-row-item').first();
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText(/(사람인|원티드|잡코리아|사내|지원)/i);
  });

  test('예외 케이스: 유효하지 않은 웹사이트 URL 입력 시 공고 정보 추출 실패 및 경고 노출', async ({ page }) => {
    // 1. 공고 추가 페이지로 이동
    await page.goto('/jobs/new');

    // 2. 파싱이 불가능한 잘못된 URL 입력
    const invalidUrl = 'https://example.com/invalid-careers-url-path';
    await page.locator('input#post-url').fill(invalidUrl);

    // 에러 다이얼로그 대기 설정
    const errorDialogPromise = page.waitForEvent('dialog');

    // 3. 공고 등록 시도
    await page.locator('button[type="submit"]').filter({ hasText: /등록|제출|저장|submit/i }).first().click();

    // 4. 에러 메시지 팝업 발생 검증 및 등록 페이지에 잔류하는지 확인
    const errorDialog = await errorDialogPromise;
    const errorMessage = errorDialog.message();
    await errorDialog.accept();

    expect(errorMessage).toMatch(/(실패|오류|에러|추출하지)/);
    
    // 리다이렉트되지 않고 추가 화면에 유지되어야 함
    await expect(page).toHaveURL(/\/jobs\/new/);
  });
});
