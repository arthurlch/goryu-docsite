# CircuitBreaker ミドルウェア

Goryu 向けにサーキットブレーカーパターンを実装したミドルウェアです。障害の発生しているサービスへのリクエストを停止し、回復のための時間を与えることで、連鎖的な障害を防止します。

## 機能

- **状態管理**: `Closed`、`Open`、`Half-Open` の各状態を処理します。
- **設定可能なしきい値**: 失敗率、リクエスト数、タイムアウトをカスタマイズできます。
- **カスタム失敗ロジック**: 何を失敗とみなすか（例: 特定のエラーやステータスコード）を正確に定義できます。
- **イベントフック**: 状態変化時のコールバック（例: ロギングやメトリクス用）。
- **モニタリング**: 内部状態とメトリクスを公開します。

## 使い方

### 基本的なセットアップ

デフォルト設定でルートを保護します。

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/circuitbreaker"
    "time"
)

func main() {
    app := goryu.New()

    // Create a circuit breaker
    cb, middleware := circuitbreaker.WithCircuitBreaker(circuitbreaker.Config{
        FailureRatio: 0.5, // Open if 50% of requests fail
        Timeout:      60 * time.Second, // Wait 60s before trying again
    })

    // Apply to a specific route
    app.GET("/unreliable-service", middleware(func(c *goryuctx.Context) {
        // ... call external service ...
    }))

    app.Listen(":8080")
}
```

### グローバルミドルウェア

アプリケーション全体に適用します（注意: これはすべてのルート間で状態を共有します）。

```go
app.Use(circuitbreaker.New(circuitbreaker.Config{
    MaxRequests: 5, // Allow 5 requests in Half-Open state
}))
```

### 高度な設定

```go
app.Use(circuitbreaker.New(circuitbreaker.Config{
    MinRequests:  10,   // Need at least 10 requests before calculating ratio
    FailureRatio: 0.6,  // Break if > 60% fail
    Interval:     1 * time.Minute, // Reset counts every minute
    Timeout:      30 * time.Second, // Open state duration
    IsFailure: func(err error) bool {
        // Only treat specific errors as failures
        return err != nil && err.Error() == "connection refused"
    },
    OnStateChange: func(state circuitbreaker.State) {
        log.Printf("Circuit breaker changed state to: %s", state)
    },
}))
```

## 仕組み

1.  **Closed**: リクエストは通常どおり流れます。失敗がカウントされます。
2.  **Open**: 失敗率がしきい値を超えると、ブレーカーが開きます。すべてのリクエストは `503 Service Unavailable` で即座に失敗します。
3.  **Half-Open**: `Timeout` の期間が経過すると、ブレーカーは限られた数のリクエスト（`MaxRequests`）を通過させ、サービスが回復したかどうかをテストします。
    - これらのリクエストが成功すれば、ブレーカーは閉じます。
    - いずれかが失敗すれば、再び開きます。
