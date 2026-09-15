# StructLog ミドルウェア

Goryu 向けの高性能な構造化ロギングミドルウェアで、Go 標準の `log/slog` パッケージ上に構築されています。本番環境に適したゼロアロケーションの JSON ロギングを提供します。

## 特徴

- **構造化ロギング**: デフォルトでログを JSON 形式で出力します。
- **リクエスト相関**: すべてのログエントリに `request_id` を自動的に付与します。
- **コンテキスト統合**: コンテキストと連携してログを出力するためのヘルパー関数（`LogInfo`、`LogError`）を提供します。
- **パフォーマンス**: `log/slog` を基盤とし、アロケーションのオーバーヘッドを最小限に抑えます。
- **詳細な属性**: ステータス、メソッド、パス、処理時間、IP、ユーザーエージェント、レスポンスサイズを記録します。

## 使い方

### 基本的なセットアップ

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/structlog"
)

func main() {
    app := goryu.New()

    // Use default configuration (JSON output to stdout)
    app.Use(structlog.Default())

    app.GET("/", func(c *goryuctx.Context) {
        // Log with correlation ID
        structlog.LogInfo(c, "handling_request", "user_id", "123")
        
        c.JSON(200, map[string]string{"status": "ok"})
    })

    app.Listen(":8080")
}
```

### 詳細な設定

ロガーのインスタンスや出力先をカスタマイズできます:

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelDebug,
}))

app.Use(structlog.New(structlog.Config{
    Logger: logger,
    CustomFields: func(c *goryuctx.Context) map[string]any {
        return map[string]any{
            "tenant_id": c.GetHeader("X-Tenant-ID"),
        }
    },
}))
```

### コンテキストロギング

このミドルウェアは、相関付けされたロガーをコンテキストに注入します。ヘルパー関数を使用すると、`request_id` を自動的に含めたメッセージを出力できます:

- `structlog.LogInfo(c, msg, args...)`
- `structlog.LogWarn(c, msg, args...)`
- `structlog.LogError(c, msg, err, args...)`

または、ロガーのインスタンスを直接取得することもできます:

```go
logger := structlog.CorrelatedLogger(c)
logger.Info("custom message")
```

## 出力例

```json
{
  "time": "2023-10-27T10:00:00Z",
  "level": "INFO",
  "msg": "GET /api/users 200",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/users",
  "status_code": 200,
  "duration_ms": "12.5",
  "remote_ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "custom": {
    "tenant_id": "tenant_1"
  }
}
```
