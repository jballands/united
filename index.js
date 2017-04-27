'use strict';

//
//  jballands/united
//  index.js
//
//  An AWS Lambda function that
//
//  © 2017 Jonathan Ballands
//

const aws = require('aws-sdk');
const axios = require('axios');
const process = require('process');
const qs = require('querystring');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const ALERT_ENDPOINT = process.env.ALERT_ENDPOINT;
let decrypted;

// -----------------------------------------------------------------------------
//  LAMBDA
// -----------------------------------------------------------------------------

exports.handler = (event, context, callback) => {
    const params = qs.parse(event.postBody)
    const channel = params['channel_id'];

    getAccessToken()
        .then(() => getChannelMembers(decrypted, channel))
        .then(members => chooseRandomMember(members))
        .then(member => kickMember(decrypted, channel, member))
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
