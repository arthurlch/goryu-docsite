# CORS ミドルウェア

Goryu 向けの柔軟なクロスオリジンリソース共有（CORS）ミドルウェアです。プリフライトリクエストを処理し、設定したポリシーに従ってクロスオリジンリクエストを検証します。

## 機能

- **オリジンの検証**: 厳格な許可リストによるチェック、またはワイルドカードのサポート（開発時のみ）。
- **認証情報のサポート**: `Access-Control-Allow-Credentials` を安全に処理します。
- **プリフライトの処理**: `OPTIONS` リクエストを正しいヘッダーとともに自動的に処理します。
- **セキュリティチェック**: 安全でない設定（例: 認証情報を伴うワイルドカードオリジン）を防止します。
- **キャッシュ**: 設定可能な `Access-Control-Max-Age`。

## 使い方

### 基本的なセットアップ

すべてのオリジンを許可します（開発時に便利です）。

```go
app.Use(cors.WithAllowAll())
```

### 本番環境向けのセットアップ

特定のドメインにアクセスを制限します。

```go
app.Use(cors.WithOrigins("https://myapp.com", "https://api.myapp.com"))
```

### 高度な設定

ヘッダー、メソッド、公開範囲を完全に制御します。

```go
app.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"https://myapp.com"},
    AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
    AllowHeaders:     []string{"Authorization", "Content-Type"},
    ExposeHeaders:    []string{"X-Custom-Header"},
    AllowCredentials: true,
    MaxAge:           3600, // 1 hour
}))
```

## セキュリティのベストプラクティス

1.  **本番環境でのワイルドカードの回避**: 本番環境では `AllowOrigins: []string{"*"}` を決して使用しないでください。任意の Web サイトが API にリクエストを送れるようになってしまいます。
2.  **認証情報とワイルドカード**: このミドルウェアは、`AllowCredentials: true` とワイルドカードオリジンの組み合わせを明示的に禁止します。これはセキュリティリスクであり、CORS 仕様でも許可されていないためです。
3.  **Vary ヘッダー**: このミドルウェアは、CDN やブラウザによるキャッシュ動作を正しく保つため、レスポンスに `Vary: Origin` を自動的に追加します。
