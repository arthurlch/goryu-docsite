# OAuth2 / OpenID Connect

`authoidc` は Goryu 向けの OpenID Connect リライングパーティです。PKCE を用いた
認可コードフローを実行し、ID トークンをプロバイダーの JWKS に対して検証し、検証済みの
クレームをアプリに引き渡します。「Google / Okta / Entra ID / Auth0 でサインイン」を
アプリケーションに追加するために使用します。

::: tip 監査済みの暗号処理、独自実装ではない
`authoidc` は `github.com/coreos/go-oidc` と `golang.org/x/oauth2` の上に構築されています。
これらは Go エコシステムが信頼している、監査済みのライブラリと同じものです。ディスカバリ、
JWKS のローテーション、ID トークンの署名検証を担います。`Start` と `Callback` は、すべての
フローで **state**（CSRF）、**nonce**（ID トークンのリプレイ）、**PKCE 検証子**
（コードの傍受）をバインドし検証します。これらはここで再実装されていません。
:::

## 特徴

- **認可コード + PKCE** フローを `x/oauth2` 経由で実行。
- **ID トークンの検証** — 署名、発行者、オーディエンス、有効期限を `go-oidc` がプロバイダーの JWKS に対して確認。
- **CSRF / リプレイ防御** — `state` と `nonce` を短命の HttpOnly かつ `SameSite=Lax` の Cookie にバインドし、コールバック時に検証。
- **検証済みクレーム** — `Subject`、`Email`、`EmailVerified`、`Name` を `OnSuccess` コールバックに引き渡し。
- **独自セッションの利用** — `OnSuccess` により、JWT の発行、セッションの作成、任意のリダイレクトなどを自由に行えます。

## 使い方

### 基本的なセットアップ

```go
import (
    "log"
    "os"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/authoidc"
)

func main() {
    app := goryu.New()

    rp, err := authoidc.New(authoidc.Config{
        Issuer:       "https://accounts.google.com",
        ClientID:     os.Getenv("OIDC_CLIENT_ID"),
        ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
        RedirectURL:  "https://app.example.com/auth/callback",
    })
    if err != nil {
        log.Fatal(err)
    }

    app.GET("/auth/login", rp.Start)
    app.GET("/auth/callback", rp.Callback)

    log.Fatal(app.Listen(":8080"))
}
```

`Start` はユーザーをプロバイダーへリダイレクトします。`Callback` はレスポンスを検証し、
ID トークンを検証し、デフォルトでは `user_id` コンテキストキーに subject を設定して
クレームを JSON として返します。

### 成功時の処理を自分で行う

`OnSuccess` を指定すると、独自のセッションを作成したり独自のトークンを発行したりできます。
検証済みのクレームと生の OAuth2 トークンが渡されます。

```go
import "golang.org/x/oauth2"

rp, err := authoidc.New(authoidc.Config{
    Issuer:       "https://accounts.google.com",
    ClientID:     os.Getenv("OIDC_CLIENT_ID"),
    ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
    RedirectURL:  "https://app.example.com/auth/callback",
    OnSuccess: func(c *goryu.Ctx, claims authoidc.Claims, token *oauth2.Token) {
        if !claims.EmailVerified {
            _ = c.JSON(403, map[string]string{"error": "email not verified"})
            return
        }
        // Look up or create the local user, then start a session / mint a JWT.
        userID := upsertUser(claims.Subject, claims.Email, claims.Name)
        c.Set("user_id", userID)
        _ = c.Redirect(302, "/dashboard")
    },
    OnError: func(c *goryu.Ctx, err error) {
        _ = c.Redirect(302, "/login?error=oidc")
    },
})
```

### カスタムスコープ

デフォルトでは、リライングパーティは `openid`、`email`、`profile` を要求します。
`Scopes` を上書きすることで、より多く（または少なく）要求できます。

```go
rp, _ := authoidc.New(authoidc.Config{
    Issuer:      "https://login.microsoftonline.com/<tenant>/v2.0",
    ClientID:    os.Getenv("OIDC_CLIENT_ID"),
    ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
    RedirectURL: "https://app.example.com/auth/callback",
    Scopes:      []string{"openid", "email", "profile", "offline_access"},
})
```

## 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| Issuer | `string` | OIDC 発行者 URL（ディスカバリに使用）。必須。 | — |
| ClientID | `string` | OAuth2 クライアント ID。必須。 | — |
| ClientSecret | `string` | OAuth2 クライアントシークレット。 | — |
| RedirectURL | `string` | 登録済みのコールバック URL。必須。 | — |
| Scopes | `[]string` | 要求するスコープ | `["openid", "email", "profile"]` |
| CookiePrefix | `string` | フロー用 Cookie の名前空間 | `"oidc"` |
| Insecure | `bool` | フロー用 Cookie を平文 HTTP 上で許可（開発用のみ） | `false` |
| OnSuccess | `func(c *goryu.Ctx, claims Claims, token *oauth2.Token)` | 検証済みクレームとともに呼び出される | `user_id` を設定し、クレームの JSON を返す |
| OnError | `func(c *goryu.Ctx, err error)` | いずれかの失敗時に呼び出される | `401` の JSON エラー |

### Claims

```go
type Claims struct {
    Subject       string // "sub"
    Email         string
    EmailVerified bool
    Name          string
}
```

## フローの安全性が保たれる仕組み

1. **`Start`** はランダムな `state`、`nonce`、PKCE `verifier` を生成し、それぞれを
   短命の HttpOnly かつ `SameSite=Lax` の Cookie にバインドし、`state`、`nonce`、
   S256 コードチャレンジとともにプロバイダーへリダイレクトします。
2. **`Callback`** は返された `state` が Cookie と一致することを検証し（CSRF）、PKCE
   `verifier` を用いてコードを交換し（コード傍受への防御）、ID トークンの署名／発行者／
   オーディエンス／有効期限をプロバイダーの JWKS に対して検証し、ID トークンの `nonce`
   が Cookie と一致することを確認します（リプレイへの防御）。
3. すべてのチェックを通過した後にのみ、クレームがデコードされ `OnSuccess` に渡されます。

::: warning
`Insecure: true` はローカル開発でのみ設定してください。フロー用 Cookie が平文 HTTP 上で
送信されるようになり、`state` / `nonce` / PKCE がネットワーク上の攻撃者にさらされます。
本番環境では常に HTTPS で配信し、`Insecure` は設定しないままにしてください。
:::

## 次のステップ

- [JWT 認証](/ja/middleware/auth) または [セッション](/ja/middleware/session) を使って、OIDC のアイデンティティをアプリのセッションやトークンに変換しましょう。
- [RBAC](/ja/security/rbac) を使って、ロールでルートを保護しましょう。
- [監査ログ](/ja/security/audit-log) を使って、ログインの記録を残しましょう。
