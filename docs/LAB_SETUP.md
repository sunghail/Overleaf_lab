# 연구실 Overleaf 개발 환경

공식 Community Edition 소스를 이 저장소에서 직접 빌드합니다.
기본 접속 주소는 <http://localhost:8080>입니다.

## 시작

Docker Desktop을 실행한 뒤 저장소 루트에서 실행합니다.

```bash
./bin/lab init
./bin/lab up
```

첫 빌드는 기반 이미지와 Node 의존성을 내려받고 프런트엔드를 컴파일하므로
시간이 걸립니다. 기반 이미지도 공식 `server-ce/Dockerfile-base`로 만듭니다.
공식 Dockerfile 호환을 위해 앱 컨테이너는 `linux/amd64`로
실행합니다. Apple Silicon Mac에서는 에뮬레이션을 사용합니다.

첫 관리자 계정은 <http://localhost:8080/launchpad>에서 만듭니다.
현재 Mac에는 검증용 관리자 계정과 `Lab baseline check` 프로젝트를
만들어 두었습니다. 로그인 정보는 로컬 `.local/admin.json`에 있습니다.

## 수정한 소스 실행

`services/`, `libraries/` 등의 소스를 수정한 뒤 다시 빌드합니다.

```bash
./bin/lab rebuild
```

실행 이미지가 이 저장소의 `server-ce/Dockerfile`로 만들어지므로 소스 수정이
새 컨테이너에 반영됩니다. 프런트엔드도 이미지 빌드 중에 컴파일합니다.

## 상태와 종료

```bash
./bin/lab status
./bin/lab logs
./bin/lab stop
```

`stop`은 문서와 계정을 보존합니다. 문서·MongoDB·Redis 데이터는 Docker의
`overleaf-lab` 이름을 사용하는 볼륨에 저장됩니다. 볼륨을 삭제하면 해당
데이터가 삭제됩니다.

`.env`의 키는 로컬에서 생성하고 Git에 올리지 않습니다. 다시 실행할 때도
같은 키를 유지합니다. 테스트용 계정 정보도 저장소에 올리지 않습니다.

이 구성은 현재 Mac에서 개발하는 용도입니다. 웹 포트는 로컬 주소에만
연결하고, 데이터베이스 포트는 호스트에 공개하지 않습니다.
연구실 서버 배포와 백업·메일·HTTPS 구성은 이후 작업입니다.

현재 검증 상태는 [기본 환경 작업 기록](tasks/baseline/README.md)을 참고합니다.
