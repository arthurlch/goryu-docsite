# Getting Started

## Quick Start

```bash
# Install
go get github.com/arthurlch/goryu

# CLI (Highly recommended)
go install github.com/arthurlch/goryu/cmd/goryu@latest

# Initialize a new project
goryu init myapp

# Start development server
cd myapp
goryu dev
```

## Real Example

```go
package main

import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/goryuctx"
    "github.com/arthurlch/goryu/middleware/logger"
    "github.com/arthurlch/goryu/middleware/cors"
)

type Product struct {
    ID    string  `json:"id"`
    Name  string  `json:"name" validate:"required"`
    Price float64 `json:"price" validate:"required,min=0"`
}

func main() {
    app := goryu.New()
    
    // Middleware
    app.Use(logger.New(), cors.Default())
    
    // Routes
    products := app.Group("/api/products")
    products.GET("/", listProducts)
    products.GET("/:id", getProduct)
    products.POST("/", createProduct)
    
    app.Listen(":8080")
}

func createProduct(c *goryuctx.Context) {
    var product Product
    if err := c.BodyParser(&product); err != nil {
        c.Status(400).JSON(goryuctx.Map{"error": err.Error()})
        return
    }
    
    // Validation happens automatically
    // Save product...
    
    c.Status(201).JSON(product)
}
```
