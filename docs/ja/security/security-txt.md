# security.txt

Goryu は、[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) に準拠した、機械可読かつ
人間可読なセキュリティ開示ポリシーを配信できます。`App.MountSecurityTxt` は `SecurityTxt`
をレンダリングし、それを `/.well-known/security.txt` と `/security.txt` の両方で配信して、
脆弱性の報告方法を研究者に伝えます。

## 特徴

- **RFC 9116 準拠** — 標準的なフィールドと書式。
- **2 つの正規パス** — `/.well-known/security.txt` と `/security.txt` で配信。
- **型付きの設定** — `SecurityTxt` 構造体からポリシーを構築します。空のフィールドは省略されます。
- **複数の連絡先と暗号鍵** — `Contact` と `Encryption` はリストを受け付けます。

## 使い方

ポリシーをアプリに一度マウントします。

```go
import (
    "time"

    "github.com/arthurlch/goryu"
)

func main() {
    app := goryu.New()

    app.MountSecurityTxt(goryu.SecurityTxt{
        Contact: []string{
            "mailto:security@example.com",
            "https://example.com/security/report",
        },
        Expires:            time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC),
        Encryption:         []string{"https://example.com/pgp-key.txt"},
        Acknowledgments:    "https://example.com/security/thanks",
        Policy:             "https://example.com/security/policy",
        Hiring:             "https://example.com/jobs",
        PreferredLanguages: "en, fr",
        CanonicalURL:       "https://example.com/.well-known/security.txt",
    })

    log.Fatal(app.Listen(":8080"))
}
```

これにより、`/.well-known/security.txt` と `/security.txt` で次の内容が配信されます。

```
Contact: mailto:security@example.com
Contact: https://example.com/security/report
Expires: 2027-01-01T00:00:00Z
Encryption: https://example.com/pgp-key.txt
Acknowledgments: https://example.com/security/thanks
Policy: https://example.com/security/policy
Hiring: https://example.com/jobs
Preferred-Languages: en, fr
Canonical: https://example.com/.well-known/security.txt
```

最小限のポリシーに必要なのは連絡先だけです。

```go
app.MountSecurityTxt(goryu.SecurityTxt{
    Contact: []string{"mailto:security@example.com"},
    Expires: time.Now().AddDate(1, 0, 0), // one year out
})
```

## フィールド

| フィールド | 型 | RFC 9116 フィールド | 備考 |
|-------|------|----------------|-------|
| Contact | `[]string` | `Contact` | 問題の報告方法（メールまたは URL）。エントリごとに 1 行ずつレンダリングされます。 |
| Expires | `time.Time` | `Expires` | このポリシーが古いとみなされるべき時点。RFC 3339 の UTC としてレンダリングされます。ゼロ値の場合は省略されます。 |
| Encryption | `[]string` | `Encryption` | 安全な報告用の暗号鍵の URL。 |
| Acknowledgments | `string` | `Acknowledgments` | 報告者を称えるページ。 |
| Policy | `string` | `Policy` | 開示 / バグバウンティポリシーへのリンク。 |
| Hiring | `string` | `Hiring` | セキュリティ関連の求人。 |
| PreferredLanguages | `string` | `Preferred-Languages` | カンマ区切りの言語タグ（例: `en, fr`）。 |
| CanonicalURL | `string` | `Canonical` | このファイルが置かれている正規 URI。 |

空のフィールドは出力から省略されます。

::: tip Expires を最新に保つ
RFC 9116 は `Expires` フィールドを必須とし、1 年未満の値を推奨しています。これを設定し、
リリースプロセスの一環として更新することで、ポリシーが古く見えることを防ぎましょう。
:::

::: warning 本番環境では署名する
本番環境へのデプロイでは、RFC 9116 は PGP 署名された `security.txt` を配信し、`Canonical` /
`Encryption` を実際の URL に向けることを推奨しています。研究者が機微な詳細を安全に送れるよう、
`Encryption` の鍵を提供してください。
:::

## 次のステップ

- [セキュアヘッダー](/ja/middleware/secure) と [TLS リダイレクト](/ja/middleware/tls_redirect) でセキュリティ体制を整えましょう。
- スタックの残りについては、[セキュリティ概要](/ja/security/) をご覧ください。
