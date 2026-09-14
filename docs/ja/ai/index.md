# Goryu で AI/LLM バックエンドを構築する

Go は、モデルの前段にあるインフラ、すなわちゲートウェイ、エージェント
サーバー、推論プロキシ、RAG API、評価ハーネスをチームが構築する場です。そうしたコードには
Go が得意とすること — ストリーミング、並行処理、厳しいレイテンシ要求、小さなバイナリ —
に加えて、どのチームも結局は作り直すことになる、AI 特有の少数の関心事が必要になります。
すなわち、トークンとコストの計測、同一プロンプトのキャッシュ、シークレットを漏らさずに
プロバイダへ転送すること、そして評価のためにやり取りを記録することです。

Goryu はそれらのバッテリーを同梱しています。それらはごく普通の `*goryu.Ctx` のミドルウェアと
ヘルパーなので、アプリの残りの部分と組み合わせて構成でき、必要なときにはいつでも生の
`net/http` に降りることができます。

## AI ツールボックス

| パーツ | 何をするか | ドキュメント |
|-------|--------------|------|
| トークン & コスト計測 | プロンプト/コンプリーションのトークンを計上し、USD コストを算出し、キー単位のリクエスト/トークン予算を強制します | [/ai/metering](/ja/ai/metering) |
| プロンプトキャッシュ | リクエストボディをキーとして `POST` レスポンスをキャッシュします。プライバシーガード付きです | [/ai/prompt-cache](/ja/ai/prompt-cache) |
| プロバイダプロキシ | 呼び出し元のシークレットを取り除いたうえで、上流プロバイダへストリーミング/転送します | [/ai/provider-proxy](/ja/ai/provider-proxy) |
| 評価記録 | すべてのリクエスト/レスポンスのペアを評価用に NDJSON（または任意のシンク）へ追記します | [/ai/recording](/ja/ai/recording) |
| AI スキャフォールド | すぐに実行できる AI サービスのスケルトンを生成します | [/ai/scaffolds](/ja/ai/scaffolds) |
| llms.txt & API リファレンス | `/llms.txt` でツールや LLM に API を公開します | [/ai/llms-txt](/ja/ai/llms-txt) |
| MCP サーバー | ルートを Model Context Protocol のツールとして提供します | [/ai/mcp](/ja/ai/mcp) |

これらは、AI バックエンドが強く依存する Goryu のコアプリミティブの上に構築されています。

- [型付きストリーミング](/ja/streaming/typed) — `SSEJSON[T]` は型付きトークンを
  Server-Sent Events でストリーミングします。これはほとんどのチャット UI が期待する形です。
- [バインディング & バリデーション](/ja/core/binding) — `Bind[T]` は
  リクエストボディを（オプションの `Validate()` フックを介して）デコード・検証し、型付き構造体にします。
- [JSON Schema](/ja/core/schema) — `Schema[T]()` はリクエスト型から JSON Schema を
  導出します。これを LLM にレスポンススキーマとして渡したり、クライアントに
  バリデーション用として渡したりできます。

## それらがどう組み合わさるか

本番の AI エンドポイントは通常、1 つのハンドラを包む小さなミドルウェアのスタックです。

```
recorder      → captures the exchange for evals (outermost)
  aimeter     → enforces budgets, accounts tokens & cost
    promptcache → serves identical prompts from cache (non-streaming routes)
      handler → binds the request, calls the model, reports usage
```

順序が重要です。recorder は最も外側に位置し、キャッシュヒットや 429 を含めてすべてを
捕捉します。次に meter が動作し、何らかの処理が起きる前に予算が強制され、ハンドラの
リターン後に使用量が計上されます。プロンプトキャッシュは、キャッシュが安全なルート
（非ストリーミング）だけを包みます。ハンドラは `aimeter.SetUsage` でトークンの使用量を
報告し、meter と recorder の両方がそれを読み取ります。

## ウォークスルー: `aichat` サービス

`examples/aichat` サービスは、これらすべてを 1 つの実行可能なプログラムに配線しています。
偽のローカル「LLM」を同梱しているため、**API キーなし** で動作します。以下はその
サービスの構成に注釈を付けたものです。

### 型付きリクエスト、バリデーション、スキーマ

リクエストボディは、`Validate()` フックと `jsonschema` タグを持つ素の構造体です。
`Bind[ChatRequest]` はそれをデコード・検証し、`Schema[ChatRequest]()` は
同じ型を JSON Schema エンドポイントに変えます。

```go
type Message struct {
    Role    string `json:"role" jsonschema:"description=Speaker role,enum=system|user|assistant"`
    Content string `json:"content" jsonschema:"description=Message text,minLength=1"`
}

type ChatRequest struct {
    Model    string    `json:"model" jsonschema:"description=Model to use,enum=fast|smart"`
    Messages []Message `json:"messages" jsonschema:"description=Conversation so far"`
    Stream   bool      `json:"stream,omitempty"`
}

// Validate runs automatically inside Bind[ChatRequest].
func (r ChatRequest) Validate() error {
    if len(r.Messages) == 0 {
        return errors.New("messages: at least one message is required")
    }
    if r.Model != "fast" && r.Model != "smart" {
        return errors.New("model: must be 'fast' or 'smart'")
    }
    return nil
}
```

