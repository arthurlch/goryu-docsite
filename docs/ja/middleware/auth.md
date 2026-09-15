---
title: 認証ミドルウェア
description: 本番運用に耐える JWT 認証サービス
---

# 🔐 認証ミドルウェア

Goryu アプリケーション向けの、包括的で本番運用に耐える認証サービスです。このパッケージは、ユーザー管理、JWT ベースの認証、セキュリティのベストプラクティスに対する完全なソリューションを提供します。

## ✨ 特徴

- **JWT 認証**: 安全なアクセストークンとリフレッシュトークンの管理。
- **ユーザー管理**: 登録、ログイン、プロフィール更新、アカウント削除。
- **パスワードのセキュリティ**: 強力なパスワードの強制（Bcrypt）と安全なハッシュ化。
- **メール確認**: トークンベースのメール確認フロー。
- **パスワードリセット**: 安全なパスワードリセットのワークフロー。
- **🛡️ セキュリティ第一**:
    - **レート制限**: IP およびメールによる、ブルートフォース攻撃に対する組み込みの保護。
    - **監査ロギング**: 詳細なセキュリティイベントのロギング（ログイン失敗、パスワード変更）。
    - **セキュア Cookie**: HttpOnly、Secure、SameSite=Strict の Cookie 管理。
    - **CSRF 保護**: 統合可能。

---

## 🚀 クイックスタート

### 1. インストール

```bash
go get github.com/arthurlch/goryu/middleware/auth
```

### 2. 実装

このミドルウェアを使うには、3 つのインターフェース `UserStore`、`TokenStore`、`EmailSender` を実装する必要があります。

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/auth"
)

