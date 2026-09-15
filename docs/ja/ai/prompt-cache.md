# プロンプトキャッシュ

`promptcache` は、URL ではなく**リクエストボディ**（「プロンプト」）をキーとする
レスポンスキャッシュです。そのため `POST` レスポンスもキャッシュできます。これは
同じプロンプトが同じ回答を返すべき LLM エンドポイントでよく見られる形です。
`X-Cache: HIT|MISS` ヘッダーを付与し、ストリーミング周りでも安全に動作します。

```go
import "github.com/arthurlch/goryu/middleware/promptcache"
```

## 機能

- **ボディをキーにする**: メソッド + パス + 任意の vary ヘッダー + ボディの SHA-256。
- **POST に対応**: 選択したメソッドをキャッシュします（デフォルトは `POST`）。
- **ストリーミング安全**: `text/event-stream` と `application/x-ndjson` の
  レスポンスはそのまま素通しされ、決してキャッシュされません。
- **上限あり**: 有効期限に基づくエビクションを伴うエントリ数の上限と、ボディ
  あたりのサイズ上限。
- **デフォルトで正しい**: 非 2xx、`Set-Cookie`、あるいは `no-store` / `no-cache`
  / `private` とマークされたレスポンスは決してキャッシュしません。
- **プライバシー保護**: デフォルトのキーでは、`Authorization` や `Cookie` を
  伴うリクエストはキャッシュされません。

## 使い方

### 基本的なセットアップ

```go
import (
    "time"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/promptcache"
)

app.Use(promptcache.New(promptcache.Config{
    Expiration: 10 * time.Minute,
}))
```

`promptcache.Default()` は 5 分の有効期限を使用し、`POST` をキャッシュします。

### 特定のルートだけをキャッシュする

ストリーミングルートはキャッシュしてはならないため、非ストリーミングの
エンドポイントだけをグループでラップするのが一般的なパターンです。

```go
cached := app.Group("", promptcache.New(promptcache.Config{
    Expiration: 5 * time.Minute,
}))
cached.POST("/chat", chat)          // cached
app.POST("/chat/stream", chatStream) // not cached
```

同じボディを 2 回送信し、レスポンスヘッダーが `X-Cache: MISS` から
`X-Cache: HIT` へ変わる様子を確認してください。

### モデルセレクターで vary する

リクエストヘッダーをキーに折り込み、`fast` と `smart` が衝突しないようにします。

```go
app.Use(promptcache.New(promptcache.Config{
    VaryHeaders: []string{"X-Model"},
}))
```

::: warning 認証ヘッダーを VaryHeaders に入れないこと
`VaryHeaders` の値は共有キャッシュキーの一部になります。秘密情報でない
セレクター（モデル、ロケール、フィーチャーフラグ）のみを使用してください。
アイデンティティをキーにするには、代わりに `KeyGenerator` を使ってください。
下記のプライバシーの節を参照してください。
:::

### カスタムキーの導出

`KeyGenerator` を使うと、ハッシュ化の前にプロンプトを正規化したり、ユーザー単位の
キャッシュのためにユーザー / テナント ID を折り込んだりできます。

```go
app.Use(promptcache.New(promptcache.Config{
    KeyGenerator: func(c *goryu.Ctx, body []byte) string {
        return c.GetHeader("X-Tenant") + ":" + normalizePrompt(body)
    },
}))
```

## 設定

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| Expiration | `time.Duration` | 鮮度ウィンドウ | `5m` |
| MaxSize | `int` | 最大キャッシュエントリ数（100,000 を超えられない） | `1000` |
| MaxBodyBytes | `int64` | キャッシュするリクエスト / レスポンスの最大バイト数 | `1 MiB` |
| Methods | `[]string` | キャッシュ可能なメソッド | `["POST"]` |
| VaryHeaders | `[]string` | キーに折り込むリクエストヘッダー | なし |
| KeyGenerator | `func(c, body) string` | カスタムキーの導出 | ボディのハッシュ |

## プライバシー

::: warning デフォルトのキーは呼び出し元が誰かを知らない
**デフォルトのキー**（メソッド + パス + vary ヘッダー + ボディ）では、どの呼び出し
元から来た同じプロンプトも同じキーを生成します。認証済みのあるユーザーが別の
ユーザーのキャッシュされたレスポンスを受け取ることを防ぐため、`Authorization`
または `Cookie` ヘッダーを伴うリクエストは**まったくキャッシュされず**、
ハンドラーへそのまま素通しされます。

`KeyGenerator` を指定した瞬間に、このガードは退きます。キーの責任はあなたが
引き受けたことになるため、レスポンスがユーザー固有であれば、ユーザー / テナントの
アイデンティティをキーに折り込む**必要があります**。呼び出し元が `Authorization`
を送っているのにアイデンティティを無視する `KeyGenerator` は、あるユーザーの
回答を平然と別のユーザーへ提供してしまいます。
:::

## 注意点

- `MaxBodyBytes` より大きいレスポンスはクライアントへストリーミングされますが、
  キャッシュはされません（切り詰めた状態では保存できないためです）。同様に、
  `MaxBodyBytes` より大きいリクエストボディはハンドラーへ完全な形で提供されますが、
  キーには使われません。
- リクエストボディはキー生成のために読み取られた後に復元されるため、ハンドラーは
  依然として完全に読み取れます。
- エビクションは有効期限優先です。満杯になると、任意のエントリがエビクトされる前に
  期限切れのエントリが破棄されます。LRU ではありません。
