/* Copyright @ 2016-present 8x8, Inc.
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
 * Creates new <tt>LogCollector</tt>. Class implements <tt>LoggerTransport</tt>
 * and thus can be added as global transport in order to capture all the logs.
 *
 * It captures subsequent log lines created whenever <tt>Logger</tt> logs
 * a message and stores them in a queue in order to batch log entries. There are
 * time and size limit constraints which determine how often batch entries are
 * stored. Whenever one of these limits is exceeded the <tt>LogCollector</tt>
 * will use the <tt>logStorage</tt> object given as an argument to save
 * the batch log entry.
 *
 * @param {Object} logStorage an object which allows to store the logs collected
 * @param {function(string|object[])} logStorage.storeLogs a method called when
 * this <tt>LogCollector</tt> requests log entry storage. The method's argument
 * is an array which can contain <tt>string</tt>s and <tt>object</tt>s. If given
 * item is an object it means that it's an aggregated message. That is a message
 * which is the same as the previous one and it's representation has
 * the following format:
 * {
 *   {string} text: 'the text of some duplicated message'
 *   {number} count: 3 // how many times the message appeared in a row
 * }
 * If a message "B" after an aggregated message "A" is different, then it breaks
 * the sequence of "A". Which means that even if the next message "C" is
 * the same as "A" it will start a new aggregated message "C".
 * @param {function()} logStorage.isReady a method which should return
 * a <tt>boolean</tt> to tell the collector that it's ready to store. During the
 * time storage is not ready log batches will be cached and stored on the next
 * occasion (flush or interval timeout).
 *
 * @param {Object} options the <tt>LogCollector</tt> configuration options.
 * @param {number} options.maxEntryLength the size limit for a single log entry
 * to be stored. The <tt>LogCollector</tt> will push the entry as soon as it
 * reaches or exceeds this limit given that <tt>logStorage.isReady</tt>
 * returns <tt>true</tt>. Otherwise the log entry will be cached until the log
 * storage becomes ready. Note that the "is ready" condition is checked every
 * <tt>options.storeInterval</tt> milliseconds.
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
    this.stringifyObjects = options && options.stringifyObjects ? options.stringifyObjects : false;
    this.storeInterval = options && options.storeInterval ? options.storeInterval: 30000;
    this.maxEntryLength = options && options.maxEntryLength ? options.maxEntryLength : 10000;
    // Bind the log method for each level to the corresponding method name
    // in order to implement "global log transport" object.
    Object.values(Logger.levels).forEach(
    function (logLevel) {
        this[logLevel] = function () {
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
     * An array used to temporarily store log batches, before the storage gets
     * ready.
     * @type {string[]}
     */
    this.outputCache = [];
}

/**
 * Method called inside of {@link formatLogMessage} in order to covert an
 * <tt>Object</tt> argument to string. The conversion will happen when either
 * 'stringifyObjects' option is enabled or on the {@link Logger.levels.ERROR}
 * log level. The default implementation uses <tt>JSON.stringify</tt> and
 * returns "[object with circular refs?]" instead of an object if it fails.
 *
 * @param {object} someObject the <tt>object</tt> to be stringified.
 *
 * @return {string} the result of <tt>JSON.stringify</tt> or
 * "[object with circular refs?]" if any error occurs during "stringification".
 *
 * @protected
 */
LogCollector.prototype.stringify = function (someObject) {
    try {
        return JSON.stringify(someObject);
    } catch (error) {
        return '[object with circular refs?]';
    }
};

/**
 * Formats log entry for the given logging level and arguments passed to the
 * <tt>Logger</tt>'s log method. The first argument is log level and the next
 * arguments have to be captured using JS built-in 'arguments' variable.
 *
 * @param {Logger.levels} logLevel provides the logging level of the message to
 * be logged.
 * @param {Date} timestamp - The {@code Date} when a message has been logged.
 *
 * @return {string|null} a non-empty string representation of the log entry
 * crafted from the log arguments. If the return value is <tt>null</tt> then
 * the message wil be discarded by this <tt>LogCollector</tt>.
 *
 * @protected
 */
