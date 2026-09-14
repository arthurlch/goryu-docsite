# ストリーミング

Goryu は、レスポンス全体をバッファリングするのではなく、データをクライアントへ逐次プッシュするための小さなストリーミングプリミティブ群を同梱しています。これらは一般的なリアルタイムパターン、すなわち Server-Sent Events、生のチャンク化レスポンス、型付き JSON ストリーム、そして全二重の WebSocket をカバーします。

いずれのプリミティブも書き込みと同時にフラッシュするため、バイトを生成した瞬間にクライアントへ届きます。これらはすべて同じ `http.Flusher` の仕組みの上に構築されており、SSE および型付きヘルパーはリクエストコンテキストを通じてクライアントの切断を検知します。

## 特徴

- **Server-Sent Events** — `text/event-stream` 向けの `c.SSE`。`id`、`event`、`retry` フィールドをサポートし、イベントごとに自動でフラッシュします。
- **生のチャンクストリーム** — `c.Stream` は、任意のバイトストリーム（CSV、ログ、独自プロトコル）向けにフラッシュ機能付きの `io.Writer` を渡します。
- **型付き SSE** — `goryu.SSEJSON[T]` は各値を JSON にマーシャルして SSE イベントとして送信し、データインジェクションから守られています。
- **NDJSON** — `goryu.StreamJSON[T]` は改行区切りの JSON（`application/x-ndjson`）を出力します。トークンストリームやログのテイリングに最適です。
- **WebSocket** — `websocket.Upgrade` は、依存ゼロの実装で全二重・双方向のメッセージングを提供します。

## プリミティブの選び方

| プリミティブ | 方向 | Content-Type | 最適な用途 |
|-----------|-----------|--------------|----------|
| [`c.SSE`](/ja/streaming/sse) | サーバー → クライアント | `text/event-stream` | 進捗更新、通知、名前付きイベントと自動再接続を伴うライブフィード |
| [`c.Stream`](/ja/streaming/sse) | サーバー → クライアント | 自分で設定 | 生バイト: CSV エクスポート、ログのテイリング、独自のフレーミング |
| [`goryu.SSEJSON[T]`](/ja/streaming/typed) | サーバー → クライアント | `text/event-stream` | 各イベントが JSON ペイロードを運ぶ型付き SSE（LLM トークン、構造化イベント） |
| [`goryu.StreamJSON[T]`](/ja/streaming/typed) | サーバー → クライアント | `application/x-ndjson` | 1 行ずつ消費される型付きレコードストリーム（NDJSON） |
| [`websocket.Upgrade`](/ja/streaming/websocket) | 双方向 | WebSocket | チャット、共同編集、クライアント → サーバーのメッセージを必要とするあらゆるもの |

::: tip 目安
ブラウザがライブストリームを *受信* するだけでよいなら、SSE（`c.SSE` または `SSEJSON`）を選びましょう。同じ接続上でクライアントがメッセージを *送信* し返す必要があるなら、WebSocket を使います。マシン間のレコードストリームには、`StreamJSON` による NDJSON が最もシンプルな選択肢です。
:::

## ひと目で分かる例

型付き Server-Sent Events を 1 行で:

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

改行区切りの JSON:

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

WebSocket のエコーループ:

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

## さらに詳しく

- [Server-Sent Events と生ストリーム](/ja/streaming/sse) — `c.SSE` と `c.Stream`
- [型付きストリーミング](/ja/streaming/typed) — `goryu.SSEJSON[T]` と `goryu.StreamJSON[T]`
- [WebSocket](/ja/streaming/websocket) — `websocket.Upgrade` と `Conn` API
