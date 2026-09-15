# Secure Middleware

さまざまな HTTP セキュリティヘッダーを設定することで Goryu アプリケーションを保護するミドルウェアです。XSS、クリックジャッキング、その他の一般的な Web 攻撃の防止に役立ちます。

## 機能

- **XSS 保護**: ブラウザの XSS フィルタリングを有効にします。
- **Content Type Options**: MIME タイプのスニッフィングを防止します（`nosniff`）。
- **Frame Options**: クリックジャッキングから保護します（`SAMEORIGIN`）。
- **HSTS**: HTTPS 接続を強制します（Strict-Transport-Security）。
- **CSP**: 設定可能な Content Security Policy を提供します。
- **Referrer Policy**: リクエストで送信されるリファラー情報を制御します。
- **Permissions Policy**: ブラウザの機能や API を制御します。

## 使い方

### 基本的なセットアップ

デフォルトのセキュリティヘッダーを適用します:

```go
app.Use(secure.Default())
```

これにより以下が設定されます:
- `X-XSS-Protection: 1; mode=block`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

### HTTPS の強制（HSTS）

サブドメインを含めて 1 年間の Strict-Transport-Security を有効にします:

```go
app.Use(secure.WithHSTS(31536000, true))
```

### Content Security Policy (CSP)

カスタムの CSP を定義します:

```go
app.Use(secure.WithCSP("default-src 'self'; script-src 'self' https://trusted.cdn.com"))
```

### 高度な設定

```go
app.Use(secure.New(secure.Config{
    XSSProtection:         "1; mode=block",
    ContentTypeNosniff:    "nosniff",
    XFrameOptions:         "DENY",
    HSTSMaxAge:            31536000,
    HSTSIncludeSubdomains: true,
    HSTSPreload:           true,
    ContentSecurityPolicy: "default-src 'self'",
    ReferrerPolicy:        "no-referrer",
    PermissionsPolicy:     "geolocation=(), camera=()",
}))
```

## セキュリティに関する注意

- **HSTS Preload**: `HSTSPreload` を有効にする際は注意してください。一度ドメインがブラウザのプリロードリストに登録されると、削除するのは困難です。長期的に HTTPS を維持する覚悟があることを確認してください。
- **CSP**: 設定が不十分な CSP はアプリケーションを壊す可能性があります。強制する前に、`Content-Security-Policy-Report-Only` モード（お使いの構成でサポートされている場合）または開発環境で十分にテストしてください。
