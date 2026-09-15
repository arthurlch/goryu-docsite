# AIMeter ミドルウェア

AI/LLM バックエンド向けの、トークン／コストの計測とキーごとのレート制限を行います。
ハンドラーがプロバイダーのトークン使用量を報告すると、ミドルウェアはコストを計上し、
固定ウィンドウ内でキーごとのリクエスト予算とトークン予算を適用し（カウンターは各ウィンドウの
終了時にリセットされます）、その結果をレスポンスヘッダーと `OnResult` コールバックを介して
提示します。

::: tip ガイドをお探しですか？
このページはミドルウェアのリファレンスです。課金フック、ストリーミングに関する注意点、
API キーの計測を含む解説については、[トークン & コスト計測ガイド](/ja/ai/metering) をご覧ください。
:::

## 特徴

- **トークンの計上**: リクエストごとのプロンプト、補完、合計トークン数。
- **コスト計測**: 1K トークンあたりの料金から算出される USD コスト。
- **キーごとの制限**: 固定ウィンドウ内でのリクエスト数 *および* トークン予算。
- **キーごとの分離**: 各 API キー（または IP）が独自のウィンドウとカウンターを持ちます。
- **信頼できるフック**: ロギング、メトリクス、課金のための `OnResult` — ヘッダーを設定できないストリーミングレスポンスでも発火します。

## 使い方

デフォルトの `KeyGenerator` は `X-API-Key` で呼び出し元を識別し、なければリモート IP に
フォールバックします。料金と予算は設定で指定します。

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

ハンドラー内では、プロバイダーを呼び出した後に使用量を報告します。トークン数はモデルが
応答した後にしか分からないため、ミドルウェアはハンドラーの返却後にその値を読み取ります。

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

`Usage.Total()` は `PromptTokens + CompletionTokens` を返します。他のミドルウェア（例えば
recorder）は `GetUsage` でこれを読み戻せます。

```go
u, ok := aimeter.GetUsage(c) // ok is false if the handler didn't set usage
```

`aimeter.Default()` は、デフォルト設定（料金なし、予算なし）でミドルウェアをインストール
します。`X-Tokens-*` ヘッダーだけが欲しい場合に便利です。

## レスポンスヘッダー

非ストリーミングのレスポンス（ハンドラーがまだフラッシュしていない場合）では、ミドルウェアは
次を設定します。

| ヘッダー | 値 |
|--------|-------|
| `X-Tokens-Prompt` | プロンプトトークン |
| `X-Tokens-Completion` | 補完トークン |
| `X-Tokens-Total` | 合計トークン |
| `X-Cost-USD` | 小数点以下 6 桁で書式化されたコスト |

## 設定オプション

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| KeyGenerator | `func(*goryu.Ctx) string` | 呼び出し元のアイデンティティ | `X-API-Key` → リモート IP |
| PromptCostPer1K | `float64` | プロンプトトークン 1K あたりの USD | `0` |
| CompletionCostPer1K | `float64` | 補完トークン 1K あたりの USD | `0` |
| MaxRequests | `int` | ウィンドウあたりの最大リクエスト数（0 = 無効） | `0` |
| MaxTokens | `int` | ウィンドウあたりの最大トークン数（0 = 無効） | `0` |
| Window | `time.Duration` | 固定ウィンドウの長さ | `1m` |
| MaxClients | `int` | 追跡するキーの最大数（100,000 を超えられません） | `10000` |
| OnResult | `func(c, Result)` | リクエスト後の計上フック | なし |
| LimitReached | `func(c, reason)` | カスタムの拒否レスポンス | `429` |

`OnResult` に渡される `Result` は `{Key string, Usage Usage, CostUSD float64}` です。

## 仕組み

各リクエストについて、ミドルウェアは次を行います。

1. **呼び出し元を識別する** — `KeyGenerator` を介して（デフォルト: `X-API-Key`、次にリモート IP）。
2. **予算をチェックする** — ハンドラーを実行する前に、キーの固定ウィンドウに対して確認します。リクエスト数のチェック（`MaxRequests`）と、今ウィンドウで既に消費されたトークンを用いたトークン予算のチェック（`MaxTokens`）です。
3. **ハンドラーを実行する** — ハンドラーは `SetUsage` で使用量を報告します。
4. **トークンを記録する** — ウィンドウに対してトークンを記録し、1K あたりの料金からコストを算出します。
5. **結果を出力する** — レスポンスがフラッシュされていない場合は `X-Tokens-*` / `X-Cost-USD` ヘッダーを設定し、その後 `OnResult` を呼び出します。

ウィンドウは固定です。カウンターはスライディング方式ではなく、ウィンドウが経過したときに
リセットされます。各キーは `MaxClients` まで独立して追跡されます。

## 注意点

- **トークン予算は過去の消費量に基づいて適用されます。** トークン数はプロバイダーが応答した *後* にしか分からないため、キーのウィンドウ内累積トークンが既に `MaxTokens` を超えている場合にリクエストが拒否されます。一方で、リクエスト数の制限はハンドラー実行前に適用されます。
- **レスポンスヘッダーはベストエフォートです。** `X-Tokens-*` / `X-Cost-USD` は、ハンドラーがまだレスポンスをフラッシュしていない場合（すなわち非ストリーミング）にのみ設定されます。ストリーミングのエンドポイントでは、信頼できる計上経路として `OnResult` を使用してください。
- `SetUsage` が一度も呼ばれない場合、そのリクエストはトークン計上されません（`MaxRequests` に対してリクエスト数だけがカウントされます）。
