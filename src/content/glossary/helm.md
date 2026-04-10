---
title: Helm
description: A package manager for Kubernetes that bundles resources into reusable, versioned charts
category: component
relatedTerms:
  - Deployment
  - CustomResourceDefinition
  - Namespace
---

Helm is a **package manager for Kubernetes** that groups related manifests into a single deployable unit called a **chart**. A chart contains templates for all the Kubernetes resources an application needs, along with default configuration values that can be overridden at install time.

Charts are versioned and can be shared through **Helm repositories**. You install a chart using `helm install`, which renders the templates with your provided values and applies the resulting manifests to the cluster. Helm tracks what it has installed as a **release**, making it straightforward to upgrade to a new chart version or roll back to a previous one.

Values are passed using a `values.yaml` file or with `--set` flags on the command line. This templating approach means the same chart can be used across different environments, such as development, staging, and production, simply by supplying different values.
