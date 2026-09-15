# Router Builder - 流暢なルート登録

このパッケージは、Goryu フレームワークにおけるルート登録のための表現力豊かで流暢な API を提供し、ルート定義をより読みやすく保守しやすいものにします。

## 特徴

- **流暢な API**: メソッドをチェーンして、すっきりとしたルート定義を実現します
- **リソースルート**: RESTful なルートを自動生成します
- **ネストされたグループ**: プレフィックスとミドルウェアでルートを整理します
- **メソッドチェーン**: 名前、説明、キャッシュを指定してルートを設定します
- **コントローラー統合**: リフレクションによる自動的なメソッドマッピング

## クイックスタート

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/router/builder"
)

func main() {
    app := goryu.New()
    
    // Fluent route registration
    app.Route().
        Group("/api/v1", func(v1 *builder.SimpleGroupBuilder) {
            // Individual routes with configuration
            v1.GET("/health", healthHandler).
                Name("health").
                Description("Health check endpoint")
            
            // RESTful resource
            v1.Resource("/users", &UserController{}).
                Name("users").
                Build()
        })
    
    app.Listen(":8080")
}
```

## 例

### 基本的なルート登録

```go
// BEFORE - Traditional approach:
app.GET("/users", getUsersHandler)
app.POST("/users", createUserHandler)
app.GET("/users/:id", getUserHandler)

// AFTER - Fluent approach:
app.Route().
    Group("/", func(root *builder.SimpleGroupBuilder) {
        root.GET("/users", getUsersHandler).Name("users.index")
        root.POST("/users", createUserHandler).Name("users.create")
        root.GET("/users/:id", getUserHandler).Name("users.show")
    })
```

### リソースルート

```go
type UserController struct{}

func (uc *UserController) Index(c *goryuctx.Context) { /* GET /users */ }
func (uc *UserController) Create(c *goryuctx.Context) { /* POST /users */ }
func (uc *UserController) Show(c *goryuctx.Context) { /* GET /users/:id */ }
func (uc *UserController) Update(c *goryuctx.Context) { /* PUT /users/:id */ }
func (uc *UserController) Destroy(c *goryuctx.Context) { /* DELETE /users/:id */ }

// Automatic RESTful routes
app.Route().
    Group("/api", func(api *builder.SimpleGroupBuilder) {
        api.Resource("/users", &UserController{}).
            Name("users").
            Build()
    })
```

### 詳細な設定

```go
app.Route().
    Group("/api", func(api *builder.SimpleGroupBuilder) {
        // Group middleware
        api.Middleware(
            auth.Required(),
            cors.New(),
            rateLimit.PerIP(100),
        )
        
        // Versioned API with nested groups
        api.Group("/v1", func(v1 *builder.SimpleGroupBuilder) {
            // Full resource with filtering
            v1.Resource("/posts", &PostController{}).
                Only("index", "show", "create").  // Only these actions
                Name("v1.posts").
                Build()
            
            // Custom routes with configuration
            v1.POST("/auth/login", authController.Login).
                Name("auth.login").
                Description("User authentication endpoint").
                Cache(0) // No caching for auth endpoints
            
            // Admin section
            v1.Group("/admin", func(admin *builder.SimpleGroupBuilder) {
                admin.Middleware(auth.RequireRole("admin"))
                
                admin.Resource("/users", &AdminUserController{}).
                    Except("destroy").  // All except destroy
                    Name("admin.users").
                    Build()
            })
        })
    })
```

### ミドルウェアの統合

```go
app.Route().
    Group("/api", func(api *builder.SimpleGroupBuilder) {
        // Apply middleware to entire group
        api.Middleware(
            logger.New(),
            recovery.New(),
            cors.Default(),
        )
        
        api.Resource("/orders", &OrderController{}).
            Middleware(
                auth.JWT(),           // Resource-specific middleware
                validation.Orders(),
            ).
            Name("orders").
            Build()
    })
```

## 従来の登録方法に対する利点

1. **可読性**: 明確な階層構造
2. **整理**: 関連するルートをまとめて管理
3. **一貫性**: すべてのルートタイプで統一されたパターン
4. **保守性**: 変更や拡張が容易
5. **ドキュメント**: 組み込みのルート説明
6. **型安全性**: Go の型チェックを完全に活用
7. **ミドルウェアのスコープ管理**: きめ細かいミドルウェアの適用

## リソースコントローラーのパターン

### 完全なコントローラーの実装

```go
type ArticleController struct {
    db *Database
}

// GET /articles
func (ac *ArticleController) Index(c *goryuctx.Context) {
    articles := ac.db.GetAllArticles()
    c.OK(articles)
}

// POST /articles
func (ac *ArticleController) Create(c *goryuctx.Context) {
    var article Article
    if err := c.BindJSON(&article); err != nil {
        c.BadRequest("Invalid article data")
        return
    }
    created := ac.db.CreateArticle(article)
    c.Created(created)
}

// GET /articles/:id
func (ac *ArticleController) Show(c *goryuctx.Context) {
    id := c.Param("id")
    article := ac.db.GetArticle(id)
    if article == nil {
        c.NotFound("Article not found")
        return
    }
    c.OK(article)
}

// PUT /articles/:id
func (ac *ArticleController) Update(c *goryuctx.Context) {
    id := c.Param("id")
    var updates Article
    if err := c.BindJSON(&updates); err != nil {
        c.BadRequest("Invalid update data")
        return
    }
    updated := ac.db.UpdateArticle(id, updates)
    c.OK(updated)
}

// DELETE /articles/:id
func (ac *ArticleController) Destroy(c *goryuctx.Context) {
    id := c.Param("id")
    ac.db.DeleteArticle(id)
    c.Status(204)
}
```

### 部分的なコントローラー（一部のアクションのみ）

```go
type ReadOnlyController struct{}

// Only implement the actions you need
func (roc *ReadOnlyController) Index(c *goryuctx.Context) { /* ... */ }
func (roc *ReadOnlyController) Show(c *goryuctx.Context) { /* ... */ }

// Use .Only() to specify which actions to register
app.Route().
    Group("/readonly", func(g *builder.SimpleGroupBuilder) {
        g.Resource("/items", &ReadOnlyController{}).
            Only("index", "show").
            Build()
    })
```

## API リファレンス

### SimpleGroupBuilder のメソッド

- `GET(path, handler)` - GET ルートを登録します
- `POST(path, handler)` - POST ルートを登録します
- `PUT(path, handler)` - PUT ルートを登録します
- `DELETE(path, handler)` - DELETE ルートを登録します
- `PATCH(path, handler)` - PATCH ルートを登録します
- `Group(prefix, callback)` - ネストされたグループを作成します
- `Resource(path, controller)` - RESTful なリソースを作成します
- `Middleware(middlewares...)` - グループにミドルウェアを追加します

### SimpleRouteConfig のメソッド

- `Name(name)` - URL 生成用のルート名を設定します
- `Description(desc)` - ルートの説明を追加します
- `Cache(ttl)` - キャッシュ期間を設定します

### SimpleResourceBuilder のメソッド

- `Name(name)` - リソース名のプレフィックスを設定します
- `Only(actions...)` - 指定したアクションのみを含めます
- `Except(actions...)` - 指定したアクションを除外します
- `Middleware(middlewares...)` - リソースにミドルウェアを追加します
- `Build()` - ルートを作成します

この流暢な API により、基盤となるルーターシステムのすべての機能を維持しつつ、ルート登録をより表現力豊かで保守しやすいものにできます。
