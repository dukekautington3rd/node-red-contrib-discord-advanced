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
            msg.channel = getSafeChannel(message.channel);
            msg.member = getSafeMember(message.member);
            msg.memberRoleNames = message.member ? message.member.roles.cache.each(function (item) {
              return item.name;
            }) : null;
            msg.memberRoleIDs = message.member ? message.member.roles.cache.each(function (item) {
              return item.id;
            }) : null;

            try {
              msg.data = getSafeMessageData(message);
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
                msg.author = getSafeAuthor(author);
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

function getSafeAuthor(author)
{
  if (!author) {
    return null;
  }
  return {
    id: author.id,
    bot: author.bot,
    system: author.system,
    flags: author.flags || null,
    username: author.username,
    discriminator: author.discriminator,
    avatar: author.avatar,
    createdTimestamp: author.createdTimestamp,
    tag: author.tag
  };
}

function getSafeChannel(channel)
{
  if (!channel) {
    return null;
  }
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    guildId: channel.guildId || null,
    parentId: channel.parentId || null,
    topic: channel.topic || null,
    nsfw: !!channel.nsfw,
    lastMessageId: channel.lastMessageId || null
  };
}

function getSafeMember(member)
{
  if (!member) {
    return null;
  }
  return {
    id: member.id,
    userId: member.user ? member.user.id : null,
    nickname: member.nickname || null,
    displayName: member.displayName || null,
    joinedTimestamp: member.joinedTimestamp || null,
    premiumSinceTimestamp: member.premiumSinceTimestamp || null,
    pending: !!member.pending,
    communicationDisabledUntilTimestamp: member.communicationDisabledUntilTimestamp || null,
    roles: member.roles && member.roles.cache ? member.roles.cache.map(function (role) {
      return {
        id: role.id,
        name: role.name
      };
    }) : []
  };
}

function getSafeMessageData(message)
{
  return {
    id: message.id,
    content: message.content,
    channelId: message.channelId,
    guildId: message.guildId || null,
    createdTimestamp: message.createdTimestamp,
    editedTimestamp: message.editedTimestamp || null,
    tts: !!message.tts,
    type: message.type,
    url: message.url || null,
    reference: message.reference || null,
    attachments: getSafeAttachments(message.attachments),
    mentions: getSafeMentions(message)
  };
}

function getSafeAttachments(attachments)
{
  if (!attachments || !attachments.map) {
    return [];
  }
  return attachments.map(function (attachment) {
    return {
      id: attachment.id,
      name: attachment.name || null,
      url: attachment.url || null,
      proxyURL: attachment.proxyURL || null,
      contentType: attachment.contentType || null,
      size: attachment.size || 0,
      height: attachment.height || null,
      width: attachment.width || null,
      ephemeral: !!attachment.ephemeral
    };
  });
}

function getSafeMentions(message)
{
  return {
    users: message.mentions && message.mentions.users && message.mentions.users.map ? message.mentions.users.map(function (user) {
      return user.id;
    }) : [],
    roles: message.mentions && message.mentions.roles && message.mentions.roles.map ? message.mentions.roles.map(function (role) {
      return role.id;
    }) : [],
    channels: message.mentions && message.mentions.channels && message.mentions.channels.map ? message.mentions.channels.map(function (channel) {
      return channel.id;
    }) : []
  };
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
