---
title: DaemonSet
description: Ensures a copy of a Pod runs on all or selected nodes in the cluster
category: resource
---

A DaemonSet ensures that a specific Pod runs on **every node** in your cluster (or a subset of nodes if you use **node selectors**). When new nodes join, the DaemonSet automatically schedules a Pod on them. When nodes are removed, those Pods get garbage collected.

This is useful for cluster-wide infrastructure like **log collectors**, **monitoring agents**, or **network plugins** that need to run on every node. Unlike Deployments where you specify replica count, DaemonSets tie Pod count directly to the number of matching nodes.
