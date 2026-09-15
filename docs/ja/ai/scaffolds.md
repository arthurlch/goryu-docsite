# AI スキャフォールド

Goryu の CLI は、すぐに配線できる LLM エンドポイントを生成するため、空のファイルの
代わりに、型付き・検証済み・ストリーミング対応のハンドラーから始められます。すべての
AI スキャフォールドは同じ基盤を使います。[`goryu.Bind[T]`](/ja/core/binding) による
型付きリクエストバインディング、入力の `Validate()`、`goryu.Schema[T]` による
JSON Schema、そして [`aimeter`](/ja/ai/metering) ミドルウェアによるトークン計上です。

方法は 2 つあります。用途特化のスキャフォールドコマンドと、汎用のハンドラー
ジェネレーターです。

```bash
# Focused: scaffolds an AI endpoint and prints the middleware wiring to add
goryu scaffold ai <name> --kind=chat|rag|agent

# General: the handler generator with the ai type
goryu generate handler <name> --type=ai --kind=chat|rag|agent
```

どちらも同じファイルを生成します。`scaffold ai` は薄いラッパーで、加えて推奨される
ミドルウェアと `app.MountLLMs()` の配線を後から表示します。

## 機能

- **3 つの種類**: `chat`（ストリーミング SSE チャット）、`rag`（ソース付きの
  「取得してから回答」）、`agent`（function calling スキーマを備えた型付き
  ツールエンドポイント）。
- **型付きかつ検証済み**: リクエスト型は `Validate()` を実装し、`goryu.Bind[T]` で
  バインドされます。不正または無効な入力に対しては `400` を返します。
- **自己記述的**: 各種類には `goryu.Schema[T]()` から構築されたスキーマルートが
  同梱されるため、クライアントやエージェントがリクエスト形状を発見できます。
- **デフォルトで計測**: ハンドラーは `aimeter.SetUsage` を呼び出すため、`aimeter`
  ミドルウェアがトークンとコストを計上できます。
- **魔法ではなくスタブ**: プロバイダー呼び出しは明確にマークされた `TODO` です。
  実際のモデル呼び出しに差し替えてください（[プロバイダープロキシ](/ja/ai/provider-proxy)
  を参照）。

## 使い方

### チャットエンドポイントをスキャフォールドする

```bash
goryu scaffold ai chat --kind=chat
```

```
🤖 Scaffolding chat AI endpoint: chat
🚀 Generating ai handler: chat
✅ Handler created: internal/handlers/chat.go

💡 Handler Tips:
  • Register routes:
    - app.POST("/chat/stream", handlers.ChatStream)  // SSE token streaming
    - app.GET("/chat/schema", handlers.ChatSchema)   // JSON Schema
  • Meter tokens/cost: app.Use(aimeter.New(aimeter.Config{...}))
  • Cache prompts:     app.Use(promptcache.New())
  • Record for evals:  app.Use(recorder.New(recorder.Config{Sink: sink}))
  • Replace the stubbed reply with a real provider call (see aiproxy)

💡 Wire the AI middleware in your main.go:
  app.Use(aimeter.New(aimeter.Config{...}))     // token/cost metering
  app.Use(promptcache.New())                    // cache identical prompts
  app.Use(recorder.New(recorder.Config{Sink: sink})) // record for evals
  app.MountLLMs()                               // serve /llms.txt
```

::: tip 名前は Go 識別子として扱われる
`chat` は `Chat` プレフィックスと `/chat` ルートプレフィックスになります。`my-bot`
は `MyBot` / `/my-bot` になります。名前には英字、数字、`-`、`_` を含められます。
:::

### 3 つの種類

#### `chat` — ストリーミング SSE チャット

`jsonschema` タグを持つリクエスト / メッセージモデル、メッセージが少なくとも 1 つ
必要な `Validate()`、SSE ストリーミングハンドラー、およびスキーマルートを生成
します。

```go
type ChatMessage struct {
    Role    string `json:"role" jsonschema:"description=Speaker role,enum=system|user|assistant"`
    Content string `json:"content" jsonschema:"description=Message text,minLength=1"`
}

type ChatRequest struct {
    Model    string        `json:"model" jsonschema:"description=Model to use,enum=fast|smart"`
    Messages []ChatMessage `json:"messages" jsonschema:"description=Conversation so far"`
}

func (r ChatRequest) Validate() error { /* requires >= 1 message */ }

// POST /chat/stream — streams tokens over SSE, then reports usage.
func ChatStream(c *goryu.Context) {
    req, err := goryu.Bind[ChatRequest](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }

    // TODO: replace the stub with a real provider call and stream its tokens.
    _ = goryu.SSEJSON(c, "token", func(send func(ChatToken) error) error {
        // send(ChatToken{Index: i, Content: ...})
        return send(ChatToken{Index: n, Done: true})
    })

    aimeter.SetUsage(c, aimeter.Usage{PromptTokens: prompt, CompletionTokens: completion})
}

// GET /chat/schema — serves the JSON Schema for ChatRequest.
func ChatSchema(c *goryu.Context) {
    _ = c.JSON(200, goryu.Schema[ChatRequest]())
}
```

トークンは `{"index":N,"content":"..."}` という形の `event: token` SSE フレームと
して発行され、`{"index":N,"done":true}` で終了します。SSE レスポンスは
ストリーミングされるたびにフラッシュされるため、`aimeter` の `X-Tokens-*` ヘッダーは
設定できません。使用量は `SetUsage` で報告され、代わりに計測ミドルウェアの
`OnResult` フックを通じて公開されます。[ストリーミング](/ja/streaming/sse)と
[トークン・コスト計測](/ja/ai/metering)を参照してください。

