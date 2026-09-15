# Goryu HTTP クライアント

Goryu フレームワークに組み込まれた、クリーンな API 設計を持つ流暢（fluent）でチェーン可能な Go 用 HTTP クライアントです。

## 概要

Goryu クライアントは、メソッドチェーン、自動エラーハンドリング、そして JSON ペイロード、フォームデータ、認証などの一般的なパターンへの組み込みサポートによって、HTTP リクエストを直感的に行う方法を提供します。

## 特徴

- **流暢な API**: メソッドをチェーンすることで、クリーンで読みやすいコードが書けます
- **すべての HTTP メソッド**: GET、POST、PUT、DELETE、PATCH、HEAD をサポート
- **JSON サポート**: JSON リクエスト／レスポンスを簡単に扱えます
- **フォームデータ**: フォームエンコーディングを組み込みでサポート
- **認証**: Basic 認証とカスタムヘッダー
- **Cookie 管理**: シンプルな Cookie 処理
- **クエリパラメータ**: チェーン可能なクエリパラメータの構築
- **タイムアウト**: 設定可能なリクエストタイムアウト
- **TLS オプション**: カスタム TLS 設定のサポート
- **エラーの集約**: リクエストチェーン全体を通じてエラーを収集

## クイックスタート

```go
import "github.com/arthurlch/goryu/client"

// Simple GET request
code, body, errs := client.Get("https://api.example.com/users").String()

// POST with JSON
type User struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

user := User{Name: "John", Email: "john@example.com"}
code, body, errs := client.Post("https://api.example.com/users").
    JSON(user).
    String()

// Complex request with multiple options
var result ResponseType
code, body, errs := client.Get("https://api.example.com/data").
    UserAgent("MyApp/1.0").
    BasicAuth("user", "pass").
    Query("page", "1").
    Query("limit", "10").
    Timeout(30 * time.Second).
    Struct(&result)
```

## API リファレンス

### リクエストの作成

```go
// Using package-level functions
client.Get(url)
client.Post(url)
client.Put(url)
client.Delete(url)
client.Patch(url)
client.Head(url)

// Or create an agent first
agent := client.New()
agent.Get(url)
```

### リクエストの設定

#### ヘッダー
```go
// Set a header (replaces existing)
agent.Set("Authorization", "Bearer token")

// Add a header (appends to existing)
agent.Add("Accept", "application/json")

// Convenience methods
agent.UserAgent("MyApp/1.0")
agent.ContentType("application/json")
```

#### リクエストボディ
```go
// Raw bytes
agent.Body([]byte("raw data"))

// JSON payload
agent.JSON(structOrMap)

// Form data
formData := url.Values{}
formData.Add("key", "value")
agent.Form(formData)
```

#### 認証
```go
// Basic authentication
agent.BasicAuth("username", "password")

// Bearer token (via Set)
agent.Set("Authorization", "Bearer your-token")
```

#### その他のオプション
```go
// Query parameters
agent.Query("search", "goryu")

// Cookies
agent.Cookie("session_id", "abc123")

// Timeout
agent.Timeout(10 * time.Second)

// Skip TLS verification (use with caution)
agent.InsecureSkipVerify()
```

### レスポンスの取得

```go
// Get response as string
statusCode, body, errors := agent.String()

// Get response as bytes
statusCode, body, errors := agent.Bytes()

// Decode JSON response into struct
var data MyStruct
statusCode, body, errors := agent.Struct(&data)
```

## エラーハンドリング

クライアントはリクエストチェーン全体を通じてエラーを集約します。常にエラーのスライスを確認してください。

```go
code, body, errs := client.Get("https://api.example.com").String()
if len(errs) > 0 {
    for _, err := range errs {
        log.Printf("Error: %v", err)
    }
    return
}
```

## 例

### JSON API リクエスト
```go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

type CreateUserResponse struct {
    ID        int    `json:"id"`
    CreatedAt string `json:"created_at"`
}

req := CreateUserRequest{
    Name:  "Jane Doe",
    Email: "jane@example.com",
}

var resp CreateUserResponse
code, _, errs := client.Post("https://api.example.com/users").
    JSON(req).
    Set("X-API-Key", "secret").
    Struct(&resp)

if len(errs) > 0 {
    // Handle errors
}

if code == 201 {
    fmt.Printf("User created with ID: %d\n", resp.ID)
}
```

### フォーム送信
```go
formData := url.Values{}
formData.Add("username", "johndoe")
formData.Add("password", "secret123")

code, body, errs := client.Post("https://example.com/login").
    Form(formData).
    Cookie("csrf_token", "xyz789").
    String()
```

### 進捗付きダウンロード
```go
code, data, errs := client.Get("https://example.com/large-file.zip").
    UserAgent("Goryu-Downloader/1.0").
    Timeout(5 * time.Minute).
    Bytes()

if len(errs) == 0 && code == 200 {
    // Save to file
    err := os.WriteFile("downloaded.zip", data, 0644)
}
```

## テスト

このクライアントは Go の `httptest` パッケージとうまく連携するように設計されています。

```go
func TestMyHandler(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(myHandler))
    defer server.Close()
    
    code, body, errs := client.Get(server.URL + "/endpoint").String()
    // Assert on code, body, errs
}
```

## パフォーマンスに関する考慮事項

- クライアントはデフォルトで、リクエストチェーンごとに新しい `http.Client` を作成します
- 同じホストへ複数回リクエストする場合は、エージェントの再利用を検討してください。
  ```go
  agent := client.New()
  agent.Timeout(30 * time.Second)
  
  // Reuse agent for multiple requests
  agent.Get(url1).String()
  agent.Get(url2).String()
  ```
- レスポンスボディは完全にメモリに読み込まれます。大きなレスポンスの場合は、標準の `net/http` パッケージを直接使用することを検討してください

## 注意事項

- すべてのエラーはデバッグしやすいようにまとめて収集され、返されます
- クライアントは goroutine セーフではありません。並行リクエストには別々のエージェントを作成してください
- TLS 検証を無効にするのは、開発／テスト環境に限るべきです
