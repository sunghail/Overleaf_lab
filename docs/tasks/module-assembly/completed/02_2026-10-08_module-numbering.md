# 모듈 목록의 제목 번호

Status: completed
Type: implementation
Updated: 2026-10-08 (Asia/Seoul)
Base: f4f6e88582468a7c793b95b352fda870f35d2b5b

사용자가 모듈 이름 앞에 순서와 계층에 따른 번호를 표시하고 재컴파일 PDF의
제목 번호와 같게 보이도록 요청했다.

## 변경

- 조립 모델이 현재 article 제목 규칙으로 모듈 번호를 계산한다. PDF 생성과
  번호 계산이 같은 숨김 제외·자식 순서 규칙을 사용한다.
- 프로젝트 API의 모듈에 `number` 문자열 또는 null을 반환한다. 표시용 번호를
  저장된 제목이나 본문 파일에 넣지 않으며 기존 프로젝트는 별도 이관 없이 표시된다.
- 목록, 선택한 모듈의 제목, 상위 모듈 선택 목록과 접근성 이름에 번호를 붙였다.
- 초록·Highlights의 전체 하위 구조와 숨긴 부모의 하위 구조는 번호에서 제외한다.
- 순서·부모·숨김 변경의 저장 응답에 새 번호가 포함된다. PDF는 Recompile로 갱신한다.

## 검증

- 호스트와 최종 Docker 컨테이너에서
  `node --test services/web/test/lab-assembly/model.test.mjs`: 20개 통과.
- `./bin/lab rebuild` 성공 후 앱·Mongo·Redis 모두 healthy였다.
- 컨테이너의 편집기 소스 SHA-256은 로컬과 같은
  `5105670572b549c7bc51175bf08176d91a6cbc54d596837792e74483a79412b9`였다.
- 별도 [번호 검증 프로젝트](http://localhost:8080/project/6ac73bd8717f15e53d6bd4e9)에서
  기본 번호 `1`, `2.1`, `2.1.1`과 실제 PDF 제목을 대조했다.
- Methods를 앞으로 옮긴 뒤 Methods는 1, Sampling은 1.1.1이었다.
- Methods를 숨긴 뒤 하위 모듈 전체의 번호가 null이 되고 Results는 2로 바뀌었다.
  PDF에서도 숨긴 구조가 빠지고 나머지 제목 번호가 일치했다.
- 복원 후 번호가 다시 부여됐고, 원래 순서로 돌린 버전 7에서도 목록과 PDF가 일치했다.
- 새 브라우저에서도 번호가 표시되는 것을 확인하고 화면을 저장했다.

로컬 증거는 `.local/module-numbering-checks.json`,
`.local/module-numbering-build.log`, `.local/module-numbering-screen.png`에 있다.
이 파일들은 Git에서 제외한다.

## 범위

현재 조립기가 관리하는 article 제목 번호를 표시한다. 마지막 PDF에서 번호를
읽는 방식이 아니므로 구성 변경 직후에는 목록이 먼저 갱신된다. 본문의 임의
LaTeX 코드로 카운터를 직접 바꾸는 경우나 다른 저널의 번호 형식은 이번 범위에 없다.
