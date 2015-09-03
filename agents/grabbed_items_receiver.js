/*jshint node: true, strict: false, devel: true, debug: true, undef:true, loopfunc:true */

/*
 ***********  WARNING *************
 * Works only on node <0.12
 * see https://github.com/ranm8/requestify/issues/25
 *
 * nvm (think rvm for node.js) will save your life
 * https://github.com/creationix/nvm
 ***********  WARNING *************
 */

var argv = require('optimist')
  .usage('Usage:\n\t$0 database')
  .demand(1)
  .argv;

var runId = argv._[0];
var DATABASE = 'solar2015-'+runId;

var jQuery = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');
Backbone.$ = jQuery;
var btoa = require('btoa');
var mqtt = require('mqtt');
var url = require('url');

// var mongo = require('mongodb');

var Drowsy = require('backbone.drowsy.encorelab').Drowsy;
var Wakeful = require('backbone.drowsy.encorelab/wakeful').Wakeful;

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('../config.json'));

console.log("config.json loaded: ", config);

// Adding BasicAuth to the XHR header in order to authenticate with drowsy database
// this is not really big security but a start
var basicAuthHash = btoa(config.drowsy.username + ':' + config.drowsy.password);
Backbone.$.ajaxSetup({
  beforeSend: function(xhr) {
    return xhr.setRequestHeader('Authorization',
        // 'Basic ' + btoa(username + ':' + password));
        'Basic ' + basicAuthHash);
  }
});

var Skeletor = {};
Skeletor.Model = require('../shared/js/model.js').Skeletor.Model;


// danger! monkeypatch!
String.prototype.toCamelCase = function(){
  return this.replace(/([\-_][a-z]|^[a-z])/g, function($1){return $1.toUpperCase().replace(/[\-_]/,'');});
};

/*******************************/

// changes to these collections will be logged
var COLLECTIONS = [
  'grabbed_poster_items'
];

var LOG_TO_COLLECTION = 'events';

// var mongoClient = new mongo.Db(DATABASE, new mongo.Server('localhost', 27017, {}), {w:0});
// var log;
// // TODO: wait for open
// // TOOD: deal with possible error
// // TODO: maybe just switch to mongojs or some other mongo abstraction lib?
// mongoClient.open(function (err) {
//   mongoClient.collection(LOG_TO_COLLECTION, function (err, collection) {
//     log = collection;
//     console.log("Logging to collection '"+LOG_TO_COLLECTION+"'...");
//   });
// });

setupModel();
console.log("Agent is agenting!");


function setupModel() {
  console.log("Starting to initialize model ...");
  Skeletor.Model.init(config.drowsy.url, DATABASE)
  // .then(function() {
  //   console.log('Model initialized - now waking up');
  //   return Skeletor.Model.wake(config.wakeful.url);
  // })
  .done(function () {
    // create collection of grabbed poster item models
    var grabbedPosterItems = new Skeletor.Model.GrabbedPosterItems();

    console.log("... model initialized!");

    var urlObj = url.parse(config.mqtt.protocol+config.mqtt.url+':'+config.mqtt.port);
    console.log("Trying to connect to mqtt server with URL: "+url.format(urlObj));
    // connect to mqtt server
    // var client = mqtt.connect(urlObj);
    // var client = mqtt.connect('mqtt://'+config.mqtt.url);
    // var url = config.mqtt.protocol + config.mqtt.url + ":" + config.mqtt.port;
    var client = mqtt.connect(urlObj, {clientId : 'bot_to_solar2015-'+runId});

    // once connected
    client.on('connect', function () {
      // say hello
      console.log("connected to MQTT");
      // client.publish('IAMPOSTEROUT', JSON.stringify({'say hello': 'The mqtt bot for solar2015-'+runId+' just came online :)'}));
      // start listening for messages from the poster client in channel IAMPOSTEROUT
      client.subscribe('IAMPOSTEROUT', function() {
        // when a message arrives, do something with it
        client.on('message', function (topic, message, packet) {
          console.log("Received '" + message + "' on '" + topic + "'");
          try {
            // parse message to JSON object - might throw error
            var m = JSON.parse(message);
            // check if the message has the right action and is intended for our run
            if (m.action === 'process_grabbed_poster_item' && m.class_name === runId) {
              // create Backbone object and save it
              var gpi = new Skeletor.Model.GrabbedPosterItem(m);
              // set flag to indicate the item was not yet processed into tile
              gpi.set('processed_to_tile', false);
              gpi.save().done(function () {
                console.log('Messages successfully saved to database with id: '+gpi.id);
                grabbedPosterItems.add(gpi);
              });
            } else {
              console.log("Message has wrong action <"+m.action+"> or was for another run <"+runId+">");
            }
          } catch (e) {
            console.warn("Error parsing message body: "+e);
          }
        });
      });
    });

    // client.on('message', function (topic, message) {
    //   // message is Buffer
    //   console.log(message.toString());
    //   client.end();
    // });

  });
}