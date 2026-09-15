# Compress ミドルウェア

Gzip または Deflate を使用して HTTP レスポンスを圧縮するミドルウェアです。クライアントの `Accept-Encoding` ヘッダーに基づいて、最適なエンコーディングを自動的にネゴシエートします。

## 機能

- **複数のアルゴリズム**: `gzip` と `deflate` をサポートします。
- **コンテンツフィルタリング**: 特定のコンテンツタイプ（例: HTML、JSON、XML）のみを圧縮します。
- **サイズしきい値**: オーバーヘッドを避けるため、小さなレスポンス（設定可能な `MinLength`）の圧縮をスキップします。
- **設定可能なレベル**: 圧縮レベル（BestSpeed か BestCompression か）を調整できます。

## 使い方

### 基本的なセットアップ

デフォルト設定（Gzip/Deflate、デフォルトレベル）で圧縮を有効にします。

```go
app.Use(compress.Default())
```

### Gzip のみ

Gzip 圧縮を強制します。

```go
app.Use(compress.WithGzip(compress.LevelBestCompression))
```

### 高度な設定

```go
app.Use(compress.New(compress.Config{
    Level:     compress.LevelBestSpeed, // Prioritize speed
    MinLength: 2048,                    // Only compress if > 2KB
    CompressibleTypes: []string{
        "text/html",
        "application/json",
        "image/svg+xml",
    },
}))
```

## 仕組み

1.  **ネゴシエーション**: `Accept-Encoding` ヘッダーを確認します。
2.  **バッファリング**: サイズを判定するためにレスポンスをバッファリングします。
3.  **フィルタリング**: `Content-Type` が許可リストに含まれているか、およびサイズが `MinLength` を超えているかを確認します。
4.  **圧縮**: 条件を満たす場合はボディを圧縮し、`Content-Encoding` を設定します。それ以外の場合は、元のレスポンスを送信します。

## パフォーマンスに関する注意

圧縮は CPU を消費します。帯域幅の使用量を削減しクライアントの読み込み時間を改善する一方で、トラフィックの多いサーバーでは CPU オーバーヘッドに注意してください。`LevelBestSpeed` はしばしば良好なトレードオフとなります。
