import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('E2E 통합 테스트 시나리오', () => {

  // ==========================================
  // 1. 일반 사용자 회원가입 테스트 (해피 & 예외 케이스)
  // ==========================================
  test.describe('1. 일반 사용자 회원가입 테스트', () => {

    test('해피 케이스: 올바른 정보 입력 시 회원가입 성공 및 로그인 페이지로 리다이렉트', async ({ page }) => {
      await page.goto('/register');

      // 매 실행 시 DB 내 중복 이메일 충돌 문제를 피하기 위해 고유 이메일을 추가 검증용으로 사용합니다.
      // 본래 지정된 user@example.com은 중복 가입을 검증하는 예외 케이스에서 확실히 가입시키고 테스트하게 됩니다.
      const uniqueEmail = `tester_fresh_${Date.now()}@example.com`;

      await page.getByLabel('이름', { exact: true }).fill('user');
      await page.getByLabel('이메일 주소', { exact: true }).fill(uniqueEmail);
      await page.getByLabel('비밀번호', { exact: true }).fill('1234!');

      // 회원가입 전송 (확인 대신 가입 폼의 제출 버튼 유연 클릭)
      await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("가입")').first().click();

      // 화면 내에 회원가입 완료 성공 안내 메시지 렌더링 확인
      const successAlert = page.locator('.success-alert-box');
      await expect(successAlert).toContainText(/(회원가입|완료|성공)/);

      // 약 2초 후 로그인 화면으로 리다이렉트되는지 확인 (넉넉히 3.5초 타임아웃 부여)
      await expect(page).toHaveURL(/\/login/, { timeout: 3500 });
    });

    test('예외 케이스: 이미 등록된 이메일로 가입 시도 시 에러 메시지 노출 및 가입 실패', async ({ page }) => {
      // 1단계: tester@example.com의 존재를 보장하기 위해 회원가입 시도 (이미 존재하면 예외 메시지가 뜰 것이고, 없다면 정상 가입됨)
      await page.goto('/register');
      await page.getByLabel('이름', { exact: true }).fill('user');
      await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
      await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("가입")').first().click();

      // 첫 번째 가입이 안전하게 백엔드 DB에 도달하여 처리될 때까지 대기
      try {
        await Promise.race([
          page.waitForURL('**/login', { timeout: 3500 }),
          page.locator('.error-alert-box').waitFor({ state: 'visible', timeout: 3500 })
        ]);
      } catch (err) {
        // 이미 등록된 상태이거나 신규 등록 처리 완료 후 무관하게 넘어감
      }

      // 2단계: 다시 회원가입 페이지로 접근하여 중복 가입을 명확히 시도 및 검증
      await page.goto('/register');
      await page.getByLabel('이름', { exact: true }).fill('user');
      await page.getByLabel('이메일 주소', { exact: true }).fill('tester@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('1234!');
      await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("가입")').first().click();

      // '이미 사용 중인 이메일입니다.' 에러 캡션이 표시되는지 검증
      const errorAlert = page.locator('.error-alert-box');
      await expect(errorAlert).toContainText(/(이미|사용.*중|중복|이메일)/);

      // 화면에 에러가 노출되며 리다이렉트되지 않고 회원가입 페이지에 머물러 있는지 확인
      await expect(page).toHaveURL(/\/register/);
    });

    test('예외 케이스: 필수 입력 항목(이름) 누락 시 가입 시도 차단', async ({ page }) => {
      await page.goto('/register');

      // 이메일과 비밀번호만 채우고 이름은 공란으로 비워둠
      await page.getByLabel('이메일 주소', { exact: true }).fill('no_name@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('password123!');

      // 전송 버튼 클릭
      await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("가입")').first().click();

      // 가입 성공 메시지가 나타나지 않고 여전히 가입 화면에 머물러 있어야 함
      const successAlert = page.locator('.success-alert-box');
      await expect(successAlert).not.toBeVisible();
      await expect(page).toHaveURL(/\/register/);
    });
  });

  // ==========================================
  // 2. 관리자 로그인 실패 예외 테스트 (로그인 안 된 상태)
  // ==========================================
  test.describe('2. 관리자 로그인 실패 예외 테스트', () => {
    test('예외 케이스: 관리자 로그인 실패 검증', async ({ page }) => {
      // 로그인 안 된 상태에서 시도
      await page.goto('/login');
      await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('wrong_password');
      await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

      // 화면에 에러 메시지가 제대로 표기되는지 검증
      await expect(page.getByText(/(이메일|비밀번호).*(일치하지|않습니다|틀렸|확인)/)).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  // ==========================================
  // 3. 관리자 데이터 세팅 및 공고 관리 테스트 (로그인 상태 필요)
  // ==========================================
  test.describe('3. 관리자 데이터 세팅 및 공고 관리 테스트', () => {

    test.beforeEach(async ({ page }) => {
      // 각 관리자 테스트 실행 전에 로그인을 수행합니다.
      await page.goto('/login');
      await page.getByLabel('이메일 주소', { exact: true }).fill('admin@example.com');
      await page.getByLabel('비밀번호', { exact: true }).fill('1234');
      await page.locator('button[type="submit"], button:has-text("확인"), button:has-text("로그인")').first().click();

      // 대시보드로 성공적으로 이동했는지 확인
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: '대시보드 요약' })).toBeVisible();
    });

    test('해피 케이스: 사용자 관리 검증, PDF 공고 추가/AI 파싱, 삭제, 수정, APPROVED 일괄 상태 변경', async ({ page }) => {
      // AI 파싱 작업이 포함되어 있어 테스트 제한시간을 60초로 상향 조정합니다.
      test.setTimeout(60000);

      // 2-1. 사용자 관리 페이지에 가입 완료한 tester@example.com이 리스트업되었는지 확인
      await page.goto('/admin/users');

      // 검색창에 tester@example.com 입력하여 필터링
      await page.locator('.search-input-field').fill('tester@example.com');

      // 테이블에 tester@example.com 텍스트가 정상적으로 노출되는지 검증
      await expect(page.locator('table')).toContainText('tester@example.com');

      // 2-2. 공고 추가 페이지로 이동하여 test.pdf 파일 업로드 및 공고 자동 파싱 등록
      await page.goto('/jobs/new');

      // AI 파싱 등록 및 삭제 등 모든 액션 시 발생하는 브라우저 Alert/Confirm 창 수락을 위한 이벤트 리스너 정의
      page.on('dialog', async (dialog) => {
        console.log(`[Dialog Triggered]: ${dialog.message()}`);
        try {
          await dialog.accept();
        } catch (err) {
          console.warn('[Dialog Accept Ignored]:', err);
        }
      });

      // 파일 업로드 수행 (tests 디렉토리 내부의 test.pdf 지정)
      const fileInput = page.locator('input[type="file"]');
      const pdfPath = path.resolve(__dirname, 'test.pdf');
      await fileInput.setInputFiles(pdfPath);

      // UI상 파일 프리뷰 컴포넌트에 test.pdf 파일명이 표시되는지 검증
      await expect(page.locator('.file-preview-name')).toContainText('test.pdf');

      // 공고 등록하기 제출 (텍스트가 등록/제출/저장 등으로 상이할 수 있으므로 속성 및 정규식 활용)
      await page.locator('button[type="submit"]').filter({ hasText: /등록|제출|저장|submit/i }).first().click();

      // 성공 다이얼로그 수락 후 공고 관리 메인화면(/jobs)으로 정상 리다이렉트되는지 검증 (AI 파싱 시간 고려 35초 부여)
      // 정확한 URL 매칭을 위해 정규식 끝에 $ 기호를 추가합니다.
      await expect(page).toHaveURL(/\/jobs$/, { timeout: 35000 });

      // 목록 로딩이 완전히 완료될 때까지 대기 (로딩바 히든 처리 및 첫 행 노출 대기)
      await expect(page.locator('.table-loading-state-box')).toBeHidden();
      await expect(page.locator('tbody tr.table-row-item').first()).toBeVisible();

      // 2-3. 기업명이 SK하이닉스인 채용공고 삭제
      // 검색창에 "SK하이닉스" 입력
      await page.locator('.search-input-field').fill('SK하이닉스');

      const skRow = page.locator('tbody tr:has-text("SK하이닉스")').first();
      await expect(skRow).toBeVisible();

      // 더보기(more_vert) 메뉴 버튼 클릭
      await skRow.locator('button[aria-label="메뉴 열기"]').click();
      // 삭제 액션 버튼 클릭 (드롭다운 메뉴 내부 삭제 버튼 유연 클릭)
      await page.locator('.row-action-dropdown-menu button, button').filter({ hasText: /삭제|제거|delete/i }).first().click();

      // 삭제 성공 후 테이블 검색 내에서 SK하이닉스 행이 더 이상 존재하지 않는지(0개) 검증
      await expect(page.locator('tbody tr:has-text("SK하이닉스")')).toHaveCount(0);

      // 2-4. 기업명이 LG화학인 채용공고의 기업명을 연암공과대학교로 수정
      // 검색창에 "LG화학" 입력
      await page.locator('.search-input-field').fill('LG화학');

      const lgRow = page.locator('tbody tr:has-text("LG화학")').first();
      await expect(lgRow).toBeVisible();

      // 수정(연필) 아이콘 클릭하여 수정 상세 페이지 진입
      await lgRow.locator('button[aria-label="공고 수정"]').click();
      await expect(page).toHaveURL(/\/jobs\/edit\/\d+/);

      // 회사명 입력 필드를 "연암공과대학교"로 수정하고 마감일을 시작일 이후로 정정(400 에러 방지)
      const companyNameInput = page.locator('label:has-text("회사명") + input');
      await companyNameInput.fill('연암공과대학교');
      const closingDateInput = page.locator('label:has-text("마감일") + input');
      await closingDateInput.fill('2026-12-31');

      // 하단의 설정 저장하기 버튼 클릭
      await page.locator('.btn-bottom-submit').click();

      // 저장 안내 다이얼로그 확인 처리 후 공고 관리 목록으로 돌아오는지 확인
      await expect(page).toHaveURL(/\/jobs/);

      // 목록 로딩이 완전히 완료될 때까지 대기 (로딩바 히든 처리 및 첫 행 노출 대기)
      await expect(page.locator('.table-loading-state-box')).toBeHidden();
      await expect(page.locator('tbody tr.table-row-item').first()).toBeVisible();

      // 수정 내역이 정상 렌더링되는지 확인을 위해 연암공과대학교 검색
      await page.locator('.search-input-field').fill('연암공과대학교');
      await expect(page.locator('tbody tr:has-text("연암공과대학교")').first()).toBeVisible();



      // 2-5. 모든 채용공고를 APPROVED 상태로 변환하기
      // 검색창 필터를 초기화하여 모든 목록 출력
      await page.locator('.search-input-field').fill('');

      // 헤더 전체 선택 체크박스 활성화
      const selectAllCheckbox = page.locator('thead th.th-checkbox input[type="checkbox"]');
      await selectAllCheckbox.check();

      // 일괄 APPROVED 상태 변경 버튼 클릭
      const bulkApproveBtn = page.locator('.btn-bulk-approve');
      await expect(bulkApproveBtn).toBeVisible();
      await bulkApproveBtn.click();

      // 대기 중(PENDING) 상태 뱃지가 리스트 전체에 존재하지 않는지 검증
      await expect(page.locator('.badge-pending')).toHaveCount(0);

      // 전체 행 갯수만큼 승인(APPROVED) 뱃지가 존재하는지 검증하여 최종 상태 전환 확인
      const approvedBadges = page.locator('.badge-approved');
      const totalRows = await page.locator('tbody tr.table-row-item').count();
      if (totalRows > 0) {
        await expect(approvedBadges).toHaveCount(totalRows);
      }
    });

    test('예외 케이스: 공고 추가 페이지에서 파일 및 URL 누락 상태 제출 방지', async ({ page }) => {
      await page.goto('/jobs/new');

      let alertMessage = '';
      page.on('dialog', async (dialog) => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      // 첨부나 URL 입력 없이 즉각 공고 등록 시도
      await page.locator('button[type="submit"]').filter({ hasText: /등록|제출|저장|submit/i }).first().click();

      // 브라우저 팝업 에러 경고 다이얼로그 텍스트 검증
      expect(alertMessage).toMatch(/(파일|URL).*(입력|등록)/);
    });

    test('예외 케이스: 공고 상세 수정 중 필수 파라미터(회사명) 누락 제어 검증', async ({ page }) => {
      // 1번 공고의 상세 수정 페이지로 직접 진입
      await page.goto('http://localhost:3000/jobs/edit/1');

      let alertMessage = '';
      page.on('dialog', async (dialog) => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      // 회사명 필드를 임의로 비움
      const companyNameInput = page.locator('label:has-text("회사명") + input');
      await companyNameInput.fill('');

      // 저장 시도
      await page.locator('.btn-bottom-submit').click();

      // 필수값 경고 다이얼로그 발생 검증 및 저장 실패 후 수정 화면 잔류 확인
      expect(alertMessage).toMatch(/(모든|값을|입력|필수|정보)/);
      await expect(page).toHaveURL(/\/jobs\/edit\/1/);
    });
  });
});
