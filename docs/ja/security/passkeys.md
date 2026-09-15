# パスキー / WebAuthn

`passkey` は、WebAuthn / パスキーを用いて、パスワードレスかつフィッシング耐性のある
認証を Goryu に追加します。4 つの begin/finish エンドポイントを公開し、ユーザーの
検索と認証情報の保存は `UserStore` を通じてアプリケーションに委ねます。

::: tip 監査済みの暗号処理、独自実装ではない
`passkey` は `github.com/go-webauthn/webauthn` の上に構築されています。このライブラリが
CBOR/COSE のデコード、アテステーション、アサーションの検証、署名カウンターを処理します。
Goryu はこれらを一切再実装していません。
:::

## 特徴

- **登録およびログインのセレモニー** — `BeginRegistration` / `FinishRegistration` と `BeginLogin` / `FinishLogin`。
- **差し替え可能なストレージ** — `UserStore` を実装して、現在のユーザーの解決と認証情報の永続化を行います。
- **クローン検出** — 署名カウンターは毎回のログインで検証され、`UpdateCredential` がそれを永続化します。
- **サーバーサイドのセレモニー状態** — セレモニーごとのチャレンジはサーバーサイドに保存され、短命の HttpOnly Cookie によって参照されます。
- **独自セッションの利用** — `OnLogin` はログイン成功後に実行されるため、セッションの開始やトークンの発行を行えます。

## 使い方

### エンドポイントの配線

```go
import (
    "log"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/passkey"
)

func main() {
    app := goryu.New()

    pk, err := passkey.New(passkey.Config{
        RPID:          "example.com",
        RPDisplayName: "Example",
        RPOrigins:     []string{"https://example.com"},
        Users:         &myUserStore{},
        OnLogin: func(c *goryu.Ctx, user passkey.User) {
            c.Set("user_id", string(user.WebAuthnID()))
            _ = c.JSON(200, map[string]string{"status": "logged in"})
        },
    })
    if err != nil {
        log.Fatal(err)
    }

    app.POST("/webauthn/register/begin", pk.BeginRegistration)
    app.POST("/webauthn/register/finish", pk.FinishRegistration)
    app.POST("/webauthn/login/begin", pk.BeginLogin)
    app.POST("/webauthn/login/finish", pk.FinishLogin)

    log.Fatal(app.Listen(":8080"))
}
```

`BeginRegistration` / `BeginLogin` は、ブラウザの `navigator.credentials` 呼び出し用に
WebAuthn のオプションを JSON として返します。finish エンドポイントは、リクエストボディから
ブラウザのレスポンスを読み取ります。

### UserStore の実装

`passkey.User` は `webauthn.User` であり、`passkey.Credential` は `webauthn.Credential` です。
ストアは、セレモニーの対象ユーザーを解決し、認証情報を永続化します。

```go
type UserStore interface {
    User(c *goryu.Ctx) (passkey.User, error)
    AddCredential(user passkey.User, cred *passkey.Credential) error
    UpdateCredential(user passkey.User, cred *passkey.Credential) error
}
```

データベースを裏付けとした実装の概略は次のとおりです。

```go
type myUserStore struct {
    db *sql.DB
}

// User resolves who the ceremony is for — e.g. from a pre-auth cookie,
// a username in the request, or an existing session.
func (s *myUserStore) User(c *goryu.Ctx) (passkey.User, error) {
    username := c.Query("username")
    row, err := loadUser(s.db, username) // returns a type implementing webauthn.User
    if err != nil {
        return nil, err
    }
    return row, nil
}

// AddCredential stores a freshly-registered credential for the user.
func (s *myUserStore) AddCredential(user passkey.User, cred *passkey.Credential) error {
    return insertCredential(s.db, user.WebAuthnID(), cred)
}

// UpdateCredential persists the credential after a login — critically the sign
// counter, which must be stored to detect cloned authenticators.
func (s *myUserStore) UpdateCredential(user passkey.User, cred *passkey.Credential) error {
    return saveCredential(s.db, user.WebAuthnID(), cred)
}
```

ユーザー型は `webauthn.User` インターフェース（`WebAuthnID`、`WebAuthnName`、
`WebAuthnDisplayName`、`WebAuthnCredentials` など）を実装する必要があります。

## 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| RPID | `string` | リライングパーティ ID（あなたのドメイン、例: `example.com`） | — |
| RPDisplayName | `string` | オーセンティケーターに表示される人間可読な RP 名 | — |
| RPOrigins | `[]string` | 許可するオリジン（例: `https://example.com`） | — |
| Users | `UserStore` | ユーザーを解決し、認証情報を永続化する。必須。 | — |
| Sessions | `SessionStore` | セレモニーごとのチャレンジストア | インメモリ（プロセスローカル） |
| Insecure | `bool` | セレモニー Cookie を平文 HTTP 上で許可（開発用のみ） | `false` |
| OnLogin | `func(c *goryu.Ctx, user User)` | ログイン成功後に呼び出される | `200` の JSON `{"status":"ok"}` |

## クローン検出: 署名カウンターを永続化する

WebAuthn のオーセンティケーターは単調増加する **署名カウンター** を保持します。
ログインのたびに、ライブラリは提示されたカウンターを保存済みのものと比較します。
カウンターが増加していない場合は、クローンされたオーセンティケーターであることを示します。

::: warning UpdateCredential はカウンターを永続化しなければならない
`FinishLogin` は更新された認証情報とともに `UpdateCredential` を呼び出します。あなたの
`UpdateCredential` が認証情報（特にその署名カウンター）を永続化しない場合、クローン検出は
静かに無効化されます。必ず永続ストレージに書き戻してください。
:::

## マルチインスタンス構成

::: warning デフォルトの SessionStore はプロセスローカル
セレモニーごとのチャレンジは begin ステップと finish ステップの間に存在します。デフォルトの
`SessionStore` は、短命の Cookie をキーとした **インメモリのプロセスローカル** ストアです。
複数のインスタンスを実行していて（かつリクエストがスティッキーでない）場合、あるインスタンスで
開始されたログインを別のインスタンスで完了することはできません。

マルチインスタンス構成では、Redis、データベース、その他の共有ストアを裏付けとした独自の
`SessionStore` を用意してください。

```go
type SessionStore interface {
    Save(c *goryu.Ctx, data *webauthn.SessionData) error
    Load(c *goryu.Ctx) (*webauthn.SessionData, error)
    Clear(c *goryu.Ctx)
}
```

実装は並行利用に対して安全でなければなりません。
:::

::: warning
`Insecure: true` はローカル開発でのみ設定してください。セレモニー Cookie が平文 HTTP 上で
許可されます。なお、WebAuthn 自体は、いずれにせよブラウザ上でセキュアなコンテキスト
（HTTPS または `localhost`）を必要とします。
:::

## 次のステップ

- [セッション](/ja/middleware/session) または [JWT 認証](/ja/middleware/auth) を使って、パスキーによるログイン成功をアプリのセッションやトークンに変換しましょう。
- [RBAC](/ja/security/rbac) を使って、ロールでルートを保護しましょう。
