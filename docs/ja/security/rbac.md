# RBAC

`rbac` ミドルウェアは、ルートごとのロールベースアクセス制御を提供します。認証後に
呼び出し元のロールを一度セットし、その後 `Require` または `RequireAll` でルートを
保護します。

## 特徴

- **ルートごとのガード** — 個々のルートやグループにロールチェックを付与します。
- **any-of と all-of** — `Require` は列挙したロールのいずれかを許可し、`RequireAll` はそのすべてを要求します。
- **差し替え可能なロールソース** — ロールをコンテキスト（デフォルト）、JWT、または `RolesFunc` を介して任意の場所から読み取れます。
- **カスタム拒否** — `Forbidden` を使って `403` レスポンスを上書きできます。
- **デフォルトで拒否** — ロールを持たない呼び出し元は常に拒否されます。

## 使い方

### ロールを読み込み、ルートを保護する

認証後に呼び出し元のロールを一度セットし、その後ルートグループを保護します。

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/rbac"
)

func main() {
    app := goryu.New()

    // After auth, load the caller's roles into the context.
    app.Use(func(next goryu.HandlerFunc) goryu.HandlerFunc {
        return func(c *goryu.Ctx) {
            rbac.SetRoles(c, loadRolesFor(c)...)
            next(c)
        }
    })

    // Any of the listed roles.
    app.Group("/admin", rbac.Require("admin"))

    // All of the listed roles.
    app.Group("/billing", rbac.RequireAll("admin", "billing"))

    log.Fatal(app.Listen(":8080"))
}
```

### 後続でロールを読み取る

ハンドラーは `GetRoles` で保存済みのロールを読み取れます。

```go
app.GET("/me", func(c *goryu.Ctx) {
    roles := rbac.GetRoles(c) // []string
    _ = c.JSON(200, map[string]any{"roles": roles})
})
```

### カスタムのロールソースと拒否レスポンス

より細かく制御したい場合は、`New` で `Enforcer` を構築します。これにより、コンテキスト
以外の場所からロールを取得したり（例: JWT からデコードする）、拒否レスポンスを
カスタマイズしたりできます。

```go
guard := rbac.New(rbac.Config{
    RolesFunc: func(c *goryu.Ctx) []string { return rolesFromJWT(c) },
    Forbidden: func(c *goryu.Ctx) {
        _ = c.Status(403).JSON(403, map[string]string{"error": "insufficient role"})
    },
})

app.Group("/admin", guard.Require("admin"))
app.Group("/reports", guard.RequireAll("admin", "auditor"))
```

## API

| 関数 | 説明 |
|----------|-------------|
| `SetRoles(c, roles...)` | 後続のチェック用に呼び出し元のロールを保存 |
| `GetRoles(c) []string` | 保存済みのロールを読み取る |
| `Require(roles...)` | 呼び出し元がロールの **いずれか** を持つ場合に許可 |
| `RequireAll(roles...)` | 呼び出し元が **すべての** ロールを持つ場合にのみ許可 |
| `New(Config) *Enforcer` | カスタムの `RolesFunc` / `Forbidden` を持つエンフォーサーを構築 |

### 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| RolesFunc | `func(c *goryu.Ctx) []string` | ロールの取得元 | `GetRoles`（コンテキストキー） |
| Forbidden | `func(c *goryu.Ctx)` | チェック失敗時のレスポンス | `403` の JSON `{"error":"forbidden"}` |

::: tip
パッケージレベルの `Require` と `RequireAll` は、`SetRoles` を介してコンテキストから
ロールを読み取るデフォルトのエンフォーサーを使用します。カスタムのロールソースや拒否
レスポンスが必要な場合にのみ `rbac.New` を利用してください。
:::

::: warning デフォルトで拒否
ロールを持たない呼び出し元は常に拒否されます。認証ミドルウェアがガードの **前** に
`SetRoles` を実行する（または `RolesFunc` がロールを返す）ことを必ず確認してください。
そうでなければ、すべてのリクエストが `403` で拒否されます。
:::

## 次のステップ

- まず [JWT 認証](/ja/middleware/auth)、[セッション](/ja/middleware/session)、または [OAuth2 / OIDC](/ja/security/oidc) でアイデンティティを確立しましょう。
- [監査ログ](/ja/security/audit-log) を使って、認可の結果を記録しましょう。
