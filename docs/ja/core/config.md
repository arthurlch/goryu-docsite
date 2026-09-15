# Goryu の設定管理

Goryu アプリケーション向けの、包括的で柔軟な設定管理システムです。優先順位に基づくマージ、バリデーション、高度な機能を備え、複数の設定ソースをサポートします。

## 特徴

- **複数のソース**: 環境変数、JSON/YAML ファイル、デフォルト値
- **優先順位システム**: 環境変数はファイルを上書きし、ファイルはデフォルト値を上書きします
- **型安全性**: 包括的なバリデーションを備えた強い型付けの設定
- **自動検出**: 一般的な場所にある設定ファイルを自動的に検出
- **流暢なビルダー**: 流暢な API で設定ソースをチェーン
- **フレームワーク統合**: goryu.Config との直接統合
- **データベースサポート**: コネクションプーリングを備えた組み込みのデータベース設定
- **セキュリティ機能**: TLS、CSRF、HSTS、セキュリティヘッダーの設定
- **パフォーマンス制限**: リクエストボディサイズ、同時リクエスト数、ルート数の制限
- **静的ファイル配信**: キャッシュを備えた設定可能な静的ファイル配信
- **ルーターオプション**: 高度なルーティング設定オプション

## クイックスタート

### 基本的な使い方

```go
package main

import (
    "log"
    "github.com/arthurlch/goryu/config"
)

func main() {
    // Load configuration from defaults, files, and environment
    cfg, err := config.LoadConfig()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }
    
    fmt.Printf("Server will run on: %s\n", cfg.GetServerAddress())
}
```

### カスタム設定

```go
// Build configuration from specific sources
cfg, err := config.NewBuilder().
    WithDefaults().                    // Apply defaults first
    WithFile("config.json").           // Override with file
    WithFile("/etc/myapp/config.json"). // Try system config
    WithEnvironment("MYAPP").          // Override with env vars
    Build()
```

## 設定の構造

設定システムは 2 つの主要な設定フォーマットをサポートします。

### コア設定（新しい構造）
```json
{
  "app": {
    "name": "my-goryu-app",
    "version": "1.0.0",
    "environment": "production",
    "log_level": "info",
    "custom": {
      // Add your app-specific configuration here
    }
  },
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "read_timeout": "30s",
    "write_timeout": "30s",
    "shutdown_timeout": "30s",
    "tls": {
      "enabled": false,
      "cert_file": "",
      "key_file": "",
      "auto_tls": false
    }
  },
  "database": {
    "driver": "sqlite3",
    "path": "./app.db",
    "max_open_conns": 25,
    "max_idle_conns": 5,
    "conn_max_lifetime": "1h",
    "conn_max_idle_time": "30m"
  },
  "framework": {
    "server_header": "MyApp/1.0",
    "strict_routing": false,
    "case_sensitive": false,
    "redirect_trailing_slash": true,
    "enable_head_fallback": true,
    "disable_startup_msg": false
  }
}
```

### 高度な設定（ビルダーパターン）
```json
{
  "app": {
    "name": "my-goryu-app",
    "version": "1.0.0",
    "environment": "production",
    "disable_startup_message": false,
    "server_header": "MyApp/1.0"
  },
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "read_timeout": "30s",
    "write_timeout": "30s",
    "idle_timeout": "120s",
    "shutdown_timeout": "30s",
    "max_header_size": 1048576,
    "disable_keepalive": false,
    "tls": {
      "enabled": false,
      "cert_file": "",
      "key_file": "",
      "min_version": "TLS1.2"
    }
  },
  "router": {
    "strict_routing": false,
    "case_sensitive": false,
    "redirect_trailing_slash": true,
    "redirect_fixed_path": true,
    "handle_method_not_allowed": true,
    "handle_options": true,
    "enable_head_fallback": true
  },
  "static": {
    "root": "./public",
    "index": "index.html",
    "browse": false,
    "max_age": "3600s",
    "compress": true,
    "byte_range": true,
    "download": false,
    "cache_duration": "3600s"
  },
  "security": {
    "csrf_protection": true,
    "csrf_token_length": 32,
    "xss_protection": "1; mode=block",
    "content_type_nosniff": true,
    "x_frame_options": "DENY",
    "hsts": {
      "enabled": true,
      "max_age": "31536000s",
      "include_subdomains": true,
      "preload": false
    },
    "allowed_hosts": [],
    "trusted_proxies": []
  },
  "limits": {
    "max_route_depth": 20,
    "max_total_routes": 10000,
    "max_parameters_per_route": 20,
    "max_request_body_size": 10485760,
    "max_multipart_memory": 10485760,
    "max_concurrent_requests": 1000
  }
}
```

