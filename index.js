var app = require("express")();
var config = require("config");
var http = require("http").Server(app); // <--- Forzar siempre HTTP
const knex = require("knex")(config.get("database"));
var io = require("socket.io")(http, {
  pingInterval: 5000,
  pingTimeout: 6000,
});
const CronJob = require("cron").CronJob;
var mysql = require("mysql");
var User = require("./models/user");
var Room = require("./models/room");
var RoomAccess = require("./models/room_access");
var Message = require("./models/message");
var Promise = require("bluebird");
require("events").EventEmitter.defaultMaxListeners = 15;

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

function getDateTime() {
  function pad(number) {
    if (number < 10) {
      return "0" + number;
    }
    return number;
  }
  var d = new Date();
  return (
    d.getUTCFullYear() +
    "-" +
    pad(d.getUTCMonth() + 1) +
    "-" +
    pad(d.getUTCDate()) +
    " " +
    pad(d.getUTCHours()) +
    ":" +
    pad(d.getUTCMinutes()) +
    ":" +
    pad(d.getUTCSeconds())
  );
}

async function sentPushe(room, message, user) {
  var companion = await getCompanion(
    room.related("users").toJSON({ virtuals: true }),
    user
  );

  knex("messages")
    .select(knex.raw("count(*) as new_messages"))
    .whereRaw(
      "messages.room_id in (select room_id from room_accesses where user_id = " +
        companion.id +
        " ) and messages.user_id<> " +
        companion.id +
        " and messages.readed_at is null"
    )
    .then(function (firstrows) {
      firstrows.forEach(function (messages, ii, irows) {
        knex("devices")
          .where({ user_id: companion.id })
          .then(function (rows) {
            let payload = {
              user_id: String(message.get("user_id")),
              notification_id: String(message.get("id") + "" + 1 * new Date()),
              message: "You have a new message",
              body: String(message.get("text")).slice(0, 50),
              badge: String(messages.new_messages),
              custom_data: {
                room_id: String(room.get("id")),
              },
              messageFrom: companion.name,
            };

            console.log("push payload:" + payload);

            rows.forEach(function (item, i, rows) {
              Push.send(item.token, payload).then(function (result) {
                //Bruno Tenaglia
                console.log("send push:" + result);

                // if(result.failed[0] && result.failed[0].status == '400'){
                //     console.log('delete token: '+ result.failed[0].device);
                //     knex('devices').where({token: result.failed[0].device }).del().then(function(resp){});
                // }
              });
            });
          });
      });
    });
}

async function getCompanion(users, user) {
  for await (let member of users) {
    if (member.id !== user.id) {
      return member;
    }
  }
}

