var Milight = require('../lib/milight');

var milight = new Milight({
	host: "192.168.3.255",
	broadcast: true
});

var h = 0;
function v() {
	milight.zone([ 2, 3 ]).hsv(60, -1, h += 2, function(error) {
		if (error) {
			console.error(error);
			return;
		}

		setTimeout(v, 500);
	});
}
v();

setTimeout(function() {
	milight.off();
}, 500000);
