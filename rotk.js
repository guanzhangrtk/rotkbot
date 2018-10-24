// ROTKbot version 0.22 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var auth = require('./auth.json');
var fs = require("fs");
let botname = "ROTKbot";
let participants = [];
let nextRaidDate = "10/25/2018"
let nextRaidTime = "+21";
let raidFile = "data/nextRaid.json";
var msg = "";

// Init ROTKbot
console.log("Initializing " + botname);
var bot = new Discord.Client({
  token: auth.token,
  autorun: true
});

bot.on('ready', function (evt) {
  console.log(botname + " [" + bot.username + "] id: " + bot.id + " ready");
});

// Load nextRaid.json file
console.log("Opening file: " + raidFile);
fs.exists(raidFile, function(exists) {
  if (exists) { 
    fs.readFile(raidFile, function (err, data) {
      if (err) {
        return console.error(err);
      }
      console.log("Reading file: " + raidFile);
     })
  } else {
      console.log("File: " + raidFile + " does not exist");
  }
});

bot.on('message', function (user, userID, channelID, message, evt) {
  var msg = "";
  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0];

     args = args.splice(1);
     switch(cmd) {
        // Register for raid
        case 'register':
           var found = participants.find(function(name) {
             return name == userID;
           });
           if (!found) {
             participants.push(userID);
             msg = "You are registered for the next raid scheduled for "+nextRaidDate+ " at "+nextRaidTime+" hours";
           } else {
             msg = "You are already registered for the next raid scheduled for "+nextRaidDate+ " at "+nextRaidTime+" hours"     
           };
           bot.sendMessage({
             to: channelID,
              message: msg
           });
        break;

        // Unregister from raid
        case 'unregister':
           participants = participants.filter(u => u != userID);
           bot.sendMessage({
              to: channelID,
              message: "You have been unregistered from the next raid"
           });
        break;   

        // List raid participants
        case 'list':
           // Check if anybody has registered
           if (!Array.isArray(participants) || !participants.length) {
              msg = "Currently nobody has registered for the next raid."
           } else {
              msg = "Participants: "+participants.map(u => bot.users[u].username).join(", ")
           };
           bot.sendMessage({
              to: channelID,
              message: msg
           });
        break;
     }
  }
});
