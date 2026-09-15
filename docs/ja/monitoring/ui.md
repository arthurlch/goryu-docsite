# Goryu モニタリングダッシュボード UI

Goryu アプリケーションをリアルタイムで監視できる、美しくレスポンシブな Web インターフェースです。

## 🎯 特徴

- **リアルタイムダッシュボード** - 5 秒ごとに自動更新
- **レスポンシブデザイン** - デスクトップ、タブレット、モバイルで動作
- **ヘルスステータスの概要** - 色分けされた視覚的なステータスインジケーター
- **ライブメトリクス** - メモリ使用量、リクエスト数、エラー率、稼働時間
- **ライブメトリクス** - メモリ使用量、リクエスト数、エラー率、稼働時間
- **イベントフィルタリング** - テキスト検索（"error"、"user_id"）またはカテゴリチップでフィルタ
- **ヘルスチェックの詳細** - 個々のコンポーネントのヘルスステータス
- **モダンな SPA** - シームレスなバックグラウンドポーリングを備えたシングルページアプリケーション

## 🚀 クイックスタート

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/monitoring" 
)

func main() {
    app := goryu.New(goryu.Config{
        AppName: "My Application",
    })
    
    // Enable monitoring with UI
    app.EnableMonitoring("/_monitor")
    
    // Add some health checks
    app.AddHealthCheck("database", &monitoring.HealthCheck{
        Check: func() (monitoring.HealthStatus, error) {
            // Your health check logic here
            return monitoring.StatusHealthy, nil
        },
        Critical: true,
    })
    
    app.Listen(":8080")
}
```

その後、次の URL にアクセスします: `http://localhost:8080/_monitor/ui`

## 📋 利用可能なエンドポイント

`app.EnableMonitoring("/_monitor")` を呼び出すと、次のものが利用可能になります:

- `/_monitor` → UI ダッシュボードへリダイレクト
- `/_monitor/ui` → **Web ダッシュボード UI**
- `/_monitor/health` → JSON 形式のヘルスステータス
- `/_monitor/metrics` → JSON 形式のメトリクスデータ
- `/_monitor/events` → JSON 形式のイベントフィード
- `/_monitor/dashboard` → JSON 形式の概要

## 🎨 ダッシュボードのセクション

### 1. ステータス概要カード
- **全体のステータス** - 色分けされた Healthy / Degraded / Unhealthy
- **稼働時間** - アプリケーションが稼働している時間
- **総リクエスト数** - 処理された HTTP リクエストの数
- **エラー数** - エラーレスポンスの数

### 2. ヘルスチェックパネル
- 個々のヘルスチェックのステータス
- クリティカル／非クリティカルのインジケーター
- 各チェックのレスポンス時間
- チェック失敗時のエラーメッセージ

### 3. 最近のイベントパネル
- **検索ボックス**: メッセージ、タイプ、データ内容でイベントをフィルタ
- **カテゴリトグル**: Request、Error、Custom イベントの表示／非表示
- **ストリーム**: 新しい項目が即座に表示されるリアルタイムのイベントフィード

### 4. システムメトリクスパネル
- **メモリ使用量** - 現在のメモリ消費量
- **Goroutine** - アクティブな goroutine の数
- **平均レスポンス時間** - 平均のレスポンス時間
- **エラー率** - 失敗したリクエストの割合

## 🎯 ヘルスステータスの色分け

- 🟢 **緑（Healthy）** - すべてのシステムが正常に稼働
- 🟡 **黄（Degraded）** - 一部に問題はあるが依然として機能
- 🔴 **赤（Unhealthy）** - クリティカルなシステムが停止

## ⚡ 自動更新機能

- **スマート更新** - タブが非表示のときは一時停止し、表示されると再開
- **5 秒間隔** - サーバーに過度な負荷をかけないリアルタイム更新
- **手動更新** - 'R' キーを押すと即座に更新
- **ローディングインジケーター** - 更新中の視覚的なフィードバック

## 📱 レスポンシブデザイン

ダッシュボードはさまざまな画面サイズに適応します:

- **デスクトップ** - すべてのパネルを備えた 2 カラムのフルレイアウト
- **タブレット** - 単一カラムのレイアウト、最適化された余白
- **モバイル** - コンパクトなデザイン、タッチ操作に適したインターフェース

## 🛠 カスタマイズ

### カスタムアプリ名
```go
app := goryu.New(goryu.Config{
    AppName: "My Custom Application", // Shows in dashboard title
})
```

### カスタムモニタリングパス
```go
app.EnableMonitoring("/admin/monitoring") // Custom base path
// UI available at: /admin/monitoring/ui
```

