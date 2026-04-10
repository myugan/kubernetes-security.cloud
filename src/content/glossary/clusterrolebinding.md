---
title: ClusterRoleBinding
description: A cluster-scoped RBAC object that grants the permissions defined in a ClusterRole across the entire cluster
category: resource
relatedTerms:
  - ClusterRole
  - RoleBinding
  - ServiceAccount
---

A ClusterRoleBinding **attaches a ClusterRole to one or more subjects** and grants those permissions across the entire cluster. Subjects can be users, groups, or ServiceAccounts. Unlike a RoleBinding, a ClusterRoleBinding is not scoped to a namespace and its effects are global.

ClusterRoleBindings can only reference a **ClusterRole**, not a namespace-scoped Role. They are typically used for cluster-wide components like the scheduler, controller manager, and operators that need to read or manage resources across all namespaces.

Like RoleBindings, the `roleRef` field of a ClusterRoleBinding is immutable after creation. Changing which ClusterRole a binding references requires deleting and recreating it.
