# BasicAuth ミドルウェア

Goryu 向けの堅牢な HTTP Basic 認証ミドルウェアです。安全な bcrypt ハッシュを用いた静的なユーザー設定と、動的な検証ロジックの両方をサポートします。

## 機能

- **デフォルトで安全**: 静的なパスワードには bcrypt ハッシュを強制します。
- **柔軟な検証**: 動的なチェック（例: データベース照会）に対応するカスタム検証関数をサポートします。
- **レート制限**: ブルートフォース攻撃に対する保護機能を内蔵しています。
- **タイミング攻撃への保護**: パスワード検証に定数時間比較を使用します。
- **設定可能なレルム**: カスタム認証レルムをサポートします。

## 使い方

### 静的ユーザー

単純なユースケースでは、ユーザーの静的なマップを定義できます。**注意: パスワードは bcrypt でハッシュ化されている必要があります。**

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/basicauth"
)

func main() {
    app := goryu.New()

    // Helper to generate hash (do not use in production runtime)
    hash, _ := basicauth.HashPassword("secret")

    app.Use(basicauth.WithUsers(map[string]string{
        "admin": hash,
    }))

    app.GET("/", func(c *goryuctx.Context) {
        c.Status(200).String("Welcome Admin!")
    })

    app.Run(":8080")
}
```

### カスタム検証関数

より複雑なシナリオでは、カスタム検証関数を使用します。

```go
app.Use(basicauth.WithValidator(func(username, password string) bool {
    // Check credentials against database, LDAP, etc.
    if username == "john" && password == "doe" {
        return true
    }
    return false
}))
```

### 高度な設定

完全に制御するには `Config` 構造体を使用します。

```go
app.Use(basicauth.New(basicauth.Config{
    Realm: "My Secure App",
    MaxAttempts: 3,
    RateWindow: 10 * time.Minute,
    Validator: myCustomValidator,
}))
```

## セキュリティに関する注意

静的な設定を使用する場合、`basicauth` はパスワードが bcrypt でハッシュ化されている（`$2a$`、`$2b$`、または `$2y$` で始まる）ことを**必須**とします。設定内に平文のパスワードがあると、起動時にミドルウェアの検証が失敗するため、認証情報を誤って公開してしまうことを防げます。
