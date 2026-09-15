# 🧠 Goryu Context パッケージ

> **Goryu フレームワークの中核。**

`context` パッケージは `Context` 構造体を提供します。これは Goryu のすべてのリクエストにおける中心的なデータキャリアです。**開発者体験（DX）**、**セキュリティ**、そして**パフォーマンス**を念頭に置いて設計されています。

標準の `context.Context` や他のフレームワークのコンテキストとは異なり、Goryu の Context は**流暢な API**、**組み込みのセキュリティチェック**、そして**堅牢なエラーハンドリング**を提供し、開発をより容易に、アプリケーションをより安全にします。

---

## ✨ 主な特徴

- **🌊 流暢な API**: メソッドをチェーンして、表現力豊かで読みやすく、コンパクトなコードを書けます。
- **🛡️ セキュリティ第一**: パストラバーサル、IP スプーフィング、悪意のあるファイルアップロードに対する自動保護。
- **⚡ スレッドセーフ**: 組み込みのミューテックスとアトミック操作により、並行ミドルウェアでも安全性を確保します。
- **🔧 堅牢なエラーハンドリング**: 設定可能なエラーモード（Return、Log、Panic、Silent）で、デバッグのニーズに合わせられます。
- **📦 スマートなバインディング**: 厳格な JSON バインディングと強力なクエリ／フォームのパース。

---

## 🚀 クイックスタート

```go
func HandleLogin(c *goryuctx.Context) {
    // Fluent chaining example
    c.Status(200).
      Header("X-App-Version", "1.0").
      JSON(map[string]string{
          "message": "Welcome back!",
      })
}
```

---

## 📥 リクエストの処理

### データアクセス
クエリパラメータ、フォーム値、パスパラメータに簡単にアクセスできます。

```go
// GET /search?q=golang&page=1
query := c.Query("q") // "golang"

// POST form-data
username := c.Form("username")

// Route parameters /users/:id
userID := c.Param("id")
```

### データバインディング
リクエストデータをバリデーション付きで構造体にバインドします。

```go
type User struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

var user User
// Automatically checks Content-Type, limits body size (1MB default),
// and disallows unknown fields for security.
if err := c.BodyParser(&user); err != nil {
    c.BadRequest("Invalid JSON")
    return
}
```

### 📂 安全なファイルアップロード
`SaveUploadedFile` メソッドは要塞のような存在です。厳格なセキュリティチェックを実行します。
- ✅ ファイル名の長さと文字を検証します（null バイトや制御文字は不可）。
- ✅ パストラバーサル攻撃（例: `../../etc/passwd`）を防止します。
- ✅ 危険な拡張子（`.exe`、`.sh` など）をチェックします。
- ✅ 隠しファイルのアップロードを防止します。

```go
file, header, err := c.FormFile("avatar")
if err != nil {
    c.BadRequest("Upload failed")
    return
}

// Safely saves to "uploads/" directory with all security checks active
if err := c.SaveUploadedFile(header, "user_avatar.png"); err != nil {
    c.InternalError("Could not save file")
    return
}
```

### 🌐 IP の解決
プロキシの背後にいる場合でも、スプーフィング対策を備えて実際のクライアント IP を取得します。

```go
// Only trusts X-Forwarded-For if the direct IP is in the trusted_proxies list
c.Set("trusted_proxies", []string{"10.0.0.1", "127.0.0.1"})
clientIP := c.RemoteIP()
```

---

## 📤 レスポンスの処理

### 標準メソッド
さまざまな形式でレスポンスを送信します。

```go
// All methods return error for proper error handling
err := c.JSON(200, data)
err = c.Text(200, "Hello World")

// HTML and XML are available via fluent API
c.FluentHTML(200, "<h1>Hello</h1>")
c.FluentXML(200, "<root>Hello</root>")
```

### 🌊 流暢な API
レスポンスメソッドをチェーンして、よりすっきりしたハンドラーを書けます。

```go
c.WithStatus(201).
  WithHeader("X-Created-By", "Goryu").
  WithCookie(&http.Cookie{Name: "session", Value: "123"}).
  JSON(map[string]string{"status": "created"})
```

### 📁 ファイル配信
ファイルを安全に配信します。`SendFile` はパスを自動的にクリーンアップし、ディレクトリトラバーサルの試みをチェックします。

```go
// Safely serves files, returning 404 or 403 as appropriate
c.SendFile("public/index.html")
```

---

## ⚠️ エラー管理

Goryu の Context は洗練されたエラーハンドリングシステムを使用しています。

### エラーハンドリングモード
流暢なチェーンや標準的な操作の際に、Context がエラーをどう扱うかを設定できます。

```go
// Available Modes:
// - ErrorModeReturn: Returns the error to the caller (Default)
// - ErrorModeLog: Logs the error but continues execution
// - ErrorModePanic: Panics (useful for development)
// - ErrorModeSilent: Ignores errors

c.SetErrorHandlingMode(goryuctx.ErrorModeLog)
```

### エラーの確認
流暢な API を使用する場合、エラーは内部的に収集されます。

```go
c.Status(200).JSON(data)

if c.HasErrors() {
    // Handle any error that occurred in the chain
    log.Println(c.FirstError())
}
```

---

## 🔒 スレッドセーフティと並行性

`Context` 構造体は `sync.RWMutex` によって保護されています。
- **`Set(key, value)`** と **`Get(key)`** はスレッドセーフです。
- レスポンスの書き込みはアトミックフラグを使用して「複数レスポンス」の競合状態を防ぎます。

```go
// Safe to use in concurrent goroutines
go func() {
    c.Set("background_job", "running")
}()
```

---

## 🧩 応用: Context のライフサイクル

`Context` は `NewContext` を介して作成されます。プール化される（将来の最適化）ように設計されているため、リクエスト完了後にその参照を保持しないようにしてください。

```go
ctx := goryuctx.NewContext(w, r)
// ... handle request ...
```
