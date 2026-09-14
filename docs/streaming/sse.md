# Server-Sent Events & Raw Streams

Goryu's `Ctx` exposes two low-level streaming methods: `c.SSE` for Server-Sent Events and `c.Stream` for a raw flushing writer. Both take over the response, write headers immediately, and flush after every write so the client sees data as it is produced.

## Features

- **`c.SSE`** — emits a `text/event-stream` response with correct headers (`Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`).
- **Full event fields** — set `id`, `event`, `retry`, and multi-line `data` per event via the `SSEvent` struct.
- **Auto-flush** — every event is flushed to the client the instant you send it.
- **Disconnect-aware** — `send` returns an error as soon as the client's request context is cancelled, so your producer stops naturally.
- **Injection-safe framing** — newlines in `id`/`event` are stripped and multi-line `data` is split into `data:` lines, so a value can't break the SSE protocol.
- **`c.Stream`** — hands you a flushing `io.Writer` for arbitrary chunked output; you control the `Content-Type`.

## `c.SSE`

```go
func (c *Ctx) SSE(producer func(send func(SSEvent) error) error) error
```

Your producer receives a `send` function. Call it once per event; return `nil` when the stream is complete, or an error to abort. Goryu writes the SSE headers, flushes, and then runs your producer.

### The SSEvent struct

```go
type SSEvent struct {
    ID    string // sets `id:` — the browser echoes it as Last-Event-ID on reconnect
    Event string // sets `event:` — the named event type dispatched to the client
    Data  string // sets `data:` — multi-line strings become multiple data: lines
    Retry int    // sets `retry:` (milliseconds) — client reconnection delay
}
```

Only non-empty fields are written. `Retry` is only emitted when greater than zero.

### Example: progress updates

Stream job progress as named `progress` events, then a final `done` event:

```go
import (
    "fmt"
    "time"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
)

app.GET("/jobs/:id/progress", func(c *goryu.Ctx) {
    _ = c.SSE(func(send func(goryuctx.SSEvent) error) error {
        for pct := 0; pct <= 100; pct += 10 {
            err := send(goryuctx.SSEvent{
                Event: "progress",
                Data:  fmt.Sprintf(`{"percent":%d}`, pct),
            })
            if err != nil {
                return err // client went away — stop the job
            }
            time.Sleep(300 * time.Millisecond)
        }
        return send(goryuctx.SSEvent{Event: "done", Data: "complete"})
    })
})
```

On the browser side:

```js
const es = new EventSource("/jobs/42/progress");
es.addEventListener("progress", (e) => {
  const { percent } = JSON.parse(e.data);
  console.log("progress", percent);
});
es.addEventListener("done", () => es.close());
```

### Example: id and retry for resumable feeds

Setting `ID` lets the browser resume with a `Last-Event-ID` header after a drop, and `Retry` tunes how long it waits before reconnecting:

```go
app.GET("/feed", func(c *goryu.Ctx) {
    _ = c.SSE(func(send func(goryuctx.SSEvent) error) error {
        for _, ev := range events {
            if err := send(goryuctx.SSEvent{
                ID:    ev.ID,
                Event: "update",
                Data:  ev.JSON,
                Retry: 3000, // reconnect after 3s if the connection drops
            }); err != nil {
                return err
            }
        }
        return nil
    })
})
```

On reconnect, read the resume point from the request header:

```go
lastID := c.GetHeader("Last-Event-ID")
```

### Client disconnect handling

`send` checks `c.Request.Context().Err()` before writing. When the client closes the tab or the connection drops, the request context is cancelled and the next `send` returns that error. Propagate it out of your producer to unwind loops, release resources, and cancel background work:

```go
_ = c.SSE(func(send func(goryuctx.SSEvent) error) error {
    for msg := range subscription {
        if err := send(goryuctx.SSEvent{Data: msg}); err != nil {
            return err // context cancelled: stop consuming the subscription
        }
    }
    return nil
})
```

::: warning One response per request
`c.SSE` (like `c.Stream`) takes over the response. If the response has already started it returns `"response already started"`. Don't mix it with `c.JSON`/`c.Send` on the same request.
:::

## `c.Stream`

```go
func (c *Ctx) Stream(fn func(w io.Writer) error) error
```

`c.Stream` writes a `200 OK` and gives your callback a flushing `io.Writer`. Every `Write` is flushed to the client. Set the `Content-Type` yourself before streaming.

### Example: streaming a CSV export

```go
import (
    "fmt"
    "io"

    "github.com/arthurlch/goryu"
)

app.GET("/export.csv", func(c *goryu.Ctx) {
    _ = c.SetHeader("Content-Type", "text/csv")
    _ = c.SetHeader("Content-Disposition", `attachment; filename="export.csv"`)

    _ = c.Stream(func(w io.Writer) error {
        if _, err := io.WriteString(w, "id,name,email\n"); err != nil {
            return err
        }
        for _, u := range users {
            if _, err := fmt.Fprintf(w, "%d,%s,%s\n", u.ID, u.Name, u.Email); err != nil {
                return err // write failed (e.g. client gone)
            }
        }
        return nil
    })
})
```

Because each row is flushed immediately, a browser or `curl` receives data as it is generated rather than waiting for the whole file — which keeps memory flat even for very large exports.

::: tip Test it
Use `curl -N` to disable buffering and watch events arrive live:

```sh
curl -N localhost:3000/jobs/42/progress
```
:::

## Summary

| Method | Content-Type | Writer | Use for |
|--------|--------------|--------|---------|
| `c.SSE` | `text/event-stream` (set for you) | `send func(SSEvent) error` | Named browser events, progress, live feeds |
| `c.Stream` | you set it | `io.Writer` (flushing) | Raw byte streams: CSV, logs, custom protocols |

For typed, JSON-encoded streaming built on top of these, see [Typed streaming](/streaming/typed).
