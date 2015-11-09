# Jitsi Meet Logger

**Jitsi Meet Logger** is utility library for logging used in **Jitsi Meet** project. It doesn't have any dependancies or any specific **Jitsi Meet** code.

**Getting Started**

* In order to be able to log you should first create a Logger instance:
```
var Logger = require("jitsi-meet-logger");
var logger = Logger.getLogger();
```

* This instance is wrapper for the ```console``` object. We support the following logging methods which at the end will execute the same method from the ```console``` object:
    * trace
    * debug
    * info
    * log
    * warn
    * error

```
    logger.log(1, "2", {"3": 4}, [5, 6, 7]);
```

* You can set the log level for all Logger instances. That way you can prevent the log messages with lower log level to be displayed.  
```
logger.setLogLevel(Logger.levels.INFO);
```  

This is the list of supported log levels(ordered):  
  1. TRACE
  2. DEBUG
  3. INFO
  4. LOG
  5. WARN
  6. ERROR

For example if the log level is set to ```Logger.levels.INFO``` only messages with the following log levels are going to be displayed - info, log, warn and error.
