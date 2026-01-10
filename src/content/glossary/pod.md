---
title: Pod
description: The smallest deployable unit in Kubernetes that can be created and managed
category: resource
---

A Pod is the smallest thing you can deploy in Kubernetes. Think of it as a wrapper around one or more containers that need to run together. They share the same **network IP**, can talk to each other, and have access to the same **storage volumes**.

Most of the time you will run a single container per Pod. But when you need multiple containers working together, Pods support different patterns: **init containers** run first to handle setup before your main app starts, **sidecars** run alongside your app for things like log collection or service mesh proxies, and **ephemeral containers** can be attached later when you need to debug a running Pod.