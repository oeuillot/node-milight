/*jslint node: true, vars: true, nomen: true */
'use strict';

var async = require('async');
var util = require('util');

var debug = require('debug')('milight:zone');

var USE_OLD_METHOD = true;

function _defaultCallback(error) {
	if (error) {
		console.error(error);
	}
}

function Zone(milight, zone) {
	this._milight = milight;

	var zones = [];
	this.zones = zones;

	if (util.isArray(zone)) {
		for (var i = 0; i < zone.length; i++) {
			var z = zone[i];
			if (isNaN(z) || z < 0 || z >= whiteZoneKeys.length) {
				continue;
			}
			zones.push(z);
		}

	} else if (!isNaN(zone) && zone >= 0 && zone < whiteZoneKeys.length) {
		zones.push(zone);
	}

	if (zones.length === 0) {
		throw new Error("Invalid zone id (" + zone + ")");
	}

	var allZone = false;

	if (zones.length > 1) {
		for (var j = 0; j < zones.length; j++) {
			if (zones[j]) {
				continue;
			}

			allZone = true;
			break;
		}

		if (zones.length === whiteZoneKeys.length - 1) {
			allZone = true;
		}
	}

	if (allZone) {
		this.zones = [ 0 ];
	}
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

// Inverse R/B for milight !!!
function rgb2hsv(b, g, r) {
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

function parseColor(c, max) {
	var reg = /([0-9]{1,3})%/;
	var res = reg.exec(c);
	if (res) {
		var p = parseInt(res[1], 10);
		if (p < 0 || p > 100) {
			return undefined;
		}
		return p / 100 * max;
	}

	var v = parseInt(c, 10);
	if (v < 0 || v > max) {
		return undefined;
	}

	return v;
}

Zone.prototype.rgb = function(expr, callback) {
	callback = callback || _defaultCallback;

	var r;
	var g;
	var b;

	if (typeof (expr) === "number") {
		r = ((expr & 0xff0000) >> 16);
		g = ((expr & 0x00ff00) >> 8);
		b = (expr & 0x0000ff);

		debug("rgb number(r=", r, "g=", g, "b=", b, ")");

		return this.rgb255(r, g, b, callback);
	}

	if (typeof (expr) === "string") {
		var reg = /^#?([A-F0-9])([A-F0-9])([A-F0-9])$/i;

		var result = reg.exec(expr);
		if (result) {
			r = parseInt(result[1], 16) * 0x11;
			g = parseInt(result[2], 16) * 0x11;
			b = parseInt(result[3], 16) * 0x11;

			debug("rgb #RGB(r=", r, "g=", g, "b=", b, ")");
			return this.rgb255(r, g, b, callback);
		}

		reg = /^#?([A-F0-9]{6})$/i;
		result = reg.exec(expr);
		if (result) {
			var n = parseInt(result[1], 16);
			debug("rgb #RRGGBB(", n, ")");
			return this.rgb(n, callback);
		}

		reg = /^r[gv]b\(([0-9]{1,3}%?),([0-9]{1,3}%?),([0-9]{1,3}%?)\)$/i;
		result = reg.exec(expr);
		if (result) {
			r = parseColor(result[1], 255);
			g = parseColor(result[2], 255);
			b = parseColor(result[3], 255);

			debug("rgb(r,g,b) (r=", r, "g=", g, "b=", b, ")");
			return this.rgb255(r, g, b, callback);
		}

		reg = /^hsv\(([0-9]{1,3}%?),([0-9]{1,3}%?),([0-9]{1,3}%?)\)$/i;
		result = reg.exec(expr);
		if (result) {
			var h = parseColor(result[1], 360);
			var s = parseColor(result[2], 100);
			var v = parseColor(result[3], 100);

			debug("hsv (h=", h, "s=", s, "v=", v, ")");
			return this.hsv(h, s, v, callback);
		}
	}

	if (typeof (expr) === "object") {
		if (typeof (expr.r) === "number" || typeof (expr.red) === "number") {

			r = expr.r || expr.red;
			g = expr.g || expr.green || 0;
			b = expr.b || expr.blue || 0;

			debug("rgb object.field(r=", r, "g=", g, "b=", b, ")");

			return this.rgb255(r, g, b, callback);
		}
	}

	var error = new Error("Invalid color code '" + expr + "'");
	return callback(error);
};

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
Zone.prototype.rgb255 = function(r, g, b, callback) {

	function from255(v) {
		if (isNaN(v) || v < 0) {
			v = 0;
		} else if (v > 255) {
			v = 255;
		}

		v = v / 255 * 100;

		return v;
	}

	r = from255(r);
	g = from255(g);
	b = from255(b);

	var hsv = rgb2hsv(r, g, b);

	this.hsv(hsv.h, hsv.s, hsv.v, callback);
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
function setBrightness(milight, v, callback) {
	if (isNaN(v)) {
		return callback();
	}

	v = normalize(v, 100);

	var brightnessKey = normalize(v / 100 * 0x3B, 0x3B);

	if (USE_OLD_METHOD) {
		var bl = brightnessKeys.length - 1;

		var brightnessIndex = normalize(v / 100 * bl, bl);

		brightnessKey = brightnessKeys[brightnessIndex];
	}

	var buffer = [ 0x4E, brightnessKey, 0x55 ];

	debug("Set brightness ", brightnessKey);

	milight._send(buffer, callback);
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
	callback = callback || _defaultCallback;

	var milight = this._milight;
	var zones = this.zones;

	if (h < 0) {
		h = undefined;
	}
	if (v < 0) {
		v = undefined;
	}

	var hh = (h !== undefined) && normalize(h / 360 * 255, 255);

	milight._sync(function(callback) {
		async.eachSeries(zones, function(zone, callback) {

			debug("hsv: Zone=", zone);

			milight._selectZone(zone, function(error) {
				if (error) {
					return callback(error);
				}

				if (h === undefined) {
					return setBrightness(milight, v, callback);
				}

				var hueCommand = [ 0x40, hh, 0x55 ];

				debug("Set Hue to ", h, " on zone ", zone);

				milight._send(hueCommand, function(error) {
					if (error) {
						return callback(error);
					}

					setBrightness(milight, v, callback);
				});
			});
		}, callback);
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

  if (callback === undefined) {
    callback = function() {};
  }

	if (isNaN(brightness)) {
		brightness = 100;
	}

	var milight = this._milight;
	var zones = this.zones;

	milight._sync(function(callback) {
		async.eachSeries(zones, function(zone, callback) {

			debug("white: Zone=", zone);

			milight._selectZone(zone, function(error) {
				if (error) {
					return callback(error);
				}

				var whiteZoneKey = whiteZoneKeys[zone];

				debug("Set White ", brightness, " on zone ", zone);

				var whiteModeCommand = [ whiteZoneKey, 0x00, 0x55 ];

				milight._send(whiteModeCommand, function(error) {
					if (error) {
						return callback(error);
					}

					setBrightness(milight, brightness, callback);
				});
			});
		}, callback);
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

	this.hsv(-1, -1, brightness, callback);
};

/**
 * 
 * @param {Function}
 *          [callback]
 */
Zone.prototype.on = function(callback) {
	callback = callback || _defaultCallback;

	var milight = this._milight;
	var zones = this.zones;

	milight._sync(function(callback) {
		async.eachSeries(zones, function(zone, callback) {

			milight._on(zone, false, callback);
		}, callback);
	}, callback);
};

/**
 * 
 * @param {Function}
 *          [callback]
 */
Zone.prototype.off = function(callback) {
	callback = callback || _defaultCallback;

	var milight = this._milight;
	var zones = this.zones;

	milight._sync(function(callback) {
		async.each(zones, function(zone, callback) {
			milight._off(zone, callback);
		}, callback);
	}, callback);
};

/**
 * 
 * @param {Function}
 *          [callback]
 */
Zone.prototype.nightMode = function(callback) {
	callback = callback || _defaultCallback;

	var milight = this._milight;
	var zones = this.zones;

	milight._sync(function(callback) {
		async.eachSeries(zones, function(zone, callback) {
			var nightZoneKey = nightZoneKeys[zone];

			var nightModeCommand = [ nightZoneKey, 0x00, 0x55 ];

			milight._send(nightModeCommand, callback);
		}, callback);
	}, callback);
};
