---
title: etcd
description: The distributed key-value store that holds all Kubernetes cluster state
category: component
---

etcd is the **backing store** for all cluster data in Kubernetes. Every object you create (Pods, Secrets, ConfigMaps, RBAC rules) gets persisted here. It's a distributed **key-value store** that uses the **Raft consensus algorithm** to maintain consistency across multiple nodes.

Since etcd contains everything including Secrets (often base64-encoded, **not encrypted by default**), it's a high-value target. Securing it means enabling **encryption at rest**, restricting network access to only the API server, using **TLS** for client-server communication, and keeping regular backups. If an attacker gets direct access to etcd, they effectively own the cluster.
