var express = require('express');
var app = express();
var path = require('path');
var wsm = require('ws');
var fs = require('fs');
var urlparser = require('url');
var admin = null;
var clients = {};
app.set('port', process.env.PORT || 8080);

/*
 * Server startup
 */

var port = app.get('port');
var server = app.listen(port, function() {
	console.log('Express server started ');
	console.log('Connect to http://<host_name>:' + port + '/');
});

var WebSocketServer = wsm.Server, wss = new WebSocketServer({
	server : server,
	path : '/call'
});


wss.on('connection', function(ws) {
	ws.on('close', function() {
		close(ws);
	});

	ws.on('error', function() {
		close(ws);
	});

	ws.on('message', function(_message) {
		var message = JSON.parse(_message);

		switch (message.id) {
		case 'newmsg':
			console.log("New Message is being broadcasted.");
			for (var key in clients) {
				sendMessage(clients[key]['ws'], { id : 'newmsg', adminsay:message.isadmin, content : message.content });
			}
			break;
		case 'connect':
			clients[message.info['name']] = { ws: ws, info: message.info };
			console.log(clients);
			if (message.info['isadmin'] == 1) {
				admin = clients[message.info['name']];
				var users = [];
				for (var key in clients) {
					if (clients[key] == admin) continue;
					users.push(clients[key]['info']);
	                        }
				console.log("Clients are broadcasted to admin");
				console.log(users);
				sendMessage(admin.ws, { id : 'connectResponse', users:users });
			} else if (admin != null) {
				console.log("New user is alerted to admin");
				sendMessage(admin.ws, { id : 'newusercoming', info:clients[message.info['name']]['info'] });
			}
			break;
		case 'ban':
			console.log("Ban a client of " + message.name);
			clients[message.name]['info']['isban'] = 1;
			sendMessage(clients[message.name]['ws'], { id : 'banned' });
			break;
		case 'unban':
			console.log("Unban client " + message.name);
			clients[message.name]['info']['isban'] = 0;
			sendMessage(clients[message.name]['ws'], { id : 'unbanned' });
			break;
		case 'voicecall':
			console.log("voice call from " + message.info['name']);
			if (admin == null) {
				sendMessage(ws, { id : 'voicecallResponse', accept : false });
			}else {
				sendMessage(admin['ws'], { id : 'voicecallRequest', info:message.info });
			}
			break;
		case 'voicecallRequestAnswer':
			sendMessage(clients[message.caller]['ws'], { id : 'voicecallResponse', accept:message.accept, room:message.room });
			break;
		case 'cancelCall':
			for (var key in clients) {
				if (key == message.from) continue;
				sendMessage(clients[key]['ws'], { id : 'callCanceled' });
                        }
			break;
		case 'sync':
			break;
		default:
			ws.send(JSON.stringify({
				id : 'error',
				message : 'Invalid message ' + message
			}));
			break;
		}

	});
});

function close(ws) {
	if (admin == null) return;
        var user = null;

        for (var key in clients) {
        	if (clients[key]['ws'] == ws) {
                	user = clients[key];
                        break;
                }
        }
        if (user == null || user == admin) return;
        sendMessage(admin.ws, { id : 'userclosed', userid : user['info']['id'] });
	delete clients[key];
}

function sendMessage(ws, message) {
        var jsonMessage = JSON.stringify(message);
        console.log('Senging message: ' + jsonMessage);
	try {
		ws.send(jsonMessage);
	}
	catch (e) {
	}	
}

app.use(express.static(path.join(__dirname, 'static')));