func main() {
    app := goryu.New()

    // 1. Setup Dependencies
    // (See "Implementing Stores" section below for full code)
    jwtAuth, _  := auth.NewJWTAuth("your-secret-key-32-chars", "my-app")
    userStore   := NewInMemoryUserStore()
    tokenStore  := NewInMemoryTokenStore()
    emailSender := NewMockEmailSender()

    // 2. Configure Service
    config := auth.DefaultAuthServiceConfig()
    config.AppName = "My Super App"
    config.RequireEmailVerification = true 

    // 3. Initialize Service & Handlers
    authService := auth.NewAuthService(jwtAuth, userStore, tokenStore, emailSender, config)
    authService.SetLogger(auth.NewSimpleLogger()) // Optional: Custom logger
    
    handlers := auth.NewAuthHandlers(authService)

    // 4. Register Routes
    handlers.RegisterRoutes(app)

    app.Listen(":8080")
}
```

---

## ⚙️ 設定

`AuthServiceConfig` 構造体により、セキュリティポリシーを細かく制御できます。

```go
type AuthServiceConfig struct {
    AppNameStr              string
    RequireEmailVerification bool          // Must verify email before login
    PasswordConfig          SecurePasswordConfig
    SessionDuration         time.Duration  // Access Token TTL (e.g. 15m)
    RefreshTokenDuration    time.Duration  // Refresh Token TTL (e.g. 7 days)
    
    // Security Policies
    EnableRateLimit         bool
    MaxLoginAttempts        int            // e.g. 5 attempts
    RateLimitWindow         time.Duration  // e.g. 15 minutes
    RateLimitBlockDuration  time.Duration  // e.g. 30 minutes block
    
    // Cookie Config
    SecureCookies           bool           // Enforce HTTPS
    CookieDomain            string
    CookiePath              string
    CSRFProtection          bool
}
```

---

## 📡 API リファレンス

`RegisterRoutes` メソッドは、完全な認証 API をセットアップします。

### 公開エンドポイント

| メソッド | パス | 説明 | リクエストボディ |
|--------|------|-------------|--------------|
| `POST` | `/auth/register` | アカウント作成 | `{ "email": "...", "password": "...", "first_name": "..." }` |
| `POST` | `/auth/login` | ログイン | `{ "email": "...", "password": "...", "remember_me": true }` |
| `POST` | `/auth/forgot-password` | リセットの要求 | `{ "email": "..." }` |
| `GET` | `/auth/verify-email` | メールの確認 | クエリ: `?token=...` |

### 保護されたエンドポイント（認証が必要）

| メソッド | パス | 説明 | 備考 |
|--------|------|-------------|------|
| `POST` | `/auth/logout` | ログアウト | Cookie をクリア／リフレッシュトークンを無効化 |
| `POST` | `/auth/refresh` | トークンの更新 | `refresh_token` Cookie またはボディを使用 |
| `GET` | `/auth/profile` | ユーザー情報の取得 | ユーザー ID、メール、traits を返す |
| `POST` | `/auth/change-password` | パスワードの更新 | `{ "current_password": "...", "new_password": "..." }` |

---

## 🛠️ ストアの実装

Goryu をあなたのデータベース（Postgres、MongoDB、Redis など）に接続するには、これらのインターフェースを実装する必要があります。

### 1. UserStore

ユーザーの永続化を管理します。

```go
type UserStore interface {
    AddUser(email, password string, traits map[string]interface{}) (*User, error)
    GetUserByEmail(email string) (*User, bool)
    GetUserByID(id string) (*User, bool)
    UpdatePassword(email, newPassword string) error
    VerifyUserEmail(email string) error
    UpdateUserTraits(id string, traits map[string]interface{}) error
    DeleteUser(id string) error
}
```

### 2. TokenStore

トークンの許可リスト／ブロックリストを管理します（通常は Redis）。

```go
type TokenStore interface {
    AddToken(jti string) error
    UseToken(jti string) bool // Returns true if token was unused and is now marked used
    IsTokenUsed(jti string) bool
}
```

### 3. EmailSender

トランザクションメールを送信します。

```go
type EmailSender interface {
    SendVerificationEmail(email, token, verifyURL string) error
    SendPasswordResetEmail(email, token, resetURL string) error
    SendSecurityAlert(email, message string) error
}
```

---

## 🔒 レート制限の戦略

このミドルウェアは、不正利用を防ぐために二層のレートリミッターを実装しています。

1.  **IP ベース**: 単一の IP アドレスからのログイン試行の総数を制限します。
2.  **メールベース**: 特定のメールアカウントに対する失敗試行を制限します（標的型のブルートフォースを防ぎます）。

::: tip
制限を超えると、ユーザーは `Retry-After` ヘッダーを伴う 429 Too Many Requests レスポンスを受け取ります。
:::

---

## 💻 実行可能な完全なサンプル

<details>
<summary>クリックして <code>example.go</code> を表示</summary>

```go
package main

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/arthurlch/goryu"
	"github.com/arthurlch/goryu/middleware/auth"
)

func main() {
	ExampleUsage()
}

func SetupAuthMiddleware(app *goryu.App, secretKey string) (*auth.AuthService, *auth.AuthHandlers) {
	jwtAuth, err := auth.NewJWTAuth(secretKey, "goryu-app")
	if err != nil {
		panic("Failed to create JWT Auth: " + err.Error())
	}
	
    // These implementations are included in the package for rapid prototyping
	userStore := auth.NewInMemoryUserStore()
	tokenStore := auth.NewInMemoryTokenStore()
	emailSender := auth.NewMockEmailSender()
	
	config := auth.DefaultAuthServiceConfig()
	
	authService := auth.NewAuthService(jwtAuth, userStore, tokenStore, emailSender, config)
	logger := auth.NewSimpleLogger()
	authService.SetLogger(logger)
	
	authHandlers := auth.NewAuthHandlers(authService)
	authHandlers.RegisterRoutes(app)
	return authService, authHandlers
}

