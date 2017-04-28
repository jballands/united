'use strict';

//
//  jballands/united
//  alert.js
//
//  An AWS Lambda function that selects a user from a Slack channel at random
//  and sends the selection to jballands/united/kick.
//
//  © 2017 Jonathan Ballands
//

const aws = require('aws-sdk');
const axios = require('axios');
const process = require('process');
const _random = require('lodash.random');
const qs = require('querystring');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const KICK_LAMBDA_NAME = process.env.KICK_LAMBDA_NAME;
let decrypted;

const catchphrase = 'u stay in the seato, u get a beato';

// -----------------------------------------------------------------------------
//  LAMBDA
// -----------------------------------------------------------------------------

exports.handler = (event, context, callback) => {
    const params = qs.parse(event.postBody)
    const channel = params['channel_id'];

    getAccessToken()
        .then(() => getChannelMembers(decrypted, channel))
        .then(members => chooseRandomMember(members))
        .then(member => kickMember(channel, member))
        .then(member => callback(null, {
            response_type: 'in_channel',
            text: `<@${member}>, ${catchphrase}`
        }))
        .catch(err => {
            console.error(err);
            return callback(null, {
                response_type: 'ephemeral',
                text: err
            });
        });
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

function getChannelMembers(accessToken, channel) {
    return new Promise((resolve, reject) => {
        const args = {
            token: accessToken,
            channel: channel
        };

        const visibility = channel.startsWith('G') ?
            { endpoint: 'groups.info', raw: 'group' } :
            { endpoint: 'channels.info', raw: 'channel' };

        axios.post(`https://slack.com/api/${visibility.endpoint}?${qs.stringify(args)}`)
            .then(res => {
                const data = res.data;
                if (data.ok !== true) {
                    console.error(`Response was not ok!! ${JSON.stringify(data)}`);
                    return reject('There was an error fetching the members of this channel. Try again?');
                }

                return resolve(data[visibility.raw].members);
            })
            .catch(err => reject(err));
    });
}

function chooseRandomMember(members) {
    return new Promise((resolve, reject) => {
        if (!members.length || members.length <= 0) {
            return reject('There are no members of this channel.');
        }
        if (members.length === 1) {
            return reject('You are the only member of this channel.');
        }
        return resolve(members[_random(members.length - 1)]);
    });
}

function kickMember(channel, user) {
    return new Promise((resolve, reject) => {
        const kickLambda = new aws.Lambda();
        const params = {
            FunctionName: KICK_LAMBDA_NAME,
            Payload: JSON.stringify({ channel: channel, user: user }),
            InvocationType: 'Event'
        };

        kickLambda.invoke(params).send();
        resolve(user);
    });
}
