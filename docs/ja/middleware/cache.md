# Cache ミドルウェア

Goryu 向けの高性能なインメモリキャッシュミドルウェアです。HTTP レスポンスをキャッシュすることでサーバー負荷を軽減し、頻繁にアクセスされるリソースのレスポンス時間を改善します。

## 機能

- **インメモリストレージ**: ローカルメモリを使用した高速アクセス。
- **LRU による退避**: 上限に達すると、最も長く使用されていない項目を自動的に削除します。
- **設定可能な上限**: 最大エントリ数と最大メモリ使用量を設定できます。
- **TTL による有効期限**: 指定した期間の経過後にエントリを自動的に失効させます。
- **並行処理に安全**: `sync.RWMutex` を用いたスレッドセーフな実装。

## 使い方

### 基本的なセットアップ

GET リクエストを 5 分間キャッシュします。

```go
package main

import (
    "time"
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/cache"
)

func main() {
    app := goryu.New()

    // Default configuration (5 min TTL, 1000 entries, 50MB max)
    app.Use(cache.Default())

    app.GET("/slow-data", func(c *goryuctx.Context) {
        time.Sleep(2 * time.Second) // Simulate slow work
        c.JSON(200, map[string]string{"data": "cached"})
    })

    app.Listen(":8080")
}
```

### 高度な設定

有効期限、メモリ上限、キャッシュキーをカスタマイズします。

```go
app.Use(cache.New(cache.Config{
    Expiration:      10 * time.Minute,
    MaxSize:         5000,       // Max 5000 entries
    MaxMemory:       100 << 20,  // Max 100MB
    CleanupInterval: 1 * time.Minute,
    KeyGenerator: func(c *goryuctx.Context) string {
        // Cache by URL and a custom header
        return c.Request.URL.Path + "|" + c.GetHeader("X-Tenant-ID")
    },
}))
```

## 仕組み

1.  **GET リクエストのみ**: デフォルトでは、`GET` リクエストのみがキャッシュされます。
2.  **キーの生成**: キャッシュキーを生成します（デフォルト: `Method + Path`）。
3.  **キャッシュの検索**: 有効なエントリが存在するかを確認します。見つかった場合は、キャッシュされたレスポンスを即座に返します。
4.  **レスポンスのキャプチャ**: 見つからない場合は、`ResponseWriter` をラップしてステータスコード、ヘッダー、ボディをキャプチャします。
5.  **保存**: キャプチャしたレスポンスがメモリ上限に収まる場合、LRU キャッシュに保存します。

## 制限事項

- **単一ノード**: これはローカルのインメモリキャッシュです。アプリケーションの複数インスタンス間で共有されることはありません。分散キャッシュが必要な場合は、Redis の利用を検討してください。
- **メモリ使用量**: アプリケーションが過剰に RAM を消費しないよう、`MaxMemory` の設定に注意してください。
