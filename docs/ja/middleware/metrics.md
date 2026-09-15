# Metrics Middleware

Goryu アプリケーションを Prometheus スタイルのメトリクスで計測するためのミドルウェアです。リクエストレート、レイテンシ、サイズを追跡し、カスタムメトリクスを記録するためのインターフェースを提供します。

## 機能

- **標準メトリクス**: 以下を自動的に追跡します:
    - `http_requests_total` (Counter)
    - `http_request_duration_seconds` (Histogram)
    - `http_requests_active` (Gauge)
    - `http_request_size_bytes` (Histogram、任意)
    - `http_response_size_bytes` (Histogram、任意)
- **タグ付け**: `method`、`path`、`status`（または `status_class`）などの標準タグを追加します。
- **カスタムメトリクス**: アプリケーション固有のメトリクスを記録するためのインターフェースを提供します。
- **バックエンド非依存**: `Metrics` インターフェースを定義しており、アダプターを実装することで任意のバックエンド（Prometheus、StatsD、Datadog）と統合できます。

## 使い方

### 基本的なセットアップ

`Metrics` インターフェースの実装を提供する必要があります。以下は、仮想的な Prometheus クライアントを使用した概念的な例です:

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/metrics"
    
    // Note: This example uses the official Prometheus client
    // go get github.com/prometheus/client_golang/prometheus
    "github.com/prometheus/client_golang/prometheus"
)

// Adapter implementation (simplified)
type PrometheusAdapter struct {
    // ... fields for prometheus collectors
}
// ... implement IncrementCounter, RecordHistogram, etc.

func main() {
    app := goryu.New()

    adapter := NewPrometheusAdapter()

    app.Use(metrics.New(metrics.Config{
        Metrics: adapter,
        Prefix:  "myapp", // Metric name prefix
    }))

    app.GET("/", func(c *goryuctx.Context) {
        c.Status(200).String("Hello Metrics")
    })

    app.Listen(":8080")
}
```

### 設定

```go
app.Use(metrics.New(metrics.Config{
    Metrics:         adapter,
    Prefix:          "api",
    RecordBody:      true,  // Track request/response sizes
    GroupStatusCode: true,  // Use "2xx", "5xx" instead of "200", "500"
    CustomTags: func(c *goryuctx.Context) map[string]string {
        return map[string]string{
            "region": os.Getenv("REGION"),
        }
    },
}))
```

### インターフェースの定義

お好みのメトリクスバックエンドを統合するには、次のインターフェースを実装します:

```go
type Metrics interface {
    IncrementCounter(name string, tags map[string]string)
    AddToCounter(name string, value float64, tags map[string]string)
    RecordHistogram(name string, value float64, tags map[string]string)
    SetGauge(name string, value float64, tags map[string]string)
    AddToGauge(name string, value float64, tags map[string]string)
}
```
