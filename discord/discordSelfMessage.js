const Flatted = require('flatted');
module.exports = function (RED) {
  var discordSelfBotManager = require('./lib/discordSelfBotManager.js');

  function discordSelfMessage(config) {
    RED.nodes.createNode(this, config);
    var configNode = RED.nodes.getNode(config.token);
    var channelFilterList = cleanChannelFilterList(config.channelIdFilter);
    var node = this;
    discordSelfBotManager.getBot(configNode).then(function (bot) {
      var callbacks = [];
      node.status({
        fill: "green",
        shape: "dot",
        text: "ready"
      });

      var registerCallback = function (eventName, listener) {
        callbacks.push({
          'eventName': eventName,
          'listener': listener
        });
        bot.on(eventName, listener);
      };

      registerCallback('messageCreate', message => {
        try {
          if (message.author !== bot.user) {
            var msgid = RED.util.generateId();
            var msg = {
              _msgid: msgid
            };
            msg.payload = message.content;
            msg.channel = safeSerialize(message.channel);
            msg.member = safeSerialize(message.member);
            msg.memberRoleNames = message.member ? message.member.roles.cache.each(function (item) {
              return item.name;
            }) : null;
            msg.memberRoleIDs = message.member ? message.member.roles.cache.each(function (item) {
              return item.id;
            }) : null;

            try {
              msg.data = safeSerialize(message);
              msg.data.attachments = safeSerialize(message.attachments);
              msg.data.reference = message.reference;
            } catch (e) {
              node.warn("Could not set `msg.data`: JSON serialization failed");
            }

            if (channelFilterList && !channelFilterList.includes(msg.channel.id)){
              return;
            } else if (message.author.bot) {
              msg.author = {
                id: message.author.id,
                bot: message.author.bot,
                system: message.author.system,
                flags: message.author.flags,
                username: message.author.bot,
                discriminator: message.author.discriminator,
                avatar: message.author.avatar,
                createdTimestamp: message.author.createdTimestamp,
                tag: message.author.tag,
              };
              node.send(msg);
            } else {
              message.author.fetch(true).then(author => {
                msg.author = safeSerialize(author);
                node.send(msg);
              }).catch(error => {
                node.error(error);
                node.status({
                  fill: "red",
                  shape: "dot",
                  text: error
                });
              });
            }
          }
        } catch (error) {
          node.error(error);
          node.status({
            fill: "red",
            shape: "dot",
            text: error
          });
        }
      });

      registerCallback('error', error => {
        node.error(error);
        node.status({
          fill: "red",
          shape: "dot",
          text: error
        });
      });

      node.on('close', function () {
        callbacks.forEach(function (cb) {
          bot.removeListener(cb.eventName, cb.listener);
        });
        discordSelfBotManager.closeBot(bot);
      });

    }).catch(function (err) {
      node.error(err);
      node.status({
        fill: "red",
        shape: "dot",
        text: err
      });
    });
  }
  RED.nodes.registerType("discordSelfMessage", discordSelfMessage);
};

function safeSerialize(value)
{
  if (value === undefined || value === null) {
    return value;
  }

  try {
    return Flatted.parse(Flatted.stringify(value));
  } catch (error) {
    // Fall back to plain JSON object to avoid runtime crashes on discord.js-selfbot internals.
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (fallbackError) {
      return {};
    }
  }
}

function cleanChannelFilterList(channelFilterList)
{
  if (!channelFilterList)
    return;

  var cleanedChannelFilterList = null;
  if (channelFilterList.startsWith(',') && channelFilterList.endsWith(','))
  {
    cleanedChannelFilterList = channelFilterList.slice(1, -1);
  } else if (channelFilterList.startsWith(',')) {
    cleanedChannelFilterList = channelFilterList.slice(1);
  } else if (channelFilterList.endsWith(',')) {
    cleanedChannelFilterList = channelFilterList.slice(0, -1);
  } else {
    cleanedChannelFilterList = channelFilterList;
  }
  return cleanedChannelFilterList.split(',');
}
