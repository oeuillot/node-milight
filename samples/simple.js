var Milight = require('../lib/milight');

var milight = new Milight({
	host: "192.168.0.255",
	broadcast: true
});

milight.on();