# Goryu モニタリングシステム

Goryu アプリケーション向けの包括的なモニタリングおよびヘルスチェックシステムで、自動的に統合されます。

## 特徴

- **自動統合**: デフォルトですべての Goryu アプリに組み込まれています
- **イベントモニタリング**: 相関 ID を用いて、リクエスト、エラー、カスタムイベントを追跡します
- **ヘルスチェック**: パニックリカバリー付きでアプリケーションのコンポーネントを監視します
- **高度なメトリクス**: ルートレベル、ミドルウェアのパフォーマンス、システムメトリクス
- **リクエストトレーシング**: 相関 ID の生成と伝播
- **組み込みエンドポイント**: すぐに使えるモニタリングデータ用の HTTP エンドポイント
- **イベントハンドラー**: カスタムのイベント処理とアラート

## クイックスタート

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/monitoring"
)

func main() {
    // goryu.Default() enables monitoring automatically!
    app := goryu.Default()
    
    // Add a health check
    app.AddHealthCheck("database", &monitoring.HealthCheck{
        Check: func() (monitoring.HealthStatus, error) {
            return monitoring.StatusHealthy, nil
        },
        Critical: true,
    })
    
    // Emit custom events
    app.EmitEvent(monitoring.EventCustom, "User login", map[string]interface{}{
        "user_id": "123",
    })
    
    app.Listen(":8080")
}
```

## 組み込みエンドポイント

モニタリング用のエンドポイントは自動的に登録されます:

- `GET /_health` - ヘルスチェックの状態
- `GET /_metrics` - アプリケーションのメトリクス
- `GET /_events` - 最近のイベント（?limit=N パラメータ付き）

## ヘルスチェック

ヘルスチェックを使用すると、アプリケーションのさまざまなコンポーネントの状態を監視できます:

```go
app.AddHealthCheck("database", &monitoring.HealthCheck{
    Check: func() (monitoring.HealthStatus, error) {
        if err := db.Ping(); err != nil {
            return monitoring.StatusUnhealthy, err
        }
        return monitoring.StatusHealthy, nil
    },
    Timeout:  5 * time.Second,
    Interval: 30 * time.Second,
    Critical: true, // Will mark overall status as unhealthy if this fails
})
```

### ヘルスステータスのレベル

- `StatusHealthy` - コンポーネントは正常に動作しています
- `StatusDegraded` - コンポーネントに問題はありますが、まだ機能しています
- `StatusUnhealthy` - コンポーネントは動作していません

### 全体的なヘルスの判定ロジック

- いずれかの**クリティカル**なヘルスチェックが `StatusUnhealthy` の場合 → 全体のステータスは `StatusUnhealthy`
- いずれかのヘルスチェックが `StatusUnhealthy`（非クリティカル）の場合 → 全体のステータスは `StatusDegraded`
- いずれかのヘルスチェックが `StatusDegraded` の場合 → 全体のステータスは `StatusDegraded`
- それ以外の場合 → 全体のステータスは `StatusHealthy`

## イベントモニタリング

システムは HTTP リクエストとエラーを自動的に追跡します。カスタムイベントを発行することもできます:

```go
// Emit a custom event
app.EmitEvent(monitoring.EventCustom, "User registered", map[string]interface{}{
    "user_id": "123",
    "email":   "user@example.com",
})
```

### イベントタイプ

- `EventRequest` - HTTP リクエスト（自動）
- `EventError` - HTTP エラー（自動）
- `EventHealthy` - ヘルスチェック成功（自動）
- `EventUnhealthy` - ヘルスチェック失敗（自動）
- `EventStartup` - アプリケーションの起動（自動）
- `EventShutdown` - アプリケーションのシャットダウン
- `EventCustom` - 独自のカスタムイベント

## 拡張メトリクス

システムは包括的なメトリクスを自動的に収集します:

```go
{
    "request_count": 1523,
    "error_count": 12,
    "avg_response_time": "45ms",
    "active_requests": 5,
    "uptime": "2h30m15s",
    "memory_usage_bytes": 67108864,
    "goroutines": 15,
    "status_code_counts": {
        "200": 1400,
        "404": 15,
        "500": 8
    },
    "route_metrics": {
        "GET:/users": {
            "request_count": 800,
            "error_count": 2,
            "avg_response_time": "20ms",
            "status_codes": {"200": 798, "500": 2}
        },
        "POST:/users": {
            "request_count": 100,
            "error_count": 1,
            "avg_response_time": "45ms"
        }
    },
    "middleware_metrics": {
        "auth": {
            "execution_count": 1500,
            "avg_execution_time": "5ms",
            "error_count": 0
        },
        "cors": {
            "execution_count": 1500,
            "avg_execution_time": "1ms"
        }
    }
}
```

## リクエストトレーシング

すべてのリクエストには、トレーシングのための相関 ID が自動的に付与されます:

```go
app.GET("/api/data", func(c *context.Context) {
    // Get the correlation ID
    correlationID, _ := c.Get("correlation_id")
    
    // The correlation ID is also available in response headers
    // X-Correlation-ID: abc123def456
    
    c.JSON(200, map[string]interface{}{
        "correlation_id": correlationID,
        "data": "response",
    })
})
```

すべてのイベントには、ログやモニタリングシステム全体でリクエストをトレースするための相関 ID が含まれます。

## ミドルウェアのパフォーマンス追跡

個々のミドルウェアのパフォーマンスを監視します:

```go
// Wrap any middleware to track its performance
wrappedAuth := app.Monitor.MiddlewareWrapper("auth", authMiddleware)
app.Use(wrappedAuth)

