# 默藍花藝官網

這是一個可直接部署到 Cloudflare Pages 的繁體中文單頁形象網站。網站不需要前端建置步驟；預約表單透過 Pages Function 在伺服器端轉送。右下角編輯按鈕提供受保護的文字與照片管理模式，瀏覽器內不保存 Webhook 網址或管理員帳密。

## 結構

```text
上線/
├── index.html
├── _headers
├── _routes.json
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── favicon.svg
│   ├── site-content.json
│   ├── image-urls.json
│   └── images/
│       ├── hero/
│       ├── service/
│       ├── portfolio/
│       └── uploads/
├── functions/
│   ├── _lib/
│   ├── api/booking.js
│   ├── api/admin/
│   ├── media/[[path]].js
│   └── image-proxy.js
├── scripts/
│   ├── hash-admin-password.mjs
│   └── local-admin-server.mjs
└── tests/
```

## 管理編輯模式

點右下角鉛筆按鈕，或點頁尾「設計與規劃由 **莫珩**管理團隊 極致打造」中的「莫珩」，即可開啟同一個管理登入。登入後可直接點選頁面文字編輯；照片則點「更換照片」並選擇本機 JPG、PNG 或 WebP 檔案（上限 8 MB）。上傳照片後仍需按「儲存變更」，才會把該照片套用到網站內容。

### 本機管理伺服器

先在目前 PowerShell 視窗設定管理帳密，再啟動內建伺服器：

```powershell
$env:MORAN_ADMIN_USER = '自訂管理帳號'
$env:MORAN_ADMIN_PASSWORD = '至少 12 個字元的管理密碼'
node scripts/local-admin-server.mjs
```

開啟 `http://localhost:4173`。本機模式會將內容寫入 `assets/site-content.json`，照片寫入 `assets/images/uploads/`，並回傳 `/assets/images/uploads/...` 相對網址。帳密只存在啟動伺服器的環境變數中。

### Cloudflare Pages 管理設定

Pages 的正式部署檔案在執行期間是唯讀的，因此線上編輯使用 Cloudflare R2 保存內容與照片：

1. 建立 R2 bucket，並在 Pages 專案的 Functions 綁定中設定變數名稱 `SITE_CONTENT`。
2. 產生密碼雜湊（不要把密碼直接設成 secret）：

```powershell
$env:MORAN_ADMIN_PASSWORD = '至少 12 個字元的管理密碼'
node scripts/hash-admin-password.mjs
```

3. 在 Pages 設定三個加密 secrets：`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET`。`ADMIN_SESSION_SECRET` 請使用獨立且足夠長的隨機值。
4. 重新部署並實際驗證登入、修改文字、上傳照片、儲存、重新整理與登出。

線上照片會以 `/media/uploads/...` 相對網址顯示。舊照片不會在替換時自動刪除，方便回復；可在確認不再使用後從 R2 管理介面人工整理。

## 圖片維護

正式頁面只引用版本化檔名，搭配一年 immutable 快取。換圖時請不要覆蓋舊檔名，應建立下一版，例如把 `hero-main-v1.webp` 政名為 `hero-main-v2.webp`，再同步更新 `index.html` 與 `assets/image-urls.json`。

| 用途 | 建議尺寸 | 目前檔案 |
|---|---:|---|
| Hero | 900 × 1200 | `assets/images/hero/hero-main-v1.webp` |
| 社群分享圖 | 1200 × 630 | `assets/images/hero/hero-og-v1.jpg` |
| 服務圖片 | 800 × 600 左右 | `assets/images/service/*-v1.webp` |
| 作品圖片 | 750 × 1000 或 1000 × 750 | `assets/images/portfolio/*-v1.webp` |

執行圖片清單驗證：

```powershell
node image-manager.js verify
```

## 預約服務設定

Pages Function 只從 Cloudflare 的加密環境變數讀取 Webhook：

```powershell
wrangler pages secret put BOOKING_WEBHOOK_URL --project-name <Cloudflare-Pages-專案名稱>
```

請輸入既有 Google Apps Script 的 HTTPS Webhook URL。不要把網址、密碼或 token 寫回 `index.html`、README 或 Git。

前端呼叫同網域 `POST /api/booking`。函式會驗證欄位、限制內容長度、攔截蜜罐欄位與過快送出，並等待上游回應；只有上游回傳 2xx 才會在畫面顯示成功及諮詢單號。

## 本機檢查

含管理編輯功能的本機頁面：

```powershell
$env:MORAN_ADMIN_USER = 'local-admin'
$env:MORAN_ADMIN_PASSWORD = '僅供本機測試且至少 12 字元'
node scripts/local-admin-server.mjs
```

函式單元測試：

```powershell
node --test tests/*.test.mjs
```

本機管理伺服器預設不會假裝預約成功；未串接正式 Webhook 時會回傳 503。只有自動化測試可設定 `MORAN_DEV_BOOKING_MODE=success` 啟用模擬成功，正式流程仍需以 Cloudflare Pages 與實際 Webhook 驗證。

## 部署界線

- Cloudflare Pages 的建置命令留空，輸出目錄指向本資料夾。
- 部署前先設定 `BOOKING_WEBHOOK_URL`、三個管理 secrets 與 `SITE_CONTENT` R2 binding。
- 部署後必須實際檢查首頁、手機版、圖片、`robots.txt`、`sitemap.xml` 與預約成功／失敗流程。
- 本機 HTTP 200、單元測試通過或畫面截圖，不等同於 Cloudflare 與 Google Apps Script 的正式環境驗證。

## 內容維護原則

- 作品區目前明確標示為「風格參考」，不可改寫成客戶案例，除非已取得真實案件資訊與使用授權。
- 地址、營業時間、服務地區、回覆時限與退款規則目前沒有正式資料，因此頁面只保留逐案確認的中性說明。
- 若要新增這些資訊，請先確認實際營運規則，再同步更新頁面、結構化資料與 FAQ。
