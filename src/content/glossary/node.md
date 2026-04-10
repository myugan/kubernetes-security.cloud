---
title: Node
description: A worker machine in Kubernetes that runs Pods and is managed by the control plane
category: component
relatedTerms:
  - Kubelet
  - Pod
  - DaemonSet
---

A Node is a **worker machine** in a Kubernetes cluster, either a physical server or a virtual machine. Nodes are where Pods actually run. The control plane schedules Pods onto nodes based on available resources, taints, tolerations, and affinity rules.

Every node runs three core components. The **kubelet** is an agent that communicates with the API server and ensures the containers described in Pod specs are running. The **container runtime** (such as containerd or CRI-O) is responsible for pulling images and running containers. **kube-proxy** maintains network rules on the node to route traffic to the correct Pods.

There are two types of nodes in a cluster. **Control plane nodes** (also called master nodes) host the API server, scheduler, controller manager, and etcd. **Worker nodes** (also called minion nodes) run application workloads. In production clusters these roles are kept separate, though single-node setups run everything on one machine.
