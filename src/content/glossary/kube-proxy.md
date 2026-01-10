---
title: kube-proxy
description: A network proxy that runs on each node and maintains network rules for Services
category: component
---

kube-proxy is a **network component** that runs on every node in the cluster. Its job is to maintain network rules that allow communication to your Pods from inside or outside the cluster. When you create a Service, kube-proxy makes sure traffic destined for that Service actually reaches the right Pods.

It can operate in different modes: **iptables** (the default, uses Linux iptables rules), **IPVS** (better performance for large clusters), or **userspace** (legacy, rarely used). kube-proxy watches the API server for Service and Endpoint changes and updates the node's network rules accordingly.

From a security perspective, kube-proxy itself doesn't enforce network policies. For that, you need a **CNI plugin** like Calico or Cilium. Also, be aware that kube-proxy exposes metrics on **port 10249** by default, which should be restricted in production environments.
