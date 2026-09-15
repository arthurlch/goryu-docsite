# JSON Schema

Goryu は、リフレクションを使って Go の型から直接 [JSON Schema](https://json-schema.org/)（draft 2020-12）を生成できます。これは API のドキュメント化、`/schema` エンドポイントの提供、そして LLM が期待する構造化出力／関数呼び出しのスキーマの生成に役立ちます。しかもすべて、リクエストのバインドに既に使っているのと同じ構造体から生成されます。

## 特徴

- **Go の型から生成**: `goryu.Schema[T]()` は任意の構造体からスキーマを構築し、手書きの JSON は不要です。
- **Draft 2020-12**: `Schema[T]` は `$schema` の方言識別子を含みます。
- **豊富な制約**: `jsonschema` 構造体タグでフィールドを記述できます（説明、フォーマット、列挙、範囲、長さ、パターンなど）。
- **スマートな `required`**: `omitempty` やポインタかどうかから導出され、明示的な上書きも可能です。
- **実際の型に対応**: ネストした構造体、埋め込み構造体、スライス、マップ、ポインタ、`time.Time`、`[]byte` を扱い、再帰保護も備えています。

## 使い方

### スキーマの生成

`goryu.Schema[T]()` は、JSON としてシリアライズできる `map[string]any` を返します。

```go
import "github.com/arthurlch/goryu"

type User struct {
    Name  string `json:"name"`
    Email string `json:"email" jsonschema:"format=email"`
    Age   int    `json:"age" jsonschema:"minimum=0,maximum=130"`
}

schema := goryu.Schema[User]()
```

これは次を生成します。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name":  { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "age":   { "type": "integer", "minimum": 0, "maximum": 130 }
  },
  "required": ["name", "email", "age"]
}
```

コンパイル時の型パラメータの代わりに `reflect.Type` を持っている場合は、`goryu.SchemaOf(t)` を使用します。これは同じマップを返しますが、`$schema` キーを**含みません**。

```go
import "reflect"

