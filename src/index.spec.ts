import * as exported from './index';
import { Logger, LoggerTransport, Options } from './Logger';

describe( 'index tests', () => {
  const getGlobalTransports = (): Array<LoggerTransport> => ( Logger as any )._globalTransports;
  const getGlobalOptions = (): Options => ( Logger as any )._globalOptions;

  const resetGlobalTransports = () => {
    while ( getGlobalTransports().length > 0 ) {
      exported.removeGlobalTransport( getGlobalTransports()[ 0 ] );
    }
    exported.addGlobalTransport( console );
  };

  const resetGlobalOptions = () => {
    exported.setGlobalOptions( null );
  }

  beforeEach( resetGlobalOptions );
  beforeEach( resetGlobalTransports );

  it( 'levels exist', () => {
    expect( exported.levels ).toBeDefined();
    expect( exported.levels.TRACE ).toBe( "trace" );
    expect( exported.levels.DEBUG ).toBe( "debug" );
    expect( exported.levels.INFO ).toBe( "info" );
    expect( exported.levels.LOG ).toBe( "log" );
    expect( exported.levels.WARN ).toBe( "warn" );
    expect( exported.levels.ERROR ).toBe( "error" );
  } );

  it( 'functions exist', () => {
    expect( typeof exported.addGlobalTransport ).toBe( 'function' );
    expect( typeof exported.removeGlobalTransport ).toBe( 'function' );
    expect( typeof exported.setGlobalOptions ).toBe( 'function' );
    expect( typeof exported.getLogger ).toBe( 'function' );
    expect( typeof exported.getUntrackedLogger ).toBe( 'function' );
    expect( typeof exported.setLogLevelById ).toBe( 'function' );
    expect( typeof exported.setLogLevel ).toBe( 'function' );
  } );

  it( 'global loggers are initialized', () => {
    expect( typeof getGlobalTransports() ).toBe( 'object' );
    expect( getGlobalTransports().length ).toBe( 1 );
    expect( getGlobalTransports()[ 0 ] ).toBe( console );
  } );

  it( 'can remove console logger', () => {
    expect( getGlobalTransports().length ).toBe( 1 );
    exported.removeGlobalTransport( console );
    expect( getGlobalTransports().length ).toBe( 0 );
  } );

  it( 'adding a duplicate console logger does nothing', () => {
    expect( getGlobalTransports().length ).toBe( 1 );
    exported.addGlobalTransport( console );
    expect( getGlobalTransports().length ).toBe( 1 );
  } );

  it( 'options is initialized', () => {
    expect( getGlobalOptions() ).toBeDefined();
    expect( typeof getGlobalOptions() ).toBe( 'object' );
    expect( getGlobalOptions().disableCallerInfo ).toBeUndefined();
  } );

  it( 'can set options', () => {
    exported.setGlobalOptions( { disableCallerInfo: true } );
    expect( getGlobalOptions() ).toBeDefined();
    expect( getGlobalOptions().disableCallerInfo ).toBe( true );
  } );

  it( 'can set options to null which results in no change', () => {
    exported.setGlobalOptions( { disableCallerInfo: true } );
    expect( getGlobalOptions() ).toBeDefined();
    expect( getGlobalOptions().disableCallerInfo ).toBe( true );

    exported.setGlobalOptions( null );
    expect( getGlobalOptions() ).toBeDefined();
    expect( getGlobalOptions().disableCallerInfo ).toBeUndefined();
  } );

  it( 'can set options to empty object which replaces existing', () => {
    exported.setGlobalOptions( { disableCallerInfo: true } );
    expect( getGlobalOptions() ).toBeDefined();
    expect( getGlobalOptions().disableCallerInfo ).toBe( true );

    exported.setGlobalOptions( {} );
    expect( getGlobalOptions() ).toBeDefined();
    expect( getGlobalOptions().disableCallerInfo ).toBeUndefined();
  } );

  it( 'can create new logger', () => {
    const logger = new Logger( Logger.levels.WARN);
    expect( logger.level ).toBe( 4 );
  } );
} );