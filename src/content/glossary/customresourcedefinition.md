---
title: CustomResourceDefinition
description: A way to extend Kubernetes by defining your own resource types
category: resource
---

A CustomResourceDefinition (CRD) lets you extend Kubernetes with your own **custom resource types**. Once you create a CRD, you can use kubectl to create, read, update, and delete instances of that resource just like built-in objects such as Pods or Deployments.

CRDs are the foundation of the **Operator pattern**. They allow tools like Prometheus, Cert-Manager, or Istio to define their own resources (like `Certificate` or `VirtualService`) that feel native to Kubernetes. The CRD defines the schema and validation rules, while a **controller** watches for changes and acts on them.

From a security perspective, be careful about which CRDs you install. They can introduce new **RBAC verbs** and resources, and a poorly written controller can have cluster-wide impact. Always review CRDs from third parties before applying them.
