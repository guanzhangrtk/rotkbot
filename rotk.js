// ROTKbot version 0.22 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var auth = require('./auth.json');
let participants = [];
let nextRaidDate = "10/25/2018"
let nextRaidTime = "+21";
var msg = "";

// Init ROTKbot
var bot = new Discord.Client({
  token: auth.token,
  autorun: true
});

bot.on('ready', function (evt) {
  console.log("[" + bot.username + "] id: " + bot.id);
});

bot.on('message', function (user, userID, channelID, message, evt) {
  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0];

     args = args.splice(1);
     switch(cmd) {
        // Register for raid
        case 'register':
           participants.push(userID);
           bot.sendMessage({
              to: channelID,
              message: "You are registered for the next raid scheduled for "+nextRaidDate+ " at "+nextRaidTime+" hours"
           });
        break;

        // Unregister from raid
        case 'unregister':
           participants.pop(userID);
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
