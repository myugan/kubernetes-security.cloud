---
title: API Server
description: The central management component that exposes the Kubernetes API
category: component
---

The API server (`kube-apiserver`) is the **front door** to your Kubernetes cluster. Every interaction, whether from kubectl, controllers, or the kubelet, goes through it. It handles **authentication**, **authorization**, **admission control**, and then persists the validated objects to etcd.

Because everything flows through the API server, securing it is critical. This includes enabling **RBAC**, configuring proper authentication methods, using **admission controllers** to enforce policies, enabling **audit logging**, and restricting network access. If the API server is compromised or misconfigured (like allowing anonymous auth), an attacker can control the entire cluster.
