/**
 * Recieve a POST from Amazon SNS
 */

function process_ses_bounce_notification(json_message) {
    var payload = {};
    var bounce = json_message.bounce;
    var recipients = [];
    bounce.bouncedRecipients.forEach(function(recipient) {
        recipients.push(recipient.emailAddress);
    });
    var message = "Email bounced from "+json_message.mail.source+" to "+recipients.join(", ");

    var attachments = [
        {
            "fallback": message,
            "text" : message,
            "color": "warning",
            "fields": [
                {
                    "title": "Recipients",
                    "value": recipients.join(", "),
                    "short": true
                },
                {
                    "title": "Sender",
                    "value": json_message.mail.source,
                    "short": true
                },
                {
                    "title": "Bounce type",
                    "value": bounce.bounceType + " - " + bounce.bounceSubType,
                    "short": false
                }
            ]
        }
    ];

    if (bounce.bouncedRecipients[0].diagnosticCode) {
        attachments[0]["fields"].push(
            {
                "title": "Diagnostic",
                "value": bounce.bouncedRecipients[0].diagnosticCode,
                "short": false
            }
        );
    }

    payload["attachments"] = attachments;
    payload['text'] = message;

    return payload;
}

function process_ses_complaint_notification(json_message) {
    var payload = {};
    var complaint = json_message.complaint;
    var recipients = [];
    complaint.complainedRecipients.forEach(function(recipient) {
        recipients.push(recipient.emailAddress);
    });
    var message = "Email complaint from "+json_message.mail.source+" to "+recipients.join(", ");

    var attachments = [
        {
            "fallback": message,
            "text" : message,
            "color": "warning",
            "fields": [
                {
                    "title": "Recipients",
                    "value": recipients.join(", "),
                    "short": true
                },
                {
                    "title": "Sender",
                    "value": json_message.mail.source,
                    "short": true
                }
            ]
        }
    ];

    if (complaint.complaintFeedbackType) {
        attachments[0]["fields"].push(
            {
                "title": "Complain type",
                "value": complaint.complaintFeedbackType,
                "short": true
            }
        );
    }

    payload["attachments"] = attachments;
    payload['text'] = message;

    return payload;
}

function process_ses_delivery_notification(json_message) {
    var payload = {};
    var mail = json_message.mail;
    var message = "Email delivery from "+mail.source+" to "+mail.destination.join(", ");

    attachments = [
        {
            "fallback": message,
            "text" : message,
            "color": "good",
            "fields": [
                {
                    "title": "Recipients",
                    "value": mail.destination.join(", "),
                    "short": true
                },
                {
                    "title": "Sender",
                    "value": mail.source,
                    "short": true
                },
                {
                    "title": "Result",
                    "value": json_message.delivery.smtpResponse,
                    "short": false
                }
            ]
        }
    ];

    payload["attachments"] = attachments;
    payload['text'] = message;

    return payload;
}

function process_autoscale_notification(message, json_message) {
    var payload = {
        'text': message
    };

    if (json_message.Event == "autoscaling:TEST_NOTIFICATION") {
        return payload
    }

    attachments = [
        {
            "fallback": message,
            "text" : message,
            "color": "good",
            "fields": [
                {
                    "title": "Description",
                    "value": json_message.Description,
                    "short": true
                },
                {
                    "title": "Cause",
                    "value": json_message.Cause,
                    "short": false
                }
            ]
        }
    ];

    if (json_message.Details && json_message.Details.InvokingAlarms) {
        attachments[0]['fields'].push(
            {
                "title": "Alarm",
                "value": json_message.Details.InvokingAlarms[0].AlarmName,
                "short": true
            }
        );
        attachments[0]['fields'].push(
            {
                "title": "Alarm reason",
                "value": json_message.Details.InvokingAlarms[0].NewStateReason,
                "short": false
            }
        );
    }

    payload["attachments"] = attachments;

    return payload;
}

function process_alarm_notification(message, json_message) {
    var payload = {};

    payload['text'] = message;
    payload['attachments'] = [
        {
            "fallback": message,
            "text" : message,
            "color": json_message.NewStateValue == "ALARM" ? "warning" : "good",
            "fields": [
                {
                    "title": "Alarm",
                    "value": json_message.AlarmName,
                    "short": true
                },
                {
                    "title": "Status",
                    "value": json_message.NewStateValue,
                    "short": true
                },
                {
                    "title": "Reason",
                    "value": json_message.NewStateReason,
                    "short": false
                }
            ]
        }
    ];

    return payload;
}

