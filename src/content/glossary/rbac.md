---
title: RBAC (Role-Based Access Control)
description: A method of regulating access to computer or network resources based on the roles of individual users
category: security
relatedTerms:
  - Service Account
  - ClusterRole
  - RoleBinding
---

RBAC is a security mechanism that restricts access based on the **roles** assigned to users or service accounts. It lets you define **fine-grained permissions** for who can do what in your cluster.

Kubernetes RBAC has four main objects: **Role** (permissions within a namespace), **ClusterRole** (permissions cluster-wide), **RoleBinding** (grants a Role to users/service accounts in a namespace), and **ClusterRoleBinding** (grants a ClusterRole across the entire cluster).

From a security standpoint, follow the **principle of least privilege**. Don't give more permissions than needed. Regularly audit your RBAC configurations, use dedicated service accounts with minimal permissions, and clean up unused bindings.