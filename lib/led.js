'use strict';
const child_process = require('child_process');

var triggerPath = "/sys/class/leds/blue:heartbeat/trigger";
var brightnessPath = "/sys/class/leds/blue:heartbeat/brightness";

class Led{

    static on(){
        child_process.execSync('echo torch > '+triggerPath);
        child_process.execSync('echo 255 > '+brightnessPath);
    }

    static off(){
        child_process.execSync('echo none > '+triggerPath);
        child_process.execSync('echo 0 > '+brightnessPath);
    }

    static heartbeat(){
        child_process.execSync('echo heartbeat > '+triggerPath);
    }

}


module.exports = Led;
