# Goryu CLI

`goryu` コマンドラインツールは、Goryu アプリケーション向けにプロジェクトのスキャフォールド、コード生成、開発ヘルパー、AI/エージェントツールを提供します。引数なしで実行すると対話型 TUI が起動し、コマンドを直接渡すこともできます。

## インストール

```bash
go install github.com/arthurlch/goryu/cmd/goryu@latest
```

またはソースからビルドします:

```bash
go build ./cmd/goryu
```

## クイックスタート

```bash
goryu init my-app
cd my-app
go mod tidy
go run cmd/server/main.go
```

アプリは `http://localhost:8080` で動作します。

## コマンドグループ

| グループ | コマンド |
|-------|----------|
| プロジェクト | [`init`](#init) |
| コード生成 | [`generate`](#generate-g) / [`g`](#generate-g) |
| スキャフォールド | [`scaffold`](#scaffold) |
| 開発 | [`dev`](#dev), [`build`](#build) |
| AI とツール | [`scaffold ai`](#scaffold-ai), [`mcp`](#mcp) |
| 管理 | [`routes`](#routes), [`middleware`](#middleware), [`config`](#config), [`validate`](#validate), [`version`](#version) |

すべてのサブコマンドは `--help` に対応しています。ロングフラグは `--flag`、短縮形がある場合は `-x, --flag` の形式で示します。

## プロジェクト

### `init`

テンプレートから新しい Goryu プロジェクトを初期化します。

```bash
goryu init <name> [flags]
```

**フラグ:**

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-t, --template` | プロジェクトテンプレート: `basic`, `api`, `web`, `db` | `basic` |
| `-p, --path` | プロジェクトのパス | `.` |
| `-m, --module` | Go モジュール名 | name から導出 |
| `--git` | git リポジトリを初期化 | `true` |
| `--docker` | Docker ファイルを含める | `false` |
| `--ci` | CI/CD 設定を含める | `false` |
| `--db-tool` | `db` テンプレート用のデータベースツール: `sqlc`, `ent`, `gorm` | `sqlc` |

**テンプレート:**

- `basic` — 最小限の Web アプリケーション。
- `api` — 拡張されたプロジェクト構成を持つ REST API。
- `web` — 静的アセットとビューを備えた Web アプリケーション。
- `db` — データベース層に接続されたアプリケーション（`--db-tool` でツールキットを選択）。

**例:**

```bash
# Minimal project
goryu init my-app

# REST API with Docker and CI
goryu init my-api --template=api --docker --ci

# Database project using ent, under a custom module path
goryu init billing --template=db --db-tool=ent --module=github.com/acme/billing
```

```text
Creating project 'my-api' (template: api)...
  created cmd/server/main.go
  created internal/handlers/
  created config/config.json
  initialized git repository
Done. Next: cd my-api && go mod tidy
```

## コード生成

### `generate` / `g`

テンプレートからボイラープレートコードを生成します。`g` は `generate` のエイリアスです。

```bash
goryu generate <type> <name> [flags]
goryu g <type> <name> [flags]
```

タイプ: `handler`, `middleware`, `model`, `route`, `config`。

#### `generate handler`

```bash
goryu generate handler <name> [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-t, --type` | ハンドラータイプ: `basic`, `crud`, `api`, `ai` | `basic` |
| `--kind` | AI ハンドラーの種類（`--type=ai` の場合のみ）: `chat`, `rag`, `agent` | `chat` |
| `-p, --path` | 出力パス | `internal/handlers` |
| `--model` | 関連するモデル名 | — |
| `--middleware` | 適用するミドルウェア（カンマ区切り） | — |
| `--route` | ルートパターン | `/{name}` |

`ai` タイプは、Goryu の AI バッテリーに接続されたストリーミング LLM ハンドラーをスキャフォールドします。型付き `Bind[T]` + `Validate`、JSON スキーマ用の `Schema[T]`、`SSEJSON` による SSE トークンストリーミング、そして [aimeter](/ja/middleware/aimeter) ミドルウェアによるトークン/コストの計上が含まれます。[promptcache](/ja/middleware/promptcache) と [recorder](/ja/middleware/recorder) と組み合わせ、完全なワークフローは [AI とエージェント](/ja/ai/) を参照してください。

```bash
# CRUD handler bound to a model
goryu g handler user --type=crud --model=User

# API handler behind auth + rate limiting
goryu g handler orders --type=api --middleware=auth,limiter

# Streaming AI chat handler
goryu g handler assistant --type=ai --kind=chat
```

#### `generate middleware`

```bash
goryu generate middleware <name> [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-t, --type` | ミドルウェアタイプ: `standard`, `builder`, `plugin` | `builder` |
| `-p, --path` | 出力パス | `internal/middleware` |
| `--global` | グローバルミドルウェアとして登録 | `false` |

```bash
goryu g middleware requestlog --type=builder --global
```

#### `generate model`

```bash
goryu generate model <name> [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-t, --type` | モデルタイプ: `basic`, `db` | `basic` |
| `--db-tool` | データベースツール: `gorm`, `sqlc`, `ent` | `gorm` |
| `-f, --fields` | モデルフィールド（カンマ区切り） | — |
| `-p, --path` | 出力パス | `internal/models` |

```bash
goryu g model product --type=db --fields="name:string,price:float64,in_stock:bool"
```

#### `generate route`

```bash
goryu generate route <name> [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-b, --builder` | ルートビルダーパターンを使用 | `true` |
| `-g, --group` | ルートグループのプレフィックス | — |
| `-m, --middleware` | ルートミドルウェア（カンマ区切り） | — |
| `--methods` | HTTP メソッド（カンマ区切り） | `GET,POST,PUT,DELETE` |

```bash
goryu g route user --group=/api/v1 --middleware=auth,limiter --methods=GET,POST
```

#### `generate config`

```bash
goryu generate config <name> [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-b, --builder` | 設定ビルダーパターンを使用 | `true` |
| `-t, --type` | 設定タイプ: `server`, `database`, `cache` | `server` |
| `-f, --format` | 設定フォーマット: `json`, `yaml`, `toml`, `env` | `json` |

```bash
goryu g config database --type=database --format=yaml
```

## スキャフォールド

### `scaffold`

機能やサービス一式を 1 コマンドでスキャフォールドします。

```bash
goryu scaffold <feature> <name> [flags]
```

機能: `api`, `service`, `ai`。

#### `scaffold api`

ハンドラー、モデル、データベース層、バリデーション、テストを含む完全な REST API リソースをスキャフォールドします。

```bash
goryu scaffold api <resource> --fields=<fields> [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-f, --fields` | リソースフィールド（カンマ区切り）— **必須** | — |
| `--db` | データベース層を含める | `true` |
| `--auth` | 認証を追加 | `false` |
| `--validation` | バリデーションを追加 | `true` |
| `--tests` | テストを生成 | `true` |

```bash
goryu scaffold api product --fields="name:string,price:float64" --auth
```

```text
Scaffolding REST API 'product'...
  internal/models/product.go
  internal/handlers/product_handler.go
  internal/handlers/product_handler_test.go
  internal/routes/product_routes.go
Done. 4 files created.
```

#### `scaffold service`

トランスポートとモニタリングの配線を備えたマイクロサービスをスキャフォールドします。

```bash
goryu scaffold service <name> [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `--grpc` | gRPC サポートを含める | `false` |
| `--http` | HTTP サポートを含める | `true` |
| `--kafka` | Kafka サポートを含める | `false` |
| `--monitoring` | モニタリングを含める | `true` |

```bash
goryu scaffold service payments --grpc --kafka
```

#### `scaffold ai`

Goryu の AI バッテリーに接続された AI/LLM エンドポイントをスキャフォールドします。

```bash
goryu scaffold ai <name> [--kind=chat|rag|agent] [--path=...]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-k, --kind` | エンドポイントの種類: `chat`（ストリーミングチャット）、`rag`（検索拡張応答）、`agent`（関数呼び出しスキーマ付きの型付きツールエンドポイント） | `chat` |
| `-p, --path` | 出力パス | `internal/handlers` |

```bash
goryu scaffold ai assistant --kind=chat
goryu scaffold ai docs-search --kind=rag
goryu scaffold ai booking --kind=agent
```

生成されたエンドポイントが計測・プロンプトキャッシュ・レコーディングの各ミドルウェアとどう組み合わさるかは [AI とエージェント](/ja/ai/) を参照してください。

## 開発

### `dev`

ホットリロード付きの開発サーバーを起動します。

```bash
goryu dev [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-p, --port` | サーバーポート | `3000` |
| `--hot-reload` | ホットリロードを有効化 | `true` |
| `-d, --debug` | デバッグモードを有効化 | `false` |

```bash
goryu dev --port=8080 --debug
```

### `build`

アプリケーションのバイナリをビルドします。

```bash
goryu build [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-o, --output` | 出力バイナリ名 | `server` |
| `-t, --target` | ビルドターゲット: `development`, `production` | `production` |
| `--compress` | バイナリを圧縮 | `false` |
| `--static` | 静的バイナリをビルド | `true` |

```bash
goryu build --output=api --target=production --compress
```

## AI とツール

### `mcp`

Goryu のプロジェクトツールを JSON-RPC で AI エージェントに公開する、stdio ベースの MCP（Model Context Protocol）サーバーを実行します。`list_routes`、`scaffold_handler`、`run_dev_server` を提供します。

```bash
goryu mcp
```

MCP クライアント（Claude Code、IDE のエージェントなど）を、プロジェクトディレクトリで実行中の `goryu mcp` に接続します。クライアント設定と完全なツールスキーマは [MCP サーバー](/ja/ai/mcp) を参照してください。

## 管理

### `routes`

アプリケーションのルートを確認・テストします。

```bash
goryu routes list [--format=table|json] [--filter=<pattern>]
goryu routes test <path> [method]
```

**`routes list` のフラグ:**

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-f, --format` | 出力フォーマット: `table`, `json` | `table` |
| `--filter` | パターンでルートを絞り込み | — |

```bash
goryu routes list --format=table
goryu routes test /api/v1/users GET
```

```text
METHOD  PATH                 HANDLER
GET     /api/v1/users        ListUsers
POST    /api/v1/users        CreateUser
GET     /api/v1/users/{id}   GetUser
```

### `middleware`

利用可能なミドルウェアを一覧・確認します。

```bash
goryu middleware list
goryu middleware info <name>
```

```bash
goryu middleware info limiter
```

```text
limiter — fixed-window rate limiting
  New(config...) / Default()
  Config: Max, Expiration, KeyGenerator, LimitReached
```

完全な一覧は [ミドルウェアカタログ](/ja/middleware/) を参照してください。

### `config`

アプリケーションの設定を管理します。

```bash
goryu config init [--type=server] [--format=json]
goryu config validate [--file=config.json]
goryu config migrate --from=<format> --to=<format>
```

**`config init` のフラグ:**

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-t, --type` | 設定タイプ | `server` |
| `-f, --format` | 設定フォーマット | `json` |

**`config validate` のフラグ:**

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `-f, --file` | 設定ファイル | `config.json` |

**`config migrate` のフラグ:**

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `--from` | 変換元フォーマット — **必須** | — |
| `--to` | 変換先フォーマット — **必須** | — |

```bash
goryu config init --type=server --format=yaml
goryu config validate --file=config/config.json
goryu config migrate --from=json --to=yaml
```

### `validate`

プロジェクト構成と設定を検証します。

```bash
goryu validate [flags]
```

| フラグ | 説明 | デフォルト |
|------|-------------|---------|
| `--config` | 設定ファイルのパス | `config/config.json` |
| `--project` | プロジェクト構成を検証 | `true` |
| `--fix` | 問題を自動修正 | `false` |

```bash
goryu validate --fix
```

### `version`

バージョン情報を表示します。

```bash
goryu version
```

## 例: API プロジェクトを構築する

```bash
# Initialize with the API template
goryu init my-api --template=api
cd my-api

# Generate resources
goryu g model user --type=db --fields="name:string,email:string"
goryu g handler user --type=api --model=User
goryu g route user --group=/api/v1 --middleware=auth,limiter

# Run and inspect
goryu dev --port=8080
goryu routes list
```
