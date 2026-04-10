---
title: StatefulSet
description: A Kubernetes workload controller for managing stateful applications that require stable identities and persistent storage
category: resource
relatedTerms:
  - Deployment
  - PersistentVolume
  - Pod
---

A StatefulSet manages Pods for **stateful applications** that need stable, persistent identities. Unlike Deployments where Pods are interchangeable, each Pod in a StatefulSet gets a **stable hostname** (like `app-0`, `app-1`, `app-2`) and its own **PersistentVolume** that follows it even if the Pod is rescheduled to a different node.

Pods in a StatefulSet are created, updated, and deleted in **order**. Scaling up creates pods from the lowest index. Scaling down removes them from the highest index first. This predictable ordering matters for databases and distributed systems that have leader-follower relationships or initialization dependencies.

StatefulSets are commonly used for databases like MySQL, PostgreSQL, and Cassandra, as well as distributed systems like Kafka and ZooKeeper where each instance has a distinct role and its own data.
