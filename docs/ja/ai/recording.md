# 評価用レコーディング

`recorder` は、**評価用データセット**を構築するためにリクエスト / レスポンスの
ペアをキャプチャします。完了した各リクエストは、構造化された `Record` として
`Sink` に書き込まれます。同梱の `FileSink` は改行区切り JSON（NDJSON）を追記
します。これはオフラインの評価パイプラインで一般的な入力形式です。ボディは
（上限付きで）キャプチャされ、リクエストボディ全体は復元されるため、ハンドラーは
依然としてそれを読み取れます。

```go
import "github.com/arthurlch/goryu/middleware/recorder"
```

## 機能

- **構造化されたレコード**: 時刻、メソッド、パス、ステータス、レイテンシ、
  リクエスト / レスポンスのボディ、キー、メタデータ。
- **差し替え可能なシンク**: `Sink` インターフェースを実装する（DB、キュー、
  ブロブストア）か、同梱の `FileSink` を使用します。
- **上限付きキャプチャ**: ボディあたりのバイト数上限。リクエスト / レスポンスの
  キャプチャはそれぞれ個別にオフにできます。
- **ボディに安全**: リクエストボディは読み取られた後に復元されるため、ハンドラーは
  依然としてそれを参照できます。
- **エンリッチ可能**: `KeyFunc` と `MetaFunc` が、呼び出し元のキーや、モデルや
  トークン使用量といったメタデータを付加します。

## 使い方

### FileSink から NDJSON へ

起動時に `FileSink` を開き、シャットダウン時にクローズします。キャッシュヒットや
エラーレスポンスも含めてすべてをキャプチャできるよう、レコーダーを最も外側の
ミドルウェアとしてインストールしてください。

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/recorder"
)

sink, err := recorder.NewFileSink("evals.jsonl")
if err != nil {
    log.Fatal(err)
}
defer sink.Close()

app.Use(recorder.New(recorder.Config{
    Sink:    sink,
    KeyFunc: func(c *goryu.Ctx) string { return c.GetHeader("X-API-Key") },
}))
```

`evals.jsonl` の各行が 1 つの `Record` です。

```json
{"time":"2026-09-14T10:00:00Z","method":"POST","path":"/chat","status":200,"latency_ms":812,"key":"k-123","request_body":{"q":"life"},"response_body":{"answer":"42"},"meta":{"model":"gpt-x","tokens":1156}}
```

### トークン使用量でレコードをエンリッチする

`MetaFunc` はハンドラーの後に実行されるため、ハンドラーが `aimeter.SetUsage` で
報告した使用量を読み取れます。これは評価レコードをトークンおよびコストデータと
結び付ける標準的な方法です。

```go
import "github.com/arthurlch/goryu/middleware/aimeter"

app.Use(recorder.New(recorder.Config{
    Sink:    sink,
    KeyFunc: func(c *goryu.Ctx) string { return c.GetHeader("X-API-Key") },
    MetaFunc: func(c *goryu.Ctx) map[string]any {
        u, _ := aimeter.GetUsage(c)
        return map[string]any{
            "model":             c.GetHeader("X-Model"),
            "prompt_tokens":     u.PromptTokens,
            "completion_tokens": u.CompletionTokens,
            "tokens":            u.Total(),
        }
    },
}))
```

::: tip レコーダーを最も外側に配置する
`recorder` を `aimeter` より前にインストールします（そのため後者をラップします）。
そうすると `429` の拒否やプロンプトキャッシュのヒットも記録します。また
`MetaFunc` はハンドラーの後に実行されるため、ハンドラーが設定した使用量を
利用できます。
:::

### 何をキャプチャするかを制御する

`CaptureRequest` と `CaptureResponse` は `*bool` なので、「未設定」（デフォルトは
`true`）と明示的な `false` を区別できます。

```go
noBody := false
app.Use(recorder.New(recorder.Config{
    Sink:            sink,
    CaptureResponse: &noBody, // record metadata only, skip response bodies
    MaxBodyBytes:    256 << 10, // raise the cap for large prompts
}))
```

### カスタムシンク

`Write(Record) error` メソッドを持つ任意の型がシンクになります。レコードを
データベース、キュー、非同期バッファへ送れます。

```go
type QueueSink struct{ ch chan recorder.Record }

func (s QueueSink) Write(r recorder.Record) error {
    s.ch <- r
    return nil
}

app.Use(recorder.New(recorder.Config{Sink: QueueSink{ch: buf}}))
```

## Record

| フィールド | JSON | 備考 |
|-------|------|-------|
| Time | `time` | リクエストが開始された時刻 |
| Method | `method` | HTTP メソッド |
| Path | `path` | リクエストパス |
| Status | `status` | レスポンスステータスコード |
| LatencyMS | `latency_ms` | ハンドラーの所要時間（ミリ秒） |
| Key | `key` | `KeyFunc` から（空の場合は省略） |
| RequestBody | `request_body` | キャプチャされたリクエストボディ（上限付き） |
| ResponseBody | `response_body` | キャプチャされたレスポンスボディ（上限付き） |
| Meta | `meta` | `MetaFunc` から |

## 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| Sink | `Sink` | レコードの送り先（必須 — シンクがなければ素通し） | なし |
| MaxBodyBytes | `int64` | ボディごとにキャプチャする最大バイト数 | `64 KiB` |
| CaptureRequest | `*bool` | リクエストボディをキャプチャする | `true` |
| CaptureResponse | `*bool` | レスポンスボディをキャプチャする | `true` |
| KeyFunc | `func(c) string` | 呼び出し元 / セッションのキー | なし |
| MetaFunc | `func(c) map[string]any` | 追加のメタデータ | なし |

## 注意点

- JSON でないボディは JSON 文字列として保存されるため、すべてのレコードが
  きれいにマーシャルされます。有効な JSON はそのまま保存されます。
- ボディは `MaxBodyBytes` で切り詰められます。大きなプロンプトの場合は上限を
  引き上げてください。
- `FileSink` は各レコードの後にフラッシュし、並行使用に対して安全です。高スループット
  なレコーディングには、バッファ付きまたは非同期のシンクで裏付けてください。
- `Sink` が設定されていない場合、ミドルウェアは何もしない素通しになります。
