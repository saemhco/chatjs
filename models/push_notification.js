// var apn = require('apn');
var admin = require('firebase-admin')
var serviceAccount = require('../../storage/files/peacefulparent-faf64-firebase-adminsdk-swrxk-2ffd86a4e9.json');

class PushNotification {
    constructor(options) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    async send(deviceToken, data) {
        try {
            await admin.messaging().send({
                notification: {
                    title: String(data.body).startsWith('kSignalingMessageUpdateSettings') ? 'Your Contact Settings have changed.' : data.message,
                    body: '',
                    //sound: 'default',
                },
                apns: { payload: { aps: { sound: 'bingbong.aiff', badge: parseInt(data.badge) || 0 } } },
                data: data.custom_data,
                token: deviceToken
            }).then(res => {
                console.log('success', res, 'end_success')
            }, err => {
                console.log('error', err, 'end_err');
            }).catch(error => {
                console.log('catch', error, 'end_catch');
            })
        } catch (error) {
            console.log(error);
        }
    }

};
module.exports = { PushNotification }