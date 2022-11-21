var cors = require('cors')
var express = require('express');
const { generateToken04 } = require('./server/zegoServerAssistant');
var jsonBodyParser = require('body-parser').json();
const { token } = require('morgan');

var PORT = process.env.PORT || 8080;
const CALL_ROLE_HOST = 0;
const CALL_ROLE_AUDIENCE = 1;


var tokenMap = {};
var deviceTypeMap = {}; // Android not support sending notification and data at the same time.

var app = express();


if (!(process.env.ZEGO_APP_ID && process.env.ZEGO_SERVER_SECRET)) {
    throw new Error('You must define an ZEGO_APP_ID and ZEGO_SERVER_SECRET');
}

var ZEGO_APP_ID = process.env.ZEGO_APP_ID;
var ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;

var hostConfig = {
    FA_PROJECT_ID: process.env.FA_PROJECT_ID,
    FA_PRIVATE_KEY_ID: process.env.FA_PRIVATE_KEY_ID,
    FA_PRIVATE_KEY: process.env.FA_PRIVATE_KEY ? process.env.FA_PRIVATE_KEY.replace(/\\n/gm, "\n") : undefined,
    FA_CLIENT_EMAIL: process.env.FA_CLIENT_EMAIL,
    FA_CLIENT_ID: process.env.FA_CLIENT_ID,
    FA_CLIENT_X509_CERT_URL: process.env.FA_CLIENT_X509_CERT_URL
}

var audienceConfig = {
    FA_PROJECT_ID: process.env.AFA_PROJECT_ID,
    FA_PRIVATE_KEY_ID: process.env.AFA_PRIVATE_KEY_ID,
    FA_PRIVATE_KEY: process.env.AFA_PRIVATE_KEY ? process.env.AFA_PRIVATE_KEY.replace(/\\n/gm, "\n") : undefined,
    FA_CLIENT_EMAIL: process.env.AFA_CLIENT_EMAIL,
    FA_CLIENT_ID: process.env.AFA_CLIENT_ID,
    FA_CLIENT_X509_CERT_URL: process.env.AFA_CLIENT_X509_CERT_URL
}

// var serviceAccount = require("firebase_admin.json");

///////////////////////////////////// use by the host
var hostServiceAccount = {
    "type": "service_account",
    "project_id": hostConfig.FA_PROJECT_ID,
    "private_key_id": hostConfig.FA_PRIVATE_KEY_ID,
    "private_key": hostConfig.FA_PRIVATE_KEY,
    "client_email": hostConfig.FA_CLIENT_EMAIL,
    "client_id": hostConfig.FA_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": hostConfig.FA_CLIENT_X509_CERT_URL
}
var hostFirebaseAdmin = require("firebase-admin");
hostFirebaseAdmin.initializeApp({
    credential: hostFirebaseAdmin.credential.cert(hostServiceAccount),
}, "host");

/////////////////////////////////// use by the audience
var audienceServiceAccount = {
    "type": "service_account",
    "project_id": audienceConfig.FA_PROJECT_ID,
    "private_key_id": audienceConfig.FA_PRIVATE_KEY_ID,
    "private_key": audienceConfig.FA_PRIVATE_KEY,
    "client_email": audienceConfig.FA_CLIENT_EMAIL,
    "client_id": audienceConfig.FA_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": audienceConfig.FA_CLIENT_X509_CERT_URL
}
var audienceFirebaseAdmin = require("firebase-admin");
audienceFirebaseAdmin.initializeApp({
    credential: audienceFirebaseAdmin.credential.cert(audienceServiceAccount),
}, "audience");


function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

var generateAccessToken = function (req, resp) {
    resp.header('Access-Control-Allow-Origin', "*")

    var expiredTs = req.query.expired_ts;
    if (!expiredTs) {
        expiredTs = 3600;
    }

    var uid = req.query.uid;
    if (!uid) {
        return resp.status(500).json({ 'error': 'user id is required' });
    }

    const token = generateToken04(parseInt(ZEGO_APP_ID), uid, ZEGO_SERVER_SECRET, parseInt(expiredTs), '');
    return resp.json({ 'token': token });
};

function storeFcmToken(req, res) {
    console.log('Req body: ', req.body);
    if (req.body.userID == undefined) {
        res.json({ 'ret': -1, 'message': 'User id invalid!' })
    } else if (req.body.token == undefined) {
        res.json({ 'ret': -2, 'message': 'Token invalid!' })
    }

    console.log('Update user token: ', req.body.userID);
    tokenMap[req.body.userID] = req.body.token;
    if (req.body.deviceType != undefined) {
        deviceTypeMap[req.body.userID] = req.body.deviceType;
    }
    console.log('Update token finished, current count: ', Object.keys(tokenMap).length)
    res.json({ 'ret': 0, 'message': 'Succeed' });
}

