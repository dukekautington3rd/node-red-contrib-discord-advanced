const { Client } = require('discord.js-selfbot-v13');
require('./bigint-compat');

var bots = new Map();
var getBot = function (configNode) {
  var promise = new Promise(function (resolve, reject) {
    if (!configNode || !configNode.token) {
      reject(new Error('Invalid self token configuration'));
      return;
    }

    var bot = undefined;
    if (bots.get(configNode) === undefined) {
      bot = new Client({
        checkUpdate: false
      });
      bots.set(configNode, bot);
      bot.token = configNode.token;
      bot.numReferences = (bot.numReferences || 0) + 1;
      bot.login(configNode.token)
        .then(() => {
          resolve(bot);
        })
        .catch((err) => {
          reject(err);
        });
    } else {
      bot = bots.get(configNode);
      bot.numReferences = (bot.numReferences || 0) + 1;
      resolve(bot);
    }
  });
  return promise;
};

var closeBot = function (bot) {
  bot.numReferences -= 1;
  setTimeout(function () {
    if (bot.numReferences === 0) {
      try {
        bot.destroy();
      } catch (e) {}
      for (var i of bots.entries()) {
        if (i[1] === bot) {
          bots.delete(i[0]);
        }
      }
    }
  }, 1000);
};

module.exports = {
  getBot: getBot,
  closeBot: closeBot
};
