/*jslint node: true, vars: true, nomen: true, esversion:6 */
'use strict';

var semaphore = require('semaphore');
var util = require('util');
var dgram = require('dgram');
var debug = require('debug')('milight');

var Zone = require('./zone');

var DEFAULT_HOST = "255.255.255.255";
var DEFAULT_PORT = 8899;

var DEFAULT_DELAY_BETWEEN_MESSAGES = 200;

var onKeys = [ 0x42, 0x45, 0x47, 0x49, 0x4B ];

var offKeys = [ 0x41, 0x46, 0x48, 0x4A, 0x4C ];

class Milight extends Zone {
  constructor(configuration) {
    super(null, 0);
    this._milight = this;

    configuration = configuration || {};

    this._host = configuration.host || DEFAULT_HOST;
    this._port = configuration.port || DEFAULT_PORT;
    this._broadcastMode = configuration.broadcast || (this._host === DEFAULT_HOST);
    this._delayBetweenMessages = configuration.delayBetweenMessages || DEFAULT_DELAY_BETWEEN_MESSAGES;

    this._socketSem = semaphore(1);
  }

  /**
   * @returns {Zone} A Zone object associated to the specified zone.
   */
  zone(ids) {
    if (ids === 0) {
      return this;
    }
    return new Zone(this, ids);
  }

  /**
   * @returns {Zone} A Zone object associated to all zones.
   */
  allZones() {
    return this;
  }

  /**
   * @private
   */
  _sync(func, callback) {
    var sem = this._socketSem;
    sem.take(function() {
      func(function(error) {

        sem.leave();

        return callback.apply(this, arguments);
      });
    });
  }

  /**
   * @private
   */
  _send(array, callback) {

    if (typeof (callback) !== "function") {
      throw new Error("Illegal callback argument '" + callback + "'");
    }

    var buffer = new Buffer(array);

    debug("_send", "buffer=", buffer);

    this._init((error, socket) => {
      if (error) {
        return callback(error);
      }

      var send = () => {
        var now=Date.now();
        debug("_send", "now=", now);

        var dt = this._lastSend + this._delayBetweenMessages - now;
        if (this._lastSend && dt > 0) {
          debug("_send", "Wait", dt, "ms");

          setTimeout(send, dt);
          return;
        }

        this._lastSend = now;
        
        socket.send(buffer, 0, buffer.length, this._port, this._host, (error, bytes) => {
          this._lastSend = Date.now();

          debug("_send", "Sent at", this._lastSend , "error=", error, "bytes=", bytes);

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

      send();
    });
  }

  /**
   * @private
   */
  _init(callback) {
    var socket = this._socket;
    if (socket) {
      return callback(null, socket);
    }

    socket = dgram.createSocket('udp4');
    socket.on("listening", (error) => {
      if (error) {
        return callback(error);
      }

      if (this._broadcastMode) {
        socket.setBroadcast(true);
      }

      this._socket = socket;

      callback(null, socket);
    });

    socket.bind();
  }

  /**
   * @private
   */
  _selectZone(zoneId, callback) {

    this._on(zoneId, false, callback);
  }

  /**
   * @private
   */
  _on(zoneId, force, callback) {

    if (typeof (callback) !== "function") {
      throw new Error("Illegal callback argument '" + callback + "'");
    }

    if (isNaN(zoneId) || zoneId < 0 || zoneId >= onKeys.lenght) {
      var error = new Error("_on: Invalid zoneId (" + zoneId + ")");
      return callback(error);
    }

    if (!force && this._currentZone === zoneId) {
      debug("_on", "Zone already specified zoneId=", zoneId);
      return callback(null);
    }

    var buffer = [ onKeys[zoneId], 0x00, 0x55 ];

    this._send(buffer, (error) => {

      debug("_on", "ON zone", zoneId, "terminated ", error);

      if (error) {
        return callback(error);
      }

      this._currentZone = zoneId;

      callback();
    });
  }

  /**
   * @private
   */
  _off(zoneId, callback) {
    if (isNaN(zoneId) || zoneId < 0 || zoneId >= onKeys.lenght) {
      var error = new Error("_off: Invalid zoneId (" + zoneId + ")");

      return callback(error);
    }

    var buffer = [ offKeys[zoneId], 0x00, 0x55 ];

    this._send(buffer, (error) => {
      if (error) {
        return callback(error);
      }

      this._currentZone = undefined;

      callback();
    });
  }
}

module.exports = Milight;
