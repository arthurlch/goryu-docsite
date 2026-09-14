# Eval Recording

`recorder` captures request/response pairs for building **eval datasets**. Each
completed request is written to a `Sink` as a structured `Record`; the bundled
`FileSink` appends newline-delimited JSON (NDJSON), the usual input format for
offline eval pipelines. Bodies are captured (capped) and the full request body is
restored so your handler still reads it.

```go
import "github.com/arthurlch/goryu/middleware/recorder"
```

## Features

- **Structured records**: time, method, path, status, latency, request/response
  bodies, key, and metadata.
- **Pluggable sinks**: implement the `Sink` interface (DB, queue, blob store) or
  use the bundled `FileSink`.
- **Bounded capture**: a per-body byte cap; request/response capture can each be
  toggled off.
- **Body-safe**: the request body is read and restored so handlers still see it.
- **Enrichable**: `KeyFunc` and `MetaFunc` attach a caller key and metadata such
  as model and token usage.

## Usage

### FileSink to NDJSON

Open a `FileSink` at startup and close it on shutdown; install the recorder as
the outermost middleware so it captures everything, including cache hits and
error responses.

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

Each line of `evals.jsonl` is one `Record`:

```json
{"time":"2026-09-14T10:00:00Z","method":"POST","path":"/chat","status":200,"latency_ms":812,"key":"k-123","request_body":{"q":"life"},"response_body":{"answer":"42"},"meta":{"model":"gpt-x","tokens":1156}}
```

### Enrich records with token usage

`MetaFunc` runs after the handler, so it can read the usage the handler reported
via `aimeter.SetUsage`. This is the canonical way to join eval records to token
and cost data.

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

::: tip Order the recorder outermost
Install `recorder` before `aimeter` (so it wraps it). It then records `429`
rejections and prompt-cache hits too — and because `MetaFunc` runs after the
handler, the usage set by the handler is available.
:::

### Control what gets captured

`CaptureRequest` and `CaptureResponse` are `*bool` so you can distinguish "unset"
(defaults to `true`) from an explicit `false`.

```go
noBody := false
app.Use(recorder.New(recorder.Config{
    Sink:            sink,
    CaptureResponse: &noBody, // record metadata only, skip response bodies
    MaxBodyBytes:    256 << 10, // raise the cap for large prompts
}))
```

### A custom sink

Any type with a `Write(Record) error` method is a sink — send records to a
database, a queue, or an async buffer.

```go
type QueueSink struct{ ch chan recorder.Record }

func (s QueueSink) Write(r recorder.Record) error {
    s.ch <- r
    return nil
}

app.Use(recorder.New(recorder.Config{Sink: QueueSink{ch: buf}}))
```

## The Record

| Field | JSON | Notes |
|-------|------|-------|
| Time | `time` | when the request started |
| Method | `method` | HTTP method |
| Path | `path` | request path |
| Status | `status` | response status code |
| LatencyMS | `latency_ms` | handler duration in ms |
| Key | `key` | from `KeyFunc` (omitted if empty) |
| RequestBody | `request_body` | captured request body (capped) |
| ResponseBody | `response_body` | captured response body (capped) |
| Meta | `meta` | from `MetaFunc` |

## Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| Sink | `Sink` | Where records go (required — no sink means pass-through) | none |
| MaxBodyBytes | `int64` | Max bytes captured per body | `64 KiB` |
| CaptureRequest | `*bool` | Capture request body | `true` |
| CaptureResponse | `*bool` | Capture response body | `true` |
| KeyFunc | `func(c) string` | Caller/session key | none |
| MetaFunc | `func(c) map[string]any` | Extra metadata | none |

## Notes

- Non-JSON bodies are stored as JSON strings so every record marshals cleanly;
  valid JSON is stored verbatim.
- Bodies are truncated at `MaxBodyBytes` — raise it for large prompts.
- `FileSink` flushes after each record and is safe for concurrent use. For
  high-throughput recording, back it with a buffered or async sink.
- With no `Sink` configured the middleware is a no-op pass-through.
