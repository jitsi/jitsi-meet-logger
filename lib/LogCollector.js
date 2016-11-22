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
 * Stringifies given <tt>object</tt> without any circular references.
 * @param {object} someObject the <tt>object</tt> to be stringified.
 * @return {string} the result of <tt>JSON.stringify</tt> with the circular
 * references skipped.
 */
function stringify(someObject){
    const cache = [];
    return JSON.stringify(someObject, function (key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Circular reference
                return;
            }
            cache.push(value);
        }
        return value;
    });
}

/**
 * Creates new <tt>LogCollector</tt>. Class implements <tt>LoggerTransport</tt>
 * and thus can be added as global transport in order to capture all the logs.
 *
 * @param {Object} logStorage an object which allows to store the logs collected
 * @param {function(string)} logStorage.storeLogs a method that will store
 * the logs which are passed as a JSON string in the following format:
 * {
 *   "log1": "logged message1\nlogged message2\n...logged message10\n"
 * }
 * Where the number next to the log key indicates log entry number in ascending
 * order.
 *
 * @param {Object} options the <tt>LogCollector</tt> configuration options.
 * @param {number} options.maxEntryLength the size limit for a single log entry
 * to be stored. The <tt>LogCollector</tt> will push the entry as soon as it
 * reaches or exceeds this limit.
 * @param {number} options.storeInterval how often the logs should be stored in
 * case <tt>maxEntryLength</tt> was not exceeded.
 * @param {boolean} options.stringifyObjects indicates whether or not object
 * arguments should be "stringified" with <tt>JSON.stringify</tt> when a log
 * message is composed. Note that objects logged on the error log level are
 * always stringified.
 *
 * @constructor
 */
function LogCollector(logStorage, options) {
    this.logStorage = logStorage;
    this.stringifyObjects = options ? options.stringifyObjects : false;
    this.storeInterval = options ? options.storeInterval : 30000;
    this.maxEntryLength = options ? options.maxEntryLength : 10000;
    // Bind the log method for each level to the corresponding method name
    // in order to implement "global log transport" object.
    Object.keys(Logger.levels).forEach(
    function (logLevel) {
        const methodName = Logger.levels[logLevel];
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
    /**
     * The total length of all messages currently stored in the {@link queue}.
     * @type {number}
     */
    this.totalLen = 0;
    /**
     * The counter increased whenever next logs batch is stored (or cached if
     * the storage is not ready yet).
     * @type {number}
     */
    this.counter = 1;
}

/**
 * The log method bound to each of the logging levels in order to implement
 * "global log transport" object.
 *
 * @private
 */
LogCollector.prototype._log = function() {

    var logLevel = arguments[0];
    var msg = '';
    for (var i = 1, len = arguments.length; i < len; i++) {
        var arg = arguments[i];
        // objects logged on error level are always converted to JSON
        if ((this.stringifyObjects || logLevel === Logger.levels.ERROR)
            && typeof arg === 'object') {
            arg = stringify(arg);
        }
        msg += arg;
        if (i != len - 1) {
            msg += ' ';
        }
    }

    if (msg.length) {
        // The same as the previous message aggregation logic
        var prevMessage
            = this.queue.length ? this.queue[this.queue.length -1] : undefined;
        // NOTE that typeof undefined is 'undefined'
        var prevMessageText
            = typeof prevMessage === 'object' ? prevMessage.text : prevMessage;
        // Is it the same as the previous one ?
        if (prevMessageText == msg) {
            if (typeof prevMessage === 'object') {
                prevMessage.count += 1;
            } else {
                this.queue[this.queue.length-1] = {
                    text: msg,
                    count: 2
                }
            }
        } else {
            this.queue.push(msg);
            this.totalLen += msg.length;
        }
    }

    if (this.totalLen >= this.maxEntryLength) {
        this._flush(true /* reschedule */);
    }
};

/**
 * Starts this instance and schedules periodical "store logs" task.
 */
LogCollector.prototype.start = function () {
    this._reschedulePublishInterval();
};

/**
 * Reschedules the periodical "store logs" task which will store the next batch
 * log entry in the storage.
 * @private
 */
LogCollector.prototype._reschedulePublishInterval = function () {
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
LogCollector.prototype.flush = function() {
    this._flush(true /* reschedule next update */ )
};

/**
 * Stores the next batch log entry in the log storage.
 * @param {boolean} reschedule <tt>true</tt> if the next periodic task should be
 * scheduled after the log entry is stored. <tt>false</tt> will end the periodic
 * task cycle.
 * @private
 */
LogCollector.prototype._flush = function(reschedule) {
    // Publish only if there's anything to be logged
    if (this.totalLen > 0) {
        //FIXME avoid truncating
        // right now we don't care if the message size is "slightly" exceeded
        var toSend = '{"log' + this.counter + '":"\n';
        for (var i = 0, len = this.queue.length; i < len; i++) {
            var logEntry = this.queue[i];
            if (typeof logEntry === 'object') {
                // Aggregated message
                toSend += '(' + logEntry.count +') ' + logEntry.text + '\n';
            } else {
                // Regular message
                toSend += logEntry + '\n';
            }
        }
        toSend += '"}';

        this.logStorage.storeLogs(toSend);

        this.queue = [];
        this.totalLen = 0;
        this.counter += 1;
    }

    if (reschedule) {
        this._reschedulePublishInterval();
    }
};

/**
 * Stops the log collector and stores immediately any pending batch log entries.
 */
LogCollector.prototype.stop = function() {
    // Flush and stop publishing logs
    this._flush(false /* do not reschedule */);
    // Reset log entry counter
    this.counter = 1;
};

module.exports = LogCollector;
