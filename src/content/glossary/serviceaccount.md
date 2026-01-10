---
title: ServiceAccount
description: An identity for processes running inside Pods to authenticate with the API server
category: resource
---

A ServiceAccount provides an **identity** for processes running in a Pod. When a Pod needs to talk to the Kubernetes API, it uses the ServiceAccount's **token** to authenticate. Every namespace has a **default ServiceAccount**, and every Pod gets one assigned automatically if you don't specify otherwise.

The token gets mounted into the Pod at `/var/run/secrets/kubernetes.io/serviceaccount/`. From a security perspective, you should avoid using the default ServiceAccount for workloads that need API access. Create dedicated ones with only the **RBAC permissions** they actually need. You can also **disable token auto-mounting** for Pods that don't need API access at all.
