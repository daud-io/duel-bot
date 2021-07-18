var fetch = require("node-fetch");

var headers = {
  "kbn-version": "6.6.1",
  "Content-Type": "application/json"
};

async function userkillsdeaths(u, callback) {
  var date = new Date();
  date.setDate(date.getDate() - 7);

  var dataString = x => `{
  "sort" : [
    { "Created" : {"order" : "desc"}}
  ],
  "size" : 10000,
  "query": {
    "bool": { 
      "must": [
        { "match": { "${x}.LoginID": "${u}"}},
        { "match": { "Type" :"AuditEventDeath"}},
        {"range" : {
          "Created" : { "gte" : "${date.toJSON()}" }
        }}
      ]
    }
  }
}`;

  var k = null;
  var d = null;

  function kills(body) {
    k = body.hits.hits.length;
    if (d != null) {
      callback(k / d);
    }
  }

  function deaths(body) {
    d = body.hits.hits.length;
    if (k != null) {
      callback(k / d);
    }
  }

  fetch(
    "http://daud.io:5601/api/console/proxy?path=%2Fdaud**%2F_search&method=POST",
    {
      method: "POST",
      headers: headers,
      body: dataString("Killer")
    }
  )
    .then(res => res.json())
    .then(kills);

  fetch(
    "http://daud.io:5601/api/console/proxy?path=%2Fdaud**%2F_search&method=POST",
    {
      method: "POST",
      headers: headers,
      body: dataString("Victim")
    }
  )
    .then(res => res.json())
    .then(deaths);
}

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync("db.json");
const db = low(adapter);

function duel(a, b) {
  if (a > b) return a + " " + b;
  else return b + " " + a;
}

const http = require("http");
var server = http.createServer(function(req, res) {
  if (req.method == "POST") {
    console.log("POST");
    var body = "";
    req.on("data", function(data) {
      body += data;
    });
    req.on("end", function() {
      var parsed = JSON.parse(body);
      if (!parsed.token || !parsed.killedBy) return;
      const killed = fetch("https://discordapp.com/api/users/@me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${parsed.token}`
        }
      });
      const killer = fetch("https://discordapp.com/api/users/@me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${parsed.killedBy}`
        }
      }).then(r => r.json());
      Promise.all([killed, killer]).then(([killed, killer]) => {
        console.log(killed.id, killer.id);
        var dduel = db.get("duels").get(duel(killed.id, killer.id));
        if (!dduel.value()) return;
        if (dduel.value() != "pending") {
          let left = dduel.get("[0]").value();
          let right = dduel.get("[1]").value();
          if (left < 5 && right < 5) {
            if (killed.id < killer.id) {
              dduel.set("[0]", ++left).write();
            } else {
              dduel.set("[1]", ++right).write();
            }

            if (left == 5 || right == 5) {
              const defaultChannel = client.channels.find(
                channel => channel.name == "duel_logs"
              );

              const first =
                killed.id > killer.id ? killed.username : killer.username;
              const second =
                killed.id > killer.id ? killer.username : killed.username;

              defaultChannel.send(`<@${killed.id}> vs <@${killer.id}>`);
              defaultChannel.send(`${first}: ${left} points`);
              defaultChannel.send(`${second}: ${right} points`);
              defaultChannel.send(`<@${killer.id}> wins [confirmed]`);
            }
          }
        }
      });
    });
    res.writeHead(200, {
      "Content-Type": "text/plain"
    });
    res.end("post received");
  } else {
    console.log("GET");
    res.writeHead(200, {
      "Content-Type": "application/json"
    });
    res.end(JSON.stringify(db.getState(), null, 2));
  }
});

server.listen(process.env.PORT || 1234, "0.0.0.0");
console.log("Listening at http://localhost:" + process.env.PORT || 1234);

const Discord = require("discord.js");
const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", msg => {
  if (msg.content.toLowerCase().startsWith("!duel")) {
    var x = msg.mentions.users.array()[0].id;
    if (msg.content.toLowerCase().startsWith("!duel accept")) {
      if (x) {
        var dduel = db.get("duels").get(duel(msg.author.id, x));
        if (dduel.value() == "pending") {
          db.get("duels")
            .set(duel(msg.author.id, x), [0, 0])
            .write();
          msg.reply("the duel has begun");
        } else {
          msg.reply("the duel has to be in the pending state");
        }
      } else {
        msg.reply(
          "please `@mention` a user to accept a duel: `!duel accept @player`"
        );
      }
    } else if (msg.content.toLowerCase().startsWith("!duel get")) {
      var y = msg.mentions.users.array().slice(0, 2);
      if (y) {
        var dduel = db.get("duels").get(duel(y[0].id, y[1].id));
        if (dduel.value() == "pending") {
          msg.reply("the duel is still in the pending state");
        } else {
          console.log(dduel.value());
          var a = y[0].id > y[1].id ? y[0].username : y[1].username;
          var b = y[0].id > y[1].id ? y[1].username : y[0].username;
          msg.reply(
            `the duel is currently at ${a}: ${dduel.value()[0]} ${b}: ${
              dduel.value()[1]
            }`
          );
        }
      } else {
        msg.reply(
          "please `@mention` a user to accept a duel: `!duel accept @player`"
        );
      }
    } else if (msg.content.toLowerCase().startsWith("!duel set")) {
      if (x) {
        var sc = msg.content.toLowerCase().match(/\[[0-9]*,\s*[0-9]*\]/);
        sc = JSON.parse(sc);
        var a = msg.author.id;
        var b = x;
        if (a < b) sc = [sc[1], sc[0]];
        var prev = db
          .get("duels")
          .get(duel(a, b))
          .value();
        db.get("duels")
          .set(duel(a, b), sc)
          .write();
        msg.reply(`The previous score was ${prev}. It has been set to ${sc}`);
      } else {
        msg.reply(
          "please `@mention` a user to change that duels score (your score goes first): `!duel set [1, 2] @player`"
        );
      }
    } else if (msg.content.toLowerCase().startsWith("!duel help")) {
      msg.channel.send(
        "The available commands are\n`!duel @player` (requests a duel with another player)\n`!duel accept @player` (accepts a requested duel)\n`!duel set [x,y] @player` (sets your score to x and @players score to y)"
      );
    } else {
      if (x) {
        console.log(duel(msg.author.id, x));
        db.get("duels")
          .set(duel(msg.author.id, x), "pending")
          .write();
        msg.channel.send(
          `<@${
            msg.author.id
          }> challenges <@${x}> to a duel. Type \`!duel accept @challenger\` to begin`
        );
      } else {
        msg.reply(
          "please `@mention` a user to request a duel: `!duel @player`"
        );
      }
    }
  }
  if (msg.content.toLowerCase().startsWith("!rank")) {
    var asdf = msg.mentions.users.array()[0] || {};
    var user = asdf.user || msg.author;
    userkillsdeaths(user.id, x => {
      msg.channel.send(
        `${user.username}'s current kill to death ratio (kills/deaths) is ${x}.`
      );
    });
  }
});

client.login(process.env.TOKEN);
