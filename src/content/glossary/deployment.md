---
title: Deployment
description: A controller that manages the desired state of Pods and ReplicaSets
category: resource
---

A Deployment tells Kubernetes how many **replicas** of your Pod should be running and handles keeping them that way. You describe the **desired state**, and the Deployment controller works to match it by spinning up new Pods, rolling out updates, or scaling down as needed.

When you update a Deployment (say, a new container image), it performs a **rolling update** by default: gradually replacing old Pods with new ones so your app stays available. If something goes wrong, you can **roll back** to a previous version. Under the hood, Deployments manage **ReplicaSets**, but you rarely interact with those directly.
