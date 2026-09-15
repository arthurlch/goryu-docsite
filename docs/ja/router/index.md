# Router パッケージ

`router` パッケージは、Goryu 向けの高性能な radix ツリーベースの HTTP ルーターを実装します。名前付きパラメータ、ワイルドカード、ルートのグループ化、ミドルウェアに対応しています。

## 特徴

- **高速**: 効率的なルーティングアルゴリズムによる高速なパスマッチング（Radix ツリー）。
- **パラメータ**: `/users/:id` のような名前付きパラメータ。
- **ワイルドカード**: `/files/*path` のようなキャッチオールルート。
- **グループ**: 共通のプレフィックスとミドルウェアでルートを整理します。
- **ミドルウェア**: グローバル、グループ、ルートの各レベルでチェーン可能なミドルウェアに対応。
- **名前付きルート**: URL の逆生成に対応。
- **カスタマイズ可能**: 末尾スラッシュの扱いや、許可されていないメソッドの処理などの動作を設定できます。

## 使い方

### 基本的なルーティング

```go
import (
    "github.com/arthurlch/goryu/router"
    "github.com/arthurlch/goryu/goryuctx"
)

r := router.New()

r.GET("/", func(c *goryuctx.Context) error {
    return c.String(200, "Welcome!")
})

r.POST("/users", func(c *goryuctx.Context) error {
    return c.String(201, "User created")
})
```

### パラメータとワイルドカード

```go
// Named parameter
r.GET("/users/:id", func(c *goryuctx.Context) error {
    id := c.Param("id")
    return c.String(200, "User ID: "+id)
})

// Wildcard
r.GET("/files/*path", func(c *goryuctx.Context) error {
    path := c.Param("path")
    return c.String(200, "File path: "+path)
})
```

### ルートグループ

共通のプレフィックスとミドルウェアを共有するために、ルートをグループ化します:

```go
api := r.Group("/api")
api.Use(authMiddleware)

v1 := api.Group("/v1")
v1.GET("/users", listUsers)
v1.GET("/users/:id", getUser)
```

### 設定

ルーターの動作をカスタマイズできます:

```go
r := router.New(router.RouterConfig{
    StrictRouting:          true,  // /foo and /foo/ are different
    RedirectTrailingSlash:  false, // Disable automatic redirects
    HandleMethodNotAllowed: true,  // Return 405 for invalid methods
    MaxRouteDepth:          32,    // Security limit
})
```

## セキュリティ

このルーターには、リソース枯渇攻撃を防ぐための組み込みのセキュリティ制限が含まれています:
- `MaxRouteDepth`: ルーティングツリーの深さを制限します。
- `MaxTotalRoutes`: 登録可能なルートの総数を制限します。
- `MaxParametersPerRoute`: 個々のルートの複雑さを制限します。
