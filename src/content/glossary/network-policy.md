---
title: NetworkPolicy
description: A Kubernetes resource that controls traffic flow between pods and namespaces
category: resource
relatedTerms:
  - Namespace
  - Pod
  - Service
---

A NetworkPolicy defines rules that control **which pods can send and receive traffic**. You select pods using label selectors and then specify what ingress (incoming) and egress (outgoing) traffic is allowed, filtering by pod labels, namespace labels, IP ranges, and ports.

NetworkPolicies are enforced by the **CNI plugin** running in the cluster. Common CNI plugins that support NetworkPolicy include Cilium, Calico, and Weave Net. If the CNI does not support it, the policy objects are accepted by the API server but have no effect on traffic.

By default, if no NetworkPolicy selects a pod, all traffic to and from that pod is allowed. Once at least one NetworkPolicy selects a pod, only the traffic explicitly permitted by those policies is allowed.
