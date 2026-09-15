# Route パッケージ

`route` パッケージは、Goryu で使用される中核的な `Route` 構造体を定義します。`router` パッケージと `context` パッケージ間の循環インポートを避けるため、軽量で依存関係を持たないパッケージとして設計されています。

## 目的

複雑なフレームワークでは、次のような場合に循環依存が発生することがあります:
- `Router` が `Routes` を認識する必要がある。
- `Context` が現在の `Route` を認識する必要がある。
- `Route` が `Router` を参照する必要がある場合がある。

これを解決するため、`Route` 構造体はこの独立したパッケージ内で定義されています。

## Route 構造体

`Route` 構造体は、登録されたルートに関するすべてのメタデータを保持します:

```go
type Route struct {
    Method      string      // HTTP Method (GET, POST, etc.)
    Path        string      // URL Path (e.g., /users/:id)
    Handler     interface{} // The handler function
    Name        string      // Unique name for the route
    Description string      // Documentation description
    Router      interface{} // Reference to the parent router
}
```

## 使い方

通常はルートを `goryu` パッケージや `router` パッケージ経由で操作しますが、コンテキストから現在のルートを調べる際に `Route` 構造体に触れることがあります:

```go
import "github.com/arthurlch/goryu/goryuctx"

func MyHandler(c *goryuctx.Context) error {
    // Access the current route
    currentRoute := c.Route
    
    fmt.Printf("Handling request for: %s %s\n", 
        currentRoute.Method, 
        currentRoute.Path,
    )
    
    return nil
}
```

### ルートの命名

より簡単な検索や逆ルーティング（対応している場合）のために、ルートに名前を付けることができます:

```go
app.GET("/users/:id", GetUser).SetName("get_user")
```

これにより、基盤となる `Route` 構造体の `Name` フィールドが更新されます。
