# 🎓 Goryu: モダンな EC API の構築

**Goryu マスタークラス**へようこそ。このガイドでは、以下の機能を備えた本番運用可能な EC バックエンド（`shop-api`）を完成させます。

*   ビルダーパターンによる**設定**。
*   Goryu の認証ミドルウェアを使った**認証**（JWT、パスワードハッシュ化）。
*   商品と注文のための**公開 API と保護された API**。
*   組み込みのダッシュボードによる**可観測性**。

---

## 前提条件

*   **Go 1.24+**
*   **Goryu CLI**: `go install github.com/arthurlch/goryu/cmd/goryu@latest`

---

## Part 1: 基盤づくり 🏗️

まずはクリーンなプロジェクト構造を初期化するところから始めましょう。

```bash
goryu init shop-api
cd shop-api
go mod tidy
```

### 1.1 設定戦略

ルートディレクトリに `config.json` を作成します。これを使って環境設定を管理します。

```json
{
  "app": {
    "name": "Goryu Shop",
    "environment": "development"
  },
  "server": {
    "port": 3000
  },
  "security": {
    "csrf_protection": false
  }
}
```

### 1.2 メインのエントリポイント

`cmd/server/main.go` を開いて、Config Builder をセットアップします。

```go
package main

import (
    "log"
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/config/builder"
)

func main() {
    // 1. Load Configuration (Defaults < File < Env)
    cfg, err := builder.New().
        WithDefaults().
        WithFile("config.json").
        WithEnvironment("SHOP"). // e.g. SHOP_SERVER_PORT=8080
        Build()

    if err != nil {
        log.Fatal("❌ Configuration error:", err)
    }

    // 2. Initialize App
    app := goryu.New(*cfg)
    app.Use(goryu.Recovery())
    app.Use(goryu.Logger())

    // 3. Start Server
    log.Printf("🚀 Starting %s on %s", cfg.App.Name, cfg.GetServerAddress())
    log.Fatal(app.Listen(cfg.GetServerAddress()))
}
```

---

## Part 2: 認証とユーザー 🔐

Goryu の強力な `middleware/auth` パッケージを使用します。このチュートリアルでは組み込みの**インメモリストア**を使いますが、本番環境では自分のデータベース（Postgres、Mongo など）をラップすることになります。

### 2.1 認証サービスのセットアップ

`main.go` を更新して認証サービスを初期化します。

```go
    // ... imports
    "github.com/arthurlch/goryu/middleware/auth"

    // ... inside main()

    // --- Authentication Setup ---
    
    // 1. Dependencies
    // In production, implement these interfaces with your DB
    userStore := auth.NewInMemoryUserStore()
    tokenStore := auth.NewInMemoryTokenStore()
    
    // Mock Email Sender (prints to console)
    emailSender := &MockEmailSender{} 

    // 2. JWT Setup
    jwtAuth := auth.NewJWTAuth("super-secret-key-change-me", cfg.App.Name)

    // 3. Service Config
    authConfig := auth.DefaultAuthServiceConfig()
    authConfig.RequireEmailVerification = false // Simplified for tutorial

    // 4. Initialize Service
    authService := auth.NewAuthService(jwtAuth, userStore, tokenStore, emailSender, authConfig)
    authHandlers := auth.NewAuthHandlers(authService)

    // 5. Register Routes (/auth/login, /auth/register, etc.)
    authHandlers.RegisterRoutes(app)
```

ファイルの末尾にモックのメール送信者を追加します。

```go
type MockEmailSender struct{}
func (m *MockEmailSender) SendVerificationEmail(email, token, link string) error {
    log.Printf("📧 [Email] Verify %s: %s", email, link)
    return nil
}
func (m *MockEmailSender) SendPasswordResetEmail(email, token, link string) error {
    log.Printf("📧 [Email] Reset Password %s: %s", email, link)
    return nil
}
func (m *MockEmailSender) SendSecurityAlert(email, msg string) error {
    log.Printf("📧 [Email] Alert %s: %s", email, msg)
    return nil
}
```

---

## Part 3: 商品カタログ 📦

商品を閲覧するための公開 API を構築しましょう。

### 3.1 商品モデル

`internal/models/product.go` を作成します。

```go
package models

type Product struct {
    ID          string  `json:"id"`
    Name        string  `json:"name"`
    Price       float64 `json:"price"`
    Description string  `json:"description"`
}

// Simple validation
func (p *Product) Validate() error {
    // Goryu calls this automatically
    if len(p.Name) < 3 {
        return fmt.Errorf("name too short")
    }
    if p.Price <= 0 {
        return fmt.Errorf("price must be positive")
    }
    return nil
}
```

## 3.2 商品ハンドラー

`main.go` にシンプルなインメモリの商品ハンドラーを追加します。

