# Recorder Middleware

Captures request/response pairs for building **eval datasets**. Each completed request is written to a `Sink` as a structured `Record`; the bundled `FileSink` appends newline-delimited JSON (NDJSON), the usual input format for offline eval pipelines.

::: tip Looking for the guide?
This page is the middleware reference. For a walkthrough of building eval datasets, custom sinks, and enriching records with model/token metadata, see the [Recording guide](/ai/recording).
:::

## Features

- **Structured records**: method, path, status, latency, request/response bodies.
- **Pluggable sinks**: implement `Sink` (DB, queue, blob) or use the bundled `FileSink`.
- **Bounded capture**: per-body byte cap; toggle request/response capture.
- **Body-safe**: the request body is read and restored so handlers still see it in full.
- **Enrichable**: `KeyFunc` and `MetaFunc` attach a caller key and metadata (model, token usage, etc.).

## Usage

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

Each line of `evals.jsonl` looks like:

```json
{"time":"2026-09-14T10:00:00Z","method":"POST","path":"/chat","status":200,"latency_ms":812,"key":"k-123","request_body":{"q":"life"},"response_body":{"answer":"42"},"meta":{"model":"gpt-x","tokens":1156}}
```

`recorder.Default()` builds the middleware with no sink — a pass-through until you supply a `Sink` via `New`.

## Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| Sink | `Sink` | Where records go (required) | none (no-op) |
| MaxBodyBytes | `int64` | Max bytes captured per body | `64 KiB` |
| CaptureRequest | `*bool` | Capture request body | `true` |
| CaptureResponse | `*bool` | Capture response body | `true` |
| KeyFunc | `func(c) string` | Caller/session key | none |
| MetaFunc | `func(c) map[string]any` | Extra metadata | none |

## How It Works

For each request the middleware:

1. **Skips** when no `Sink` is configured (or `Skip` returns true).
2. **Captures the request body** (up to `MaxBodyBytes`) when `CaptureRequest` is on, then restores it so the handler still reads it in full.
3. **Wraps the writer** to capture the response body (up to `MaxBodyBytes`) when `CaptureResponse` is on, while streaming through to the client.
4. **Runs the handler**, timing its latency.
5. **Builds a `Record`** — time, method, path, status, latency, bodies, plus the `KeyFunc` key and `MetaFunc` metadata — and writes it to the `Sink`. A sink write error is logged, not fatal.

The bundled `FileSink` marshals each record to a JSON line, flushes after every write, and is safe for concurrent use.

## Notes

- Non-JSON bodies are stored as JSON strings so every record marshals cleanly.
- `FileSink` flushes after each record; for high-throughput recording, implement a buffered or async `Sink`.
- Bodies are truncated at `MaxBodyBytes`; raise it for large prompts.
