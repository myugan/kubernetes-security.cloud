---
title: Label and Selector
description: Key-value pairs attached to Kubernetes objects and the queries used to filter them
category: resource
relatedTerms:
  - Pod
  - Service
  - Deployment
  - NetworkPolicy
---

A **label** is a key-value pair attached to a Kubernetes object such as a Pod, Node, or Service. Labels carry identifying metadata like `app: frontend`, `env: production`, or `tier: backend`. They have no meaning to Kubernetes itself and are entirely defined by the user.

A **selector** is a query that matches objects based on their labels. Controllers like Deployments and ReplicaSets use selectors to identify which Pods they manage. Services use selectors to determine which Pods should receive traffic. NetworkPolicies use them to specify which Pods a rule applies to.

There are two types of selectors. **Equality-based** selectors match on exact key-value pairs (`env=production`). **Set-based** selectors support more expressive queries such as `env in (staging, production)` or `tier notin (frontend)`. Most Kubernetes resources support both types, giving you flexible ways to group and target objects without changing the objects themselves.
