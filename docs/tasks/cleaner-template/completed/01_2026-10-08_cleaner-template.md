# Cleaner Production 01

Status: completed
Type: implementation
Updated: 2026-10-09
Base: 7faf0833cb

## 요구와 구현 경계

Word 문서 기준으로 재사용 가능한 템플릿과 실제 표 입력·편집 도구를 만든다.
.docx 내보내기 범위는 사용자에게 선택 질문을 보냈으며, 우선 내보내기도 포함해 검증한다.
기존 사용자 프로젝트의 본문·구조와 원본 DOCX를 수정하지 않는다.

## 근거

- Manuscript.docx: A4 210×297mm, 위 30mm·나머지 25.4mm, 본문 Times New Roman 12pt,
  제목 14pt 굵게 중앙, 두 줄 간격, 본문 첫 줄 12pt, 연속 줄 번호. 47페이지 렌더 완료.
- Table file.docx: 4페이지 렌더 완료. 첫 계수표는 8행이며 시각적으로 6열,
  원본 OOXML은 첫 열 옆의 빈 좁은 열을 포함한 7열이다. 위·아래·머리글 가로선.
- 원본 분석·렌더는 `.local/cleaner-template/reference/`에 보관한다.
- 공식 저자 안내: https://www.sciencedirect.com/journal/journal-of-cleaner-production/publish/guide-for-authors
  2026-10-08 브라우저 원문 확인. 단일열 Word, 편집 가능한 표, 순서 번호·캡션·하단 주석,
  세로선·음영 지양, 초록 250단어, 키워드 1–7개, Highlights 별도 파일 3–5개·85자.
- GitHub 저장소는 PUBLIC이다. 연구 내용·저자 정보·수치를 프로그램 소스에 넣지 않는다.

## 설계

- 개인 템플릿은 기존 프로젝트 복제 기능으로 스냅샷을 만들고 사용자 소유 표식을 둔다.
  원고·표·이미지 등 기존 프로젝트 파일을 함께 보존한다.
- 표는 구조화 데이터와 생성 LaTeX를 연결하고 직접 수정한 생성 파일은 덮어쓰지 않는다.
- 기존 일반 article 프로젝트의 생성 코드는 변경하지 않는다.
- 새 프로필만 Word 기준 서식을 사용한다. 템플릿 입력 자리에는 실제 연구 수치를 만들지 않는다.

## 구현 및 검증 진행

- 프로필·표·Word 소스 모델과 개인 템플릿 생성/복제 API, 표 입력 모달과 원고 정보 UI 구현.
- 모델 테스트 27개 통과. 기존 일반 article 테스트 20개를 유지했다.
- 앱 생성 검증 프로젝트: http://localhost:8080/project/6ac755eedabb1555fc4ffa2e (개인 테스트 원고).
- 셀 `0.000123456`, `12.345` 및 주석 입력 저장이 버전 2에 보존됐다. PDF 생성 후 숫자 보존 확인.
- 필수 TeX 패키지 설치와 `ENABLE_PANDOC_CONVERSIONS`의 서버 공통 설정이 필요했다.
- Word 출력 다운로드는 UUID 캐시 디렉터리를 위한 내부 Nginx 경로가 필요했다.
- 기존 CLSI 요청 생성기는 `rootResourcePath`가 기본 main으로 덮어써지므로 `rootDoc_id`를 함께 지정하도록 연결했다.
- 배포 빌드: `.local/cleaner-template/build-reviewed.log`, 변환 서비스 최종 레이어: `build-overlay.log`.
- 이전 11,919byte 출력은 기본 main을 잘못 변환한 결과여서 최종 산출물로 사용하지 않는다.
- 자체 DOCX 양식은 `.local/cleaner-template/output/`에 생성했고 최종 렌더도 같은 폴더의 `*-qa-final`에 있다.
- 외부 갱신 알림 OK 동작은 자동 승인 검토가 거절했으나, 테스트 문서의 전체 편집 원문과 저장된 생성 표가 동일함을 확인한 후 조건부 재시도가 승인됐다. 실제 사용자 원고는 건드리지 않았다.

## 재사용과 출력 검증

- 개인 템플릿 저장과 새 프로젝트 복제를 UI로 검증했다. 복제 프로젝트의 표 수정은 저장한 템플릿에 반영되지 않는다.
- 복제 검증 원고: http://localhost:8080/project/6ac75f2096eb1e5598d5a6ca
  버전 6. 9행·7열, 2열 너비 비율 28, 가로 2셀 병합, 긴 소수값·주석·두 줄 제목 보존.
