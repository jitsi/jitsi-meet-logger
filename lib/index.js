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
var Logger = require("./Logger");
var LogCollector = require("./LogCollector");

/**
 * Definition of the log method
 * @name log_method
 * @function
 * @param {...*} log_args the arguments to be logged
 */
/**
 * The logger's transport type definition.
 *
 * @typedef {object} LoggerTransport
 *
 * @property {log_method} trace method called to log on {@link Logger.levels.TRACE} logging level
 * @property {log_method} debug method called to log on {@link Logger.levels.DEBUG} logging level
 * @property {log_method} info method called to log on {@link Logger.levels.INFO} logging level
 * @property {log_method} log method called to log on {@link Logger.levels.LOG} logging level
 * @property {log_method} warn method called to log on {@link Logger.levels.WARN} logging level
 * @property {log_method} error method called to log on {@link Logger.levels.ERROR} logging level
 */

/**
 * Map with the created loggers with ID.
 */
var idLoggers = {};

/**
 * Array with the loggers without id.
 */
var loggers = [];

/**
 * Log level for the lbrary.
 */
var curLevel = Logger.levels.TRACE;


module.exports = {
    /**
     * Adds given {@link LoggerTransport} instance to the list of global
     * transports which means that it'll be used by all {@link Logger}s
     * @param {LoggerTransport} transport
     */
    addGlobalTransport: function(transport) {
        Logger.addGlobalTransport(transport);
    },
    /**
     * Removes given {@link LoggerTransport} instance from the list of global
     * transports
     * @param {LoggerTransport} transport
     */
    removeGlobalTransport: function(transport) {
        Logger.removeGlobalTransport(transport);
    },
    /**
    * Sets global options which will be used by all loggers. Changing these
    * works even after other loggers are created.
    */
    setGlobalOptions: function(options) {
        Logger.setGlobalOptions(options);
    },
    /**
     * Creates new logger.
     * @arguments the same as Logger constructor
     */
    getLogger: function(id, transports, options) {
        var logger = new Logger(curLevel, id, transports, options);
        if(id) {
            idLoggers[id] = idLoggers[id] || [];
            idLoggers[id].push(logger);
        } else {
            loggers.push(logger);
        }
        return logger;
    },
    /**
     * Creates a new Logger, without keeping track of it in the loggers list
     * @arguments the same as Logger constructor
     */
    getUntrackedLogger: function(id, transports, options) {
        return new Logger(curLevel, id, transports, options);
    },
    /**
     * Changes the log level for the existing loggers by id.
     * @param level the new log level.
     * @param id if specified the level will be changed only for loggers with the
     * same id. Otherwise the operation will affect all loggers that don't
     * have id.
     */
    setLogLevelById: function(level, id) {
        var l = id? (idLoggers[id] || []) : loggers;
        for(var i = 0; i < l.length; i++) {
            l[i].setLevel(level);
        }
    },
    /**
     * Changes the log level for all existing loggers.
     * @param level the new log level.
     */
    setLogLevel: function (level) {
        curLevel = level;
        var i = 0;
        for(; i < loggers.length; i++) {
            loggers[i].setLevel(level);
        }

        for(var id in idLoggers) {
            var l = idLoggers[id] || [];
            for(i = 0; i < l.length; i++) {
                l[i].setLevel(level);
            }
        }
    },
    /**
     * The supported log levels.
     */
    levels: Logger.levels,
    /**
     * Exports the <tt>LogCollector</tt>.
     */
    LogCollector: LogCollector
};