// Performance data will be available in middleware_metrics
```

## イベントハンドラー

ロギング、アラート、外部システムとの連携のために、カスタムのイベントハンドラーを追加できます:

```go
app.Monitor.AddEventHandler(func(event monitoring.Event) {
    if event.Type == monitoring.EventError {
        // Events now include correlation_id for tracing
        log.Printf("Error %s: %s (correlation: %s)", 
            event.ID, event.Message, event.Data["correlation_id"])
        sendAlert(event)
    }
})
```

## 設定

モニタリングシステムを設定します:

```go
monitor := monitoring.New(monitoring.Config{
    Enabled:        true,
    MaxEvents:      1000,           // Maximum events to keep in memory
    HealthInterval: 30*time.Second, // How often to run health checks
    MetricsEnabled: true,
})
```

## ヘルスチェックの例

### データベースのヘルスチェック

```go
app.AddHealthCheck("database", &monitoring.HealthCheck{
    Check: func() (monitoring.HealthStatus, error) {
        ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
        defer cancel()
        
        if err := db.PingContext(ctx); err != nil {
            return monitoring.StatusUnhealthy, err
        }
        return monitoring.StatusHealthy, nil
    },
    Critical: true,
})
```

### 外部サービスのヘルスチェック

```go
app.AddHealthCheck("payment_service", &monitoring.HealthCheck{
    Check: func() (monitoring.HealthStatus, error) {
        resp, err := http.Get("https://api.payments.com/health")
        if err != nil {
            return monitoring.StatusUnhealthy, err
        }
        defer resp.Body.Close()
        
        if resp.StatusCode == 200 {
            return monitoring.StatusHealthy, nil
        }
        return monitoring.StatusDegraded, fmt.Errorf("service returned %d", resp.StatusCode)
    },
    Critical: false, // Non-critical service
})
```

### メモリ使用量のヘルスチェック

```go
app.AddHealthCheck("memory", &monitoring.HealthCheck{
    Check: func() (monitoring.HealthStatus, error) {
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        
        memMB := m.Alloc / 1024 / 1024
        if memMB > 500 {
            return monitoring.StatusUnhealthy, fmt.Errorf("memory too high: %dMB", memMB)
        } else if memMB > 200 {
            return monitoring.StatusDegraded, fmt.Errorf("memory elevated: %dMB", memMB)
        }
        return monitoring.StatusHealthy, nil
    },
})
```

## 外部システムとの統合

### Prometheus との統合

```go
app.Monitor.AddEventHandler(func(event monitoring.Event) {
    // Export metrics to Prometheus
    prometheusCounter.Inc()
})
```

### ロギングとの統合

```go
app.Monitor.AddEventHandler(func(event monitoring.Event) {
    logger.Info("monitoring_event",
        "type", event.Type,
        "message", event.Message,
        "data", event.Data,
    )
})
```

## ベストプラクティス

1. **クリティカルなヘルスチェックは控えめに使う** - その失敗によってサービス全体が利用不能になるべき場合にのみ、ヘルスチェックをクリティカルとしてマークしてください

2. **適切なタイムアウトを設定する** - ブロッキングを避けるため、ヘルスチェックには妥当なタイムアウトを設定してください

3. **主要な依存関係を監視する** - データベース、外部 API、重要なサービスに対してヘルスチェックを追加してください

4. **カスタムイベントを意味のある形で使う** - ビジネス上重要な操作についてカスタムイベントを発行してください

5. **アラートを設定する** - イベントハンドラーを使用してアラートシステムと連携してください

6. **リソース使用量を監視する** - メモリ、ディスク容量、その他のリソースに対してヘルスチェックを追加してください

7. **ヘルスチェックをテストする** - ヘルスチェックが実際に問題を検出できることを確認してください

## レスポンス形式の例

### ヘルスエンドポイントのレスポンス

```json
{
  "status": "healthy",
  "timestamp": "2023-12-07T10:30:00Z",
  "checks": {
    "database": {
      "name": "database",
      "status": "healthy",
      "timestamp": "2023-12-07T10:30:00Z",
      "duration": "2ms",
      "critical": true
    }
  }
}
```

### メトリクスエンドポイントのレスポンス

```json
{
  "request_count": 1523,
  "error_count": 12,
  "avg_response_time": "45ms",
  "uptime": "2h30m15s",
  "memory_usage_bytes": 67108864,
  "goroutines": 15,
  "start_time": "2023-12-07T08:00:00Z"
}
```

### イベントエンドポイントのレスポンス

```json
{
  "events": [
    {
      "id": "1701936600000000000",
      "type": "request",
      "timestamp": "2023-12-07T10:30:00Z",
      "message": "GET /api/users",
      "data": {
        "method": "GET",
        "path": "/api/users",
        "status_code": 200,
        "duration_ms": 45
      }
    }
  ],
  "total": 1523
}
```
