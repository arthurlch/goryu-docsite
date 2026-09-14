# OAuth2 / OpenID Connect

`authoidc` is an OpenID Connect relying party for Goryu. It runs the
authorization-code flow with PKCE, verifies the ID token against the provider's
JWKS, and hands your app the verified claims. Use it to add "Sign in with Google /
Okta / Entra ID / Auth0" to your application.

::: tip Audited crypto, not hand-rolled
`authoidc` is built on `github.com/coreos/go-oidc` and `golang.org/x/oauth2` — the
same audited libraries the Go ecosystem relies on. They handle discovery, JWKS
rotation, and ID-token signature verification. `Start` and `Callback` bind and
verify **state** (CSRF), **nonce** (ID-token replay), and a **PKCE verifier**
(code interception) on every flow. None of this is reimplemented here.
:::

## Features

- **Authorization-code + PKCE** flow via `x/oauth2`.
- **ID-token verification** — signature, issuer, audience, and expiry checked against the provider JWKS by `go-oidc`.
- **CSRF / replay protection** — `state` and `nonce` are bound into short-lived, HttpOnly, `SameSite=Lax` cookies and verified on callback.
- **Verified claims** — `Subject`, `Email`, `EmailVerified`, `Name` handed to your `OnSuccess` callback.
- **Bring-your-own session** — `OnSuccess` lets you mint a JWT, create a session, or redirect however you like.

## Usage

### Basic setup

```go
import (
    "log"
    "os"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/authoidc"
)

func main() {
    app := goryu.New()

    rp, err := authoidc.New(authoidc.Config{
        Issuer:       "https://accounts.google.com",
        ClientID:     os.Getenv("OIDC_CLIENT_ID"),
        ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
        RedirectURL:  "https://app.example.com/auth/callback",
    })
    if err != nil {
        log.Fatal(err)
    }

    app.GET("/auth/login", rp.Start)
    app.GET("/auth/callback", rp.Callback)

    log.Fatal(app.Listen(":8080"))
}
```

`Start` redirects the user to the provider. `Callback` validates the response,
verifies the ID token, and — by default — sets the `user_id` context key to the
subject and returns the claims as JSON.

### Handling success yourself

Supply `OnSuccess` to create your own session or issue your own token. The verified
claims and the raw OAuth2 token are passed in:

```go
import "golang.org/x/oauth2"

rp, err := authoidc.New(authoidc.Config{
    Issuer:       "https://accounts.google.com",
    ClientID:     os.Getenv("OIDC_CLIENT_ID"),
    ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
    RedirectURL:  "https://app.example.com/auth/callback",
    OnSuccess: func(c *goryu.Ctx, claims authoidc.Claims, token *oauth2.Token) {
        if !claims.EmailVerified {
            _ = c.JSON(403, map[string]string{"error": "email not verified"})
            return
        }
        // Look up or create the local user, then start a session / mint a JWT.
        userID := upsertUser(claims.Subject, claims.Email, claims.Name)
        c.Set("user_id", userID)
        _ = c.Redirect(302, "/dashboard")
    },
    OnError: func(c *goryu.Ctx, err error) {
        _ = c.Redirect(302, "/login?error=oidc")
    },
})
```

### Custom scopes

By default the relying party requests `openid`, `email`, and `profile`. Override
`Scopes` to request more (or fewer):

```go
rp, _ := authoidc.New(authoidc.Config{
    Issuer:      "https://login.microsoftonline.com/<tenant>/v2.0",
    ClientID:    os.Getenv("OIDC_CLIENT_ID"),
    ClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
    RedirectURL: "https://app.example.com/auth/callback",
    Scopes:      []string{"openid", "email", "profile", "offline_access"},
})
```

## Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| Issuer | `string` | OIDC issuer URL (used for discovery). Required. | — |
| ClientID | `string` | OAuth2 client ID. Required. | — |
| ClientSecret | `string` | OAuth2 client secret. | — |
| RedirectURL | `string` | Your registered callback URL. Required. | — |
| Scopes | `[]string` | Requested scopes | `["openid", "email", "profile"]` |
| CookiePrefix | `string` | Namespaces the flow cookies | `"oidc"` |
| Insecure | `bool` | Allow flow cookies over plain HTTP (dev only) | `false` |
| OnSuccess | `func(c *goryu.Ctx, claims Claims, token *oauth2.Token)` | Called with verified claims | Sets `user_id`, returns claims JSON |
| OnError | `func(c *goryu.Ctx, err error)` | Called on any failure | `401` JSON error |

### Claims

```go
type Claims struct {
    Subject       string // "sub"
    Email         string
    EmailVerified bool
    Name          string
}
```

## How the flow is secured

1. **`Start`** generates a random `state`, `nonce`, and PKCE `verifier`, binds each
   into a short-lived HttpOnly `SameSite=Lax` cookie, and redirects to the provider
   with the `state`, `nonce`, and S256 code challenge.
2. **`Callback`** verifies the returned `state` matches the cookie (CSRF), exchanges
   the code using the PKCE `verifier` (code interception defense), verifies the ID
   token's signature/issuer/audience/expiry against the provider JWKS, and checks
   the ID token's `nonce` matches the cookie (replay defense).
3. Only after all checks pass are the claims decoded and handed to `OnSuccess`.

::: warning
Set `Insecure: true` only in local development. It allows the flow cookies to be
sent over plain HTTP, which exposes `state` / `nonce` / PKCE to network attackers.
In production always serve over HTTPS and leave `Insecure` unset.
:::

## Next steps

- Turn the OIDC identity into an app session or token via [JWT Auth](/middleware/auth) or [Sessions](/middleware/session).
- Guard routes by role with [RBAC](/security/rbac).
- Keep a record of logins with the [Audit Log](/security/audit-log).