func ExampleUsage() {
	app := goryu.New()
	secretKey := generateSecureKey()
	
	authService, _ := SetupAuthMiddleware(app, secretKey)
	defer authService.Cleanup()
	
	app.GET("/protected", func(c *goryu.Ctx) {
		userID, _ := c.Get(auth.UserIDKey)
		c.JSON(200, map[string]interface{}{
			"message": "This is a protected route",
			"user_id": userID,
		})
	})
	
	adminGroup := app.Group("/admin")
	adminGroup.GET("/users", func(c *goryu.Ctx) {
		userID, exists := c.Get(auth.UserIDKey)
		if !exists || userID == nil {
			c.JSON(401, map[string]string{"error": "Authentication required"})
			return
		}
		c.JSON(200, map[string]string{"message": "Admin users endpoint"})
	})
	
	app.Listen(":8080")
}

func generateSecureKey() string {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		panic("Failed to generate secure key: " + err.Error())
	}
	return hex.EncodeToString(key)
}
```
</details>

<details>
<summary>クリックして <code>example_implementations.go</code>（モックのヘルパー）を表示</summary>

```go
package auth

import (
	"fmt"
	"log"
)

type MockEmailSender struct {
	SentEmails []EmailRecord
}
type EmailRecord struct {
	To      string
	Subject string
	Content string
	Type    string
}

func NewMockEmailSender() *MockEmailSender {
	return &MockEmailSender{
		SentEmails: make([]EmailRecord, 0),
	}
}
func (m *MockEmailSender) SendVerificationEmail(email, token, verifyURL string) error {
	m.SentEmails = append(m.SentEmails, EmailRecord{
		To:      email,
		Subject: "Verify Your Email Address",
		Content: fmt.Sprintf("Please verify your email by clicking: %s", verifyURL),
		Type:    "verification",
	})
	log.Printf("MOCK EMAIL: Verification email sent to %s with URL: %s", email, verifyURL)
	return nil
}
func (m *MockEmailSender) SendPasswordResetEmail(email, token, resetURL string) error {
	m.SentEmails = append(m.SentEmails, EmailRecord{
		To:      email,
		Subject: "Reset Your Password",
		Content: fmt.Sprintf("Reset your password by clicking: %s", resetURL),
		Type:    "password_reset",
	})
	log.Printf("MOCK EMAIL: Password reset email sent to %s with URL: %s", email, resetURL)
	return nil
}
func (m *MockEmailSender) SendSecurityAlert(email, message string) error {
	m.SentEmails = append(m.SentEmails, EmailRecord{
		To:      email,
		Subject: "Security Alert",
		Content: message,
		Type:    "security_alert",
	})
	log.Printf("MOCK EMAIL: Security alert sent to %s: %s", email, message)
	return nil
}
func (m *MockEmailSender) GetSentEmails() []EmailRecord {
	return m.SentEmails
}
func (m *MockEmailSender) ClearSentEmails() {
	m.SentEmails = make([]EmailRecord, 0)
}

type SimpleLogger struct {
	EnableSecurityLog bool
	EnableErrorLog    bool
	EnableInfoLog     bool
}

func NewSimpleLogger() *SimpleLogger {
	return &SimpleLogger{
		EnableSecurityLog: true,
		EnableErrorLog:    true,
		EnableInfoLog:     true,
	}
}
func (l *SimpleLogger) LogSecurityEvent(event string, details map[string]interface{}) {
	if !l.EnableSecurityLog {
		return
	}
	log.Printf("SECURITY EVENT: %s - Details: %+v", event, details)
}
func (l *SimpleLogger) LogError(message string, err error) {
	if !l.EnableErrorLog {
		return
	}
	log.Printf("ERROR: %s - %v", message, err)
}
func (l *SimpleLogger) LogInfo(message string, details map[string]interface{}) {
	if !l.EnableInfoLog {
		return
	}
	log.Printf("INFO: %s - Details: %+v", message, details)
}
```
</details>
