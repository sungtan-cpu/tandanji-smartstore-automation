# 탄단지박스 스마트스토어 자동화

새 컴퓨터에서 상품·홈·배너 정기 관리를 이어가기 위한 프로그램, 작업 규칙, 이미지 원본과 완료 기록입니다.

## 새 컴퓨터에서 시작하기

1. GitHub에 로그인한 뒤 **Code → Download ZIP**으로 내려받고 압축을 풉니다. Git 사용자는 이 비공개 저장소를 복제해도 됩니다.
2. Codex와 Chrome, ChatGPT 브라우저 확장 프로그램을 준비합니다. 확장 프로그램 세부정보에서 **파일 URL에 대한 액세스 허용**을 켭니다.
3. `local-settings.example.json`을 복사해 같은 폴더에 `local-settings.json`으로 저장합니다.
4. 이미지 저장 장소가 바뀌면 `bannerDirectory`와 `menuImage`를 새 컴퓨터의 실제 위치로 바꿉니다. Windows 경로는 `D:/스마트스토어/배너`처럼 `/`를 쓰면 편합니다. 상대 경로도 사용할 수 있으며 저장소 폴더를 기준으로 해석합니다.
5. Codex에서 이 저장소 폴더를 열고 다음과 같이 요청합니다.

   “AGENTS.md와 WORKFLOW.md를 읽고 local-settings.json의 이미지 경로를 확인해 줘. 네이버 계정 로그인 후 미리보기로 배송일과 수정 대상을 확인하고 실제 작업을 진행해 줘.”

6. 네이버에 처음 한 번 로그인합니다. 비밀번호와 추가 인증은 네이버 로그인 화면에서 직접 입력합니다.
7. 기존 컴퓨터의 예약을 중지한 상태에서 새 컴퓨터에 **월·목 오전 08:05 한국시간** 예약을 등록합니다. Codex에 `automation/prompt.md`와 `automation/schedule.json`을 참고하도록 요청합니다. 예약과 로그인은 GitHub 파일을 내려받는 것만으로 등록되지 않습니다.

이미지 위치를 아직 정하지 않았다면 예제의 `assets/banners`, `assets/menus/11월식단표.png`를 먼저 사용할 수 있습니다. 두 경로는 서로 다른 드라이브나 폴더를 지정해도 됩니다. `local-settings.json`은 컴퓨터별 설정입니다.

## 실행 방식과 확인 범위

실제 매장 작업은 Codex의 Chrome 조작으로 수행하고 저장 후 재조회했습니다. 상품 8개 유지, 홈 정렬, PC·모바일 배너, 월 식단표 공지는 `WORKFLOW.md`와 `automation/prompt.md`에 정리되어 있습니다.

`program/`은 별도 Playwright 실행 프로그램입니다. 날짜 계산·대상 선정 시험은 통과했지만 새 컴퓨터에서 로그인부터 저장까지 전체 무인 실행은 검증해야 합니다. PC·모바일 배너 업로드와 월 식단표 교체는 현재 별도 프로그램에 구현되어 있지 않으며 Codex 작업 절차로 수행합니다. 이미지 경로 설정은 이 Codex 절차에서 사용합니다.

별도 프로그램을 사용할 경우 Node.js LTS를 설치하고 `program/setup.cmd`, `program/preview.cmd` 순서로 실행합니다. 공휴일 자료의 확인일이 오래되면 중단하므로 최신 공식 자료를 대조해 `program/holiday-calendar.json`을 갱신합니다. 미리보기 확인 후에만 `program/config.json`의 `previewApproved`를 `true`로 바꿔 `program/apply.cmd`를 실행합니다. `program/schedule.cmd`와 Codex 예약을 동시에 사용하지 않습니다. 기본 실행 시각은 08:05이며 기본 예약 모드는 미리보기입니다.

마지막으로 읽은 기존 Codex 예약 상태는 **PAUSED**였습니다. 이 저장소는 그 상태를 기록했으며 새 예약을 활성화하지 않았습니다. 새 컴퓨터에서 예약을 켠 뒤 PC와 Codex가 실행 중인 상태로 유지합니다.

## 포함 파일

- `WORKFLOW.md` — 현재 우선 규칙과 2026-11-09 최종 상태
- `automation/` — 새 컴퓨터 예약에 사용할 지시문과 일정
- `assets/` — 배너 18장과 11월 통합 식단표, 사용완료 파일명 포함
- `records/` — 스마트스토어 작업 기록과 화면 증빙
- `program/` — 별도 실행 프로그램
- `historical-workflow.md` — 과거 이력. 현재 작업에는 `WORKFLOW.md`를 우선합니다.

로그인 프로필·비밀번호·쿠키·인증 토큰과 Google Chat 웹훅 주소는 보관 대상에서 제외합니다. Google Chat 연동은 아직 설정 전입니다. 이 저장소는 비공개로 유지합니다.
