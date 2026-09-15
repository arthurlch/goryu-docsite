# 🗄️ Goryu DB パッケージ

> **安全で堅牢、かつドライバーに依存しないデータベース接続。**

`db` パッケージは、厳格なセキュリティポリシーを強制しつつ、さまざまなデータベースに接続する統一的な方法を提供します。コネクションプーリング、DSN の構築、セキュリティ検証を自動的に処理します。

---

## ✨ 主な特徴

- **🛡️ デフォルトで安全**:
    - **インジェクション対策**: すべての接続パラメータを SQL インジェクションのパターンに対して検証します。
    - **パス保護**: SQLite データベースに対するディレクトリトラバーサル攻撃を防止します。
    - **サニタイズ**: 認証情報とパラメータを自動的に URL エンコードします。
- **🔌 マルチドライバー対応**: PostgreSQL、MySQL、SQLite3 をファーストクラスでサポート。
- **🏊 コネクションプーリング**: `MaxOpenConns`、`MaxIdleConns`、接続の寿命を組み込みで設定可能。
- **✅ 自動検証**: 接続時にただちにデータベースへ ping を送り、到達可能性を確認します。

---

## 🚀 使い方

### 設定

アプリケーションの設定でデータベースを構成します。

```go
import "github.com/arthurlch/goryu/config"

cfg := &config.Config{
    Database: config.DatabaseConfig{
        Driver:          "postgres", // or "mysql", "sqlite3"
        Host:            "localhost",
        Port:            5432,
        Database:        "myapp",
        Username:        "user",
        Password:        "secret",
        SSLMode:         "disable",
        
        // Connection Pool Settings
        MaxOpenConns:    25,
        MaxIdleConns:    5,
        ConnMaxLifetime: 5 * time.Minute,
    },
}
```

### 接続

`db.Connect` を使って安全な接続を確立します。

```go
import (
    "log"
    "github.com/arthurlch/goryu/db"
)

func main() {
    // ... load config ...

    conn, err := db.Connect(cfg)
    if err != nil {
        log.Fatalf("Could not connect to database: %v", err)
    }
    defer conn.Close()

    // Access the underlying *sql.DB
    // conn.DB.Query(...)
    
    log.Println("Successfully connected to", conn.Driver)
}
```

---

## 🔒 セキュリティの詳細

`db` パッケージは、接続を試みる前の段階で複数のセキュリティチェックを実装しています。

### SQL インジェクションの防止
すべての入力（ユーザー名、パスワード、データベース名など）は、接続文字列でのインジェクション攻撃に利用され得る危険な文字（例: `;`、`--`、`/*`）がないかスキャンされます。

### SQLite のパストラバーサル
SQLite を使用する場合、以下を防ぐためにパスが厳格にチェックされます。
- ディレクトリトラバーサル（`../../etc/passwd`）
- システムディレクトリへのアクセス（`/etc/`、`/var/`）
- 隠しファイルへのアクセス（設定により任意）

### パラメータのサニタイズ
すべてのパラメータは、データソース名（DSN）を構築する際に URL エンコードされ、パラメータインジェクション攻撃を防ぎます。

---

## 📦 サポートされるドライバー

| ドライバー | 設定キー | 備考 |
|--------|------------|-------|
| **PostgreSQL** | `postgres` / `pgx` | SSL モード（`disable`、`require`、`verify-full`）をサポート。 |
| **MySQL** | `mysql` | 文字セット（デフォルト `utf8mb4`）をサポート。 |
| **SQLite3** | `sqlite3` | `:memory:` によるインメモリをサポート。 |
