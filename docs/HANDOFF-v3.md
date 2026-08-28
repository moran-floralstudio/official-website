# Handoff Spec：默藍花藝官網 v3（Hybrid／侘寂改版）

as-built 規格 — 本文所有數值皆取自已實作的 `index.html`，非設計稿推測值。
設計參考稿：`design_handoff_moran_floral_v3/Moran Floral Hybrid.dc.html`（`.dc.html` 為設計格式，未移植其 `support.js`）。

## Overview

單頁式（one-pager）形象網站，部署於 Cloudflare Pages。v3 只改視覺與互動，資訊架構與文案完全沿用 v2，未新增或刪除章節。

改版範圍僅兩個檔案：`index.html`、`_headers`。`functions/`、`assets/`、`site-content.json`、`robots.txt`、`sitemap.xml`、`tests/` 一律未動。

## Layout

| 項目 | 值 |
|---|---|
| 版面最大寬 | `--max: 1560px` |
| 左右 padding | `--pad: 44px`（≤960px 為 `22px`） |
| 主斷點 | `max-width: 960px` |
| 次要斷點 | `max-width: 1100px`（導覽收斂）、`max-width: 600px`（Hero 微調） |
| 字級策略 | 全面 `clamp()`，不依賴額外斷點 |
| 捲動 | `scroll-behavior: smooth`；`scroll-padding-top: 90px`（≤960px） |

## Design Tokens

實作為 `:root` CSS 自訂屬性。**請引用 token，不要寫死 hex。**

| Token | 值 | 用途 |
|---|---|---|
| `--paper` | `#e9e4da` | 主背景（暖紙色） |
| `--ink` | `#14120f` | 主文字 |
| `--muted` | `rgba(20, 18, 15, .6)` | 內文 |
| `--faint` | `rgba(20, 18, 15, .38)` | 眉標、次要標籤 |
| `--line` | `rgba(20, 18, 15, .14)` | 紙色區髮絲線 |
| `--sumi` | `#14120f` | 墨色區塊背景（服務、Contact） |
| `--sumi-ink` | `#ede8de` | 墨色區塊上文字 |
| `--sumi-line` | `rgba(233, 228, 218, .14)` | 墨色區髮絲線 |
| `--accent` | `#5f6f63` | 連結 hover（苔綠） |
| `--img-bg` | `#d6d0c4` | 圖片載入前底色 |
| `--shadow` | `0 30px 80px rgba(0, 0, 0, .3)` | **僅**彈窗使用 |
| `--ease` | `cubic-bezier(.16, .84, .3, 1)` | 全站統一緩動 |
| `--serif` | `"Noto Serif TC", "PMingLiU", serif` | 中文標題／內文 |
| `--display` | `"Cormorant Garamond", "Noto Serif TC", serif` | 英文引言、流程號碼 |
| `--sans` | `"Jost", "Noto Sans TC", system-ui, sans-serif` | 英文眉標／按鈕／標籤 |

圓角全站為 `0`（刻意的侘寂直角）。除彈窗外不使用陰影。

### 字級表

| 元素 | 值 |
|---|---|
| Hero H1 | `clamp(56px, 12.5vw, 210px)` / line-height `.92` / weight 200 |
| Hero 英文副題 | H1 的 `.18em`，italic，opacity `.45` |
| 章節 H2 | `clamp(34px, 5vw, 72px)` / weight 200 / letter-spacing `.06em` |
| Contact H2 | `clamp(40px, 9vw, 140px)` / line-height `1.05` |
| 卡片 H3 | `20–21px` / weight 300 / letter-spacing `.12–.16em` |
| 章節英文眉標 | `10px` / `--sans` / letter-spacing `.5em` / opacity `.4` |
| 內文 | `14–15px` / weight 300 / line-height `2.0–2.3` |
| 按鈕文字 | `10.5–11px` / `--sans` / letter-spacing `.3–.32em` |

### 間距

- 章節上下：`clamp(110px, 14vw, 190px)`
- 墨色區塊與前段落間：`clamp(90px, 12vw, 160px)`
- 作品網格 gap `22px`；髮絲線分隔網格用 `gap: 1px` + 背景色

### 字體載入

```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Noto+Serif+TC:wght@200;300;400&family=Jost:wght@200;300;400&display=swap
```

`_headers` 的 CSP 已相應放行，且**只**放行這兩個來源：

```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src  'self' https://fonts.gstatic.com data:
```

## Sections

由上而下，錨點 id 與 v2 相同（`main` / `philosophy` / `services` / `portfolio` / `process` / `faq` / `contact`）。