### ミドルウェアスタック

```go
func main() {
    app := goryu.New(goryu.Config{AppName: "aichat"})

    // Eval recording (outermost): capture every request/response pair.
    sink, err := recorder.NewFileSink("evals.jsonl")
    if err != nil {
        log.Fatalf("open eval sink: %v", err)
    }
    defer func() { _ = sink.Close() }()

    app.Use(recorder.New(recorder.Config{
        Sink:    sink,
        KeyFunc: apiKey,
        MetaFunc: func(c *goryu.Ctx) map[string]any {
            u, _ := aimeter.GetUsage(c) // usage the handler reported
            return map[string]any{"tokens": u.Total()}
        },
    }))

    // Metering + per-key limits: pricing + 60 req/min + 100k tokens/min.
    app.Use(aimeter.New(aimeter.Config{
        KeyGenerator:        apiKey,
        PromptCostPer1K:     0.0005,
        CompletionCostPer1K: 0.0015,
        MaxRequests:         60,
        MaxTokens:           100_000,
        Window:              time.Minute,
        OnResult: func(c *goryu.Ctx, r aimeter.Result) {
            log.Printf("meter key=%s tokens=%d cost=$%.5f", r.Key, r.Usage.Total(), r.CostUSD)
        },
    }))

    // Streaming endpoint: tokens over SSE. Not cached (streams pass through).
    app.POST("/chat/stream", chatStream)

    // Schema endpoint: hand this to an LLM as a response schema, or to clients.
    app.GET("/chat/schema", func(c *goryu.Ctx) {
        _ = c.JSON(200, goryu.Schema[ChatRequest]())
    })

    // Non-streaming endpoint, wrapped in the prompt cache: identical bodies
    // return the cached answer (see the X-Cache header) without re-running.
    cached := app.Group("", promptcache.New(promptcache.Config{
        Expiration: 5 * time.Minute,
    }))
    cached.POST("/chat", chat)

    // Optional: stream straight through to a real provider when configured.
    if base := os.Getenv("PROVIDER_BASE_URL"); base != "" {
        px := aiproxy.New(aiproxy.Config{
            BaseURL: base,
            APIKey:  os.Getenv("PROVIDER_API_KEY"),
        })
        app.POST("/v1/chat/completions", func(c *goryu.Ctx) {
            if err := px.Stream(c, "/v1/chat/completions"); err != nil {
                log.Printf("proxy error: %v", err)
            }
        })
    }

    // Expose the API to tools and LLMs at /llms.txt and /llms.json.
    app.MountLLMs()

    log.Println("aichat listening on :3000")
    _ = app.Run(":3000")
}
```

### ハンドラが使用量を報告する

どちらのハンドラも、返信を生成した後に `aimeter.SetUsage` を呼び出します。その 1 回の
呼び出しが、meter（コストと予算の計上のため）と recorder の `MetaFunc` の両方に情報を供給します。

```go
func chatStream(c *goryu.Ctx) {
    req, err := goryu.Bind[ChatRequest](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }

    words := strings.Fields(fakeReply(req))
    completion := 0

    // Typed tokens over SSE.
    _ = goryu.SSEJSON(c, "token", func(send func(Token) error) error {
        for i, w := range words {
            if err := send(Token{Index: i, Content: w + " "}); err != nil {
                return err
            }
            completion++
        }
        return send(Token{Index: len(words), Done: true})
    })

    // Report usage so aimeter/recorder can account it. On a streamed response
    // headers won't apply, but OnResult and the eval record still capture it.
    aimeter.SetUsage(c, aimeter.Usage{
        PromptTokens:     promptTokens(req),
        CompletionTokens: completion,
    })
}
```

### 試してみる

```sh
go run ./examples/aichat
```

::: code-group

```sh [stream]
curl -N -X POST localhost:3000/chat/stream \
     -H 'Content-Type: application/json' -H 'X-API-Key: demo' \
     -d '{"model":"fast","messages":[{"role":"user","content":"hello there"}]}'
```

```sh [non-streaming + cache]
# Send twice and watch X-Cache go MISS -> HIT.
curl -i -X POST localhost:3000/chat \
     -H 'Content-Type: application/json' -H 'X-API-Key: demo' \
     -d '{"model":"smart","messages":[{"role":"user","content":"ping"}]}'
```

```sh [schema]
curl localhost:3000/chat/schema
```

:::

::: tip
型付きバインディングは `Content-Type: application/json` によって選択されます。`curl -d`
はデフォルトでフォームエンコーディングになるため、chat ルートでは常にこのヘッダーを渡してください。
:::

## 次に進む先

- [トークン & コスト計測](/ja/ai/metering)
- [プロンプトキャッシュ](/ja/ai/prompt-cache)
- [プロバイダプロキシ](/ja/ai/provider-proxy)
- [評価記録](/ja/ai/recording)
- [型付きストリーミング](/ja/streaming/typed) · [バインディング & バリデーション](/ja/core/binding) · [JSON Schema](/ja/core/schema)
