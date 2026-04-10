---
title: Container
description: A lightweight, standalone executable unit that packages an application and its dependencies
category: component
relatedTerms:
  - Pod
  - Node
  - Kubelet
---

A container is a **lightweight, isolated process** that packages an application together with everything it needs to run: code, runtime, libraries, and configuration. Containers share the host operating system kernel but are isolated from each other using Linux **namespaces** and **cgroups**, which control what they can see and how much CPU and memory they can use.

Container images are built in **layers**. Each instruction in a Dockerfile adds a layer on top of the previous one. When you run a container, a thin writable layer is added on top of the read-only image layers. This layering means images are efficient to store and transfer since layers are shared across images that have a common base.

In Kubernetes, containers run inside **Pods**. The kubelet on each node instructs the container runtime (typically containerd or CRI-O) to pull the image and start the container according to the Pod spec. Kubernetes adds scheduling, health checking, and lifecycle management on top of the basic container primitives.
