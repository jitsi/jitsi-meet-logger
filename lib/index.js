/* Copyright @ 2015 Atlassian Pty Ltd
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

/**
 * Map with the created loggers with ID.
 */
var idLoggers = {};

/**
 * Array with the loggers without id.
 */
var loggers = [];

module.exports = {
    /**
     * Creates new logger.
     * @arguments the same as Logger constructor
     */
    getLogger: function(id, transports, format) {
        var logger = new Logger(id, transports, format);
        if(id) {
            idLoggers[id] = idLoggers[id] || [];
            idLoggers[id].push(logger);
        } else {
            loggers.push(logger);
        }
        return logger;
    },
    /**
     * Changes the log level for the existing loggers.
     * @param level the new log level.
     * @param id if specified the level will be changed only for loggers with the
     * same id. Otherwise the operation will affect all loggers that don't
     * have id.
     */
    setLogLevel: function(level, id) {
        var l = id? (idLoggers[id] || []) : loggers;
        for(var i = 0; i < l.length; i++)
            l[i].level = levels[level];
    },

    levels: Logger.levels
};