### データベース接続の例

**SQLite（シンプル・推奨）**
```json
{
  "database": {
    "driver": "sqlite3",
    "path": "./data/app.db",
    "max_open_conns": 25,
    "max_idle_conns": 5
  }
}
```

**PostgreSQL**
```json
{
  "database": {
    "driver": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "myapp",
    "username": "user",
    "password": "password",
    "ssl_mode": "prefer",
    "max_open_conns": 50,
    "max_idle_conns": 10,
    "conn_max_lifetime": "1h"
  }
}
```

**MySQL**
```json
{
  "database": {
    "driver": "mysql",
    "host": "localhost", 
    "port": 3306,
    "database": "myapp",
    "username": "user",
    "password": "password",
    "charset": "utf8mb4",
    "parse_time": true,
    "max_open_conns": 50,
    "max_idle_conns": 10
  }
}
```

**カスタムアプリ設定**
```json
{
  "app": {
    "custom": {
      "redis": {
        "url": "redis://localhost:6379"
      },
      "api_keys": {
        "stripe": "sk_test_...",
        "sendgrid": "SG..."
      },
      "features": {
        "enable_analytics": true,
        "enable_notifications": false
      }
    }
  }
}
```

## 環境変数

環境変数は `PREFIX_SECTION_FIELD` というパターンを使用します。

```bash
# App configuration
GORYU_APP_NAME=my-service
GORYU_APP_VERSION=2.0.0
GORYU_APP_ENVIRONMENT=production
GORYU_APP_LOG_LEVEL=info

# Server configuration
GORYU_SERVER_HOST=0.0.0.0
GORYU_SERVER_PORT=8080
GORYU_SERVER_READ_TIMEOUT=30s
GORYU_SERVER_WRITE_TIMEOUT=30s

# TLS configuration
GORYU_SERVER_TLS_ENABLED=true
GORYU_SERVER_TLS_CERT_FILE=/path/to/cert.pem
GORYU_SERVER_TLS_KEY_FILE=/path/to/key.pem

# Database configuration
GORYU_DATABASE_DRIVER=postgres
GORYU_DATABASE_HOST=localhost
GORYU_DATABASE_PORT=5432
GORYU_DATABASE_DATABASE=myapp
GORYU_DATABASE_USERNAME=user
GORYU_DATABASE_PASSWORD=secret

# Framework configuration
GORYU_FRAMEWORK_SERVER_HEADER=MyApp/1.0
GORYU_FRAMEWORK_STRICT_ROUTING=false
GORYU_FRAMEWORK_CASE_SENSITIVE=false

# Custom configuration (as JSON)
GORYU_APP_CUSTOM={"api_timeout":"30s","features":{"analytics":true}}
```

## 設定ソースの優先順位

1. **環境変数**（最優先）
2. **設定ファイル**（中程度の優先度）
3. **デフォルト値**（最も低い優先度）

後のソースが前のソースを上書きします。環境変数は常に優先されます。

## ファイルの自動検出

システムは以下の場所から設定ファイルを自動的に探します。

- `./config.json`, `./config.yaml`, `./config.yml`
- `./app.json`, `./app.yaml`, `./app.yml`
- `./config/config.json`, `./config/config.yaml`
- `/etc/goryu/config.json`, `/etc/goryu/config.yaml`

## バリデーション

設定は読み込み時に自動的に検証されます。

