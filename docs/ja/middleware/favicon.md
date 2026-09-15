# Favicon Middleware

Goryu アプリケーションの favicon を効率的に配信するためのミドルウェアです。インメモリキャッシュと `Cache-Control` ヘッダーの自動管理をサポートします。

## 機能

- **効率的な配信**: favicon ファイルを直接配信します。
- **キャッシュ**: ファイル内容をメモリにキャッシュし、ディスク I/O を削減します。
- **ブラウザキャッシュ**: クライアント側キャッシュのために `Cache-Control` ヘッダーを自動的に設定します。
- **No Content**: ファイルが指定されていない場合に `204 No Content` レスポンスを返せます（ブラウザの 404 を抑制するのに便利です）。

## 使い方

### 基本的なセットアップ

`/favicon.ico` へのリクエストに対して `204 No Content` レスポンスを返します（API に便利です）:

```go
app.Use(favicon.Default())
```

### ファイルの配信

ディスク上の特定のファイルを配信します:

```go
app.Use(favicon.WithFile("./assets/favicon.ico"))
```

### 高度な設定

```go
app.Use(favicon.New(favicon.Config{
    File:      "./static/icon.png",
    URL:       "/favicon.ico",
    CacheFile: true,            // Cache in memory
    MaxAge:    3600,            // Cache-Control max-age in seconds
}))
```

## なぜこれを使うのか

ブラウザは Web サイトを訪問する際に自動的に `/favicon.ico` をリクエストします。このリクエストを処理しないと、ログが `404 Not Found` エラーで散らかってしまいます。このミドルウェアは、ファイルを配信するか「No Content」レスポンスを返すことで、これを効率的に処理し、ログをクリーンに保ち、ユーザーを満足させます。
