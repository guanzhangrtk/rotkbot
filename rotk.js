// ROTKbot version 1.0.0 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var token;
// If auth.json is not found, we are probably deploying via ZEIT Now
try {
  var auth = require("./auth.json");
  token = auth.token;
} catch (err) {
  token = process.env.TOKEN;
}
var admin = require("firebase-admin");

// Fetch the service account key JSON file contents
var serviceAccount = require("./firebase_auth.json");

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://rotkbot.firebaseio.com"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = admin.database();
var ref = db.ref("restricted_access/secret_document");
var participantsRef = ref.child("participants");
var raidRef = ref.child("nextRaid");
var fs = require("fs");
var botname = "ROTKbot";
// FIXME need to use roles instead
var authorizedUsers = [ "GuanZhang#9024", "BankCodeLove#2103", "Rinth#6469", "RWal#5900" ];
// participants is an array of player objects consisting of
// name, team, status and damage
var participants = [];
var fourGods = [ "dragon", "bird" ];
var levels = [ "minor", "intermediate", "advanced", "master" ];
var nextRaid = [];
var teams = ["main", "sub", "looter"];
var nextRaidFile = "./data/nextRaid.json"
let msg = "";
var json;
// Azure Dragon boss HP
let ad_hp = { "minor": 124499,
              "intermediate": 256000,
              "advanced": 482000,
              "master": 792900
            };
// Vermillion Bird boss HP
let vb_hp = { "minor": 124899,
              "intermediate": 183879,
              "advanced": 482859,
              "master": 843390
            };
let hp = 0;
let found;
let time = "";

// Needed for ZEIT Now deployments
require('http').createServer().listen(3000)

// Capitalize first character of the word
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.substr(1);
}

// Update key on Firebase
function updateFirebase(ref, data) {
  printNowTime();
  console.log("Updating key " + ref.key + " on Firebase");
  ref.set(data);
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
  return new Promise(resolve => {
    raidRef.once('value').then(function(snapshot) {
      nextRaid = snapshot.val();
      let date = nextRaid["date"];
      let raidDate = new Date(date);
      let now = new Date();
      let diff = (raidDate - now) / 3600000;
      let hours = Math.floor(diff); 
      let minutes = Math.floor(diff %1 * 60);
      if (hours) {
        time = hours + " hours and " + minutes;
      } else { 
        time = minutes;
      }
      resolve(time + " minutes");
    });
  })
}

