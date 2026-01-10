---
title: Ingress
description: Manages external HTTP/HTTPS access to services in the cluster
category: resource
---

An Ingress exposes **HTTP and HTTPS routes** from outside the cluster to Services inside. It lets you define rules for routing traffic based on **hostnames** or **URL paths**, so multiple services can share a single external IP.

Ingress itself is just a set of rules. You need an **Ingress controller** (like NGINX, Traefik, or cloud provider implementations) actually running in your cluster to make it work. The controller reads Ingress resources and configures the underlying load balancer or proxy accordingly. For **TLS termination**, you reference a Secret containing the certificate.
