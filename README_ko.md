# SyncStone - Stardustmemoir Chrome 확장 프로그램

SyncStone은 'Stardustmemoir'이라는 이름으로, FINAL FANTASY XIV 관련 비공식 도구입니다. 이 확장 프로그램은 Lodestone(FINAL FANTASY XIV 공식 플레이어 사이트)의 일기 항목을 로컬 저장용 Markdown 형식으로 내보내기 위해 설계된 독립형 Chrome 확장 프로그램입니다. Lodestone에는 내보내기 기능이 없으므로, 소중한 추억을 백업하는 것이 주요 목표입니다.

<p align="center">
  <img src="28445b1c091759ab82531cc3a64b5ca7ced45c89.jpg" alt="kako-jun">
</p>

## 기능

*   **단일 게시물 내보내기**: 현재 Lodestone 일기 게시물 페이지 또는 일기 편집 페이지를 내보냅니다. 여기에는 게시물 제목, 본문, 모든 이미지(내부 및 외부), 댓글, 좋아요 수, 게시 날짜 및 태그가 포함됩니다. Markdown 파일과 관련 이미지가 포함된 ZIP 파일을 다운로드합니다.
*   **모든 게시물 내보내기**: Lodestone의 일기 목록 페이지에서 모든 일기 항목을 내보냅니다. 여기에는 게시물 제목, 본문, 모든 이미지(내부 및 외부), 댓글, 좋아요 수, 게시 날짜 및 태그가 포함됩니다. 이를 Markdown 형식으로 변환하고 단일 ZIP 파일로 다운로드합니다. 모든 이미지가 다운로드되어 ZIP 파일 내의 `images/` 폴더에 포함됩니다.
*   **댓글 검색**: 게시물과 관련된 댓글의 전체 텍스트를 검색하여 Markdown 파일에 포함합니다.
*   **대량 이미지 다운로드**: 모든 게시물을 내보낼 때, Lodestone의 이미지 관리 페이지에 있는 모든 이미지가 미리 다운로드되어 ZIP 파일에 포함됩니다. 이렇게 하면 여러 게시물에서 참조되는 이미지의 중복 다운로드를 방지하고 로컬에서 볼 때 이미지가 올바르게 표시되도록 합니다.
*   **게시물 목록 생성**: 모든 게시물을 내보낼 때, 내보낸 모든 게시물에 대한 링크가 포함된 `Article_List.md` 파일이 ZIP 파일 내에 생성됩니다. 이 파일은 [Visual Studio Code](https://code.visualstudio.com/)와 같은 Markdown 미리보기 기능이 있는 텍스트 편집기로 열면 내보낸 게시물에 대한 링크 모음으로 편리하게 사용할 수 있습니다.

## 설치

1.  이 저장소를 복제하거나 [다운로드합니다](https://github.com/kako-jun/sync-stone/archive/refs/heads/main.zip).
2.  Chrome 브라우저를 열고 주소 표시줄에 `chrome://extensions`를 입력하여 확장 프로그램 관리 페이지를 엽니다.
3.  오른쪽 상단에서 "개발자 모드"를 웁니다.
4.  "압축 해제된 확장 프로그램 로드" 버튼을 클릭합니다.
5.  다운로드하거나 복제한 저장소 내의 `chrome-extension` 폴더를 선택합니다.
6.  SyncStone 확장 프로그램이 Chrome에 추가됩니다.

## 사용법

### 1. 액세스 간격 설정

확장 프로그램의 팝업을 열면 "액세스 간격" 입력 필드가 있습니다. 이는 Lodestone 서버에 연속으로 액세스할 때의 대기 시간(밀리초 단위)을 설정합니다. 서버 부하를 고려하여 기본값은 2000밀리초(2초)로 설정되어 있으며, 2000밀리초 미만으로 설정할 수 없습니다. 필요에 따라 조정하십시오.

### 2. 단일 게시물 내보내기

1.  내보내려는 Lodestone 일기 게시물 페이지 (예: `https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/ARTICLE_ID/`)를 엽니다.
2.  Chrome 도구 모음에서 SyncStone 아이콘을 클릭하여 팝업을 엽니다.
3.  "Export Current Article" 버튼을 클릭합니다.
4.  Markdown 파일과 이미지가 포함된 ZIP 파일이 다운로드됩니다.

### 3. 모든 게시물 내보내기

1.  Lodestone의 일기 목록 페이지(예: `https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/`)를 엽니다.
2.  Chrome 도구 모음에서 SyncStone 아이콘을 클릭하여 팝업을 엽니다.
3.  "Export All Articles" 버튼을 클릭합니다.
4.  내보낼 게시물 수가 표시되고 계속할지 묻는 확인 대화 상자가 나타납니다. "예"를 클릭하여 내보내기를 시작합니다.
5.  내보내는 동안 진행률 표시줄이 표시됩니다. 완료되면 ZIP 파일이 다운로드됩니다.

### 4. 다른 플레이어의 게시물 내보내기 (숨겨진 기능)

**중요**: 이 기능은 적절한 사용을 전제로 제공됩니다.

SyncStone은 동일한 절차를 사용하여 다른 플레이어의 일기 항목도 내보낼 수 있습니다. 이는 다음과 같은 상황에서 가치가 있습니다:

- **계정 삭제로 인해 잃어버릴 수 있는 추억 보존**: 친구들이 FFXIV를 완전히 그만둘 때, 그들의 일기는 접근할 수 없게 됩니다. 공유했던 모험의 기록과 소중한 추억을 보존하여 잃어버리지 않도록 할 수 있습니다.
- **공유한 경험의 기록**: 함께 완료한 활동, 함께 참여한 이벤트, 그리고 기타 공유한 추억을 기록으로 보존할 수 있습니다.

**사용 방법**:
1. 게시물을 내보내려는 다른 플레이어의 일기 목록 페이지를 엽니다
2. 자신의 게시물과 동일한 절차를 따라 "Export All Articles"를 클릭합니다
3. 시스템이 자동으로 다른 플레이어의 게시물임을 감지하고 적절히 처리합니다

**기술적 차이점**:
- 다른 플레이어의 게시물의 경우, 이미지 갤러리 페이지에 접근할 수 없으므로 게시물에 포함된 이미지만 다운로드됩니다
- 내보낸 ZIP 파일은 자신의 게시물과 구별하기 위해 `lodestone_others_blog_export.zip`으로 명명됩니다

**사용 가이드라인**:
- 추억을 보존하는 정당한 목적으로 이 기능을 사용해 주세요
- 프라이버시를 존중하고 적절한 범위 내에서 사용해 주세요

### 5. 내보낸 파일

다운로드된 ZIP 파일에는 다음이 포함됩니다.

*   **Markdown 파일 (`.md`)**: 각 게시물은 별도의 Markdown 파일로 저장됩니다. 파일 이름은 게시물 제목을 기반으로 합니다.
    *   각 Markdown 파일의 시작 부분에는 YAML 프런트 매터 형식으로 다음 메타데이터가 포함됩니다.
        *   `title`: 게시물 제목
        *   `date`: 게시 날짜
        *   `likes`: 좋아요 수
        *   `comments`: 댓글 수
        *   `tags`: 태그 목록
    *   게시물 본문과 댓글 본문은 Markdown 형식입니다.
*   **`images/` 폴더**: Lodestone 내부 이미지(`finalfantasyxiv.com` 도메인 이미지)는 이 폴더에 다운로드되어 저장됩니다. Markdown 파일 내의 이미지 링크는 이 폴더 내의 상대 경로로 다시 작성됩니다.
*   **`index.md`**: 내보낸 모든 게시물에 대한 링크가 포함된 Markdown 파일입니다. 이 파일은 [Visual Studio Code](https://code.visualstudio.com/)와 같은 Markdown 미리보기 기능이 있는 텍스트 편집기로 열면 내보낸 게시물에 대한 링크 모음으로 편리하게 사용할 수 있습니다。

### 6. 내보낸 Markdown 파일 보기

내보낸 Markdown 파일은 [Visual Studio Code](https://code.visualstudio.com/)와 같이 Markdown 미리보기를 지원하는 텍스트 편집기로 여는 것이 좋습니다. ZIP 파일이 압축 해제되었고 Markdown 파일과 `images/` 폴더가 같은 디렉토리에 있는지 확인하십시오. 이렇게 하면 Markdown 미리보기에서 이미지가 올바르게 표시됩니다.

## 중요 사항

*   **서버 부하**: "모든 게시물 내보내기" 기능은 Lodestone 서버에 연속으로 액세스합니다. 서버에 과도한 부하가 걸리지 않도록 구성 가능한 액세스 간격을 적절하게 설정하십시오。
*   **외부 이미지**: Lodestone 이외의 도메인에서 가져온 이미지는 다운로드되지 않으며, Markdown 파일에 원래 URL 링크로 유지됩니다.
*   **Lodestone 사양 변경**: Lodestone의 HTML 구조 또는 사양이 변경되면 이 확장 프로그램이 올바르게 작동하지 않을 수 있습니다.
*   **BBCode 변환**: Lodestone의 BBCode는 변환된 HTML로 검색된 다음 Turndown 라이브러리에 의해 Markdown으로 변환됩니다. 특수 표기법이나 복잡한 레이아웃은 완벽하게 재현되지 않을 수 있습니다.

<div style="text-align: right; margin-top: 20px;">
  <div style="display: inline-block; vertical-align: middle; margin-right: 20px;">
    <img src="e6486e2b222ab797036f2c3b5bc9d4d850d052d9.jpg" alt="Thank you FFXIV" width="120">
  </div>
  <div style="display: inline-block; vertical-align: middle;">
    <p style="margin:0; padding:0; font-size:1.2em;">고마워요, FFXIV</p>
  </div>
</div>