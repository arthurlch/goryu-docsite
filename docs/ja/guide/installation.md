# インストール

Goryu を始めるのは簡単です。標準の Go ツールを使って、フレームワークと CLI ツールをインストールできます。

## 前提条件

- **Go 1.21+**: Goryu には比較的新しいバージョンの Go が必要です。[Go をダウンロード](https://go.dev/dl/)。

## フレームワークのインストール

既存のプロジェクトに Goryu フレームワークを追加するには、次のようにします。

```bash
go get github.com/arthurlch/goryu
```

## CLI のインストール

Goryu CLI（`goryu`）は、プロジェクトを作成・管理するための推奨される方法です。

```bash
go install github.com/arthurlch/goryu/cmd/goryu@latest
```

インストールを確認します。

```bash
goryu version
```

## Makefile を使う

Goryu のプロジェクトには、よくあるタスクを簡略化するための `Makefile` が付属していることが多くあります。

### よく使うコマンド

```bash
# Run the application in development mode
make dev

# Build the binary
make build

# Run tests
make test

# clean build artifacts
make clean
```

> [!TIP]
> `Makefile` の内容を確認すれば、利用可能なすべてのコマンドを確認できます。

## 次のステップ

- [チュートリアル](/ja/guide/tutorial) に従って、最初のアプリを構築しましょう。
- すべてのコマンドについては [CLI リファレンス](/ja/cli) をご覧ください。