#### `rag` — 取得してから回答、ソース付き

クエリ型（`question` + 任意の `top_k`）、スタブのリトリーバー、そしてコンテキストを
取得し、回答し、使用したソースを返すハンドラーを生成します。

```go
type AskQuery struct {
    Question string `json:"question" jsonschema:"description=User question,minLength=1"`
    TopK     int    `json:"top_k,omitempty" jsonschema:"description=Documents to retrieve,minimum=1,maximum=20"`
}

type AskAnswer struct {
    Answer  string      `json:"answer"`
    Sources []AskSource `json:"sources"` // {id, score, text}
}

// POST /ask — retrieves context for the question and answers with sources.
func AskAsk(c *goryu.Context) {
    q, err := goryu.Bind[AskQuery](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }

    sources := retrieveAsk(q.Question, topK) // TODO: replace stub with a vector-store query
    answer := "TODO: answer using the retrieved sources."

    aimeter.SetUsage(c, aimeter.Usage{
        PromptTokens:     questionTokens + contextTokens,
        CompletionTokens: answerTokens,
    })
    _ = c.JSON(200, AskAnswer{Answer: answer, Sources: sources})
}
```

`retrieve<Name>` は、プレースホルダーのパッセージを返すスタブです。ベクターストアへの
クエリに置き換えてください。`TopK` は省略時に `3` がデフォルトです。プロンプト
使用量は、質問のトークン数に取得したコンテキストのトークン数を加えた値として
計測されます。

#### `agent` — 型付きツールエンドポイント + function calling スキーマ

`Input` / `Result` のペアを持つ型付きツール、実行ハンドラー、および function calling に
適した OpenAI スタイルのツール定義を発行するスキーマルートを生成します。

```go
type SearchInput struct {
    Query string `json:"query" jsonschema:"description=What the tool should act on,minLength=1"`
}

type SearchResult struct {
    Output string `json:"output"`
}

// POST /tools/search — runs the tool and returns its result.
func SearchTool(c *goryu.Context) {
    in, err := goryu.Bind[SearchInput](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }
    // TODO: execute the tool for in.Query.
    _ = c.JSON(200, SearchResult{Output: "..."})
}

// GET /tools/search/schema — an OpenAI-style tool definition for function calling.
func SearchToolSchema(c *goryu.Context) {
    _ = c.JSON(200, goryu.Map{
        "name":        "search",
        "description": "TODO: describe what this tool does",
        "parameters":  goryu.Schema[SearchInput](),
    })
}
```

スキーマルートは `{name, description, parameters}` を返します。これはモデルが
`tools` 配列で期待する形そのものです。`GET /tools/<name>/schema` からの JSON を
モデルに与え、そのツール呼び出しを `POST /tools/<name>` にルーティングしてください。

::: code-group

```bash [chat]
goryu scaffold ai support --kind=chat
```

```bash [rag]
goryu scaffold ai docs --kind=rag
```

```bash [agent]
goryu scaffold ai search --kind=agent
```

:::

## フラグ

どちらのコマンドも AI タイプに対して同じオプションを受け付けます。

| フラグ | 対象 | 説明 | デフォルト |
|------|-----------|-------------|---------|
| `--kind` (`-k`) | 両方 | `chat`、`rag`、`agent` | `chat` |
| `--path` (`-p`) | 両方 | 出力ディレクトリ | `internal/handlers` |
| `--type` (`-t`) | `generate handler` | ハンドラータイプ。AI の種類には `ai` を使用 | `basic` |

未知の `--kind` は拒否されます。

```
$ goryu generate handler chat --type=ai --kind=vision
Error: unknown ai kind: vision (available: chat, rag, agent)
```

## スキャフォールドの後

生成されるファイルはハンドラーのみです。ルートを登録し、AI ミドルウェアを
`main.go` で配線してください。

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/aimeter"
    "github.com/arthurlch/goryu/middleware/promptcache"
    "github.com/arthurlch/goryu/middleware/recorder"

    "yourmodule/internal/handlers"
)

func main() {
    app := goryu.New()

    // AI middleware
    app.Use(aimeter.New(aimeter.Config{ // token/cost metering + per-key budgets
        PromptCostPer1K:     0.003,
        CompletionCostPer1K: 0.015,
    }))
    app.Use(promptcache.New())                            // cache identical prompts
    app.Use(recorder.New(recorder.Config{Sink: sink}))    // record for evals

    // Routes (printed in the CLI tips for each kind)
    app.POST("/chat/stream", handlers.ChatStream)
    app.GET("/chat/schema", handlers.ChatSchema)

    app.MountLLMs() // serve GET /llms.txt and GET /llms.json

    _ = app.Listen(":3000")
}
```

- [トークン・コスト計測](/ja/ai/metering) — リクエストごとにトークンとコストを計上します。
- [プロンプトキャッシュ](/ja/ai/prompt-cache) — 同一の（POST）プロンプトをキャッシュします。
- [評価用レコーディング](/ja/ai/recording) — 評価のためにリクエスト / レスポンスを
  キャプチャします。
- [プロバイダープロキシ](/ja/ai/provider-proxy) — スタブの返答を実際のプロバイダー
  呼び出しに置き換えます。
- [llms.txt & API リファレンス](/ja/ai/llms-txt) — `app.MountLLMs()` がルートの
  機械可読なインデックスを公開します。

::: tip エージェントが発見できるように
`/schema` ルートを [`app.MountLLMs()`](/ja/ai/llms-txt) および [`goryu mcp`](/ja/ai/mcp)
サーバーと組み合わせることで、コーディングエージェントは手書きのドキュメントなしに、
あなたのエンドポイントを見つけ、そのリクエストスキーマを読み、それらを呼び出せます。
:::
