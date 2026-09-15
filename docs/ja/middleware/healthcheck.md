# HealthCheck Middleware

Goryu アプリケーションにヘルスチェックエンドポイントを追加するためのミドルウェアです。Liveness プローブと Readiness プローブをサポートしており、Kubernetes やその他のコンテナオーケストレーションプラットフォームに最適です。

## 機能

- **標準エンドポイント**: Liveness（`/health/live`）、Readiness（`/health/ready`）、および一般的な Health（`/health`）に対して設定可能なパスを提供します。
- **カスタムプローブ**: データベース、外部サービス、または内部状態に対するカスタムチェックを登録できます。
- **タイムアウトサポート**: 応答性を確保するため、ヘルスチェックにタイムアウトを強制します。
- **JSON 出力**: 詳細なステータスとエラーメッセージを JSON 形式で返します。

## 使い方

### 基本的なセットアップ

デフォルトのヘルスチェックエンドポイントを有効にします:

```go
app.Use(healthcheck.Default())
```

これにより以下が公開されます:
- `/health/live`: サーバーが稼働している場合に 200 OK を返します。
- `/health/ready`: サーバーが稼働している場合に 200 OK を返します。
- `/health`: サーバーが稼働している場合に 200 OK を返します。

### カスタムプローブ

データベースや外部依存関係に対するチェックを追加します:

```go
app.Use(healthcheck.New(healthcheck.Config{
    LivenessProbes: map[string]healthcheck.Probe{
        "goroutine": healthcheck.AlwaysUpProbe(),
    },
    ReadinessProbes: map[string]healthcheck.Probe{
        "database": healthcheck.DatabaseProbe(db.Ping),
        "redis": func(ctx context.Context) error {
            return redisClient.Ping(ctx).Err()
        },
    },
}))
```

### ヘルパープローブ

このパッケージには、一般的なチェック用のヘルパー関数が含まれています:

- `healthcheck.DatabaseProbe(pingFunc)`: データベースへの接続性をチェックします。
- `healthcheck.HTTPProbe(url, client)`: 外部 HTTP サービスをチェックします。
- `healthcheck.AlwaysUpProbe()`: 常に成功を返します。
- `healthcheck.AlwaysDownProbe(msg)`: 常に失敗を返します（テストに便利です）。

## レスポンス形式

**成功（200 OK）:**

```json
{
  "status": "UP",
  "checks": {
    "database": { "status": "UP" }
  }
}
```

**失敗（503 Service Unavailable）:**

```json
{
  "status": "DOWN",
  "errors": {
    "database": "connection refused"
  },
  "checks": {
    "database": { "status": "DOWN", "error": "connection refused" }
  }
}
```