| # | 區塊 | 重點 |
|---|---|---|
| 1 | Header（fixed） | `backdrop-filter: blur(12px)`。未捲動 padding `32px 0`、背景透明；捲動 >60px 時 padding `18px 0`、背景 `rgba(233, 228, 218, .78)`，轉場 `.7s` |
| 2 | Hero `#top` | `min-height: 100vh`。背景巨型「默」字 `min(62vh, 52vw)`、opacity `.045`；`drift` 18s 漂浮 + 隨捲動下移（最多 120px，係數 .12）。三行階梯標題，第三行左縮 `clamp(0px, 16vw, 300px)` |
| 3 | Hero 大圖 | 高 `88vh` 全幅。`slitOpen`：`clip-path: inset(0 46% 0 46%)` → `inset(0)`，1.8s／延遲 `.7s`。視差係數 `-0.06`（捲動 400–1800px 區間） |
| 4 | 品牌理念 `#philosophy` | 左欄直排標題 `position: sticky; top: 170px`（≤960px 隱藏）；下方三欄原則，欄間 1px 髮絲線 |
| 5 | 核心服務 `#services` | 墨色區塊。四扇障子屏水平手風琴，容器高 `clamp(420px, 62vh, 620px)` |
| 6 | 風格作品 `#portfolio` | 12 欄不對稱網格，gap `22px` |
| 7 | 預約流程 `#process` | 四張卡橫排，`gap: 1px` + 髮絲線背景；Cormorant 大號碼 56px／opacity `.22` |
| 8 | 常見問題 `#faq` | 左欄 sticky（`top: 150px`）；右欄單開手風琴 |
| 9 | Contact `#contact` | 墨色區塊，置中巨標 + 兩顆 CTA |
| 10 | Footer | 「莫珩」為隱藏管理入口，**務必保留** |

### 服務屏風（第 5 區）

| 狀態 | 行為 |
|---|---|
| 預設 | 第一扇展開 |
| hover／keyboard focus | 該扇 `flex: 2.9`，其餘 `flex: 1`，轉場 1s |
| 展開扇 | 圖片 opacity 1 / scale 1.02；橫排標題 + 說明 + CTA |
| 收合扇 | 圖片 opacity `.55` / scale `1.12`；直排標題 |
| 圖片疊層 | `linear-gradient(to top, rgba(12, 11, 9, .72), rgba(12, 11, 9, .18))` |
| ≤960px | 縱向堆疊，每格固定 360px，**四扇文案全部顯示**，不依賴 hover |

### 作品網格（第 6 區）

| 圖 | span | 高 | 分類 |
|---|---|---|---|
| service-space | 7 | 520px | 空間花藝 |
| service-wedding | 5 | 520px | 婚禮花藝 |
| service-gift | 4 | 400px | 客製花禮 |
| hero-main | 4 | 400px | 空間花藝 |
| service-workshop | 4 | 400px | 客製花禮 |

篩選為**淡出而非移除**：未選分類 `opacity: .16`，轉場 `.7s`，保留版面節奏。每張圖 hover `scale(1.06)`，2s 緩動。≤960px 全部 `grid-column: span 12`。

## States and Interactions

| 元素 | 狀態 | 行為 |
|---|---|---|
| 導覽連結 | hover | 底線由左展開（`.mline`） |
| `預約` 按鈕 | hover | 反白：背景轉 `--ink`、文字轉 `--paper` |
| 分類按鈕 | 選中 | 實心墨底白字；未選為髮絲線外框，轉場 `.45s` |
| FAQ 項目 | 展開 | `max-height 0 → 360px`，`.7s`；`＋` 旋轉 135°，`.55s` |
| Contact 主 CTA | hover | 上移 3px |
| 預約表單 | 送出中 | 按鈕 disabled |
| 預約表單 | 成功 | 關閉 `bookingModal` → 開 `successModal`，顯示諮詢單號 |
| 預約表單 | 失敗 | `#formStatus`（`aria-live="polite"`）顯示錯誤，**不假裝成功** |
| 圖片 | 載入前 | 底色 `--img-bg`（作品）／`#221f1a`（服務屏風） |

## Animation / Motion