schema := goryu.SchemaOf(reflect.TypeOf(User{}))
```

### 型のマッピング

Go の型は次のように JSON Schema の型にマッピングされます。

| Go の型 | JSON Schema |
|---------|-------------|
| `bool` | `{"type": "boolean"}` |
| 整数型 | `{"type": "integer"}` |
| `float32` / `float64` | `{"type": "number"}` |
| `string` | `{"type": "string"}` |
| スライス／配列 | `{"type": "array", "items": ...}` |
| `[]byte` | `{"type": "string", "contentEncoding": "base64"}` |
| `map` | `{"type": "object", "additionalProperties": ...}` |
| `struct` | `{"type": "object", "properties": ...}` |
| `time.Time` | `{"type": "string", "format": "date-time"}` |
| ポインタ | 指し示す先の型のスキーマ（そのフィールドを任意としてマーク） |

### 制約タグ

`jsonschema` 構造体タグで制約を追加します。制約はカンマ区切りの `key=value` ペアです。以下のキーがサポートされています。

| タグキー | 適用対象 | タグの例 | 生成されるスキーマ |
|---------|-----------|-------------|------------------|
| `description` | 任意 | `jsonschema:"description=User email address"` | `"description": "User email address"` |
| `title` | 任意 | `jsonschema:"title=Email"` | `"title": "Email"` |
| `format` | 文字列 | `jsonschema:"format=email"` | `"format": "email"` |
| `pattern` | 文字列 | `jsonschema:"pattern=^[a-z]+$"` | `"pattern": "^[a-z]+$"` |
| `default` | 任意 | `jsonschema:"default=active"` | `"default": "active"` |
| `enum` | 任意 | `jsonschema:"enum=red\|green\|blue"` | `"enum": ["red", "green", "blue"]` |
| `minimum` | 数値 | `jsonschema:"minimum=0"` | `"minimum": 0` |
| `maximum` | 数値 | `jsonschema:"maximum=100"` | `"maximum": 100` |
| `multipleOf` | 数値 | `jsonschema:"multipleOf=5"` | `"multipleOf": 5` |
| `minLength` | 文字列 | `jsonschema:"minLength=3"` | `"minLength": 3` |
| `maxLength` | 文字列 | `jsonschema:"maxLength=64"` | `"maxLength": 64` |
| `minItems` | 配列 | `jsonschema:"minItems=1"` | `"minItems": 1` |
| `maxItems` | 配列 | `jsonschema:"maxItems=10"` | `"maxItems": 10` |
| `required` | 任意 | `jsonschema:"required"` | フィールドを強制的に `required` に含める |
| `optional` | 任意 | `jsonschema:"optional"` | フィールドを `required` から除外する |

複数の制約を 1 つのタグにまとめられます。

```go
type Product struct {
    SKU      string   `json:"sku" jsonschema:"description=Stock keeping unit,pattern=^[A-Z0-9-]+$,minLength=3"`
    Price    float64  `json:"price" jsonschema:"minimum=0,multipleOf=0.01"`
    Status   string   `json:"status" jsonschema:"enum=draft|published|archived,default=draft"`
    Tags     []string `json:"tags" jsonschema:"minItems=1,maxItems=20"`
}
```

::: warning
説明（description）にカンマを含めてはいけません。カンマはタグ内の制約の区切り文字であるため、値の中にカンマがあると新しい制約の始まりと解釈されてしまいます。`enum` で複数の許可値を指定する場合は、カンマの代わりに `|` を区切り文字として使用してください。
:::

### `required` が決まる仕組み

エクスポートされた各フィールドについて、スキーマは次の順序でそのフィールドが `required` リストに属するかどうかを決定します。

1. `jsonschema` タグ内の単独の `required` は常にそのフィールドを必須とします。
2. `jsonschema` タグ内の単独の `optional` は常にそのフィールドを任意とします。
3. それ以外で、`json` タグに `omitempty` がある場合、そのフィールドは任意です。
4. それ以外で、ポインタフィールドは任意、非ポインタフィールドは必須です。

```go
type Account struct {
    ID       string  `json:"id"`                              // required (non-pointer, no omitempty)
    Nickname string  `json:"nickname,omitempty"`              // optional (omitempty)
    Manager  *string `json:"manager"`                         // optional (pointer)
    Country  string  `json:"country" jsonschema:"optional"`   // optional (explicit override)
    Token    *string `json:"token" jsonschema:"required"`     // required (explicit override)
}
```

::: tip
埋め込み構造体はフラット化されます。埋め込まれた型のプロパティと `required` エントリは親オブジェクトにマージされます。再帰的な型は保護されており、自身を参照する構造体は無限ループを避けるために単なる `{"type": "object"}` に解決されます。
:::

### `/schema` エンドポイントの提供

`Schema[T]()` はプレーンなマップを返すため、そのまま `c.JSON` に渡せます。

```go
import "github.com/arthurlch/goryu"

type CreateUser struct {
    Name  string `json:"name" jsonschema:"description=Full name"`
    Email string `json:"email" jsonschema:"format=email"`
}

app.Get("/schema/user", func(c *goryu.Ctx) {
    c.JSON(goryu.Schema[CreateUser]())
})
```

これにより、クライアント、フロントエンドのフォーム、バリデーションツールがスキーマを取得して、リクエストの形を理解できます。これを [バインディングとバリデーション](/ja/core/binding) と組み合わせることで、同じ構造体で受信リクエストの検証と記述の両方を行えます。

### LLM の構造化出力と関数呼び出し

ほとんどの LLM API は、モデルの出力を制約したり、呼び出し可能なツールを宣言したりするために JSON Schema を受け付けます。`Schema[T]()` は Go の型からまさにその形を生成するため、関数呼び出しの定義がコードと同期し続けます。

```go
type WeatherQuery struct {
    City string `json:"city" jsonschema:"description=City name to look up"`
    Unit string `json:"unit" jsonschema:"enum=celsius|fahrenheit,default=celsius"`
}

// Use as the parameters schema of an LLM tool / function definition.
tool := map[string]any{
    "name":        "get_weather",
    "description": "Look up the current weather for a city",
    "parameters":  goryu.Schema[WeatherQuery](),
}
```

生成された `description`、`enum`、`format` の制約がモデルに必要な指針を与え、その後 `goryu.Bind[WeatherQuery]` でモデルの応答を同じ構造体へ戻せます。

## 関連項目

- [バインディングとバリデーション](/ja/core/binding) — スキーマを生成するのと同じ構造体へリクエストをパースし、検証します。
- [Context](/ja/core/context) — `c.JSON` を介してスキーマを提供するために使うリクエスト／レスポンスオブジェクトです。
