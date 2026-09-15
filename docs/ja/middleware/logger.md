# Logger Middleware

Goryu 向けの高度にカスタマイズ可能な HTTP リクエストロガーです。カスタムフォーマット、カラー表示、出力先のサポートを備え、詳細なリクエスト／レスポンスのロギングを提供します。

## 機能

- **カスタマイズ可能なフォーマット**: テンプレート変数を使用して、ログに記録する内容を正確に定義できます。
- **カラーコード**: ステータスコードとメソッドを視覚的に色分けし、開発中の可読性を向上させます。
- **リクエスト ID**: `X-Request-ID` を自動的に生成または伝播します。
- **レイテンシの追跡**: リクエストの所要時間を計測してログに記録します。
- **柔軟な出力**: ログを stdout、ファイル、または任意の `io.Writer` に書き込めます。

## 使い方

### 基本的なセットアップ

デフォルトのフォーマット（stdout へのカラー出力）を使用します:

```go
app.Use(logger.Default())
```

### カスタムフォーマット

テンプレート変数を使用してログ出力をカスタマイズします:

```go
app.Use(logger.New(logger.Config{
    Format: "${time} | ${status} | ${latency} | ${method} ${path} | ${error}\n",
}))
```

**利用可能な変数:**
- `${time}`: タイムスタンプ（デフォルトは RFC3339）
- `${status}`: HTTP ステータスコード（カラー表示）
- `${latency}`: リクエストの所要時間
- `${ip}`: クライアントの IP アドレス
- `${method}`: HTTP メソッド（カラー表示）
- `${path}`: リクエストパス
- `${proto}`: HTTP プロトコルバージョン
- `${request_id}`: リクエスト ID
- `${user_agent}`: ユーザーエージェント文字列
- `${size}`: レスポンスサイズ（バイト単位）
- `${error}`: エラーメッセージ（ある場合）

### JSON ロギング（本番環境向け）

構造化ロギングのために、フォーマットを JSON 出力に設定できます:

```go
app.Use(logger.New(logger.Config{
    Format: `{"time":"${time}","level":"INFO","msg":"http_request","id":"${request_id}","method":"${method}","uri":"${path}","status":${status},"latency":"${latency}"}` + "\n",
    DisableColors: true,
}))
```

### 高度な設定

```go
file, _ := os.OpenFile("requests.log", os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)

app.Use(logger.New(logger.Config{
    Output:        file,
    TimeFormat:    time.RFC1123,
    TimeZone:      "UTC",
    DisableColors: true,
}))
```

## パフォーマンスに関する注意

ロガーはバッファ付きのライターと効率的な文字列置換を使用してオーバーヘッドを最小限に抑えます。ただし、極めて高スループットなシステムの場合は、ログのサンプリングや、ゼロアロケーションの構造化ロギングのための `structlog` ミドルウェアの使用を検討してください。