// Print out current time for logging
function printNowTime() {
  let now = new Date();
  process.stdout.write("[" + now.toLocaleString('en-US', {hour12: false}) + "] ");
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

// Check to see if user is authorized to use command
function isAuthorized(user, channel) {
  let username = bot.users[user].username + "#" + bot.users[user].discriminator;
  if (!authorizedUsers.includes(username)) {
    msg = bot.users[user].username + ", you are not authorized to run that command";
    sendDaMessage(channel, msg);
    return false;
  } else {
    return true;
  }
}

// Init ROTKbot
printNowTime();
console.log("Initializing " + botname);
var bot = new Discord.Client({
  token: token,
  autorun: true
});

bot.on('ready', function (evt) {
  printNowTime();
  console.log(botname + " [" + bot.username + "] id: " + bot.id + " ready");
});

var nextRaid = raidRef.once('value', function(snapshot) {
  nextRaid = {};
  if (snapshot.val()) {
    nextRaid = snapshot.val();
    var date = nextRaid["date"];
    var raidDate = new Date(date);
  } else {
    nextRaid = { "4gods": "dragon", "level": "master", "date": "" };
  }
});

bot.on('message', function (user, userID, channelID, message, evt) {
  // Webhooks don't have userIDs, so ignore them
  if (!bot.users[userID]) {
    return;
  }
  let sender = bot.users[userID].username;
  let validTeams = teams.map(e => capitalize(e)).join(", ");
  let notRegistered = sender + ", you are currently not registered for the raid, try `!register`";
  let invalidTeam = sender + ", you did not specify a valid team as an option, valid teams are " + validTeams + " (eg. `!register looter`)";


  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0].toLowerCase();
     let input = "";

     args = args.splice(1);
     switch(cmd) {
        // Raid info
        case 'raid':
          raidRef.once('value').then(function(snapshot) {
            var nextRaid = snapshot.val();
            var date = nextRaid["date"];
            var raidDate = new Date(date);
            var time;
  
            timeLeft().then(time => {
              if (time.charAt(0) == "-" || isNaN(Date.parse(raidDate))) {
                msg = "There is currently no scheduled raid, please check back again later";
              } else {
                msg = "The next raid will be **" + nextRaid["level"] + " level " + nextRaid["4gods"] + "** and is scheduled for **" +date+ " (server time)** which is **" + time+ "** from now";
              }
              sendDaMessage(channelID, msg);
            });
          });
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
               updateFirebase(participantsRef, participants);
               team = capitalize(team);
               msg = sender + ", you are registered in the " +team+ " team for the next raid scheduled for " +date+ " (server time)";
             } else {
               if (found.team != team) {
                 found.team = team;
                 updateFirebase(participantsRef, participants);
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
             updateFirebase(participantsRef, participants);
             msg = sender + ", you are unregistered from the next raid";
           } else {
             msg = notRegistered;
           }
           sendDaMessage(channelID, msg);
        break;

        // List raid participants
        case 'list':
           participantsRef.once('value').then(function(snapshot) {
             participants = snapshot.val();
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
             }
             sendDaMessage(channelID, msg);
           });
        break;

        // Check in during roll call
        case 'checkin':
          found = participants.find(function(player) {
            return player.name == userID;
          });
          if (found) {
            if (found.status) {
              found.status = 0;
              updateFirebase(participantsRef, participants);
              msg = sender + ", you are no longer checked in";
            } else {
              time = timeLeft();
              // Only allow check in an hour before scheduled time
              if (time.includes("hours")) {
                msg = sender + ", you can only check in one hour in advance";
              } else {
                found.status = 1;
                updateFirebase(participantsRef, participants);
                msg = sender + ", you are checked in";
              }
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
          // Look up boss HP depending on level
          switch(nextRaid["4gods"]) {
            case 'dragon':
              hp = ad_hp[nextRaid["level"]];
            break;

            case 'bird':
              hp = vb_hp[nextRaid["level"]];
            break;
           };

          let arr = [];
          let total = 0;
          input = args[0];

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

          if ((isNaN(input) || parseInt(input) < 0 || parseInt(input) > hp)) {
            msg = sender + ", you have entered an invalid number, please enter a positive number less than or equal to " + hp + " (HP of boss)";
            sendDaMessage(channelID, msg);
            break;
          }
          found = participants.find(function(player) {
            return player.name == userID;
          });
          if (found) {
            found.damage = parseInt(input);
            updateFirebase(participantsRef, participants);
            msg = sender + ", your damage has been recorded";
          } else {
            msg = notRegistered;
          }
          sendDaMessage(channelID, msg);
        break;

        // The follow commands are meant to be used by the superuser

        // Uncheck-in all participants (useful for running back-to-back raids)
        case 'uncheckin':
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          Object.keys(participants).forEach(function(key) {
            participants[key].status = 0;
          });
          updateFirebase(participantsRef, participants);
        break;

        // Clear damage report and reset for next run
        case 'cleardamage':
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          Object.keys(participants).forEach(function(key) {
            participants[key].damage = 0;
          });
          updateFirebase(participantsRef, participants);
        break;

        // Tag folks who registered but haven't checked in yet
        case 'nag':
          msg = "";
          if (!isAuthorized(userID, channelID)) {
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

        // Reset all data by clearing in-memory variable
        case 'clearall':
          msg = "";
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          printNowTime();
          console.log("[clearall]");
          // clear in-memory data
          participants = [];
          updateFirebase(participantsRef, participants);
          msg = "All data has been cleared";
          sendDaMessage(channelID, msg);
        break;

        // Update next raid and level
        case 'updateraid':
          let fourGod = args[0];
          let level = args[1];
          msg = "";
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          if (args.length < 2 || args.length > 2) {
            msg = "Invalid options, please specify the 4gods and level for the next raid, eg. `!updateraid dragon minor`";
          } else if (!levels.includes(level)) {
            msg = "You have specified an invalid level, valid options are " + levels.map(e => e).join(", ");
          } else if (!fourGods.includes(fourGod)) {
            msg = "You have specified an invalid 4gods, valid options are " + fourGods.map(e => e).join(", ");
          } else {
            msg = "The next raid has been set to " + level + " level " + fourGod + " raid";
            nextRaid["4gods"] = fourGod;
            nextRaid["level"] = level;
            updateFirebase(raidRef, nextRaid);
          }
          sendDaMessage(channelID, msg);
        break;

        // Update next raid time
        case 'updatetime':
          input = args.join(" ");
          msg = "";
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          if (!isNaN(Date.parse(input))) {
            raidDate = new Date(input);
            date = input;
            nextRaid["date"] = input;
            updateFirebase(raidRef, nextRaid);
            msg = "The next raid has been set to " + input;
          } else {
            msg = "Invalid date, please enter date in format `November 2 2018 20:00 CDT`";
          }
          sendDaMessage(channelID, msg);
        break;

        // Dump JSON
        case 'dump':
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          msg = "participants```" + JSON.stringify(participants, null, 4) + "```";
          msg = msg + "nextRaid```" + JSON.stringify(nextRaid, null,4) + "```";
          sendDaMessage(channelID, msg); 
        break;
     }
  }
});

// Re-connect on disconnection with 6 seconds delay
bot.on("disconnect", () => setTimeout(() => bot.connect(), 6000));