```go
    // ... imports
    "github.com/arthurlch/goryu/goryuctx"
    "shop-api/internal/models"

    // ... inside main() (or separate file)
    
    // Seed some data
    products := []models.Product{
        {ID: "1", Name: "Goryu T-Shirt", Price: 25.0, Description: "Official Swag"},
        {ID: "2", Name: "Gopher Plush", Price: 15.0, Description: "Cuddly friend"},
    }

    // Public API Group
    api := app.Group("/api/v1")
    
    api.GET("/products", func(c *goryuctx.Context) {
        c.JSON(goryuctx.Map{
            "data": products,
            "count": len(products),
        })
    })
```

---

## Part 4: 注文と保護 🛡️

いよいよ重要な部分、**保護されたルート**です。注文するにはユーザーがログインしている必要があります。

### 4.1 保護されたグループ

`authService.Middleware()` を使ってルートを保護します。

```go
    // Protected API Group
    // All routes here require a valid JWT Access Token
    protected := api.Group("/user", authService.Middleware())

    protected.POST("/orders", func(c *goryuctx.Context) {
        // 1. Get User ID from Context (set by middleware)
        userID := c.Get(auth.UserIDKey) // "user_id"
        
        // 2. Bind Order Data
        type OrderRequest struct {
            ProductID string `json:"product_id"`
            Quantity  int    `json:"quantity"`
        }
        var req OrderRequest
        if err := c.BodyParser(&req); err != nil {
            c.Status(400).JSON(goryuctx.Map{"error": "Invalid request"})
            return
        }

        // 3. Process Order (Mock)
        log.Printf("💰 New Order! User: %v, Product: %s, Qty: %d", userID, req.ProductID, req.Quantity)

        c.Status(201).JSON(goryuctx.Map{
            "status": "confirmed",
            "order_id": "ord_12345",
            "user_id": userID,
        })
    })
```

---

## Part 5: 実行と検証 🚀

あなたの EC API の準備が整いました！

### 5.1 サーバーの起動

```bash
goryu dev
```

### 5.2 一連の流れをテストする

1.  **ユーザーの登録**:
    ```bash
    curl -X POST http://localhost:3000/auth/register \
      -H "Content-Type: application/json" \
      -d '{"email": "jane@example.com", "password": "securePassword123!"}'
    ```

2.  **ログイン**:
    ```bash
    curl -X POST http://localhost:3000/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "jane@example.com", "password": "securePassword123!"}'
    ```
    *レスポンスから `access_token` をコピーします。*

3.  **商品の閲覧**（公開）:
    ```bash
    curl http://localhost:3000/api/v1/products
    ```

4.  **注文する**（保護）:
    ```bash
    curl -X POST http://localhost:3000/api/v1/user/orders \
      -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
      -H "Content-Type: application/json" \
      -d '{"product_id": "1", "quantity": 2}'
    ```

トークンなしで手順 4 を試すと、`401 Unauthorized` が返されます。

---

## Part 5: 深掘り: セキュリティとセッション 🛒

ここでは**セッション**と**セキュリティ**に焦点を当てます。ステートレスな JWT 認証と並行してステートフルなセッションを実演するために、ショッピングカート機能を追加しましょう。

### 5.1 なぜセッションなのか？
JWT は**認証**（ステートレスな本人確認）に最適ですが、セッションは（ショッピングカートのような）**一時的な状態**の管理に向いていることがよくあります。こうした状態は、注文が確定するまでデータベースに永続的に保存したくないものです。

### 5.2 セッションミドルウェアのセットアップ
Goryu の `SecureStore` を使用します。これはセッションデータをメモリに保持しますが、**暗号化**します。メモリがダンプされた場合でもユーザーデータの漏洩を防ぐためのベストプラクティスです。

`main.go` を更新します。

```go
    // ... imports
    "github.com/arthurlch/goryu/middleware/session"

    // ... inside main()
    
    // 1. Initialize Secure Store
    // In production, use a Redis store for persistence across restarts
    store, err := session.NewSecureStore("my-very-long-encryption-key-must-be-32-bytes")
    if err != nil {
        log.Fatal(err)
    }

    // 2. Add Session Middleware
    // We add it to the API group so all API routes have session support
    api.Use(session.New(session.Config{
        Store: store,
        CookieName: "shop_session",
        Secure: &[]bool{false}[0], // Set to true in production (requires HTTPS)
        HttpOnly: true, // 🛡️ JavaScript cannot access this cookie (prevents XSS)
    }))
```

### 5.3 ショッピングカートの実装
それではカートを管理するルートを追加しましょう。このやり取りはログイン*なし*で行われます！

```go
    // Public Cart Routes
    api.POST("/cart", func(c *goryuctx.Context) {
        // Get existing session or create new one
        sess, _ := session.Get(c)
        
        // Simple Cart Logic
        type CartItem struct {
            ProductID string `json:"product_id"`
            Qty       int    `json:"qty"`
        }
        var item CartItem
        if err := c.BodyParser(&item); err != nil {
            c.Status(400).JSON(goryuctx.Map{"error": "bad request"})
            return
        }
        
        // Add to session data
        cart := sess.Get("cart")
        if cart == nil {
            cart = []CartItem{}
        }
        // (In real app, append properly)
        items := cart.([]CartItem)
        items = append(items, item)
        sess.Set("cart", items)
        
        c.JSON(goryuctx.Map{"status": "added", "cart_size": len(items)})
    })

    api.GET("/cart", func(c *goryuctx.Context) {
        sess, _ := session.Get(c)
        cart := sess.Get("cart")
        c.JSON(goryuctx.Map{"cart": cart})
    })
```

