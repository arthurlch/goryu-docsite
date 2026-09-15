# Base ミドルウェアパッケージ

`base` パッケージは、Goryu で一貫性と堅牢性を備えたミドルウェアを作成するための基礎的な構成要素を提供します。設定、ロギング、エラー処理といった共通の関心事を処理するため、開発者はミドルウェア固有のロジックに集中できます。

## 機能

- **標準設定**: すべてのミドルウェアが埋め込める `BaseConfig` 構造体。
- **統一されたロギング**: `DefaultLogger` を通じた一貫したロギングインターフェース。
- **エラー処理**: `DefaultErrorHandler` による一元化されたエラー処理。
- **ミドルウェアヘルパー**: `StandardMiddleware` や `PostProcessMiddleware` といったヘルパー関数により定型コードを削減。

## 使い方

### カスタムミドルウェアの作成

以下は `base` パッケージを使ってカスタムミドルウェアを作成する方法です。

```go
package mymiddleware

import (
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/base"
)

// 1. Define your Config struct embedding base.BaseConfig
type Config struct {
    base.BaseConfig
    MyOption string
}

// 2. Implement the Configure method
func (c *Config) Configure(baseConfig *base.BaseConfig) {
    c.BaseConfig = *baseConfig
}

// 3. Implement the Validate method
func (c *Config) Validate() error {
    if c.MyOption == "" {
        return base.NewConfigError("MyOption", "cannot be empty")
    }
    return nil
}

// 4. Create the constructor
func New(config Config) func(next goryuctx.HandlerFunc) goryuctx.HandlerFunc {
    // Validate config
    if err := config.Validate(); err != nil {
        return func(next goryuctx.HandlerFunc) goryuctx.HandlerFunc {
            return func(c *goryuctx.Context) {
                base.DefaultErrorHandler(c, err, "MyMiddleware")
            }
        }
    }

    // Define the handler logic
    handler := func(c *goryuctx.Context) error {
        // Your middleware logic here
        config.Logger.Printf("Executing MyMiddleware with option: %s", config.MyOption)
        return nil
    }

    // Use the helper to wrap it
    return base.StandardMiddleware("MyMiddleware", config.BaseConfig, handler)
}
```

### 後処理ミドルウェア

ミドルウェアが次のハンドラーの実行*後*にロジックを実行する必要がある場合（例: レスポンス時間のロギング）は、`PostProcessMiddleware` を使用します。

```go
func NewTimer(config Config) func(next goryuctx.HandlerFunc) goryuctx.HandlerFunc {
    preHandler := func(c *goryuctx.Context) error {
        c.Set("start_time", time.Now())
        return nil
    }

    postHandler := func(c *goryuctx.Context) error {
        start := c.Get("start_time").(time.Time)
        duration := time.Since(start)
        config.Logger.Printf("Request took %v", duration)
        return nil
    }

    return base.PostProcessMiddleware("Timer", config.BaseConfig, preHandler, postHandler)
}
```
