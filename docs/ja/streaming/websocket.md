# WebSockets

For full-duplex, bidirectional communication, Goryu ships a small WebSocket package. Upgrade an HTTP handler's connection with `websocket.Upgrade` and read/write messages over the returned `*Conn`.

Unlike Server-Sent Events, a WebSocket lets the client *send* messages back to the server on the same connection — the right choice for chat, collaborative editing, live dashboards with client input, and games.

## Features

- **Zero dependencies** — a minimal, self-contained implementation built on the standard library only; no third-party packages.
- **Standard handshake** — validates the `Upgrade`/`Connection` headers and `Sec-WebSocket-Key`, then replies `101 Switching Protocols`.
- **Client frame masking** — masks are applied and unmasked client frames are rejected as protocol errors, per RFC 6455.
- **Automatic ping/pong** — incoming pings are answered with pongs, and close frames are echoed, inside `ReadMessage`.
- **Fragmentation reassembly** — fragmented messages are reassembled up to a 32 MiB limit.
- **Idle and write timeouts** — sensible defaults (60s idle, 10s write) that you can tune per connection.

::: warning Scope
This is a deliberately minimal implementation intended for straightforward upgrade-and-message use. It is not a full-featured WebSocket library (no subprotocol negotiation, permessage-deflate, etc.).
:::

## Upgrading a connection

```go
func Upgrade(c *goryuctx.Context) (*Conn, error)
```

Call `Upgrade` at the top of a handler. On success you own the underlying connection — always `defer conn.Close()`. It fails if the request isn't a WebSocket upgrade, is missing `Sec-WebSocket-Key`, or the response writer doesn't support hijacking.

## The Conn API

| Method | Description |
|--------|-------------|
| `ReadMessage() (int, []byte, error)` | Reads the next message; returns the message type and payload. Handles ping/pong and close frames internally. |
| `WriteMessage(messageType int, data []byte) error` | Writes a message of the given type. |
| `WriteText(s string) error` | Convenience for writing a `TextMessage`. |
| `Close() error` | Sends a close frame and closes the connection. |
| `SetIdleTimeout(d time.Duration)` | Read deadline applied before each frame (default 60s). |
| `SetWriteTimeout(d time.Duration)` | Write deadline applied before each write (default 10s). |
| `SetReadDeadline(t time.Time) error` | Sets a one-shot read deadline on the underlying connection. |
| `SetWriteDeadline(t time.Time) error` | Sets a one-shot write deadline on the underlying connection. |

### Message type constants

```go
const (
    TextMessage   = 0x1
    BinaryMessage = 0x2
    CloseMessage  = 0x8
)
```

When a peer sends a close frame, `ReadMessage` echoes it and returns `(CloseMessage, payload, websocket.ErrClosed)` — check for `ErrClosed` (or simply break on any read error) to end your loop cleanly.

## Example: echo server

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/websocket"
)

func main() {
    app := goryu.New()

    app.GET("/ws", func(c *goryu.Ctx) {
        conn, err := websocket.Upgrade(c)
        if err != nil {
            _ = c.Status(400).SendString("upgrade failed")
            return
        }
        defer conn.Close()

        for {
            mt, msg, err := conn.ReadMessage()
            if err != nil {
                return // client disconnected or protocol error
            }
            if err := conn.WriteMessage(mt, msg); err != nil {
                return
            }
        }
    })

    _ = app.Run(":3000")
}
```

Test it from the browser console:

```js
const ws = new WebSocket("ws://localhost:3000/ws");
ws.onopen = () => ws.send("hello");
ws.onmessage = (e) => console.log("echo:", e.data);
```

## Example: broadcast / chat loop with timeouts

Tune the idle timeout for a long-lived connection and use `WriteText` for text replies:

```go
app.GET("/chat", func(c *goryu.Ctx) {
    conn, err := websocket.Upgrade(c)
    if err != nil {
        return
    }
    defer conn.Close()

    conn.SetIdleTimeout(5 * time.Minute) // drop silent clients after 5m
    conn.SetWriteTimeout(15 * time.Second)

    for {
        mt, msg, err := conn.ReadMessage()
        if err != nil {
            break // includes websocket.ErrClosed on a clean close
        }
        if mt != websocket.TextMessage {
            continue // ignore binary frames in this example
        }
        reply := "you said: " + string(msg)
        if err := conn.WriteText(reply); err != nil {
            break
        }
    }
})
```

::: tip Idle timeout keeps connections honest
`SetIdleTimeout` applies a read deadline before every frame, so a client that stops sending is dropped automatically rather than leaking a goroutine. Set it to a value comfortably longer than your expected message interval. Since the server answers pings with pongs, well-behaved clients can keep the connection alive with periodic pings.
:::

::: warning One reader, guarded writer
Reads are not safe to call concurrently — run a single `ReadMessage` loop per connection. Writes are internally mutex-guarded, so you may write from other goroutines (for example, a broadcaster) while that read loop runs.
:::
