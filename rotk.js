// ROTKbot version 0.22 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var auth = require('./auth.json');
var fs = require("fs");
var botname = "ROTKbot";
// participants is an array of player objects consisting of
// name, team, status and damage %
var participants = [];
var teams = ["main", "sub", "looter"];
var date = "October 26 2018 21:00 CDT";
var raidDate = new Date(date);
var raidFile = "data/nextRaid.json";
let msg = "";
var json;
let fourGods = [ "Azure Dragon", "Vermilion Bird", "White Tiger", "Black Tortoise" ];
let levels = [ "minor", "intermediate", "advanced", "master" ];
let hp = 792900;

// Capitalize first character of the word
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.substr(1);
}

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
function updateFile(data) {
  let tmpFile = raidFile+ ".tmp";
  let json = JSON.stringify(data, null, 4)
  console.log("Updating file: " + raidFile);
  fs.writeFile(tmpFile, json, 'utf8', function(err) {
    if (err) {
      return console.err(err);
    } else {
      fs.rename(tmpFile, raidFile, function(err) {
        if (err) {
          return console.err(err);
        }
      });
    }
  });
  console.log("done");
};

// Print members of each team
function printTeam(msg, obj) {
  team = capitalize(Object.entries(obj)[0][1].team);
  msg = msg + team + " team [" + obj.length + "]: ";
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

// Print damage report and return an array with the report and total damage
function printDamage(msg, obj) {
  var total = 0.0;
  // Sort by damage in descending order
  obj.sort(function(a, b) {
    return b.damage - a.damage;
  });
  Object.keys(obj).forEach(function (key) {
    pc = obj[key].damage/hp*100;
    msg = msg + bot.users[obj[key].name].username + ": " +obj[key].damage+ " (" + pc.toFixed(2)+ "%)\n";
    total = total + parseFloat(pc);
  });
  return [ msg, total.toFixed(2) ];
}

// Send msg to the channel where command are specified
function sendDaMessage(channelID, msg) {
  bot.sendMessage({
    to: channelID,
    message: msg
  })
}

bot.on('message', function (user, userID, channelID, message, evt) {
  let sender = bot.users[userID].username;
  let validTeams = teams.map(e => capitalize(e)).join(", ");
  let notRegistered = sender + ", you are currently not registered for the raid, try `!register`";
  let invalidTeam = sender + ", you did not specify a valid team as an option, valid teams are " + validTeams + " (eg. `!register looter`)";

  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0];

     args = args.splice(1);
     switch(cmd) {
        // Raid info
        case 'raid':
          let now = new Date();
          let diff = (raidDate - now) / 3600000;
          let hours = Math.floor(diff);
          let minutes = Math.floor(diff %1 * 60);
          let timeLeft = "";
          if (hours) {
            timeLeft = hours + " hours and " + minutes;
          } else {
            timeLeft = minutes;
          }
          msg = "The next raid is scheduled for " +date+ " (server time) which is " + timeLeft+ " minutes from now";
          sendDaMessage(channelID, msg);
        break;
 
        // Register for raid
        case 'register':
           var found;
           
           if (args[0] === undefined) {
             msg = invalidTeam;
             sendDaMessage(channelID, msg);
             break;
           } else {
             found = teams.find(function(team) {
               return team == args[0].toLowerCase();
             });
           }

           // Specified team not found
           if (!found) {
             msg = invalidTeam;
           } else {
             found = participants.find(function(player) {
               return player.name == userID;
             });
             if (!found) {
               team = args[0].toLowerCase();
               var player = { "name": userID, "team": team, "status": 0, "damage": 0 };
               participants.push(player);
               updateFile(participants);
               team = capitalize(team);
               msg = sender + ", you are registered in the " +team+ " team for the next raid scheduled for " +date+ " (server time)";
             } else {
               msg = sender + ", you are already registered for the next raid scheduled for " +date+ " (server time)";
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
             updateFile(participants);
             msg = sender + ", you are unregistered from the next raid";
           } else {
             msg = notRegistered;
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
           };
           sendDaMessage(channelID, msg);
        break;

        // Check in during roll call
        case 'checkin':
          found = participants.find(function(player) {
            return player.name == userID;
          });
          if (found) {
            if (found.status) {
              found.status = 0;
              updateFile(participants);
              msg = sender + ", you are no longer checked in";
            } else {
              found.status = 1;
              updateFile(participants);
              msg = sender + ", you are checked in";
            }
          } else {
            msg = notRegistered;
          }
          sendDaMessage(channelID, msg);
        break;

        // Uncheck-in all participants (useful for running back-to-back raids)
        case 'uncheckin':
          Object.keys(participants).forEach(function(key) {
            participants[key].status = 0;
          });
          updateFile(participants);  
        break;

        // Clear damage report and reset for next run
        case 'cleardamage':
          Object.keys(participants).forEach(function(key) {
            participants[key].damage = 0;
          });
          updateFile(participants);  
        break;

        // List out available commands
        case 'commands':
          msg = "Available commands:\n";
          msg = msg + " !raid List the next scheduled raid\n"
          msg = msg + " !register Register for the next raid (options are Main, Sub or Looter)\n"
          msg = msg + " !unregister Un-register from the next raid\n"
          msg = msg + " !list List the current participants for the next raid\n"
          msg = msg + " !checkin Check-in during roll call (to un-checkin, just invoke the command again)\n"
          msg = msg + " !damage Print damage report or register damage"
          sendDaMessage(channelID, msg);
        break;

        // Print damage report or register damage
        case 'damage':
          let arr = [];
          let total = 0;
          let input = args[0];

          if (input === undefined) {
            damageObj = participants.filter(p => p.damage > 0);
            if (damageObj.length == 0) {
              msg = "Currently there are no damages recorded";
            } else {
              msg = "Damage report:\n";
              arr = printDamage(msg, damageObj);
              msg = arr[0];
              total = arr[1];
              msg = msg + "Total: " +total+ "%\n"
              if (total >= 100.0) {
                msg = msg + "Boss is dead, everybody can exit";
              } else {
                left = 100.0 - parseFloat(total);
                msg = msg + "Remaining: " +left.toFixed(2)+ "%\n";
              }
            }
            sendDaMessage(channelID, msg);
            break;
          }

          if ((isNaN(input) || parseInt(input) < 0 || parseInt(input) >= hp)) {
            msg = sender + ", you have entered an invalid number, please enter a positive number less than or equal to " + hp + " (HP of boss)";
            sendDaMessage(channelID, msg);
            break;
          }
          found = participants.find(function(player) {
            return player.name == userID;
          });
          if (found) {
            found.damage = parseInt(input);
            updateFile(participants);
            msg = sender + ", your damage has been recorded";
          } else {
            msg = notRegistered;
          }
          sendDaMessage(channelID, msg);
        break;
     }
  }
});
