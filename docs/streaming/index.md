# Streaming

Goryu ships with a small set of streaming primitives for pushing data to clients incrementally instead of buffering a whole response. They cover the common real-time patterns: Server-Sent Events, raw chunked responses, typed JSON streams, and full-duplex WebSockets.

Every primitive flushes as it writes, so bytes reach the client the moment you produce them. They all build on the same `http.Flusher` machinery, and the SSE/typed helpers respect client disconnects through the request context.

## Features

- **Server-Sent Events** — `c.SSE` for `text/event-stream` with `id`, `event`, and `retry` fields and automatic per-event flushing.
- **Raw chunked streams** — `c.Stream` hands you a flushing `io.Writer` for arbitrary byte streams (CSV, logs, custom protocols).
- **Typed SSE** — `goryu.SSEJSON[T]` marshals each value to JSON and sends it as an SSE event, safe from data injection.
- **NDJSON** — `goryu.StreamJSON[T]` emits newline-delimited JSON (`application/x-ndjson`), ideal for token streams and log tailing.
- **WebSockets** — `websocket.Upgrade` for full-duplex, bidirectional messaging with a zero-dependency implementation.

## Choosing a primitive

| Primitive | Direction | Content-Type | Best for |
|-----------|-----------|--------------|----------|
| [`c.SSE`](/streaming/sse) | Server → client | `text/event-stream` | Progress updates, notifications, live feeds with named events and auto-reconnect |
| [`c.Stream`](/streaming/sse) | Server → client | you set it | Raw bytes: CSV export, log tailing, custom framing |
| [`goryu.SSEJSON[T]`](/streaming/typed) | Server → client | `text/event-stream` | Typed SSE where each event carries a JSON payload (LLM tokens, structured events) |
| [`goryu.StreamJSON[T]`](/streaming/typed) | Server → client | `application/x-ndjson` | Typed record streams consumed line-by-line (NDJSON) |
| [`websocket.Upgrade`](/streaming/websocket) | Bidirectional | WebSocket | Chat, collaborative editing, anything needing client → server messages |

::: tip Rule of thumb
If the browser only needs to *receive* a live stream, reach for SSE (`c.SSE` or `SSEJSON`). If you need the client to *send* messages back on the same connection, use a WebSocket. For machine-to-machine record streams, NDJSON via `StreamJSON` is the simplest choice.
:::

## At a glance

Typed Server-Sent Events, one line:

```go
goryu.SSEJSON(c, "token", func(send func(Token) error) error {
    for i, w := range words {
        if err := send(Token{Index: i, Content: w}); err != nil {
            return err
        }
    }
    return nil
})
```

Newline-delimited JSON:

```go
goryu.StreamJSON(c, func(emit func(Record) error) error {
    for _, r := range records {
        if err := emit(r); err != nil {
            return err
        }
    }
    return nil
})
```

A WebSocket echo loop:

```go
conn, err := websocket.Upgrade(c)
if err != nil {
    return
}
defer conn.Close()
for {
    mt, msg, err := conn.ReadMessage()
    if err != nil {
        break
    }
    _ = conn.WriteMessage(mt, msg)
}
```

## Learn more

- [Server-Sent Events & raw streams](/streaming/sse) — `c.SSE` and `c.Stream`
- [Typed streaming](/streaming/typed) — `goryu.SSEJSON[T]` and `goryu.StreamJSON[T]`
- [WebSockets](/streaming/websocket) — `websocket.Upgrade` and the `Conn` API
