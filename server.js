const spawn = require('child_process').spawn;
const http = require('http-proxy');
const socketio = require('socket.io');


/** PHP SCRIPT **/
const child = process.env.NODE_ENV === 'production'
    ? spawn('vendor/bin/heroku-php-nginx', ['-C', 'heroku/nginx_vhost.conf', 'public/'])
    : spawn('php', ['bin/console', 'server:run', '9999', '-vvv', '--no-ansi'])
;
child.stdout.on('data', (data) => {
    console.log(`[PHP] ${data}`);
});
child.stderr.on('data', (data) => {
    console.error(`[PHP][StdErr] ${data}`);
});
child.on('error', (data) => {
    console.error(`[PHP][ERR] ${data}`);
});
child.on('exit', function (code, signal) {
    console.log('[PHP] Exited with '+`code ${code} and signal ${signal}`);
});
child.on('disconnect', function () {
    console.log('[PHP] Disconnected', arguments);
});
/** ********** **/


/** HTTP Proxy to PHP **/
http.createProxyServer({
    target: 'http://127.0.0.1:9999'
}).listen(80);
/** ***************** **/


/** Websocket server **/
const socket = socketio.listen(9998);
var hostingSocket = null;
var sessionData = {};
socket.on('connection', function(socket){
    console.log('a user connected');
    sessionData[socket.id] = {};
    socket.on('subscribe', function(msg) {
        if (hostingSocket) {
            socket.emit('message', 'Il y a déjà un hôte pour cette présentation !');
            return;
        }
        hostingSocket = socket;
    });
    socket.on('message', function(msg) {
        if (hostingSocket === null) {
            socket.emit('message', 'Attendez que l\'hôte ait créé une session de présentation, ne soyez pas trop pressé•e :)');
            return;
        }
        console.info('A message!', msg);
        hostingSocket.emit('message', 'Someone helped you!');
    });
});
/** **************** **/
