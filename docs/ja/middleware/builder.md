# ミドルウェアビルダー

ミドルウェアビルダーパッケージは、Goryu フレームワーク向けのミドルウェアを流れるように直感的に作成する方法を提供します。

## 機能

- **流れるような API**: メソッドをチェーンして、簡潔で読みやすいミドルウェア定義を記述できます
- **エラー処理**: カスタマイズ可能なエラーハンドラーを備えた組み込みのエラー処理
- **スキップロジック**: 条件に応じてミドルウェアの実行をスキップできます
- **Before/After フック**: メインハンドラーの前後にコードを実行できます
- **型安全**: 適切なエラー伝播を伴う完全な Go の型安全性

## クイックスタート

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
)

// Simple middleware
middleware := goryu.NewMiddleware("MyMiddleware").
    Before(func(c *goryuctx.Context) error {
        // Pre-processing logic
        return nil
    }).
    Build()

app.Use(middleware)
```

## 例

### 認証ミドルウェア

```go
authMiddleware := goryu.NewMiddleware("Auth").
    Before(func(c *goryuctx.Context) error {
        token := c.Request.Header.Get("Authorization")
        if token == "" {
            return errors.New("missing authorization")
        }
        // Validate token...
        return nil
    }).
    OnError(func(c *goryuctx.Context, err error) {
        c.Status(401).JSON(goryuctx.Map{
            "error": err.Error(),
        })
    }).
    Build()
```

### タイミング計測付きロギングミドルウェア

```go
loggingMiddleware := goryu.NewMiddleware("Logger").
    Before(func(c *goryuctx.Context) error {
        c.Set("start_time", time.Now())
        return nil
    }).
    After(func(c *goryuctx.Context) error {
        duration := time.Since(c.Get("start_time").(time.Time))
        log.Printf("%s %s - %v", c.Request.Method, c.Request.URL.Path, duration)
        return nil
    }).
    Build()
```

### 条件付きミドルウェア

```go
maintenanceMiddleware := goryu.NewMiddleware("Maintenance").
    Skip(func(c *goryuctx.Context) bool {
        // Skip for admin users
        return c.Get("user_role") == "admin"
    }).
    Before(func(c *goryuctx.Context) error {
        c.Status(503).JSON(goryuctx.Map{
            "error": "Service under maintenance",
        })
        return nil
    }).
    Build()
```

## その他の機能

ビルダーパターンにより、複雑なミドルウェアの合成が可能となり、ミドルウェアの動作を簡潔で読みやすい形で定義できます。

## API リファレンス

### MiddlewareBuilder のメソッド

- `Before(func(c *goryuctx.Context) error)`: 前処理関数を設定します
- `After(func(c *goryuctx.Context) error)`: 後処理関数を設定します
- `Skip(func(c *goryuctx.Context) bool)`: スキップ条件を設定します
- `OnError(func(c *goryuctx.Context, err error))`: エラーハンドラーを設定します
- `Logger(logger)`: カスタムロガーを設定します
- `Build()`: ミドルウェアをビルドします
- `BuildSimple(func(c *goryuctx.Context))`: エラー処理を伴わないシンプルなミドルウェアをビルドします
