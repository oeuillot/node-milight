/*jslint node: true, vars: true, nomen: true */
'use strict';

function Zone(milight, index) {
	this._milight = milight;

	if (isNaN(index) || index < 0 || index >= whiteZoneKeys.length) {
		throw new Error("Invalid index (" + index + ")");
	}
	this.zone = index;
}

module.exports = Zone;

var brightnessKeys = [ 0x02,
	0x03,
	0x04,
	0x05,
	0x08,
	0x09,
	0x0A,
	0x0B,
	0x0D,
	0x0E,
	0x0F,
	0x10,
	0x11,
	0x12,
	0x13,
	0x14,
	0x15,
	0x17,
	0x18,
	0x19 ];

var whiteZoneKeys = [ 0xC2, 0xC5, 0XC7, 0xC9, 0xCB ];

var nightZoneKeys = [ 0xB9, 0x3B, 0x33, 0x3A, 0x36 ];

function rgb2hsv(r, g, b) {
	r /= 100;
	g /= 100;
	b /= 100;
	var v = Math.max(r, g, b);
	var diff = v - Math.min(r, g, b);

	function diffc(c) {
		return (v - c) / 6 / diff + 1 / 2;
	}

	if (diff === 0) {
		return {
			h: 0,
			s: 0,
			v: 0
		};
	}

	var s = diff / v;
	var rr = diffc(r);
	var gg = diffc(g);
	var bb = diffc(b);
	var h;

	if (r === v) {
		h = bb - gg;
	} else if (g === v) {
		h = (1 / 3) + rr - bb;
	} else if (b === v) {
		h = (2 / 3) + gg - rr;
	}

	if (h < 0) {
		h++;
	} else if (h > 1) {
		h--;
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		v: Math.round(v * 100)
	};
}

function normalize(v, max) {
	if (isNaN(v)) {
		v = 0;
	}

	v = Math.min(Math.max(0, Math.floor(v)), max);

	return v;
}

/**
 * 
 * @param r
 *          Number between 0 and 255
 * @param g
 *          Number between 0 and 255
 * @param b
 *          Number between 0 and 255
 * @param callback
 */
Zone.prototype.rgb256 = function(r, g, b, callback) {
	if (typeof (g) === "function" || arguments.length === 1) {
		callback = g;
		if (typeof (r) === "number") {
			b = ((r & 0x00ff00) >> 8);
			g = (r & 0x0000ff);
			r = ((r & 0xff0000) >> 16);
		} else {
			b = r.b || r.blue || 0;
			g = r.g || r.green || 0;
			r = r.r || r.red || 0;
		}
	}

	function from255(v) {
		if (isNaN(v) || v < 0) {
			v = 0;
		} else if (v > 255) {
			v = 255;
		}

		v = Math.floor(v / 255 * 100);

		return v;
	}

	r = from255(r);
	g = from255(g);
	b = from255(b);

	return this.rgb100(r, g, b, callback);
};

/**
 * 
 * @param r
 *          Number between 0 and 100
 * @param g
 *          Number between 0 and 100
 * @param b
 *          Number between 0 and 100
 * @param callback
 */
Zone.prototype.rgb100 = function(r, g, b, callback) {

	r = normalize(r, 100);
	g = normalize(g, 100);
	b = normalize(b, 100);

	var hsv = rgb2hsv(r, g, b);

	this.hsv(hsv.h, hsv.s, hsv.v, callback);
};

/**
 * 
 * @param v
 *          Number between 0 and 100
 * @param callback
 */
function brightness(milight, v, callback) {
	if (v === undefined) {
		return callback();
	}

	v = normalize(v, 100);

	var bl = 0x3B; // brightnessKeys.length - 1;

	var brightnessKey = normalize(v / 100 * bl, bl);

	// var brightnessKey = brightnessKeys[brightnessIndex];

	var buffer2 = [ 0x4E, brightnessKey, 0x55 ];

	milight._send(buffer2, callback);
}

/**
 * @param {number}
 *          h - Number between 0 and 360 (not set if undefined)
 * @param {number}
 *          s - Not used
 * @param {number}
 *          v - Number between 0 and 100 (not set if undefined)
 * @param {Function}
 *          [callback]
 */
Zone.prototype.hsv = function(h, s, v, callback) {

	var milight = this._milight;
	var zone = this.zone;

	milight._sync(function(callback) {

		milight._selectZone(zone, function(error) {
			if (error) {
				return callback(error);
			}

			if (h === undefined) {
				return brightness(milight, v, callback);
			}

			h = normalize(h / 360 * 255, 255);

			var hueCommand = [ 0x40, h, 0x55 ];

			milight._send(hueCommand, function(error) {
				if (error) {
					return callback(error);
				}
				brightness(milight, v, callback);
			});
		});
	}, callback);
};

/**
 * 
 * @param {number}
 *          [brightness=100] - Number between 0 and 100
 * @param {Function}
 *          [callback]
 */
Zone.prototype.white = function(brightness, callback) {

	if (typeof (brightness) === "function") {
		callback = brightness;
		brightness = undefined;
	}

	if (isNaN(brightness)) {
		brightness = 100;
	}

	var milight = this._milight;
	var zone = this.zone;

	milight._sync(function(callback) {

		milight._selectZone(zone, function(error) {
			if (error) {
				return callback(error);
			}

			var whiteZoneKey = whiteZoneKeys[zone];

			var whiteModeCommand = [ whiteZoneKey, 0x00, 0x55 ];

			milight._send(whiteModeCommand, function(error) {
				if (error) {
					return callback(error);
				}

				brightness(milight, brightness, callback);
			});
		});
	}, callback);
};

/**
 * 
 * @param {number}
 *          brightness - Number between 0 and 100
 * @param {Function}
 *          [callback]
 */
Zone.prototype.brightness = function(brightness, callback) {

	this.hsv(undefined, undefined, brightness, callback);
};

/**
 * 
 * @param {Function}
 *          [callback]
 */
Zone.prototype.on = function(callback) {
	var milight = this._milight;
	var zone = this.zone;

	milight._sync(function(callback) {
		milight._on(zone, callback);

	}, callback);
};

/**
 * 
 * @param {Function}
 *          [callback]
 */
Zone.prototype.off = function(callback) {
	var milight = this._milight;
	var zone = this.zone;

	milight._sync(function(callback) {
		milight._off(zone, callback);

	}, callback);
};

/**
 * 
 * @param {Function}
 *          [callback]
 */
Zone.prototype.nightMode = function(callback) {

	var milight = this._milight;
	var zone = this.zone;

	milight._sync(function(callback) {

		var nightZoneKey = nightZoneKeys[zone];

		var nightModeCommand = [ nightZoneKey, 0x00, 0x55 ];

		milight._send(nightModeCommand, callback);
	}, callback);
};
