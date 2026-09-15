# Plugins パッケージ

`plugins` パッケージは、Goryu のミドルウェアを設定するための、流暢で型安全なビルダー API を提供します。複雑な設定を簡素化し、環境ごと（開発環境と本番環境）に妥当なデフォルト値を提供します。

## 特徴

- **流暢な API**: 簡単に設定できるチェーン可能なメソッド。
- **型安全性**: 設定オプションに対するコンパイル時のチェック。
- **プリセット**: `Development`、`Production` など向けの組み込み設定。
- **バリデーション**: ビルド前に設定値を自動的に検証します。
- **レジストリ**: プラグインを登録・検出するためのシステム。

## 利用可能なプラグイン

### Logger プラグイン

リクエストロガーを簡単に設定できます。

```go
// Development Logger (Colors, Human-readable time)
app.Use(plugins.NewLoggerBuilder().
    Development().
    Build())

// Production Logger (JSON, No colors, RFC3339 time)
app.Use(plugins.NewLoggerBuilder().
    Production().
    Output(os.Stdout).
    Build())

// Custom Format
app.Use(plugins.NewLoggerBuilder().
    Format("[${status}] ${method} ${path} (${latency})").
    Build())
```

### Recovery プラグイン

パニックリカバリーとスタックトレースを管理します。

```go
// Development (Show stack traces)
app.Use(plugins.NewRecoveryBuilder().
    Development().
    Build())

// Production (JSON response, no stack traces)
app.Use(plugins.NewRecoveryBuilder().
    Production().
    JSONResponse().
    Build())
```

### CORS プラグイン

クロスオリジンリソース共有（CORS）のポリシーを設定します。

```go
// Development (Permissive)
app.Use(plugins.NewCORSBuilder().
    Development().
    Build())

// Production (Restrictive)
app.Use(plugins.NewCORSBuilder().
    Production().
    AllowOrigins("https://example.com").
    AllowMethods("GET", "POST").
    Build())

// Custom API Configuration
app.Use(plugins.NewCORSBuilder().
    AllowOrigins("https://app.example.com").
    AllowMethods("GET", "POST", "PUT", "DELETE").
    AllowHeaders("Authorization", "Content-Type").
    AllowCredentials(true).
    MaxAge(3600).
    Build())
```

### Rate Limit プラグイン

アプリケーションを不正利用から保護します。

```go
// Simple IP-based limit (100 req/min)
app.Use(plugins.NewRateLimitBuilder().
    PerMinute(100).
    ByIP().
    Build())

// API Key-based limit
app.Use(plugins.NewRateLimitBuilder().
    Rate(1000, time.Hour).
    ByAPIKey("X-API-Key").
    JSONResponse().
    Build())

// Presets
app.Use(plugins.NewRateLimitBuilder().Conservative().Build()) // 60/min
app.Use(plugins.NewRateLimitBuilder().Generous().Build())     // 1000/min
```

## プラグインレジストリ

このパッケージには、プラグインを動的に検出・生成するためのレジストリシステムが含まれています。

```go
// List available plugins
plugins := plugins.List()

// Get a builder by name
if builder, ok := plugins.Get("cors"); ok {
    // Cast to specific builder if needed, or use generic interface
    middleware := builder.(plugins.Builder).Build()
    app.Use(middleware)
}
```

## カスタムプラグインの作成

`Builder` インターフェースを実装して登録することで、独自のプラグインを作成できます:

```go
func init() {
    plugins.Register("my-plugin", func() plugins.Builder {
        return NewMyPluginBuilder()
    })
}
```
