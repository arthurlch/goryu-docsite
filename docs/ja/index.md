---
layout: home

hero:
  name: "Goryu"
  text: "Go のバックエンド、全部入り。"
  tagline: "シンプルな REST API から本格的な AI/LLM サービスまで。ストリーミングファースト、観測しやすく、デフォルトで安全。人間にとって書きやすく、LLM にとって生成しやすい。"
  actions:
    - theme: brand
      text: はじめる
      link: /ja/guide/getting-started
    - theme: alt
      text: なぜ Goryu か
      link: /ja/guide/why-goryu
    - theme: alt
      text: GitHub
      link: https://github.com/arthurlch/goryu

features:
  - icon: 🔋
    title: 全部入り
    details: 29 以上のミドルウェア、DB、CLI、モニタリング、ヘルスチェック、グレースフルシャットダウン。初日から連携済み。組み立て不要。
  - icon: 🤖
    title: AI ネイティブ
    details: SSE と型付きストリーミング、Bind[T] + JSON スキーマ、トークン/コスト計測、プロンプトキャッシュ、プロバイダープロキシ、評価用レコーディング。LLM バックエンドを配線なしで構築。
  - icon: 🔒
    title: デフォルトで安全
    details: セキュリティヘッダー、CSRF、統一された失効の仕組みを持つ JWT とセッション、OAuth2/OIDC、パスキー、RBAC、監査ログ。すべてのレスポンス経路で。
  - icon: ⚡
    title: 圧倒的な速さ
    details: Radix ツリールーターと最適化されたミドルウェアチェーン。Gin と同じ速さで、10 倍の機能を内蔵。
  - icon: 🧩
    title: LLM フレンドリーな DX
    details: llms.txt と機械可読な API リファレンス、MCP サーバー、ストリーミングチャット・RAG・エージェントツールのスキャフォールド。コーディングエージェントにも人間にも優しい。
  - icon: 🎯
    title: マジックなし
    details: 明示的で読みやすい Go。ソースを読めば理解できる。リフレクションの魔術も、隠れた制御フローもありません。
---

<div class="home-section">

## 1 つのフレームワークで、2 つの仕事を確実に {#two-jobs}

シンプルな REST API は**手書きでとことん簡単**であるべきです。AI バックエンドには、ストリーミング・計測・プロキシが**第一級のバッテリー**として必要です。Goryu は両方に応え、シンプルなケースが高度な機能のコストを払うことは決してありません。

::: code-group

```go [プレーンな REST]
package main

import "github.com/arthurlch/goryu"

func main() {
    app := goryu.New(goryu.Config{AppName: "api"})

    app.GET("/health", func(c *goryu.Ctx) {
        _ = c.JSON(200, goryu.Map{"status": "ok"})
    })

    app.POST("/users", func(c *goryu.Ctx) {
        user, err := goryu.Bind[CreateUser](c) // 解析 + 検証
        if err != nil {
            _ = c.JSON(400, goryu.Map{"error": err.Error()})
            return
        }
        _ = c.JSON(201, user)
    })

    app.Run(":3000")
}

type CreateUser struct {
    Email string `json:"email" jsonschema:"format=email"`
    Name  string `json:"name"  jsonschema:"minLength=1"`
}

func (u CreateUser) Validate() error { /* ... */ return nil }
```

```go [ストリーミングチャット]
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/aimeter"
)

type Token struct {
    Content string `json:"content"`
    Done    bool   `json:"done,omitempty"`
}

func main() {
    app := goryu.New(goryu.Config{AppName: "chat"})

    // トークン/コスト計測 + キー別レート制限を標準装備。
    app.Use(aimeter.New(aimeter.Config{
        PromptCostPer1K:     0.003,
        CompletionCostPer1K: 0.015,
    }))

    app.POST("/chat/stream", func(c *goryu.Ctx) {
        // 型付きトークンを SSE でストリーミング。
        _ = goryu.SSEJSON(c, "token", func(send func(Token) error) error {
            for tok := range generate(c) {
                if err := send(Token{Content: tok}); err != nil {
                    return err
                }
            }
            return send(Token{Done: true})
        })
    })

    app.Run(":3000")
}
```

```go [AI プロバイダープロキシ]
package main

import (
    "os"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/aiproxy"
    "github.com/arthurlch/goryu/middleware/promptcache"
)

func main() {
    app := goryu.New()

    // 同一プロンプトをキャッシュ（POST 対応・ストリーミング安全）。
    app.Use(promptcache.New())

    px := aiproxy.New(aiproxy.Config{
        BaseURL: "https://api.openai.com",
        APIKey:  os.Getenv("OPENAI_API_KEY"),
    })

    // プロバイダーへそのままストリーム（SSE パススルー）。
    app.POST("/v1/chat/completions", func(c *goryu.Ctx) {
        _ = px.Stream(c, "/v1/chat/completions")
    })

    app.Run(":3000")
}
```

