# security.txt

Goryu can serve a machine- and human-readable security disclosure policy per
[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116). `App.MountSecurityTxt` renders
a `SecurityTxt` and serves it at both `/.well-known/security.txt` and
`/security.txt`, telling researchers how to report vulnerabilities.

## Features

- **RFC 9116 compliant** — standard fields and formatting.
- **Two canonical paths** — served at `/.well-known/security.txt` and `/security.txt`.
- **Typed configuration** — build the policy from a `SecurityTxt` struct; empty fields are omitted.
- **Multiple contacts and encryption keys** — `Contact` and `Encryption` accept lists.

## Usage

Mount the policy once on your app:

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

This serves the following at `/.well-known/security.txt` and `/security.txt`:

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

A minimal policy only needs a contact:

```go
app.MountSecurityTxt(goryu.SecurityTxt{
    Contact: []string{"mailto:security@example.com"},
    Expires: time.Now().AddDate(1, 0, 0), // one year out
})
```

## Fields

| Field | Type | RFC 9116 field | Notes |
|-------|------|----------------|-------|
| Contact | `[]string` | `Contact` | How to report issues (email or URL). Rendered once per entry. |
| Expires | `time.Time` | `Expires` | When this policy should be considered stale. Rendered as RFC 3339 UTC. Omitted if zero. |
| Encryption | `[]string` | `Encryption` | URL(s) of encryption keys for secure reports. |
| Acknowledgments | `string` | `Acknowledgments` | Page recognizing reporters. |
| Policy | `string` | `Policy` | Link to your disclosure / bug-bounty policy. |
| Hiring | `string` | `Hiring` | Security-related job openings. |
| PreferredLanguages | `string` | `Preferred-Languages` | Comma-separated language tags (e.g. `en, fr`). |
| CanonicalURL | `string` | `Canonical` | The canonical URI where this file lives. |

Empty fields are omitted from the output.

::: tip Keep Expires current
RFC 9116 requires the `Expires` field and recommends a value less than a year out.
Set it and refresh it as part of your release process so the policy never appears
stale.
:::

::: warning Sign it for production
For a production deployment, RFC 9116 recommends serving a PGP-signed
`security.txt` and pointing `Canonical` / `Encryption` at real URLs. Provide an
`Encryption` key so researchers can send you sensitive details securely.
:::

## Next steps

- Round out your security posture with [Secure Headers](/ja/middleware/secure) and [TLS Redirect](/ja/middleware/tls_redirect).
- See the full [Security overview](/ja/security/) for the rest of the stack.
