# Recovery Middleware

ミドルウェアチェーンやハンドラーのどこで発生した panic からでも回復する、重要なミドルウェアです。サーバーのクラッシュを防ぎ、クライアントに `500 Internal Server Error` レスポンスを返します。

## 機能

- **クラッシュ防止**: panic をキャッチし、サーバーを稼働し続けます。
- **スタックトレース**: デバッグのために詳細なスタックトレースをログに記録します（設定可能）。
- **カスタムハンドリング**: panic を処理するためのカスタムロジックを定義できます（例: アラートの送信）。
- **安全なレスポンス**: panic の発生後でも、有効な HTTP レスポンスが送信されることを保証します。

## 使い方

### 基本的なセットアップ

panic から回復し、スタックトレースをログに記録します（デフォルトの動作）:

```go
app.Use(recovery.Default())
```

### カスタムリカバリハンドラー

レスポンスをカスタマイズしたり、副作用を実行したりします（Sentry への報告など）:

```go
app.Use(recovery.New(recovery.Config{
    EnableStackTrace: true,
    CustomRecoveryHandler: func(c *goryuctx.Context, err interface{}) {
        // Log to external service
        reportToSentry(err)
        
        // Send custom response
        c.Status(http.StatusInternalServerError).JSON(map[string]string{
            "error": "Unexpected error occurred. We have been notified.",
        })
    },
}))
```

## 仕組み

1.  **Defer**: このミドルウェアは `defer` 文を使用して、`next` ハンドラーの実行中に発生したあらゆる panic をキャッチします。
2.  **Recover**: panic が発生した場合、`recover()` がエラー値をキャプチャします。
3.  **Log**: エラーとスタックトレース（有効な場合）をログに記録します。
4.  **Respond**: ヘッダーがまだ書き込まれていない場合、クライアントに `500` レスポンスを送信します。

## ベストプラクティス

- **常に使用する**: このミドルウェアは、他のすべてのミドルウェアやハンドラーからの panic を確実にキャッチするために、チェーンの最初の方（`Logger` と `RequestID` の後）に配置すべきです。
- **本番環境**: スタックトレースはログでは有効にしておきますが、HTTP レスポンスでクライアントに公開することは**絶対に**避けてください。
