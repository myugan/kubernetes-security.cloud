---
title: Secret
description: A Kubernetes object used to store sensitive data such as passwords, tokens, and keys
category: resource
relatedTerms:
  - ServiceAccount
  - etcd
  - ConfigMap
---

A Secret is a Kubernetes object designed to hold **small amounts of sensitive data** such as passwords, API tokens, TLS certificates, and SSH keys. Storing this data in a Secret keeps it out of Pod specs and container images, allowing it to be managed and rotated independently.

Secrets are **base64-encoded** when stored, which makes them easier to handle in YAML but does not protect them from being read. They are stored in **etcd** and can be delivered to Pods either as **environment variables** or mounted as **files** in a volume.

Kubernetes also has a built-in type system for Secrets. Common types include `kubernetes.io/tls` for TLS certificates, `kubernetes.io/dockerconfigjson` for image pull credentials, and `Opaque` for arbitrary user-defined data.