```go
cfg, err := config.LoadConfig()
if err != nil {
    // Validation failed - err contains details
    log.Fatalf("Invalid configuration: %v", err)
}
```

一般的なバリデーションルール:
- **Server**: ポートは 1〜65535 でなければならず、タイムアウトは負の値にできません
- **Database**: ドライバーは sqlite3/postgres/mysql のいずれかで、必須フィールドはドライバーによって異なります
- **App**: 環境は development/staging/production のいずれか、ログレベルは debug/info/warn/error のいずれかでなければなりません
- **TLS**: 有効な場合、auto_tls が true でない限り cert/key ファイルが必須です
- **Security**: CSRF トークンの長さは正の値、HSTS の max_age は有効な期間でなければなりません
- **Limits**: すべての制限は正の整数でなければならず、max_idle_conns は max_open_conns を超えられません

## ヘルパーメソッド

```go
cfg, _ := config.LoadConfig()

// Get formatted server address
serverAddr := cfg.GetServerAddress()      // "localhost:8080"

// Convert to Goryu framework config
goryuConfig := cfg.ToGoryuConfig()        // Returns goryu.Config{}

// Export as JSON
jsonStr, _ := cfg.ToJSON()
fmt.Println(jsonStr)

// Access custom configuration
customData := cfg.App.Custom["features"].(map[string]interface{})

// Database helpers
if cfg.Database.Driver != "" {
    connStr := cfg.Database.ConnectionString()
}

// Validation
if err := cfg.Validate(); err != nil {
    log.Fatal("Configuration invalid:", err)
}
```

## ビルダーパターン

```go
// Custom builder with specific sources
cfg, err := config.NewBuilder().
    WithDefaults().                       // Start with defaults
    WithFile("config.json").              // Add file source
    WithConfigDir("/etc/myapp").          // Auto-discover in directory
    WithEnvironment("MYAPP").             // Add environment source
    Build()                               // Build final config
```

## 高度な使い方

### カスタム設定ソース

`Source` インターフェースを実装します。

```go
type Source interface {
    Load() (map[string]interface{}, error)
    Name() string
    Priority() int  // Higher priority overrides lower
}
```

### 環境変数のみの設定

```go
cfg, err := config.LoadConfigFromEnv("MYAPP")
```

### ファイル指定の設定

```go
cfg, err := config.LoadConfigWithFile("production.json")
```

## ベストプラクティス

1. **シークレットには環境変数を使う**: シークレットを設定ファイルに入れないでください
   ```bash
   GORYU_DATABASE_PASSWORD=secret
   GORYU_SERVER_TLS_CERT_FILE=/secure/cert.pem
   GORYU_APP_CUSTOM='{"api_keys":{"stripe":"sk_live_..."}}'
   ```

2. **適切なデフォルト値を設定する**: 開発向けに合理的なデフォルト値を用意しましょう
   ```go
   // Defaults are applied automatically
   cfg, _ := config.LoadConfig()
   // Development defaults: localhost, SQLite, debug logging
   ```

3. **早期に検証する**: アプリケーション起動時に設定を読み込み検証しましょう
   ```go
   func main() {
       cfg, err := config.LoadConfig()
       if err != nil {
           log.Fatalf("Config error: %v", err)
       }
       // Continue with validated config
   }
   ```

4. **フィーチャーフラグを使う**: カスタム設定を通じて機能を制御しましょう
   ```json
   {
     "app": {
       "custom": {
         "features": {
           "enable_analytics": true,
           "enable_notifications": false,
           "enable_beta_features": false
         }
       }
     }
   }
   ```

5. **環境ごとの設定**: 環境ごとに異なる設定ファイルを使いましょう
   ```bash
   # Development
   GORYU_CONFIG_FILE=config.dev.json
   
   # Production  
   GORYU_CONFIG_FILE=config.prod.json
   ```

6. **セキュリティのベストプラクティス**:
   - 本番環境では TLS を有効にする
   - HTTPS サイトでは HSTS を設定する
   - 適切な CORS およびセキュリティヘッダーを設定する
   - 強力な CSRF トークンを使用する
   - リクエストサイズと同時接続数を制限する

