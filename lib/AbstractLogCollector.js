/* Copyright @ 2016 Atlassian Pty Ltd
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var Logger = require('./Logger.js');

/**
 * Provides skeleton for LogCollector implementation.
 *
 * @constructor
 */
function AbstractLogCollector(logStorage, options) {
    this.logStorage = logStorage;
    this.storeInterval = options ? options.storeInterval : 30000;
    // Bind the log method for each level to the corresponding method name
    // in order to implement "global log transport" object.
    Object.keys(Logger.levels).forEach(
    function (logLevel) {
        var methodName = Logger.levels[logLevel];
        this[methodName] = function (logLevel) {
            this._log.apply(this, arguments);
        }.bind(this, logLevel);
    }.bind(this));
    /**
     * The ID of store logs interval if one is currently scheduled or
     * <tt>null</tt> otherwise.
     * @type {number|null}
     */
    this.storeLogsIntervalID = null;
    /**
     * The log messages that are to be batched into log entry when
     * {@link LogCollector._flush} method is called.
     * @type {string[]}
     */
    this.queue = [];
}

/**
 * Adds next log "line" which can be whatever implementation decides to
 * the queue.
 * @protected
 * @abstract
 */
AbstractLogCollector.prototype.addNextLogEntry
= function (queue, logLevel/*, arg1, arg2, arg3... */) {
    throw new Error("not implemented");
};

/**
 * Tells if it's the time to store the next batch log entry now. Called to check
 * the condition every time after {@link addNextLogEntry}.
 *
 * @protected
 * @abstract
 */
AbstractLogCollector.prototype.shouldStoreLogsNow = function() {
    throw new Error("not implemented");
};

/**
 * The log method bound to each of the logging levels in order to implement
 * "global log transport" object.
 *
 * @private
 */
AbstractLogCollector.prototype._log = function() {

    // var logLevel = arguments[0]; first argument is the log level
    this.addNextLogEntry(this.queue, arguments);
    if (this.shouldStoreLogsNow()) {
        this._flush(true /* reschedule */);
    }
};

/**
 * Starts this instance and schedules periodical "store logs" task.
 */
AbstractLogCollector.prototype.start = function () {
    this._reschedulePublishInterval();
};

/**
 * Reschedules the periodical "store logs" task which will store the next batch
 * log entry in the storage.
 * @private
 */
AbstractLogCollector.prototype._reschedulePublishInterval = function () {
    if (this.storeLogsIntervalID) {
        window.clearTimeout(this.storeLogsIntervalID);
        this.storeLogsIntervalID = null;
    }
    // It's actually a timeout, because it is rescheduled on every flush
    this.storeLogsIntervalID
        = window.setTimeout(
            this._flush.bind(this, true /* reschedule */), this.storeInterval);
};

/**
 * Call this method to flush the log entry buffer and store it in the log
 * storage immediately.
 */
AbstractLogCollector.prototype.flush = function() {
    this._flush(true /* reschedule next update */ )
};

/**
 * Tells whether or not there is anything to be stored as next batch log entry.
 *
 * @protected
 */
AbstractLogCollector.prototype.isAntyhingToBeLogged = function() {
    throw new Error("not implemented");
};

/**
 * Called after batch log entry is stored to reset some values
 *
 * @protected
 */
AbstractLogCollector.prototype.reset = function() {
    this.queue = [];
};

/**
 * Stores the next batch log entry in the log storage.
 * @param {boolean} reschedule <tt>true</tt> if the next periodic task should be
 * scheduled after the log entry is stored. <tt>false</tt> will end the periodic
 * task cycle.
 * @private
 */
AbstractLogCollector.prototype._flush = function(reschedule) {
    // Publish only if there's anything to be logged
    if (this.isAntyhingToBeLogged()) {
        //FIXME avoid truncating
        // right now we don't care if the message size is "slightly" exceeded
        this.logStorage.storeLogs(this.queue);

        this.reset();
    }

    if (reschedule) {
        this._reschedulePublishInterval();
    }
};

/**
 * Stops the log collector and stores immediately any pending batch log entries.
 */
AbstractLogCollector.prototype.stop = function() {
    // Flush and stop publishing logs
    this._flush(false /* do not reschedule */);
};

module.exports = AbstractLogCollector;
