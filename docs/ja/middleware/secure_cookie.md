# SecureCookie Middleware

AES-256-GCM を使用して、暗号化および認証されたデータを Cookie に保存するためのミドルウェアです。Cookie のデータがクライアントによって読み取られたり改ざんされたりしないことを保証します。

## 機能

- **暗号化**: 認証付き暗号化に AES-256-GCM を使用します。
- **改ざん防止**: GCM の認証タグを使用してデータの整合性を保証します。
- **コンテキスト統合**: 簡単に使える `Set`、`Get`、`Clear` ヘルパー関数を提供します。
- **安全なデフォルト**: `HttpOnly`、`Secure`、`SameSite` 属性を強制します。
- **自動復号**: Cookie のデータを復号し、リクエストコンテキストで利用できるようにします。

## 使い方

### 基本的なセットアップ

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/secure_cookie"
)

func main() {
    app := goryu.New()

    // 32-byte hex-encoded key (64 hex characters)
    // Generate one using: openssl rand -hex 32
    secretKey := "a1b2c3d4e5f6..." 

    app.Use(secure_cookie.Default(secretKey, "my-secure-session"))

    app.GET("/login", func(c *goryuctx.Context) error {
        // Store sensitive data
        err := secure_cookie.Set(c, map[string]string{
            "user_id": "12345",
            "role":    "admin",
        })
        return c.String(200, "Logged in")
    })

    app.GET("/profile", func(c *goryuctx.Context) error {
        // Retrieve data
        data, err := secure_cookie.Get(c)
        if err != nil {
            return c.String(401, "Not logged in")
        }
        return c.JSON(200, data)
    })

    app.GET("/logout", func(c *goryuctx.Context) error {
        // Clear cookie
        secure_cookie.Clear(c)
        return c.String(200, "Logged out")
    })

    app.Run(":8080")
}
```

### 高度な設定

```go
app.Use(secure_cookie.New(secure_cookie.Config{
    HexKey:     "your-64-char-hex-key",
    CookieName: "session_id",
    CookiePath: "/",
    CookieTTL:  24 * time.Hour,
    Secure:     true,
    HttpOnly:   true,
    SameSite:   http.SameSiteStrictMode,
}))
```

## セキュリティに関する注意

- **鍵の管理**: `HexKey` は、32 バイトの鍵を表す 64 文字の 16 進文字列でなければなりません。この鍵は秘密に保ち、漏洩した場合はローテーションしてください。
- **Cookie のサイズ**: Cookie にはサイズ制限があります（通常 4KB）。暗号化はオーバーヘッド（IV + 認証タグ + Base64）を追加するため、大量のデータを保存することは避けてください。
