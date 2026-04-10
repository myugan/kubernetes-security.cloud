---
title: Job
description: A Kubernetes controller that runs one or more Pods to successful completion
category: resource
relatedTerms:
  - CronJob
  - Pod
  - ServiceAccount
---

A Job creates one or more Pods and ensures they run to **successful completion**. Unlike Deployments or StatefulSets that keep Pods running continuously, a Job is finished when its Pods exit successfully. If a Pod fails, the Job creates a replacement and retries up to a configurable limit.

Jobs support **parallelism**, letting you run multiple Pods at the same time to process work faster. You can also configure how many successful completions are required before the Job is considered done, which is useful for batch processing workloads that split work across multiple workers.

Completed Job Pods are not deleted automatically. Their logs and exit status remain available for inspection until the Job itself is deleted or cleaned up by a **TTL controller**. Jobs are commonly used for database migrations, data processing, and one-off administrative tasks.
