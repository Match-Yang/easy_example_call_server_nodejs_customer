var cors = require('cors')
var express = require('express');
const { generateToken04 } = require('./server/zegoServerAssistant');
var jsonBodyParser = require('body-parser').json();

var PORT = process.env.PORT || 8080;

if (!(process.env.ZEGO_APP_ID && process.env.ZEGO_SERVER_SECRET)) {
    throw new Error('You must define an ZEGO_APP_ID and ZEGO_SERVER_SECRET');
}

var ZEGO_APP_ID = process.env.ZEGO_APP_ID;
var ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;
var FA_PROJECT_ID = process.env.FA_PROJECT_ID
var FA_PRIVATE_KEY_ID = process.env.FA_PRIVATE_KEY_ID
var FA_PRIVATE_KEY = process.env.FA_PRIVATE_KEY
    ? process.env.FA_PRIVATE_KEY.replace(/\\n/gm, "\n")
    : undefined
var FA_CLIENT_EMAIL = process.env.FA_CLIENT_EMAIL
var FA_CLIENT_ID = process.env.FA_CLIENT_ID
var FA_CLIENT_X509_CERT_URL = process.env.FA_CLIENT_X509_CERT_URL

var tokenMap = {};

var app = express();

// var serviceAccount = require("firebase_admin.json");
var serviceAccount = {
    "type": "service_account",
    "project_id": FA_PROJECT_ID,
    "private_key_id": FA_PRIVATE_KEY_ID,
    "private_key": FA_PRIVATE_KEY,
    "client_email": FA_CLIENT_EMAIL,
    "client_id": FA_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": FA_CLIENT_X509_CERT_URL
}
var admin = require("firebase-admin");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

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
    console.log('Update token finished, current count: ', Object.keys(tokenMap).length)
    res.json({ 'ret': 0, 'message': 'Succeed' });
}
function sendOfflineInvitation(req, res) {
    console.log(req.body);
    var userID = req.body.targetUserID
    if (userID === "" || userID === undefined) {
        res.json({ 'ret': -1, 'message': 'Invalid userID for send offline invitation' });
        console.log("Invalid userID for send offline invitation");
    } else if (!(userID in tokenMap)) {
        res.json({ 'ret': -2, 'message': 'No fcm token for user: ' + userID });
        console.log('No fcm token for user: ' + userID);
    } else {
        const messaging = admin.messaging()
        var payload = {
            token: tokenMap[userID],
            notification: {
                title: 'You have a new call!',
                body: `${req.body.callerUserName} is calling you.`
            },
            data: req.body,
        };
        console.log("Plyload: ", payload)


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
        const messaging = admin.messaging();
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
        console.log("Plyload: ", payload)


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
app.post('/call_invite', jsonBodyParser, sendOfflineInvitation);
app.post('/group_call_invite', jsonBodyParser, sendGroupCallInvitation);

app.listen(PORT, function () {
    console.log('Service URL http://127.0.0.1:' + PORT + "/");
    console.log('Token request, /access_token?uid=[user id]');
    console.log('Token with expiring time request, /access_token?uid=[user id]&expiredTs=[expire ts]');
});
