// ROTKbot version 0.22 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var auth = require('./auth.json');
var fs = require("fs");
var botname = "ROTKbot";
// participants is an array of player objects consisting of
// name, team and status
var participants = [];
var teams = ["main", "sub", "looter"];
var nextRaidDate = "10/25/2018"
var nextRaidTime = "+21";
var raidFile = "data/nextRaid.json";
var status;
let msg = "";

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

// Update json file on disk
function updateFile(json, file) {
  console.log("Updating file: " + raidFile);
  fs.writeFile(raidFile, json, 'utf8', function(err) {
    if (err) {
      return console.err(err);
    }
  });
  console.log("File " + raidFile + " updated successfully");
};

// Print members of each team
function printTeam(msg, obj) {
  team = Object.entries(obj)[0][1].team;
  team = team.charAt(0).toUpperCase() + team.substr(1);
  msg = msg + team + " team: ";
  Object.keys(obj).forEach(function (key) {
     if (obj[key].status) {
       username = "**" + bot.users[obj[key].name].username + "**";
     } else {
       username = bot.users[obj[key].name].username;
     }
     msg = msg + username;
     // Only add comm unless it's the last element
     if (!(obj.length - 1 == key)) {
       msg = msg + ", ";
     }
  });
  return msg + "\n";
}

// Send msg to the channel where command are specified
function sendDaMessage(channelID, msg) {
  bot.sendMessage({
    to: channelID,
    message: msg
  })
}

bot.on('message', function (user, userID, channelID, message, evt) {
  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0];

     args = args.splice(1);
     switch(cmd) {
        // Raid info
        case 'raid':
          msg = "The next raid is scheduled for " +nextRaidDate+ " at " +nextRaidTime+ " hours.";
          sendDaMessage(channelID, msg);
        break;
 
        // Register for raid
        case 'register':
           var found;
           
           if (args[0] === undefined) {
             msg = "You did not specify a team, valid teams are Main, Sub or Looter";
             sendDaMessage(channelID, msg);
             break;
           } else {
             found = teams.find(function(team) {
               return team == args[0].toLowerCase();
             });
           }

           // Specified team not found
           if (!found) {
             msg = "Invalid team " +args[0]+ ", valid teams are Main, Sub or Looters";
           } else {
             found = participants.find(function(player) {
               return player.name == userID;
             });
             if (!found) {
               team = args[0].toLowerCase();
               var player = { "name": userID, "team": team, "status": 0 };
               participants.push(player);
               var json = JSON.stringify(participants);
               updateFile(json, raidFile);
               team = team.charAt(0).toUpperCase() + team.substr(1);
               msg = "You are registered in the " +team+ " team for the next raid scheduled for "+nextRaidDate+ " at "+nextRaidTime+" hours";
             } else {
               msg = "You are already registered for the next raid scheduled for "+nextRaidDate+ " at "+nextRaidTime+" hours"     
             };
           };
           sendDaMessage(channelID, msg);
        break;

        // Unregister from raid
        case 'unregister':
           found = participants.find(function(player) {
             return player.name == userID;
           });
           if (found) {
             participants = participants.filter(u => u.name != userID);
             var json = JSON.stringify(participants);
             updateFile(json, raidFile);
             msg = "You have been unregistered from the next raid";
           } else {
             msg = "You are currently not registered for the next raid, try !register";
           }
           sendDaMessage(channelID, msg);
        break;

        // List raid participants
        case 'list':
           count = participants.length;
           // Check if anybody has registered
           if (count == 0) {
              msg = "Currently nobody has registered for the next raid."
           } else {
              msg = "There are currently " +count+ " participants: \n";
              teams.forEach(function(team) {
                 teamObj = participants.filter(p => p.team === team);
                 if (Object.keys(teamObj).length) {
                  msg = printTeam(msg, teamObj);
                 }
              });
              // +participants.map(u => bot.users[u].username).join(", ")
           };
           sendDaMessage(channelID, msg);
        break;

        // Check-in during roll call
        case 'checkin':
          found = participants.find(function(player) {
            return player.name == userID;
          });
          if (found) {
            if (found.status) {
              //msg = "You have already checked-in, nothing to do here";
              found.status = 0;
              var json = JSON.stringify(participants);
              updateFile(json, raidFile);
              msg = "You are no longer checked-in";
            } else {
              found.status = 1;
              var json = JSON.stringify(participants);
              updateFile(json, raidFile);
              msg = "You have been checked-in";
            }
          } else {
            msg = "You are currently not reigstered for the next raid, try !register";
          }
          sendDaMessage(channelID, msg);
        break;

        // Damage registration and book keeping
        case 'damage':
          msg = "Your damage has been recorded";
          sendDaMessage(channelID, msg);
        break;

        default:
          msg = "That does not compute"
          sendDaMessage(channelID, msg);
     }
  }
});
