---
title: Operator
description: A pattern for extending Kubernetes with custom controllers that automate the management of complex applications
category: component
relatedTerms:
  - CustomResourceDefinition
  - RBAC
  - ServiceAccount
---

An Operator is a **Kubernetes controller paired with a CustomResourceDefinition** that automates the management of a specific application. It encodes the operational knowledge of running that application, such as how to install, configure, upgrade, and recover it, into software that runs inside the cluster.

The Operator pattern works by watching for changes to custom resources and reconciling the actual cluster state with the desired state defined in those resources. For example, a database Operator might watch for a `PostgreSQLCluster` custom resource and automatically provision the right Pods, Services, and PersistentVolumeClaims to run it.

Operators are built using controller frameworks such as the **Operator SDK** or **Kubebuilder**. Many popular tools ship as Operators, including Prometheus, Cert-Manager, ArgoCD, and Elasticsearch. The Operator Hub at operatorhub.io is a public registry of Operators available for common applications.
