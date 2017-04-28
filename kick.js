'use strict';

//
//  jballands/united
//  kick.js
//
//  An AWS Lambda function that kicks a user from a Slack channel after a timeout
//  period has passed.
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

const MIN_TIMEOUT = 3000;
const MAX_TIMEOUT = 12000;

// -----------------------------------------------------------------------------
//  LAMBDA
// -----------------------------------------------------------------------------

exports.handler = (event, context, callback) => {
    const channel = event.channel;
    const user = event.user;

    getAccessToken()
        .then(() => randomTimeout(MIN_TIMEOUT, MAX_TIMEOUT))
        .then(() => kickMember(decrypted, channel, user))
        .catch(err => console.error(err));
};

// -----------------------------------------------------------------------------
//  HELPERS
// -----------------------------------------------------------------------------

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

function randomTimeout(minTime, maxTime) {
    return new Promise((resolve, reject) => {
        const timeout = _random(minTime, maxTime);
        setTimeout(() => resolve(), timeout);
    });
}

function kickMember(accessToken, channel, user) {
    return new Promise((resolve, reject) => {
        const args = {
            token: accessToken,
            channel: channel,
            user: user
        };

        const visibility = channel.startsWith('G') ?
            { endpoint: 'groups.kick', raw: 'group' } :
            { endpoint: 'channels.kick', raw: 'channel' };

        axios.post(`https://slack.com/api/${visibility.endpoint}?${qs.stringify(args)}`)
            .then(res => {
                const data = res.data;
                if (data.ok !== true) {
                    console.error(`Response was not ok!! ${JSON.stringify(data)}`);
                    return reject(data.error);
                }
                return resolve();
            })
            .catch(err => reject(err));
    });
}
