# 로컬 기본 환경

Status: completed
Type: verification
Updated: 2026-10-06

## 사용자 목표와 범위

연구실 전용 Overleaf를 `sunghail/Overleaf_lab`에서 개발한다.
이번 작업은 기본판 실행, 소스 수정이 반영되는 개발 환경,
문서 작성부터 PDF 저장까지의 기본 흐름 확인과 초기 푸시이다.

## 확인한 상태

- Git 원격: `origin`은 연구실 저장소, `upstream`은 공식 저장소.
- GitHub 활성 계정은 `sunghail`, 연구실 저장소 권한은 ADMIN.
- 얕은 복제의 나머지 공식 Git 이력을 확보했다.
- Docker Desktop 29.4.3, Compose v5.1.3, ARM64 엔진이 실행 중이다.
- Docker 메모리는 약 8GB이며 앱 포트는 localhost:8080으로 계획한다.
- 애플리케이션 소스는 공식 원본을 유지하고 로컬 실행 설정만 추가했다.

## 구현 결정

- 공식 Compose 예제는 보존하고 별도 `docker-compose.lab.yml`을 사용한다.
- 공식 `server-ce/Dockerfile`로 로컬 소스를 빌드한다.
- 기반 이미지는 현재 소스의 `server-ce/Dockerfile-base`로 빌드한다.
  공식 `sharelatex/sharelatex-base:latest`는 2023년 Node 16 기반이라 현재
  Node 24 소스와 맞지 않아 사용하지 않는다.
- DB는 내부 네트워크만 사용하며 데이터는 이름 있는 볼륨에 저장한다.
- 비밀 키는 Git에서 제외되는 `.env`에 생성한다.

## 검증

공식 원본의 초기 푸시는 완료됐고 `main`은 `origin/main`을 추적한다.

- `bash -n bin/lab`, `docker compose -f docker-compose.lab.yml config --quiet`
  통과.
- `./bin/lab up`으로 기반 이미지 및 앱 이미지 빌드·기동 완료.
- 실행 Node는 v24.21.0, LaTeX는 TeX Live 2026이다.
- 앱 이미지 ID:
  `sha256:18693e24fb8f4956714f434ca6885554c87cecdc210fad7fc587db68f93b83e2`.
- 앱 이미지의 소스 revision label:
  `e039ad26c5bf5422eb57b89fc7e57c75055e631d`.
- MongoDB, Redis, 앱 컨테이너의 healthcheck 모두 healthy 확인.
- 실제 브라우저에서 첫 관리자 계정 생성, 로그인, 새 프로젝트 생성 완료.
- 편집기에서 작은 입력이 실제 본문에 들어가는지 먼저 확인한 뒤 본문과
  3열 표를 작성하고 컴파일했다.
- PDF 미리보기에 제목, 본문, 표의 수치, 캡션이 표시되는 것을 확인했다.
- PDF 다운로드 HTTP 200, `application/pdf`, 47,139 bytes 확인.
- 다운로드 PDF는 1페이지이며 본문·표 내용 추출 검사를 통과했다.
  PNG 렌더링으로 텍스트와 표가 잘리지 않는 것도 확인했다.
- `docker compose -f docker-compose.lab.yml restart sharelatex` 후 같은 문서를
  다시 열어 로그인, 제목, 본문, 표 내용이 유지되는 것을 확인했다.
- 검증 프로젝트: `Lab baseline check`,
  `http://localhost:8080/project/6ac45b705bd035f807ba5bea`.

## 로컬 근거와 제한

- `.local/build.log`, `.local/baseline.pdf`, `.local/baseline.png`는 이 Mac의
  검증용 파일이며 Git에서 제외한다.
- 계정 정보는 `.local/admin.json`, 서버 키는 `.env`에만 보관한다.
- ego-browser의 화면 캡처는 CDP 오류로 실패했다. 편집은 실제 키 입력과
  DOM 읽기로 확인했고 출력물은 다운로드 PDF의 PNG 렌더링으로 확인했다.
- 소스 재빌드는 문서화된 `./bin/lab rebuild` 명령을 사용한다. 앱 소스에
  기능 변경을 넣는 작업은 아직 수행하지 않았다.
- 이 검증은 로컬 기본판 범위이다. 한글 논문 환경, 초보자 UI,
  세부 표 스타일, 다중 사용자 동시 편집, 연구실 서버 배포는 후속 범위다.
