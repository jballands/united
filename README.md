# united

![](http://i.imgur.com/Ks3JNU5.gif)

Slack channel overbooked? Make room for higher paying customers and crew in Slack.

*© 2017 Jonathan Ballands*

## Usage

In the Slack channel you want to free up space in, invoke this slash command:

```
/united
```

This will call up the authorities to remove a random user from the Slack channel,
freeing up one spot. No need to feel bad about it! You're just doing your job.

## Installation

This repo is code for two [AWS Lambda](https://aws.amazon.com/lambda/) functions.Â
If you want to integrate this into your Slack team, follow the following steps:

### Prerequisites

* An account with [Amazon Web Services](https://aws.amazon.com/) (AWS)
* Access to a (willing) Slack team where you can create internal integrations

### Architecture

The following diagram illustrates from a high-level what we are trying to accomplish:

![](http://i.imgur.com/bo2hYIr.png)

### Setting Up Slack

`united` will be a simple Slack app that utilizes a slash command. We start by
creating the app and setting the correct permissions.

>   ***Note***  
>   You won't be able to use `united` unless you are in a private channel if you
>   are not an admin for your team. If you would like to use this in a public
>   channel, ask your admin to perform this step.

1. In the [Slack API](https://api.slack.com/), choose "Your Apps", then "Create
New App". Name it something sensible (like "United"), choose a team, then choose
"Create App".

2. In the side bar, choose "OAuth & Permissions". Under "Permission Scopes", select
the following permissions:
    * Access information about user's public channels. `(channels:read)`
    * Modify your public channels. `(channels:write)`
    * Access information about user's private channels. `(groups:read)`
    * Modify your private channels. `(groups:write)`

  Finally, choose "Save Changes".

### Create Two New Lambdas

The next step is to take the code in this repository and upload it to AWS Lambda.
We will create two lambda functions, one called `united-alert` and one called
`united-kick` (but the names don't exactly matter).

1. In [AWS](https://console.aws.amazon.com/console/home?region=us-east-1),
under "Compute", choose "Lambda".

2. Choose "Create a Lambda Function". You will do the next steps twice, once for
each Lambda function:

    a. In the side var, choose "Configure function". Name your function something
    sensible (like `united-alert` or `united-kick`, as long as you can distinguish
    between the alert Lambda and the kicking Lambda). Ensure the runtime is set to
    "Node.js 6.10".

    b. Under "Lambda function code", in the "Code entry type" dropdown, choose
    "Upload a .ZIP file". Choose "Upload", and select the .zip file found in this
    repo from the file picker. If you would like, you can zip the code yourself by
    running the following Bash command within this repository:

    ```
    $ yarn && zip -r ./united.zip *
    ```

    c. Under "Lambda function handler and role", choose an appropriate role that
    has at least the following policies:

    * CloudWatchLogsFullAccess
    * AWSLambdaRole
    * AmazonAPIGatewayInvokeFullAccess

  If you don't have any AWS IAM roles, you'll need to create one in AWS IAM that
    has these policies attached.

    d. Uncollapse "Advanced settings". Under "Timeout", if this Lambda will be
    equivalent to `united-alert`, choose "5 secs", and if this Lambda will be
    equivalent to `united-kick`, choose "15 secs".

    e. Choose "Next". Review your settings, then choose "Create function".

### Give Access To AWS Lambda Via AWS API Gateway

When someone invokes `/united` in Slack, Slack will send a POST request to
whatever backend you specify and expect a result. Here, we will use AWS API
Gateway to forward POST requests to your Lambda.

1. In [AWS](https://console.aws.amazon.com/console/home?region=us-east-1),
under "Application Services", choose "API Gateway".

2. Choose "Create API". Name it something sensible that you can use for all of
your future Lambda microservices, then choose "Create API".

3. Choose the root of the API. Create resources under the root until you have a
structure resembling `/slack/united`:

    * Choose "Actions", then "Create Resource".
    * Name your resource "Slack", then choose "Create Resource".
    * Select the `/slack` resource, and create another resource called `/united`.

4. Choose the `/united` resource, choose "Actions", then "Create Method".
Choose "POST" from the dropdown, then choose the tick.

5. Ensure "Integration type" is set to "Lambda Function", and choose the region
your `united-alert` Lambda function is located from the dropdown (it's usually
`us-east-1`). A new text box will appear. Type the name of the `united-alert`
Lambda function, then choose "Save". Your resource tree should look like this:

  ![](http://i.imgur.com/b82RbIW.png)

6. When Slack sends a POST request, it's going to do so using
`application/x-www-form-urlencoded`, which is something API Gateway can't handle
out of the box. Let's fix this:

    * From the flowchart, choose "Integration Request".
    * Decollapse "Body Mapping Templates", under "Request body passthrough",
    choose "When no template matches the request Content-Type header".
    * Under "Content-Type", choose "Add mapping template". Paste the following
    code into the text field:

    ```
    {
        "postBody" : $input.json("$")
    }
    ```
    This will allow you to access the url encoded arguments via `postBody` in your
    Lambda function, where you can use snazzy Node libraries to parse it.
    * Choose "Save".

7. Choose the `/` resource, then choose "Actions", then choose "Deploy API".

8. Under "Deployment stage", choose "[New Stage]". Name the new stage something
sensible (like "prod"), then choose "Deploy".

9. You'll be taken to the "Stages" tab in the side bar. Note the URL. This is the
URL you'll use to hit your Lambda function.

### Allow Slack & AWS Lambda To Talk

Your access token is a special string of characters that allows access to your app
using the permissions we described above. In this step, we will configure an
environment variable for your Lambda functions that contain the encrypted access
token.

>   ***WARNING***  
>   Never share your access token with anyone. Never commit or hardcode access
>   tokens. Always encrypt access tokens and secrets, even ones stored in an
>   environment variable.

1. In the [Slack API](https://api.slack.com/), choose "Slash Commands". Choose
"Create New Command".

2. Type "/united" for the new command. If you followed my steps perfectly, your
URL will be the base that was given to you at the last step of the last section,
plus `/slack/united`. Adjust this to how you set it up.

3. Give a good description (I like "Make room in an overbooked Slack channel for
higher paying customers and crew."), then choose "Save".

4. In the side bar, choose "Install App", then choose "Install App". This will
perform the OAuth within Slack. Authorize the app.

  ![](http://i.imgur.com/nXLDhqE.png)

5. You will be given an access token. Copy it to your clipboard.

6. In [AWS](https://console.aws.amazon.com/console/home?region=us-east-1), go
to AWS Lambda and for both Lambda functions:

    a. Under the "Code" tab, under "Environment variables", create a new variable
    whose key is `ACCESS_TOKEN` and whose value is your access token.

    b. Tick the "Enable encryption helpers" box. Under "Encryption key", choose an
    appropriate KWS key, then choose "Encrypt". If you don't have a key, you will
    need to access AWS IAM to make one.

    c. If this is the `united-alert` Lambda function, create a second variable
    whose key is `KICK_LAMBDA_NAME` and whose value is the ARN of your `united-kick`
    Lambda function.

    d. Choose "Save".

### Test

You should now be able to use `/united` in a Slack channel and watch it work.
Congrats! If it doesn't work, here are some common reasons:

**You didn't encrypt your access token correctly.**  
You must encrypt your access token for both Lambda functions using a KWS key from
IAM.

**You didn't set up your API correctly in API Gateway.**  
Ensure the method for your endpoint is set to POST and that the you used the
mapping template described in this README.

**Your Slack permissions aren't correct.**  
Use the Slack permissions described in this README.

**Your IAM role has the wrong policies attached.**  
Use only the policy templates described in this README.
