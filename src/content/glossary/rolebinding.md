---
title: RoleBinding
description: A namespace-scoped RBAC object that grants the permissions defined in a Role to users, groups, or service accounts
category: resource
relatedTerms:
  - Role
  - ClusterRoleBinding
  - ServiceAccount
  - Namespace
---

A RoleBinding **attaches a Role to one or more subjects** within a namespace. Subjects can be users, groups, or ServiceAccounts. Once bound, the subjects receive all the permissions defined in the referenced Role, but only within the namespace where the RoleBinding exists.

A RoleBinding can reference either a **Role** or a **ClusterRole**. When it references a ClusterRole, the permissions from that ClusterRole are applied only within the RoleBinding's namespace. This lets you define a common set of rules once in a ClusterRole and reuse it across multiple namespaces through separate RoleBindings.

RoleBindings are immutable in terms of their `roleRef` field once created. If you need to change which Role a binding references, you must delete and recreate the binding.
