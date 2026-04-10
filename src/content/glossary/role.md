---
title: Role
description: A namespace-scoped RBAC object that defines a set of permissions for resources within a single namespace
category: resource
relatedTerms:
  - RoleBinding
  - ClusterRole
  - RBAC
  - Namespace
---

A Role defines a set of **permissions within a specific namespace**. It is made up of rules that specify which API groups, resource types, and verbs are allowed, such as `get`, `list`, `create`, or `delete`. A Role can only reference resources in the namespace where it is created.

Roles do not grant any permissions on their own. They must be attached to a subject through a **RoleBinding** before they take effect. This separation between defining permissions and granting them makes it easy to define a Role once and bind it to multiple subjects.

A common pattern is creating purpose-specific Roles for different functions, such as a read-only Role for monitoring tools or a limited Role for a CI/CD pipeline, rather than reusing a single broad Role across many workloads.
