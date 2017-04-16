'use strict';

//
//  jballands/united
//  index.js
//
//  An AWS Lambda function that makes room in an overbooked Slack channel for
//  higher paying customers and crew, whether you like it or not.
//
//  © 2017 Jonathan Ballands
//

const aws = require('aws-sdk');
const axios = require('axios');
const process = require('process');
const _random = require('lodash.random');
const qs = require('querystring');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
let decrypted;

const catchphrase = 'U stay in the seato, u get a beato';

// -----------------------------------------------------------------------------
//  LAMBDA
// -----------------------------------------------------------------------------

exports.handler = (event, context, callback) => {
    const params = qs.parse(event.postBody)
    const channelId = params['channel_id'];

    // U stay in the seato, u get a beato
    getAccessToken()
        .then(token => {
            return getChannelMembers(decrypted, channelId);
        })
        .then(members => chooseRandomMember(members))
        .then(() => {
            callback(null, {
                response_type: 'in_channel',
                text: catchphrase
            });
        })
        .then(memberId => kickMember(decrypted, channelId, memberId))
        .catch(err => {
            console.error(err);
            callback(null, err);
        });
};

// -----------------------------------------------------------------------------
//  HELPERS
// -----------------------------------------------------------------------------

//
//  Returns a promise that will either resolve the app secret or throw an error.
//
function getAccessToken() {
    return new Promise((resolve, reject) => {
        if (decrypted) {
            return resolve(decrypted);
        }
        else {
            const kms = new aws.KMS();
            kms.decrypt({ CiphertextBlob: new Buffer(ACCESS_TOKEN, 'base64') }, (err, data) => {
                if (err) {
                    console.error('Decrypt error: ', err);
                    return reject(err);
                }
                decrypted = data.Plaintext.toString('ascii');
                return resolve(decrypted);
            });
        }
    });
}

//
//  Returns a promise that will either resolve to members or a channel or throw up.
//
function getChannelMembers(accessToken, channelId) {
    return new Promise((resolve, reject) => {
        const args = {
            token: accessToken,
            channel: channelId
        };

        const visibility = channelId.startsWith('G') ?
            { endpoint: 'groups.info', raw: 'group' } :
            { endpoint: 'channels.info', raw: 'channel' };

        axios.post(`https://slack.com/api/${visibility.endpoint}?${qs.stringify(args)}`)
            .then(res => {
                const data = res.data;
                if (data.ok !== true) {
                    console.error(`Response was not ok!! ${JSON.stringify(data)}`);
                    return reject('Arg. I couldn\'nt get the flight roster from Slack. Next time...');
                }

                return resolve(data[visibility.raw].members);
            })
            .catch(err => reject(err));
    });
}

//
//  Returns a promise that will either return a memberId to kick or throw up everywhere.
//
function chooseRandomMember(members) {
    return new Promise((resolve, reject) => {
        if (!members.length || members.length <= 0) {
            return reject('I can\'t kick out people that don\'t exist.');
        }
        if (members.length === 1) {
            return reject('I can\'t kick you out if you\'re the only member of a channel (LOL).');
        }
        return resolve(members[_random(members.length - 1)]);
    });
}

//
//  Returns a promise that will either kick a member or throw up.
//
function kickMember(accessToken, channelId, userId) {
    return new Promise((resolve, reject) => {
        const args = {
            token: accessToken,
            channel: channelId,
            user: userId
        };

        const visibility = channelId.startsWith('G') ?
            { endpoint: 'groups.kick', raw: 'group' } :
            { endpoint: 'channels.kick', raw: 'channel' };

        axios.post(`https://slack.com/api/${visibility.endpoint}?${qs.stringify(args)}`)
            .then(res => {
                const data = res.data;
                if (data.ok !== true) {
                    console.error(`Response was not ok!! ${JSON.stringify(data)}`);

                    // If it chose the invoker, reject it with a funny message
                    if (data.error === 'cant_kick_self') {
                        return reject('Looks like you got chosen... Too bad Slack won\'t let me kick you out. Try again?');
                    }
                    return reject('I couldn\'nt kick anyone out for some reason...');
                }
                return resolve();
            })
            .catch(err => reject(err));
        });
}