### カスタムヘルスチェック
```go
app.AddHealthCheck("custom_service", &monitoring.HealthCheck{
    Check: func() (monitoring.HealthStatus, error) {
        // Your custom logic
        if serviceIsDown() {
            return monitoring.StatusUnhealthy, fmt.Errorf("service unavailable")
        }
        return monitoring.StatusHealthy, nil
    },
    Critical: false, // Won't fail overall health if this fails
})
```

## 📊 UI 上のイベントタイプ

ダッシュボードは、それぞれ異なる視覚的インジケーターとともに、さまざまなイベントタイプを表示します:

- 🔵 **Request イベント** - HTTP リクエスト（青いドット）
- 🔴 **Error イベント** - HTTP エラー（赤いドット）
- 🟣 **Custom イベント** - アプリケーション独自のイベント（紫のドット）
- 🟢 **Health イベント** - ヘルスチェック成功（緑のドット）
- 🟠 **Unhealthy イベント** - ヘルスチェック失敗（オレンジのドット）

## 🔄 リアルタイム更新

UI はシングルページアプリケーション（SPA）として動作します:
- **バックグラウンドポーリング**: JSON データ（`/_metrics`、`/_health`、`/_events`）を 2 秒ごとに取得します。
- **効率的**: 変更された DOM 要素のみを更新します。
- **レスポンシブ**: ページのちらつきや再読み込みがありません。

## 🎪 ダッシュボード表示の例

### 正常なアプリケーション
```
Status Overview: All Green
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Healthy   │  2h 30m 15s │    1,523    │      12     │
│ App Status  │   Uptime    │  Requests   │   Errors    │
└─────────────┴─────────────┴─────────────┴─────────────┘

Health Checks: All passing ✅
Recent Events: Mostly requests with few errors
Metrics: Normal memory usage, good response times
```

### 問題を抱えたアプリケーション
```
Status Overview: Degraded (Yellow)
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Degraded   │  45m 22s    │     892     │     127     │
│ App Status  │   Uptime    │  Requests   │   Errors    │
└─────────────┴─────────────┴─────────────┴─────────────┘

Health Checks: Database failing ❌, API degraded ⚠️
Recent Events: Multiple error events visible
Metrics: High error rate, elevated response times
```

## 🚀 パフォーマンス

モニタリング UI は次のように設計されています:

- **高速な読み込み** - 単一の HTML テンプレート、埋め込み型の CSS/JS
- **軽量** - 外部依存なし
- **効率的** - 最小限のデータ転送
- **スケーラブル** - 高トラフィックのアプリケーションでも良好に動作

## 🔧 統合の例

### Docker との統合
```dockerfile
EXPOSE 8080
CMD ["./app"]
# Dashboard available at http://container:8080/_monitor/ui
```

### ロードバランサーとの統合
```nginx
location /_monitor/ {
    proxy_pass http://app:8080/_monitor/;
    proxy_set_header Host $host;
}
```

### 認証との統合
```go
// Protect monitoring endpoints
adminGroup := app.Group("/_monitor", authMiddleware())
// Then enable monitoring will respect the group middleware
```

## 💡 ベストプラクティス

1. **アクセスを保護する** - 本番環境ではモニタリングエンドポイントを保護してください
2. **ヘルスチェック** - すべての重要な依存関係に対してヘルスチェックを追加してください
3. **カスタムイベント** - 重要なビジネス操作についてイベントを発行してください
4. **リソース監視** - メモリ、コネクションなどを監視してください
5. **アラート連携** - イベントハンドラーを使用してアラートを設定してください

## 🎨 UI のカスタマイズ

ダッシュボードはモダンなデザインシステムを採用しています:

- **カラー** - 青のグラデーションヘッダー、緑／黄／赤のステータスインジケーター
- **タイポグラフィ** - 最高のパフォーマンスのためのシステムフォント
- **レイアウト** - レスポンシブデザインのための CSS Grid
- **アニメーション** - 控えめなホバー効果とトランジション
- **アイコン** - イベントタイプ用の色分けされたドット

## 📈 表示されるメトリクス

### リクエストメトリクス
- 処理された総リクエスト数
- エラー数と割合
- 平均レスポンス時間
- 秒間リクエスト数（計算値）

### システムメトリクス
- メモリ使用量（人間が読みやすい形式でフォーマット）
- goroutine の数
- アプリケーションの稼働時間
- 起動時刻

### ヘルスメトリクス
- 全体のヘルスステータス
- 個々のチェックのステータス
- チェックのレスポンス時間
- クリティカル／非クリティカルのインジケーター

この UI は、Goryu アプリケーションを効果的に監視するために必要なすべてを提供します！🎉
