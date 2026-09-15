# Expvar ミドルウェア

Go の公開変数（`expvar` パッケージ経由）を HTTP 上で公開するミドルウェアです。アプリケーションの内部状態、メモリ統計、カスタムメトリクスを監視する際に役立ちます。

## 機能

- **標準エンドポイント**: デフォルトで `/debug/vars` にメトリクスを公開します。
- **カスタムパス**: エンドポイントのパスを設定できます。
- **JSON 出力**: 多くの監視ツールと互換性のある JSON 形式でメトリクスを返します。

## 使い方

### 基本的なセットアップ

`/debug/vars` にメトリクスを公開します。

```go
package main

import (
    "expvar"
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/expvar"
)

func main() {
    app := goryu.New()

    // Publish a custom metric
    requests := expvar.NewInt("requests")
    
    app.Use(expvar.Default())

    app.GET("/", func(c *goryuctx.Context) error {
        requests.Add(1)
        return c.String(200, "Hello Expvar")
    })

    app.Run(":8080")
}
```

### カスタムパス

異なるパスにメトリクスを公開します。

```go
app.Use(expvar.WithPath("/metrics/vars"))
```

### 高度な設定

```go
app.Use(expvar.New(expvar.Config{
    Path: "/admin/stats",
}))
```

## セキュリティに関する注意

`expvar` エンドポイントはアプリケーションの内部詳細を公開します。本番環境では、認証ミドルウェアを用いてこのエンドポイントを保護するか、アクセスを内部ネットワークのみに制限する必要があります。

```go
// Example: Protect expvar with Basic Auth
app.Use(func(next goryuctx.HandlerFunc) goryuctx.HandlerFunc {
    return func(c *goryuctx.Context) {
        if c.Request.URL.Path == "/debug/vars" {
            // Apply auth check here
        }
        next(c)
    }
})
app.Use(expvar.Default())
```
