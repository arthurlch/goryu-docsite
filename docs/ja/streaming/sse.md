# Server-Sent Events と生のストリーム

Goryu の `Ctx` は 2 つの低レベルなストリーミングメソッドを公開しています。Server-Sent Events のための `c.SSE` と、生のフラッシュ対応ライターのための `c.Stream` です。どちらもレスポンスを引き継ぎ、ヘッダーをただちに書き込み、書き込みのたびにフラッシュするため、クライアントはデータが生成されるそばからそれを受け取ります。

## 機能

- **`c.SSE`** — 正しいヘッダー（`Cache-Control: no-cache`、`Connection: keep-alive`、`X-Accel-Buffering: no`）を備えた `text/event-stream` レスポンスを発行します。
- **完全なイベントフィールド** — `SSEvent` 構造体を介して、イベントごとに `id`、`event`、`retry`、複数行の `data` を設定できます。
- **自動フラッシュ** — すべてのイベントは、送信した瞬間にクライアントへフラッシュされます。
- **切断検知** — クライアントのリクエストコンテキストがキャンセルされると、`send` はただちにエラーを返すため、プロデューサーは自然に停止します。
- **インジェクション安全なフレーミング** — `id` / `event` 内の改行は取り除かれ、複数行の `data` は複数の `data:` 行に分割されるため、値が SSE プロトコルを壊すことはありません。
- **`c.Stream`** — 任意のチャンク化された出力のためにフラッシュ対応の `io.Writer` を渡します。`Content-Type` はあなたが制御します。

## `c.SSE`

```go
func (c *Ctx) SSE(producer func(send func(SSEvent) error) error) error
```

あなたのプロデューサーは `send` 関数を受け取ります。イベントごとに一度呼び出し、ストリームが完了したら `nil` を返し、中断するにはエラーを返します。Goryu は SSE ヘッダーを書き込み、フラッシュしてから、あなたのプロデューサーを実行します。

### SSEvent 構造体

```go
type SSEvent struct {
    ID    string // sets `id:` — the browser echoes it as Last-Event-ID on reconnect
    Event string // sets `event:` — the named event type dispatched to the client
    Data  string // sets `data:` — multi-line strings become multiple data: lines
    Retry int    // sets `retry:` (milliseconds) — client reconnection delay
}
```

空でないフィールドのみが書き込まれます。`Retry` はゼロより大きい場合にのみ発行されます。

### 例: 進捗の更新

ジョブの進捗を名前付きの `progress` イベントとしてストリーミングし、最後に `done` イベントを送ります。

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

ブラウザ側では次のようになります。

```js
const es = new EventSource("/jobs/42/progress");
es.addEventListener("progress", (e) => {
  const { percent } = JSON.parse(e.data);
  console.log("progress", percent);
});
es.addEventListener("done", () => es.close());
```

### 例: 再開可能なフィードのための id と retry

`ID` を設定すると、切断後にブラウザが `Last-Event-ID` ヘッダーで再開できます。`Retry` は再接続までの待ち時間を調整します。

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

再接続時には、リクエストヘッダーから再開ポイントを読み取ります。

```go
lastID := c.GetHeader("Last-Event-ID")
```

### クライアント切断の処理

`send` は書き込みの前に `c.Request.Context().Err()` をチェックします。クライアントがタブを閉じたり接続が切れたりすると、リクエストコンテキストがキャンセルされ、次の `send` がそのエラーを返します。それをプロデューサーの外へ伝播させることで、ループを巻き戻し、リソースを解放し、バックグラウンドの作業をキャンセルします。

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

::: warning リクエストごとにレスポンスは 1 つ
`c.SSE`（`c.Stream` と同様）はレスポンスを引き継ぎます。レスポンスがすでに始まっている場合は `"response already started"` を返します。同じリクエストで `c.JSON` / `c.Send` と混在させないでください。
:::

## `c.Stream`

```go
func (c *Ctx) Stream(fn func(w io.Writer) error) error
```

`c.Stream` は `200 OK` を書き込み、コールバックにフラッシュ対応の `io.Writer` を渡します。すべての `Write` はクライアントへフラッシュされます。ストリーミングの前に `Content-Type` は自分で設定してください。

### 例: CSV エクスポートのストリーミング

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

各行がただちにフラッシュされるため、ブラウザや `curl` はファイル全体を待つのではなく、生成されるそばからデータを受け取ります。これにより、非常に大きなエクスポートでもメモリ使用量を一定に保てます。

::: tip 試してみる
`curl -N` を使ってバッファリングを無効にし、イベントがライブで届く様子を確認してください。

```sh
curl -N localhost:3000/jobs/42/progress
```
:::

## まとめ

| メソッド | Content-Type | ライター | 用途 |
|--------|--------------|--------|---------|
| `c.SSE` | `text/event-stream`（自動設定） | `send func(SSEvent) error` | 名前付きブラウザイベント、進捗、ライブフィード |
| `c.Stream` | 自分で設定 | `io.Writer`（フラッシュ対応） | 生のバイトストリーム: CSV、ログ、カスタムプロトコル |

これらの上に構築された型付き・JSON エンコード済みのストリーミングについては、[型付きストリーミング](/ja/streaming/typed)を参照してください。
