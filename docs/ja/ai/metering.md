# トークン・コスト計測

`aimeter` はリクエストごとにトークン使用量と USD コストを計上し、固定ウィンドウ内で
キーごとのリクエスト予算とトークン予算を強制します。ハンドラーがプロバイダーの
トークン使用量を報告すると、ミドルウェアがコストを計算し、予算をチェックし、
その結果をレスポンスヘッダーと `OnResult` コールバックを通じて公開します。

```go
import "github.com/arthurlch/goryu/middleware/aimeter"
```

## 機能

- **トークン計上**: リクエストごとのプロンプト、コンプリーション、合計トークン。
- **コスト計測**: 1K トークンあたりの価格から導出される USD コスト。
- **キーごとの上限**: 固定ウィンドウ内でのリクエスト回数*と*トークン予算。
- **キーごとの分離**: 各 API キー（または IP）が独自のウィンドウとカウンターを
  持ちます。
- **信頼できるフック**: ロギング、メトリクス、課金のための `OnResult` — ヘッダーを
  設定できないストリーミングレスポンスでも発火します。

## 使い方

### 基本的なセットアップ

デフォルトの `KeyGenerator` は `X-API-Key` で呼び出し元を識別し、なければ
リモート IP にフォールバックします。価格と予算は設定で指定します。

```go
import (
    "time"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/aimeter"
)

app.Use(aimeter.New(aimeter.Config{
    PromptCostPer1K:     0.003,
    CompletionCostPer1K: 0.015,
    MaxRequests:         100,
    MaxTokens:           200_000,
    Window:              time.Minute,
    OnResult: func(c *goryu.Ctx, r aimeter.Result) {
        log.Printf("key=%s tokens=%d cost=$%.4f", r.Key, r.Usage.Total(), r.CostUSD)
    },
}))
```

`aimeter.Default()` はデフォルト設定（価格なし、予算なし）でミドルウェアを
インストールします。`X-Tokens-*` ヘッダーだけが欲しい場合に便利です。

### ハンドラーから使用量を報告する

トークン数はモデルが応答した後にしか分からないため、ハンドラーが `SetUsage` で
報告します。ミドルウェアはハンドラーが return した後にその値を読み取ります。

```go
func chat(c *goryu.Ctx) {
    resp := callProvider(c)

    aimeter.SetUsage(c, aimeter.Usage{
        PromptTokens:     resp.Usage.PromptTokens,
        CompletionTokens: resp.Usage.CompletionTokens,
    })

    _ = c.JSON(200, resp)
}
```

`Usage.Total()` は `PromptTokens + CompletionTokens` を返します。他のミドルウェア
（例えばレコーダー）は `GetUsage` でそれを読み戻せます。

```go
u, ok := aimeter.GetUsage(c) // ok is false if the handler didn't set usage
```

### API キー単位での計測

`KeyGenerator` を指定すると、呼び出し元の識別方法を制御できます。個別のキーごとに
独自のウィンドウ、予算、コスト計上が与えられます。

```go
app.Use(aimeter.New(aimeter.Config{
    KeyGenerator: func(c *goryu.Ctx) string {
        return c.GetHeader("X-API-Key") // or a tenant/user id from auth
    },
    MaxRequests: 60,
    Window:      time.Minute,
}))
```

### カスタム拒否レスポンス

デフォルトでは、ブロックされたリクエストは `X-RateLimit-Reason` ヘッダー付きの
`429` を受け取ります。`LimitReached` をオーバーライドすると独自のレスポンスを
組み立てられます。`reason` は `"request limit exceeded"` または
`"token budget exceeded"` のいずれかです。

```go
app.Use(aimeter.New(aimeter.Config{
    MaxRequests: 60,
    MaxTokens:   100_000,
    Window:      time.Minute,
    LimitReached: func(c *goryu.Ctx, reason string) {
        _ = c.Status(429).JSON(goryu.Map{"error": reason})
    },
}))
```

### 課金フック

`OnResult` は信頼できる計上パスです。計測対象のリクエストごとに一度だけ、キー、
使用量、算出されたコストとともに発火します。`X-*` ヘッダーを書き込めない
ストリーミングレスポンスでも発火します。

```go
app.Use(aimeter.New(aimeter.Config{
    PromptCostPer1K:     0.0005,
    CompletionCostPer1K: 0.0015,
    OnResult: func(c *goryu.Ctx, r aimeter.Result) {
        billing.Charge(r.Key, r.CostUSD)
        metrics.Add(r.Key, r.Usage.Total())
    },
}))
```

## レスポンスヘッダー

非ストリーミングレスポンス（ハンドラーがまだフラッシュしていない場合）では、
ミドルウェアは次を設定します。

| ヘッダー | 値 |
|--------|-------|
| `X-Tokens-Prompt` | プロンプトトークン数 |
| `X-Tokens-Completion` | コンプリーショントークン数 |
| `X-Tokens-Total` | 合計トークン数 |
| `X-Cost-USD` | 小数第 6 位までフォーマットされたコスト |

## 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| KeyGenerator | `func(*goryu.Ctx) string` | 呼び出し元の識別 | `X-API-Key` → リモート IP |
| PromptCostPer1K | `float64` | プロンプト 1K トークンあたりの USD | `0` |
| CompletionCostPer1K | `float64` | コンプリーション 1K トークンあたりの USD | `0` |
| MaxRequests | `int` | ウィンドウあたりの最大リクエスト数（0 = 無効） | `0` |
| MaxTokens | `int` | ウィンドウあたりの最大トークン数（0 = 無効） | `0` |
| Window | `time.Duration` | 固定ウィンドウの長さ | `1m` |
| MaxClients | `int` | 追跡する最大キー数（100,000 を超えられない） | `10000` |
| OnResult | `func(c, Result)` | リクエスト後の計上フック | なし |
| LimitReached | `func(c, reason)` | カスタム拒否レスポンス | `429` |

`OnResult` に渡される `Result` は `{Key string, Usage Usage, CostUSD float64}` です。

## 注意点

::: warning トークン予算は過去の消費量に基づいて強制される
トークン数はプロバイダーが応答した*後*にしか分からないため、トークン予算は
そのウィンドウでキーがすでに累積したトークン数に対してチェックされます。キーが
すでに `MaxTokens` を超えている場合にリクエストが拒否されます。境界を越える
リクエスト自体は処理され、そのトークンがカウンターを超過させるため、*次の*
リクエストがブロックされます。一方、リクエスト回数の上限はハンドラーの実行前に
強制されます。
:::

::: tip ヘッダーはベストエフォート、OnResult は信頼できる
`X-Tokens-*` / `X-Cost-USD` はレスポンスがまだフラッシュされていない場合にのみ
設定されます。そのため JSON ルートには現れますが、SSE / ストリーミングルートには
現れません。ストリーミングエンドポイントでは `OnResult` でトークンとコストを
計上してください。
:::

- ウィンドウは固定です。カウンターはウィンドウが経過するとリセットされ、スライド
  方式ではありません。
- `SetUsage` が一度も呼ばれない場合、そのリクエストはトークン計上されません
  （リクエスト回数のみが `MaxRequests` に対してカウントされます）。