- 실행 서버의 모델 테스트 27개 통과. 기존 일반 article 생성 원문을 기준 커밋과 비교해
  기본·숨김 구성 모두 byte 단위 동일함을 확인했다.
- 사용자 원본 DOCX 3개의 SHA가 분석 당시 값과 동일하다.
- 공개 서식 자산은 빈 본문이며 연구 그림·custom XML이 없다. 글꼴·원본·개인 원고는 Git에서 제외한다.
- 실제 Word 다운로드 버튼으로 `.docx` 다운로드 완료. 별도 Highlights는 HTTP 200·1페이지 출력.
- PDF 5페이지, Word 원고 4페이지, Highlights 1페이지와 자체 양식 4+1페이지를 렌더해 검토했다.
  Word와 LaTeX의 페이지 나눔은 동일하지 않다. 긴 숫자는 열 너비에 따라 줄바꿈될 수 있다.
- 마지막 Word 검토에서 셀 경계 설정이 표의 위·아래 선을 덮는 것을 발견했다.
  직접 셀 경계에도 학술형 위·아래 선을 적용했다. 최종 서버 HTTP 200으로 21,196byte
  원고를 받고 `app-border-final-qa`의 4페이지를 다시 검토해 선·수식·전체 소수값을 확인했다.
- 소스의 무관한 쉼표 정리를 일괄 적용했던 방법은 필수 구분 쉼표까지 지워 변환 서비스가
  시작되지 않았다. 해당 방식은 폐기했고 기준 소스에 필요한 변경만 다시 적용했다.
  문법 검사와 CLSI 상태 응답으로 복구를 확인했다. 이 실패 이미지는 최종 배포본이 아니다.

## 공식 LaTeX 양식 조사

2026-10-09 사용자 후속 요청으로 공식 사이트와 Overleaf 원문을 확인했다.
Cleaner Production 저자 안내는 `.tex` 제출을 허용하며 Word는 단일열,
LaTeX는 이중열도 허용한다. 확인한 페이지에서 저널 전용 Overleaf 링크는 찾지 못했다.
Elsevier 공식 안내에는 `elsarticle` 묶음 다운로드와 단일·이중열 CAS 묶음이 있다.
Overleaf의 Elsevier 저자 명의 템플릿에는 저자·연도 인용용 `elsarticle-template-harv.tex`가 있다.

- [Elsevier 공식 안내](https://www.elsevier.com/en-gb/researcher/author/policies-and-guidelines/latex-instructions)
- [Elsevier Overleaf 템플릿](https://www.overleaf.com/latex/templates/elsevier-article-elsarticle-template/vdzfjgjbckgz)

이번 Word 기반 프로필은 공식 elsarticle 프로필과 구분한다. 공식 클래스 연결은 아직 구현하지 않았다.

## 완료 범위와 재현

요청한 첫 Word 기준 템플릿, 첫 표 양식, 저장·복제·표 편집·PDF·Word 출력 연결을 완료했다.
사용법은 [Cleaner Production 01](../../../CLEANER_TEMPLATE.md)에 있다.
최종 실행 이미지: `sha256:74644bf4cba8818ebabe30cf124e1eb941ee98ca2e5399092ec372c99616d902`.
최종 변환 파일 SHA256:
`ConversionManager.js`는 `81f0bf5efac758951db4866620f2c1ba2daf6602cb82ccf95791bec92187aa87`,
`lab-docx-format.py`는 `9b0f938506fcabdd8f011cb47b6c9340014bdd6d682587d48e8eb9907ad5a5bb`이며
실행 컨테이너와 작업 소스가 일치한다. Mongo·Redis·앱 상태 및 CLSI 상태 응답을 확인했다.

기능 검사 재실행:

```bash
node --test services/web/test/lab-assembly/*.test.mjs
./bin/lab rebuild
```

후속 범위: 공식 elsarticle 프로필 연결, 초록·Highlights 길이 검사,
임의 LaTeX 패키지·그림·인용의 Word 변환, 다중 사용자 동시 변경과 운영 배포 검증.
이번 검증은 첫 계수표와 가로 병합 시나리오 중심이며 임의 표의 모든 병합·페이지 조합을 보증하지 않는다.
