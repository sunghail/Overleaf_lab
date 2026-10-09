# 역할과 번호 설정, 드래그 하위 배치

Status: completed
Type: implementation
Updated: 2026-10-09
Base: 1d53134863

사용자는 Figure를 포함한 역할 구분, 제목 번호 끄기, 대상의 위·중간·아래
드래그에 따른 앞·하위·뒤 배치를 요청했다.

설정은 기존 원고에 선택적 속성으로 추가한다. 속성이 없는 기존 생성 원문은
byte 단위 동일해야 한다. 섹션 번호를 끄면 하위 섹션도 번호가 없다.
그림·표는 독립된 캡션 번호를 유지하며 각 모듈에서 끌 수 있다.
역할 변경은 본문을 보존한다. 표는 전용 편집 데이터를 보호하기 위해 역할 전환을 막는다.
표·그림은 자식을 갖지 않으며 기존 3단계 깊이와 순환 방지 규칙을 유지한다.

Figure는 기존 프로젝트의 PNG/JPG 파일을 선택하고 폭을 정한다.
이미지 업로드는 기존 편집기를 사용한다. PDF·Word에서 캡션과 그림을 확인한다.
검증은 별도 예시 원고에서 수행하며 사용자 원고를 자동 수정하지 않는다.

## 구현과 검증

- 역할 변경·번호 표시·그림 설정을 버전 보호된 기존 조립 API에 추가했다.
- 일반 article·Cleaner Production 01의 기존 생성 원문을 기준 커밋과 비교해
  byte 단위 동일함을 확인했다. 번호 설정을 다시 켜면 기존 생성 문법으로 돌아간다.
- 모델 검사 33개(기존 27개 포함), 화면·배치 검사 7개 통과.
  역할·번호·별도 캡션 순서·파일 경로·데이터 보호·순환·전체 하위 트리 깊이를 검사했다.
- 실제 검증 원고: `6ac838a77cf754e182fb83f2` (Module settings example).
  사용자 원고 `6ac75f2096eb1e5598d5a6ca`에는 변경 요청을 보내지 않았다.
- 실제 화면에서 Experiments 제목 번호를 끄고 하위 섹션 번호도 없음을 확인했다.
- 새 섹션을 Figure로 바꾸고 PNG 파일·너비 65%를 저장했다.
  파일 업로드 응답 200, Figure는 Experiments 하위로 이동한 뒤에도 Figure 1 번호를 유지했다.
- 실제 마우스 드래그로 CO2 measurement를 Materials의 하위·앞·뒤로 배치했다.
  각 저장 버전 6·7·8과 부모·자식 순서를 읽어 확인했다. 앞·뒤 테스트 후 원래 순서로 복원했다.
- 표 캡션 번호를 껐고 저장 버전 10에서 표 번호가 null, numbered가 false임을 확인했다.
- PDF 5페이지·Word 4페이지를 렌더해 전체 페이지를 검토했다.
  번호 없는 Experiments·하위 제목·표 캡션과 Figure 1·이미지를 확인했다.
  Word에 이미지 미디어 1개가 포함된다. 두 엔진의 페이지 나눔·그림 크기·캡션 배치는 동일하지 않다.
- Source ZIP의 기존 일반 섹션 본문이 템플릿 본문과 동일했다.
  역할을 바꾼 Figure의 본문 파일도 같은 식별자로 보존됐다.

증거 경로: `.local/module-settings/`의 `frontend-tests.log`, `runtime-tests.log`,
`example.pdf`, `example.docx`, `source.zip`, `word-qa/`, `pdf-page-*.png`, `screen.png`.
표·그림 파일 이름 변경·삭제와 다중 사용자 동시 변경의 전체 운영 검증은 별도 범위다.

## 실행 소스

배포 이미지: `sha256:066833aee41fe7539a75d6f1c699655321a7f55b81270ea8591d0e0a7a015a8a`.
실행 파일과 작업 파일의 SHA가 일치한다.

- LabAssemblyModel: `d83ffab53fc39b24c7b54bdc88d20baea76e4a8b2e8e57df7b4e01cc89f51a5e`
- LabFigureModel: `4ab89d7dbf7bb9dfcd720698a1de50adca36994b474591bbbd1c0086e5f5866d`
- 조립 위젯: `111e374d439c6de5f5a547c21579dc58bf2a4dee77e61bf5d39def5b55e0e03d`
- 드래그 배치: `75460315fa93195fa53e4920b9f3add08dfd5e826a206c7f676ef20bb6c0520e`
