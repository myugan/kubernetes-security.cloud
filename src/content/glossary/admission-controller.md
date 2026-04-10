---
title: Admission Controller
description: A plugin that intercepts API server requests to validate or mutate resources before they are persisted
category: component
relatedTerms:
  - RBAC
  - Pod
  - CustomResourceDefinition
---

An Admission Controller is a plugin that **intercepts requests to the Kubernetes API server** after authentication and authorization but before the object is persisted to etcd. They run as part of the API server request pipeline and can either accept, reject, or modify the incoming object.

There are two types. **Validating admission controllers** inspect a request and accept or reject it based on custom rules. **Mutating admission controllers** can modify the object before it is saved, for example injecting a sidecar container or setting default values.

Kubernetes ships with several built-in admission controllers such as **LimitRanger**, **ResourceQuota**, and **PodSecurity**. You can also extend this with **ValidatingAdmissionWebhooks** and **MutatingAdmissionWebhooks**, which delegate the decision to an external HTTP service, allowing tools like OPA Gatekeeper or Kyverno to enforce custom policies.
