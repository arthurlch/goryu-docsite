# 型付きストリーミング

ルートの `goryu` パッケージは、[`c.SSE` と `c.Stream`](/ja/streaming/sse) の上に型付きの JSON エンコードを重ねる 2 つのジェネリックヘルパーを提供します。これらを使うと、Go の値を直接ストリーミングできます。手動でのマーシャリングも、文字列の組み立ても、不正なフレームのリスクもありません。

- `goryu.SSEJSON[T]` — 型付きの Server-Sent Events。イベントごとに 1 つの JSON エンコード済みの値。
- `goryu.StreamJSON[T]` — 改行区切り JSON（`application/x-ndjson`）。

## 機能

- **ジェネリック** — 任意の型 `T` をストリーミングできます。各値は自動で JSON エンコードされます。
- **インジェクション安全** — 値は JSON エンコーダーを通るため、発行する内容が SSE や NDJSON のフレーミングを壊すことはありません。
- **自動フラッシュ** — 基盤とするプリミティブと同様、どちらも値ごとにフラッシュします。
- **切断検知** — `SSEJSON` は `c.SSE` のクライアント切断処理を継承します。クライアントがいなくなると emit 関数がエラーを返します。
- **正しいヘッダー** — `StreamJSON` は `Content-Type: application/x-ndjson` を設定し、`SSEJSON` は SSE ヘッダーを設定します。

## `goryu.SSEJSON[T]`

```go
func SSEJSON[T any](c *Ctx, event string, producer func(send func(T) error) error) error
```

各 `send(v)` は `v` を JSON にマーシャルし、`event` という名前の SSE イベントとして発行します。これは `c.SSE` を呼び出して `SSEvent{Event: event, Data: string(jsonBytes)}` を自分で組み立てることの型付き等価物です。

### 例: LLM トークンのストリーミング

これは `examples/aichat` サービスを模したものです。`Token` 構造体を単語ごとに `token` イベントとしてストリーミングし、`Done` マーカーで終了します。

```go
import (
    "strings"
    "time"

    "github.com/arthurlch/goryu"
)

// Token is a single streamed chunk of the reply.
type Token struct {
    Index   int    `json:"index"`
    Content string `json:"content,omitempty"`
    Done    bool   `json:"done,omitempty"`
}

func chatStream(c *goryu.Ctx) {
    req, err := goryu.Bind[ChatRequest](c)
    if err != nil {
        _ = c.JSON(400, goryu.Map{"error": err.Error()})
        return
    }

    words := strings.Fields(generate(req))

    err = goryu.SSEJSON(c, "token", func(send func(Token) error) error {
        for i, w := range words {
            if err := send(Token{Index: i, Content: w + " "}); err != nil {
                return err // client disconnected — stop generating
            }
            time.Sleep(40 * time.Millisecond) // simulate generation latency
        }
        return send(Token{Index: len(words), Done: true})
    })
    if err != nil {
        log.Printf("stream aborted: %v", err)
    }
}
```

通信路上の各イベントは次のようになります。

```
event: token
data: {"index":0,"content":"Hello "}

event: token
data: {"index":1,"content":"there "}

event: token
data: {"index":2,"done":true}
```

ブラウザでは `EventSource` で消費します。

```js
const es = new EventSource("/chat/stream");
es.addEventListener("token", (e) => {
  const tok = JSON.parse(e.data);
  if (tok.done) return es.close();
  output.textContent += tok.content;
});
```

::: tip 型付きボディ + 型付きストリーム
`SSEJSON` は、リクエストのための [`goryu.Bind[T]`](/ja/core/binding) と、機械可読な契約のための [`goryu.Schema[T]`](/ja/core/schema) と自然に組み合わさります。型付きのリクエストをデコードし、型付きのレスポンスをストリーミングできます。
:::

## `goryu.StreamJSON[T]`

```go
func StreamJSON[T any](c *Ctx, producer func(emit func(T) error) error) error
```

`T` の値を改行区切り JSON として（1 行につき 1 つのコンパクトな JSON オブジェクト）ストリーミングします。`Content-Type: application/x-ndjson` を設定し、値ごとにフラッシュします。NDJSON は機械がインクリメンタルにパースしやすい形式です。1 行を読み、デコードし、それを繰り返します。

### 例: レコードを NDJSON で追跡する

```go
import "github.com/arthurlch/goryu"

type LogEntry struct {
    Time    string `json:"time"`
    Level   string `json:"level"`
    Message string `json:"message"`
}

app.GET("/logs/stream", func(c *goryu.Ctx) {
    _ = goryu.StreamJSON(c, func(emit func(LogEntry) error) error {
        for entry := range logChannel {
            if err := emit(entry); err != nil {
                return err // consumer closed the connection
            }
        }
        return nil
    })
})
```

出力は 1 行につき 1 オブジェクトです。

```
{"time":"2026-09-15T10:00:00Z","level":"info","message":"started"}
{"time":"2026-09-15T10:00:01Z","level":"warn","message":"slow query"}
```

`curl` と `jq` で行ごとにストリーミングしながら消費します。

```sh
curl -Ns localhost:3000/logs/stream | jq -c .
```

または Go でストリーミングデコーダーを使います。

```go
dec := json.NewDecoder(resp.Body)
for {
    var e LogEntry
    if err := dec.Decode(&e); err == io.EOF {
        break
    } else if err != nil {
        return err
    }
    handle(e)
}
```

## SSEJSON と StreamJSON の比較

| | `SSEJSON[T]` | `StreamJSON[T]` |
|---|--------------|-----------------|
| Content-Type | `text/event-stream` | `application/x-ndjson` |
| フレーミング | 値ごとに `event:` + `data:` | 1 行につき 1 つの JSON オブジェクト |
| ブラウザ対応 | ネイティブの `EventSource`、自動再接続 | 手動の `fetch` + リーダー |
| 最適な用途 | ライブ UI 更新、LLM トークン | マシン間のレコードストリーム |
| 基盤 | [`c.SSE`](/ja/streaming/sse) | [`c.Stream`](/ja/streaming/sse) |

::: warning ストリーミングされたレスポンスは後からヘッダーを設定できない
ストリーミングが始まると、ヘッダーはすでに送信済みです。ヘッダーやステータスの設定は、`SSEJSON` / `StreamJSON` を呼び出す前に行ってください。ストリームの後に使用量やメトリクスを記録する必要がある場合は、帯域外で行ってください（`examples/aichat` の `aimeter` 計測パターンを参照）。
:::
