# Graceful Middleware

Goryu アプリケーションでグレースフルシャットダウンを扱うためのミドルウェアおよびユーティリティパッケージです。サーバーが停止する前に、アクティブな接続をドレインし、クリーンアップタスクを実行することを保証します。

## 機能

- **グレースフルシャットダウン**: シャットダウン前にアクティブなリクエストの完了を待ちます。
- **シグナルハンドリング**: `SIGINT` と `SIGTERM` を自動的に待ち受けます。
- **クリーンアップフック**: シャットダウン時に実行する関数を登録できます（例: DB 接続のクローズ）。
- **タイムアウト**: シャットダウンのハングを防ぐため、最大シャットダウン時間を強制します。
- **接続トラッキング**: アクティブな接続数を追跡するミドルウェアです。

## 使い方

### 基本的なセットアップ

`RunWithGracefulShutdown` ヘルパーを使用してサーバーを起動します:

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/graceful"
    "time"
)

func main() {
    app := goryu.New()

    app.GET("/", func(c *goryuctx.Context) {
        // Simulate work
        time.Sleep(2 * time.Second)
        c.Status(200).String("Done")
    })

    // Starts the server and handles shutdown signals
    graceful.RunWithGracefulShutdown(app, ":8080")
}
```

### クリーンアップタスクを伴う場合

シャットダウン時にリソース（Database、Redis など）をクローズする関数を登録します:

```go
graceful.RunWithGracefulShutdown(app, ":8080", graceful.ShutdownConfig{
    Timeout: 10 * time.Second,
    CleanupFuncs: []func() error{
        func() error {
            fmt.Println("Closing database connection...")
            return db.Close()
        },
        func() error {
            fmt.Println("Flushing logs...")
            return logger.Sync()
        },
    },
})
```

### 接続トラッキングミドルウェア

アプリケーションロジック内でアクティブな接続数を追跡したい場合（例: ヘルスチェックやメトリクスのため）:

```go
app.Use(graceful.New(graceful.Config{
    ContextKey: "active_conns",
}))

app.GET("/status", func(c *goryuctx.Context) {
    count, _ := c.Get("active_conns")
    c.JSON(200, map[string]interface{}{
        "active_connections": count,
    })
})
```

## 仕組み

1.  **シグナルリスナー**: goroutine が OS シグナル（`SIGINT`、`SIGTERM`）を待ち受けます。
2.  **シャットダウントリガー**: シグナルを受信すると、`server.Shutdown(ctx)` を呼び出します。
3.  **ドレイン**: HTTP サーバーは新しい接続の受け入れを停止し、既存のハンドラーが戻るのを待ちます。
4.  **クリーンアップ**: サーバーが停止した後（またはタイムアウト後）、登録された `CleanupFuncs` が順番に実行されます。
