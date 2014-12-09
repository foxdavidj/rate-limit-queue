# Rate Limit Queue
Queues up functions to follow a specified rate limit

## Installing

```
npm install rate-limit-queue
```

## Constructor Options
| Option              | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| max_parallel_tasks  | The maximum amount of queued tasks to run in parallel        |
| timeframe           | The timeframe for the below (ms)                             |
| tasks_per_timeframe | The maximum amount of tasks to be run in the given timeframe |
