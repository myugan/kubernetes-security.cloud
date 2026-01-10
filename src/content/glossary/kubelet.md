---
title: Kubelet
description: The agent running on each node that manages Pods and containers
category: component
---

The kubelet is an **agent** that runs on every node in the cluster. It takes **PodSpecs** from the API server and makes sure the described containers are running and healthy. It handles pulling images, starting containers via the **container runtime**, running probes, and reporting node and Pod status back to the control plane.

The kubelet also exposes an API on **port 10250**, which can be a security concern if not properly locked down. You should enable authentication and authorization on the kubelet API, **disable anonymous access**, and consider using the **NodeRestriction admission controller** to limit what kubelets can modify. A compromised kubelet means an attacker has control over everything running on that node.
