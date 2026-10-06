# 공식 저널 안내 조사

Status: completed
Type: research
Updated: 2026-10-06

## 사용자 요구

LaTeX를 출력 기반으로 사용하되 비전문가가 섹션과 하위 섹션을 조립한다.
전체 및 선택 영역의 간격·들여쓰기를 조절하고, Elsevier 저널별 양식을 선택한다.
수식은 LaTeX 원문을 유지하며 향후 별도 시각 편집기를 연결한다.
이번 요청은 공식 가이드 다운로드와 개념 논의이며 앱 구현 요청이 아니다.

## 확보한 출처

2026-10-06에 다음 공식 웹 가이드의 HTML·본문 텍스트·섹션별 추출본을 저장했다.

- [Chemical Engineering Journal](https://www.sciencedirect.com/journal/chemical-engineering-journal/publish/guide-for-authors)
- [Chemical Engineering Science](https://www.sciencedirect.com/journal/chemical-engineering-science/publish/guide-for-authors)
- [Computers & Chemical Engineering](https://www.sciencedirect.com/journal/computers-and-chemical-engineering/publish/guide-for-authors)
- [Separation and Purification Technology](https://www.sciencedirect.com/journal/separation-and-purification-technology/publish/guide-for-authors)
- [Elsevier LaTeX 제출 안내](https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions)

CES 가이드에서 연결한 CAS 2.4 양식 ZIP과 CES Review Guidance DOCX,
CEJ 가이드에서 연결한 리뷰 제안서 PDF, CTAN의 elsarticle ZIP도 내려받았다.
출처 URL과 해시는 각 메타데이터 파일에 저장했다. 9개 원문 해시를 검증했다.

## 확인한 규칙

- 네 온라인 일반 가이드: 초록 최대 250단어, 키워드 1–7개,
  필수 Highlights 3–5개·항목당 공백 포함 85자, Highlights 별도 편집 가능 파일.
- 네 가이드의 Graphical abstract는 권장 항목이다.
- 본문 섹션은 계층 번호를 사용하며 Abstract에는 섹션 번호를 붙이지 않는다.
- 네 저널의 표 안내는 편집 가능한 표를 요구하고 세로선·셀 음영을 피하도록 한다.
- CEJ와 C&CE의 명시적인 수식 안내는 수식을 이미지가 아닌 편집 가능한 텍스트로
  제출하도록 한다. CES·SPT에는 같은 제목의 수식 절을 찾지 못했다.
- CEJ·CES·SPT의 저널 참고문헌 스타일은 등장 순서에 따른 번호형이다.
  C&CE는 저자·연도형이며 참고문헌 목록을 저자 이름 기준으로 정렬한다.
- CEJ·CES·SPT는 초기 제출 참고문헌 형식의 유연성도 명시한다.
- CES Short Communication에는 표·그림을 포함해 2000단어에 상당하는 분량이라는
  기준이 있다. 표·그림을 단어 수로 환산하는 방법은 안내에서 확인하지 못했다.
- C&CE Short Note에는 두 줄 간격 원고 8페이지 제한, Letter에는 보통 2페이지
  기준이 있다. 이 숫자들을 일반 연구논문에 적용하면 안 된다.

## 유형별 안내와 불확실성

현재 CES 가이드가 연결하는 Review Guidance는 문서 하단에 Elsevier 2020이라고
표시한다. 초록 150단어, 초록·참고문헌 제외 본문 5000단어와 권장 섹션 구성을
제시한다. 온라인 일반 초록 기준 250단어와 함께 출처·유형·연도를 보존하고,
리뷰 프로필에서 강제하기 전 적용 우선순위를 확인한다.

CES DOCX를 텍스트로 추출하고 1페이지로 렌더링해 전체를 확인했다.
CEJ 리뷰 제안서는 2페이지를 모두 추출·렌더링해 확인했다. 제안 승인 이후
전체 리뷰 논문 초청으로 이어지는 별도 절차이며, 일반 원고 서식과 구분한다.

## 설계 판단

- 프로필 선택 기준은 저널·논문 유형·제출 단계·프로필 버전으로 둔다.
- 조립 내용, 확인된 투고 규칙, LaTeX 양식 기본값, 사용자 서식 변경,
  제출 파일 내보내기를 분리한다.
- 세부 간격·들여쓰기 값은 가이드에서 추정하지 않는다. CAS 양식의
  `cas-common.sty`에서 제목 단계별 간격·글꼴 설정을 실제로 확인했다.
- 제목 간격은 양식 자체가 처리하므로 모듈 연결 시 별도 여백을 중복 삽입하지 않는다.
- CES는 CAS 양식에 대한 직접 링크를 확인했다. 다른 세 저널을 특정 클래스에
  자동 연결하는 근거는 아직 확인하지 않았으므로 공통 Elsevier 클래스와
  저널별로 확인된 선택을 구분한다.
- 저널을 바꿀 때 본문은 유지하고 변경된 규칙 및 사용자 예외를 보여준다.
- Elsevier 공통 FAQ는 EM 제출 파일의 하위 폴더를 허용하지 않는다고 안내한다.
  내부 모듈 구조와 별도로 제출용 파일 구조를 준비해야 한다.

앱 코드, 실행 환경, 사용자 논문 파일은 변경하지 않았다.
