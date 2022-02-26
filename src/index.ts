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
import { LogCollector } from './LogCollector';
import { Logger, LoggerTransport, Options, log_method, LevelConstants } from './Logger';

/**
 * Map with the created loggers with ID.
 */
const idLoggers: { [ key: string ]: Array<Logger> } = {};

/**
 * Array with the loggers without id.
 */
const loggers: Array<Logger> = [];

/**
 * Log level for the library.
 */
let curLevel: LevelConstants = Logger.levels.TRACE;

/**
 * Adds given {@link LoggerTransport} instance to the list of global
 * transports which means that it'll be used by all {@link Logger}s
 */
export const addGlobalTransport = ( transport: LoggerTransport ) => Logger.addGlobalTransport( transport );

/**
 * Removes given {@link LoggerTransport} instance from the list of global
 * transports
 */
export const removeGlobalTransport = ( transport: LoggerTransport ) => Logger.removeGlobalTransport( transport );

/**
* Sets global options which will be used by all loggers. Changing these
* works even after other loggers are created.
*/
export const setGlobalOptions = ( options: Options ) => Logger.setGlobalOptions( options );

/**
 * Creates new logger.
 * @arguments the same as Logger constructor
 */
export const getLogger = ( id?: string, transports?: Array<LoggerTransport>, options?: Options ) => {
    const logger = new Logger( curLevel, id, transports, options );

    if ( id ) {
        idLoggers[ id ] = idLoggers[ id ] || [];
        idLoggers[ id ].push( logger );
    } else {
        loggers.push( logger );
    }

    return logger;
};

/**
 * Creates a new Logger, without keeping track of it in the loggers list
 */
export const getUntrackedLogger = ( id?: string, transports?: Array<LoggerTransport>, options?: Options ): Logger =>
    new Logger( curLevel, id, transports, options );

/**
 * Changes the log level for the existing loggers by id.
 * @param level the new log level.
 * @param id if specified the level will be changed only for loggers with the
 * same id. Otherwise the operation will affect all loggers that don't
 * have id.
 */
export const setLogLevelById = ( level: LevelConstants, id?: string ) => {
    const l = id ? ( idLoggers[ id ] || [] ) : loggers;
    for ( let i = 0; i < l.length; i++ ) {
        l[ i ].setLevel( level );
    }
};

/**
 * Changes the log level for all existing loggers.
 * @param level the new log level.
 */
export const setLogLevel = ( level: LevelConstants ) => {
    curLevel = level;
    for ( const l of loggers ) {
        l.setLevel( level );
    }

    for ( const id of Object.keys( idLoggers ) ) {
        const loggers = idLoggers[ id ];
        for ( const l of loggers ) {
            l.setLevel( level );
        }
    }
};

/**
 * The supported log levels.
 */
export const levels = Logger.levels;

/**
 * Exports the <tt>LogCollector</tt>.
 */
export { LogCollector, LoggerTransport, log_method };
