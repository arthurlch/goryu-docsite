# Prompt Cache

`promptcache` is a response cache keyed on the **request body** (the "prompt")
rather than the URL, so it can cache `POST` responses — the common shape for LLM
endpoints where the same prompt should return the same answer. It adds an
`X-Cache: HIT|MISS` header and is safe around streaming.

```go
import "github.com/arthurlch/goryu/middleware/promptcache"
```

## Features

- **Body-keyed**: SHA-256 of method + path + optional vary headers + body.
- **POST-friendly**: caches the methods you choose (default `POST`).
- **Streaming-safe**: `text/event-stream` and `application/x-ndjson` responses
  are passed straight through and never cached.
- **Bounded**: entry-count cap with expiry-based eviction; a per-body size limit.
- **Correct by default**: never caches non-2xx, `Set-Cookie`, or responses
  marked `no-store` / `no-cache` / `private`.
- **Privacy guard**: with the default key, requests carrying `Authorization` or
  `Cookie` are not cached.

## Usage

### Basic setup

```go
import (
    "time"

    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/promptcache"
)

app.Use(promptcache.New(promptcache.Config{
    Expiration: 10 * time.Minute,
}))
```

`promptcache.Default()` uses a 5-minute expiration and caches `POST`.

### Cache only specific routes

Streaming routes must not be cached, so a common pattern is to wrap just the
non-streaming endpoints in a group.

```go
cached := app.Group("", promptcache.New(promptcache.Config{
    Expiration: 5 * time.Minute,
}))
cached.POST("/chat", chat)          // cached
app.POST("/chat/stream", chatStream) // not cached
```

Send the same body twice and watch the response header go `X-Cache: MISS` →
`X-Cache: HIT`.

### Vary on a model selector

Fold request headers into the key so `fast` and `smart` don't collide.

```go
app.Use(promptcache.New(promptcache.Config{
    VaryHeaders: []string{"X-Model"},
}))
```

::: warning Never put auth headers in VaryHeaders
`VaryHeaders` values become part of a shared cache key. Only use non-secret
selectors (model, locale, feature flags). To key on identity, use a
`KeyGenerator` instead — see the privacy section below.
:::

### Custom key derivation

A `KeyGenerator` lets you normalize the prompt before hashing, or fold in a
user/tenant id for per-user caching.

```go
app.Use(promptcache.New(promptcache.Config{
    KeyGenerator: func(c *goryu.Ctx, body []byte) string {
        return c.GetHeader("X-Tenant") + ":" + normalizePrompt(body)
    },
}))
```

## Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| Expiration | `time.Duration` | Freshness window | `5m` |
| MaxSize | `int` | Max cached entries (cannot exceed 100,000) | `1000` |
| MaxBodyBytes | `int64` | Max request/response bytes cached | `1 MiB` |
| Methods | `[]string` | Cacheable methods | `["POST"]` |
| VaryHeaders | `[]string` | Request headers folded into the key | none |
| KeyGenerator | `func(c, body) string` | Custom key derivation | body hash |

## Privacy

::: warning The default key does not know who the caller is
With the **default key** (method + path + vary headers + body), the same prompt
from any caller produces the same key. To prevent one authenticated user from
being served another user's cached response, requests carrying an
`Authorization` or `Cookie` header are **not cached at all** — they pass straight
through to the handler.

The moment you supply a `KeyGenerator`, this guard steps aside: you have taken
responsibility for the key, so you **must** fold the user/tenant identity into it
if the responses are user-specific. A `KeyGenerator` that ignores identity while
callers send `Authorization` will happily serve one user's answer to another.
:::

## Notes

- Responses larger than `MaxBodyBytes` are streamed to the client but not cached
  (they cannot be stored truncated). Likewise, request bodies larger than
  `MaxBodyBytes` are served in full to the handler but left un-keyed.
- The request body is read for keying and then restored, so the handler still
  reads it in full.
- Eviction is expiry-first: when full, expired entries are dropped before an
  arbitrary entry is evicted. It is not an LRU.
