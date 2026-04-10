---
title: CronJob
description: A Kubernetes controller that creates Jobs on a recurring schedule defined using cron syntax
category: resource
relatedTerms:
  - Job
  - Pod
---

A CronJob creates a new **Job** on a schedule defined using standard **cron syntax**. Each time the schedule fires, the CronJob creates a Job object which then manages the Pods needed to complete the task. The CronJob itself just manages the schedule and the creation of those Jobs.

The schedule is defined in the format `minute hour day-of-month month day-of-week`, for example `0 2 * * *` to run at 2am every day. Kubernetes uses UTC for schedule evaluation unless a time zone is specified.

CronJobs have a few important settings to be aware of. **concurrencyPolicy** controls whether a new Job can start if the previous one is still running. **startingDeadlineSeconds** sets how late a Job can start before it is skipped. **successfulJobsHistoryLimit** and **failedJobsHistoryLimit** control how many completed and failed Jobs are kept for reference.