:::

</div>

<div class="home-section">

## 本来なら手で配線するものが、すべて揃っている {#batteries}

<div class="battery-grid">

<div class="battery-card">

### 🌊 ストリーミングとリアルタイム

`c.SSE` · `c.Stream` · 型付き `SSEJSON[T]` / `StreamJSON[T]`（NDJSON）· 依存ゼロの `websocket.Upgrade`。

[ストリーミングを見る →](/ja/streaming/)

</div>

<div class="battery-card">

### 🧠 AI バッテリー

`aimeter`（トークン/コスト + 制限）· `promptcache` · `aiproxy` · `recorder`（評価）· `Bind[T]` + `Schema[T]`。

[AI バックエンドを構築 →](/ja/ai/)

</div>

<div class="battery-card">

### 🔐 認証とセキュリティ

JWT + セッション（統一失効）· OAuth2/OIDC · パスキー/WebAuthn · RBAC · 監査ログ · `security.txt`。

[アプリを守る →](/ja/security/)

</div>

<div class="battery-card">

### 🤝 LLM フレンドリーな DX

`llms.txt` + 機械可読な API リファレンス · MCP サーバー · `scaffold ai`（chat / RAG / agent tool）。

[ツールを見る →](/ja/ai/llms-txt)

</div>

<div class="battery-card">

### 📈 オブザーバビリティ

構造化ロギング · Prometheus メトリクス · OpenTelemetry トレーシング · ヘルスチェック · ライブ監視 UI。

[すべてを監視 →](/ja/monitoring/)

</div>

<div class="battery-card">

### 🛠️ 生産性

Radix ルーター · ルートビルダー · 設定システム · DB ヘルパー · ジェネレーターとスキャフォールドを備えた本格的な CLI。

[CLI を見る →](/ja/cli)

</div>

</div>

</div>

<div class="home-section">

## 面倒な部分をこなす CLI {#cli}

Goryu は本格的な CLI を同梱しています。プロジェクトのスキャフォールド、ハンドラー/モデル/ミドルウェアの生成、ホットリロード付き開発サーバー、ルート一覧の確認、さらには **MCP** を通じて AI エージェントにプロジェクトを公開することもできます。生成されるのは慣用的な Goryu コードなので、人間もコーディングエージェントも同じきれいな出力になります。

```bash
# プロジェクトを作成して開発を始める
goryu init myapp --template=api
goryu generate handler users --type=crud
goryu scaffold ai assistant --kind=rag     # 配線済みの RAG エンドポイント

# 開発・確認・出荷
goryu dev --port 8080                       # ホットリロード開発サーバー
goryu routes list                           # ルートテーブルを確認
goryu build --static                        # 本番用バイナリ

# AI エージェントにプロジェクトを操作させる
goryu mcp                                    # MCP サーバー（ルート一覧・生成・実行）
```

<div class="home-cta">

[CLI を見る →](/ja/cli)

</div>

</div>

<div class="home-section">

## Gin と同じ速さ。内蔵機能は 10 倍。 {#performance}

```
BenchmarkGoryu_JSON-8         1,245,364 ops/sec    967.2 ns/op
BenchmarkGin_JSON-8           1,232,113 ops/sec    977.2 ns/op
BenchmarkGoryu_Param-8        2,036,600 ops/sec    593.3 ns/op
BenchmarkGin_Param-8          2,015,674 ops/sec    590.9 ns/op
```

Go エコシステムには、Rails/Phoenix のような開発体験と Go の生の速度を兼ね備えたフレームワークが欠けていました。Goryu は高性能な Radix ツリールーターと最適化されたミドルウェアチェーンの上に構築されており、生産性と性能のどちらかを諦める必要はありません。

</div>

<div class="home-section">

## 3 コマンドでデプロイ {#quickstart}

```bash
go install github.com/arthurlch/goryu/cmd/goryu@latest
goryu init myapp --template=api
goryu scaffold ai chat --kind=chat   # 配線済みのストリーミングチャットエンドポイント
```

<div class="home-cta">

[5 分ではじめる →](/ja/guide/getting-started)

</div>

</div>

<div class="home-section">

## 設計思想 {#philosophy}

1. **シンプルなケースはシンプルなまま。** 手書きの REST API が、使わない AI 機能のコストを払うことはありません。
2. **まず人間のために、次に LLM に優しく。** 同じクリーンな API が両者に応えます。
3. **デフォルトで安全。すべてのレスポンス経路で。** 後付けでもオプトインでもありません。
4. **ストリーミングは第一級の市民。**
5. **コアは小さく安定に。広がりは contrib へ。**
6. **LLM が正しい Goryu コードを確実に生成できないなら、その API は凝りすぎです。**

</div>
