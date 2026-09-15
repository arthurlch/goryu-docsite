# llms.txt & API リファレンス

Goryu は HTTP API の機械可読なインデックスを公開できるため、コーディング
エージェントや LLM クライアント、その他のツールが、手作業でドキュメントを
書かなくてもエンドポイントを発見できます。たった 1 回の呼び出し
（`app.MountLLMs()`）で、稼働中のルーターから構築された 2 つのドキュメントを
配信します。

- `GET /llms.txt` — [llms.txt](https://llmstxt.org) 形式の Markdown ドキュメント。
- `GET /llms.json` — 同じ情報を構造化された JSON として提供。

どちらも実際に登録したルートから生成されるため、コードとずれることはありません。

## 機能

- **メンテナンス不要**: リファレンスはリクエスト時にルーターから導出されます。
- **2 つの形式**: 人間や LLM にやさしい Markdown（`llms.txt`）と機械可読な
  JSON（`llms.json`）。
- **名前付きルート**: ルート名が設定されている場合、エンドポイントの説明として
  表示されます。
- **プログラムからのアクセス**: `app.APIReference()` で同じデータを Go で構築でき、
  `app.LLMsText()` で Markdown をレンダリングできます。

## 使い方

### エンドポイントをマウントする

ルートをすべて定義した**後**に `MountLLMs()` を呼び出すことで、全体を確実に
取り込めます。

```go
package main

import "github.com/arthurlch/goryu"

func main() {
    app := goryu.New(goryu.Config{AppName: "Acme API"})

    app.GET("/health", healthHandler)
    app.POST("/chat/stream", chatStream)
    app.GET("/chat/schema", chatSchema)

    app.MountLLMs() // registers GET /llms.txt and GET /llms.json

    _ = app.Listen(":3000")
}
```

`goryu.Config` の `AppName` がドキュメントのタイトルになります。設定されていない
場合は `API` がデフォルトになります。

### `GET /llms.txt`

[llms.txt](https://llmstxt.org) の慣例に従い、`text/plain` として配信されます。
タイトル、`>` によるサマリー、エンドポイントの一覧で構成されます。

```bash
curl http://localhost:3000/llms.txt
```

```text
# Acme API

> Acme API — HTTP API built with goryu, exposing 5 endpoints.

## Endpoints

- `GET /health`
- `POST /chat/stream` — ChatStream
- `GET /chat/schema` — ChatSchema
- `GET /llms.txt`
- `GET /llms.json`
```

各行末尾の `— Name` は（ルート登録時に付与した）ルート名であり、存在する場合は
短い説明として使われます。

### `GET /llms.json`

同じリファレンスを JSON として提供します。`APIReference` 型に対応しています。

```bash
curl http://localhost:3000/llms.json
```

```json
{
  "name": "Acme API",
  "summary": "Acme API — HTTP API built with goryu, exposing 5 endpoints.",
  "routes": [
    { "method": "GET",  "path": "/health" },
    { "method": "POST", "path": "/chat/stream", "name": "ChatStream" },
    { "method": "GET",  "path": "/chat/schema", "name": "ChatSchema" },
    { "method": "GET",  "path": "/llms.txt" },
    { "method": "GET",  "path": "/llms.json" }
  ]
}
```

### Go でリファレンスを構築する

このデータを使うためにエンドポイントを配信する必要はありません。
`APIReference()` は構造化されたリファレンスを返し、`LLMsText()` は
レンダリング済みの Markdown を返します。

```go
ref := app.APIReference()
fmt.Println(ref.Name)          // "Acme API"
fmt.Println(len(ref.Routes))   // number of registered routes
for _, r := range ref.Routes {
    fmt.Printf("%s %s %s\n", r.Method, r.Path, r.Name)
}

markdown := app.LLMsText() // the exact body served at /llms.txt
```

これは、ビルド時にリファレンスをファイルへ書き出したり、ステータスページに
埋め込んだり、別のツールに渡したりする場合に便利です。

## 型

`APIReference` と `APIRoute` は `goryu` パッケージからエクスポートされています。

```go
type APIRoute struct {
    Method string `json:"method"`
    Path   string `json:"path"`
    Name   string `json:"name,omitempty"`
}

type APIReference struct {
    Name    string     `json:"name"`
    Summary string     `json:"summary"`
    Routes  []APIRoute `json:"routes"`
}
```

## メソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `app.APIReference()` | `APIReference` | ルーターから構築された構造化リファレンス |
| `app.LLMsText()` | `string` | `llms.txt` の Markdown 本文 |
| `app.MountLLMs()` | — | `GET /llms.txt` と `GET /llms.json` を配信する |

## エージェントやクライアントに役立つ理由

`llms.txt` は、サイトやサービスへの簡潔で厳選された入口を LLM に与えるために
提案された慣例です（[llmstxt.org](https://llmstxt.org) を参照）。Goryu API に
とっては、サービスをエージェントが推論できる対象に変えてくれます。

- **発見**: コーディングエージェントは `GET /llms.txt` によって、あらゆるルート、
  メソッド、名前を把握できます。OpenAPI ファイルもスクレイピングも不要です。
- **グラウンディング**: クライアントを書かせる前にアシスタントを `/llms.txt` に
  向けておけば、存在しないエンドポイントを幻覚するのではなく、実際に存在する
  エンドポイントを呼び出すようになります。
- **ツール連携**: `/llms.json` はパースが非常に簡単なので、IDE、ダッシュボード、
  クライアントジェネレーターが直接消費できます。

::: tip リクエストスキーマや MCP と組み合わせる
（[AI スキャフォールド](/ja/ai/scaffolds)が行うように）`goryu.Schema[T]` 経由で
`/schema` ルートを `MountLLMs()` と併せて配信すると、エージェントは
エンドポイントとそのリクエスト形状の*両方*を発見できます。インタラクティブな
ワークフローには、[`goryu mcp`](/ja/ai/mcp) サーバーを実行することで、
エージェントがルートを一覧表示したりハンドラーを直接スキャフォールドしたり
できます。
:::

::: warning ルートの後にマウントし、公開範囲に注意する
`MountLLMs()` は実行前に登録されたルートのみを反映するため、最後に呼び出して
ください。ルートマップを公開する性質上、API のサーフェスが機密性を含む場合は、
認証の背後に置くか内部ネットワークに限定してください。
:::
