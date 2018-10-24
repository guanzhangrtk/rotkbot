// ROTKbot version 0.22 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var auth = require('./auth.json');
var fs = require("fs");
var botname = "ROTKbot";
var participants = [];
var teams = ["main", "sub", "looters"];
var nextRaidDate = "10/25/2018"
var nextRaidTime = "+21";
var raidFile = "data/nextRaid.json";
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
    console.log("Reading file: " + raidFile);
    fs.readFile(raidFile, 'utf8', function (err, data) {
      if (err) {
        return console.error(err);
      } else {
        participants = JSON.parse(data);
      }
    })
  } else {
      console.log("File: " + raidFile + " does not exist");
  }
});

function updateFile(json, file) {
  console.log("Updating file: " + raidFile);
  fs.writeFile(raidFile, json, 'utf8', function(err) {
    if (err) {
      return console.err(err);
    }
  });
  console.log("File " + raidFile + " updated successfully");
};

bot.on('message', function (user, userID, channelID, message, evt) {
  var msg = "";
  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0];
     var msg = "";

     args = args.splice(1);
     switch(cmd) {
        // Raid info
        case 'raid':
          msg = "The next raid is scheduled for " +nextRaidDate+ " at " +nextRaidTime+ " hours.";
        break;
 
        // Register for raid
        case 'register':
           var found;
           
           if (args[0] === undefined) {
             msg = "You did not specify a team, valid teams are Main, Sub or Looters";
             break;
           } else {
             found = teams.find(function(team) {
               return team == args[0];
             });
           }

           // Specified team not found
           if (!found) {
             msg = "Invalid team: " +args[0]+ ", valid teams are Main, Sub or Looters";
           } else {
             found = participants.find(function(name) {
               return name == userID;
             });
             if (!found) {
               participants.push(userID);
               var json = JSON.stringify(participants);
               updateFile(json, raidFile);
               msg = "You are registered for the next raid scheduled for "+nextRaidDate+ " at "+nextRaidTime+" hours";
             } else {
               msg = "You are already registered for the next raid scheduled for "+nextRaidDate+ " at "+nextRaidTime+" hours"     
             };
           };
        break;

        // Unregister from raid
        case 'unregister':
           participants = participants.filter(u => u != userID);
           var json = JSON.stringify(participants);
           updateFile(json, raidFile);
           msg = "You have been unregistered from the next raid"
        break;   

        // List raid participants
        case 'list':
           // Check if anybody has registered
           if (!Array.isArray(participants) || !participants.length) {
              msg = "Currently nobody has registered for the next raid."
           } else {
              msg = participants.length+ " participants: "+participants.map(u => bot.users[u].username).join(", ")
           };
        break;

     }

     bot.sendMessage({
       to: channelID,
       message: msg
     });
  }
});
