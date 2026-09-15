# Timeout ミドルウェア

リクエストのコンテキストにタイムアウトを追加するミドルウェアです。リクエストの処理が指定した時間よりも長くかかった場合、コンテキストをキャンセルし、`503 Service Unavailable`（または `408 Request Timeout`）レスポンスを返します。

## 特徴

- **コンテキストのキャンセル**: タイムアウトに達すると、リクエストのコンテキストを自動的にキャンセルします。
- **カスタムハンドラー**: タイムアウト発生時のレスポンスを独自に定義できます。
- **パニック処理**: タイムアウトした goroutine 内のパニックを安全に処理します。
- **競合状態の保護**: アトミック操作を使用し、タイムアウト後にレスポンスへ書き込むことを防止します。

## 使い方

### 基本的なセットアップ

30 秒のタイムアウト（デフォルト）を適用します:

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/timeout"
)

app.Use(timeout.Default())
```

### タイムアウト時間のカスタマイズ

特定のタイムアウト時間を設定します:

```go
app.Use(timeout.New(timeout.Config{
    Timeout: 5 * time.Second,
}))
```

### カスタムエラーレスポンス

タイムアウト時にクライアントへ送信するレスポンスをカスタマイズします:

```go
app.Use(timeout.New(timeout.Config{
    Timeout: 2 * time.Second,
    TimeoutHandler: func(c *goryuctx.Context) {
        c.JSON(http.StatusGatewayTimeout, map[string]string{
            "error": "Processing took too long",
        })
    },
}))
```

## 仕組み

1.  **Goroutine**: ミドルウェアは次のハンドラーを別の goroutine で実行します。
2.  **Select**: ハンドラーの完了、またはコンテキストのタイムアウトのいずれかを待機します。
3.  **キャンセル**: タイムアウトが先に発生した場合、タイムアウトレスポンスを書き込み、コンテキストをキャンセルします。
4.  **安全性**: `ResponseWriter` をラップし、タイムアウト発生後にハンドラーがレスポンスへ書き込めないようにします。

## 重要な注意点

ハンドラーは別の goroutine で実行されるため、`Context` からアクセスするデータはスレッドセーフであるか、同時に変更されないようにする必要があります。標準的な `goryuctx.Context` の使い方は一般的に安全ですが、共有される可変状態には注意してください。