| 元素 | 觸發 | 動畫 | 時長 | 緩動 |
|---|---|---|---|---|
| Hero 標題／副標 | 載入 | `fadeUp`：translateY 30px + fade | — | 延遲 `.1s` / `.5s` |
| Hero 大圖 | 載入 | `slitOpen`：clip-path 一線開闔 | 1.8s | 延遲 `.7s` |
| 背景「默」字 | 持續 | `drift` 漂浮 | 18s | 無限循環 |
| `.rise` 元素 | IntersectionObserver（threshold `.1`, rootMargin `0 0 -6% 0`）加 `.in` | translateY(34px) + fade | 1.2s | `--ease` |
| Header | 捲動 >60px | padding／背景收斂 | `.7s` | `--ease` |
| 服務屏風 | hover / focus | flex 展開 | 1s | `--ease` |

## 全站效果

- **紙張顆粒**：`position: fixed; inset: 0; z-index: 90; pointer-events: none; opacity: .05; mix-blend-mode: multiply`，背景為 SVG `feTurbulence`（`baseFrequency=.82`、`numOctaves=3`、160×160 tile）
- **自訂游標**：26px 圓環，`mix-blend-mode: difference` + `filter: invert(1)`，rAF lerp 追蹤（係數 `.18`）；移到 `a / button / input` 上放大為 54px 並填實。`body { cursor: none }`

## Responsive Behavior

| 斷點 | 變化 |
|---|---|
| >1100px | 預設版面 |
| ≤1100px | 中間導覽收斂 |
| ≤960px | `--pad: 22px`；理念直排標題隱藏；服務屏風改縱向堆疊（文案全顯）；作品全部 span 12；流程改單欄；Hero `SCROLL ↓` 隱藏；導覽改漢堡下拉 |
| ≤600px | Hero 字級與間距微調 |

## Edge Cases

- **圖片未載入**：容器保留底色（`--img-bg` / `#221f1a`），不塌陷。
- **長文字**：中文標題以 `clamp()` 縮放，不截斷；作品圖說為單行漸層字幕列。
- **作品分類全空**：篩選為淡出設計，任何分類下版面高度不變，不會出現空狀態。
- **預約送出失敗**：上游非 2xx 時顯示錯誤訊息，不顯示假成功單號。
- **管理內容缺欄位**：`applyContent(payload.content ?? payload)` 對缺漏 key 保留 HTML 內既有文案。
- **觸控裝置**：`@media (pointer: coarse)` 還原系統游標；屏風不依賴 hover。

## Accessibility

- 跳到主要內容連結保留（focus 時顯現）。
- `cursor: none` 之下 **focus ring 仍必須可見**；屏風以 `:focus-within` 展開，鍵盤可達。
- `@media (prefers-reduced-motion: reduce)`：關閉視差、漂浮與進場位移。
- 手機導覽按鈕帶 `aria-expanded`。
- 預約彈窗：`role="dialog"` + `aria-modal="true"` + `aria-labelledby="bookingTitle"`；成功彈窗同規格。
- `#formStatus` 為 `aria-live="polite"`。
- 管理入口 `#adminEntry` 帶 `aria-label="進入網站編輯模式"`。
- 所有 `<img>` 皆有 `alt`（已由 `tests/site-static.test.mjs` 驗證）。
- 深色模式切換按鈕帶 `aria-label="切換深色或淺色模式"`。

## 不可破壞的合約

改動 `index.html` 時，以下必須原樣保留，否則測試會失敗、管理後台或預約流程會壞掉：

| 項目 | 數量／識別 |
|---|---|
| `data-edit-key` | 54 個，key 名稱不可變 |
| `data-image-key` | 7 個，key 名稱不可變 |
| API 端點 | `/api/booking`、`/api/content`、`/api/admin/{login,logout,session,content,upload}` |
| 錨點 id | `main`、`philosophy`、`services`、`portfolio`、`process`、`faq`、`contact` |
| 管理入口 | `#adminEntry`、`#footerAdminLink`（頁尾「莫珩」） |
| 表單 | `#bookingForm`（僅一顆 button、零個 a）、`#bookingModal`、`#successModal`、`#formStatus`、`name="privacyConsent"` required |
| 圖片路徑 | 版本化檔名（`*-v1.webp`），換圖請建新版本號，勿覆蓋 |

驗證：

```bash
node --test tests/*.test.mjs
```

## 後續可做

1. 自架 Google Fonts（下載 woff2 放 `/assets/fonts/`），移除 CSP 外部來源，載入更快。
2. `portfolioItemTitle*` 的分類標籤（SPACE／WEDDING／GIFT）目前寫在 JS 陣列，若要可編輯需納入 `functions/_lib/content-schema.mjs`。
3. 手機導覽目前為漢堡下拉，可改為全螢幕選單。
4. 舊版 Safari 對 `mix-blend-mode` 顆粒疊層較吃資源，必要時調低 `.grain` 的 `opacity`。
