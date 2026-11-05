# C 工作區設計比對

**Findings**

- [P2, fixed] 桌面版字級與下方測試面板過小。第一版在約 1880 × 900 的畫面中，題名、題文與程式碼比參考圖密集，測試面板僅約 300 px。已將題名調至 34 px、題文調至 19 px、程式碼調至 17 px，並將測試面板預設高度調至 360 px；第二次瀏覽器畫面中的兩欄比例、題目可讀性和 Run／Submit 位置均已改善。

**Open Questions**

- 參考圖為 Python 題，實作是 C17 標準輸入／輸出；不顯示提示、解答及其他學生原始碼是考試需求。
- 來源圖與瀏覽器輸出的截圖無法在目前工具中存成同一份並排圖檔。嘗試使用 `data:` URL 儲存截圖時，瀏覽器安全政策拒絕該協定；未再繞行。這使正式的同圖並排比對無法完成。

**Implementation Checklist**

- [x] 題目敘述、C 編輯器、測試資料／結果在桌面版分欄；窄畫面上下排列。
- [x] 深色與淺色模式、Run 結果、已保存的提交、Tab 補全、頂部排行榜及學生無權進入教師後台已在瀏覽器檢查。
- [x] 第二次檢查瀏覽器主控台沒有新的錯誤。
- [ ] 如需可歸檔的像素比對，使用經批准的截圖匯出流程保存實作畫面，再與來源圖合併。

**Follow-up Polish**

- [P3] 教師輸入的極長單行 C 程式會在編輯器水平捲動；這符合一般程式編輯器，但可考慮提供換行開關。

## Evidence and comparison history

- Source visual truth: `/var/folders/fd/b8qvvsw115d1rq9lgxyj1h0c0000gn/T/codex-clipboard-9f09d077-3feb-4bf9-93ca-0c6e32a23762.png`, 1919 × 887 pixels. The source shows a dark, nearly equal split between a description pane and code/testcase pane.
- Rendered implementation: `http://127.0.0.1:5482/classroom/fcu-load-0091362c/quiz/8`, captured inline with `cua_repl` at effective 1567 × 890 and 480 × 890 CSS pixels; screenshot file path unavailable. Browser viewport override requested 1880 × 900 and 760 × 900, but the in-app browser reported those effective sizes. Density normalization and pixel-perfect comparison were therefore unavailable.
- State: synthetic student, C exam, saved valid program, sample stdin. Both light and dark themes reviewed; Run returned `3` for input `1 2` without scoring. Typing `pri` opened a local `printf` suggestion and Tab accepted it; a subsequent Tab still indented normally, and undo restored the saved draft. The top leaderboard link opened the class practice view; with no published practice quiz, no peer names appeared. Another tab with the student session redirected `/admin/classroom` to `/admin/login`.
- Full-view comparison: separate source image and rendered browser views were inspected. Both use rounded split panels, dark neutral surfaces, prominent problem text, a code region and a lower testcase/result region. The first pass found small type and a short lower panel, then the second pass showed the revised proportions. A true combined side-by-side image was not available.
- Focused region comparison: title/body typography and right code/testcase division were inspected in the browser. Source and implementation were different problems, so copy and line wrapping cannot be compared precisely.
- Required fidelity surfaces: typography and spacing improved in iteration 2; dark/light contrast and semantic green actions are readable; no source photography or illustration exists; visible copy intentionally uses FCU C, C17 and standard input/output rather than Python. Standard icon fonts are used for controls.

final result: blocked

Blocker: the approved browser tool did not provide a saveable implementation screenshot or a combined comparison artifact, and its URL policy rejected the attempted `data:` export. No actionable P0/P1/P2 visual finding remains in the browser views that were inspected.
