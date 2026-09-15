# Tracing ミドルウェア

Goryu アプリケーションにおける分散トレーシングのためのミドルウェアです。スパンの開始、コンテキストの伝播、イベントの記録を行うための、ベンダーに依存しないインターフェースを提供します。

## 特徴

- **ベンダー非依存**: あらゆるトレーシングバックエンド（OpenTelemetry、Jaeger、Zipkin）向けに実装できる `Tracer` インターフェースを定義します。
- **コンテキストの伝播**: トレースヘッダー（`X-Trace-Id`、`X-Span-Id`）を自動的に抽出・注入します。
- **自動計装**: すべてのリクエストに対して、標準的な HTTP タグ付きのスパンを作成します。
- **イベント記録**: スパンにイベントやカスタムタグを追加するためのヘルパーメソッドを提供します。

## 使い方

### 基本的なセットアップ

`Tracer` インターフェースの実装を提供する必要があります。以下は概念的な例です:

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/tracing"
)

// Your tracer implementation (e.g., wrapping OpenTelemetry)
type MyTracer struct {}
// ... implement StartSpan, Extract, Inject

func main() {
    app := goryu.New()

    tracer := &MyTracer{}

    app.Use(tracing.New(tracing.Config{
        Tracer: tracer,
        SampleRate: 1.0, // Sample 100% of requests
    }))

    app.GET("/", func(c *goryuctx.Context) {
        // Get current span
        if span, ok := tracing.GetSpan(c); ok {
            span.AddEvent("processing_logic", map[string]interface{}{
                "user_id": "123",
            })
        }
        c.Status(200).String("Hello Tracing")
    })

    app.Listen(":8080")
}
```

### インターフェースの定義

お好みのトレーシングバックエンドを統合するには、以下のインターフェースを実装します:

```go
type Tracer interface {
    StartSpan(ctx context.Context, name string) (Span, context.Context)
    Extract(headers http.Header) (SpanContext, error)
    Inject(spanContext SpanContext, headers http.Header) error
}

type Span interface {
    SetTag(key string, value interface{})
    SetStatus(code StatusCode, message string)
    AddEvent(name string, attributes map[string]interface{})
    End()
    Context() SpanContext
}
```

### シンプルなトレーサー

このパッケージには、テストや簡易的なデバッグを目的とした `SimpleTracer` が含まれています。スパンをメモリ内に保存します。

```go
tracer := tracing.NewSimpleTracer()
app.Use(tracing.New(tracing.Config{Tracer: tracer}))
```
