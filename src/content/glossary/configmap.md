---
title: ConfigMap
description: A Kubernetes object used to store non-sensitive configuration data as key-value pairs
category: resource
relatedTerms:
  - Secret
  - Pod
  - Deployment
---

A ConfigMap stores **non-sensitive configuration data** as key-value pairs. This lets you separate configuration from container images, so the same image can run with different settings across environments without being rebuilt.

ConfigMap data can be consumed by Pods in two ways. Values can be injected as **environment variables**, or the entire ConfigMap can be mounted as a **directory of files** inside the container, where each key becomes a filename and its value becomes the file content.

Unlike Secrets, ConfigMaps are stored in plain text in etcd and are not intended for sensitive data. They work well for things like application settings, feature flags, configuration files, and command-line arguments.
