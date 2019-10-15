/* Copyright @ 2015-present 8x8, Inc.
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
/*jslint latedef:false*/

/**
 * Ordered log levels.
 */
var levels = {
    "trace": 0,
    "debug": 1,
    "info": 2,
    "log": 3,
    "warn": 4,
    "error": 5
};

/**
 * The default transport - console
 * @type LoggerTransport
 */
Logger.consoleTransport = console;

/**
 * The array which stores currently registered global transports.
 * @type {[LoggerTransport]}
 */
var globalTransports = [ Logger.consoleTransport ];

/**
 * Adds given {@link LoggerTransport} instance to the list of global
 * transports which means that it'll be used by all {@link Logger}s
 * @param {LoggerTransport} transport
 */
Logger.addGlobalTransport = function(transport) {
    if (globalTransports.indexOf(transport) === -1) {
        globalTransports.push(transport);
    }
};

/**
 * Removes given {@link LoggerTransport} instance from the list of global
 * transports
 * @param {LoggerTransport} transport
 */
Logger.removeGlobalTransport = function(transport) {
    var transportIdx = globalTransports.indexOf(transport);
    if (transportIdx !== -1) {
        globalTransports.splice(transportIdx, 1);
    }
};

/**
 * The global configuration options.
 */
var globalOptions = {};

/**
 * Sets global options which will be used by all loggers. Changing these works
 * even after other loggers are created.
 */
Logger.setGlobalOptions = function(options) {
    globalOptions = options || {};
};

/**
 * Parses Error's object stack trace and extracts information about the last
 * caller before the log method was called.
 * @returns JS object with info about the caller - method name, file location,
 * line and column.
 */
function getCallerInfo() {
    var callerInfo = {
        methodName: "",
        fileLocation: "",
        line: null,
        column: null
    };
    //gets the part of the stack without the logger wrappers
    var error = new Error();
    var stack = error.stack? error.stack.split("\n") : [];
    if(!stack || stack.length < 1) {
        return callerInfo;
    }
    var m = null;
    if(stack[3]) {
        m = stack[3].match(/\s*at\s*(.+?)\s*\((\S*)\s*:(\d*)\s*:(\d*)\)/);
    }
    if(!m || m.length <= 4) {
        //Firefox && Safari
        if(stack[2].indexOf("log@") === 0){
            //Safari
            callerInfo.methodName = stack[3].substr(0, stack[3].indexOf("@"));
        } else {
            //Firefox
            callerInfo.methodName = stack[2].substr(0, stack[2].indexOf("@"));
        }
        return callerInfo;
    }

    callerInfo.methodName = m[1];
    callerInfo.fileLocation = m[2];
    callerInfo.line = m[3];
    callerInfo.column = m[4];
    return callerInfo;
}

/**
 * Logs messages using the transports and level from the logger.
 * @param logger a logger instance.
 * @param level the log level of the message. See the levels variable.
 * @param arguments array with arguments that will be logged.
 */
function log() {
    var logger = arguments[0], level = arguments[1],
        args = Array.prototype.slice.call(arguments, 2);
    if(levels[level] < logger.level) {
        return;
    }

    var callerInfo
        = !(logger.options.disableCallerInfo || globalOptions.disableCallerInfo) &&
            getCallerInfo();
    var transports = globalTransports.concat(logger.transports);
    for(var i = 0; i < transports.length; i++) {
        var t = transports[i];
        var l = t[level];
        if(l && typeof(l) === "function") {
            var logPrefixes = [];

            logPrefixes.push(new Date().toISOString());

            if (logger.id) {
                logPrefixes.push("[" + logger.id + "]");
            }

            if (callerInfo && callerInfo.methodName.length > 1) {
                logPrefixes.push("<" + callerInfo.methodName + ">: ");
            }

            var fullLogParts = logPrefixes.concat(args);

            l.bind(t).apply(t, fullLogParts);
        }
    }
}

/**
 *
 * Constructs new logger object.
 * @param level the logging level for the new logger
 * @param id optional identifier for the logger instance.
 * @param {LoggerTransport} transports optional list of handlers(objects) for
 * the logs. The handlers must support - log, warn, error, debug, info, trace.
 * @param options optional configuration file for how the logger should behave.
 * @param {boolean} options.disableCallerInfo Whether the call site of a logger
 * method invocation should be included in the log. Defaults to false, so the
 * call site will be included.
 */
function Logger(level, id, transports, options) {
    this.id = id;
    this.options = options || {};
    this.transports = transports;
    if(!this.transports) {
        this.transports = [];
    }
    this.level = levels[level];
    var methods = Object.keys(levels);
    for(var i = 0; i < methods.length; i++){
        this[methods[i]] =
            log.bind(null, this, methods[i]);
    }
}

/**
 * Sets the log level for the logger.
 * @param level the new log level.
 */
Logger.prototype.setLevel = function (level) {
    this.level = levels[level];
};
module.exports = Logger;

/**
 * Enum for the supported log levels.
 */
Logger.levels = {
    TRACE: "trace",
    DEBUG: "debug",
    INFO: "info",
    LOG: "log",
    WARN: "warn",
    ERROR: "error"
};