io.on("connection", function (socket) {
  // console.log("you were connected socketId="+socket.id);
  var debug = true;
  var user = null;
  var room = { id: 0 };

  async function dataRoom(item) {
    var companion = await getCompanion(
      item.related("users").toJSON({ virtuals: true }),
      user
    );
    return {
      id: item.get("id"),
      type: item.get("type"),
      data: item.get("data"),
      created_at: item.get("created_at"),
      updated_at: item.get("updated_at"),
      message: item.related("message").toJSON({ virtuals: true }),
      name: "Dialog " + companion.name,
      new_messages: item.get("new_messages"),
      icon: companion.icon,
      icon_thumb: companion.icon_thumb,
      settings: item.getSettings(user.id),
      settings_my: item.getSettingsMy(user.id),
      setting_spouse: item.getSettingsSpouse(user.id),
    };
  }

  function updatedRoom(room) {
    var usersId = room.get("data").split("_");
    Room.query(function (db) {
      var subcolumn = knex
        .raw(
          "select count(*) from messages where messages.room_id = rooms.id and messages.user_id<>" +
            usersId[0] +
            " and messages.id > (select message_id from room_accesses where room_id = rooms.id  and user_id = " +
            usersId[0] +
            " )"
        )
        .wrap("(", ") as new_messages");
      db.where("id", room.id);
      db.select("rooms.*", subcolumn);
    })
      .fetch()
      .then(function (result) {
        var name_room = "user" + usersId[0];
        io.sockets.in(name_room).emit("room update", { room: result.toJSON() });
      });
    Room.query(function (db) {
      var subcolumn = knex
        .raw(
          "select count(*) from messages where messages.room_id = rooms.id and messages.user_id<>" +
            usersId[1] +
            " and messages.id > (select message_id from room_accesses where room_id = rooms.id  and user_id = " +
            usersId[1] +
            " )"
        )
        .wrap("(", ") as new_messages");
      db.where("id", room.id);
      db.select("rooms.*", subcolumn);
    })
      .fetch()
      .then(function (result) {
        var name_room = "user" + usersId[1];
        io.sockets.in(name_room).emit("room update", { room: result.toJSON() });
      });
  }

  socket.emit("guest", {});

  socket.on("test", function (data) {
    debug = !debug;
    socket.emit("console log", { event: "test", data: data });
    let rooms = Object.keys(socket.rooms);
    var resp = {
      user: user,
      room: room,
      debug: debug,
      rooms: rooms,
    };
    socket.emit("test", resp);
  });

  socket.on("auth", function (data) {
    console.log("auth===========>", data.key);
    if (debug) socket.emit("console log", { event: "auth", data: data });

    // Usamos require: false para que no lance error si no encuentra un usuario
    new User({ api_token: data.key })
      .fetch({ columns: ["id", "icon_key", "name", "online_at"], require: false }) // require: false evita EmptyResponse
      .then(function (model) {
        if (model) {
          // Si se encontró un usuario, seguimos con el flujo
          user = model.toJSON({ virtuals: true });
          room = { id: 0 };

          socket.emit("auth", { id: user.id });
          if (debug) console.log(model.toJSON({ virtuals: true }));
          socket.join("user" + user.id, function () {
            let rooms = Object.keys(socket.rooms);
            // console.log('socket.join');
            // console.log(rooms);
          });
        } else {
          // Si no se encontró un usuario, se envía un error al cliente
          socket.emit("auth", { error: "The token is invalid." });
        }
      })
      .catch(function (error) {
        // Manejar cualquier otro error que pueda ocurrir durante el proceso
        console.error('Error during authentication:', error);
        socket.emit("auth", { error: "An error occurred during authentication." });
      });
  });


  socket.on("listen room", function (data) {
    if (debug) console.log("listen room");
    if (user == null) {
      socket.emit("listen room", { error: "Unauthorized" });
      return;
    }
    if (!data.room_id) {
      socket.emit("listen room", { error: "Undefine room_id" });
      return;
    }
    if (debug) socket.emit("console log", { event: "listen room", data: data });
    var d = new RoomAccess({ room_id: data.room_id, user_id: user.id })
      .fetch({
        withRelated: [
          "room",
          "room.users",
          "room.message",
          "room.message.user",
        ],
      })
      .then(function (room_access) {
        if (room_access === null) {
          socket.emit("listen room", { error: "Access deny" });
          return;
        }
        var old_room = null;
        var name_room = "room" + data.room_id;

        if (room.id > 0 && room.id != data.room_id) {
          old_room = "room" + room.id;
        }

        room = room_access.related("room");
        socket.join(name_room, function () {
          let rooms = Object.keys(socket.rooms);
          //                        console.log ('listen room socket.join');
          //                        console.log ({rooms:rooms, user: user});
          if (old_room != name_room)
            socket.leave(old_room, function () {
              let rooms = Object.keys(socket.rooms);
              //                            console.log ('listen room socket.leave');
              //                            console.log ({rooms:rooms, user: user});
            });
        });

        socket.emit("listen room", {
          room: dataRoom(room_access.related("room")),
        });
        var send_settings = {
          room_id: room.id,
          my: room.getSettingsMy(user.id),
          settings: room.getSettings(user.id),
        };
        socket.emit("settings room", send_settings);
      });
  });

  socket.on("messages room", function (data) {
    if (debug)
      socket.emit("console log", { event: "messages room", data: data });
    if (user == null) {
      socket.emit("messages room", { error: "Unauthorized" });
      return;
    }
    if (!data.room_id) {
      socket.emit("messages room", { error: "Undefine room_id" });
      return;
    }
    if (!data.page) {
      socket.emit("messages room", { error: "Undefine page" });
      return;
    }
    if (debug) console.log("messages room");
    RoomAccess.forge({ room_id: data.room_id, user_id: user.id })
      .fetch({ withRelated: ["room"] })
      .then(function (room_access) {
        if (room_access === null) {
          socket.emit("messages room", {
            error: "Access deny for room_id=" + data.room_id,
          });
          return;
        }
        Message.query({ where: { room_id: data.room_id } })
          .orderBy("-id")
          .fetchPage({
            pageSize: 50,
            page: data.page,
            withRelated: ["user", "fotos", "files"],
          })
          .then(function (result) {
            var models = result.models;
            var pagination = result.pagination;
            //                        console.log(result.pagination.toJSON({virtuals: true}));
            socket.emit("messages room", {
              result: models,
              pagination: pagination,
            });
          });
      });
  });

  socket.on("message read", function (data) {
    if (debug)
      socket.emit("console log", { event: "message read", data: data });
    if (debug) console.log("message read");
    if (debug) console.log(data);
    if (user == null) {
      socket.emit("message read", { error: "Unauthorized" });
      return;
    }

    if (!room.id) {
      socket.emit("message read", { error: "Access deny" });
      return;
    }

    RoomAccess.forge({ room_id: room.id, user_id: user.id })
      .fetch({ withRelated: ["room"] })
      .then(function (room_access) {
        if (1 * room_access.get("message_id") < 1 * data.message_id) {
          room_access.set("message_id", data.message_id);
          room_access.save();
          var datetime = getDateTime();
          Message.query(function (qb) {
            qb.whereRaw(
              "room_id = ? and id <= ? and user_id <> ? and readed_at is null",
              [room.id, data.message_id, user.id]
            );
          })
            .fetchAll()
            .then(function (result) {
              result.map(function (item) {
                Message.forge({ id: item.id })
                  .fetch()
                  .then(function (message) {
                    message.set("readed_at", datetime);
                    message.save();
                    var name_room = "room" + room.id;
                    io.sockets.in(name_room).emit("message readed", {
                      id: item.id,
                      readed: datetime,
                    });
                  });
              });
              updatedRoom(room_access.related("room"));
            });
        } else {
          socket.emit("message read", { error: "Error set read marker" });
        }
      });
  });

  socket.on("quit room", function (data) {
    if (debug) socket.emit("console log", { event: "quit room", data: data });
    if (debug) console.log("quit room");
    if (debug) console.log(data);

    var name_room = "room" + room.id;
    socket.leave(name_room, function () {
      let rooms = Object.keys(socket.rooms);
      //            console.log ('socket.leave');
      //            console.log ({rooms:rooms, user: user});
    });
    room = {};
    socket.emit("quit room", { status: "ok" });
  });

  socket.on("setting room", function (data) {
    if (debug)
      socket.emit("console log", { event: "setting room", data: data });
    if (user == null) {
      socket.emit("setting room", { error: "Unauthorized" });
      return;
    }

    if (!room.id) {
      socket.emit("setting room", { error: "Enter room" });
      return;
    }
    if (!data.settings && !data.settings_my) {
      socket.emit("setting room", { error: "Empty data" });
      return;
    }
    if (debug) {
      console.log("setting room");
      console.log({ data: data, user: user });
    }
    var companion_id = room.getСompanion(user.id);
    var companion_room = "user" + companion_id;
    if (!!data.settings) {
      room.setSettings(user.id, data.settings);
      room.save().then(function (model) {});
    }
    if (!!data.settings_my) {
      room.setSettingsMy(user.id, data.settings_my);
      room.save().then(function (model) {});
    }
    new Room({ id: room.id }).fetch().then(function (uproom) {
      var dataRoom1 = {
        id: uproom.get("id"),
        settings: uproom.getSettings(user.id),
        settings_my: uproom.getSettingsMy(user.id),
      };
      socket.emit("settings room", { room: dataRoom1 });

      var dataRoom2 = {
        id: uproom.get("id"),
        settings: uproom.getSettings(companion_id),
        settings_my: uproom.getSettingsMy(companion_id),
      };
      io.sockets
        .in(companion_room)
        .emit("new setting room", { room: dataRoom2 });
    });
  });

  socket.on("message send_room", function (data) {
    if (debug)
      socket.emit("console log", { event: "message send_room", data: data });
    if (user == null) {
      socket.emit("message send_room", { error: "Unauthorized" });
      return;
    }
    if (!room.id) {
      socket.emit("message send_room", { error: "Enter room" });
      return;
    }

    if (debug) console.log("message send_room");
    if (debug) console.log({ event: "message send_room", data: data });
    socket.emit("console log", { event: "message send_room", data: data });

    var time_zone = data.time_zone != null ? Number(data.time_zone) : null;

    Message.forge({
      user_id: user.id,
      room_id: room.id,
      text: data.text,
      time_zone: time_zone,
    })
      .save()
      .then(function (message) {
        var id = message.get("id");
        var prom = [];
        var fotos = [];
        var files = [];
        if (data.foto && data.foto.length > 0) {
          fotos = message.fotos().attach(data.foto);
          prom.push(fotos);
        }

        if (data.file && data.file.length > 0) {
          files = message.files().attach(data.file);
          prom.push(files);
        }

        //              Room.forge({id: room.id}).save({'message_id':id, sent_push:0});
        Promise.all(prom).then(function (values) {
          new Message({ id: message.get("id") })
            .fetch({ withRelated: ["user", "fotos", "files"] })
            .then(function (model) {
              var name_room = "room" + room.id;
              io.sockets
                .in(name_room)
                .emit("message send_room", model.toJSON({ virtuals: true }));
              //                          socket.emit('message send_room', model.toJSON({virtuals: true}) );
              Room.forge({ id: room.id })
                .fetch()
                .then(function (room) {
                  var send_settings = {
                    my: room.getSettingsMy(user.id),
                    settings: room.getSettings(user.id),
                  };
                  socket.emit("settings room", send_settings);
                  updatedRoom(room);
                });
              sentPushe(room, message, user);
              knex("rooms")
                .where({ id: room.id })
                .update({
                  message_id: id,
                  sent_push: 1,
                  updated_at: getDateTime(),
                })
                .then(function (resp) {});
            });
        });
      });
  });

  socket.on("message degrading", function (data) {
    if (user == null) {
      socket.emit("message degrading", { error: "Unauthorized" });
      return;
    }
    if (!room.id) {
      socket.emit("message degrading", { error: "Enter room" });
      return;
    }

    if (debug)
      socket.emit("console log", { event: "message degrading", data: data });
    new Message({ room_id: room.id, id: data.message_id })
      .fetch()
      .then(function (message) {
        message
          .save({ degrading: message.get("degrading") == 1 ? 0 : 1 })
          .then(function (updatedModel) {
            socket.emit("message degrading", {
              message: updatedModel.toJSON(),
            });
          });
      });
  });

  socket.on("message abusive", function (data) {
    if (user == null) {
      socket.emit("message abusive", { error: "Unauthorized" });
      return;
    }
    if (!room.id) {
      socket.emit("message abusive", { error: "Enter room" });
      return;
    }

    if (debug)
      socket.emit("console log", { event: "message abusive", data: data });
    new Message({ room_id: room.id, id: data.message_id })
      .fetch()
      .then(function (message) {
        message
          .save({ abusive: message.get("abusive") == 1 ? 0 : 1 })
          .then(function (updatedModel) {
            socket.emit("message abusive", { message: updatedModel.toJSON() });
          });
      });
  });

  socket.on("rooms", function (data) {
    if (user == null) {
      socket.emit("rooms", { error: "Unauthorized" });
      return;
    }

    if (debug) socket.emit("console log", { event: "rooms", data: data });
    Room.query(function (db) {
      var subcolumn = knex
        .raw(
          "select count(*) from messages where messages.room_id = rooms.id and messages.user_id<>" +
            user.id +
            " and messages.id > (select message_id from room_accesses where room_id = rooms.id  and user_id = " +
            user.id +
            " )"
        )
        .wrap("(", ") as new_messages");
      db.whereRaw(
        "EXISTS (select * from room_accesses where room_id = rooms.id and user_id = ?)",
        [user.id]
      );
      db.select("rooms.*", subcolumn);
    })
      .orderBy("-message_id")
      .fetchPage({
        pageSize: 50,
        page: data.page,
        withRelated: ["users", "message", "message.user"],
      })
      .then(function (result) {
        var models = [];
        for (var i = 0; i < result.models.length; i++) {
          models.push(dataRoom(result.models[i]));
        }
        var pagination = result.pagination;
        socket.emit("rooms", { result: models, pagination: pagination });
      });
  });

  socket.on("test temp", function (data) {
    let deviceToken = data.token
      ? data.token
      : "94014e010b8637e27a75dbdf0d096213f150d1681c91da213aace4b396b1500e";
    let payload = {
      user_id: "12",
      notification_id: String(1 * new Date()),
      message: "You have a new message 111",
      body: "Hi",
      custom_data: {
        room_id: "50",
      },
      messageFrom: "John Appleseed",
    };
    Push.send(deviceToken, payload).then(function (result) {
      socket.emit("test temp", { result: result });
      //            console.log(result);
    });
  });

  socket.on("disconnecting", function () {
    var name_room = "room" + room.id;
    socket.leave(name_room, function () {
      let rooms = Object.keys(socket.rooms);
      //            console.log ('disconnecting');
      //            console.log ({rooms:rooms, user: user});
    });
  });

  socket.conn.on("packet", function (packet) {
    if (user == null) {
      return;
    }
    if (packet.type === "ping") {
      var dt = new Date();
      var dt_string =
        dt.getFullYear() +
        "-" +
        (dt.getMonth() + 1) +
        "-" +
        dt.getDate() +
        " " +
        dt.getHours() +
        ":" +
        dt.getMinutes() +
        ":" +
        dt.getSeconds();
      knex("users")
        .where("id", "=", user.id)
        .update({ online_at: dt_string })
        .then(function (resp) {});
    }
  });
});

http.listen(config.get("host.port"), function () {
  console.log("listening on *:" + config.get("host.port"));
});

/* Cron Settings - 2min */
var job = new CronJob("0 */2 * * * *", jobFunction);

async function jobFunction() {
  try {
    Room.query(function (db) {
      db.select(
        knex.raw(
          "SELECT * FROM rooms WHERE sent_push = 1 AND message_id IS NOT NULL"
        )
      );
    })
      .fetch()
      .then(function (rooms) {
        rooms.forEach(function (room, i, rows) {
          Message.forge({ id: room.message_id })
            .fetch()
            .then(function (message) {
              sentPushe(room, message);
              knex("rooms")
                .where({ id: room.id })
                .update({
                  message_id: message.id,
                  sent_push: 2,
                  updated_at: getDateTime(),
                })
                .then(function (resp) {});
            });
        });
      });
  } catch (error) {
    console.warn("Cron Catch", error);
  }
}
// job.start();

/*
Team ID - CCCURPFF8R
Name:notifAPNSkey
Key ID:N49NFFS743
Services:Apple Push Notifications service (APNs)
*/
