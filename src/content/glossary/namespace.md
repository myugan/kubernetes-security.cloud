---
title: Namespace
description: A virtual cluster within Kubernetes used to isolate and organize resources
category: resource
relatedTerms:
  - RBAC
  - NetworkPolicy
  - ServiceAccount
---

A Namespace is a way to divide a single Kubernetes cluster into **logical groups**. Resources like Pods, Services, and ConfigMaps live inside a namespace, and names only need to be unique within one. This makes it easier to organize workloads by team, environment, or application without running separate clusters.

Kubernetes ships with a few built-in namespaces. **default** is where resources land if you don't specify one. **kube-system** is reserved for cluster components like the API server and scheduler. **kube-public** holds publicly readable data, and **kube-node-lease** is used for node heartbeats.

Most resource types are namespace-scoped, meaning they exist within a namespace and are invisible from outside it. A few types like Nodes and ClusterRoles are **cluster-scoped** and exist globally across all namespaces.
