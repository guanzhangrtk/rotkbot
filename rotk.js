// ROTKbot version 0.22 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var auth = require('./auth.json');
var fs = require("fs");
var botname = "ROTKbot";
// participants is an array of player objects consisting of
// name, team, status and damage
var participants = [];
var teams = ["main", "sub", "looter"];
// Next raid time is now stored in a local file
var raidDateFile = "./data/nextRaid.json"
var date = require(raidDateFile).date;
var raidDate = new Date(date);
var pFile = "./data/participants.json";
let msg = "";
var json;
let fourGods = [ "Azure Dragon", "Vermilion Bird", "White Tiger", "Black Tortoise" ];
let levels = [ "minor", "intermediate", "advanced", "master" ];
let hp = 792900;
let found;
let time = "";

// Capitalize first character of the word
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.substr(1);
}

// Update json file on disk
function updateFile(file, data) {
  let tmpFile = file+ ".tmp";
  let json = JSON.stringify(data, null, 4)
  printNowTime();
  process.stdout.write("Updating file " + file + "... ");
  fs.writeFile(tmpFile, json, 'utf8', function(err) {
    if (err) {
      return console.err(err);
    } else {
      fs.rename(tmpFile, file, function(err) {
        if (err) {
          return console.err(err);
        }
      });
    }
  });
  console.log("done");
};

