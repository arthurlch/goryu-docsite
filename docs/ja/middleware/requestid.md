# RequestID Middleware

すべての HTTP リクエストに一意の識別子を追加するミドルウェアです。新しい ID を生成することも、リクエストヘッダーから既存の ID を引き継ぐこともできます。

## 機能

- **自動生成**: ID が存在しない場合、暗号学的に安全なランダムな UUID（または 16 進文字列）を生成します。
- **伝播**: ヘッダーで渡された既存の ID（例: ロードバランサーからのもの）を尊重します。
- **コンテキスト統合**: ID をコンテキストに保存し、他のミドルウェア（ロガーなど）から利用できるようにします。
- **レスポンスヘッダー**: クライアント側での追跡のために、ID をレスポンスヘッダーに追加します。

## 使い方

### 基本的なセットアップ

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/requestid"
)

func main() {
    app := goryu.New()

    app.Use(requestid.Default())

    app.GET("/", func(c *goryuctx.Context) {
        id, exists := c.Get("requestid")
        if exists {
            c.Status(200).String("Request ID: "+id.(string))
        } else {
            c.Status(200).String("No request ID found")
        }
    })

    app.Listen(":8080")
}
```

### 高度な設定

ヘッダー名や ID ジェネレーターをカスタマイズします:

```go
app.Use(requestid.New(requestid.Config{
    Header: "X-Correlation-ID",
    Generator: func() string {
        return "custom-id-" + time.Now().String()
    },
}))
```

## なぜ便利なのか

- **デバッグ**: 単一の ID を使用して、異なるサービスやコンポーネント間でログを関連付けられます。
- **トレーシング**: 分散システム内をリクエストがどのように通過したかを追跡できます。
- **サポート**: エラーレスポンスにリクエスト ID を含めてユーザーに提供することで、サポート問い合わせ時にそれを参照できるようになります。
