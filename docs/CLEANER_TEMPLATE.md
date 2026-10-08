# Cleaner Production 01 사용법

연구실의 Word 원고와 첫 계수표를 기준으로 만든 재사용 양식이다.
A4, 본문 Times New Roman 12pt, 제목 14pt, 두 줄 간격, 첫 줄 들여쓰기 12pt와
연속 줄 번호를 적용한다. 실제 연구 내용과 수치는 빈 입력 자리로 바꿨다.

## 새 원고와 재사용

1. 프로젝트의 **논문 조립 → 템플릿 저장·불러오기**를 연다.
2. 새 프로젝트 이름을 입력하고 **템플릿 01 사용**을 누른다.
3. **원고 정보**에서 제목·저자·소속·교신저자 정보를 입력하고 저장한다.
   저자의 `[a]`, `[b,*]` 같은 표시는 위 첨자로 출력된다.
4. 모듈을 선택하고 본문을 작성한다. 순서·상하위 관계·숨김은 기존 조립 도구로 관리한다.
5. 다시 사용할 원고는 템플릿 이름을 입력하고 **현재 원고 저장**을 누른다.
   본문·표·첨부 파일을 별도 개인 템플릿 프로젝트로 보관한다.
6. **저장한 개인 템플릿 → 이 템플릿으로 만들기**는 새 프로젝트를 만든다.
   새 원고를 수정해도 저장해 둔 템플릿에는 반영되지 않는다.

## 표 편집

표 모듈을 누르면 입력 창이 열린다. 첫 양식은 계수·A·B·C·D·Reference의
6열, 머리글 포함 8행이다. 숫자는 입력한 자릿수를 그대로 저장한다.

- 셀 값을 입력하고 마지막 행·열을 추가하거나 제거한다. 최대 60행·12열이다.
- 열 너비는 비율로 나눈다. 긴 숫자가 줄바꿈되면 해당 열의 비율을 늘린다.
- 열 정렬, 글자 크기, 행간, 머리글 행 수, 테두리를 조절한다.
- 셀을 선택하고 병합 행·열 수를 정한 뒤 병합한다. 덮이는 셀은 비어 있어야 한다.
- 수식 셀은 **LaTeX 수식 셀**을 켜고 `K_1`처럼 입력한다.
- **표 저장 → Recompile**로 PDF를 갱신한다. 표 번호는 본문 제목 번호와 별도로 계산한다.

기본 테두리는 학술형 가로선이다. 편집 창의 셀 구분선은 입력을 돕는 표시이며,
출력에는 선택한 테두리가 적용된다. 표 하단 주석도 함께 저장한다.
생성된 표 LaTeX를 직접 수정했다면 도구가 이를 덮어쓰지 않고 복원 안내를 표시한다.

## Word와 저널 양식

**원고 Word 다운로드**는 편집 가능한 표·수식이 있는 `.docx`를 만든다.
**Highlights Word 다운로드**는 Highlights를 별도 파일로 만든다.
Word와 PDF는 같은 모듈 순서·제목 번호·표 데이터를 사용한다.
사용자 임의의 LaTeX 패키지·그림·인용 문법은 Word 변환에서 동일하게 재현되지 않을 수 있다.
페이지 나눔과 수식 글꼴도 Word와 LaTeX 사이에 차이가 생길 수 있다.

이 양식은 제공된 Word 투고 원고를 재현한 연구실 프로필이다.
Elsevier 공식 `elsarticle` 클래스나 최종 출판 지면을 복제한 프로필은 아니다.
Cleaner Production의 공식 안내는 `.tex` 제출을 허용하지만,
확인한 안내 페이지에 저널 전용 Overleaf 템플릿 링크는 없다.
Elsevier 공통 양식은 [공식 LaTeX 안내](https://www.elsevier.com/en-gb/researcher/author/policies-and-guidelines/latex-instructions)와
[Elsevier의 Overleaf 템플릿](https://www.overleaf.com/latex/templates/elsevier-article-elsarticle-template/vdzfjgjbckgz)에 있다.
공식 LaTeX 프로필 연결은 별도 구현 범위다.

투고 시 최신 [Cleaner Production 저자 안내](https://www.sciencedirect.com/journal/journal-of-cleaner-production/publish/guide-for-authors)를 확인한다.
현재 안내의 초록 250단어, 키워드 1–7개, Highlights 3–5개·각 85자 제한은
작성자가 확인해야 하며, 첫 버전에서 자동으로 검사하지 않는다.

구현 범위와 검증 기록은 [템플릿 작업 기록](tasks/cleaner-template/README.md)에 있다.
