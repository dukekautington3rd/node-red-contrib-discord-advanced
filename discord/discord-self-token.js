module.exports = function(RED) {
  function DiscordSelfTokenNode(n) {
    RED.nodes.createNode(this, n);
    this.token = this.credentials.token;
    this.name = n.name;
  }
  RED.nodes.registerType("discord-self-token", DiscordSelfTokenNode, {
    credentials: {
      token: { type: "text" }
    }
  });
};
