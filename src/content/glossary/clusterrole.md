---
title: ClusterRole
description: A cluster-scoped RBAC object that defines permissions across all namespaces or for non-namespaced resources
category: resource
relatedTerms:
  - ClusterRoleBinding
  - Role
  - RBAC
  - Node
---

A ClusterRole defines permissions that apply **cluster-wide** rather than within a single namespace. It can grant access to namespaced resources across all namespaces, to cluster-scoped resources like Nodes and PersistentVolumes, and to non-resource endpoints like `/healthz` and `/metrics`.

ClusterRoles are commonly used for components that need cluster-wide visibility, such as monitoring agents, admission controllers, and GitOps controllers. Kubernetes itself ships with several built-in ClusterRoles like `view`, `edit`, and `cluster-admin` that cover common permission levels.

Like a Role, a ClusterRole does nothing on its own. It must be bound to subjects through a **ClusterRoleBinding** for cluster-wide effect, or through a **RoleBinding** to limit its effect to a single namespace.
