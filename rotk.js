// ROTKbot version 1.0.0 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var token;
// If auth.json is not found, we are probably deploying via ZEIT Now
try {
  var auth = require("./auth.json");
  token = auth.token;
} catch (err) {
  token = process.env.BOT_TOKEN;
}
var admin = require("firebase-admin");

// Fetch the service account key JSON file contents
try {
  var serviceAccount = require("./firebase_auth.json");
} catch (err) {
  var serviceAccount = require("./firebase_auth_zeit");
}

var databaseURL = "https://rotkbot.firebaseio.com";

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: databaseURL
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = admin.database();
var botname = "ROTKbot";
// FIXME need to use roles instead
var authorizedUsers = [ "GuanZhang#9024", "BankCodeLove#2103", "Rinth#6469", "RWal#5900" ];
// participants is an array of player objects consisting of
// name, team, status and damage
var defaultRaid = { "4gods": "dragon", "level": "master", "date": "" };
var participants = [];
var fourGods = [ "dragon", "bird" ];
var levels = [ "minor", "intermediate", "advanced", "master" ];
var raid = [];
var teams = ["main", "sub", "looter"];
let msg = "";
var json;

// Four Gods boss HP
let fg_hp = {
  "dragon": { "minor": 124499,
              "intermediate": 256000,
              "advanced": 482000,
              "master": 792900
            },
  "bird": { "minor": 124899,
            "intermediate": 183879,
            "advanced": 482859,
            "master": 843390
          },
  "tiger": {
	   },
  "tortoise": {
	      }
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
  str = ref.parent + "/" + ref.key;
  str = str.replace(databaseURL + "/", "");

  printNowTime();
  console.log("Updating " + str + " on Firebase");
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
function sendDaMessage(channelID, msg, embed) {
  bot.sendMessage({
    to: channelID,
    message: msg,
    embed: embed
  })
}

// Calculate how much time until the next raid
function timeLeft(evt) {
  let serverID = evt.d.guild_id;
  var serverRef = db.ref(serverID);
  return new Promise(resolve => {
    serverRef.limitToLast(1).once('value').then(function(snapshot) {
      raid = Object.values(snapshot.val())[0]["raid"];
      let date = raid["date"];
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

bot.on('message', function (user, userID, channelID, message, evt) {
  // Webhooks don't have userIDs, so ignore them
  if (!bot.users[userID]) {
    return;
  }
  let sender = bot.users[userID].username;
  let validTeams = teams.map(e => capitalize(e)).join(", ");
  let notRegistered = sender + ", you are currently not registered for the raid, try `!register`";
  let invalidTeam = sender + ", you did not specify a valid team as an option, valid teams are " + validTeams + " (eg. `!register looter`)";
  let serverID = evt.d.guild_id;
  var serverRef = db.ref(serverID);
  var curRef;

  // Initialize key for server if it doesn't exist
//  serverRef.limitToLast(1).once('value').then(function(snapshot) {
//    if (!snapshot.value()) {
//      msg = "Initializing key for server ${serverID}"
//      updateFirebase(serverRef, {});      
//      sendDaMessage(channelID, msg);
//    }
//  });

  // Bot will listen on '!' commands
  if (message.substring(0, 1) == '!') {
     var args = message.substring(1).split(' ');
     var cmd = args[0].toLowerCase();
     let input = "";

     args = args.splice(1);
     switch(cmd) {
        // Raid info
        case 'raid':
          serverRef.limitToLast(1).once('value').then(function(snapshot) {
	    if (snapshot.val()) {
              var raid = Object.values(snapshot.val())[0]["raid"];
              if (raid) {
                var date = raid["date"];
                var raidDate = new Date(date);
                var time;

                timeLeft(evt).then(time => {
                  if (time.charAt(0) == "-" || isNaN(Date.parse(raidDate))) {
                    msg = "There is currently no scheduled raid, please check back again later";
                  } else {
                    msg = "The next raid will be **" + raid["level"] + " level " + raid["4gods"] + "** and is scheduled for **" +date+ " (server time)** which is **" + time+ "** from now";
                  }
                  sendDaMessage(channelID, msg);
	        })
	      }
            } else {
              msg = "There is currently no scheduled raid, please check back again later";
              sendDaMessage(channelID, msg);
            }
            //sendDaMessage(channelID, msg);
          });
        break;
 
        // Register for raid
        case 'register':
	   var participants;
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
             sendDaMessage(channelID, msg);
           } else {
             serverRef.limitToLast(1).once('value').then(function(snapshot) {
	       if (snapshot.val()) {
                 participants = Object.values(snapshot.val())[0]["participants"];
	         var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
	         raid = Object.values(snapshot.val())[0]["raid"];
	         if (participants) {
                   found = participants.find(function(player) {
                     return player.name == userID;
                   });
                   if (raid) {
                     var date = raid["date"];
	             // User not found, register him
                     if (!found) {
                       var player = { "name": userID, "team": team, "status": 0, "damage": 0 };
                       participants.push(player);
	               updateFirebase(curRef.child("participants"), participants);
                       team = capitalize(team);
                       msg = sender + ", you are registered in the " +team+ " team for the next raid scheduled for " +date+ " (server time)";
                       sendDaMessage(channelID, msg);
                     } else {
	              // User wants to update team
                       if (found.team != team) {
                         found.team = team;
	                 updateFirebase(curRef.child("participants"), participants);
                         team = capitalize(team);
                         msg = sender + ", your team has been updated to the " +team+ " team for the next raid scheduled for " +date+ " (server time)";
                       } else {
		         // User is already registered      
                         msg = sender + ", you are already registered for the next raid scheduled for " +date+ " (server time)";
                       }
                       sendDaMessage(channelID, msg);
                     };
	           }
	         } else {
		   // Participants key is empty on Firebase
                   var player = { "name": userID, "team": team, "status": 0, "damage": 0 };
		   participants = [];
                   participants.push(player);
	           updateFirebase(curRef.child("participants"), participants);
                   team = capitalize(team);
                   if (raid) {
                     var date = raid["date"];
                     msg = sender + ", you are registered in the " +team+ " team for the next raid scheduled for " +date+ " (server time)";
	           }
                   sendDaMessage(channelID, msg);
	         }
	       }
	     })
           };
        break;

        // Unregister from raid
        case 'unregister':
           serverRef.limitToLast(1).once('value').then(function(snapshot) {
             participants = Object.values(snapshot.val())[0]["participants"];
	     var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
             if (participants) {
	       found = participants.find(function(player) {
                 return player.name == userID;
               });
               if (found) {
                 participants = participants.filter(u => u.name != userID);
	         updateFirebase(curRef.child("participants"), participants);
                 msg = sender + ", you are unregistered from the next raid";
	       }
	     } else {
               msg = notRegistered;
             }
             sendDaMessage(channelID, msg);
	   })
        break;

        // List raid participants
        case 'list':
          var msg = null;
          serverRef.limitToLast(1).once('value').then(function(snapshot) {
            if (snapshot.val()) {
              participants = Object.values(snapshot.val())[0]["participants"];
              if (participants && participants.length > 0) {   
	        let str = "are";
                count = participants.length;
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
	    }
	    if (!msg) {
              msg = "Currently nobody has registered for the next raid."
	    }
            sendDaMessage(channelID, msg);
	  });
        break;

        // Check in during roll call
        case 'checkin':
          serverRef.limitToLast(1).once('value').then(function(snapshot) {
	    if (snapshot.val()) {
              participants = Object.values(snapshot.val())[0]["participants"];
	      var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
              if (participants) {
                found = participants.find(function(player) {
                 return player.name == userID;
                });
                if (found) {
                  if (found.status) {
                    found.status = 0;
	            updateFirebase(curRef.child("participants"), participants);
                    msg = sender + ", you are no longer checked in";
                    sendDaMessage(channelID, msg);
                  } else {
	            timeLeft(evt).then(time => {
                      // Only allow check in an hour before scheduled time
                      if (time.includes("hours")) {
                        msg = sender + ", you can only check in one hour in advance";
                        sendDaMessage(channelID, msg);
                      } else {
                        found.status = 1;
	                updateFirebase(curRef.child("participants"), participants);
                        msg = sender + ", you are checked in";
                        sendDaMessage(channelID, msg);
                      }
                    });
                  }
	        }
              }
	    } else {
              msg = notRegistered;
              sendDaMessage(channelID, msg);
            }
	  })
        break;

        // List out available commands
        case 'commands':
	  sendDaMessage(channelID, '', {
            "color": 9554529,
            "description": "**Available Commands**",
            "fields": [
              {
                "name": "!raid",
                "value": "Print info about the next scheduled raid"
              },
              {
                "name": "!register",
                "value": "Register for the next raid (options are `Main`, `Sub` or `Looter`)"
              },
              {
                "name": "!unregister",
                "value": "Un-register from the next raid"
              },
              {
                "name": "!list",
                "value": "List the current participants for the next raid"
              },
              {
                "name": "!checkin",
                "value": "Check-in during roll call (to un-checkin, just invoke the command again)"
              },
              {
                "name": "!damage",
                "value": "Print damage report or register damage"
              },
              {
                "name": "!stats",
                "value": "Print raid stats"
              },
            ]
	  });
        break;

        // Print damage report or register damage
        case 'damage':
          serverRef.limitToLast(1).once('value').then(function(snapshot) {
            var raid = Object.values(snapshot.val())[0]["raid"];
            if (raid) {
              // Look up boss HP depending on level
              switch(raid["4gods"]) {
                case 'dragon':
                  hp = fg_hp['dragon'][raid["level"]];
                break;

                case 'bird':
                  hp = fg_hp['bird'][raid["level"]];
                break;
              };

              let arr = [];
              let total = 0;
              input = args[0];

              serverRef.limitToLast(1).once('value').then(function(snapshot) {
                participants = Object.values(snapshot.val())[0]["participants"];
	        var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
                if (participants) {
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
                    return;
                  }
	      
                  if ((isNaN(input) || parseInt(input) < 0 || parseInt(input) > hp)) {
                    msg = sender + ", you have entered an invalid number, please enter a positive number less than or equal to " + hp + " (HP of boss)";
                    sendDaMessage(channelID, msg);
                    return;
                  }
                  found = participants.find(function(player) {
                    return player.name == userID;
                  });
                  if (found) {
                    found.damage = parseInt(input);
	            updateFirebase(curRef.child("participants"), participants);
                    msg = sender + ", your damage has been recorded";
                  } else {
                    msg = notRegistered;
                  }
                  sendDaMessage(channelID, msg);
                } else {
                  msg = "Currently there are no damages recorded";
                  sendDaMessage(channelID, msg);
                }
              })
	    }
	  })
        break;

        // The follow commands are meant to be used by the superuser

        // Start a new raid
        case 'newraid':
          if (!isAuthorized(userID, channelID)) {
            break;
          }

          var newRef = serverRef.push();
          serverRef.limitToLast(1).once('value').then(function(snapshot) {
            // An entry exists, make a copy
            if (snapshot.val()) {
	      var entry = Object.values(snapshot.val())[0];
	      var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
	      // Go through each player and un-checkin them and also clear damage
              curRef.child("participants").once('value').then(function(snapshot) {
                if (snapshot.val()) {
                  Object.keys(entry["participants"]).forEach(function(key) {
                    entry["participants"][key].status = 0;
                    entry["participants"][key].damage = 0;
                  });
                }
	        updateFirebase(newRef, entry);
	      })
	    // Fresh database, start from scratch
	    } else {
	      updateFirebase(newRef.child("raid"), defaultRaid);
            }
          })
	  msg = "New raid created, please set the raid info with `!updateraid`";
	  sendDaMessage(channelID, msg);
        break;

        // Uncheck-in all participants (useful for running back-to-back raids)
//        case 'uncheckin':
//          if (!isAuthorized(userID, channelID)) {
//            break;
//          }
//          participantsRef.once('value').then(function(snapshot) {
//            participants = snapshot.val();
//            Object.keys(participants).forEach(function(key) {
//              participants[key].status = 0;
//            });
//            updateFirebase(participantsRef, participants);
//          })
//        break;

        // Clear damage report and reset for next run
//        case 'cleardamage':
//          if (!isAuthorized(userID, channelID)) {
//            break;
//          } 
//          participantsRef.once('value').then(function(snapshot) {
//            participants = snapshot.val();
//            Object.keys(participants).forEach(function(key) {
//              participants[key].damage = 0;
//            });
//            updateFirebase(participantsRef, participants);
//	  })
//        break;

        // Tag folks who registered but haven't checked in yet
        case 'nag':
          msg = "";
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          timeLeft(evt).then(time => {
            serverRef.limitToLast(1).once('value').then(function(snapshot) {
              participants = Object.values(snapshot.val())[0]["participants"];
	      var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
              Object.keys(participants).forEach(function(key) {
                if (participants[key].status === 0) {
                  msg = msg + "<@!" + participants[key].name + "> ";
                }
              });
              msg = msg + "raid will start in " +time+ " please `!checkin` now!";
              sendDaMessage(channelID, msg);
            })
	  })
        break;

        // Reset all data by clearing in-memory variable
        case 'clearall':
          msg = "";
          if (!isAuthorized(userID, channelID)) {
            break;
          }
          printNowTime();
          console.log("Clearing all participants data");
          // clear in-memory data
	  serverRef.limitToLast(1).once('value').then(function(snapshot) {
	    var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
            participants = [];
            updateFirebase(curRef.child("participants"), participants);
          })
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
	    serverRef.limitToLast(1).once('value').then(function(snapshot) {
	      var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
	      updateFirebase(curRef.child("raid/4gods"), fourGod);
	      updateFirebase(curRef.child("raid/level"), level);
            })
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
	    serverRef.limitToLast(1).once('value').then(function(snapshot) {
	      var curRef = serverRef.child(Object.keys(snapshot.val())[0]);
	      updateFirebase(curRef.child("raid/date"), input);
            })
            msg = "The next raid has been set to " + input;
          } else {
            msg = "Invalid date, please enter date in format `November 2 2018 20:00 CDT`";
          }
          sendDaMessage(channelID, msg);
        break;

        // Print out stats about raids
        case 'stats':
          serverRef.once('value').then(function(snapshot) {
              var numRaids = snapshot.numChildren();
	      msg = `Total raids: ${numRaids}\n`;
	      fourGods.forEach(function (fourGod) {
		var count = 0;
	        snapshot.forEach(function (key) {
                  if (fourGod == key.val()["raid"]["4gods"]) {
		    count++;
	          }
	        })
		fourGod = capitalize(fourGod);
	        msg = msg + `${fourGod}: ${count}\n`;
	      });
              sendDaMessage(channelID, msg);
	  });
	break;
     }
  }
});

// Re-connect on disconnection with 6 seconds delay
bot.on("disconnect", () => setTimeout(() => bot.connect(), 6000));
