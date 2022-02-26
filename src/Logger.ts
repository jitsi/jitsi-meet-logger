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

export type log_method = ( ...args: Array<unknown> ) => void;

export type LoggerTransport = {

    /**
     * method called to log on {@link Logger.levels.TRACE } logging level
     */
    trace: log_method;

    /**
     * method called to log on {@link Logger.levels.DEBUG } logging level
     */
    debug: log_method;

    /**
     * method called to log on {@link Logger.levels.INFO } logging level
     */
    info: log_method;

    /**
     * method called to log on {@link Logger.levels.LOG } logging level
     */
    log: log_method;

    /**
     * method called to log on {@link Logger.levels.WARN } logging level
     */
    warn: log_method;

    /**
     * method called to log on {@link Logger.levels.ERROR } logging level
     */
    error: log_method;
};

type CallerInfo = {
    methodName: string,
    fileLocation: string,
    line: unknown,
    column: unknown
};

export type Options = {
    disableCallerInfo?: boolean;
};

/**
 * Ordered log levels.
 */
const levels = {
    trace: 0,
    debug: 1,
    info: 2,
    log: 3,
    warn: 4,
    error: 5
};

export enum LevelConstants {
    TRACE = 'trace',
    DEBUG = 'debug',
    INFO = 'info',
    LOG = 'log',
    WARN = 'warn',
    ERROR = 'error'
}

/**
 * Logger
 */
export class Logger {
    /**
     * Enum for the supported log levels.
     */
    static readonly levels = LevelConstants;

    /**
     * The default transport - console
     */
    static consoleTransport: LoggerTransport = console; // TODO: should this be private?

    /**
     * The array which stores currently registered global transports.
     */
    static _globalTransports: Array<LoggerTransport> = [ Logger.consoleTransport ];

    /**
     * The global configuration options.
     */
    static _globalOptions: Options = {};

    /**
     * Removes given {@link LoggerTransport} instance from the list of global
     * transports
     * @param transport
     */
    static removeGlobalTransport = ( transport: LoggerTransport ) => {
        const transportIdx = Logger._globalTransports.indexOf( transport );
        if ( transportIdx !== -1 ) {
            Logger._globalTransports.splice( transportIdx, 1 );
        }
    };

    /**
     * Adds given {@link LoggerTransport} instance to the list of global
     * transports which means that it'll be used by all {@link Logger}s
     * @param transport
     */
    static addGlobalTransport = ( transport: LoggerTransport ) => {
        if ( Logger._globalTransports.indexOf( transport ) === -1 ) {
            Logger._globalTransports.push( transport );
        }
    };

    /**
     * Sets global options which will be used by all loggers. Changing these works
     * even after other loggers are created.
     */
    static setGlobalOptions = ( options: Options ) => {
        Logger._globalOptions = options || {};
    };

    /**
     * Parses Error's object stack trace and extracts information about the last
     * caller before the log method was called.
     * @returns JS object with info about the caller - method name, file location,
     * line and column.
     */
    // TODO: should this be private?
    static getCallerInfo = (): CallerInfo => {
        const callerInfo: CallerInfo = {
            methodName: '',
            fileLocation: '',
            line: null,
            column: null
        };

        // gets the part of the stack without the logger wrappers
        const error = new Error();
        const stack = error.stack ? error.stack.split( '\n' ) : [];
        if ( !stack || stack.length < 3 ) {
            return callerInfo;
        }
        let m = null;
        if ( stack[ 3 ] ) {
            m = stack[ 3 ].match( /\s*at\s*(.+?)\s*\((\S*)\s*:(\d*)\s*:(\d*)\)/ );
        }
        if ( !m || m.length <= 4 ) {
            // Firefox && Safari
            if ( stack[ 2 ].indexOf( 'log@' ) === 0 ) {
                // Safari
                callerInfo.methodName = stack[ 3 ].substr( 0, stack[ 3 ].indexOf( '@' ) );
            } else {
                // Firefox
                callerInfo.methodName = stack[ 2 ].substr( 0, stack[ 2 ].indexOf( '@' ) );
            }
            return callerInfo;
        }

        callerInfo.methodName = m[ 1 ];
        callerInfo.fileLocation = m[ 2 ];
        callerInfo.line = m[ 3 ];
        callerInfo.column = m[ 4 ];
        return callerInfo;
    };

    /**
    * Logs messages using the transports and level from the logger.
    * @param logger a logger instance.
    * @param level the log level of the message. See the levels variable.
    * @param arguments array with arguments that will be logged.
    */
    static __log() {
        const logger = arguments[ 0 ];
        const level = arguments[ 1 ];
        const args = Array.prototype.slice.call( arguments, 2 );
        if ( levels[ level ] < logger.level ) {
            return;
        }

        const callerInfo
            = !( logger.options.disableCallerInfo || Logger._globalOptions.disableCallerInfo ) &&
            Logger.getCallerInfo();
        const transports = Logger._globalTransports.concat( logger.transports );
        for ( let i = 0; i < transports.length; i++ ) {
            const t = transports[ i ];
            const l = t[ level ];
            if ( l && typeof l === 'function' ) {
                const logPrefixes = [];

                logPrefixes.push( new Date().toISOString() );

                if ( logger.id ) {
                    logPrefixes.push( `[${ logger.id }]` );
                }

                if ( callerInfo && callerInfo.methodName.length > 1 ) {
                    logPrefixes.push( `<${ callerInfo.methodName }>: ` );
                }

                const fullLogParts = logPrefixes.concat( args );

                l.bind( t ).apply( t, fullLogParts );
            }
        }
    }

    // TODO: should these be private?
    id?: string;
    options?: Options;
    transports?: Array<LoggerTransport>;
    level: number;

    /**
     *
     * Constructs new logger object.
     * @param level the logging level for the new logger
     * @param id optional identifier for the logger instance.
     * @param transports optional list of handlers(objects) for
     * the logs. The handlers must support - log, warn, error, debug, info, trace.
     * @param options optional configuration file for how the logger should behave.
     * method invocation should be included in the log. Defaults to false, so the
     * call site will be included.
     */
    constructor( level: keyof typeof levels, id?: string, transports?: Array<LoggerTransport>, options?: Options ) {
        this.id = id;
        this.options = options || {};
        this.transports = transports || [];
        this.level = levels[ level ];

        const methods = Object.keys( levels );

        for ( let i = 0; i < methods.length; i++ ) {
            this[ methods[ i ] ] = Logger.__log.bind( null, this, methods[ i ] );
        }
    }

    /**
     * Sets the log level for the logger.
     * @param level the new log level.
     */
    setLevel = ( level: keyof typeof levels ) => {
        this.level = levels[ level ];
    };
}
