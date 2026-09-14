# セキュリティ

Goryu はデフォルトで安全です。このフレームワークは、完全な認証・認可スタック
— JWT トークン、サーバーサイドセッション、OAuth2/OIDC、パスキー、
ロールチェック、そして監査証跡 — を、自前実装の暗号ではなく監査済みのライブラリの上に
構築して同梱しています。このページでは各パーツを整理し、適切なものを選ぶ手助けをします。

## 特徴

- **JWT 認証** — パスワード変更による失効に対応した、ステートレスなアクセス/リフレッシュトークン。[JWT 認証](/ja/middleware/auth) を参照してください。
- **サーバーサイドセッション** — 暗号化された Cookie、アイドルタイムアウト、フィンガープリンティング、そしてセッションハイジャックの検知。[セッション](/ja/middleware/session) を参照してください。
- **OAuth2 / OIDC** — `coreos/go-oidc` と `x/oauth2` の上に構築された OpenID Connect リライングパーティ（認可コード + PKCE）。[OAuth2 / OIDC](/ja/security/oidc) を参照してください。
- **パスキー / WebAuthn** — `go-webauthn` の上に構築された、クローン検知付きのパスワードレス認証。[パスキー](/ja/security/passkeys) を参照してください。
- **RBAC** — ルート単位のロールチェック（`Require` / `RequireAll`）。[RBAC](/ja/security/rbac) を参照してください。
- **監査ログ** — 差し替え可能なシンクに書き出されるアクセス監査証跡（誰が、何を、いつ、結果は）。[監査ログ](/ja/security/audit-log) を参照してください。
- **security.txt** — `/.well-known/security.txt` で提供される RFC 9116 の開示ポリシー。[security.txt](/ja/security/security-txt) を参照してください。
- **CORS** — クロスオリジンリクエストのポリシー。[CORS](/ja/middleware/cors) を参照してください。
- **CSRF** — クロスサイトリクエストフォージェリ対策。[CSRF](/ja/middleware/csrf) を参照してください。
- **セキュアヘッダー** — HSTS、`X-Frame-Options`、`X-Content-Type-Options` など。[セキュアヘッダー](/ja/middleware/secure) を参照してください。
- **セキュア Cookie** — 署名済み/暗号化された Cookie ヘルパー。[セキュア Cookie](/ja/middleware/secure_cookie) を参照してください。
- **TLS リダイレクト** と **トラストプロキシ** — HTTPS の強制、およびプロキシ背後での正しいクライアント IP。[TLS リダイレクト](/ja/middleware/tls_redirect) と [トラストプロキシ](/ja/middleware/trustproxy) を参照してください。

## JWT ↔ セッションを統合する失効の接合点

JWT 認証とサーバーサイドセッションは独立した仕組みですが、Goryu はそれらを
**共有された失効ポイント** に配線します。すなわち、パスワードの変更やリセットが **両方** を無効化します。

認証サービスは、ユーザーのパスワードが最後に変更された時刻を記録します
（`AuthService.PasswordChangedAt(userID)`）。JWT の検証はすでに、その時刻より前に
発行されたトークンをすべて拒否します。同じ保証をセッションにも拡張するには、素の
セッションミドルウェアの代わりに統合ミドルウェアを使います。

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/session"
)

func main() {
    app := goryu.New()

    // Wires an encrypted session store, JWT auth, and the shared-invalidation
    // session middleware in one call.
    authService, integration := session.CreateIntegratedAuthSetup(
        app,
        jwtSecret,   // signs JWTs
        sessionKey,  // encrypts session cookies
    )

    _ = authService
    _ = integration
}
```

鍵となるのは `AuthIntegration.SessionAuthMiddleware()` です。単体の
`session.SessionAuthMiddleware` とは異なり、これは `PasswordChangedAt` を参照し、
`login_time` が最後のパスワード変更より前のセッションをすべて拒否します。

```go
// Shared invalidation: rejects sessions created before the last password change.
app.Use(integration.SessionAuthMiddleware())

// Identity only: does NOT consult password-change revocation.
app.Use(session.SessionAuthMiddleware(sessionConfig))
```

::: warning 仕組みを混在させる場合
同じルートに JWT とセッションを重ねる場合は、
`AuthIntegration.SessionAuthMiddleware()` を使ってください。素の
`session.SessionAuthMiddleware` はアイデンティティを確立するだけです。「すべての場所からログアウト」する
パスワードリセットは JWT を無効化しますが、それらのセッションは有効なまま残ってしまいます。
:::

::: tip
`AuthIntegration.SessionAuthMiddleware()` は、30 分のアイドルタイムアウトと
（ストアでフィンガープリンティングが有効な場合は）セッションハイジャックの検知も強制します。
:::

## どの認証を使うべきか

| シナリオ | 推奨される仕組み |
|----------|-----------------------|
| 公開 API / モバイル / API を利用する SPA | [JWT 認証](/ja/middleware/auth) — ステートレスで、サーバー状態が不要 |
| 従来型のサーバーレンダリング Web アプリ | [セッション](/ja/middleware/session) — 暗号化 Cookie で、失効が容易 |
| 「Google / Okta / Entra ID でサインイン」 | [OAuth2 / OIDC](/ja/security/oidc) — アイデンティティをプロバイダに委任 |
| パスワードレス / フィッシング耐性のあるログイン | [パスキー](/ja/security/passkeys) — WebAuthn クレデンシャル |
| API トークンと Web セッションの両方が必要 | 失効を共有するため `AuthIntegration.SessionAuthMiddleware()` 経由のセッション |

何を選ぶにせよ、[RBAC](/ja/security/rbac) で **認可** を重ね、[監査証跡](/ja/security/audit-log) を
残してください。ルートグループごとに主要な仕組みは 1 つに絞ることをおすすめします。どうしても
混在させる必要がある場合は、上で示したように両側で失効を配線してください。

::: tip 1 つのアイデンティティキー
これらの仕組みはすべて `user_id` コンテキストキーに収束します。RBAC のロール読み込み、
監査ログの `UserIDFunc`、そして OIDC の `OnSuccess` はいずれもそれを読み書きするため、
各パーツは追加の接着コードなしで組み合わさります。
:::
