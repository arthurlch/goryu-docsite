# プロバイダープロキシ

`aiproxy` は、LLM / AI プロバイダー向けの小さなストリーミングリバースプロキシ
ヘルパーです。現在のリクエストを上流のプロバイダーへ転送し、データが到着するたびに
フラッシュしながらレスポンスをクライアントへストリーミングで返します。そのため
SSE やチャンク化されたトークンストリームがそのまま素通しされます。あなたの
プロバイダー資格情報を注入し、送出時に呼び出し元自身のシークレットを取り除きます。

```go
import "github.com/arthurlch/goryu/aiproxy"
```

## 機能

- **ストリーミングの素通し**: `Stream` は上流のバイトを到着したそばから
  フラッシュします（SSE / チャンク化されたトークンストリーム）。クライアント
  タイムアウトはありません。
- **バッファ転送**: 通常の非ストリーミングなプロバイダー呼び出し向けの `Forward`。
- **認証の注入**: `Authorization: Bearer <key>` を付与します（ヘッダーとスキームは
  設定可能）。
- **シークレットの除去**: 転送前に呼び出し元の `Authorization`、`Cookie`、
  `X-Api-Key` を取り除きます。
- **ヘッダーの衛生管理**: 両方向で hop-by-hop ヘッダーを破棄します。
- **コンテキスト対応**: キャンセルのためにリクエストコンテキストを尊重します。

## 使い方

### ストリーミングの素通し

起動時に `*Proxy` を 1 つ作成し、ハンドラーから `Stream` を呼び出します。

```go
import (
    "os"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/aiproxy"
)

px := aiproxy.New(aiproxy.Config{
    BaseURL: "https://api.openai.com",
    APIKey:  os.Getenv("OPENAI_API_KEY"),
})

app.POST("/v1/chat/completions", func(c *goryu.Ctx) {
    if err := px.Stream(c, "/v1/chat/completions"); err != nil {
        // upstream/network error; the response may be partially written.
        log.Printf("proxy error: %v", err)
    }
})
```

`Stream` は上流のステータスとヘッダーをコピーし、その後ボディをチャンクごとに
中継し、各書き込みの後にフラッシュするため、トークンがただちにクライアントへ
届きます。

### 非ストリーミングの転送

レスポンス全体をバッファリングしたい場合は `Forward` を使います（設定した
`Timeout` を使用します）。

```go
app.POST("/v1/embeddings", func(c *goryu.Ctx) {
    if err := px.Forward(c, "/v1/embeddings"); err != nil {
        log.Printf("proxy error: %v", err)
    }
})
```

### 別のプロバイダーやカスタム認証ヘッダー

```go
px := aiproxy.New(aiproxy.Config{
    BaseURL:    "https://api.anthropic.com",
    APIKey:     os.Getenv("ANTHROPIC_API_KEY"),
    AuthHeader: "x-api-key", // provider uses a custom header
    AuthScheme: "",          // no "Bearer " prefix
    Header: http.Header{     // extra headers on every upstream request
        "anthropic-version": {"2023-06-01"},
    },
})
```

## 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| BaseURL | `string` | 上流のオリジン（必須）、例: `https://api.openai.com` | なし |
| APIKey | `string` | `AuthHeader` に注入される資格情報 | なし |
| AuthHeader | `string` | 資格情報を運ぶヘッダー | `Authorization` |
| AuthScheme | `string` | キーの前に付けるスキームのプレフィックス | `Bearer` |
| Header | `http.Header` | すべての上流リクエストに追加するヘッダー | なし |
| Client | `*http.Client` | カスタム HTTP クライアント（stream と forward の両方を上書き） | 下記参照 |
| Timeout | `time.Duration` | `Forward` のみのタイムアウト | `60s` |

## セキュリティ

::: tip 呼び出し元のシークレットはプロバイダーに届かない
転送前に、`aiproxy` は呼び出し元自身の `Authorization`、`Cookie`、`X-Api-Key`
ヘッダーを取り除き、その後 `AuthHeader` を介して*あなたの*プロバイダー資格情報を
付与します。クライアントのセッション Cookie や個人の API キーが、サードパーティの
プロバイダーへ漏れることは決してありません。それ以外のクライアントヘッダーは
（hop-by-hop ヘッダーを除いて）素通しされます。
:::

::: warning ユーザー制御のパスを渡さないこと
`path` 引数は `BaseURL` に結合されて上流 URL を形成します。ユーザー入力から
それを組み立てると、呼び出し元が意図しない上流エンドポイントに到達できる恐れが
あります（プロバイダーに対する SSRF 的なパストラバーサル）。常に
`"/v1/chat/completions"` のような固定でサーバー側が選んだパスを渡してください。
:::

## 注意点

- `Stream` は**タイムアウトのない** HTTP クライアントを使用し（ストリームは
  長時間に及ぶ可能性があるため）、キャンセルはリクエストコンテキストに依存します。
  `Forward` は `Timeout` を使用します。
- 独自の `Client` を指定すると、stream と forward の両方のクライアントを上書き
  します。ストリーミングにも再利用する場合は、その `Timeout` を `0` に設定して
  ください。
- ストリーミングエラー時にはレスポンスがすでに部分的に書き込まれている場合が
  あります。最初のバイトの後はステータスコードを変更できないため、ログを取って
  次へ進んでください。
