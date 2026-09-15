# TLS Redirect ミドルウェア

HTTP リクエストを HTTPS に自動的にリダイレクトするミドルウェアです。カスタムポート、ステータスコード、プロキシヘッダー（例: `X-Forwarded-Proto`）に対応しています。

## 特徴

- **自動リダイレクト**: すべての HTTP トラフィックを HTTPS にリダイレクトします。
- **プロキシ対応**: ロードバランサーの背後にあるアプリケーション向けに、`X-Forwarded-Proto` および `X-Forwarded-Host` ヘッダーを尊重します。
- **カスタマイズ可能**: リダイレクトのステータスコード（デフォルト: 301）と HTTPS ポート（デフォルト: 443）を設定できます。
- **柔軟なロジック**: コールバック関数による独自のリダイレクトロジックに対応します。

## 使い方

### 基本的なセットアップ

すべての HTTP トラフィックをポート 443 の HTTPS にリダイレクトします:

```go
app.Use(tlsredirect.Default())
```

### カスタムポート

アプリケーションが標準以外の HTTPS ポート（例: 8443）でリッスンしている場合:

```go
app.Use(tlsredirect.WithPort(8443))
```

### カスタムステータスコード

恒久的リダイレクト（301）の代わりに一時的リダイレクト（307）を使用します:

```go
app.Use(tlsredirect.WithStatusCode(http.StatusTemporaryRedirect))
```

### 詳細な設定

```go
app.Use(tlsredirect.New(tlsredirect.Config{
    StatusCode:        http.StatusMovedPermanently,
    CustomPort:        443,
    ForwardedProtocol: "X-Forwarded-Proto", // Header to check for protocol
    ForwardedHost:     "X-Forwarded-Host",  // Header to check for host
}))
```

## ロードバランサーへの対応

このミドルウェアは、ロードバランサーやリバースプロキシ（Nginx、AWS ALB、Cloudflare など）の背後で動作するように設計されています。`X-Forwarded-Proto` ヘッダーを確認し、元のリクエストがセキュアであったかどうかを判断します。ヘッダーが "https" を示している場合、リクエストはリダイレクトされずにそのまま処理されます。
