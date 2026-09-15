# Recorder ミドルウェア

**評価（eval）用データセット** を構築するために、リクエスト／レスポンスのペアを捕捉します。
完了した各リクエストは、構造化された `Record` として `Sink` に書き込まれます。付属の
`FileSink` は改行区切り JSON（NDJSON）を追記します。これはオフラインの評価パイプラインで
一般的な入力形式です。

::: tip ガイドをお探しですか？
このページはミドルウェアのリファレンスです。評価用データセットの構築、カスタム Sink、
モデル／トークンのメタデータによるレコードの拡充についての解説は、[レコーディングガイド](/ja/ai/recording) をご覧ください。
:::

## 特徴

- **構造化レコード**: メソッド、パス、ステータス、レイテンシ、リクエスト／レスポンスボディ。
- **差し替え可能な Sink**: `Sink`（DB、キュー、Blob）を実装するか、付属の `FileSink` を使用します。
- **上限付きの捕捉**: ボディごとのバイト上限。リクエスト／レスポンスの捕捉を切り替え可能。
- **ボディ安全**: リクエストボディは読み取られて復元されるため、ハンドラーは引き続き全体を参照できます。
- **拡充可能**: `KeyFunc` と `MetaFunc` により、呼び出し元のキーとメタデータ（モデル、トークン使用量など）を付加します。

## 使い方

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/aimeter"
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
    MetaFunc: func(c *goryu.Ctx) map[string]any {
        u, _ := aimeter.GetUsage(c)
        return map[string]any{"model": c.GetHeader("X-Model"), "tokens": u.Total()}
    },
}))
```

`evals.jsonl` の各行は次のようになります。

```json
{"time":"2026-09-14T10:00:00Z","method":"POST","path":"/chat","status":200,"latency_ms":812,"key":"k-123","request_body":{"q":"life"},"response_body":{"answer":"42"},"meta":{"model":"gpt-x","tokens":1156}}
```

`recorder.Default()` は Sink なしでミドルウェアを構築します。`New` を介して `Sink` を
指定するまでは、素通し（パススルー）になります。

## 設定オプション

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| Sink | `Sink` | レコードの送信先（必須） | なし（no-op） |
| MaxBodyBytes | `int64` | ボディごとに捕捉する最大バイト数 | `64 KiB` |
| CaptureRequest | `*bool` | リクエストボディを捕捉 | `true` |
| CaptureResponse | `*bool` | レスポンスボディを捕捉 | `true` |
| KeyFunc | `func(c) string` | 呼び出し元／セッションのキー | なし |
| MetaFunc | `func(c) map[string]any` | 追加のメタデータ | なし |

## 仕組み

各リクエストについて、ミドルウェアは次を行います。

1. **スキップ** — `Sink` が設定されていない場合（または `Skip` が true を返す場合）。
2. **リクエストボディを捕捉** — `CaptureRequest` が有効なとき（`MaxBodyBytes` まで）、その後ハンドラーが引き続き全体を読み取れるよう復元します。
3. **ライターをラップ** — `CaptureResponse` が有効なとき、クライアントへストリーミングしつつレスポンスボディを捕捉します（`MaxBodyBytes` まで）。
4. **ハンドラーを実行** — そのレイテンシを計測します。
5. **`Record` を構築** — 時刻、メソッド、パス、ステータス、レイテンシ、ボディ、加えて `KeyFunc` のキーと `MetaFunc` のメタデータ — を組み立て、`Sink` に書き込みます。Sink への書き込みエラーはログに記録され、致命的ではありません。

付属の `FileSink` は各レコードを JSON の 1 行にマーシャルし、書き込みのたびにフラッシュし、
並行利用に対して安全です。

## 注意点

- JSON でないボディは JSON 文字列として保存されるため、すべてのレコードがクリーンにマーシャルされます。
- `FileSink` はレコードごとにフラッシュします。高スループットのレコーディングには、バッファリングされた、または非同期の `Sink` を実装してください。
- ボディは `MaxBodyBytes` で切り詰められます。大きなプロンプトの場合は値を引き上げてください。
