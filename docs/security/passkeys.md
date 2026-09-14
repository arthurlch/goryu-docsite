# Passkeys / WebAuthn

`passkey` adds passwordless, phishing-resistant authentication to Goryu using
WebAuthn / passkeys. It exposes four begin/finish endpoints and leaves user lookup
and credential storage to your application through a `UserStore`.

::: tip Audited crypto, not hand-rolled
`passkey` is built on `github.com/go-webauthn/webauthn`. The library handles
CBOR/COSE decoding, attestation, assertion verification, and the sign counter —
Goryu does not reimplement any of it.
:::

## Features

- **Registration and login ceremonies** — `BeginRegistration` / `FinishRegistration` and `BeginLogin` / `FinishLogin`.
- **Pluggable storage** — implement `UserStore` to resolve the current user and persist credentials.
- **Clone detection** — the sign counter is verified on every login; `UpdateCredential` persists it.
- **Server-side ceremony state** — the per-ceremony challenge is stored server-side and referenced by a short-lived HttpOnly cookie.
- **Bring-your-own session** — `OnLogin` runs after a successful login so you can start a session or mint a token.

## Usage

### Wiring the endpoints

```go
import (
    "log"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/passkey"
)

func main() {
    app := goryu.New()

    pk, err := passkey.New(passkey.Config{
        RPID:          "example.com",
        RPDisplayName: "Example",
        RPOrigins:     []string{"https://example.com"},
        Users:         &myUserStore{},
        OnLogin: func(c *goryu.Ctx, user passkey.User) {
            c.Set("user_id", string(user.WebAuthnID()))
            _ = c.JSON(200, map[string]string{"status": "logged in"})
        },
    })
    if err != nil {
        log.Fatal(err)
    }

    app.POST("/webauthn/register/begin", pk.BeginRegistration)
    app.POST("/webauthn/register/finish", pk.FinishRegistration)
    app.POST("/webauthn/login/begin", pk.BeginLogin)
    app.POST("/webauthn/login/finish", pk.FinishLogin)

    log.Fatal(app.Listen(":8080"))
}
```

`BeginRegistration` / `BeginLogin` return the WebAuthn options as JSON for the
browser's `navigator.credentials` call. The finish endpoints read the browser's
response from the request body.

### Implementing a UserStore

`passkey.User` is `webauthn.User` and `passkey.Credential` is `webauthn.Credential`.
Your store resolves the ceremony's user and persists credentials:

```go
type UserStore interface {
    User(c *goryu.Ctx) (passkey.User, error)
    AddCredential(user passkey.User, cred *passkey.Credential) error
    UpdateCredential(user passkey.User, cred *passkey.Credential) error
}
```

A sketch backed by your database:

```go
type myUserStore struct {
    db *sql.DB
}

// User resolves who the ceremony is for — e.g. from a pre-auth cookie,
// a username in the request, or an existing session.
func (s *myUserStore) User(c *goryu.Ctx) (passkey.User, error) {
    username := c.Query("username")
    row, err := loadUser(s.db, username) // returns a type implementing webauthn.User
    if err != nil {
        return nil, err
    }
    return row, nil
}

// AddCredential stores a freshly-registered credential for the user.
func (s *myUserStore) AddCredential(user passkey.User, cred *passkey.Credential) error {
    return insertCredential(s.db, user.WebAuthnID(), cred)
}

// UpdateCredential persists the credential after a login — critically the sign
// counter, which must be stored to detect cloned authenticators.
func (s *myUserStore) UpdateCredential(user passkey.User, cred *passkey.Credential) error {
    return saveCredential(s.db, user.WebAuthnID(), cred)
}
```

Your user type must implement the `webauthn.User` interface (`WebAuthnID`,
`WebAuthnName`, `WebAuthnDisplayName`, `WebAuthnCredentials`, ...).

## Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| RPID | `string` | Relying Party ID (your domain, e.g. `example.com`) | — |
| RPDisplayName | `string` | Human-readable RP name shown by the authenticator | — |
| RPOrigins | `[]string` | Allowed origins (e.g. `https://example.com`) | — |
| Users | `UserStore` | Resolves users and persists credentials. Required. | — |
| Sessions | `SessionStore` | Per-ceremony challenge store | In-memory (process-local) |
| Insecure | `bool` | Allow the ceremony cookie over plain HTTP (dev only) | `false` |
| OnLogin | `func(c *goryu.Ctx, user User)` | Called after a successful login | `200` JSON `{"status":"ok"}` |

## Clone detection: persist the sign counter

WebAuthn authenticators maintain a monotonically increasing **sign counter**. On
each login the library compares the presented counter against the stored one — a
non-increasing counter signals a cloned authenticator.

::: warning UpdateCredential must persist the counter
`FinishLogin` calls `UpdateCredential` with the updated credential. If your
`UpdateCredential` does not persist the credential (specifically its sign counter),
clone detection is silently defeated. Always write it back to durable storage.
:::

## Multi-instance deployments

::: warning Default SessionStore is process-local
The per-ceremony challenge lives between the begin and finish steps. The default
`SessionStore` is an **in-memory, process-local** store keyed by a short-lived
cookie. If you run more than one instance (and requests aren't sticky), a login
begun on one instance can't be finished on another.

Provide your own `SessionStore` backed by Redis, a database, or another shared
store for multi-instance deployments:

```go
type SessionStore interface {
    Save(c *goryu.Ctx, data *webauthn.SessionData) error
    Load(c *goryu.Ctx) (*webauthn.SessionData, error)
    Clear(c *goryu.Ctx)
}
```

Implementations must be safe for concurrent use.
:::

::: warning
Set `Insecure: true` only in local development — it allows the ceremony cookie over
plain HTTP. WebAuthn itself requires a secure context (HTTPS or `localhost`) in the
browser regardless.
:::

## Next steps

- Turn a successful passkey login into an app session or token via [Sessions](/middleware/session) or [JWT Auth](/middleware/auth).
- Guard routes by role with [RBAC](/security/rbac).
