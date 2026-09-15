# WebSocket

全二重・双方向の通信のために、Goryu は小さな WebSocket パッケージを同梱しています。HTTP ハンドラーの接続を `websocket.Upgrade` でアップグレードし、返される `*Conn` でメッセージを読み書きします。

Server-Sent Events とは異なり、WebSocket ではクライアントが同じ接続上でサーバーへメッセージを*送り返す*ことができます。チャット、共同編集、クライアント入力を伴うライブダッシュボード、ゲームなどに最適です。

## 特長

- **依存ゼロ** — 標準ライブラリのみで構築された、最小限で自己完結した実装。サードパーティパッケージは不要です。
- **標準的なハンドシェイク** — `Upgrade` / `Connection` ヘッダーと `Sec-WebSocket-Key` を検証し、`101 Switching Protocols` を返します。
- **クライアントフレームのマスク** — RFC 6455 に従い、マスクを適用し、マスクされていないクライアントフレームはプロトコルエラーとして拒否します。
- **自動 ping/pong** — 受信した ping には pong で応答し、close フレームは `ReadMessage` 内でエコーバックします。
- **フラグメントの再結合** — 分割されたメッセージを 32 MiB の上限まで再結合します。
- **アイドル・書き込みタイムアウト** — 妥当なデフォルト（アイドル 60 秒、書き込み 10 秒）を備え、接続ごとに調整できます。

::: warning スコープ
これは、素直なアップグレードとメッセージ送受信を想定した、意図的に最小限の実装です。フル機能の WebSocket ライブラリではありません（サブプロトコルのネゴシエーション、permessage-deflate などはありません）。
:::

## 接続のアップグレード

```go
func Upgrade(c *goryuctx.Context) (*Conn, error)
```

ハンドラーの先頭で `Upgrade` を呼び出します。成功すると基盤の接続は呼び出し側の所有となるため、必ず `defer conn.Close()` を書きます。リクエストが WebSocket アップグレードでない場合、`Sec-WebSocket-Key` が欠けている場合、またはレスポンスライターがハイジャックに対応していない場合は失敗します。

## Conn API

| メソッド | 説明 |
|--------|-------------|
| `ReadMessage() (int, []byte, error)` | 次のメッセージを読み取り、メッセージタイプとペイロードを返します。ping/pong と close フレームは内部で処理します。 |
| `WriteMessage(messageType int, data []byte) error` | 指定したタイプのメッセージを書き込みます。 |
| `WriteText(s string) error` | `TextMessage` を書き込むための簡易メソッドです。 |
| `Close() error` | close フレームを送信し、接続を閉じます。 |
| `SetIdleTimeout(d time.Duration)` | 各フレームの前に適用される読み取りデッドライン（デフォルト 60 秒）。 |
| `SetWriteTimeout(d time.Duration)` | 各書き込みの前に適用される書き込みデッドライン（デフォルト 10 秒）。 |
| `SetReadDeadline(t time.Time) error` | 基盤の接続に一度限りの読み取りデッドラインを設定します。 |
| `SetWriteDeadline(t time.Time) error` | 基盤の接続に一度限りの書き込みデッドラインを設定します。 |

### メッセージタイプ定数

```go
const (
    TextMessage   = 0x1
    BinaryMessage = 0x2
    CloseMessage  = 0x8
)
```

ピアが close フレームを送ると、`ReadMessage` はそれをエコーバックし、`(CloseMessage, payload, websocket.ErrClosed)` を返します。`ErrClosed` を確認する（あるいは単に読み取りエラーで抜ける）ことで、ループをきれいに終了できます。

## 例: エコーサーバー

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

ブラウザのコンソールから試せます:

```js
const ws = new WebSocket("ws://localhost:3000/ws");
ws.onopen = () => ws.send("hello");
ws.onmessage = (e) => console.log("echo:", e.data);
```

## 例: タイムアウト付きのブロードキャスト / チャットループ

長時間の接続に合わせてアイドルタイムアウトを調整し、テキスト応答には `WriteText` を使います:

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

::: tip アイドルタイムアウトで接続を健全に保つ
`SetIdleTimeout` は各フレームの前に読み取りデッドラインを適用するため、送信を止めたクライアントは goroutine をリークさせることなく自動的に切断されます。想定するメッセージ間隔よりも十分に長い値に設定してください。サーバーは ping に pong で応答するため、行儀のよいクライアントは定期的な ping で接続を維持できます。
:::

::: warning リーダーは 1 つ、ライターはガード付き
読み取りを並行して呼び出すのは安全ではありません。接続ごとに単一の `ReadMessage` ループを実行してください。書き込みは内部でミューテックスにより保護されているため、その読み取りループの実行中に他の goroutine（例えばブロードキャスター）から書き込んでも問題ありません。
:::
