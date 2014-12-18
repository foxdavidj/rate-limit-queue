(function(definition) {
  'use strict';

  // Swiped from: https://github.com/kriskowal/q
  // This file will function properly as a <script> tag, or a module
  // using CommonJS and NodeJS or RequireJS module formats.  In
  // Common/Node/RequireJS, the module exports the RateLimitQueue API and when
  // executed as a simple <script>, it creates a RateLimitQueue global instead.

  // CommonJS
  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = definition();

  // RequireJS
  } else if (typeof define === 'function' && define.amd) {
    define(definition);

  // <script>
  } else if (typeof self !== 'undefined') {
    self.RateLimitQueue = definition();

  } else {
    throw new Error('This environment was not anticiapted by RateLimitQueue. Please file a bug.');
  }
})(function() {
  'use strict';

  /**
   * Queues up functions to follow a specified rate limit
   * @constructor
   * @param {number}  max_parallel_tasks  The maximum amount of queued tasks to run in parallel
   * @param {number=} timeframe           The timeframe for the below (ms)
   * @param {number=} tasks_per_timeframe The maximum amount of tasks to be run in the given timeframe
   */
  function RateLimitQueue(max_parallel_tasks, timeframe, tasks_per_timeframe) {
    max_parallel_tasks = max_parallel_tasks || 1;
    timeframe = timeframe || false;
    tasks_per_timeframe = tasks_per_timeframe || false;

    var timeframe_enabled = timeframe && tasks_per_timeframe;

    /**
     * Holds all the queued tasks
     * @type {Array}
     */
    var queue = [];
    /**
     * Holds logs of tasks run within the allotted timeframe
     * @type {Array}
     */
    var task_timeframe_log = [];
    /**
     * The number of parallel tasks being run
     * @type {Number}
     */
    var total_parallel_tasks = 0;

    /**
     * Find the total number of new tasks that can be run
     * @return {number}
     */
    function totalTasksToStartup() {
      // Don't run more tasks in parallel than allowed
      if (total_parallel_tasks >= max_parallel_tasks) {
        return 0;
      }
      var total_tasks_to_startup = max_parallel_tasks - total_parallel_tasks;

      // Check If the maximum amount of tasks have been run this timeout
      if (timeframe_enabled) {
        // Only keep times within the allotted timeframe
        filterTimeframeLog();
        if (task_timeframe_log.length >= tasks_per_timeframe) {
          return 0;
        }

        if ((tasks_per_timeframe - task_timeframe_log.length) < total_tasks_to_startup) {
          total_tasks_to_startup = tasks_per_timeframe - task_timeframe_log.length;
        }
      }

      return total_tasks_to_startup;
    }

    function filterTimeframeLog() {
      var current_time = Date.now();
      task_timeframe_log = task_timeframe_log.filter(function(task) {
        if (task.end > 0) {
          return (current_time - task.timing.end <= timeframe);
        }

        return (current_time - task.timing.start <= timeframe);
      });
    }

    function timeTillQueueFree() {
      filterTimeframeLog();

      var current_time = Date.now();
      var time_when_free = task_timeframe_log.reduce(function(prev, curr) {
        return (curr.timing.end > -1) ? current_time - curr.timing.end : prev;
      }, -1);

      // If all tasks are currently running, guess they will finish in ~100ms
      return time_when_free > -1 ? time_when_free : 100;
    }

    function runTask(task) {
      // Only log tasks if we need them for timeframe based queues
      var task_info;
      if (timeframe_enabled) {
        task_info = {
          id: Math.random().toString(36).substring(2),
          timing: {
            start: Date.now(),
            end: -1
          }
        };
        task_timeframe_log.push(task_info);
      }

      total_parallel_tasks++;
      var callback_called = false;
      task(function() {
        if (callback_called) return;

        callback_called = true;
        if (timeframe_enabled) {
          task_info.timing.end = Date.now();
        }

        total_parallel_tasks--;
        checkQueue();
      });
    }

    /**
     * Checks if a new task in the queue can be run
     */
    function checkQueue() {
      if (queue.length === 0) return;

      var tasks_to_startup = totalTasksToStartup();
      // If there is a queue of tasks but none are running and we can't start up
      // any because of the timeframe limiter... set a timeout for
      // when the queue will have an opening
      if (timeframe_enabled && total_parallel_tasks === 0 && tasks_to_startup === 0) {
        setTimeout(checkQueue, timeTillQueueFree());
        return;
      }

      // Run queued up tasks
      for (var i = 0; i < tasks_to_startup; i++) {
        var task = queue.shift();
        if (!task) break;

        runTask(task);
      }
    }

    /**
     * Adds a function to the back queue
     * @param {function(callback)} task_function
     */
    this.push = function(task_function) {
      if (totalTasksToStartup()) {
        runTask(task_function);
      } else {
        queue.push(task_function);
      }
    };

    /**
     * Adds a function to the front queue
     * @param {function(callback)} task_function
     */
    this.unshift = function(task_function) {
      if (totalTasksToStartup()) {
        runTask(task_function);
      } else {
        queue.unshift(task_function);
      }
    };
  }

  return RateLimitQueue;
});
