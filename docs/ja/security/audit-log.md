# 監査ログ

`auditlog` ミドルウェアは、アクセス監査証跡（誰が、いつ、何を、どのような結果で
実行したか）を記録します。各リクエストは `Event` となり、`Sink`（デフォルトでは
JSON ロガー）に書き込まれます。

## 特徴

- **構造化イベント** — リクエストごとに時刻、メソッド、パス、ステータス、レイテンシ、ユーザー ID、IP を記録します。
- **差し替え可能な Sink** — デフォルトの JSON ロガー、データベース、ファイル、SIEM などに書き込めます。
- **アイデンティティ対応** — 認証／セッションミドルウェアが設定した `user_id` コンテキストキー、またはカスタムの抽出関数を読み取ります。
- **スキップ可能** — `Skip` を使ってヘルスチェックやノイズの多いパスを除外できます。
- **設定不要のデフォルト** — `auditlog.Default()` はそのまま JSON イベントをログ出力します。

## 使い方

### デフォルトの JSON 証跡

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/auditlog"
)

func main() {
    app := goryu.New()

    app.Use(auditlog.Default()) // JSON events to the default logger

    log.Fatal(app.Listen(":8080"))
}
```

各イベントには `time`、`method`、`path`、`status`、`latency_ms`、`user_id`、`ip` が
含まれます。`user_id` は認証またはセッションミドルウェアが設定した `user_id`
コンテキストキーから取得されるため、ユーザーが認証されると監査対象のリクエストには
自動的に主体が紐付けられます。

### カスタム Sink とアイデンティティ抽出関数

イベントを独自の送信先に送り、呼び出し元のアイデンティティの解決方法を上書きします。

```go
app.Use(auditlog.New(auditlog.Config{
    Sink:       mySink,
    UserIDFunc: func(c *goryu.Ctx) string { return currentUser(c) },
}))
```

### Sink の実装

`Sink` は各イベントを受け取ります。実装は並行利用に対して安全でなければなりません。

```go
type Sink interface {
    Write(auditlog.Event) error
}

type dbSink struct{ db *sql.DB }

func (s dbSink) Write(e auditlog.Event) error {
    _, err := s.db.Exec(
        `INSERT INTO audit_log (time, method, path, status, latency_ms, user_id, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        e.Time, e.Method, e.Path, e.Status, e.LatencyMS, e.UserID, e.IP,
    )
    return err
}

app.Use(auditlog.New(auditlog.Config{Sink: dbSink{db: db}}))
```

Sink への書き込みが失敗した場合、そのエラーはログに記録されます（リクエスト自体は
影響を受けません）。

### リクエストのスキップ

ノイズの多いパスや無関係なパスを証跡から除外します。

```go
app.Use(auditlog.New(auditlog.Config{
    Skip: func(c *goryu.Ctx) bool {
        return c.Request.URL.Path == "/healthz"
    },
}))
```

## Event

```go
type Event struct {
    Time      time.Time // when the request started
    Method    string    // HTTP method
    Path      string    // request path
    Status    int       // response status code
    LatencyMS int64     // handler latency in milliseconds
    UserID    string    // caller identity (omitted if empty)
    IP        string    // client IP
}
```

## 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| Sink | `Sink` | イベントの送信先 | ロガーへの JSON |
| UserIDFunc | `func(c *goryu.Ctx) string` | 呼び出し元のアイデンティティを抽出 | `user_id` コンテキストキー |
| Skip | `func(c *goryu.Ctx) bool` | リクエストの監査をスキップ | なし |

::: tip チェーンの早い段階に配置する
監査ミドルウェアはチェーンの早い段階に登録し、内側のミドルウェアが行った処理も含めた
リクエスト全体の最終的なステータスコードとレイテンシを捕捉できるようにします。
`user_id` コンテキストキーを読み取るため、そのキーを設定する
[JWT 認証](/ja/middleware/auth)、[セッション](/ja/middleware/session)、
[OAuth2 / OIDC](/ja/security/oidc) とクリーンに組み合わせられます。
:::

::: warning 並行性
`Sink` の実装は並行利用に対して安全でなければなりません — リクエストは並行して
監査されます。
:::

## 次のステップ

- [JWT 認証](/ja/middleware/auth) または [セッション](/ja/middleware/session) でアイデンティティを紐付け、イベントに主体を付与しましょう。
- [RBAC](/ja/security/rbac) を使って、アクセスとあわせて認可の判断も記録しましょう。