// Print members of each team
function printTeam(msg, obj, evt) {
  team = capitalize(Object.entries(obj)[0][1].team);
  msg = msg + team + " team [" + obj.length + "]: ";
  let username = "";
  let serverID = evt.d.guild_id;
  let userObj;

  Object.keys(obj).forEach(function (key) {
    userObj = bot.servers[serverID].members[obj[key].name];
    // Prints server-specific nickname, if set
    if (userObj && userObj.nick != null) {
      username = bot.servers[serverID].members[obj[key].name].nick;
    } else if (bot.users[obj[key].name] == undefined) {
      username = "Unknown";
    } else {
      username = bot.users[obj[key].name].username;
    }
    if (obj[key].status) {
      username = "**" + username + "**";
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
function printDamage(msg, obj, evt) {
  let serverID = evt.d.guild_id;
  var total = 0.0;
  // Sort by damage in descending order
  obj.sort(function(a, b) {
    return b.damage - a.damage;
  });
  Object.keys(obj).forEach(function (key) {
    userObj = bot.servers[serverID].members[obj[key].name];
    // Prints server-specific nickname, if set
    if (userObj && userObj.nick != null) {
      username = bot.servers[serverID].members[obj[key].name].nick;
    } else if (bot.users[obj[key].name] == undefined) {
      username = "Unknown";
    } else {
      username = bot.users[obj[key].name].username;
    }
    pc = obj[key].damage/hp*100;
    msg = msg + username + ": " +obj[key].damage+ " (" + pc.toFixed(2)+ "%)\n";
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

// Calculate how much time until the next raid
function timeLeft() {
  let now = new Date();
  let diff = (raidDate - now) / 3600000;
  let hours = Math.floor(diff);
  let minutes = Math.floor(diff %1 * 60);
  if (hours) {
    time = hours + " hours and " + minutes;
  } else {
    time = minutes;
  }
  return time + " minutes";
}

// Print out current time for logging
function printNowTime() {
  let now = new Date();
  process.stdout.write("[" + now.toLocaleString('en-US', {hour12: false}) + "] ");
}

// Load specified file
function loadFile(file) {
  printNowTime();
  console.log("Opening file " + file);
  fs.exists(file, function(exists) {
    if (exists) {
      printNowTime();
      console.log("Reading file " + file);
      fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
          return console.error(err);
        } else {
          participants = JSON.parse(data);
        }
      })
    } else {
        printNowTime();
        console.log("File " + file + " does not exist");
    }
  })
}

// Delete specified file
function delFile(file) {
  fs.unlink(file, function(err) {
    if (err) {
      return console.error(err);
    } else {
      printNowTime();
      console.log("File " + file + " deleted");
    }
  })
}

// Init ROTKbot
printNowTime();
console.log("Initializing " + botname);
var bot = new Discord.Client({
  token: auth.token,
  autorun: true
});

bot.on('ready', function (evt) {
  printNowTime();
  console.log(botname + " [" + bot.username + "] id: " + bot.id + " ready");
});

// Load the participants file into memory
loadFile(pFile);

bot.on('message', function (user, userID, channelID, message, evt) {
  let sender = bot.users[userID].username;
  let validTeams = teams.map(e => capitalize(e)).join(", ");
  let notRegistered = sender + ", you are currently not registered for the raid, try `!register`";
  let invalidTeam = sender + ", you did not specify a valid team as an option, valid teams are " + validTeams + " (eg. `!register looter`)";

  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0].toLowerCase();

     args = args.splice(1);
     switch(cmd) {
        // Raid info
        case 'raid':
          time = timeLeft();
          if (time.charAt(0) == "-") {
            msg = "There is currently no scheduled raid, please check back again later";
          } else {
            msg = "The next raid is scheduled for " +date+ " (server time) which is " + time+ " from now";
          }
          sendDaMessage(channelID, msg);
        break;
 
        // Register for raid
        case 'register':
           // User didn't specify team 
           if (args[0] === undefined) {
             msg = invalidTeam;
             sendDaMessage(channelID, msg);
             break;
           } else {
             found = teams.find(function(team) {
               return team == args[0].toLowerCase();
             });
           }

           team = args[0].toLowerCase();

           // Specified team not found
           if (!found) {
             msg = invalidTeam;
           } else {
             found = participants.find(function(player) {
               return player.name == userID;
             });
             if (!found) {
               var player = { "name": userID, "team": team, "status": 0, "damage": 0 };
               participants.push(player);
               updateFile(pFile, participants);
               team = capitalize(team);
               msg = sender + ", you are registered in the " +team+ " team for the next raid scheduled for " +date+ " (server time)";
             } else {
               if (found.team != team) {
                 found.team = team;
                 updateFile(pFile, participants);
                 team = capitalize(team);
                 msg = sender + ", your team has been updated to the " +team+ " team for the next raid scheduled for " +date+ " (server time)";
               } else {
                 msg = sender + ", you are already registered for the next raid scheduled for " +date+ " (server time)";
               }
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
             updateFile(pFile, participants);
             msg = sender + ", you are unregistered from the next raid";
           } else {
             msg = notRegistered;
           }
           sendDaMessage(channelID, msg);
        break;

        // List raid participants
        case 'list':
           let str = "are";
           count = participants.length;
           // Check if anybody has registered
           if (count == 0) {
              msg = "Currently nobody has registered for the next raid."
           } else {
              if (count == 1) {
                str = "is"; 
              }
              msg = "There " + str + " currently " +count+ " participant(s): \n";
              teams.forEach(function(team) {
                 teamObj = participants.filter(p => p.team === team);
                 if (Object.keys(teamObj).length) {
                  msg = printTeam(msg, teamObj, evt);
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
              updateFile(pFile, participants);
              msg = sender + ", you are no longer checked in";
            } else {
              found.status = 1;
              updateFile(pFile, participants);
              msg = sender + ", you are checked in";
            }
          } else {
            msg = notRegistered;
          }
          sendDaMessage(channelID, msg);
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
              arr = printDamage(msg, damageObj, evt);
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
            updateFile(pFile, participants);
            msg = sender + ", your damage has been recorded";
          } else {
            msg = notRegistered;
          }
          sendDaMessage(channelID, msg);
        break;

        // The follow commands are meant to be used by the superuser
        // TODO restrict access

        // Uncheck-in all participants (useful for running back-to-back raids)
        case 'uncheckin':
          if (bot.users[userID].username != "GuanZhang") {
            console.log("Unauthorized command by " + bot.users[userID].username);
            break;
          }
          Object.keys(participants).forEach(function(key) {
            participants[key].status = 0;
          });
          updateFile(pFile, participants);
        break;

        // Clear damage report and reset for next run
        case 'cleardamage':
          if (bot.users[userID].username != "GuanZhang") {
            console.log("Unauthorized command by " + bot.users[userID].username);
            break;
          }
          Object.keys(participants).forEach(function(key) {
            participants[key].damage = 0;
          });
          updateFile(pFile, participants);
        break;

        // Tag folks who registered but haven't checked in yet
        case 'nag':
          msg = "";
          if (bot.users[userID].username != "GuanZhang") {
            console.log("Unauthorized command by " + bot.users[userID].username);
            break;
          }
          time = timeLeft();
          Object.keys(participants).forEach(function(key) {
            if (participants[key].status === 0) {
              msg = msg + "<@!" + participants[key].name + "> ";
            }
          });
          msg = msg + "raid will start in " +time+ " please `!checkin` now!";
          sendDaMessage(channelID, msg);
        break;

        // Delete participants.json file to reset all data
        case 'clearall':
          msg = "";
          if (bot.users[userID].username != "GuanZhang") {
            console.log("Unauthorized command by " + bot.users[userID].username);
            break;
          }
          printNowTime();
          console.log("[clearall]");
          // clear in-memory data
          participants = [];
          updateFile(pFile, participants);
          msg = "All data has been cleared";
          sendDaMessage(channelID, msg);
        break;
     }
  }
});

// Re-connect on disconnection with 6 seconds delay
bot.on("disconnect", () => setTimeout(() => bot.connect(), 6000));
