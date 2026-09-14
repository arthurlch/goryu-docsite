# Security

Goryu is secure by default. The framework ships a full authentication and
authorization stack — JWT tokens, server-side sessions, OAuth2/OIDC, passkeys,
role checks, and an audit trail — built on audited libraries rather than
hand-rolled crypto. This page maps the pieces and helps you choose the right ones.

## Features

- **JWT auth** — stateless access / refresh tokens with password-change revocation. See [JWT Auth](/middleware/auth).
- **Server-side sessions** — encrypted cookies, idle timeout, fingerprinting, and session hijacking detection. See [Sessions](/middleware/session).
- **OAuth2 / OIDC** — an OpenID Connect relying party (authorization-code + PKCE) built on `coreos/go-oidc` and `x/oauth2`. See [OAuth2 / OIDC](/security/oidc).
- **Passkeys / WebAuthn** — passwordless auth with clone detection, built on `go-webauthn`. See [Passkeys](/security/passkeys).
- **RBAC** — per-route role checks (`Require` / `RequireAll`). See [RBAC](/security/rbac).
- **Audit log** — an access-audit trail (who, what, when, outcome) written to a pluggable sink. See [Audit Log](/security/audit-log).
- **security.txt** — RFC 9116 disclosure policy served at `/.well-known/security.txt`. See [security.txt](/security/security-txt).
- **CORS** — cross-origin request policy. See [CORS](/middleware/cors).
- **CSRF** — cross-site request forgery protection. See [CSRF](/middleware/csrf).
- **Secure headers** — HSTS, `X-Frame-Options`, `X-Content-Type-Options`, and friends. See [Secure Headers](/middleware/secure).
- **Secure cookies** — signed / encrypted cookie helpers. See [Secure Cookie](/middleware/secure_cookie).
- **TLS redirect** and **trust proxy** — HTTPS enforcement and correct client IPs behind proxies. See [TLS Redirect](/middleware/tls_redirect) and [Trust Proxy](/middleware/trustproxy).

## The unified JWT ↔ session invalidation seam

JWT auth and server-side sessions are independent mechanisms, but Goryu wires them
to a **shared invalidation point**: a password change or reset invalidates **both**.

The auth service records when a user's password last changed
(`AuthService.PasswordChangedAt(userID)`). JWT validation already rejects any token
issued before that instant. To extend the same guarantee to sessions, use the
integration middleware instead of the plain session middleware:

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/session"
)

func main() {
    app := goryu.New()

    // Wires an encrypted session store, JWT auth, and the shared-invalidation
    // session middleware in one call.
    authService, integration := session.CreateIntegratedAuthSetup(
        app,
        jwtSecret,   // signs JWTs
        sessionKey,  // encrypts session cookies
    )

    _ = authService
    _ = integration
}
```

The key is `AuthIntegration.SessionAuthMiddleware()`. Unlike the standalone
`session.SessionAuthMiddleware`, it consults `PasswordChangedAt` and rejects any
session whose `login_time` predates the last password change:

```go
// Shared invalidation: rejects sessions created before the last password change.
app.Use(integration.SessionAuthMiddleware())

// Identity only: does NOT consult password-change revocation.
app.Use(session.SessionAuthMiddleware(sessionConfig))
```

::: warning Mixing mechanisms
If you layer JWT and sessions on the same routes, use
`AuthIntegration.SessionAuthMiddleware()`. The plain
`session.SessionAuthMiddleware` establishes identity only — a "log out everywhere"
password reset will invalidate JWTs but leave those sessions valid.
:::

::: tip
`AuthIntegration.SessionAuthMiddleware()` also enforces a 30-minute idle timeout
and (when the store has fingerprinting enabled) session-hijacking detection.
:::

## Which auth should I use?

| Scenario | Recommended mechanism |
|----------|-----------------------|
| Public API / mobile / SPA consuming an API | [JWT Auth](/middleware/auth) — stateless, no server state |
| Classic server-rendered web app | [Sessions](/middleware/session) — encrypted cookie, easy invalidation |
| "Sign in with Google / Okta / Entra ID" | [OAuth2 / OIDC](/security/oidc) — delegate identity to a provider |
| Passwordless / phishing-resistant login | [Passkeys](/security/passkeys) — WebAuthn credentials |
| Need both API tokens and web sessions | Sessions via `AuthIntegration.SessionAuthMiddleware()` so invalidation is shared |

Whatever you choose, layer **authorization** with [RBAC](/security/rbac) and keep
an [audit trail](/security/audit-log). Prefer a single primary mechanism per route
group; if you must mix, wire invalidation on both sides as shown above.

::: tip One identity key
All of these mechanisms converge on the `user_id` context key. RBAC role loading,
the audit log's `UserIDFunc`, and OIDC's `OnSuccess` all read or write it, so the
pieces compose without extra glue.
:::
