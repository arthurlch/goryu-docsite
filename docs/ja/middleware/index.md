# ミドルウェア

Goryu は、セキュリティ、AI/LLM ワークロード、トラフィック制御、可観測性、そして日常的なユーティリティのための、充実した組み込みミドルウェア群を同梱しています。すべてのミドルウェアは同じ形に従うため、適用はいつも同じ 2 行の変更で済みます。

## ミドルウェアの適用

`app.Use` でミドルウェアをグローバルに適用するか、ルートグループにスコープを絞ります。

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/limiter"
    "github.com/arthurlch/goryu/middleware/logger"
)

app := goryu.New()

// Global: runs for every request
app.Use(logger.Default())
app.Use(limiter.Default())

// Group-scoped: runs only for routes in the group
api := app.Group("/api/v1")
api.Use(limiter.New(limiter.Config{Max: 100}))
```

## 標準的なミドルウェアの形

各ミドルウェアパッケージは 2 つのコンストラクタを公開します。

- `New(config ...Config)` — 明示的な設定で構築します。
- `Default()` — 妥当なデフォルトで構築します（`New()` と等価です）。

```go
// Zero-config, sensible defaults
app.Use(limiter.Default())

// Explicit configuration
app.Use(limiter.New(limiter.Config{
    Max:        100,
    Expiration: time.Minute,
}))
```

すべての `Config` は `base.BaseConfig` を埋め込みます。これは、すべてのミドルウェアで共有される横断的なフックを提供します。

```go
type BaseConfig struct {
    Skip         func(c *goryuctx.Context) bool                       // skip this middleware for matching requests
    Logger       Logger                                               // custom logger
    ErrorHandler func(c *goryuctx.Context, err error, name string)    // custom error handling
}
```

`ConfigurableMiddleware` インターフェースを実装する Config は、次を公開します。

- `Configure(base *base.BaseConfig)` — 共有のベース設定をマージします。
- `Validate() error` — ミドルウェアが動作する前に設定を検証します。

未設定のフィールドはデフォルト（`base.DefaultLogger` と `base.DefaultErrorHandler`）にフォールバックするため、必要なものだけを設定すれば済みます。

## カタログ

### セキュリティ

| ミドルウェア | 説明 | ドキュメント |
|------------|-------------|------|
| auth | トークン/セッションベースの認証ガード | [/middleware/auth](/ja/middleware/auth) |
| basicauth | HTTP Basic 認証 | [/middleware/basicauth](/ja/middleware/basicauth) |
| cors | Cross-Origin Resource Sharing ヘッダー | [/middleware/cors](/ja/middleware/cors) |
| csrf | クロスサイトリクエストフォージェリ対策 | [/middleware/csrf](/ja/middleware/csrf) |
| secure | セキュリティレスポンスヘッダー（HSTS、X-Frame-Options など） | [/middleware/secure](/ja/middleware/secure) |
| secure_cookie | 署名済み/暗号化 Cookie の処理 | [/middleware/secure_cookie](/ja/middleware/secure_cookie) |
| tls_redirect | HTTP リクエストを HTTPS へリダイレクト | [/middleware/tls_redirect](/ja/middleware/tls_redirect) |
| trustproxy | 実クライアント IP のためにプロキシヘッダーを信頼・解析 | [/middleware/trustproxy](/ja/middleware/trustproxy) |
| session | サーバーサイドセッション管理 | [/middleware/session](/ja/middleware/session) |
| RBAC | ルート単位のロールベースアクセス制御 | [/security/rbac](/ja/security/rbac) |
| Audit log | アクセス監査証跡: 誰が、何を、いつ行い、結果はどうだったか | [/security/audit-log](/ja/security/audit-log) |

### AI/LLM

| ミドルウェア | 説明 | ドキュメント |
|------------|-------------|------|
| aimeter | LLM エンドポイント向けのトークンとコストの計上 | [/middleware/aimeter](/ja/middleware/aimeter) |
| promptcache | URL ではなくリクエストボディ（プロンプト）をキーとするレスポンスキャッシュ | [/middleware/promptcache](/ja/middleware/promptcache) |
| recorder | リプレイ、評価、デバッグのためにリクエスト/レスポンスのペアを記録 | [/middleware/recorder](/ja/middleware/recorder) |

### トラフィック & 信頼性

| ミドルウェア | 説明 | ドキュメント |
|------------|-------------|------|
| limiter | 固定ウィンドウのレート制限 | [/middleware/limiter](/ja/middleware/limiter) |
| circuitbreaker | 失敗している下流に対して遮断・回復を行う | [/middleware/circuitbreaker](/ja/middleware/circuitbreaker) |
| timeout | リクエスト単位の期限を強制 | [/middleware/timeout](/ja/middleware/timeout) |
| recovery | パニックから回復し、安全なエラーレスポンスを返す | [/middleware/recovery](/ja/middleware/recovery) |
| graceful | グレースフルシャットダウン / コネクションのドレイン | [/middleware/graceful](/ja/middleware/graceful) |
| compress | レスポンス圧縮（gzip/deflate） | [/middleware/compress](/ja/middleware/compress) |
| cache | HTTP レスポンスキャッシュ | [/middleware/cache](/ja/middleware/cache) |

### 可観測性

| ミドルウェア | 説明 | ドキュメント |
|------------|-------------|------|
| logger | リクエストロギング | [/middleware/logger](/ja/middleware/logger) |
| structlog | 構造化（JSON）リクエストロギング | [/middleware/structlog](/ja/middleware/structlog) |
| metrics | アプリケーション/リクエストのメトリクス収集 | [/middleware/metrics](/ja/middleware/metrics) |
| expvar | `expvar` 経由でランタイムメトリクスを公開 | [/middleware/expvar](/ja/middleware/expvar) |
| tracing | 分散トレーシングのスパン | [/middleware/tracing](/ja/middleware/tracing) |
| requestid | 各リクエストに一意の ID を付与 | [/middleware/requestid](/ja/middleware/requestid) |
| healthcheck | Liveness/Readiness エンドポイント | [/middleware/healthcheck](/ja/middleware/healthcheck) |
| errors | 一元化されたエラーハンドリングと整形 | [/middleware/errors](/ja/middleware/errors) |

### ユーティリティ

| ミドルウェア | 説明 | ドキュメント |
|------------|-------------|------|
| base | すべてのミドルウェアで共有されるベース設定とヘルパー | [/middleware/base](/ja/middleware/base) |
| builder | ミドルウェアを組み立てるための流暢なビルダー | [/middleware/builder](/ja/middleware/builder) |
| envvar | 環境変数駆動の設定 | [/middleware/envvar](/ja/middleware/envvar) |
| favicon | favicon を配信し、`/favicon.ico` をショートサーキットする | [/middleware/favicon](/ja/middleware/favicon) |
| fileserver | ディレクトリから静的ファイルを配信 | [/middleware/fileserver](/ja/middleware/fileserver) |