### 5.4 セキュリティ概念の解説 🛡️

1.  **HttpOnly Cookie**: `HttpOnly: true` を設定しています。これは、フロントエンドの JavaScript コード（React/Vue など）がセッション Cookie を**読み取れない**ことを意味します。攻撃者が悪意のある JS を注入（XSS）しても、セッション ID を盗むことはできません。
2.  **Secure Cookie**: 本番環境（`Secure: true`）では、Cookie は HTTPS 経由でのみ送信され、「中間者（Man-in-the-Middle）」攻撃を防ぎます。
3.  **暗号化されたストア**: Goryu の `SecureStore` は AES-GCM 暗号化を使用します。攻撃者がサーバーの RAM にアクセスできたとしても、ユーザーのセッションデータを読み取ることはできません。

---

## Part 6: 高度な機能 🚀

Goryu は JSON API のためだけのものではありません。いくつかの高度な機能を見てみましょう。

### 6.1 ルートの命名と逆引き
大規模なアプリでは、`/api/v1/user/orders` のような URL をハードコードするのは壊れやすいものです。代わりに**名前付きルート**を使いましょう。

```go
    // Name the route
    api.GET("/products/:id", getProduct).SetName("product_detail")

    // Generate URL dynamically in your code
    url := app.Router.Reverse("product_detail", "123") 
    // url == "/api/v1/products/123"
```

### 6.2 ファイルアップロード
管理者が商品画像をアップロードできるようにしましょう。Goryu の `SaveUploadedFile` には、パストラバーサルや悪意のあるファイル名に対する組み込みのセキュリティチェックが含まれています。

```go
    admin := api.Group("/admin")
    // ... add auth middleware ...

    admin.POST("/products/:id/image", func(c *goryuctx.Context) {
        // 1. Parse Multipart Form (10MB limit by default)
        file, header, err := c.FormFile("image")
        if err != nil {
            c.BadRequest("Image required")
            return
        }

        // 2. Validate File (Content-Type, Size, etc.)
        if header.Size > 5*1024*1024 { // 5MB limit
            c.BadRequest("File too large")
            return
        }

        // 3. Secure Save
        // Automatically prevents "../" attacks
        savePath := fmt.Sprintf("uploads/products/%s_%s", c.Param("id"), header.Filename)
        if err := c.SaveUploadedFile(header, savePath); err != nil {
             c.InternalError("Failed to save image")
             return
        }

        c.Success("Image uploaded: " + savePath)
    })
```

### 6.3 流暢な XML/HTML
古いシステム（XML）をサポートしたり、レンダリングされたフラグメント（HTML）を返したりする必要がある場合もあります。Goryu の Context にはこのための**流暢な API**があります。

```go
    api.GET("/legacy/products", func(c *goryuctx.Context) {
        c.FluentXML(200, "<products><product id='1'>Goryu T-Shirt</product></products>")
    })
```

---

## Part 7: プラグインシステム 🧩

Goryu には、チーム全体でミドルウェアの設定を標準化するための強力な**プラグインシステム**が付属しています。

すべてのミドルウェアを手動で設定する代わりに、Builder を使いましょう。

### 7.1 本番向けロガー
Plugin Builder は、（色の無効化や JSON フォーマットの使用といった）本番環境で重要な設定を忘れないようにしてくれます。

```go
    // Replace app.Use(goryu.Logger()) with:
    
    import "github.com/arthurlch/goryu/plugins"

    app.Use(plugins.NewLoggerBuilder().
        Production().            // Enforces JSON, UTC timestamps
        Output(os.Stdout).
        Build())
```

### 7.2 レート制限
Rate Limit プラグインで API を保護します。

```go
    // 100 requests per minute per IP
    app.Use(plugins.NewRateLimitBuilder().
        PerMinute(100).
        ByIP().
        Build())
```

---

## まとめ 🎓

Goryu エコシステム全体を一通り巡りました！

**構築したもの:**
1.  **Shop API**: 構造化され、設定されたバックエンド。
2.  **認証システム**: 安全な JWT + インメモリストア。
3.  **ショッピングカート**: ステートフルなセッション管理。
4.  **高度な機能**: ファイルアップロード、リバースルーティング。
5.  **本番運用対応**: 標準的なロギングとレート制限のためのプラグインの活用。

**次のステップ:**
*   さらなるツール（CORS、CSRF、Cache）については `middleware/` を探索してください。
*   より多くのコードパターンは `examples/` を確認してください。
*   コミュニティに参加して、素晴らしいものを作りましょう！
