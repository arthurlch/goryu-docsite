# MCP サーバー

`goryu mcp` は、Goryu のプロジェクトツールを AI エージェントに公開する
[Model Context Protocol](https://modelcontextprotocol.io) サーバーを実行します。
stdio 上で JSON-RPC 2.0 を話すため、MCP 対応のクライアント（Claude Code、
IDE エージェント、あるいは独自のハーネス）であれば、プロジェクトディレクトリ内から
ルートの一覧表示、ハンドラーのスキャフォールド、開発サーバーの起動が行えます。

```bash
goryu mcp
```

このプロセスは stdin から 1 行につき 1 つの JSON-RPC リクエストを読み取り、
stdout に 1 行につき 1 つのレスポンスを書き出します。stdin が閉じる（EOF）まで
実行され続けます。

## 機能

- **標準トランスポート**: stdio 上の JSON-RPC 2.0、プロトコルバージョン
  `2024-11-05` — あらゆる MCP クライアントで動作します。
- **プロジェクト対応**: ツールはカレントワーキングディレクトリ（あなたの Goryu
  プロジェクト）を対象に動作します。
- **3 つのツール**: `list_routes`、`scaffold_handler`、`run_dev_server`。
- **安全なスキャフォールド**: 出力パスは相対パスでなければならず、プロジェクトの
  外に出ることはできません（`..` や絶対パスは拒否されます）。

## ツール

| ツール | 引数 | 説明 |
|------|-----------|-------------|
| `list_routes` | — | 現在のプロジェクトで検出された HTTP ルートを一覧表示します。 |
| `scaffold_handler` | `name`（必須）、`type`、`kind`、`path` | ハンドラーを生成します。`type` ∈ `basic\|crud\|api\|ai`。`ai` の場合、`kind` ∈ `chat\|rag\|agent`。 |
| `run_dev_server` | `port` | バックグラウンドで開発サーバーを起動し、その PID とログファイルを返します。 |

`scaffold_handler` のデフォルト: `type=ai`、`kind=chat`、`path=internal/handlers`。
`run_dev_server` のデフォルトは `port=3000` で、ホットリロードを無効にして起動し、
出力を `goryu-dev.log` に書き出します。

## 使い方

### MCP クライアントを向ける

クライアントを設定し、ワーキングディレクトリをプロジェクトに設定した状態で
`goryu mcp` を起動させます。**Claude Code** の場合は、MCP 設定に追加します。

```json
{
  "mcpServers": {
    "goryu": {
      "command": "goryu",
      "args": ["mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

あるいは Claude Code CLI で登録します。

```bash
claude mcp add goryu -- goryu mcp
```

ほとんどの IDE エージェントは同じ `command` / `args` / `cwd` の形を使います。
重要なのは、`goryu mcp` を**プロジェクトディレクトリ内**で実行しなければならない
という点です。ツールはカレントワーキングディレクトリを基準にルートを検出し、
ハンドラーを書き込みます。

::: tip `goryu` を利用可能にする
CLI をインストールして `PATH` に通します: `go install github.com/arthurlch/goryu/cmd/goryu@latest`。
`PATH` に通っていない場合は、バイナリの絶対パスを `command` として使用してください。
:::

### 手動で試す

プロトコルは行指向なので、`echo` とパイプで操作できます。`initialize` を送信し、
続いてツールを呼び出します。

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | goryu mcp
```

## JSON-RPC の例

### initialize

リクエスト:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {} }
```

レスポンス:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "goryu", "version": "0.1.0" }
  }
}
```

### tools/list

リクエスト:

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

レスポンス（抜粋）:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "list_routes",
        "description": "List the HTTP routes discovered in the current goryu project.",
        "inputSchema": { "type": "object", "properties": {} }
      },
      {
        "name": "scaffold_handler",
        "description": "Generate a handler in the current project. Supports type=ai with kind=chat|rag|agent.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "type": { "type": "string", "enum": ["basic", "crud", "api", "ai"] },
            "kind": { "type": "string", "enum": ["chat", "rag", "agent"] },
            "path": { "type": "string" }
          },
          "required": ["name"]
        }
      },
      {
        "name": "run_dev_server",
        "description": "Start the project's dev server in the background; returns its PID and log file.",
        "inputSchema": {
          "type": "object",
          "properties": { "port": { "type": "string" } }
        }
      }
    ]
  }
}
```

### tools/call

ストリーミングチャットハンドラーをスキャフォールドします。

リクエスト:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "scaffold_handler",
    "arguments": { "name": "support", "type": "ai", "kind": "chat" }
  }
}
```

レスポンス:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      { "type": "text", "text": "🚀 Generating ai handler: support\n✅ Handler created: internal/handlers/support.go\n..." }
    ],
    "isError": false
  }
}
```

ツールの結果は MCP の形に従います。`{type, text}` ブロックの `content` 配列と
`isError` フラグです。ツールが失敗した場合（例えば `name` の欠落や、`..` を
含む `path`）、その失敗は JSON-RPC エラーではなく、`"isError": true` を持つ
ツール結果として報告されます。

## 注意点

- **通知**（`id` を持たないリクエスト、例えば `notifications/initialized`）は
  処理されますが、JSON-RPC の仕様どおりレスポンスは生成されません。
- **未知のメソッド**はコード `-32601` の JSON-RPC エラーを返します。未知の
  ツールや不正なパラメーターは `-32602` を返します。
- `ping` はサポートされており、空の結果を返します。
- 人間向けのジェネレーター出力は内部でキャプチャされるため、stdout 上の
  JSON-RPC ストリームを汚すことはありません。

::: warning サーバー 1 つにつきプロジェクト 1 つ
ツールはカレントワーキングディレクトリを対象に動作します。プロジェクトごとに
別々の `goryu mcp` プロセスを、それぞれ適切な `cwd` で起動してください。
:::

## 関連項目

- [AI スキャフォールド](/ja/ai/scaffolds) — `scaffold_handler` が各 `kind` に対して
  生成する内容。
- [llms.txt & API リファレンス](/ja/ai/llms-txt) — 同じエージェントが実行時に
  読み取れる機械可読なルートインデックスを公開します。
