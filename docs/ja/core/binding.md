# バインディングとバリデーション

Goryu は、単一の呼び出しで受信リクエストを型付きの Go の値に変換します。`goryu.Bind[T]` はリクエストボディ（またはクエリ文字列）を読み取り、`Content-Type` に基づいて構造体へデコードし、構造体が `Validator` インターフェースを実装している場合はバリデーションロジックを実行します。

## 特徴

- **ジェネリックバインディング**: `goryu.Bind[T]` は完全に型付けされた `T` を返し、手動での確保は不要です。
- **Content-Type を認識**: JSON パーサーまたはフォーム／クエリパーサーを自動的に選択します。
- **自己検証する構造体**: `Validate() error` を実装すると、パースが成功するたびに実行されます。
- **デフォルトで安全**: JSON ボディは 1MB に制限され、未知のフィールドは拒否されます。
- **クエリとフォームのサポート**: `GET`／`DELETE` リクエストやフォーム送信は、`query` タグを使ってクエリ文字列からバインドされます。

## 使い方

### 基本的なバインディング

`goryu.Bind[T]` を使ってリクエストを構造体へデコードします。

```go
import "github.com/arthurlch/goryu"

type CreateUser struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

app.Post("/users", func(c *goryu.Ctx) {
    user, err := goryu.Bind[CreateUser](c)
    if err != nil {
        c.Status(http.StatusBadRequest).JSON(map[string]string{"error": err.Error()})
        return
    }

    c.Status(http.StatusCreated).JSON(user)
})
```

`Bind[T]` は `c.BodyParser` の薄いラッパーです。

```go
func Bind[T any](c *goryu.Ctx) (T, error) {
    var v T
    err := c.BodyParser(&v)
    return v, err
}
```

既に値を用意している場合は、代わりに `c.BodyParser(&v)` を直接呼び出すこともできます。

### BodyParser がパーサーを選択する仕組み

`BodyParser` は、リクエストの `Content-Type` ヘッダー（およびフォールバックとして HTTP メソッド）からデコード戦略を選択します。

| Content-Type / メソッド | 使用するパーサー | 読み取り元 |
|-----------------------|-------------|------------|
| `application/json` | `BindJSON` | リクエストボディ（JSON） |
| `application/x-www-form-urlencoded` | `QueryParser` | フォーム値 |
| `multipart/form-data` | `QueryParser` | フォーム値 |
| `GET` または `DELETE`（Content-Type の有無を問わない） | `QueryParser` | クエリ文字列 |
| それ以外 | — | `unsupported content-type` エラーを返す |

JSON パス（`BindJSON`）は構造体の `json` タグを使ってデコードします。フォームおよびクエリパス（`QueryParser`）は構造体の `query` タグを使ってデコードします。

```go
type ListParams struct {
    Page    int    `query:"page"`
    Limit   int    `query:"limit"`
    Search  string `query:"q"`
    Active  bool   `query:"active"`
}

app.Get("/users", func(c *goryu.Ctx) {
    params, err := goryu.Bind[ListParams](c)
    if err != nil {
        c.Status(http.StatusBadRequest).JSON(map[string]string{"error": err.Error()})
        return
    }
    // GET /users?page=2&limit=20&q=alice&active=true
    c.JSON(params)
})
```

::: tip
`QueryParser` は `string`、整数型、および `bool` のフィールドをサポートします。整数はフィールドの実際のビット幅でパースされるため、範囲外の値は暗黙的にラップされることなく拒否されます。空のクエリ値はスキップされ、フィールドはゼロ値のまま残ります。
:::

### Validator インターフェース

`Validator` インターフェースを実装した構造体は、パースが成功した後に `Validate()` メソッドが自動的に呼び出されます。これは JSON だけでなく、**すべての** コンテンツタイプに対して行われます。

```go
type Validator interface {
    Validate() error
}
```

構造体に実装してビジネスルールを強制します。

```go
import (
    "errors"
    "strings"
)

type CreateUser struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

func (u CreateUser) Validate() error {
    if strings.TrimSpace(u.Name) == "" {
        return errors.New("name is required")
    }
    if !strings.Contains(u.Email, "@") {
        return errors.New("email is invalid")
    }
    if u.Age < 0 {
        return errors.New("age must be positive")
    }
    return nil
}
```

`Validate()` がエラーを返した場合、そのエラーは `Bind` / `BodyParser` から返され、以降の処理は行われません。

### 完全なリクエストハンドラー

まとめると、バインド、バリデーション、レスポンスの一連の流れは次のようになります。

```go
import (
    "errors"
    "net/http"
    "strings"

    "github.com/arthurlch/goryu"
)

type CreateUser struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

func (u CreateUser) Validate() error {
    if strings.TrimSpace(u.Name) == "" {
        return errors.New("name is required")
    }
    if !strings.Contains(u.Email, "@") {
        return errors.New("email is invalid")
    }
    return nil
}

func main() {
    app := goryu.New()

    app.Post("/users", func(c *goryu.Ctx) {
        // Parses JSON, then runs CreateUser.Validate().
        user, err := goryu.Bind[CreateUser](c)
        if err != nil {
            c.Status(http.StatusBadRequest).JSON(map[string]string{
                "error": err.Error(),
            })
            return
        }

        // user is fully populated and validated here.
        c.Status(http.StatusCreated).JSON(map[string]any{
            "message": "user created",
            "user":    user,
        })
    })

    app.Listen(":8080")
}
```

## JSON の安全性に関する制限

JSON パーサーは 2 つの保護を自動的に適用します。

- **1MB のボディ制限** — 1MB を超える JSON ペイロードは拒否されます。これはメモリ枯渇（DoS）攻撃を防ぐためのものです。より大きな非 JSON ボディは、フレームワークが別途持つ 10MB のリーダーを使用します。
- **`DisallowUnknownFields`** — JSON ボディ内で構造体のフィールドに対応しないフィールドがあると、デコードエラーになります。これによりタイプミスを検出し、クライアントが予期しないデータを紛れ込ませるのを防ぎます。

::: warning
未知のフィールドが拒否されるため、構造体で宣言していないキーを含むリクエストは失敗します。クライアントが送信する可能性のあるすべてのフィールドに対応する `json` タグ付きフィールドを構造体に用意する（あるいはクライアントがそれを省略する）ようにしてください。
:::

::: tip
`BindJSON` は `Content-Type` が `application/json` で始まることを要求します。そのヘッダーなしで送信された JSON ボディは JSON としてパースされず、フォーム／クエリパスに流れるか、unsupported-content-type エラーを返します。
:::

## 関連項目

- [JSON Schema](/ja/core/schema) — 同じ構造体から JSON Schema を生成し、バリデーションのドキュメント、`/schema` エンドポイント、LLM の構造化出力に利用できます。
- [Context](/ja/core/context) — `BodyParser`、`QueryParser`、`BindJSON` を支えるリクエスト／レスポンスオブジェクトです。
