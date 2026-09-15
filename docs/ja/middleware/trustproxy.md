# TrustProxy ミドルウェア

アプリケーションがロードバランサーやリバースプロキシの背後で動作している場合に、実際のクライアント IP アドレスを安全に解決するミドルウェアです。設定されたプロキシネットワークからのヘッダーのみを信頼することで、IP のなりすましを防止します。

## 特徴

- **安全な IP 解決**: ホワイトリストに登録されたプロキシからの `X-Forwarded-For`（またはカスタムヘッダー）のみを信頼します。
- **CIDR 対応**: サブネット全体（例: `10.0.0.0/8`、`127.0.0.1`）を簡単にホワイトリストに登録できます。
- **コンテキスト統合**: 解決した IP をコンテキストに保存し、簡単にアクセスできるようにします。
- **ヘッダーのカスタマイズ**: カスタムプロキシヘッダー（例: `CF-Connecting-IP`）に対応します。

## 使い方

### 基本的なセットアップ

ローカルプロキシを信頼します（サイドカープロキシやローカルの Nginx で一般的です）:

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/trustproxy"
)

func main() {
    app := goryu.New()

    // Trust loopback addresses
    app.Use(trustproxy.WithProxies([]string{"127.0.0.1", "::1"}))

    app.GET("/", func(c *goryuctx.Context) error {
        clientIP := trustproxy.GetTrustedIPFromContext(c)
        return c.String(200, "Your IP is: "+clientIP)
    })

    app.Run(":8080")
}
```

### 詳細な設定

プライベートネットワークを信頼し、カスタムヘッダーを使用します:

```go
app.Use(trustproxy.New(trustproxy.Config{
    TrustedProxies: []string{
        "10.0.0.0/8",     // Private network
        "172.16.0.0/12",  // Private network
        "192.168.0.0/16", // Private network
    },
    ProxyHeader: "X-Real-IP", // Use X-Real-IP instead of X-Forwarded-For
}))
```

## なぜこれが重要なのか？

`X-Forwarded-For` ヘッダーを無条件に信頼してしまうと、悪意のあるユーザーが偽のヘッダーを含むリクエストを送信することで、自分の IP アドレスをなりすますことができます:

```
GET / HTTP/1.1
X-Forwarded-For: 8.8.8.8
```

アプリケーションが IP ベースのレート制限やアクセス制御を使用している場合、このなりすましによってセキュリティ対策が回避される可能性があります。`TrustProxy` は、ヘッダーの値を受け入れる前に、リクエストが実際に信頼されたプロキシから送られてきたことを検証することで、この問題を解決します。
