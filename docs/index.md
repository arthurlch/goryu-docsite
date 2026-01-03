---
layout: home

hero:
  name: "Goryu"
  text: "Production-Ready Go Web Framework"
  tagline: "Productivity of Rails with the speed of Go."
  image:
    src: https://i.ibb.co/YBfgFnG0/goryu-v3.png
    alt: Goryu Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/arthurlch/goryu

features:
  - title: Production Ready
    details: Health checks, metrics, structured logging, and graceful shutdown out of the box.
  - title: High Performance
    details: Built on a high-performance router, as fast as Gin but with 10x more features.
  - title: Developer Experience
    details: Smart context, real generators, and a powerful CLI to speed up development.
---

## Why Goryu?

Because setting up a production Go service takes too long. You need a router, validation, error handling, logging, health checks, metrics, graceful shutdown, and a good project structure. Goryu gives you all of this. No setup needed.

Basically, the Golang ecosystem is missing a framework that is like Rails with everything out of the Box. While the current Golang mentality is often about "building from scratch" and wiring libraries together, we believe there is a massive space for a framework that utilizes Golang's raw speed while providing the superior Developer Experience (DX) of Rails or Phoenix.

## Performance

```
BenchmarkGoryu_JSON-8         1,245,364 ops/sec    967.2 ns/op
BenchmarkGin_JSON-8           1,232,113 ops/sec    977.2 ns/op
BenchmarkGoryu_Param-8        2,036,600 ops/sec    593.3 ns/op
BenchmarkGin_Param-8          2,015,674 ops/sec    590.9 ns/op
```

As fast as Gin. With 10x more features built-in.

## Philosophy

1. **Batteries included**
   Everything you need to ship is already there. You don't need to hunt for an external logging library, choose a router, or figure out how to handle metrics. It works together from day one.

2. **No magic**
   You can read the source and understand it. Unlike other "heavy" frameworks that rely on complex meta-programming or runtime reflection that obscures logic, Goryu prefers explicit, readable Go code.

3. **Performance matters**
   Because blazingly fast performance is essential. Goryu is built on a high-performance Radix tree router and optimized middleware chains to ensure you don't trade speed for productivity.

4. **Developer happiness**
   Great DX is a feature. From the CLI that generates boilerplate for you, to the intuitive Context API that makes handling requests a joy—every tool is designed to make you smile while you code.
