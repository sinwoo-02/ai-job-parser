# Backend E2E 테스트 프로젝트

본 프로젝트는 백엔드 API의 주요 기능(회원가입, 로그인, 채용 공고 관리, 파일 업로드 등)과 사용자 권한(일반 사용자 vs 관리자)에 따른 접근 제어를 검증하기 위한 End-to-End(E2E) 테스트 환경입니다.

## 1. 작성자 정보
- **작성자**: sinwoo-02

## 2. 테스트 환경 및 준비사항
- **Base URL**: `http://localhost:8080` (로컬 백엔드 서버가 실행 중이어야 합니다.)
- **사용 도구**: [Newman](https://www.npmjs.com/package/newman) (Postman CLI)
- **테스트 데이터**:
  - `test.pdf`: 정상적인 PDF 업로드 테스트용 파일
  - `test.txt`: 잘못된 확장자 업로드 테스트용 파일

### Newman 설치 방법
Newman이 설치되어 있지 않다면 아래 명령어를 통해 설치할 수 있습니다.
```bash
npm install -g newman
```

## 3. 테스트 시나리오 요약
제공된 JSON 파일들은 Postman Collection 형식이며, 각 파일은 다음과 같은 시나리오를 포함합니다.

| 파일명 | 테스트 명칭 | 주요 내용 |
| :--- | :--- | :--- |
| `test-1.json` | 테스트 01(일반 사용자 가입) | 회원가입, 로그인, 로그아웃, 중복 가입 방지 |
| `test-2.json` | 테스트 02(일반 사용자 PDF 업로드) | 일반 사용자의 관리자 기능 접근 시도 (403 Forbidden 검증) |
| `test-3.json` | 테스트 03(관리자 로그인 및 PDF 업로드) | 관리자 권한으로 PDF 업로드 및 파싱 결과 확인 |
| `test-4.json` | 테스트 04(일반 사용자 조회) | 일반 사용자 권한으로 PENDING 상태 공고 접근 제한 확인 |
| `test-5.json` | 테스트 05(공고 승인 및 수정) | 관리자의 공고 승인(APPROVED) 및 상세 정보 수정 |
| `test-6.json` | 테스트 06(일반 사용자 전체 조회) | 승인된 공고만 일반 사용자에게 노출되는지 확인 |
| `test-7.json` | 테스트 09(삭제 시도 권한 확인) | 일반 사용자가 공고 삭제 시도 시 권한 오류 확인 |
| `test-8.json` | 테스트 10(관리자 공고 삭제) | 관리자 권한으로 특정 공고 삭제 수행 |
| `test-9.json` | 테스트 11(삭제 후 조회 확인) | 삭제된 공고에 대한 조회 실패 검증 |
| `test-10.json` | 테스트 12(관리자 PDF 재업로드) | 데이터 초기화 후 재업로드 및 전체 데이터 정합성 확인 |
| `test-11.json` | 테스트 13(비인증 접근 제한) | 로그인하지 않은 상태에서 보호된 API 접근 차단 확인 |

## 4. 실행 방법 (Newman 이용)

터미널(또는 CMD)에서 아래 명령어를 실행하여 테스트를 수행합니다.

### 개별 테스트 실행 예시
```bash
newman run test-1.json
```

### 전체 테스트 순차 실행 (추천)
테스트 시나리오는 상호 의존적(예: 가입 후 로그인)이므로 아래 순서대로 실행하는 것을 권장합니다.
```bash
newman run test-1.json && \
newman run test-2.json --working-dir . && \
newman run test-3.json --working-dir . && \
newman run test-4.json && \
newman run test-5.json && \
newman run test-6.json && \
newman run test-7.json && \
newman run test-8.json && \
newman run test-9.json && \
newman run test-10.json --working-dir . && \
newman run test-11.json --working-dir .
```

**주의**: 파일 업로드 테스트 시 `test.pdf` 파일이 동일한 디렉토리에 위치해야 정상적으로 동작합니다.

---
감사합니다.