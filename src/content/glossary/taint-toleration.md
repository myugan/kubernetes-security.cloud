---
title: Taint and Toleration
description: A mechanism to control which Pods can be scheduled onto specific nodes
category: resource
relatedTerms:
  - Node
  - Pod
  - DaemonSet
---

Taints and tolerations work together to **control which Pods land on which nodes**. A taint is applied to a node and acts as a repellent. Any Pod that does not explicitly tolerate that taint will not be scheduled onto the node.

Taints have three effects. **NoSchedule** prevents new Pods without the matching toleration from being scheduled. **PreferNoSchedule** is a soft version that tries to avoid scheduling but does not guarantee it. **NoExecute** both prevents scheduling and evicts any already-running Pods that do not tolerate the taint.

A common use case is dedicating nodes to specific workloads. For example, GPU nodes are often tainted so only Pods requesting GPU resources (which carry the matching toleration) get placed on them. **DaemonSets** often use a wildcard toleration (`operator: Exists`) to ensure their Pods run on every node regardless of what taints are applied.
