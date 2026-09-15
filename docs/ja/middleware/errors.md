# Errors ミドルウェア

Goryu 向けの包括的なエラー処理ミドルウェアです。エラー管理を一元化し、一貫したレスポンス形式を提供し、パニックを適切に処理します。

## 機能

- **一元化された処理**: ハンドラーが返すエラーや、コンテキストに格納されたエラーを捕捉します。
- **パニックからの復帰**: パニックから自動的に復帰し、内部サーバーエラーに変換します。
- **一貫した形式**: 標準化された JSON 形式でエラーを返します。
- **開発モード**: デバッグ用に、スタックトレースや内部エラーの詳細をオプションで公開します。
- **カスタマイズ**: カスタムのエラートランスフォーマーやレスポンスフォーマッターをサポートします。

## 使い方

### 基本的なセットアップ

デフォルトのエラー処理を有効にします。

```go
app.Use(errors.New())
```

### カスタム設定

スタックトレースを表示するために開発モードを有効にします。

```go
app.Use(errors.NewWithConfig(errors.Config{
    ShowDetails:    true,
    ShowStackTrace: true, // Only use in development!
    DevMode:        true,
    LogErrors:      true,
}))
```

### エラーを返す

ハンドラー内では、単純にエラーを返します。

```go
app.GET("/users/:id", func(c *goryuctx.Context) {
    user, err := findUser(c.Param("id"))
    if err != nil {
        // Return a 404 error
        c.Status(http.StatusNotFound).JSON(errors.NewError("USER_NOT_FOUND", "User not found").
            Build())
        return
    }
    c.JSON(200, user)
})
```

### 標準エラー形式

このミドルウェアは、以下の JSON 構造でエラーを返します。

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "details": { ... }, // Optional
    "request_id": "req-123",
    "timestamp": "2023-10-27T10:00:00Z"
  }
}
```

## 高度な機能

- **エラートランスフォーマー**: エラーが処理される前に変更します（例: データベースエラーをアプリケーションエラーにマッピングする）。
- **カスタムハンドラー**: エラー発生時にカスタムロジックを実行します（例: 外部サービスへのロギング）。
- **レスポンスフォーマッター**: エラーレスポンスの JSON 構造を完全に変更します。
