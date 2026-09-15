# CSRF ミドルウェア

Goryu 向けの堅牢なクロスサイトリクエストフォージェリ（CSRF）保護ミドルウェアです。ダブルサブミットクッキーパターンを実装し、アプリケーションを CSRF 攻撃から保護します。

## 機能

- **ダブルサブミットクッキーパターン**: ステートレスでスケーラブルな保護。
- **安全なデフォルト値**: 暗号論的に強力な 32 バイトのトークンを生成します。
- **クッキーのセキュリティ**: `HttpOnly`、`Secure`、`SameSite` の各属性をサポートします。
- **安全なメソッド**: 安全な HTTP メソッド（GET、HEAD、OPTIONS）に対する検証を自動的にスキップします。
- **カスタマイズ可能**: ヘッダー名、クッキー名、トークンのプロパティを設定できます。

## 使い方

### 基本的なセットアップ

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/csrf"
)

func main() {
    app := goryu.New()

    // Apply globally
    app.Use(csrf.Default())

    app.POST("/submit", func(c *goryuctx.Context) {
        c.Status(200).String("CSRF check passed!")
    })

    app.Run(":8080")
}
```

### クライアント側の統合

このミドルウェアは、安全なリクエスト（GET、HEAD など）に対して `X-CSRF-Token` ヘッダーと `csrf-token` クッキーを設定します。フロントエンドのクライアントはこのトークンを読み取り、以降の安全でないリクエスト（POST、PUT、DELETE）のヘッダーに含める必要があります。

**例（JavaScript）:**

```javascript
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf-token='))
  .split('=')[1];

fetch('/submit', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({ data: 'value' })
});
```

### 高度な設定

```go
app.Use(csrf.New(csrf.Config{
    TokenHeader: "X-XSRF-TOKEN",
    TokenCookie: "XSRF-TOKEN",
    TokenLength: 64,
    TokenExpiry: 24 * time.Hour,
    Secure:      true, // Set to true in production (requires HTTPS)
    SameSite:    http.SameSiteStrictMode,
}))
```

## 仕組み

1.  **安全なリクエスト（GET など）**: このミドルウェアは新しいランダムなトークンを生成し、クッキーとレスポンスヘッダーの両方に設定します。
2.  **安全でないリクエスト（POST など）**: このミドルウェアは、リクエストヘッダーとクッキーの両方にトークンが存在するかを確認します。その後、両者を暗号論的に比較します。一致すればリクエストは許可され、一致しなければ `403 Forbidden` で拒否されます。

## セキュリティに関する注意

- **HTTPS が必要**: `Secure` クッキー属性を機能させるには、アプリケーションが HTTPS 経由で提供されている必要があります。
- **サブドメイン**: API とフロントエンドが異なるサブドメインにある場合は、`SameSite` および `Domain` クッキー属性が正しく設定されていることを確認してください。
