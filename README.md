# united

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

This is code for an [AWS Lambda](https://aws.amazon.com/lambda) function only. If you want
to integrate this into your Slack team, follow the following steps:

### Prerequisites

* An account with [Amazon Web Services](https://aws.amazon.com) (AWS).
* Access to a (willing) Slack team where you can create internal integrations.

Ensure you are logged into AWS and Slack before continuing.

### Create an App with Slack

We start by creating an app with Slack and setting up the correct permissions.
We will actually install the app later.

1. In [Slack](https://api.slack.com/apps), choose "Create New App". Name it
something sensible (like "United") and choose a team, then choose "Create App".
2. In the side bar, choose "OAuth & Permissions".
3. Under "Permission Scopes", choose the following permissions, then choose
"Save Changes":
    * Access information about user's public channels. (channels:read)
    * Modify your public channels. (channels:write)
    * Access information about user's private channels. (groups:read)
    * Modify your private channels. (groups:write)

### Create a New Lambda

The next step is to take the code in this repository and upload it to AWS Lambda.
The great thing about Lambda is that you'll only get charged for what you use,
so your bill should be very low (if not, free).

1. In [AWS](https://console.aws.amazon.com), under "Compute", choose "Lambda".
2. Choose "Create a Lambda Function".
3. In the side bar, choose "Configure triggers".
4. Click on the grey box, and under integrations, choose "API Gateway":  

   ![](http://i.imgur.com/8YZd6yn.png)  

   This should expand some more settings. Under security, change the value to
   "Open". This allows your Lambda to be openly available to the world. Choose
   "Next".

5. Under "Configure function", name your Lambda something sensible (like "United"),
and ensure the runtime is still set to "Node.js 6.10".
6. Under "Lambda function code", in the "Code entry type" dropdown, choose
"Upload a .ZIP file". Choose "Upload", and select the .zip file found in this
repo from the file picker. If you would like, you can zip the code yourself by
running the following Bash command within this repository:
   ```
   $ yarn && zip -r ../united.zip *
   ```
7. Under "Lambda function handler and role", choose an appropriate role. If you
don't have any AWS IAM roles, choose "Create new role from template(s)".
    * If you choose "Create new role from template(s)", name the role something
    sensible (it will be registered in your AWS IAM), and under policy templates,
    choose "Simple Microservice permissions" and "KMS decryption permissions".
8. Uncollapse "Advanced settings", under "Timeout", choose "10 secs". Choose "Next".
9. Review your settings, then choose "Create function".

### Create an Endpoint For Your Lambda

When someone invokes `/united` in Slack, Slack will send a POST request to whatever
backend you specify and expect a result. Here, we will use AWS API Gateway to
forward POST requests to your Lambda.

1. In [AWS](https://console.aws.amazon.com), under "Application Services", choose
"API Gateway".
2. You should have an API called "LambdaMicroservice". Choose it.
3. Since you may decide to make more cool Lambda functions in the future, it's
helpful to organize your resource tree into something scalable.
    * Choose "Actions", then "Create Resource".
    * Name your resource "Slack", then choose "Create Resource".
    * Select the `/slack` resource, and create another resource called `/united`.
    You should wind up with something like this:

    ![](http://i.imgur.com/b82RbIW.png)  

4. Choose the `/united` resource. Choose "Actions", then "Create Method".
5. A small dropdown will appear in the side bar. Choose "POST", then click the tick.
6. Ensure "Integration type" is set to "Lambda Function", and choose the region
your Lambda function is located from the dropdown (it's usually us-east-1). A new
text box will appear. Type the name of your Lambda function, then choose "Save".
7. When Slack sends a POST request, it's going to do so using
`application/x-www-form-urlencoded`, which is something API Gateway can't handle
out of the box. Let's fix this:
    * From the flowchart, choose "Integration Request".
    * Decollapse "Body Mapping Templates", under "Request body passthrough",
    choose "When no template matches the request Content-Type header".
    * Under "Content-Type", choose "Add mapping template".
    * Paste the following code into the text field, then press "Save":
    ```
    {
        "postBody" : $input.json("$")
    }
    ```
    This will allow you to access the url encoded arguments via `postBody`
    in your Lambda function, where you can use snazzy Node libraries to parse it.
8. Choose the `/` resource, then choose "Actions", then choose "Deploy API".
9. Under "Deployment stage", choose "[New Stage]". Name the new stage something
sensible (like "prod"), then choose "Deploy".
10. You'll be taken to the "Stages" tab in the side bar. Note the URL. This is
the URL you'll use to hit your Lambda function.

### Register and Encrypt Your Team's Access Token

Your access token is a special string of characters that allows access to your
app using the permissions we described above. In this step, we will configure
an environment variable for your Lambda that contains the encrypted access token.

>   ***WARNING***  
>   Never share your access token with anyone. Never commit or hardcode access
>   tokens. Always encrypt access tokens and secrets, even ones stored in an environment
>   variable.

1. In [Slack](https://api.slack.com/apps), choose "Slash Commands". Choose
"Create New Command".
2. Type "/united" for the new command. If you followed my steps perfectly, your
URL will be the base that was given to you at the last step of the last section,
plus `/slack/united`. Adjust this to how you set it up.
3. Give a good description (I like "Make room in an overbooked Slack channel for
higher paying customers and crew."), then choose "Save".
4. In the side bar, choose "Install App", then choose "Install App". This will perform
the OAuth within Slack. Authorize the app:

   ![](http://i.imgur.com/nXLDhqE.png)

5. You will be given an access token. Copy it to your clipboard.
6. In [AWS](https://console.aws.amazon.com), go to your Lambda function.
7. Under the "Code" tab, under "Environment variables", create a new variable whose
key is `ACCESS_TOKEN` and whose value is your access token.
8. Tick the "Enable encryption helpers" box.
9. Under "Encryption key", choose an appropriate KWS key. If you don't have a key,
you will need to access AWS IAM to make one:
   * In [AWS](https://console.aws.amazon.com), under "Security, Identity & Compliance",  choose "IAM".
   * From the side bar, choose "Encryption keys". Choose "Create key".
   * Name the key something sensible, then choose "Next Step".
   * Skip the "Add Tags" step by choosing "Next Step".
   * Under "Define Key Administrative Permissions", choose IAM roles you would like to use
   as admins for your KWS key, then choose "Next Step".
   * Under "Define Key Usage Permissions", choose at least the same IAM role you
   assigned to your Lambda function, then choose "Next Step".
   * Review your new key policy, then choose "Finish".
10. Once you have chosen a KWS key, choose "Encrypt".
11. Choose "Save".

### Test

You should now be able to use `/united` in a Slack channel and watch it work.
Congrats! Don't you dare appologize for what you did, its fine.