LogCollector.prototype.formatLogMessage = function (
logLevel /* timestamp, arg2, arg3, arg4... */) { // jshint ignore:line
    var msg = '';
    for (var i = 1, len = arguments.length; i < len; i++) {
        var arg = arguments[i];

        if (arg instanceof Error) {
            msg += arg.toString() + ': ' + arg.stack;
        } else if (this.stringifyObjects && typeof arg === 'object') {
        // NOTE: We were trying to stringify all error logs before but because of a bug that we were getting the keys
        // of the log levels which are all with upper case and comparing it with the keys which are all lower case we
        // were never actually strinfying the error logs. That's why I've removed the check for error logs here.
        // NOTE: The non-enumerable properties of the objects wouldn't be included in the string after JSON.strigify.
        // For example Map instance will be translated to '{}'. So I think we have to eventually do something better
        // for parsing the arguments. But since this option for strigify is part of the public interface and I think
        // it could be useful in some cases I will it for now.
            msg += this.stringify(arg);
        } else {
            msg += arg;
        }
        if (i !== len - 1) {
            msg += ' ';
        }
    }
    return msg.length ? msg : null;
};

/**
 * The log method bound to each of the logging levels in order to implement
 * "global log transport" object.
 *
 * @private
 */
LogCollector.prototype._log = function() {

    // var logLevel = arguments[0]; first argument is the log level
    var timestamp = arguments[1];
    var msg = this.formatLogMessage.apply(this, arguments);
    if (msg) {
        // The same as the previous message aggregation logic
        var prevMessage = this.queue[this.queue.length - 1];
        var prevMessageText = prevMessage && prevMessage.text;
        if (prevMessageText === msg) {
            prevMessage.count += 1;
        } else {
            this.queue.push({
                text: msg,
                timestamp: timestamp,
                count: 1
            });
            this.totalLen += msg.length;
        }
    }

    if (this.totalLen >= this.maxEntryLength) {
        this._flush(true /* force */, true /* reschedule */);
    }
};

/**
 * Starts periodical "store logs" task which will be triggered at the interval
 * specified in the constructor options.
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
    this.storeLogsIntervalID = window.setTimeout(
        this._flush.bind(
            this, false /* do not force */, true /* reschedule */),
        this.storeInterval);
};

/**
 * Call this method to flush the log entry buffer and store it in the log
 * storage immediately (given that the storage is ready).
 */
LogCollector.prototype.flush = function() {
    this._flush(
        false /* do not force, as it will not be stored anyway */,
        true /* reschedule next update */ );
};

/**
 * Passes the logs to logStorage.storeLogs in order to store them. If logStorage.storeLogs throws an error, it prints it.
 * Note: We are not retrying to pass the logs to the logStorage if there is an error.
 * @param {string[]} logs - The logs to be stored.
 */
LogCollector.prototype._storeLogs = function (logs) {
    try {
        this.logStorage.storeLogs(logs);
    } catch (error) {
        console.error('LogCollector error when calling logStorage.storeLogs(): ', error);
    }
};

/**
 * Stores the next batch log entry in the log storage.
 * @param {boolean} force enforce current logs batch to be stored or cached if
 * there is anything to be logged, but the storage is not ready yet. One of
 * legitimate reasons to force is when the logs length exceeds size limit which
 * could result in truncation.
 * @param {boolean} reschedule <tt>true</tt> if the next periodic task should be
 * scheduled after the log entry is stored. <tt>false</tt> will end the periodic
 * task cycle.
 * @private
 */
LogCollector.prototype._flush = function(force, reschedule) {
    var logStorageReady = false;

    try {
        logStorageReady = this.logStorage.isReady();
    } catch (error) {
        console.error('LogCollector error when calling logStorage.isReady(): ', error);
    }

    // Publish only if there's anything to be logged
    if (this.totalLen > 0 && (logStorageReady || force)) {
        //FIXME avoid truncating
        // right now we don't care if the message size is "slightly" exceeded
        if (logStorageReady) {
            // Sends all cached logs
            if (this.outputCache.length) {
                this.outputCache.forEach(
                    function (cachedQueue) {
                        this._storeLogs(cachedQueue);
                    }.bind(this)
                );
                // Clear the cache
                this.outputCache = [];
            }
            // Send current batch
            this._storeLogs(this.queue);
        } else {
            this.outputCache.push(this.queue);
        }

        this.queue = [];
        this.totalLen = 0;
    }

    if (reschedule) {
        this._reschedulePublishInterval();
    }
};

/**
 * Stops the periodical "store logs" task and immediately stores any pending
 * log entries as a batch.
 */
LogCollector.prototype.stop = function() {
    // Flush and stop publishing logs
    this._flush(false /* do not force */, false /* do not reschedule */);
};

module.exports = LogCollector;
