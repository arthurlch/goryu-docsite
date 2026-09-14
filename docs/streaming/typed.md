# Typed Streaming

The root `goryu` package provides two generic helpers that layer typed JSON encoding on top of [`c.SSE` and `c.Stream`](/streaming/sse). They let you stream Go values directly — no manual marshaling, no string building, no risk of malformed frames.

- `goryu.SSEJSON[T]` — typed Server-Sent Events, one JSON-encoded value per event.
- `goryu.StreamJSON[T]` — newline-delimited JSON (`application/x-ndjson`).

## Features

- **Generic** — stream any type `T`; each value is JSON-encoded for you.
- **Injection-safe** — values go through the JSON encoder, so nothing you emit can break the SSE or NDJSON framing.
- **Auto-flush** — like the primitives they build on, both flush after every value.
- **Disconnect-aware** — `SSEJSON` inherits `c.SSE`'s client-disconnect handling: the emit function returns an error when the client goes away.
- **Right headers** — `StreamJSON` sets `Content-Type: application/x-ndjson`; `SSEJSON` sets the SSE headers.

## `goryu.SSEJSON[T]`

```go
func SSEJSON[T any](c *Ctx, event string, producer func(send func(T) error) error) error
```

Each `send(v)` marshals `v` to JSON and emits it as an SSE event named `event`. This is the typed equivalent of calling `c.SSE` and building `SSEvent{Event: event, Data: string(jsonBytes)}` yourself.

### Example: streaming LLM tokens

This mirrors the `examples/aichat` service. A `Token` struct is streamed word-by-word as `token` events, ending with a `Done` marker:

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

Each event on the wire looks like:

```
event: token
data: {"index":0,"content":"Hello "}

event: token
data: {"index":1,"content":"there "}

event: token
data: {"index":2,"done":true}
```

Consume it in the browser with `EventSource`:

```js
const es = new EventSource("/chat/stream");
es.addEventListener("token", (e) => {
  const tok = JSON.parse(e.data);
  if (tok.done) return es.close();
  output.textContent += tok.content;
});
```

::: tip Typed body + typed stream
`SSEJSON` pairs naturally with [`goryu.Bind[T]`](/core/binding) for the request and [`goryu.Schema[T]`](/core/schema) for a machine-readable contract — decode a typed request, stream a typed response.
:::

## `goryu.StreamJSON[T]`

```go
func StreamJSON[T any](c *Ctx, producer func(emit func(T) error) error) error
```

Streams `T` values as newline-delimited JSON — one compact JSON object per line — with `Content-Type: application/x-ndjson`, flushing after each value. NDJSON is easy for machines to parse incrementally: read a line, decode it, repeat.

### Example: tailing records as NDJSON

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

Output is one object per line:

```
{"time":"2026-09-15T10:00:00Z","level":"info","message":"started"}
{"time":"2026-09-15T10:00:01Z","level":"warn","message":"slow query"}
```

Consume it with `curl` and `jq`, streaming line by line:

```sh
curl -Ns localhost:3000/logs/stream | jq -c .
```

Or in Go with a streaming decoder:

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

## SSEJSON vs StreamJSON

| | `SSEJSON[T]` | `StreamJSON[T]` |
|---|--------------|-----------------|
| Content-Type | `text/event-stream` | `application/x-ndjson` |
| Framing | `event:` + `data:` per value | one JSON object per line |
| Browser support | native `EventSource`, auto-reconnect | manual `fetch` + reader |
| Best for | live UI updates, LLM tokens | machine-to-machine record streams |
| Built on | [`c.SSE`](/streaming/sse) | [`c.Stream`](/streaming/sse) |

::: warning Streamed responses can't set headers afterward
Once streaming has started the headers are already sent. Do any header or status setup before calling `SSEJSON`/`StreamJSON`. If you need to record usage or metrics after the stream, do it out-of-band (see the `aimeter` metering pattern in `examples/aichat`).
:::
