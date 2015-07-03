var Milight = require('../lib/milight');

var milight = new Milight({
	host: "192.168.3.255",
	broadcast: true
});

milight.on();