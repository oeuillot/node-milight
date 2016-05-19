var Milight = require('../lib/milight');

var milight = new Milight({
	host: "192.168.0.255",
	broadcast: true
});

// Switch ON all zones
milight.allZone().on().then(() => {
  // Zone1 => RED
  return milight.zone(1).rgb(0xFF0000);
  
}, (error) => {
  console.error("Can not switch on !", error);
  
}).then(() => {
  return new Promise((resolve, reject) => {
    // Zone2 => Green
    milight.zone(2).rgb(0x00FF00);
    
    // Call resolve after 10 seconds
    setTimeout(resolve, 1000*10);
  }
}).then(() => {
  // Switch OFF all zones
  milight.off();
});
