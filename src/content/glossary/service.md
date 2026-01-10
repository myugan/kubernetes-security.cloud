---
title: Service
description: An abstraction that exposes a set of Pods as a network service
category: resource
---

A Service gives your Pods a **stable network identity**. Since Pods are ephemeral and their IPs change when they restart, you need something consistent to point at. That's what a Service does. It provides a single **DNS name** and IP that routes traffic to the right Pods using **label selectors**.

There are different Service types: **ClusterIP** (internal only, the default), **NodePort** (exposes on each node's IP at a static port), **LoadBalancer** (provisions an external load balancer in cloud environments), and **ExternalName** (maps to a DNS name outside the cluster).
