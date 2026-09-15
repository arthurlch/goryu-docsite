# Limiter Middleware

Goryu 向けのレートリミットミドルウェアです。指定した時間枠内でクライアントが行えるリクエスト数を制限することで、アプリケーションを不正利用から保護します。

## 機能

- **固定ウィンドウ**: 一定の時間間隔ごとにリクエストを制限します（例: 1 分あたり 60 リクエスト）。
- **インメモリストレージ**: 高速で効率的なローカルストレージです。
- **クライアント管理**: 古いクライアントのエントリを自動的に削除し、メモリを管理します。
- **カスタムキー**: IP（デフォルト）、API キー、その他任意の識別子でレートリミットを行えます。
- **カスタムレスポンス**: 制限に達したときの動作を定義できます。

## 使い方

### 基本的なセットアップ

IP ごとに 1 分あたり 60 リクエストに制限します:

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/limiter"
)

app.Use(limiter.Default())
```

### カスタム制限

1 秒あたり 10 リクエストに制限します:

```go
app.Use(limiter.New(limiter.Config{
    Max:        10,
    Expiration: 1 * time.Second,
}))
```

### 高度な設定

カスタムエラーレスポンスを伴って API キーでレートリミットを行います:

```go
app.Use(limiter.New(limiter.Config{
    Max:        1000,
    Expiration: 1 * time.Hour,
    KeyGenerator: func(c *goryuctx.Context) string {
        return c.GetHeader("X-API-Key")
    },
    LimitReached: func(c *goryuctx.Context) {
        c.Status(http.StatusTooManyRequests).JSON(map[string]string{
            "error": "Rate limit exceeded. Try again later.",
        })
    },
}))
```

## 設定オプション

| オプション | 型 | 説明 | デフォルト |
|--------|------|-------------|---------|
| Max | `int` | 許可される最大リクエスト数 | `60` |
| Expiration | `time.Duration` | 時間枠の長さ | `1 * time.Minute` |
| KeyGenerator | `func(*goryuctx.Context) string` | クライアントキーを抽出する関数 | IP ベース |
| LimitReached | `func(*goryuctx.Context)` | 制限に達したときのカスタムレスポンス | JSON エラーレスポンス |

## 仕組み

このミドルウェアは、インメモリのマップを使用してリクエストを追跡します。その仕組みは次のとおりです:
1. **クライアントの識別**: `KeyGenerator` 関数を使用します（デフォルト: クライアント IP）
2. **固定ウィンドウ**: 指定された時間間隔内のリクエストをカウントします
3. **自動クリーンアップ**: 期限切れのクライアントエントリを削除してメモリを管理します
4. **スレッドセーフ**: 並行リクエストの処理にミューテックスを使用します

## セキュリティに関する注意

IP ベースの制限（デフォルト）を使用する場合、以下に注意してください:
- NAT の背後にいるユーザーは IP アドレスを共有している可能性があります
- より正確な制限のために、API キーや認証済みユーザー ID の使用を検討してください
- セキュリティとユーザー体験のバランスを取るため、適切な制限値を設定してください