function send_message_to_slack(request, res, payload) {
    var slackUrl;

    if (typeof process.env.SLACK_WEBHOOK_URL != "undefined") {
        slackUrl = process.env.SLACK_WEBHOOK_URL;
    } else {
        slackUrl =
            'https://' +
            process.env.SLACK_COMPANY_NAME +
            '.slack.com/services/hooks/incoming-webhook?token=' +
            process.env.SLACK_TOKEN;
    }

    console.log("Sending message to Slack", payload['text'], slackUrl);
    request.post(
        slackUrl,
        {
            form: {
                "payload": JSON.stringify(payload)
            }
        },
        function (err, result, body) {
            if (err) {
                console.log("Error sending message to Slack", err, slackUrl, body);
                return res.send('Error', 500);
            }

            console.log("Sent message to Slack", slackUrl);

            res.send('Ok');
        }
    );
}

function complete_slack_payload(payload, json_message, ses_notification) {
    if (typeof process.env.SLACK_USERNAME != "undefined") {
        payload["username"] = process.env.SLACK_USERNAME;
    }

    if (typeof process.env.SLACK_ICON_URL != "undefined") {
        payload["icon_url"] = process.env.SLACK_ICON_URL;
    }

    if (typeof process.env.SLACK_ICON_EMOJI != "undefined") {
        payload["icon_emoji"] = process.env.SLACK_ICON_EMOJI;
    }

    if (typeof process.env.SLACK_CHANNEL != "undefined") {
        payload["channel"] = process.env.SLACK_CHANNEL;
    }

    if (ses_notification) {
        if (typeof process.env.SLACK_SES_USERNAME != "undefined") {
            payload["username"] = process.env.SLACK_SES_USERNAME;
        }

        if (typeof process.env.SLACK_SES_ICON_URL != "undefined") {
            payload["icon_url"] = process.env.SLACK_SES_ICON_URL;
        }

        if (typeof process.env.SLACK_SES_ICON_EMOJI != "undefined") {
            payload["icon_emoji"] = process.env.SLACK_SES_ICON_EMOJI;
        }

        if (typeof process.env.SLACK_SES_CHANNEL != "undefined") {
            payload["channel"] = process.env.SLACK_SES_CHANNEL;
        }
    }

    if (json_message.SlackOptions) {
        if (json_message.SlackOptions.Channel) {
            payload['channel'] = json_message.SlackOptions.Channel;
        }

        if (json_message.SlackOptions.Username) {
            payload['username'] = json_message.SlackOptions.Username;
        }

        if (json_message.SlackOptions.IconEmoji) {
            payload['icon_emoji'] = json_message.SlackOptions.IconEmoji;
        }

        if (json_message.SlackOptions.IconURL) {
            payload['icon_url'] = json_message.SlackOptions.IconURL;
        }
    }


    payload["subtype"] = "bot_message";

    return payload;
}

exports.index = function(req, res) {
    var request = require('request');

    var sns = JSON.parse(req.text);
    console.log(req.text);

    // Is this a subscribe message?
    if (sns.Type == 'SubscriptionConfirmation') {
        request(sns.SubscribeURL, function (err, result, body) {
            if (err || body.match(/Error/)) {
                console.log("Error subscribing to Amazon SNS Topic", body);
                return res.send('Error', 500);
            }

            console.log("Subscribed to Amazon SNS Topic: " + sns.TopicArn);
            res.send('Ok');
        });
    } else if (sns.Type == 'Notification') {
        var message = '';
        var ses_notification = false;
        var payload = {
            "subtype": "bot_message",
            "text": ""
        };
        if (sns.Subject === undefined) {
            message = JSON.stringify(sns.Message);
        } else {
            message = sns.Subject;
        }

        var json_message = JSON.parse(sns.Message);
        if (json_message.AlarmName) {
            payload = process_alarm_notification(message, json_message);
        } else if (json_message.notificationType == "AmazonSnsSubscriptionSucceeded") {
            message = json_message.message;
        } else if (json_message.notificationType == "Bounce") {
            ses_notification = true;
            payload = process_ses_bounce_notification(json_message);
        } else if (json_message.notificationType == "Complaint") {
            ses_notification = true;
            payload = process_ses_complaint_notification(json_message);
        } else if (json_message.notificationType == "Delivery") {
            ses_notification = true;
            payload = process_ses_delivery_notification(json_message);
        } else if (json_message.Service == "AWS Auto Scaling") {
            payload = process_autoscale_notification(message, json_message);
        } else {
            payload['text'] = message;
        }

        payload = complete_slack_payload(payload, json_message, ses_notification);

        send_message_to_slack(request, res, payload);
    }
};
