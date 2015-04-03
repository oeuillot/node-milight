/*jslint node: true, vars: true, nomen: true */
'use strict';

var semaphore = require('semaphore');
var util = require('util');
var dgram = require('dgram');

var Zone = require('./zone');

var DEFAULT_HOST = "255.255.255.255";
var DEFAULT_PORT = 8899;

var DEFAULT_DELAY_BETWEEN_MESSAGES = 200;

var onKeys = [ 0x42, 0x45, 0x47, 0x49, 0x4B ];

var offKeys = [ 0x41, 0x46, 0x48, 0x4A, 0x4C ];

function Milight(configuration) {
	Zone.call(this, this, 0);

	configuration = configuration || {};

	this._host = configuration.host || DEFAULT_HOST;
	this._port = configuration.port || DEFAULT_PORT;
	this._broadcastMode = configuration.broadcast || (this._host === DEFAULT_HOST);
	this._delayBetweenMessages = configuration.delayBetweenMessages || DEFAULT_DELAY_BETWEEN_MESSAGES;

	this._socketSem = semaphore(1);
}

util.inherits(Milight, Zone);

module.exports = Milight;

Milight.prototype.zone = function(ids) {
	if (ids === 0) {
		return this;
	}
	return new Zone(this, ids);
};

Milight.prototype.allZones = function() {
	return this;
};

Milight.prototype._sync = function(func, callback) {
	var sem = this._socketSem;
	sem.take(function() {
		func(function(error) {

			sem.leave();

			return callback.apply(this, arguments);
		});
	});
};

Milight.prototype._send = function(array, callback) {

	var buffer = new Buffer(array);

	// console.log("Send ", buffer);

	var self = this;

	this._init(function(error, socket) {
		if (error) {
			return callback(error);
		}

		function send() {
			// console.log("Send at " + Date.now());

			socket.send(buffer, 0, buffer.length, self._port, self._host, function(error, bytes) {
				self._lastSend = Date.now();

				// console.log("Sent ", error, bytes);

				if (error) {
					if (!callback) {
						console.error(error);
						return;
					}
					return callback(error);
				}

				if (!callback) {
					return;
				}

				callback();
			});
		}

		var dt = self._lastSend + self._delayBetweenMessages - Date.now();
		if (!self._lastSend || dt < 0) {
			return send();
		}

		// console.log("Wait " + dt + "ms");
		setTimeout(function() {
			send();
		}, dt);
	});
};

Milight.prototype._init = function(callback) {
	var socket = this._socket;
	if (socket) {
		return callback(null, socket);
	}

	var self = this;
	socket = dgram.createSocket('udp4');
	socket.on("listening", function(error) {
		if (error) {
			return callback(error);
		}

		if (self._broadcastMode) {
			socket.setBroadcast(true);
		}

		self._socket = socket;

		callback(null, socket);
	});

	socket.bind();
};

Milight.prototype._selectZone = function(zoneId, callback) {

	this._on(zoneId, false, callback);
};

Milight.prototype._on = function(zoneId, force, callback) {
	if (isNaN(zoneId) || zoneId < 0 || zoneId >= onKeys.lenght) {
		return callback("_on: Invalid zoneId (" + zoneId + ")");
	}

	if (!force && this._currentZone === zoneId) {
		// console.log("Zone already specified ", zoneId);
		return callback(null);
	}

	var buffer = [ onKeys[zoneId], 0x00, 0x55 ];

	var self = this;
	this._send(buffer, function(error) {

		// console.log("ON zone " + zoneId + " terminated ", error);

		if (error) {
			return callback(error);
		}

		self._currentZone = zoneId;

		callback();
	});
};

Milight.prototype._off = function(zoneId, callback) {
	if (isNaN(zoneId) || zoneId < 0 || zoneId >= onKeys.lenght) {
		return callback("_off: Invalid zoneId (" + zoneId + ")");
	}

	var buffer = [ offKeys[zoneId], 0x00, 0x55 ];

	var self = this;
	this._send(buffer, function(error) {
		if (error) {
			return callback(error);
		}

		self._currentZone = undefined;
	});
};
