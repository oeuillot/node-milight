# Nodejs-Milight
Nodejs for Milight RGB lights 

Beware: there is no acknowledge from the milight module ! 

## Installation

    $ npm install milight

## API Usage

```javascript
var Milight = require("milight");

var milight = new Milight({
	host: "192.168.0.255",
	broadcast: true
});

// All zones on
milight.on();

// Zone 1 : red color
milight.zone(1).rgb("#FF0000");

// Zone 2 and 3: white light 50%
milight.zone([2,3]).white(50, function(error) {
  // Command sent !
});

```

##Configuration
Milight constructor accepts an optional configuration object. At the moment, the following is supported:

- `host` _String_ Hostname of milight module. Default : '255.255.255.255'
- `port` _Number_ Specifies the port of milight module. Default : 8899
- `broadcast` _Boolean_ Use broadcast udp socket. Default : 'true'
- `delayBetweenMessages` _Number_ Delay between messages in milliseconds. Default : 200ms

## Author

Olivier Oeuillot

## Contributors

https://github.com/oeuillot/node-milight/graphs/contributors