function declineCallInvitation(req, res) {
    console.log(req.body);
    var userID = req.body.callerUserID;
    var roomID = req.body.roomID
    if (userID === "" || userID === undefined) {
        res.json({ 'ret': -1, 'message': 'Invalid userID for calceling call invitation' });
        console.log("Invalid userID for send offline invitation");
    } else if (roomID === "" || roomID === undefined) {
        res.json({ 'ret': -2, 'message': 'Invalid roomID for calceling call invitation' });
        console.log('Invalid roomID for calceling call invitation');
    } else {
        var payload = {
            token: tokenMap[userID],
            data: req.body,
        };
        console.log("Plyload: ", payload)

        var callRole = req.body.callRole;
        const messaging = callRole == CALL_ROLE_HOST ? audienceFirebaseAdmin.messaging() : hostFirebaseAdmin.messaging()
        messaging.send(payload)
            .then((result) => {
                console.log(result)

                res.json({ 'ret': 0, 'message': 'Succeed' });
            }).catch((error) => {
                res.json({ 'ret': -1, 'message': error });
                console.log("Error on canceling call invitation: ", error)
            });
    }
}

function sendCallInvitation(req, res) {
    console.log(req.body);
    var userID = req.body.targetUserID
    if (userID === "" || userID === undefined) {
        res.json({ 'ret': -1, 'message': 'Invalid userID for send call invitation' });
        console.log("Invalid userID for send call invitation");
    } else if (!(userID in tokenMap)) {
        res.json({ 'ret': -2, 'message': 'No fcm token for user: ' + userID });
        console.log('No fcm token for user: ' + userID);
    } else {
        var payload = {
            token: tokenMap[userID],
            data: req.body,
        };
        if (userID in deviceTypeMap) {
            if (deviceTypeMap[userID] != 'android') {
                payload['notification'] = {
                    title: 'You have a new call!',
                    body: `${req.body.callerUserName} is calling you.`
                }
            }
        }
        console.log("Plyload: ", payload)

        // If the role equal to host, mean he/she want to send the call invitation to audience, then we need to use the audience firebase-admin to send the message.
        // If not, mean he/she want to send the call invitation to host, then we need to use the host firebase-admin to send the message.
        var callRole = req.body.callRole;
        const messaging = callRole == CALL_ROLE_HOST ? audienceFirebaseAdmin.messaging() : hostFirebaseAdmin.messaging()
        messaging.send(payload)
            .then((result) => {
                console.log(result)

                res.json({ 'ret': 0, 'message': 'Succeed' });
            }).catch((error) => {
                res.json({ 'ret': -1, 'message': error });
                console.log("Error on sending invitation: ", error)
            });

    }
}

function sendGroupCallInvitation(req, res) {
    console.log(req.body);
    var userIDList = req.body.targetUserIDList
    if (userIDList.length == 0) {
        res.json({ 'ret': -1, 'message': 'No user id in the list for sending group call invitation.' });
        console.log("No user id in the list for sending group call invitation.");
    } else {
        var tokens = [];
        var invalidTokens = [];
        for (var i = 0; i < userIDList.length; i++) {
            var userID = userIDList[i];
            if (userID in tokenMap) {
                tokens.push(tokenMap[userID]);
            } else {
                invalidTokens.push(tokenMap[userID]);
            }
        }
        if (tokens.length == 0) {
            res.json({ 'ret': -2, 'message': 'All of the user has no FCM token register' });
            return;
        }
        var inviteData = req.body;
        inviteData.targetUserIDList = inviteData.targetUserIDList.join(',')
        var payload = {
            tokens: tokens,
            notification: {
                title: 'You have a new call!',
                body: `${inviteData.callerUserName} is calling you.`
            },
            data: inviteData,
        };
        // TODO set notification by device type
        console.log("Plyload: ", payload)

        // If the role equal to host, mean he/she want to send the call invitation to audience, then we need to use the audience firebase-admin to send the message.
        // If not, mean he/she want to send the call invitation to host, then we need to use the host firebase-admin to send the message.
        var callRole = req.body.callRole;
        const messaging = callRole == CALL_ROLE_HOST ? audienceFirebaseAdmin.messaging() : hostFirebaseAdmin.messaging();
        messaging.sendMulticast(payload)
            .then((result) => {
                console.log(">>>>>>>>", result)
                if (result.failureCount > 0) {
                    const failedTokens = [];
                    result.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                            failedTokens.push(tokens[idx]);
                            invalidTokens.push(tokens[idx]);
                            console.log(resp.error)
                        }
                    });
                    console.log('List of tokens that caused failures: ' + failedTokens);
                }

                if (invalidTokens.length == 0) {
                    res.json({ 'ret': 0, 'message': 'Succeed' });
                }
                else if (invalidTokens.length < userIDList.length) {
                    res.json({ 'ret': 0, 'message': 'Some of user has no FCM token register: ' + invalidTokens.join(',') })
                } else {
                    res.json({ 'ret': -2, 'message': 'All of the user has no FCM token register or send failed' });
                }
            }).catch((error) => {
                res.json({ 'ret': -1, 'message': error });
                console.log("Error on sending invitation: ", error)
            });
    }
}

app.use(cors());
app.get('/access_token', nocache, generateAccessToken);
app.post('/store_fcm_token', jsonBodyParser, storeFcmToken);
app.post('/call_invite', jsonBodyParser, sendCallInvitation);
app.post('/group_call_invite', jsonBodyParser, sendGroupCallInvitation);
app.post('/decline_call_invite', jsonBodyParser, declineCallInvitation);

app.listen(PORT, function () {
    console.log('Service URL http://127.0.0.1:' + PORT + "/");
    console.log('Token request, /access_token?uid=[user id]');
    console.log('Token with expiring time request, /access_token?uid=[user id]&expiredTs=[expire ts]');
});
