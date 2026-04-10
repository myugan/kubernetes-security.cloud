---
title: ReplicaSet
description: A Kubernetes controller that ensures a specified number of Pod replicas are running at all times
category: resource
relatedTerms:
  - Deployment
  - Pod
---

A ReplicaSet ensures that a **specified number of identical Pods** are running at any given time. If a Pod crashes or is deleted, the ReplicaSet creates a replacement. If there are too many Pods, it removes the excess.

ReplicaSets use a **label selector** to identify which Pods they manage. Any Pod matching the selector is counted toward the desired replica count, whether the ReplicaSet created it or not.

In practice, you rarely create ReplicaSets directly. A **Deployment** manages ReplicaSets on your behalf and adds rolling update and rollback capabilities on top. ReplicaSets are the underlying mechanism that Deployments use to maintain Pod availability during updates.
