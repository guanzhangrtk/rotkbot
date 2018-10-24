// ROTKbot version 0.22 (C)opyright 2018 GuanZhang

var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
let nextRaid = [];
var msg = "";

// Logger
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
   colorize: true
});

logger.level = 'debug';

// Init ROTKbot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
   logger.info('Connected');
   logger.info('Logged in as: ');
   logger.info(bot.username + ' -  (' + bot.id + ')');
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
            nextRaid.push(userID);
            bot.sendMessage({
               to: channelID,
               message: "You are registered for the next raid scheduled for 10/23 at +21 hours"
            });
         break;

         // Unregister from raid
         case 'unregister':
            nextRaid.pop(userID);
            bot.sendMessage({
               to: channelID,
               message: "You have been unregistered from the next raid"
            });
         break;   

         // List raid participants
         case 'list':
            // Check if anybody has registered
            if (!Array.isArray(nextRaid) || !nextRaid.length) {
               msg = "Currently nobody has registered for the next raid."
            } else {
               msg = "Participants: "+nextRaid.map(u => bot.users[u].username).join(", ")
            };
            bot.sendMessage({
               to: channelID,
               message: msg
            });
         break;
      }
   }
});

