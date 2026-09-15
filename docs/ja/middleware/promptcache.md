# PromptCache ミドルウェア

URL ではなく **リクエストボディ**（「プロンプト」）をキーとするレスポンスキャッシュです。
そのため `POST` レスポンスをキャッシュできます。これは、同じプロンプトが同じ回答を返すべき
LLM エンドポイントによく見られる形です。

::: tip ガイドをお探しですか？
このページはミドルウェアのリファレンスです。ユーザーごとのキー付け、モデル別のキャッシュ、
ストリーミング時の挙動を含む解説については、[プロンプトキャッシュガイド](/ja/ai/prompt-cache) をご覧ください。
:::

## 特徴

- **ボディをキーに**: メソッド + パス +（任意の vary ヘッダー）+ ボディの SHA-256。
- **POST に対応**: 選択したメソッドをキャッシュします（デフォルトは `POST`）。
- **ストリーミング安全**: `text/event-stream` と `application/x-ndjson` のレスポンスはそのまま通過させ、決してキャッシュしません。
- **上限付き**: 有効期限に基づく退避によるサイズ上限に加え、ボディごとのサイズ制限。
- **デフォルトで正しい**: 2xx 以外、`Set-Cookie`、`no-store`、`no-cache`、`private` のレスポンスは決してキャッシュしません。`X-Cache: HIT|MISS` を付与します。

## 使い方

```go
import (
    "time"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/promptcache"
)

app.Use(promptcache.New(promptcache.Config{
    Expiration:  10 * time.Minute,
    VaryHeaders: []string{"X-Model"}, // fold the model selector into the key
}))
```

カスタムキー（例: ハッシュ化前にプロンプトを正規化する）:

```go
app.Use(promptcache.New(promptcache.Config{
    KeyGenerator: func(c *goryu.Ctx, body []byte) string {
        return normalizePrompt(body)
    },
}))
```

`promptcache.Default()` は、デフォルト設定でミドルウェアをインストールします。

## 設定オプション

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| Expiration | `time.Duration` | 鮮度ウィンドウ | `5m` |
| MaxSize | `int` | キャッシュエントリの最大数（100,000 を超えられません） | `1000` |
| MaxBodyBytes | `int64` | キャッシュするリクエスト／レスポンスの最大バイト数 | `1 MiB` |
| Methods | `[]string` | キャッシュ可能なメソッド | `["POST"]` |
| VaryHeaders | `[]string` | キーに畳み込むリクエストヘッダー | なし |
| KeyGenerator | `func(c, body) string` | カスタムのキー導出 | ボディのハッシュ |

## 仕組み

各リクエストについて、ミドルウェアは次を行います。

1. **スキップ** — メソッドが `Methods` に含まれないリクエスト。
2. **プライバシーを保護** — デフォルトのキーでは、`Authorization` または `Cookie` ヘッダーを持つリクエストはキャッシュされずに通過します。そのため、認証済みの呼び出し元が他人のレスポンスを提供されることは決してありません。
3. **キーを導出** — メソッド + パス + すべての `VaryHeaders` + リクエストボディ（またはあなたの `KeyGenerator`）の SHA-256。ボディは `MaxBodyBytes` まで読み取られて復元されるため、ハンドラーは引き続き全体を読み取れます。
4. **HIT を提供** — 鮮度のあるエントリが存在する場合、そのステータス、ヘッダー、ボディを `X-Cache: HIT` とともに再生します。
5. **MISS の場合**、キャプチャ用のライターを通してハンドラーを実行し、`X-Cache: MISS` を設定し、キャッシュ可能であればレスポンスを保存します。

レスポンスがキャッシュ可能なのは、2xx であり、`MaxBodyBytes` 以内であり、ストリーミングの
コンテンツタイプでなく、`Set-Cookie` を持たず、`no-store` / `no-cache` / `private` の
`Cache-Control` を持たない場合のみです。キャッシュが満杯のときは、まず期限切れのエントリを
退避し、それでも満杯なら任意のエントリを 1 つ破棄します。

## セキュリティに関する注意

**デフォルトのキー**（リクエストボディのみ）では、`Authorization` または `Cookie` ヘッダーを
持つリクエストは **キャッシュされません**。そのため、認証済みの呼び出し元が他人のレスポンスを
提供されることは決してありません。

ユーザーごとのレスポンスをキャッシュするには、ユーザー／テナントのアイデンティティをキーに
畳み込む `KeyGenerator`（または `VaryHeaders`）を指定します。その場合、その正しさはあなたの
責任となり、プライバシーガードは働かなくなります。認証ヘッダーを `VaryHeaders` に決して
入れないでください。