7. **データベースのコネクションプーリング**: 負荷に応じて設定しましょう
   ```json
   {
     "database": {
       "max_open_conns": 100,    // High-traffic apps
       "max_idle_conns": 10,     // Keep some connections ready
       "conn_max_lifetime": "1h" // Refresh connections periodically
     }
   }
   ```

## 例

完全に動作する例は `examples/config_example.go` を、設定ファイルのサンプルは `examples/config.json.example` を参照してください。

## 統合例

### 基本的なアプリケーションのセットアップ

```go
package main

import (
    "log"
    
    "github.com/arthurlch/goryu"\n    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/config"
)

func main() {
    // Load configuration
    cfg, err := config.LoadConfig()
    if err != nil {
        log.Fatal("Configuration error:", err)
    }
    
    // Create app with configuration
    app := goryu.New(goryu.Config{
        AppName:           cfg.App.Name,
        ServerHeader:      cfg.Framework.ServerHeader,
        StrictRouting:     cfg.Framework.StrictRouting,
        CaseSensitive:     cfg.Framework.CaseSensitive,
        DisableStartupMsg: cfg.Framework.DisableStartupMessage,
    })
    
    // Configure based on environment
    if cfg.App.Environment == "production" {
        app.Use(goryu.Logger())
        app.Use(goryu.Recover())
    }
    
    // Routes
    app.GET("/", func(c *goryuctx.Context) {
        c.JSON(200, goryuctx.Map{
            "app":         cfg.App.Name,
            "version":     cfg.App.Version,
            "environment": cfg.App.Environment,
        })
    })
    
    // Start server
    log.Printf("Starting %s on %s", cfg.App.Name, cfg.GetServerAddress())
    app.Listen(cfg.GetServerAddress())
}
```

### ビルダーパターンを使った高度なセットアップ

```go
package main

import (
    "log"
    
    "github.com/arthurlch/goryu"\n    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/config/builder"
    "github.com/arthurlch/goryu/middleware/compress"
    "github.com/arthurlch/goryu/middleware/cors"
    "github.com/arthurlch/goryu/middleware/ratelimit"
)

func main() {
    // Load advanced configuration
    cfg, err := builder.NewBuilder().
        WithDefaults().
        WithFile("config.json").
        WithEnvironment("GORYU").
        Build()
    
    if err != nil {
        log.Fatal("Config error:", err)
    }
    
    // Create app
    app := goryu.New()
    
    // Configure middleware based on config
    if cfg.Security.CSRFProtection {
        app.Use(goryu.CSRF())
    }
    
    if cfg.Static.Compress {
        app.Use(compress.New())
    }
    
    // Configure static files
    if cfg.Static.Root != "" {
        app.Static("/", cfg.Static.Root, goryu.Static{
            Compress: cfg.Static.Compress,
            ByteRange: cfg.Static.ByteRange,
            Browse: cfg.Static.Browse,
            Index: cfg.Static.Index,
            MaxAge: int(cfg.Static.MaxAge.Seconds()),
        })
    }
    
    // Configure security headers
    app.Use(func(c *goryuctx.Context) {
        if cfg.Security.ContentTypeNosniff {
            c.SetHeader("X-Content-Type-Options", "nosniff")
        }
        if cfg.Security.XFrameOptions != "" {
            c.SetHeader("X-Frame-Options", cfg.Security.XFrameOptions)
        }
        if cfg.Security.XSSProtection != "" {
            c.SetHeader("X-XSS-Protection", cfg.Security.XSSProtection)
        }
        c.Next()
    })
    
    // Start with TLS if configured
    if cfg.Server.TLS.Enabled {
        log.Fatal(app.ListenTLS(
            cfg.GetServerAddress(),
            cfg.Server.TLS.CertFile,
            cfg.Server.TLS.KeyFile,
        ))
    } else {
        log.Fatal(app.Listen(cfg.GetServerAddress()))
    }
}
```

