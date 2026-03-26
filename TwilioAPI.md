# Quickstart: Send and receive WhatsApp messages

In this quickstart, you'll create an app that uses the WhatsApp Business Platform with Twilio to send and receive messages. You don't need to wait for WhatsApp sender registration because you'll use the [Twilio Sandbox for WhatsApp](/docs/whatsapp/sandbox) as your sender.

You'll access the Programmable Messaging REST API and build an app using your preferred programming language with the Twilio server-side SDKs.

## Prerequisites

Select your programming language and complete the prerequisites:

## Python

* Get a [WhatsApp account](https://www.whatsapp.com) and install WhatsApp on your device.
* Install [Python](https://www.python.org/downloads/).
* Install [Flask](https://flask.palletsprojects.com/) and [Twilio's Python SDK](https://github.com/twilio/twilio-python). To install using [pip](https://pip.pypa.io/), run:

  ```bash
  pip install flask twilio
  ```
* [Install and set up ngrok](https://ngrok.com/docs/getting-started/).

## Node.js

* Get a [WhatsApp account](https://www.whatsapp.com/) and install WhatsApp on your device.
* Install [Node.js](https://nodejs.org/).
* Install [Express](https://expressjs.com/) and the [Twilio Node.js SDK](https://github.com/twilio/twilio-node):

  ```bash
  npm install express twilio
  ```
* Install and set up [ngrok](https://ngrok.com/docs/getting-started/).

## PHP

* Get a [WhatsApp account](https://www.whatsapp.com/) and install WhatsApp on your device.
* Install [PHP](https://www.php.net/downloads.php).
* Install dependencies with Composer:

  1. Install [Composer](https://getcomposer.org/doc/00-intro.md).
  2. Install the [Twilio PHP SDK](https://github.com/twilio/twilio-php):

     ```bash
     composer require twilio/sdk
     composer install
     ```
* Install and set up [ngrok](https://ngrok.com/docs/getting-started/).

## C# (.NET Framework)

* Get a [WhatsApp account](https://www.whatsapp.com/) and install WhatsApp on your device.
* Download [Visual Studio 2019 or later](https://visualstudio.microsoft.com/downloads/).
* Install and set up [ngrok](https://ngrok.com/docs/getting-started/).

## Java

* Get a [WhatsApp account](https://www.whatsapp.com/) and install WhatsApp on your device.
* Install [Java Standard Edition (SE) Development Kit](https://www.oracle.com/java/technologies/downloads/).
* Download the [Twilio Java SDK](https://github.com/twilio/twilio-java) fat jar file with all dependencies:
  1. Navigate to the [Maven repository for the Twilio Java SDK](https://mvnrepository.com/artifact/com.twilio.sdk/twilio).
  2. Click the most recent version number.
  3. In the **Files** row, click **View All**.
  4. Click the file ending in `jar-with-dependencies.jar`.
  5. Create a project directory for this quickstart and move the fat jar from your downloads into the new project directory.
* Install [IntelliJ IDEA Community Edition](https://www.jetbrains.com/idea/download/?section=mac#).
* Install and set up [ngrok](https://ngrok.com/docs/getting-started/).

## curl

* Get a [WhatsApp account](https://www.whatsapp.com/) and install WhatsApp on your device.
* [curl](https://curl.se/) is installed by default on macOS, Windows, and on most Linux distributions. Run `curl --version` from your terminal to check.

## Go

* Get a [WhatsApp account](https://www.whatsapp.com/) and install WhatsApp on your device.
* Install [Go](https://go.dev/doc/install).
* Install and set up [ngrok](https://ngrok.com/docs/getting-started/).

## Ruby

* Get a [WhatsApp account](https://www.whatsapp.com/) and install WhatsApp on your device.
* Install [Ruby](https://www.ruby-lang.org/en/documentation/installation/).
* Install [Sinatra](https://github.com/sinatra/sinatra) and the [Twilio Ruby SDK](https://github.com/twilio/twilio-ruby). Run the following command to create a Gemfile and add and install the gems:
  ```bash
  bundle init && bundle add sinatra twilio-ruby
  ```
* Install and set up [ngrok](https://ngrok.com/docs/getting-started/).

## Sign up for Twilio and activate the Sandbox

The Twilio Sandbox for WhatsApp (the Sandbox) acts as your WhatsApp sender. You can test messaging without waiting for your WhatsApp sender registration and verification.

1. [Sign up for Twilio](https://www.twilio.com/try-twilio).
2. Activate and connect to the Twilio Sandbox for WhatsApp:
   1. Go to the [Try WhatsApp page in the Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn), acknowledge the terms, and click **Confirm**.
   2. To connect your WhatsApp account to the Sandbox, send `join <your sandbox code>` to the Sandbox number, or scan the QR code with your mobile device and send the prepopulated message. The Sandbox replies to confirm that you've joined.

To disconnect from the Sandbox, reply to the message with `stop` or switch to a different Sandbox by messaging `join <other sandbox keyword>`.

## Set environment variables

You need your Twilio account credentials to send requests. Follow these steps to get your account credentials and set them as environment variables.

## macOS Terminal

1. Go to the [Twilio Console](https://www.twilio.com/console).
2. Copy your **Account SID** and set it as an environment variable using the following command. Replace *ACCOUNT\_SID* with your Account SID.
   ```bash
   export TWILIO_ACCOUNT_SID=ACCOUNT_SID
   ```
3. Copy your **Auth Token** and set it as an environment variable using the following command. Replace *AUTH\_TOKEN* with your Auth Token.
   ```bash
   export TWILIO_AUTH_TOKEN=AUTH_TOKEN
   ```

## Windows command line

1. Go to the [Twilio Console](https://www.twilio.com/console).
2. Copy your **Account SID** and set it as an environment variable using the following command. Replace *ACCOUNT\_SID* with your Account SID.
   ```bash
   set TWILIO_ACCOUNT_SID=ACCOUNT_SID
   ```
3. Copy your **Auth Token** and set it as an environment variable using the following command. Replace *AUTH\_TOKEN* with your Auth Token.
   ```bash
   set TWILIO_AUTH_TOKEN=AUTH_TOKEN
   ```

## PowerShell

1. Go to the [Twilio Console](https://www.twilio.com/console).
2. Copy your **Account SID** and set it as an environment variable using the following command. Replace *ACCOUNT\_SID* with your Account SID.
   ```bash
   $Env:TWILIO_ACCOUNT_SID="ACCOUNT_SID"
   ```
3. Copy your **Auth Token** and set it as an environment variable using the following command. Replace *AUTH\_TOKEN* with your Auth Token.
   ```bash
   $Env:TWILIO_AUTH_TOKEN="AUTH_TOKEN"
   ```

## Send a WhatsApp message from the Sandbox

Send a message using one of the pre-approved message templates available from the Sandbox. This quickstart uses the Appointment Reminder template. Learn more about [business-initiated messages and templates](/docs/whatsapp/sandbox#business-initiated-messages-and-templates).

> \[!WARNING]
>
> WhatsApp Business Platform requires the use of a message template for business-initiated messages. Each time a user sends your business a message, you have a 24-hour customer service window in which to send free-form outbound messages without a template. Learn more about [customer service windows](/docs/whatsapp/key-concepts#customer-service-windows).

Follow these steps to send a message from the Sandbox number to your personal WhatsApp account:

## Python

1. Create and open a new file called `send_whatsapp.py` anywhere on your machine and paste in the following code:

   Send a message with WhatsApp, Twilio, and Python
   ```python
   # Download the helper library from https://www.twilio.com/docs/python/install
   import os
   from twilio.rest import Client
   import json

   # Find your Account SID and Auth Token at twilio.com/console
   # and set the environment variables. See http://twil.io/secure
   account_sid = os.environ["TWILIO_ACCOUNT_SID"]
   auth_token = os.environ["TWILIO_AUTH_TOKEN"]
   client = Client(account_sid, auth_token)

   message = client.messages.create(
       from_="whatsapp:+14155238886",
       to="whatsapp:+16285550100",
       content_sid="HXb5b62575e6e4ff6129ad7c8efe1f983e",
       content_variables=json.dumps({"1": "22 July 2026", "2": "3:15pm"}),
   )

   print(message.body)
   ```
2. Replace the value for `to` with the `whatsapp:` prefix and your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164). For example, `whatsapp:+16285550100`.
3. Save your changes and run this command from your terminal in the directory that contains `send_whatsapp.py`:

   ```bash
   python send_whatsapp.py
   ```

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## Node.js

1. Create and open a new file called `send_whatsapp.js` anywhere on your machine and paste in the following code:

   Send a message with WhatsApp, Twilio, and Node.js
   ```js
   // Download the helper library from https://www.twilio.com/docs/node/install
   const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

   // Find your Account SID and Auth Token at twilio.com/console
   // and set the environment variables. See http://twil.io/secure
   const accountSid = process.env.TWILIO_ACCOUNT_SID;
   const authToken = process.env.TWILIO_AUTH_TOKEN;
   const client = twilio(accountSid, authToken);

   async function createMessage() {
     const message = await client.messages.create({
       contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
       contentVariables: JSON.stringify({ 1: "22 July 2026", 2: "3:15pm" }),
       from: "whatsapp:+14155238886",
       to: "whatsapp:+16285550100",
     });

     console.log(message.body);
   }

   createMessage();
   ```
2. Replace the value for `to` with the `whatsapp:` prefix and your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164). For example, `whatsapp:+16285550100`.
3. Save your changes and run the following command from your terminal in the directory that contains `send_whatsapp.js`:

   ```bash
   node send_whatsapp.js
   ```

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## PHP

1. Create and open a new file called `send_whatsapp.php` in the project directory and paste in the following code:

   Send a message with WhatsApp, Twilio, and PHP
   ```php
   <?php

   // Update the path below to your autoload.php,
   // see https://getcomposer.org/doc/01-basic-usage.md
   require_once "/path/to/vendor/autoload.php";

   use Twilio\Rest\Client;

   // Find your Account SID and Auth Token at twilio.com/console
   // and set the environment variables. See http://twil.io/secure
   $sid = getenv("TWILIO_ACCOUNT_SID");
   $token = getenv("TWILIO_AUTH_TOKEN");
   $twilio = new Client($sid, $token);

   $message = $twilio->messages->create(
       "whatsapp:+16285550100", // To
       [
           "from" => "whatsapp:+14155238886",
           "contentSid" => "HXb5b62575e6e4ff6129ad7c8efe1f983e",
           "contentVariables" => json_encode([
               "1" => "22 July 2026",
               "2" => "3:15pm",
           ]),
       ]
   );

   print $message->body;
   ```
2. Replace the first argument to `$twilio->messages->create()` with your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164), prefixed by `whatsapp:`. For example, `whatsapp:+16285550100`.
3. Replace line 5 of `send_whatsapp.php` with the following:

   ```php
   require __DIR__ . '/vendor/autoload.php';
   ```
4. Save your changes and run this command from your terminal in the directory that contains `send_whatsapp.php`:

   ```bash
   php send_whatsapp.php
   ```

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## C# (.NET Framework)

1. Create and set up a new project in Visual Studio:
   1. Open Visual Studio and click **Create a new project**.
   2. Click **Console App (.NET Framework)**.
   3. Use the [NuGet Package Manager](https://learn.microsoft.com/en-us/nuget/consume-packages/install-use-packages-visual-studio) to install the Twilio REST API SDK.
2. Open the file in your new Visual Studio project called `Program.cs` and paste in the following code, replacing the existing template code:

   Send a message with WhatsApp, Twilio, and C# (.NET Framework)
   ```csharp
   // Install the C# / .NET helper library from twilio.com/docs/csharp/install

   using System;
   using Twilio;
   using Twilio.Rest.Api.V2010.Account;
   using System.Threading.Tasks;
   using System.Collections.Generic;
   using Newtonsoft.Json;

   class Program {
       public static async Task Main(string[] args) {
           // Find your Account SID and Auth Token at twilio.com/console
           // and set the environment variables. See http://twil.io/secure
           string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
           string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

           TwilioClient.Init(accountSid, authToken);

           var message = await MessageResource.CreateAsync(
               from: new Twilio.Types.PhoneNumber("whatsapp:+14155238886"),
               to: new Twilio.Types.PhoneNumber("whatsapp:+16285550100"),
               contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
               contentVariables: JsonConvert.SerializeObject(
                   new Dictionary<string, Object>() { { "1", "22 July 2026" }, { "2", "3:15pm" } },
                   Formatting.Indented));

           Console.WriteLine(message.Body);
       }
   }
   ```
3. Replace the value for `to: new Twilio.Types.PhoneNumber` with the `whatsapp:` prefix and your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164). For example, `whatsapp:+16285550100`.
4. Save your changes and run your project in Visual Studio.

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## Java

1. Create and open a new file called `Example.java` in the same directory as the fat jar file and paste in the following code:

   ```java
   import com.twilio.type.PhoneNumber;
   import java.util.HashMap;
   import com.twilio.Twilio;
   import com.twilio.rest.api.v2010.account.Message;
   import org.json.JSONObject;

   public class Example {
   	public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
   	public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");


   public static void main(String[] args) {
   	Twilio.init(ACCOUNT_SID, AUTH_TOKEN);

   	Message message =
   		Message.creator(
   				new PhoneNumber("whatsapp:+16285550100"),
   				new PhoneNumber("whatsapp:+14155238886"),
   				(String) null
   		)
   		.setContentSid("HXb5b62575e6e4ff6129ad7c8efe1f983e")
   		.setContentVariables(new JSONObject(new HashMap<String, Object>() {{
   				put("1", "22 July 2026");
   				put("2", "3:15pm");
   		}}).toString())
   		.create();

   	System.out.println(message.getSid());
   	}
   }
   ```
2. Replace the value for the first phone number (the recipient) with the `whatsapp:` prefix and your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164). For example, `whatsapp:+16285550100`.
3. Save your changes and compile the code from your terminal in the directory that contains `Example.java`. Replace `10.9.0` with the version of your fat jar file.

   ```bash
   javac -cp twilio-10.9.0-jar-with-dependencies.jar Example.java
   ```
4. Run the code. Replace `10.9.0` with the version of your fat jar file.

   On Linux or macOS, run:

   ```bash
   java -cp .:twilio-10.9.0-jar-with-dependencies.jar Example
   ```

   On Windows, run:

   ```bash
   java -cp ".;twilio-10.9.0-jar-with-dependencies.jar" Example
   ```

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## curl

1. Copy and paste the following code into your terminal:

   Send a message with WhatsApp, Twilio, and curl
   ```bash
   CONTENT_VARIABLES_OBJ=$(cat << EOF
   {
     "1": "22 July 2026",
     "2": "3:15pm"
   }
   EOF
   )
   curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
   --data-urlencode "From=whatsapp:+14155238886" \
   --data-urlencode "To=whatsapp:+16285550100" \
   --data-urlencode "ContentSid=HXb5b62575e6e4ff6129ad7c8efe1f983e" \
   --data-urlencode "ContentVariables=$CONTENT_VARIABLES_OBJ" \
   -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
   ```
2. Replace the value for `To` with the `whatsapp:` prefix and your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164). For example, `whatsapp:+16285550100`.
3. Press Enter to send the request.

   The JSON body of the request prints to your terminal.

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## Go

1. Create and set up your Go project.
   1. Create a new Go project by running the following command:

      ```bash
      go mod init twilio-example
      ```
   2. Install the [Twilio Go SDK](https://github.com/twilio/twilio-go):

      ```bash
      go get github.com/twilio/twilio-go
      ```
2. Create and open a new file called `send_whatsapp.go` in your Go project directory and paste in the following code:

   Send a message with WhatsApp, Twilio, and Go
   ```go
   // Download the helper library from https://www.twilio.com/docs/go/install
   package main

   import (
   	"encoding/json"
   	"fmt"
   	"github.com/twilio/twilio-go"
   	api "github.com/twilio/twilio-go/rest/api/v2010"
   	"os"
   )

   func main() {
   	// Find your Account SID and Auth Token at twilio.com/console
   	// and set the environment variables. See http://twil.io/secure
   	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
   	client := twilio.NewRestClient()

   	ContentVariables, ContentVariablesError := json.Marshal(map[string]interface{}{
   		"1": "22 July 2026",
   		"2": "3:15pm",
   	})

   	if ContentVariablesError != nil {
   		fmt.Println(ContentVariablesError)
   		os.Exit(1)
   	}

   	params := &api.CreateMessageParams{}
   	params.SetFrom("whatsapp:+14155238886")
   	params.SetTo("whatsapp:+16285550100")
   	params.SetContentSid("HXb5b62575e6e4ff6129ad7c8efe1f983e")
   	params.SetContentVariables(string(ContentVariables))

   	resp, err := client.Api.CreateMessage(params)
   	if err != nil {
   		fmt.Println(err.Error())
   		os.Exit(1)
   	} else {
   		if resp.Body != nil {
   			fmt.Println(*resp.Body)
   		} else {
   			fmt.Println(resp.Body)
   		}
   	}
   }
   ```
3. Replace the value for `params.SetTo` with the `whatsapp:` prefix and your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164). For example, `whatsapp:+16285550100`.
4. Save your changes and run this command in the directory that contains `send_whatsapp.go`:

   ```bash
   go run send_whatsapp.go
   ```

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## Ruby

1. Create and open a new file called `send_whatsapp.rb` anywhere on your machine and paste in the following code:

   Send a message with WhatsApp, Twilio, and Ruby
   ```ruby
   # Download the helper library from https://www.twilio.com/docs/ruby/install
   require 'twilio-ruby'

   # Find your Account SID and Auth Token at twilio.com/console
   # and set the environment variables. See http://twil.io/secure
   account_sid = ENV['TWILIO_ACCOUNT_SID']
   auth_token = ENV['TWILIO_AUTH_TOKEN']
   @client = Twilio::REST::Client.new(account_sid, auth_token)

   message = @client
             .api
             .v2010
             .messages
             .create(
               from: 'whatsapp:+14155238886',
               to: 'whatsapp:+16285550100',
               content_sid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
               content_variables: {
                   '1' => '22 July 2026',
                   '2' => '3:15pm'
                 }.to_json
             )

   puts message.body
   ```
2. Replace the value for `to` with the `whatsapp:` prefix and your personal WhatsApp number in [E.164 format](/docs/glossary/what-e164). For example, `whatsapp:+16285550100`.
3. Save your changes and run this command from your terminal in the directory that contains `send_whatsapp.rb`:

   ```bash
   ruby send_whatsapp.rb
   ```

After a few moments, you receive a WhatsApp message from the Sandbox to your personal WhatsApp account.

## Receive a WhatsApp message to the Sandbox and send an automated reply

When someone replies to one of your WhatsApp messages, you receive a [webhook](/docs/glossary/what-is-a-webhook) request from Twilio. To handle this request, you need to configure the webhook, create a web application that responds to an incoming message with TwiML, and expose your application to the internet.

Follow these steps to have the Sandbox reply to a WhatsApp message that you send from your personal WhatsApp account:

## Python

1. Create and open a new file called `reply_whatsapp.py` anywhere on your machine and paste in the following code:

   ```python
   from flask import Flask, request, Response
   from twilio.twiml.messaging_response import MessagingResponse

   app = Flask(__name__)

   @app.route("/reply_whatsapp", methods=['POST'])
   def reply_whatsapp():
   	# Create a new Twilio MessagingResponse
   	resp = MessagingResponse()
   	resp.message("Message received! Hello again from the Twilio Sandbox for WhatsApp.")

   	# Return the TwiML (as XML) response
   	return Response(str(resp), mimetype='text/xml')

   if __name__ == "__main__":
   	app.run(port=3000)
   ```

   Save the file.
2. In a new terminal window, run the following command to start the Python development server on port 3000:

   ```bash
   python reply_whatsapp.py 
   ```
3. In a new terminal window, run the following command to start ngrok and create a tunnel to your localhost:

   ```bash
   ngrok http 3000
   ```

   > \[!WARNING]
   >
   > Use ngrok only for testing because it creates a temporary URL that exposes your local development machine to the internet. Host your application with a cloud provider or your public server when you deploy to production.
4. Set up a webhook that triggers when the Sandbox receives a WhatsApp message:

   1. Open the [Try WhatsApp page in the Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
   2. Click **Sandbox settings**.
   3. In the **Sandbox Configuration** section, in the **When a message comes in** field, enter the temporary forwarding URL from your ngrok console with `/reply_whatsapp` appended to the end.

      For example, if your ngrok console shows `Forwarding https://1aaa-123-45-678-910.ngrok-free.app`, enter `https://1aaa-123-45-678-910.ngrok-free.app/reply_whatsapp`.
   4. Click **Save**.
5. With the Python development server and ngrok running, send a WhatsApp message to the Sandbox number from your personal WhatsApp account.

An HTTP request shows in your ngrok console, and you receive the response message in your personal WhatsApp account.

## Node.js

1. Create and open a new file called `server.js` anywhere on your machine and paste in the following code:

   Respond to an incoming WhatsApp message with Node.js

   ```js
   const express = require('express');
   const { MessagingResponse } = require('twilio').twiml;

   const app = express();

   app.post('/whatsapp', (req, res) => {
     const twiml = new MessagingResponse();

     twiml.message('Message received! Hello again from the Twilio Sandbox for WhatsApp.');

     res.type('text/xml').send(twiml.toString());
   });

   app.listen(3000, () => {
     console.log('Express server listening on port 3000');
   });
   ```
2. In a new terminal window, start the Node.js development server on port 3000 by running this command in the directory that contains `server.js`:

   ```bash
   node server.js
   ```
3. In a new terminal window, run the following command to start ngrok and create a tunnel to your localhost:

   ```bash
   ngrok http 3000
   ```

   > \[!WARNING]
   >
   > Use ngrok only for testing because it creates a temporary URL that exposes your local development machine to the internet. Host your application with a cloud provider or your public server when you deploy to production.
4. Set up a webhook that triggers when the Sandbox receives a WhatsApp message:

   1. Open the [Try WhatsApp page in the Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
   2. Click **Sandbox settings**.
   3. In the **Sandbox Configuration** section, in the **When a message comes in** field, enter the temporary forwarding URL from your ngrok console with `/whatsapp` appended to the end.

      For example, if your ngrok console shows `Forwarding https://1aaa-123-45-678-910.ngrok-free.app`, enter `https://1aaa-123-45-678-910.ngrok-free.app/whatsapp`.
   4. Click **Save**.
5. With the Node.js development server and ngrok running, send a WhatsApp message to the Sandbox number from your personal WhatsApp account.

An HTTP request shows in your ngrok console, and you receive the response message in your personal WhatsApp account.

## PHP

1. Create and open a new file called `reply_whatsapp.php` in the same directory as `send_whatsapp.php` and paste in the following code:

   ```php
   <?php
   require_once "vendor/autoload.php";
   use Twilio\TwiML\MessagingResponse;

   // Set the content-type to XML to send back TwiML from the PHP SDK
   header("content-type: text/xml");

   $response = new MessagingResponse();
   $response->message(
   	"Message received! Hello again from the Twilio Sandbox for WhatsApp."
   );

   echo $response;
   ```

   Save the file.
2. In a new terminal window, start the PHP development server on port 3000 by running this command:

   ```bash
   php -S localhost:3000 reply_whatsapp.php
   ```
3. In a new terminal window, run the following command to start ngrok and create a tunnel to your localhost:

   ```bash
   ngrok http 3000
   ```

   > \[!WARNING]
   >
   > Use ngrok only for testing because it creates a temporary URL that exposes your local development machine to the internet. Host your application with a cloud provider or your public server when you deploy to production.
4. Set up a webhook that triggers when the Sandbox receives a WhatsApp message:

   1. Open the [Try WhatsApp page in the Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
   2. Click **Sandbox settings**.
   3. In the **Sandbox Configuration** section, in the **When a message comes in** field, enter the temporary forwarding URL from your ngrok console.

      For example, if your ngrok console shows `Forwarding https://1aaa-123-45-678-910.ngrok-free.app`, enter `https://1aaa-123-45-678-910.ngrok-free.app`.
   4. Click **Save**.
5. With the PHP development server and ngrok running, send a WhatsApp message to the Sandbox number from your personal WhatsApp account.

An HTTP request shows in your ngrok console, and you receive the response message in your personal WhatsApp account.

## C# (.NET Framework)

1. Create a new ASP.NET MVC Project in Visual Studio:
   1. Open Visual Studio and click **Create a new project**.
   2. Click **ASP.NET Web Application (.NET Framework)**.
   3. Click **MVC** to select the project type.
   4. Use the [NuGet Package Manager](https://learn.microsoft.com/en-us/nuget/consume-packages/install-use-packages-visual-studio) to install the Twilio.AspNet.Mvc package.
2. Create a new controller:
   1. Open the project directory.
   2. Right-click on the `Controllers` folder.
   3. Select **Add** > **Controller...** > **MVC 5 Controller - Empty**.
   4. Name the file `WhatsappController.cs`.
3. Paste the following code into `WhatsappController.cs`:

   ```cs
   // Code sample for ASP.NET MVC on .NET Framework 4.6.1+
   // In Package Manager, run:
   // Install-Package Twilio.AspNet.Mvc -DependencyVersion HighestMinor

   using Twilio.AspNet.Common;
   using Twilio.AspNet.Mvc;
   using Twilio.TwiML;

   namespace WebApplication1.Controllers
   {
   	public class WhatsappController : TwilioController
   	{
   		public TwiMLResult Index(WhatsappRequest incomingMessage)
   		{
   			var messagingResponse = new MessagingResponse();
   			messagingResponse.Message("Message received! Hello again from the Twilio Sandbox for WhatsApp.");

   			return TwiML(messagingResponse);
   		}
   	}
   }
   ```

   Save the file.
4. In Visual Studio, run the application by clicking the play arrow. Your web browser opens on a localhost URL. Note the port number; for example, if the URL opens on `https://localhost:44360`, your port number is `44360`.
5. In a new terminal window, run the following command to start ngrok and create a tunnel to your localhost. Replace `PORT` with the port number from your application.

   ```bash
   ngrok http PORT
   ```

   > \[!WARNING]
   >
   > Use ngrok only for testing because it creates a temporary URL that exposes your local development machine to the internet. Host your application with a cloud provider or your public server when you deploy to production.
6. Set up a webhook that triggers when the Sandbox receives a WhatsApp message:

   1. Open the [Try WhatsApp page in the Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
   2. Click **Sandbox settings**.
   3. In the **Sandbox Configuration** section, in the **When a message comes in** field, enter the temporary forwarding URL from your ngrok console with `/whatsapp` appended to the end.

      For example, if your ngrok console shows `Forwarding https://1aaa-123-45-678-910.ngrok-free.app`, enter `https://1aaa-123-45-678-910.ngrok-free.app/whatsapp`.
   4. Click **Save**.
7. With the application and ngrok running, send a WhatsApp message to the Sandbox number from your personal WhatsApp account.

An HTTP request shows in your ngrok console, and you receive the response message in your personal WhatsApp account.

## Java

1. Create and set up the IntelliJ project.

   1. Open IntelliJ IDEA Community Edition.
   2. Create a new project with either **Maven** or **Gradle** as the build system.
   3. Add the following dependencies to your [Maven](https://www.jetbrains.com/help/idea/work-with-maven-dependencies.html#) or [Gradle](https://www.jetbrains.com/help/idea/work-with-gradle-dependency-diagram.html#) build file:

      * `com.twilio.sdk:twilio`
      * `com.sparkjava:spark-core`
      * `org.slf4j`

      To learn more about the dependencies, see [SparkJava](https://github.com/perwendel/spark) and [Simple Logging Facade 4 Java (SLF4J)](https://www.slf4j.org/).
   4. Select the `java` folder under `src` > `main`.
   5. To create a new Java class, click **File** > **New** > **Java Class**. Name the class `WhatsappApp`.
2. In the new `WhatsappApp.java` file that IntelliJ creates, paste in the following code:

   Respond to an incoming WhatsApp message with Java

   ```java
   import com.twilio.twiml.MessagingResponse;
   import com.twilio.twiml.messaging.Body;
   import com.twilio.twiml.messaging.Message;

   import static spark.Spark.*;

   public class WhatsAppApp {
       public static void main(String[] args) {
           get("/", (req, res) -> "Hello Web");

           post("/whatsapp", (req, res) -> {
               res.type("application/xml");
               Body body = new Body
                       .Builder("Message received! Hello again from the Twilio Sandbox for WhatsApp.")
                       .build();
               Message whatsapp = new Message
                       .Builder()
                       .body(body)
                       .build();
               MessagingResponse twiml = new MessagingResponse
                       .Builder()
                       .message(whatsapp)
                       .build();
               return twiml.toXml();
           });
       }
   }
   ```
3. Right-click on the **WhatsappApp** class in the project outline and choose **Run 'WhatsappApp.main()'**.

   The Java spark web application server starts listening on port 4567.
4. In a new terminal window, run the following command to start ngrok and create a tunnel to your localhost:

   ```bash
   ngrok http 4567
   ```

   > \[!WARNING]
   >
   > Use ngrok only for testing because it creates a temporary URL that exposes your local development machine to the internet. Host your application with a cloud provider or your public server when you deploy to production.
5. Set up a webhook that triggers when the Sandbox receives a WhatsApp message:

   1. Open the [Try WhatsApp page in the Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
   2. Click **Sandbox settings**.
   3. In the **Sandbox Configuration** section, in the **When a message comes in** field, enter the temporary forwarding URL from your ngrok console with `/whatsapp` appended to the end.

      For example, if your ngrok console shows `Forwarding https://1aaa-123-45-678-910.ngrok-free.app`, enter `https://1aaa-123-45-678-910.ngrok-free.app/whatsapp`.
   4. Click **Save**.
6. With the Java development server and ngrok running, send a WhatsApp message to the Sandbox number from your personal WhatsApp account.

An HTTP request shows in your ngrok console, and you receive the response message in your personal WhatsApp account.

## curl

Although we're sure it's possible to run a server from your command line, we suggest exploring how to set up your environment, send messages, and respond to messages with TwiML in the programming language of your choice.

To respond to messages, you'll set up a webhook that triggers when the Sandbox receives a WhatsApp message. You can configure webhooks by connecting the Sandbox to an app you've already built for handling incoming messages, or build a new one for WhatsApp messages.

## Go

1. Create and open a new file called `server.go` in your Go project directory and paste in the following code:

   Respond to an incoming WhatsApp message with Go
   ```go
   package main

   import (
   	"net/http"

   	"github.com/gin-gonic/gin"
   	"github.com/twilio/twilio-go/twiml"
   )

   func main() {
   	router := gin.Default()

   	router.POST("/whatsapp", func(context *gin.Context) {
   		message := &twiml.MessagingMessage{
   			Body: "Message received! Hello again from the Twilio Sandbox for WhatsApp.",
   		}

   		twimlResult, err := twiml.Messages([]twiml.Element{message})
   		if err != nil {
   			context.String(http.StatusInternalServerError, err.Error())
   		} else {
   			context.Header("Content-Type", "text/xml")
   			context.String(http.StatusOK, twimlResult)
   		}
   	})

   	router.Run(":3000")
   }
   ```
2. Install the [Gin Framework](https://gin-gonic.com/):

   ```bash
   go get -u github.com/gin-gonic/gin
   ```
3. Install the TwiML dependency:

   ```bash
   go get github.com/twilio/twilio-go/twiml@latest
   ```
4. In a new terminal window, start the Go development server on port 3000 by running this command in the directory that contains `server.go`:

   ```bash
   go run server.go
   ```
5. In a new terminal window, run the following command to start ngrok and create a tunnel to your localhost:

   ```bash
   ngrok http 3000
   ```

   > \[!WARNING]
   >
   > Use ngrok only for testing because it creates a temporary URL that exposes your local development machine to the internet. Host your application with a cloud provider or your public server when you deploy to production.
6. Set up a webhook that triggers when the Sandbox receives a WhatsApp message:

   1. Open the [Try WhatsApp page in the Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
   2. Click **Sandbox settings**.
   3. In the **Sandbox Configuration** section, in the **When a message comes in** field, enter the temporary forwarding URL from your ngrok console with `/whatsapp` appended to the end.

      For example, if your ngrok console shows `Forwarding https://1aaa-123-45-678-910.ngrok-free.app`, enter `https://1aaa-123-45-678-910.ngrok-free.app/whatsapp`.
   4. Click **Save**.
7. With the Go development server and ngrok running, send a WhatsApp message to the Sandbox number from your personal WhatsApp account.

An HTTP request shows in your ngrok console, and you receive the response message in your personal WhatsApp account.

## Ruby

1. Create and open a new file called `reply_whatsapp.rb` in the same directory as `Gemfile` and paste in the following code:

   ```ruby
   require 'twilio-ruby'
   require 'sinatra'

   # disable HostAuthorization for development only
   configure :development do
   	set :host_authorization, { permitted_hosts: [] }
   end

   post '/whatsapp' do
   	twiml = Twilio::TwiML::MessagingResponse.new do |r|
   		r.message(body: 'Message received! Hello again from the Twilio Sandbox for WhatsApp.')
   	end

   	twiml.to_s
   end
   ```

   Save the file.
2. In a new terminal window, start the Ruby development server on port 4567 by running this command:

   ```bash
   ruby reply_whatsapp.rb
   ```
3. In a new terminal window, run the following command to start ngrok and create a tunnel to your localhost:

   ```bash
   ngrok http 4567
   ```

   > \[!WARNING]
   >
   > Use ngrok only for testing because it creates a temporary URL that exposes your local development machine to the internet. Host your application with a cloud provider or your public server when you deploy to production.
4. Set up a webhook that triggers when the Sandbox receives a WhatsApp message:

   1. Open the [Try WhatsApp page in the Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
   2. Click **Sandbox settings**.
   3. In the **Sandbox Configuration** section, in the **When a message comes in** field, enter the temporary forwarding URL from your ngrok console with `/whatsapp` appended to the end.

      For example, if your ngrok console shows `Forwarding https://1aaa-123-45-678-910.ngrok-free.app`, enter `https://1aaa-123-45-678-910.ngrok-free.app/whatsapp`.
   4. Click **Save**.
5. With the Ruby development server and ngrok running, send a WhatsApp message to the Sandbox number from your personal WhatsApp account.

An HTTP request shows in your ngrok console, and you receive the response message in your personal WhatsApp account.

## Next steps

The WhatsApp Business Platform with Twilio uses the same REST API resources as the [Twilio Programmable Messaging API](/docs/messaging/api). Many Twilio Messaging use cases apply to WhatsApp:

* Learn more about testing with the [Twilio Sandbox for WhatsApp](/docs/whatsapp/sandbox)
* [Send appointment reminders](/docs/messaging/tutorials/appointment-reminders)
* [Create SMS conversations](/docs/messaging/tutorials/how-to-create-sms-conversations)


==============

# Test WhatsApp messaging with the Sandbox

> \[!WARNING]
>
> Use the Twilio Sandbox for WhatsApp for testing and discovery purposes only. Don't use it in a production environment.

The Twilio Sandbox for WhatsApp is a pre-configured environment in the Twilio Console for testing the following functionality:

* [Sending business-initiated messages](#business-initiated-messages-and-templates)
* [Replying to user-initiated messages](#user-initiated-messages-and-replies)
* Configuring a [webhook URL](#webhook-url) and a [status callback URL](#status-callback-url)

You don't need a WhatsApp Business Account or a registered WhatsApp sender to use the Sandbox.

Twilio provides the Sandbox with a shared phone number (`+14155238886`). While all Sandbox users use the same number, only users who have joined your specific Sandbox can receive messages from you.

Watch the following video to learn how to use the Sandbox to send and receive WhatsApp messages.

https://www.youtube.com/watch?v=UVez2UyjpFk

## Sandbox limitations

* You can only message end users who have joined your Sandbox. Messaging other users will fail with [Error 63015](/docs/api/errors/63015).
* The Sandbox supports functional testing, but not load testing of profile traffic.
* The Sandbox number is a Twilio number and displays the Twilio logo.
* The Sandbox number can only send one message every three seconds.
* For [business-initiated messages](#business-initiated-messages-and-templates) from the Sandbox, you can use only pre-approved templates.
* The Sandbox session expires three days after joining. After this, end users need to rejoin the Sandbox.
* The Sandbox number might be temporarily restricted from sending to certain countries, such as Brazil or Indonesia. This restriction can cause message failures. If you encounter this issue, contact Twilio Support. To ensure more reliable delivery to recipients in other countries, register your own sender with its primary business location and the correct sender country code in each destination country. For setup instructions, see the WhatApp guides: [WhatsApp Self Sign-up](/docs/whatsapp/self-sign-up) (direct customers) and [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program) (Independent Software Vendors (ISVs)).

There is no limit to the number of messages you can send or how long you can use the Twilio Sandbox for WhatsApp. However, [Twilio free trial accounts](/docs/usage/tutorials/how-to-use-your-free-trial-account) can send a maximum of 50 messages per day. Sandbox messages are billed at standard [Twilio API for WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing).

## How to activate and join the Sandbox

To send or receive WhatsApp messages using the Sandbox, you must activate the Sandbox and have at least one end user join the Sandbox.

1. [Sign up for Twilio](https://www.twilio.com/try-twilio).
2. Activate and connect to the Twilio Sandbox for WhatsApp:
   1. Go to the [Try WhatsApp page in the Console](https://www.twilio.com/console/sms/whatsapp/sandbox), acknowledge the terms, and click **Confirm**.
   2. Have each end user who wants to join send `join <your sandbox code>` to the Sandbox number, or scan the QR code with their mobile device and send the pre-populated message. The Sandbox will reply to confirm they have joined.

Once joined, end users receive messages only from the joined Sandbox. To disconnect from the Sandbox, they can reply to the message with `stop` or switch to a different Sandbox by messaging `join <other sandbox keyword>`.

Multiple end users can join the same Sandbox, but each must send the `join <your sandbox code>` message to the Sandbox number to join.

## Business-initiated messages and templates

When a user sends your business a message, it opens a 24-hour customer service window. During this window, you can send free-form text and media without a message template. Outside the window, you can only message users with an approved template. Learn more about [customer service windows](/docs/whatsapp/key-concepts#customer-service-windows) and [message templates](/docs/whatsapp/key-concepts#message-templates).

> \[!NOTE]
>
> Sending `join <your sandbox code>` to the Sandbox number starts a customer service window.

The Twilio Sandbox for WhatsApp comes with the following pre-approved templates for testing purposes:

* **Appointment Reminders**: "Your appointment is coming up on \{\{1}} at \{\{2}}"
* **Order Notifications**: "Your \{\{1}} order of \{\{2}} has shipped and should be delivered on \{\{3}}. Details: \{\{4}}"
* **Verification Codes**: "Your \{\{1}} code is \{\{2}}"

**Note**: The double-bracketed numbers are placeholders for your custom values. In your code, provide these values as key-value pairs. For example, if you use the Appointment Reminders template, `{"1":"2025/7/15","2":"3:00p.m."}` will show "Your appointment is coming up on 2025/7/15 at 3:00p.m.".

You can't use custom message templates with the Sandbox. To set up and use custom message templates, you need to register a WhatsApp sender through [WhatsApp Self Sign-up](/docs/whatsapp/self-sign-up) (direct customers) or [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program) (Independent Software Vendors (ISVs)).

## User-initiated messages and replies

You can use the Sandbox to explore replying to incoming WhatsApp messages.

When an end user sends you a WhatsApp message, you can reply to that message within the 24-hour customer service window. During the 24-hour window, you can reply with free-form messages.

### Webhook URL

When an end user sends a WhatsApp message, Twilio sends a [webhook](/docs/glossary/what-is-a-webhook) to your webhook URL. Typically, the webhook URL points to your application. When Twilio receives a message, it makes a request to your URL. You can reply using [TwiML](/docs/glossary/what-is-twilio-markup-language-twiml), Twilio's markup language for message instructions. Learn more about [how to reply with TwiML in the language of your choice](/docs/whatsapp/quickstart).

In the Sandbox, you can set the webhook URL in the **When a Message Comes in** field under **Sandbox settings > Sandbox configuration**.

## WhatsApp message delivery status

You can receive real-time status updates for WhatsApp messages that you send and receive with the Sandbox.

### Status callback URL

When you set a status callback URL, you can receive requests from Twilio with information about the delivery status of your WhatsApp message. Twilio sends a request to your status callback URL each time your message status changes to one of the following: `queued`, `failed`, `sent`, `delivered`, or `read`. Learn more about [tracking the message status of outbound messages](/docs/messaging/guides/track-outbound-message-status).

In the Sandbox, you can set the status callback URL in the **Status callback URL** field under **Sandbox settings > Sandbox configuration**.

## Next steps

* Get started with the [WhatsApp for Twilio quickstart](/docs/whatsapp/quickstart).
* Learn about [using WhatsApp Business Accounts with Twilio](/docs/whatsapp/tutorial/whatsapp-business-account).
* Register your WhatsApp sender with [WhatsApp Self Sign-up](/docs/whatsapp/self-sign-up) (direct customers) or [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program) (ISVs).
* Learn about [WhatsApp messaging best practices](/docs/whatsapp/best-practices-and-faqs).

================

# Key Concepts and Terms for the WhatsApp Business Platform with Twilio

Using the [WhatsApp Business Platform with Twilio](https://www.twilio.com/en-us/messaging/channels/whatsapp), you can connect with users on WhatsApp through Twilio's APIs.

WhatsApp is a highly regulated channel, and getting started requires documentation and approval from Meta. This document covers the common key concepts and terms that you will encounter when you use the WhatsApp Business Platform with Twilio.

## Customer service windows

WhatsApp regulates when and how you can send messages to your end users. When an end user sends your business a WhatsApp message, that message starts a customer service window (also known as a 24-hour window) during which you can send free-form messages to the user. This customer service window lasts for 24 hours after the last inbound message you receive from a user.

Outside of a customer service window, you may only send a message using an approved template. Create and submit templates for WhatsApp approval using [Content Templates](content/overview). When you create a template, you'll get a unique Content SID, which you use in your application code to send messages outside of the customer service window.

From July 1, 2025, Utility template messages don't incur any Meta fees if you send them during a customer service window. Authentication and Marketing template messages continue to incur fees during the customer service window. For more information on how the customer service window affects WhatsApp pricing, see [Twilio's WhatsApp pricing FAQ](https://help.twilio.com/articles/360037672734-How-Much-Does-it-Cost-to-Send-and-Receive-WhatsApp-Messages-with-Twilio-).

## Message templates

In some cases, you need to use a message template to send WhatsApp messages. The following table summarizes when a message template is required, whether it needs WhatsApp approval, and example message types for each scenario:

| Customer service window | Message type                                                                         | Requires message templates? | Requires WhatsApp approval? | Examples                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------ | --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active                  | Text                                                                                 | No                          | No                          | Plain text, formatted text (bold, italics, strikethrough, pre-formatted code)                                                                                       |
| Active                  | [Media](/docs/whatsapp/tutorial/send-and-receive-media-messages-twilio-api-whatsapp) | No                          | No                          | Images, audio, PDFs                                                                                                                                                 |
| Active                  | [Messages with rich features](/docs/whatsapp/message-features)                       | Yes                         | No                          | Buttons, lists, coupon codes, carousels <br />**Note**: Coupon codes and carousels always need WhatsApp approval, regardless of the customer service window status. |
| Inactive                | Any messages                                                                         | Yes                         | Yes                         | Appointment reminders, follow-ups after the 24-hour window                                                                                                          |

Message template examples:

* "Your appointment for `{{1}}` is `{{2}}`. Need to reschedule? Tap below to reply."
* "Your `{{1}}` delivery is on the way. It should arrive `{{2}}`. If you have any questions, reach out."

**Note**: The double-bracketed numbers are placeholders for your custom values. In your code, provide these values as key-value pairs. For example, if you use the Appointment Reminders template, `{"1":"2025/7/15","2":"3:00p.m."}` will show "Your appointment is coming up on 2025/7/15 at 3:00p.m.".

To create message templates and submit them for approval, use the [Content Template Builder or Content API](content/overview). For more information, see [Send WhatsApp notification messages with templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates) and [Message template approval and statuses](/docs/whatsapp/tutorial/message-template-approvals-statuses).

The Twilio Sandbox for WhatsApp comes with pre-approved templates for testing purposes. For more information, see [Test WhatsApp messaging with the Sandbox](/docs/whatsapp/sandbox).

### Message template categories

WhatsApp requires you to classify message templates into one of three categories that determine pricing and approval requirements:

* **Authentication**: Authenticate users with one-time passcodes. Meta determines the body text, and you can't change it.
* **Utility**: Share important information related to a specific, agreed-upon transaction by confirming, suspending, or changing a transaction or subscription.
* **Marketing**: Send promotional offers, product announcements, and more to increase awareness and engagement. Meta classifies any template with a mix of utility and marketing content as a marketing template.

Meta bases its message fees on template categories and determines categories at its sole discretion. Any templates that don't result from an explicit end user request will likely be categorized as "Marketing".

Learn more about [Meta's template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization) and [WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing).

## WhatsApp Business Account (WABA)

A WhatsApp Business Account (WABA) is required to register a WhatsApp Sender and send and receive messages on WhatsApp using Twilio. All WhatsApp Senders and Templates must belong to a WABA.

**There is a one-to-one relationship between a Twilio account, subaccount, or project and a WABA.** In other words, you may only have one WABA in a Twilio account or subaccount, and each WABA should only be connected to a single Twilio account, subaccount, or project. This means that if you have multiple accounts, subaccounts, or projects, then you will need to have multiple WABAs.

WhatsApp does not limit how many WABAs a business can have.

## Meta Business Portfolio

> \[!NOTE]
>
> Meta Business Manager — sometimes referred to as Facebook Business Manager, Meta BM, or Meta Business Account — has been renamed to Business Portfolio by Meta. All terms refer to the same business entity within Meta's systems and IDs are consistent. We are in process of updating the Twilio documentation to use Meta's new term.

In order to have a WhatsApp Business Account (WABA), your business must have a [Meta Business Portfolio](https://business.facebook.com/). A Meta Business Portfolio allows organizations to organize and manage all of their business assets (e.g., Facebook pages, Instagram accounts, and WhatsApp Business accounts) together. It is a separate concept from the WhatsApp Business Account (WABA).

Consult [Meta's instructions for creating a Meta Business Portfolio account](https://www.facebook.com/business/help/1710077379203657?id=180505742745347). You may also do this when registering your first WhatsApp Sender using [WhatsApp Self Sign-up](/docs/whatsapp/self-sign-up).

Meta uses your Meta Portfolio to verify your business's identity through a process called "Business Verification."

## Twilio Sandbox for WhatsApp

The [Twilio Sandbox for WhatsApp](https://www.twilio.com/console/sms/whatsapp/learn) is a tool created by Twilio for you to prototype and test sending and receiving WhatsApp messages before you are fully set up with a WABA and Twilio WhatsApp sender number. You can read more in [our in-depth guide to getting started with the Twilio Sandbox for WhatsApp](/docs/whatsapp/sandbox) or [our step-by-step Quickstart to WhatsApp](/docs/whatsapp/quickstart).

## WhatsApp usernames

### Usernames for users

WhatsApp supports usernames for individual users. A username masks the user's phone number and lets the user interact with businesses through a Business-scoped User ID (BSUID). Twilio exposes this identifier in the Messaging API as `ExternalUserId`.

Meta automatically generates a BSUID for each combination of business portfolio (formerly called *Business Manager*) and user. If the user changes their phone number, Meta regenerates the BSUID. A BSUID can contain up to 128 alphanumeric characters, excluding the country code. All message webhooks include the BSUID, whether or not the user has turned on usernames.

Twilio maps the BSUID to the `ExternalUserId` field in the Messaging API. When relevant, Twilio also appends the BSUID to the existing `to` and `from` parameters.

Example `ExternalUserId` values:

```text
whatsapp:CC.1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T
whatsapp:CC.BSUID
```

In these examples, `CC` represents the two-letter country code, such as `US` for the United States or `BR` for Brazil.

The `to` and `from` parameters behave as follows:

* If a phone number is present, the `to` or `from` field contains only the phone number, and `ExternalUserId` contains the BSUID.
* If no phone number is present, Twilio populates the `to`, `from`, and `ExternalUserId` fields with the BSUID.

**Note**: Phone numbers are in E.164 format (for example, `whatsapp:+18005550100`).

Limitations on BSUIDs:

* All message types are supported except one-tap, zero-tap, and copy-code authentication templates, which require a phone number.
* A BSUID is valid only for the portfolio that generated it. If you operate multiple portfolios, a request that includes a BSUID from another portfolio fails.

### Messaging users with a phone number

If you message users with a phone number, the workflow continues to operate exactly as it does today. Authentication messages also continue to require phone numbers.

### Business usernames

A business can assign one username to each WhatsApp phone number. A phone number can have only one username, and no two phone numbers—consumer or business—can share the same username.

Business usernames must meet the following requirements:

* Contain only English letters (`a–z`), digits (`0–9`), periods (`.`), or underscores (`_`).
* Be 3–35 characters long.
* Include at least one letter.
* Not start or end with a period and not contain two consecutive periods.
* Not start with `www`.
* Not end with a domain suffix (for example, `.com`, `.org`).
* Be case-insensitive (`myID` and `myid` are equivalent) but treat `.` and `_` as distinct (`my.id` and `my_id` are different).

WhatsApp displays sender names in the chat window in the following priority order (highest to lowest):

1. Saved contact name
2. Verified business name or Official Business Account (OBA) name
3. Username
4. Phone number

### Rollout timeline

Meta plans an initial rollout in June 2026, followed by a global rollout in August 2026. Make sure your integration is updated by early June 2026.

### Countries in the initial rollout

This list is subject to change by Meta.

| Date            | Countries                                               |
| --------------- | ------------------------------------------------------- |
| Early June 2026 | Algeria, Azerbaijan, Ghana, Libya, Nepal                |
| Late June 2026  | Colombia, Dominican Republic, Malaysia, Peru, Singapore |

### Prepare for usernames

Update your systems to store the new BSUID. Twilio returns the BSUID in the `to` and `from` parameters and in the `ExternalUserId` field.

Some WhatsApp messages might not include the user's phone number. If you receive only a BSUID, you still need a way to identify and communicate with that user. Store the BSUID with any existing identifiers so that you can map conversations correctly across your CRM, profile, or other data stores.

If you already have a phone number for a user, you can continue to use it. Treat the BSUID as an additional identifier for future interactions or for linking conversation history when a phone number isn't provided.

Onboarding and registration continue to use phone numbers. Usernames only affect the sender name displayed in WhatsApp, and they don't change onboarding or sender registration.

### Contact book

Meta plans to release a contact book feature that automatically stores WhatsApp user contact information (phone number and BSUID) when you exchange a message or call with that user.

After a contact is stored, the platform includes the user's phone number and BSUID in all webhook payloads and API responses, even if the user has enabled the WhatsApp usernames feature.

#### Data retention and opt-out

Meta retains contact book data until you either:

* Turn the feature off.
* Deactivate your Meta account.

Starting March 16, 2026, you can turn the contact book on or off in **Meta Business Suite** > **Business settings** > **Business info**. When you turn the feature off, Meta:

* Stops storing new user information.
* Deletes all previously stored user information.

If you turn the feature back on later, storage resumes, but deleted data isn't restored.

#### Limitations

* Contact books are scoped to business portfolios. If you use linked portfolios, each portfolio stores contact information independently. The data isn't shared or synchronized across portfolios.

For more information, see [Meta's documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/#contact-book).

### Where to find more information

For information from Meta, see the [Business-Scoped User IDs documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/). For Twilio-specific updates, monitor this page.

================

# Senders API - WhatsApp

The Senders API allows you to create, retrieve, update, and delete WhatsApp senders programmatically. A WhatsApp sender represents a phone number registered with WhatsApp Business through Twilio.

## Base URL

```bash
https://messaging.twilio.com/v2/Channels/Senders
```

## Senders properties

```json
{"type":"object","refName":"messaging.v2.channels_sender_response","modelName":"messaging_v2_channels_sender_response","properties":{"sid":{"type":"string","minLength":34,"maxLength":34,"pattern":"^XE[0-9a-fA-F]{32}$","nullable":true,"description":"The SID of the sender."},"status":{"type":"string","enum":["CREATING","ONLINE","OFFLINE","PENDING_VERIFICATION","VERIFYING","ONLINE:UPDATING","TWILIO_REVIEW","DRAFT","STUBBED"],"description":"The status of the sender.\n","refName":"channels_sender_enum_status","modelName":"channels_sender_enum_status"},"sender_id":{"type":"string","description":"The ID of the sender in `whatsapp:<E.164_PHONE_NUMBER>` format.","example":"whatsapp:+15017122661","nullable":true,"refName":"messaging.v2.channels_sender.fields.sender_id","modelName":"messaging_v2_channels_sender_fields_sender_id"},"configuration":{"type":"object","nullable":true,"description":"The configuration settings for creating a sender.","refName":"messaging.v2.channels_sender.configuration","modelName":"messaging_v2_channels_sender_configuration","properties":{"waba_id":{"type":"string","description":"The ID of the WhatsApp Business Account (WABA) to use for this sender.","example":"12345678912345","nullable":true},"verification_method":{"type":"string","enum":["sms","voice"],"description":"The verification method.","example":"sms","default":"sms","nullable":true},"verification_code":{"type":"string","description":"The verification code.","nullable":true},"voice_application_sid":{"type":"string","description":"The SID of the Twilio Voice application.","nullable":true}}},"webhook":{"type":"object","nullable":true,"description":"The configuration settings for webhooks.","refName":"messaging.v2.channels_sender.webhook","modelName":"messaging_v2_channels_sender_webhook","properties":{"callback_url":{"type":"string","description":"The URL to send the webhook to.","nullable":true},"callback_method":{"type":"string","enum":["POST","PUT"],"description":"The HTTP method for the webhook.","nullable":true},"fallback_url":{"type":"string","description":"The URL to send the fallback webhook to.","nullable":true},"fallback_method":{"type":"string","enum":["POST","PUT"],"description":"The HTTP method for the fallback webhook.","nullable":true},"status_callback_url":{"type":"string","description":"The URL to send the status callback to.","nullable":true},"status_callback_method":{"type":"string","description":"The HTTP method for the status callback.","nullable":true}}},"profile":{"type":"object","nullable":true,"description":"The profile information for the sender.\n","refName":"messaging.v2.channels_sender.profile_generic_response","modelName":"messaging_v2_channels_sender_profile_generic_response","properties":{"name":{"type":"string","description":"The name of the sender.","nullable":true},"about":{"type":"string","description":"The profile about text for the sender.","nullable":true},"address":{"type":"string","description":"The address of the sender.","nullable":true},"description":{"type":"string","description":"The description of the sender.","nullable":true},"logo_url":{"type":"string","description":"The logo URL of the sender.","nullable":true},"banner_url":{"type":"string","description":"The banner URL of the sender.","nullable":true},"privacy_url":{"type":"string","description":"The privacy URL of the sender. Must be a publicly accessible HTTP or HTTPS URI associated with the sender.","nullable":true},"terms_of_service_url":{"type":"string","description":"The terms of service URL of the sender.","nullable":true},"accent_color":{"type":"string","description":"The color theme of the sender. Must be in hex format and have at least a 4:5:1 contrast ratio against white.","nullable":true},"vertical":{"type":"string","description":"The vertical of the sender. Allowed values are:\n- `Alcohol`\n- `Automotive`\n- `Beauty, Spa and Salon`\n- `Clothing and Apparel`\n- `Education`\n- `Entertainment`\n- `Event Planning and Service`\n- `Finance and Banking`\n- `Food and Grocery`\n- `Hotel and Lodging`\n- `Matrimony Service`\n- `Medical and Health`\n- `Non-profit`\n- `Online Gambling`\n- `OTC Drugs`\n- `Other`\n- `Physical Gambling`\n- `Professional Services`\n- `Public Service`\n- `Restaurant`\n- `Shopping and Retail`\n- `Travel and Transportation`\n","nullable":true},"websites":{"description":"The websites of the sender.","nullable":true,"type":"array","items":{"type":"object","properties":{"website":{"type":"string"},"label":{"type":"string"}}}},"emails":{"description":"The emails of the sender.","nullable":true,"type":"array","items":{"type":"object","properties":{"email":{"type":"string"},"label":{"type":"string"}}}},"phone_numbers":{"description":"The phone numbers of the sender.","nullable":true,"type":"array","items":{"type":"object","properties":{"phone_number":{"type":"string"},"label":{"type":"string"}}}}}},"properties":{"type":"object","nullable":true,"description":"The additional properties for the sender.","refName":"messaging.v2.channels_sender.properties","modelName":"messaging_v2_channels_sender_properties","properties":{"quality_rating":{"type":"string","description":"The quality rating of the sender.","example":"HIGH","nullable":true},"messaging_limit":{"type":"string","description":"The messaging limit of the sender.","example":"10K Customers/24hr","nullable":true}}},"offline_reasons":{"type":"array","nullable":true,"description":"The reasons why the sender is offline.","refName":"messaging.v2.channels_sender.offline_reasons","modelName":"messaging_v2_channels_sender_offline_reasons","items":{"type":"object","nullable":true,"refName":"messaging.v2.channels_sender.offline_reasons.items","modelName":"messaging_v2_channels_sender_offline_reasons_items","properties":{"code":{"type":"string","description":"The error code.","nullable":true},"message":{"type":"string","description":"The error message.","nullable":true},"more_info":{"type":"string","format":"uri","description":"The URL to get more information about the error.","nullable":true}}}},"compliance":{"description":"The KYC compliance information. This section consists of response to the request launch.","type":"object","nullable":true,"required":["registration_sid"],"refName":"messaging.v2.rcs_compliance_response","modelName":"messaging_v2_rcs_compliance_response","properties":{"registration_sid":{"type":"string","description":"The default compliance registration SID (e.g., from CR-Google) that applies to all countries unless overridden in the `countries` array.\n"},"countries":{"type":"array","description":"A list of country-specific compliance details.\n","items":{"type":"object","required":["country"],"refName":"messaging.v2.rcs_compliance_country_response","modelName":"messaging_v2_rcs_compliance_country_response","properties":{"country":{"type":"string","description":"The ISO 3166-1 alpha-2 country code.","example":"US"},"registration_sid":{"type":"string","description":"The default compliance registration SID (e.g., from CR-Google) that applies to all countries unless overridden in the `countries` array.\n"},"status":{"type":"string","description":"The country-level status. Based on the aggregation of the carrier-level status.","enum":["ONLINE","OFFLINE","TWILIO_REVIEW","PENDING_VERIFICATION"],"refName":"messaging.v2.rcs_country_status","modelName":"messaging_v2_rcs_country_status"},"carriers":{"type":"array","items":{"type":"object","refName":"messaging.v2.rcs_carrier","modelName":"messaging_v2_rcs_carrier","properties":{"name":{"type":"string","description":"The name of the carrier. For example, `Verizon` or `AT&T` for US."},"status":{"type":"string","description":"The carrier-level status.","enum":["UNKNOWN","UNLAUNCHED","CARRIER_REVIEW","APPROVED","REJECTED","SUSPENDED"],"refName":"messaging.v2.rcs_carrier_status","modelName":"messaging_v2_rcs_carrier_status"}}}}}}}}},"url":{"type":"string","format":"uri","nullable":true,"description":"The URL of the resource."}}}
```

> \[!NOTE]
>
> For WhatsApp senders, the `Compliance` property is set to `null`.

## Create and register a Sender

`POST https://messaging.twilio.com/v2/Channels/Senders`

### Request body parameters

```json
{"schema":{"type":"object","required":["sender_id"],"refName":"messaging.v2.channels_sender.requests.create","modelName":"messaging_v2_channels_sender_requests_create","properties":{"sender_id":{"type":"string","description":"The ID of the sender in `whatsapp:<E.164_PHONE_NUMBER>` format.","example":"whatsapp:+15017122661","nullable":true,"x-field-extra-annotation":"@com.fasterxml.jackson.annotation.JsonProperty(\"sender_id\")","refName":"messaging.v2.channels_sender.fields.sender_id","modelName":"messaging_v2_channels_sender_fields_sender_id"},"configuration":{"type":"object","nullable":true,"description":"The configuration settings for creating a sender.","refName":"messaging.v2.channels_sender.configuration","modelName":"messaging_v2_channels_sender_configuration","properties":{"waba_id":{"type":"string","description":"The ID of the WhatsApp Business Account (WABA) to use for this sender.","example":"12345678912345","nullable":true},"verification_method":{"type":"string","enum":["sms","voice"],"description":"The verification method.","example":"sms","default":"sms","nullable":true},"verification_code":{"type":"string","description":"The verification code.","nullable":true},"voice_application_sid":{"type":"string","description":"The SID of the Twilio Voice application.","nullable":true}}},"webhook":{"type":"object","nullable":true,"description":"The configuration settings for webhooks.","refName":"messaging.v2.channels_sender.webhook","modelName":"messaging_v2_channels_sender_webhook","properties":{"callback_url":{"type":"string","description":"The URL to send the webhook to.","nullable":true},"callback_method":{"type":"string","enum":["POST","PUT"],"description":"The HTTP method for the webhook.","nullable":true},"fallback_url":{"type":"string","description":"The URL to send the fallback webhook to.","nullable":true},"fallback_method":{"type":"string","enum":["POST","PUT"],"description":"The HTTP method for the fallback webhook.","nullable":true},"status_callback_url":{"type":"string","description":"The URL to send the status callback to.","nullable":true},"status_callback_method":{"type":"string","description":"The HTTP method for the status callback.","nullable":true}}},"profile":{"type":"object","nullable":true,"description":"The profile information for the sender.\n","refName":"messaging.v2.channels_sender.profile","modelName":"messaging_v2_channels_sender_profile","properties":{"name":{"type":"string","description":"The name of the sender. Required for WhatsApp senders and must follow [Meta's display name guidelines](https://www.facebook.com/business/help/757569725593362).","nullable":true},"about":{"type":"string","description":"The profile about text for the sender.","nullable":true},"address":{"type":"string","description":"The address of the sender.","nullable":true},"description":{"type":"string","description":"The description of the sender.","nullable":true},"logo_url":{"type":"string","description":"The logo URL of the sender.","nullable":true},"banner_url":{"type":"string","description":"The banner URL of the sender.","nullable":true},"privacy_url":{"type":"string","description":"The privacy URL of the sender. Must be a publicly accessible HTTP or HTTPS URI associated with the sender.\n","nullable":true},"terms_of_service_url":{"type":"string","description":"The terms of service URL of the sender.","nullable":true},"accent_color":{"type":"string","description":"The color theme of the sender. Must be in hex format and have at least a 4:5:1 contrast ratio against white.","nullable":true},"vertical":{"type":"string","description":"The vertical of the sender. Allowed values are:\n- `Alcohol`\n- `Automotive`\n- `Beauty, Spa and Salon`\n- `Clothing and Apparel`\n- `Education`\n- `Entertainment`\n- `Event Planning and Service`\n- `Finance and Banking`\n- `Food and Grocery`\n- `Hotel and Lodging`\n- `Matrimony Service`\n- `Medical and Health`\n- `Non-profit`\n- `Online Gambling`\n- `OTC Drugs`\n- `Other`\n- `Physical Gambling`\n- `Professional Services`\n- `Public Service`\n- `Restaurant`\n- `Shopping and Retail`\n- `Travel and Transportation`\n","nullable":true},"websites":{"description":"The websites of the sender."},"emails":{"description":"The emails of the sender."},"phone_numbers":{"description":"The phone numbers of the sender."}}}}},"examples":{"whatsapp_create":{"value":{"lang":"json","value":"{\n  \"sender_id\": \"whatsapp:+999999999XX\",\n  \"configuration\": {\n    \"waba_id\": \"1234567XXX\",\n    \"verification_method\": \"sms\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Profile Name\",\n    \"about\": \"This is an example about text.\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"This is an example description.\",\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"Email\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"Email\"\n      }\n    ],\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ]\n  }\n}","meta":"","code":"{\n  \"sender_id\": \"whatsapp:+999999999XX\",\n  \"configuration\": {\n    \"waba_id\": \"1234567XXX\",\n    \"verification_method\": \"sms\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Profile Name\",\n    \"about\": \"This is an example about text.\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"This is an example description.\",\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"Email\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"Email\"\n      }\n    ],\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ]\n  }\n}","tokens":[["{","#C9D1D9"],"\n  ",["\"sender_id\"","#7EE787"],[":","#C9D1D9"]," ",["\"whatsapp:+999999999XX\"","#A5D6FF"],[",","#C9D1D9"],"\n  ",["\"configuration\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"waba_id\"","#7EE787"],[":","#C9D1D9"]," ",["\"1234567XXX\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"verification_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"sms\"","#A5D6FF"],"\n  ",["},","#C9D1D9"],"\n  ",["\"webhook\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"callback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://callback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"callback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"fallback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://fallback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"fallback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"status_callback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://statuscallback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"status_callback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],"\n  ",["},","#C9D1D9"],"\n  ",["\"profile\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"name\"","#7EE787"],[":","#C9D1D9"]," ",["\"Example Profile Name\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"about\"","#7EE787"],[":","#C9D1D9"]," ",["\"This is an example about text.\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"address\"","#7EE787"],[":","#C9D1D9"]," ",["\"123 Example St, Example City, EX 12345\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"description\"","#7EE787"],[":","#C9D1D9"]," ",["\"This is an example description.\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"emails\"","#7EE787"],[": [","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"email\"","#7EE787"],[":","#C9D1D9"]," ",["\"example1@example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Email\"","#A5D6FF"],"\n      ",["},","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"email\"","#7EE787"],[":","#C9D1D9"]," ",["\"example2@example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Email\"","#A5D6FF"],"\n      ",["}","#C9D1D9"],"\n    ",["],","#C9D1D9"],"\n    ",["\"logo_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://logo_url.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"vertical\"","#7EE787"],[":","#C9D1D9"]," ",["\"Automotive\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"websites\"","#7EE787"],[": [","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"website\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://website1.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Website1\"","#A5D6FF"],"\n      ",["},","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"website\"","#7EE787"],[":","#C9D1D9"]," ",["\"http://website2.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Website2\"","#A5D6FF"],"\n      ",["}","#C9D1D9"],"\n    ",["]","#C9D1D9"],"\n  ",["}","#C9D1D9"],"\n",["}","#C9D1D9"]],"annotations":[],"themeName":"github-dark","style":{"color":"#c9d1d9","background":"#0d1117"}},"refName":"#/components/examples/whatsapp_create_request","modelName":"__components_examples_whatsapp_create_request"},"rcs_create":{"value":{"lang":"json","value":"{\n  \"sender_id\": \"rcs:twilio_agent\",\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"RCS Profile Name\",\n    \"description\": \"RCS description.\",\n    \"accent_color\": \"#ffffff\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"banner_url\": \"https://banner_url.example.com\",\n    \"privacy_url\": \"https://privacy_url.example.com\",\n    \"terms_of_service_url\": \"https://terms_of_service_url.example.com\",\n    \"phone_numbers\": [\n      {\n        \"phone_number\": \"+12125551212\",\n        \"label\": \"phone\"\n      }\n    ],\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"example1\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"example2\"\n      }\n    ]\n  }\n}","meta":"","code":"{\n  \"sender_id\": \"rcs:twilio_agent\",\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"RCS Profile Name\",\n    \"description\": \"RCS description.\",\n    \"accent_color\": \"#ffffff\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"banner_url\": \"https://banner_url.example.com\",\n    \"privacy_url\": \"https://privacy_url.example.com\",\n    \"terms_of_service_url\": \"https://terms_of_service_url.example.com\",\n    \"phone_numbers\": [\n      {\n        \"phone_number\": \"+12125551212\",\n        \"label\": \"phone\"\n      }\n    ],\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"example1\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"example2\"\n      }\n    ]\n  }\n}","tokens":[["{","#C9D1D9"],"\n  ",["\"sender_id\"","#7EE787"],[":","#C9D1D9"]," ",["\"rcs:twilio_agent\"","#A5D6FF"],[",","#C9D1D9"],"\n  ",["\"webhook\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"callback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://callback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"callback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"fallback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://fallback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"fallback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"status_callback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://statuscallback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"status_callback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],"\n  ",["},","#C9D1D9"],"\n  ",["\"profile\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"name\"","#7EE787"],[":","#C9D1D9"]," ",["\"RCS Profile Name\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"description\"","#7EE787"],[":","#C9D1D9"]," ",["\"RCS description.\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"accent_color\"","#7EE787"],[":","#C9D1D9"]," ",["\"#ffffff\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"logo_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://logo_url.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"banner_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://banner_url.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"privacy_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://privacy_url.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"terms_of_service_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://terms_of_service_url.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"phone_numbers\"","#7EE787"],[": [","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"phone_number\"","#7EE787"],[":","#C9D1D9"]," ",["\"+12125551212\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"phone\"","#A5D6FF"],"\n      ",["}","#C9D1D9"],"\n    ",["],","#C9D1D9"],"\n    ",["\"websites\"","#7EE787"],[": [","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"website\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://website1.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Website1\"","#A5D6FF"],"\n      ",["},","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"website\"","#7EE787"],[":","#C9D1D9"]," ",["\"http://website2.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Website2\"","#A5D6FF"],"\n      ",["}","#C9D1D9"],"\n    ",["],","#C9D1D9"],"\n    ",["\"emails\"","#7EE787"],[": [","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"email\"","#7EE787"],[":","#C9D1D9"]," ",["\"example1@example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"example1\"","#A5D6FF"],"\n      ",["},","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"email\"","#7EE787"],[":","#C9D1D9"]," ",["\"example2@example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"example2\"","#A5D6FF"],"\n      ",["}","#C9D1D9"],"\n    ",["]","#C9D1D9"],"\n  ",["}","#C9D1D9"],"\n",["}","#C9D1D9"]],"annotations":[],"themeName":"github-dark","style":{"color":"#c9d1d9","background":"#0d1117"}},"refName":"#/components/examples/rcs_create_request","modelName":"__components_examples_rcs_create_request"}},"encodingType":"application/json","conditionalParameterMap":{}}
```

WhatsApp:Create and register a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createChannelsSender() {
  const channelsSender = await client.messaging.v2.channelsSenders.create({
    sender_id: "whatsapp:+15551234",
  });

  console.log(channelsSender.sid);
}

createChannelsSender();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client
from twilio.rest.messaging.v2 import ChannelsSenderList

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

channels_sender = client.messaging.v2.channels_senders.create(
    messaging_v2_channels_sender_requests_create=ChannelsSenderList.MessagingV2ChannelsSenderRequestsCreate(
        {"sender_id": "whatsapp:+15551234"}
    )
)

print(channels_sender.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Messaging.V2;
using System.Threading.Tasks;
using System.Collections.Generic;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var channelsSender = await ChannelsSenderResource.CreateAsync(
            messagingV2ChannelsSenderRequestsCreate: new ChannelsSenderResource
                .MessagingV2ChannelsSenderRequestsCreate.Builder()
                .WithSenderId("whatsapp:+15551234")
                .Build());

        Console.WriteLine(channelsSender.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import java.util.HashMap;
import com.twilio.Twilio;
import com.twilio.rest.messaging.v2.ChannelsSender;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);

        ChannelsSender.MessagingV2ChannelsSenderRequestsCreate messagingV2ChannelsSenderRequestsCreate =
            new ChannelsSender.MessagingV2ChannelsSenderRequestsCreate();
        messagingV2ChannelsSenderRequestsCreate.setSenderId("whatsapp:+15551234");

        ChannelsSender channelsSender = ChannelsSender.creator(messagingV2ChannelsSenderRequestsCreate).create();

        System.out.println(channelsSender.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	messaging "github.com/twilio/twilio-go/rest/messaging/v2"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &messaging.CreateChannelsSenderParams{}
	params.SetMessagingV2ChannelsSenderRequestsCreate(messaging.messaging_v2_channels_sender_requests_create{
		SenderId: "whatsapp:+15551234",
	})

	resp, err := client.MessagingV2.CreateChannelsSender(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;
use Twilio\Rest\Messaging\V2\ChannelsSenderModels;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$channels_sender = $twilio->messaging->v2->channelsSenders->create(
    ChannelsSenderModels::createMessagingV2ChannelsSenderRequestsCreate([
        "senderId" => "whatsapp:+15551234",
    ])
);

print $channels_sender->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

channels_sender = @client
                  .messaging
                  .v2
                  .channels_senders
                  .create(
                    messaging_v2_channels_sender_requests_create: {
                      'sender_id' => 'whatsapp:+15551234'
                    }
                  )

puts channels_sender.sid
```

```bash
# This endpoint is not currently supported by the Twilio CLI. You can open an issue to request it on https://github.com/twilio/twilio-cli/issues
  # For an alternative low-code solution, check out https://www.twilio.com/docs/openapi/using-twilio-postman-collections
```

```bash
MESSAGING_V2_CHANNELS_SENDER_REQUESTS_CREATE_OBJ=$(cat << EOF
{
  "sender_id": "whatsapp:+15551234"
}
EOF
)
curl -X POST "https://messaging.twilio.com/v2/Channels/Senders" \
--json "$MESSAGING_V2_CHANNELS_SENDER_REQUESTS_CREATE_OBJ" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "CREATING",
  "sender_id": "whatsapp:+15551234",
  "configuration": {
    "waba_id": "1234567XXX",
    "verification_method": "sms",
    "verification_code": null,
    "voice_application_sid": "APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  },
  "webhook": {
    "callback_url": "https://callback.example.com",
    "callback_method": "POST",
    "fallback_url": "https://fallback.example.com",
    "fallback_method": "POST",
    "status_callback_url": "https://statuscallback.example.com",
    "status_callback_method": "POST"
  },
  "profile": {
    "name": "Example Profile Name",
    "about": "This is an example about text.",
    "address": "123 Example St, Example City, EX 12345",
    "description": "This is an example description.",
    "emails": [
      {
        "email": "example@example.com",
        "label": "Email"
      },
      {
        "email": "example2@example.com",
        "label": "Email"
      }
    ],
    "logo_url": "https://logo_url.example.com",
    "vertical": "Automotive",
    "websites": [
      {
        "website": "https://website1.example.com",
        "label": "Website1"
      },
      {
        "website": "http://website2.example.com",
        "label": "Website2"
      }
    ]
  }
}
```

### Monitoring errors during Sender creation

The `POST /v2/Channels/Senders` request creates and registers a WhatsApp sender asynchronously. If the request successfully creates a sender but fails to complete the registration, you can find more information in the [Error Log](https://console.twilio.com/us1/monitor/logs/debugger/errors) in the Twilio Console.

An error log includes the following details:

* Error description
* Recommended actions to resolve it
* Resource SID, which matches the Sender SID in your initial request

To monitor error logs, use [Alarms](/docs/usage/troubleshooting/alarms) or [Event Streams](/docs/events).

#### Alarms

Set up an [alarm](/docs/usage/troubleshooting/alarms#configure-an-alarm) to receive instant notifications by email, Twilio Console, or webhook when error thresholds are met within a specific timeframe.

For example, you can set alarms for the following common errors:

* [63104](/docs/api/errors/63104): Maximum number of phone numbers reached for your WhatsApp Business Account (WABA)
* [63110](/docs/api/errors/63110): The phone number is already registered on WhatsApp
* [63111](/docs/api/errors/63111): Sender's phone number or WABA returned "not found"
* [63100](/docs/api/errors/63100): Validation Error
* [63113](/docs/api/errors/63113): Sender Cannot Be Verified
* [63114](/docs/api/errors/63114): Too Many Verification Codes
* [63116](/docs/api/errors/63116): WhatsApp Sender failed to be automatically registered as OTP was not received

#### Event Streams

Set up an Event Stream to subscribe to [Error Log events](/docs/events/event-types/errors/error-logs) to receive notifications for every logged error. Each event payload includes the error code and a `correlation_sid`, which matches the Sender SID in the response of your initial request. This helps you track and resolve errors.

## Retrieve a Sender

`GET https://messaging.twilio.com/v2/Channels/Senders/{Sid}`

### Path parameters

```json
[{"name":"Sid","required":true,"in":"path","description":"The SID of the sender.","schema":{"type":"string","minLength":34,"maxLength":34,"pattern":"^XE[0-9a-fA-F]{32}$"}}]
```

WhatsApp: Retrieve a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function fetchChannelsSender() {
  const channelsSender = await client.messaging.v2
    .channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .fetch();

  console.log(channelsSender.sid);
}

fetchChannelsSender();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

channels_sender = client.messaging.v2.channels_senders(
    "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
).fetch()

print(channels_sender.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Messaging.V2;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var channelsSender =
            await ChannelsSenderResource.FetchAsync(pathSid: "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

        Console.WriteLine(channelsSender.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.messaging.v2.ChannelsSender;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        ChannelsSender channelsSender = ChannelsSender.fetcher("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").fetch();

        System.out.println(channelsSender.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	resp, err := client.MessagingV2.FetchChannelsSender("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$channels_sender = $twilio->messaging->v2
    ->channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ->fetch();

print $channels_sender->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

channels_sender = @client
                  .messaging
                  .v2
                  .channels_senders('XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
                  .fetch

puts channels_sender.sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:messaging:v2:channels:senders:fetch \
   --sid XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

```bash
curl -X GET "https://messaging.twilio.com/v2/Channels/Senders/XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "ONLINE",
  "sender_id": "whatsapp:+999999999XX",
  "configuration": {
    "waba_id": "1234567XXX",
    "verification_method": null,
    "verification_code": null,
    "voice_application_sid": "APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  },
  "webhook": {
    "callback_url": "https://callback.example.com",
    "callback_method": "POST",
    "fallback_url": "https://fallback.example.com",
    "fallback_method": "POST",
    "status_callback_url": "https://statuscallback.example.com",
    "status_callback_method": "POST"
  },
  "profile": {
    "name": "Example Profile Name",
    "about": "This is an example about text.",
    "address": "123 Example St, Example City, EX 12345",
    "description": "This is an example description.",
    "emails": [
      {
        "email": "email@email.com",
        "label": "Email"
      }
    ],
    "logo_url": "https://logo_url.example.com",
    "vertical": "Automotive",
    "websites": [
      {
        "website": "https://website1.example.com",
        "label": "Website"
      },
      {
        "website": "http://website2.example.com",
        "label": "Website"
      }
    ],
    "banner_url": null,
    "privacy_url": null,
    "terms_of_service_url": null,
    "accent_color": null,
    "phone_numbers": null
  },
  "compliance": null,
  "properties": {
    "quality_rating": "HIGH",
    "messaging_limit": "10K Customers/24hr"
  },
  "offline_reasons": null,
  "url": "https://messaging.twilio.com/v2/Channels/Senders/XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

## Retrieve a list of Senders

`GET https://messaging.twilio.com/v2/Channels/Senders`

### Query parameters

```json
[{"name":"Channel","required":true,"in":"query","schema":{"type":"string","description":"The messaging channel for senders. Supported values are `whatsapp` and `rcs`."}},{"name":"PageSize","in":"query","description":"The number of items to return per page. For WhatsApp, the default is `20`.","schema":{"type":"integer","format":"int64","default":50,"minimum":1,"maximum":1000}},{"name":"Page","in":"query","description":"The page index. Use only for client state.","schema":{"type":"integer","minimum":0}},{"name":"PageToken","in":"query","description":"The page token provided by the API.","schema":{"type":"string"}}]
```

WhatsApp: Retrieve a list of Senders

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function listChannelsSender() {
  const channelsSenders = await client.messaging.v2.channelsSenders.list({
    channel: "whatsapp",
    limit: 20,
  });

  channelsSenders.forEach((c) => console.log(c.sid));
}

listChannelsSender();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

channels_senders = client.messaging.v2.channels_senders.list(
    channel="whatsapp", limit=20
)

for record in channels_senders:
    print(record.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Messaging.V2;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var channelsSenders =
            await ChannelsSenderResource.ReadAsync(channel: "whatsapp", limit: 20);

        foreach (var record in channelsSenders) {
            Console.WriteLine(record.Sid);
        }
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.messaging.v2.ChannelsSender;
import com.twilio.base.ResourceSet;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        ResourceSet<ChannelsSender> channelsSenders = ChannelsSender.reader("whatsapp").limit(20).read();

        for (ChannelsSender record : channelsSenders) {
            System.out.println(record.getSid());
        }
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	messaging "github.com/twilio/twilio-go/rest/messaging/v2"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &messaging.ListChannelsSenderParams{}
	params.SetChannel("whatsapp")
	params.SetLimit(20)

	resp, err := client.MessagingV2.ListChannelsSender(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		for record := range resp {
			if resp[record].Sid != nil {
				fmt.Println(*resp[record].Sid)
			} else {
				fmt.Println(resp[record].Sid)
			}
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$channelsSenders = $twilio->messaging->v2->channelsSenders->read(
    ["channel" => "whatsapp"],
    20
);

foreach ($channelsSenders as $record) {
    print $record->sid;
}
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

channels_senders = @client
                   .messaging
                   .v2
                   .channels_senders
                   .list(
                     channel: 'whatsapp',
                     limit: 20
                   )

channels_senders.each do |record|
   puts record.sid
end
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:messaging:v2:channels:senders:list \
   --channel whatsapp
```

```bash
curl -X GET "https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp&PageSize=20" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "senders": [],
  "meta": {
    "page": 0,
    "page_size": 10,
    "first_page_url": "https://messaging.twilio.com/v2/Channels/Senders?PageSize=10&Page=0&Channel=whatsapp",
    "previous_page_url": null,
    "url": "https://messaging.twilio.com/v2/Channels/Senders?PageSize=10&Page=0&Channel=whatsapp",
    "next_page_url": null,
    "key": "senders"
  }
}
```

## Update a Sender

`POST https://messaging.twilio.com/v2/Channels/Senders/{Sid}`

### Path parameters

```json
[{"name":"Sid","required":true,"in":"path","description":"The SID of the sender.","schema":{"type":"string","minLength":34,"maxLength":34,"pattern":"^XE[0-9a-fA-F]{32}$"}}]
```

### Request body parameters

```json
{"schema":{"type":"object","refName":"messaging.v2.channels_sender.requests.update","modelName":"messaging_v2_channels_sender_requests_update","properties":{"configuration":{"type":"object","nullable":true,"description":"The configuration settings for creating a sender.","refName":"messaging.v2.channels_sender.configuration","modelName":"messaging_v2_channels_sender_configuration","properties":{"waba_id":{"type":"string","description":"The ID of the WhatsApp Business Account (WABA) to use for this sender.","example":"12345678912345","nullable":true},"verification_method":{"type":"string","enum":["sms","voice"],"description":"The verification method.","example":"sms","default":"sms","nullable":true},"verification_code":{"type":"string","description":"The verification code.","nullable":true},"voice_application_sid":{"type":"string","description":"The SID of the Twilio Voice application.","nullable":true}}},"webhook":{"type":"object","nullable":true,"description":"The configuration settings for webhooks.","refName":"messaging.v2.channels_sender.webhook","modelName":"messaging_v2_channels_sender_webhook","properties":{"callback_url":{"type":"string","description":"The URL to send the webhook to.","nullable":true},"callback_method":{"type":"string","enum":["POST","PUT"],"description":"The HTTP method for the webhook.","nullable":true},"fallback_url":{"type":"string","description":"The URL to send the fallback webhook to.","nullable":true},"fallback_method":{"type":"string","enum":["POST","PUT"],"description":"The HTTP method for the fallback webhook.","nullable":true},"status_callback_url":{"type":"string","description":"The URL to send the status callback to.","nullable":true},"status_callback_method":{"type":"string","description":"The HTTP method for the status callback.","nullable":true}}},"profile":{"type":"object","nullable":true,"description":"The profile information for the sender.\n","refName":"messaging.v2.channels_sender.profile","modelName":"messaging_v2_channels_sender_profile","properties":{"name":{"type":"string","description":"The name of the sender. Required for WhatsApp senders and must follow [Meta's display name guidelines](https://www.facebook.com/business/help/757569725593362).","nullable":true},"about":{"type":"string","description":"The profile about text for the sender.","nullable":true},"address":{"type":"string","description":"The address of the sender.","nullable":true},"description":{"type":"string","description":"The description of the sender.","nullable":true},"logo_url":{"type":"string","description":"The logo URL of the sender.","nullable":true},"banner_url":{"type":"string","description":"The banner URL of the sender.","nullable":true},"privacy_url":{"type":"string","description":"The privacy URL of the sender. Must be a publicly accessible HTTP or HTTPS URI associated with the sender.\n","nullable":true},"terms_of_service_url":{"type":"string","description":"The terms of service URL of the sender.","nullable":true},"accent_color":{"type":"string","description":"The color theme of the sender. Must be in hex format and have at least a 4:5:1 contrast ratio against white.","nullable":true},"vertical":{"type":"string","description":"The vertical of the sender. Allowed values are:\n- `Alcohol`\n- `Automotive`\n- `Beauty, Spa and Salon`\n- `Clothing and Apparel`\n- `Education`\n- `Entertainment`\n- `Event Planning and Service`\n- `Finance and Banking`\n- `Food and Grocery`\n- `Hotel and Lodging`\n- `Matrimony Service`\n- `Medical and Health`\n- `Non-profit`\n- `Online Gambling`\n- `OTC Drugs`\n- `Other`\n- `Physical Gambling`\n- `Professional Services`\n- `Public Service`\n- `Restaurant`\n- `Shopping and Retail`\n- `Travel and Transportation`\n","nullable":true},"websites":{"description":"The websites of the sender."},"emails":{"description":"The emails of the sender."},"phone_numbers":{"description":"The phone numbers of the sender."}}}}},"examples":{"update":{"value":{"lang":"json","value":"{\n  \"configuration\": {\n    \"verification_code\": \"123456\",\n    \"voice_application_sid\": \"APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Business\",\n    \"about\": \"Example about text\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"Example description\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"email@email.com\",\n        \"label\": \"Email\"\n      }\n    ]\n  }\n}","meta":"","code":"{\n  \"configuration\": {\n    \"verification_code\": \"123456\",\n    \"voice_application_sid\": \"APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Business\",\n    \"about\": \"Example about text\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"Example description\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"email@email.com\",\n        \"label\": \"Email\"\n      }\n    ]\n  }\n}","tokens":[["{","#C9D1D9"],"\n  ",["\"configuration\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"verification_code\"","#7EE787"],[":","#C9D1D9"]," ",["\"123456\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"voice_application_sid\"","#7EE787"],[":","#C9D1D9"]," ",["\"APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"","#A5D6FF"],"\n  ",["},","#C9D1D9"],"\n  ",["\"webhook\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"callback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://callback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"callback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"fallback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://fallback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"fallback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"status_callback_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://statuscallback.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"status_callback_method\"","#7EE787"],[":","#C9D1D9"]," ",["\"POST\"","#A5D6FF"],"\n  ",["},","#C9D1D9"],"\n  ",["\"profile\"","#7EE787"],[": {","#C9D1D9"],"\n    ",["\"name\"","#7EE787"],[":","#C9D1D9"]," ",["\"Example Business\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"about\"","#7EE787"],[":","#C9D1D9"]," ",["\"Example about text\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"address\"","#7EE787"],[":","#C9D1D9"]," ",["\"123 Example St, Example City, EX 12345\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"description\"","#7EE787"],[":","#C9D1D9"]," ",["\"Example description\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"logo_url\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://logo_url.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"vertical\"","#7EE787"],[":","#C9D1D9"]," ",["\"Automotive\"","#A5D6FF"],[",","#C9D1D9"],"\n    ",["\"websites\"","#7EE787"],[": [","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"website\"","#7EE787"],[":","#C9D1D9"]," ",["\"https://website1.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Website\"","#A5D6FF"],"\n      ",["},","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"website\"","#7EE787"],[":","#C9D1D9"]," ",["\"http://website2.example.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Website\"","#A5D6FF"],"\n      ",["}","#C9D1D9"],"\n    ",["],","#C9D1D9"],"\n    ",["\"emails\"","#7EE787"],[": [","#C9D1D9"],"\n      ",["{","#C9D1D9"],"\n        ",["\"email\"","#7EE787"],[":","#C9D1D9"]," ",["\"email@email.com\"","#A5D6FF"],[",","#C9D1D9"],"\n        ",["\"label\"","#7EE787"],[":","#C9D1D9"]," ",["\"Email\"","#A5D6FF"],"\n      ",["}","#C9D1D9"],"\n    ",["]","#C9D1D9"],"\n  ",["}","#C9D1D9"],"\n",["}","#C9D1D9"]],"annotations":[],"themeName":"github-dark","style":{"color":"#c9d1d9","background":"#0d1117"}}}},"encodingType":"application/json","conditionalParameterMap":{}}
```

To update a WhatsApp sender's information, make a `POST` request to the Sender resource. To verify a WhatsApp sender, include the `verification_code` parameter in your request.

WhatsApp: Update a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function updateChannelsSender() {
  const channelsSender = await client.messaging.v2
    .channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .update({
      configuration: {
        waba_id: "waba_id",
        verification_method: "sms",
        verification_code: "verification_code",
        voice_application_sid: "voice_application_sid",
      },
    });

  console.log(channelsSender.sid);
}

updateChannelsSender();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client
from twilio.rest.messaging.v2 import ChannelsSenderList

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

channels_sender = client.messaging.v2.channels_senders(
    "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
).update(
    messaging_v2_channels_sender_requests_update=ChannelsSenderList.MessagingV2ChannelsSenderRequestsUpdate(
        {
            "configuration": ChannelsSenderList.MessagingV2ChannelsSenderConfiguration(
                {
                    "waba_id": "waba_id",
                    "verification_method": "sms",
                    "verification_code": "verification_code",
                    "voice_application_sid": "voice_application_sid",
                }
            )
        }
    )
)

print(channels_sender.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Messaging.V2;
using System.Threading.Tasks;
using System.Collections.Generic;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var channelsSender = await ChannelsSenderResource.UpdateAsync(
            messagingV2ChannelsSenderRequestsUpdate: new ChannelsSenderResource
                .MessagingV2ChannelsSenderRequestsUpdate.Builder()
                .WithConfiguration(
                    new ChannelsSenderResource.MessagingV2ChannelsSenderConfiguration.Builder()
                        .WithWabaId("waba_id")
                        .WithVerificationMethod("sms")
                        .WithVerificationCode("verification_code")
                        .WithVoiceApplicationSid("voice_application_sid")
                        .Build())
                .Build(),
            pathSid: "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

        Console.WriteLine(channelsSender.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import java.util.Arrays;
import java.util.HashMap;
import com.twilio.Twilio;
import com.twilio.rest.messaging.v2.ChannelsSender;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);

        ChannelsSender.MessagingV2ChannelsSenderConfiguration configuration =
            new ChannelsSender.MessagingV2ChannelsSenderConfiguration();
        configuration.setWabaId("waba_id");
        configuration.setVerificationMethod("sms");
        configuration.setVerificationCode("verification_code");
        configuration.setVoiceApplicationSid("voice_application_sid");

        ChannelsSender.MessagingV2ChannelsSenderRequestsUpdate messagingV2ChannelsSenderRequestsUpdate =
            new ChannelsSender.MessagingV2ChannelsSenderRequestsUpdate();
        messagingV2ChannelsSenderRequestsUpdate.setConfiguration(messagingV2ChannelsSenderConfiguration);

        ChannelsSender channelsSender =
            ChannelsSender.updater("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", messagingV2ChannelsSenderRequestsUpdate)
                .update();

        System.out.println(channelsSender.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	messaging "github.com/twilio/twilio-go/rest/messaging/v2"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &messaging.UpdateChannelsSenderParams{}
	params.SetMessagingV2ChannelsSenderRequestsUpdate(messaging.messaging_v2_channels_sender_requests_update{
		Configuration: &messaging.MessagingV2ChannelsSenderConfiguration{
			WabaId:              "waba_id",
			VerificationMethod:  "sms",
			VerificationCode:    "verification_code",
			VoiceApplicationSid: "voice_application_sid",
		},
	})

	resp, err := client.MessagingV2.UpdateChannelsSender("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;
use Twilio\Rest\Messaging\V2\ChannelsSenderModels;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$channels_sender = $twilio->messaging->v2
    ->channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ->update(
        ChannelsSenderModels::createMessagingV2ChannelsSenderRequestsUpdate([
            "configuration" => ChannelsSenderModels::createMessagingV2ChannelsSenderConfiguration(
                [
                    "wabaId" => "waba_id",
                    "verificationMethod" => "sms",
                    "verificationCode" => "verification_code",
                    "voiceApplicationSid" => "voice_application_sid",
                ]
            ),
        ])
    );

print $channels_sender->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

channels_sender = @client
                  .messaging
                  .v2
                  .channels_senders('XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
                  .update(
                    messaging_v2_channels_sender_requests_update: {
                      'configuration' => {
                        'waba_id' => 'waba_id',
                        'verification_method' => 'sms',
                        'verification_code' => 'verification_code',
                        'voice_application_sid' => 'voice_application_sid'
                      }
                    }
                  )

puts channels_sender.sid
```

```bash
# This endpoint is not currently supported by the Twilio CLI. You can open an issue to request it on https://github.com/twilio/twilio-cli/issues
  # For an alternative low-code solution, check out https://www.twilio.com/docs/openapi/using-twilio-postman-collections
```

```bash
MESSAGING_V2_CHANNELS_SENDER_REQUESTS_UPDATE_OBJ=$(cat << EOF
{
  "configuration": {
    "waba_id": "waba_id",
    "verification_method": "sms",
    "verification_code": "verification_code",
    "voice_application_sid": "voice_application_sid"
  }
}
EOF
)
curl -X POST "https://messaging.twilio.com/v2/Channels/Senders/XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
--json "$MESSAGING_V2_CHANNELS_SENDER_REQUESTS_UPDATE_OBJ" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "VERIFYING",
  "sender_id": "whatsapp:+999999999XX",
  "compliance": null,
  "configuration": {
    "waba_id": "waba_id",
    "verification_method": "sms",
    "verification_code": "verification_code",
    "voice_application_sid": "voice_application_sid"
  },
  "webhook": {
    "callback_url": "https://callback.example.com",
    "callback_method": "POST",
    "fallback_url": "https://fallback.example.com",
    "fallback_method": "POST",
    "status_callback_url": "https://statuscallback.example.com",
    "status_callback_method": "POST"
  },
  "profile": {
    "about": "Example about text",
    "address": "123 Example St, Example City, EX 12345",
    "description": "Example description",
    "emails": [
      {
        "email": "email@email.com",
        "label": "Email"
      }
    ],
    "name": "Example Business",
    "logo_url": "https://logo_url.example.com",
    "vertical": "Automotive",
    "websites": [
      {
        "website": "https://website1.example.com",
        "label": "Website"
      },
      {
        "website": "http://website2.example.com",
        "label": "Website"
      }
    ],
    "banner_url": null,
    "privacy_url": null,
    "terms_of_service_url": null,
    "accent_color": null,
    "phone_numbers": null
  }
}
```

## Delete a Sender

`DELETE https://messaging.twilio.com/v2/Channels/Senders/{Sid}`

### Path parameters

```json
[{"name":"Sid","required":true,"in":"path","description":"The SID of the sender.","schema":{"type":"string","minLength":34,"maxLength":34,"pattern":"^XE[0-9a-fA-F]{32}$"}}]
```

> \[!NOTE]
>
> If you want to re-register the same number after deleting a sender, you must turn off Two-Factor Authentication (2FA) for the number in the [WhatsApp Manager](https://business.facebook.com/latest/whatsapp_manager/).

WhatsApp: Delete a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function deleteChannelsSender() {
  await client.messaging.v2
    .channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .remove();
}

deleteChannelsSender();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

client.messaging.v2.channels_senders(
    "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
).delete()
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Messaging.V2;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        await ChannelsSenderResource.DeleteAsync(pathSid: "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.messaging.v2.ChannelsSender;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        ChannelsSender.deleter("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").delete();
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	err := client.MessagingV2.DeleteChannelsSender("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$twilio->messaging->v2
    ->channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ->delete();
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

@client
  .messaging
  .v2
  .channels_senders('XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  .delete
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:messaging:v2:channels:senders:remove \
   --sid XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

```bash
curl -X DELETE "https://messaging.twilio.com/v2/Channels/Senders/XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```


==============

# Typing Indicators resource

> \[!IMPORTANT]
>
> Typing indicators for WhatsApp on Twilio are currently available as a Public Beta product and the information contained in this document is subject to change. This means that some features aren't yet implemented and others may be changed before the product is declared as Generally Available. Public Beta products aren't covered by the Twilio Support Terms or Twilio Service Level Agreement.
>
> Typing indicators for WhatsApp aren't HIPAA-eligible or PCI-compliant and shouldn't be enabled in workflows that are subject to HIPAA or PCI.

Typing indicators signal to WhatsApp users that a response is being prepared. This improves user experience by reducing perceived wait times. Use typing indicators for responses that might take longer than a few seconds to generate.

## Send a typing indicator

To send a WhatsApp typing indicator, reference the ID of the message that you're preparing a response for. When you send the typing indicator, Twilio automatically marks the referenced message as read for the user in their WhatsApp client and displays the typing indicator on the user's device.

The typing indicator on WhatsApp will disappear when your response is delivered or after 25 seconds, whichever happens first.

### Request body parameters

| Request body parameter | Required | Description                                                                                                                                                                                    |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messageId`            | Yes      | The SID of the message that you're preparing a response for. Must be a valid Twilio Message SID (starting with `SM`) or Media SID (starting with `MM`) from an existing WhatsApp conversation. |
| `channel`              | Yes      | The channel to send the typing indicator on. Must be `whatsapp`.                                                                                                                               |

```bash title="Request"
curl -X POST https://messaging.twilio.com/v2/Indicators/Typing.json \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN \
--data-urlencode "messageId=SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
--data-urlencode "channel=whatsapp"
```

```bash title="Response"
{
  "success": true
}
```

=============

# Message template approvals and statuses

This article describes the WhatsApp template approval process and covers best practices for improving approval rates. To learn more about message templates, see [Message templates](/docs/whatsapp/key-concepts#message-templates) and [Send WhatsApp notification messages with templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates).

## Message template approval criteria

WhatsApp generally rejects a template for one of the following reasons:

1. The format is incorrect (for example, misplaced or malformed placeholders).
2. The content violates WhatsApp's Terms of Service, Commerce Policy, or Business Policy, or is considered abusive.
3. The template is too generic and includes placeholders that could be used for abuse.

Because placeholders can resolve to many words, WhatsApp does not allow a placeholder at the beginning or end of the message. Such placement results in automatic rejection.

### Approval period

After you submit a template, WhatsApp typically approves or rejects it within minutes through a machine-learning assisted process. Templates that cannot be triaged automatically are routed for human review and can take up to 48 hours. If a template remains in the **Pending** state for more than 48 hours, open a Twilio support ticket and include the template name.

### Template statuses

WhatsApp templates can have the following statuses:

* **Pending**: The template is under review. Review can take up to 48 hours.
* **Approved**: The template was approved and can be sent to customers.
* **Rejected**: The template was rejected during review.
* **Paused**: The template was paused because of recurring negative user feedback (for example, blocks or spam reports). Messages that use this template cannot be sent.
* **Disabled**: The template was disabled because of repeated negative feedback or a policy violation. Messages that use this template cannot be sent.

The next sections explain how to gain approval and how to resolve paused or deactivated statuses.

## Tips for creating templates

* If you are unsure how to phrase a template, submit an initial version, review the outcome, and iterate. You can create a new version and delete the old one at any time.
* When you need to reopen the 24-hour user-initiated window, reference the previous conversation thread. Example: "I'm sorry I could not respond to your concerns yesterday. If you would like to continue, reply with YES."
* A friendly tone can improve engagement. Selective use of emojis (fewer than 10 per template) may help.

### Common rejection reasons

| **Rejection reason**                                                                                                                                                        | **How to resolve**                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A variable is at the beginning or end of the message.                                                                                                                       | Add text or punctuation before or after the variable.                                                                                      |
| Variables are adjacent to each other (for example, `{{1}}{{2}}`).                                                                                                           | Insert at least one word between variables or combine the content into a single variable.                                                  |
| Variable numbers are not sequential (for example, `{{1}}`, `{{2}}`, `{{4}}`).                                                                                               | Ensure that placeholders are sequential (`{{1}}`, `{{2}}`, `{{3}}`, …).                                                                    |
| The template contains newlines, tabs, or more than four consecutive spaces.                                                                                                 | Remove the extra whitespace. See [Meta's rules](https://developers.facebook.com/docs/whatsapp/message-templates/creation/).                |
| A call-to-action includes a direct WhatsApp link such as `https://wa.me/14154443344`.                                                                                       | Spell out the phone number without using a `wa.me` link.                                                                                   |
| The template duplicates an existing template with a different name (OTP templates are exempt).                                                                              | Modify both the template name and content before resubmitting.                                                                             |
| The content violates the [WhatsApp Commerce Policy](https://www.whatsapp.com/legal/commerce-policy/) or [Business Policy](https://www.whatsapp.com/legal/business-policy/). | Revise the content to comply with policy. For sensitive identifiers, request only partial information (for example, the last four digits). |
| The template appears related to gaming or gambling (for example, "raffle" or "win a prize").                                                                                | Replace words that could be interpreted as gaming or gambling terminology.                                                                 |
| The template is overly vague (for example, "Hi, `{{1}}`, thanks").                                                                                                          | Provide additional context so WhatsApp can understand how the template will be used.                                                       |
| The language selected does not match the template content.                                                                                                                  | Select the correct language before submitting.                                                                                             |
| The template contains more than 10 emojis.                                                                                                                                  | Reduce the number of emojis.                                                                                                               |

### Revising rejected message templates

If WhatsApp rejects a template, the Twilio Console displays a rejection code that explains why. Submit a new template with a different name and delete the rejected one. WhatsApp prevents reuse of the same template name for 30 days.

WhatsApp discloses the following rejection codes:

* **TAG\_CONTENT\_MISMATCH** – The selected language or category does not match the content.
* **INVALID\_FORMAT** – The template includes incorrectly formatted placeholders or elements.

If resubmissions continue to be rejected, add more detail to clarify the template's intended use. For example: "You asked us to let you know about \[Topic]." If you believe a template was rejected in error, open a Twilio support ticket with a detailed explanation so Twilio can request a review from WhatsApp.

## Examples of approved and rejected templates

### Approved

* `👋 Welcome {{1}}. What company do you work for?`
* `Your {{1}} appointment is coming up on {{2}}. Have a nice day.`
* `Your {{1}} appointment is coming up on {{2}}. Reply with {{3}} or {{4}}. Thank you.`
* `Dear {{1}}: Unfortunately your pending booking did not go through.`\
  `No charges were made to your bank account.`\
  `You can try to rebook the hotel.`\
  `We apologize for the inconvenience.`

### Rejected

Templates that lack sufficient context:

* `Reminder: {{1}}`
* `{{1}} was added`
* `{{1}}, {{2}}!`

Templates considered spam:

* `I am Jenn, the virtual assistant.`
* `Hi, are you available?`
* `We will put our platform up and running soon. I would like to get to know you better by asking 5 questions.`
* `Do not worry, I will not share your answers with anyone.`

## Guidance on template categorization

### Meta's definition of template categories

Meta enforces strict definitions for **Authentication** and **Utility** templates:

* Authentication templates follow a predefined structure for one-time passwords.
* Utility templates relate to a specific, user-initiated transaction and do one of the following: confirm, suspend, or change a transaction or subscription. Since 30 October 2023, Utility also includes feedback surveys, managing user-requested opt-in, or continuing a conversation started by the user in another channel.

Any template that does not meet these definitions is categorized as **Marketing**, including any mix of Marketing and Utility content. For details, see [Meta's template guidelines](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/).

### Choose the category with Content templates

If you require a specific category (for example, Utility), use the [Content Editor or Content API](/docs/content) to select the category explicitly. When you create a template in the WhatsApp Templates section of the Twilio Console, Meta may override the category.

### Guidance for Marketing templates

> \[!NOTE]
>
> To achieve higher marketing delivery rates and improved optimizations, you can enable Marketing Messages API on your account. To get started, sign the Marketing Messages API Terms of Service in your WhatsApp Business Account. You can find the option to set up Marketing Messages API in the Overview section under Alerts. Enabling Marketing Messages API can also help reduce Error 63049.

You can deliver a comparable or greater number of messages than Cloud API. Marketing Messages API provides more dynamic messaging limits, allowing high-engagement messages to reach more customers.

Marketing Messages API introduces new marketing and measurement capabilities. This includes features not available on Cloud API, such as performance benchmarks, recommendations in WhatsApp Manager, and time-to-live for marketing.

In India, WhatsApp marketing messages sent via MM API show higher engagement (such as reads) and achieve 9% more messages delivered compared to Cloud API.

### Guidance for Utility templates

Meta's categorization engine can misclassify legitimate Utility templates as Marketing. To reduce the likelihood of misclassification:

* Avoid generic placeholders such as "Important message: `{{1}}`." Spell out the expected content.
* Make it clear that the user requested the interaction. For example: "We are following up on your inquiry."
* Some keywords trigger a Marketing classification. Consider A/B testing alternative phrases.
* Utility templates may include media. You can submit a generic image for review and replace it with a specific image at send time without additional approval.
* Use a descriptive title such as `safety_alert` or `account_update` to indicate the Utility nature of the template.

==============

# Send WhatsApp notification messages with templates

In this guide, you'll learn how to create message templates, submit them for approval, and send WhatsApp messages using approved templates.

For information on when message templates are required and whether they need WhatsApp approval, see [Message templates](/docs/whatsapp/key-concepts#message-templates).

## Prerequisites

Before you begin, ensure you have the following:

* An active Twilio account with WhatsApp access
* A WhatsApp Business Account (WABA) set up
* Access to Twilio Console messaging services
* Understanding of WhatsApp customer service window concept

## Create message templates and submit them for approval

Creating custom message templates allows you to send notifications outside the 24-hour customer service window.

Content Templates are omnichannel templates and offer access to WhatsApp templates. Content Templates are message templates that you can use on any channel, including WhatsApp. They offer flexibility and help ensure your implementation remains compatible with future updates at Twilio. For more detailed information about [Content Templates and how to use them with WhatsApp, refer to this page](/docs/content).

| Feature                     | What is supported in content templates                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Supported channels**      | WhatsApp, SMS, MMS, Facebook Messenger                                                                     |
| **Sending messages**        | Send messages with a ContentSid field                                                                      |
| **Messaging Service**       | Required                                                                                                   |
| **Rich feature support**    | Latest rich features supported by Twilio, such as catalog, carousels, media templates, and dynamic buttons |
| **API to manage templates** | Content API                                                                                                |
| **UI to manage templates**  | Content Editor in the Twilio Console, go to Messaging > Content Editor                                     |

### Set up WhatsApp message templates in your Twilio account

To create a WhatsApp template in your Twilio account, follow these steps:

1. Go to **[Twilio Console > Messaging > Content Template Builder](https://console.twilio.com/us1/develop/sms/content-template-builder)**.
2. Click **Create new**.

   ![Content Template Builder with highlighted Messaging menu and 'Create your first content template' button.](https://docs-resources.prod.twilio.com/78188c0bd82b7063c2348ae8cc79e538d688459937727d383052a788e9685e5f.png)

   > \[!NOTE]
   >
   > If you are creating a template for the first time, you will see the **Create your first content template** button. Click it to create templates.
3. On the next screen, fill out the information to submit to WhatsApp. WhatsApp's team uses the information you submit to approve or reject your template submission.

   For more information, refer to [this page on creating Content Templates](/docs/content/create-templates-with-the-content-template-builder).

   * **Template name**: The name can only contain lowercase alphanumeric characters and underscores. **Tip**: Use a name that helps WhatsApp reviewer understand the purpose of your message, for example, `"order_delivery"` rather than `"template_1"`.
   * **Template category**: You must select the category that matches WhatsApp definition. See [Meta's docs](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines) for definitions and examples. Authentication templates have special constraints. See [Authentication template requirements](#authentication-template-requirements) for more information.
   * **Message language**: Select from the languages provided by WhatsApp.
   * **Message body**: The text of the message that you want to send. WhatsApp doesn't allow multiple sequential line breaks.
   * **Buttons and other rich features**: You can add a variety of button types and other rich features into a content template. To see a full list of supported template types, see our [content type overview here](/docs/content/content-types-overview).
4. After you fill out the message template, click **Save and submit for WhatsApp approval**.

![Configure WhatsApp template with call to action for website visit, including body text and URL fields.](https://docs-resources.prod.twilio.com/7d6b5d25509fd6092a56438084b1f62f91a246751b82c8a32347c4af50ea3646.png)

If your template includes placeholders (like `"Hello {{1}}! We've received your request regarding {{2}}."`), a modal will appear for you to add sample content for each placeholder. Enter sample text for each placeholder and then click **Save and submit** to submit your template to WhatsApp.

![Form to add sample data for message templates and button URLs with input fields and save option.](https://docs-resources.prod.twilio.com/2628bb52d2731c5209cc5c23e9f800d92fa0b657b2ff10ce7d676d1c7e40602f.png)

**Note**: Once you submit a template, it cannot be edited.

Refer to the WhatsApp documentation to learn more about [message template formatting and supported languages](https://developers.facebook.com/docs/whatsapp/message-templates/creation/).

### Authentication template requirements

Authentication templates have specific restrictions and pre-defined formatting set by WhatsApp for security compliance. When creating a template with the category of Authentication (i.e., Authentication Templates) using WhatsApp Templates, certain restrictions apply to comply with WhatsApp policies:

1. WhatsApp sets the body text of the template for every language and you cannot edit it.
2. You must include a **Copy Code** button, which users can use to copy the one-time passcode. You can edit the button label per language.

To learn more about the WhatsApp authentication content type, see [WhatsApp authentication](/docs/content/whatsappauthentication).

### Template translations

WhatsApp evaluates each template language translation on an individual basis. Content Templates offer searching and filtering tools to help manage your templates.

### Remove WhatsApp message templates

To delete a message template:

* Click on the template name on the WhatsApp Message Templates page.
* Click **Delete** at the bottom of the page.
* Alternatively, click on the 3-dot menu on the right-hand side of the template and select **Delete**.

Per WhatsApp guidelines, you may not reuse the name of a deleted template for 30 days after deletion.

> \[!NOTE]
>
> WhatsApp supports up to 6,000 template translations in total, across all templates, per account. Previous limits of 250 and 1,500 templates no longer apply.

### Submit templates for approval

WhatsApp reviews most templates submitted for approval within minutes. For detailed information about the approval process, [refer to this article](/docs/whatsapp/tutorial/message-template-approvals-statuses).

## Send WhatsApp messages with approved templates

Sending templated WhatsApp messages requires using the ContentSid parameter along with any necessary ContentVariables for dynamic content. To send a templated message, include the `ContentSid` parameter in the call with the `HX` content SID of the template you would like to send. If your template includes variables, set them using the `ContentVariables` parameter. For more information, see [Send templates created with the Content Template Builder](/docs/content/send-templates-created-with-the-content-template-builder).

The following example demonstrates how to structure template variables for a order confirmation message:

```bash
Hi {{1}}! Thanks for placing an order with us. We'll let you know once we process and deliver your order. Your order number is {{2}}. Thanks
```

In the `ContentVariables` parameter of the message resource, provide the end user's information as follows:

```bash
ContentVariables={ "1": "Joe", "2": "O12235234" }
```

Send a WhatsApp message using a message template

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    contentSid: "HXXXXXXXXX",
    contentVariables: JSON.stringify({ 1: "Name" }),
    from: "whatsapp:+15005550006",
    messagingServiceSid: "MGXXXXXXXX",
    to: "whatsapp:+18551234567",
  });

  console.log(message.body);
}

createMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client
import json

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.messages.create(
    content_sid="HXXXXXXXXX",
    to="whatsapp:+18551234567",
    from_="whatsapp:+15005550006",
    content_variables=json.dumps({"1": "Name"}),
    messaging_service_sid="MGXXXXXXXX",
)

print(message.body)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using System.Threading.Tasks;
using System.Collections.Generic;
using Newtonsoft.Json;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            contentSid: "HXXXXXXXXX",
            to: new Twilio.Types.PhoneNumber("whatsapp:+18551234567"),
            from: new Twilio.Types.PhoneNumber("whatsapp:+15005550006"),
            contentVariables: JsonConvert.SerializeObject(
                new Dictionary<string, Object>() { { "1", "Name" } }, Formatting.Indented),
            messagingServiceSid: "MGXXXXXXXX");

        Console.WriteLine(message.Body);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.type.PhoneNumber;
import java.util.HashMap;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import org.json.JSONObject;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message
                              .creator(new com.twilio.type.PhoneNumber("whatsapp:+18551234567"),
                                  new com.twilio.type.PhoneNumber("whatsapp:+15005550006"),
                                  "HXXXXXXXXX")
                              .setContentVariables(new JSONObject(new HashMap<String, Object>() {
                                  {
                                      put("1", "Name");
                                  }
                              }).toString())
                              .setMessagingServiceSid("MGXXXXXXXX")
                              .create();

        System.out.println(message.getBody());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"encoding/json"
	"fmt"
	"github.com/twilio/twilio-go"
	api "github.com/twilio/twilio-go/rest/api/v2010"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	ContentVariables, ContentVariablesError := json.Marshal(map[string]interface{}{
		"1": "Name",
	})

	if ContentVariablesError != nil {
		fmt.Println(ContentVariablesError)
		os.Exit(1)
	}

	params := &api.CreateMessageParams{}
	params.SetContentSid("HXXXXXXXXX")
	params.SetTo("whatsapp:+18551234567")
	params.SetFrom("whatsapp:+15005550006")
	params.SetContentVariables(string(ContentVariables))
	params.SetMessagingServiceSid("MGXXXXXXXX")

	resp, err := client.Api.CreateMessage(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Body != nil {
			fmt.Println(*resp.Body)
		} else {
			fmt.Println(resp.Body)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->messages->create(
    "whatsapp:+18551234567", // To
    [
        "contentSid" => "HXXXXXXXXX",
        "from" => "whatsapp:+15005550006",
        "contentVariables" => json_encode([
            "1" => "Name",
        ]),
        "messagingServiceSid" => "MGXXXXXXXX",
    ]
);

print $message->body;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .api
          .v2010
          .messages
          .create(
            content_sid: 'HXXXXXXXXX',
            to: 'whatsapp:+18551234567',
            from: 'whatsapp:+15005550006',
            content_variables: {
                '1' => 'Name'
              }.to_json,
            messaging_service_sid: 'MGXXXXXXXX'
          )

puts message.body
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:core:messages:create \
   --content-sid HXXXXXXXXX \
   --to whatsapp:+18551234567 \
   --from whatsapp:+15005550006 \
   --content-variables {\"1\":\"Name\"} \
   --messaging-service-sid MGXXXXXXXX
```

```bash
CONTENT_VARIABLES_OBJ=$(cat << EOF
{
  "1": "Name"
}
EOF
)
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
--data-urlencode "ContentSid=HXXXXXXXXX" \
--data-urlencode "To=whatsapp:+18551234567" \
--data-urlencode "From=whatsapp:+15005550006" \
--data-urlencode "ContentVariables=$CONTENT_VARIABLES_OBJ" \
--data-urlencode "MessagingServiceSid=MGXXXXXXXX" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACXXXXXXXXX",
  "api_version": "2010-04-01",
  "body": "Hello! 👍",
  "date_created": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_sent": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_updated": "Thu, 24 Aug 2023 05:01:45 +0000",
  "direction": "outbound-api",
  "error_code": null,
  "error_message": null,
  "from": "whatsapp:+15005550006",
  "num_media": "0",
  "num_segments": "1",
  "price": null,
  "price_unit": null,
  "messaging_service_sid": "MGXXXXXXXX",
  "sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "queued",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json"
  },
  "to": "whatsapp:+18551234567",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

### Include line breaks and escape characters in templates

If you are rendering line breaks or other escaped characters, encode the line breaks properly based on the language you are using. The Twilio Console may show line breaks and other escaped characters in their raw form, such as `\n`.

## Initiate the customer service window with a generic template

You may want to send different types of notifications and messages to your users. However, it is difficult and inefficient to go through the template approval process for every type of message you want to send to your end users.

For example, you might want to send a time-sensitive message such as "We are having a company-wide announcement at 11 AM." WhatsApp is unlikely to approve this template, making it challenging to build a real notification flow.

To work around this, you can create a generic template that asks your end users to respond. An example of a generic notification template you can submit for approval is:

`"Hello {{1}}, we have a new update regarding your account. Respond to this message to receive it. Have a nice day!"`

Once an end user replies to this templated message, it initiates the 24-hour customer service window, during which your business can send free-form messages.

## Monitor live templates

Once you start using your templates, monitor them for excessive negative user feedback.

### Paused and deactivated templates

WhatsApp may pause templates that receive excessive negative feedback to protect sender quality ratings. If end users repeatedly block or report spam in association with a message template, WhatsApp will pause the template for a period of time. Pausing durations are as follows:

* First instance: **Paused** for 3 hours
* Second instance: **Paused** for 6 hours
* Third instance: **Deactivated**

When WhatsApp pauses a template a third time, WhatsApp will permanently deactivate it. Messages using paused or deactivated templates will fail. Paused and deactivated message templates that you attempt to send do not count against the daily messaging limit.

### Get alerts for paused, deactivated, and rejected templates

Twilio can send a notification using [Twilio Alerts](/docs/messaging/guides/debugging-tools#custom-alerts) when a template status changes to `paused`, `disabled`, or `rejected`. To get notified, create an alert for error 63041 (`paused`), 63042 (`disabled`), or 63040 (`rejected`). We also offer alarms for approved templates with code 63046.

## Include links in your templates

You may send URLs in a template. For example: "Thanks for registering with Example Business. To continue, click on https://app.example.com."

WhatsApp does not support URL previews in templated messages. In-session messages support URL previews.

## Frequently Asked Questions

### How long does template approval take?

WhatsApp reviews and approves most templates within minutes, though complex templates may take longer.

### Can you edit a template after submission?

No, submitted templates cannot be edited. You must create another template with the desired changes.

### How many templates can you create?

WhatsApp supports up to 6,000 template translations total across all templates per account.

### What happens if users report your template as spam?

WhatsApp may pause your template for 3-6 hours, and permanently deactivate it after the third pause.

## Next steps

After understanding WhatsApp message templates, explore these related resources:

* [Set up WhatsApp Sandbox](/docs/whatsapp/sandbox) to test templates in your development environment.
* Create templates with the [Content Template Builder](/docs/content/create-templates-with-the-content-template-builder) using Twilio Console.
* Explore the [WhatsApp API documentation](/docs/whatsapp/api).
* Learn about [Message template approval process](/docs/whatsapp/tutorial/message-template-approvals-statuses).
* Learn about [WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing).

===============

# Send and Receive Media Messages with WhatsApp in Node.js

> \[!WARNING]
>
> Twilio is launching a new Console. Some screenshots on this page may show the Legacy Console and therefore may no longer be accurate. We are working to update all screenshots to reflect the new Console experience. [Learn more about the new Console](https://www.twilio.com/blog/new-and-improved-console-now-in-general-availability).

In this tutorial, we'll set up a Node.js/Express application that uses the [WhatsApp Channel](/docs/whatsapp) to:

* Send media messages
* Reply to incoming messages with media

The code samples in this tutorial use [Twilio's Node SDK](https://github.com/twilio/twilio-node), Node.js and [Express](https://expressjs.com/).

## Send outbound media messages through WhatsApp

Just like when [sending an MMS](/docs/messaging/tutorials/how-to-send-sms-messages), sending an outbound WhatsApp message uses Twilio's [Message resource](/docs/messaging/api/message-resource). This section walks you through the setting up and sending media in a WhatsApp message. Media can consist of images, audio files, and PDF documents.

### Sign up for (or log in to) your Twilio Account and activate the Sandbox

Before you can send a WhatsApp message from your web language, you'll need to [sign up for a Twilio account](https://www.twilio.com/try-twilio) or sign into your existing account and activate the [Twilio Sandbox for WhatsApp](https://www.twilio.com/console/sms/whatsapp/sandbox). The Sandbox allows you to prototype with WhatsApp immediately using a shared phone number without waiting for your Twilio number to be approved by WhatsApp.

To get started, select a number from the available sandbox numbers to activate your sandbox.

![Twilio Sandbox setup for WhatsApp with number selection and activation button.](https://docs-resources.prod.twilio.com/12bea172c44c2e43ed9695169dbbf3c1c0879a5cd2cfff3150de1041648e6621.png)

Be sure to take note of the phone number you choose in the Sandbox. You will need this later when we're ready to send some messages.

#### Gather your Twilio account information

Before you can send any messages, you'll need to gather your Twilio account credentials. You can find these in the [Twilio Console](https://www.twilio.com/console).

* **Account SID** - Used to identify yourself in API requests
* **Auth Token** - Used to authenticate REST API requests

![Project info showing account SID and hidden auth token with option to show.](https://docs-resources.prod.twilio.com/bc6afaa57c1fe443cae20a658cf7cd424c18fa660b55c3b6722f77622844fc4c.png)

For all of our code snippets and Node.js examples, you need to authenticate with the **Account SID** and **Auth Token**.

> \[!CAUTION]
>
> This tutorial uses hard-coded credentials at the top of the code; you should follow [best practices](/docs/usage/secure-credentials) regarding credential protection in production.

### Send a media WhatsApp message via the REST API

To send an outgoing media message via WhatsApp from your Twilio account you'll need to make an `HTTP POST` to Twilio's [Message resource](/docs/messaging/api/message-resource).

Sending a media message through WhatsApp is similar to sending a text-based message over WhatsApp with one important addition: the `media_url` parameter. The `media_url` parameter in this code tells Twilio where to retrieve the media that we want to include in the WhatsApp message. (You can [prevent unauthorized access to your media](https://help.twilio.com/hc/en-us/articles/223183748-Prevent-Unauthorized-Access-to-Your-Media-with-HTTP-Basic-Auth) by turning on [HTTP Basic Auth for media URLs in the Twilio Console](https://www.twilio.com/console/sms/settings).)

> \[!WARNING]
>
> If you have joined your Sandbox > 24 hours ago, you will need to send a fresh inbound message to your WhatsApp number in order to then send yourself a media message. WhatsApp currently does not support media in "template" messages that take place outside of a 24-hour "session".

Twilio's Node SDK helps you to create a new instance of the Message resource. When you do this, you'll specify the `to`, `from`, and `mediaUrl` parameters of your message.

If you don't already have the Node SDK installed you can install it using NuGet:

```bash
npm install twilio
```

Now, create a file named index.js and include the following code:

Send a media message with WhatsApp

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    from: "whatsapp:+14155238886",
    mediaUrl: [
      "https://images.unsplash.com/photo-1545093149-618ce3bcf49d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=668&q=80",
    ],
    to: "whatsapp:+15017122661",
  });

  console.log(message.sid);
}

createMessage();
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "api_version": "2010-04-01",
  "body": "Hello! 👍",
  "date_created": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_sent": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_updated": "Thu, 24 Aug 2023 05:01:45 +0000",
  "direction": "outbound-api",
  "error_code": null,
  "error_message": null,
  "from": "whatsapp:+14155238886",
  "num_media": "0",
  "num_segments": "1",
  "price": null,
  "price_unit": null,
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "queued",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json"
  },
  "to": "whatsapp:+15017122661",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

Replace the placeholder values for `accountSid` and `authToken` with your unique values. You can find these in your [Twilio console](https://www.twilio.com/console).

> \[!CAUTION]
>
> It's okay to hard-code your credentials when getting started, but you should use environment variables to keep them secret before deploying to production. Check out [how to keep your Twilio credentials secure](/docs/usage/secure-credentials).

The **to** number should be the phone number for the destination WhatsApp account in the [E.164 format](/docs/glossary/what-e164). If you are using the WhatsApp Sandbox, you can only send messages to numbers that have joined the Sandbox.

You'll tell Twilio which phone number to use to send this message by replacing the `from` number with the `whatsapp:` channel identifier followed by the Sandbox number in [E.164](/docs/glossary/what-e164) format.

Save the file and run it:

```bash
node index.js
```

In a few moments, you should receive a WhatsApp message with an image!

> \[!WARNING]
>
> WhatsApp does not support including a text body in the same message as a video, audio file, document, contact (vCard), or location. If you pass the `Body` parameter on a message with one of these media types, the body will be ignored and not delivered to the device.

#### Understanding Twilio's Response

When you send an outbound WhatsApp media message, Twilio sends data about the message in its response to your request. The JSON response contains the unique SID and URI for your media resource:

```javascript
"subresource_uris": {"media": "/2010-04 01/Accounts/ACxxxxxxxx/Messages/SMxxxxxxxxxxxxx/Media.json"}
```

When the Twilio REST API creates your new Message resource, it saves the image found at the specified `mediaUrl` as a [Media resource](/docs/messaging/api/media-resource). Once created, you can access this resource at any time via the API.

You can print this value from your JavaScript code to see where the image is stored. The following line to the end of your `index.js` file prints out your newly provisioned Media URI:

```javascript
console.log(message.SubresourceUris.media);
```

## Respond with media in WhatsApp

To reply using media to incoming WhatsApp messages, you'll need to provide Twilio with a webhook URL that points to a server that runs code to inspect and save the media files.

> \[!WARNING]
>
> WhatsApp media content is currently only supported in Session Messages. If the WhatsApp session with a user expires, you must wait for an inbound message to create a new session before you can send them a media message.

### What are webhooks?

Webhooks are user-defined [HTTP](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol) callbacks. They are usually triggered by some event, such as receiving an SMS message or an incoming phone call. When that event occurs, Twilio makes an HTTP request (usually a [`POST` or a `GET`](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods)) to the URL configured for the webhook.

To handle a webhook, you only need to build a small web application that can accept the HTTP requests. Almost all server-side programming languages offer some framework for you to do this. In this tutorial, we'll be setting up our web application with [Express](https://github.com/expressjs/express).

Webhook functionality is the same for every Twilio application. First, a webhook makes an HTTP request to a URI that you provide to Twilio. When it receives this request, your application performs pre-defined logic. This could be something like database read/writes or calling another API. Finally, your application sends a TwiML response to Twilio in which it specifies the instructions for Twilio to follow.

### What is TwiML?

[TwiML](/docs/voice/twiml) is the Twilio Markup Language, which is just to say that it's an [XML](https://en.wikipedia.org/wiki/XML) document with special tags defined by Twilio to help you build your messaging and voice applications.

TwiML is easier shown than explained:

```bash
<?xml version="1.0" encoding="UTF-8"?>
<Response>
   <Message>Thanks for the message!</Message>
</Response>
```

Every TwiML document has the **\<Response>** element, which can contain one or more **verbs**. Verbs are actions you'd like Twilio to take, such as [\<Say>](/docs/voice/twiml/say) a greeting to a caller, or send an SMS [\<Message>](/docs/messaging/twiml/message) in reply to an incoming message. For a full reference on everything you can do with TwiML, refer to our [TwiML API Reference](/docs/voice/twiml).

To send back a media in your WhatsApp reply, you need to include the **media** TwiML element with the URL to the media file. One media attachment is supported per message, with a size limit of 5MB.

### Generate TwiML in your application

To reply to an incoming WhatsApp message, you can either write raw TwiML or use an SDK. When you use the SDK, you don't have to worry about generating the raw XML yourself.

```js title="Reply with media to incoming WhatsApp messages"
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

const router = express.Router();
const goodBoyUrl = 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?'
  + 'ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80';

router.post('/', async (req, res) => {
  const { body } = req;

  let message;

  if (body.NumMedia > 0) {
    message = new MessagingResponse().message("Thanks for the image! Here's one for you!");
    message.media(goodBoyUrl);
  } else {
    message = new MessagingResponse().message('Send us an image!');
  }

  res.set('Content-Type', 'text/xml');
  res.send(message.toString()).status(200);
});

module.exports = router;
```

You have the code - now you need a URL you can give to Twilio.

Twilio can only access public servers on the Internet. That means you need to publish your application to a web or cloud hosting provider (of which [there are many](https://www.google.com/#q=cloud+web+hosting)), you can host it on your own server, or you can use a service such as [ngrok](https://ngrok.com/) to expose your local development machine to the internet. (We only recommend the latter for development and testing purposes and not for production deployments.)

To send media in response to an incoming WhatsApp message, add an image URL. If necessary, restart your server, then send a message to your WhatsApp number again. You should receive a WhatsApp message that includes an image. Check out the API Reference for more details.

### Configure your webhook URL

Now that you have a URL for your web application's TwiML reply generating routine, you can configure your Twilio phone number to call your webhook URL whenever a new WhatsApp message comes in for you.

You can set the webhook URL for incoming messages to your server in the [Sandbox](https://www.twilio.com/console/sms/whatsapp/sandbox?).

Make sure you choose `HTTP POST` or `HTTP GET` to correspond to what your web application is expecting. Usually, the default of `POST` is fine.

> \[!WARNING]
>
> Twilio supports HTTP Basic and Digest Authentication. Authentication allows you to password protect your TwiML URLs on your web server so that only you and Twilio can access them.
>
> Learn more [here](/docs/usage/security#http-authentication), and check out our [guide to securing your Express application by validating incoming Twilio requests](/docs/usage/tutorials/how-to-secure-your-express-app-by-validating-incoming-twilio-requests).

## Examine media on incoming WhatsApp messages

Viewing, saving, or manipulating the media files on incoming WhatsApp messages also involves configuring a Webhook URL. The URL points to a server generating TwiML instructions including the media you want to send.

### Get incoming message details

When Twilio calls your webhook, it [sends a number of parameters](/docs/messaging/twiml#twilios-request-to-your-application) about the message you just received. Most of these, such as the `To` phone number, the `From` phone number, and the `Body` of the message are available as properties of the request parameter to our action method.

### Get URLs to the media

Twilio sends form variables named `MediaUrlX`, where ***X*** is a zero-based index. WhatsApp messages will only contain one media file per incoming message, so you can access the file at `MediaUrl0` on the incoming request from Twilio to your webhook URL.

### Determine Content-Type of media

Attachments to WhatsApp messages can be of many different file types, including JPG, MP3, and PDF. (See more about the supported file types in [the FAQs](https://help.twilio.com/hc/en-us/articles/360017961894-Sending-and-Receiving-Media-with-WhatsApp-Messaging-on-Twilio-Beta-?_ga=2.156422648.2135497581.1552927418-1150959182.1546903029).) Twilio handles the determination of the file type for you and you can get the [standard mime type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types) from the `MediaContentTypeX` parameter. If you are expecting photos and images, then you will likely see a lot of attachments with the mime type image/jpeg.

And that's all there is to it; receiving and responding is exactly the same as you would do in any SMS app with our Messaging API. Cool, right?

## What's next?

All the code, in a complete working project, is available on GitHub. To dig deeper, head over to the [Messaging API Reference](/docs/messaging/api) and learn more about the [Twilio webhook request](/docs/messaging/twiml) and the [REST API Media resource](/docs/messaging/api/media-resource). Also, you should be aware of the [pricing](https://www.twilio.com/en-us/sms/pricing/us) for storage of all the media files that you keep on Twilio's servers.

We'd love to hear what you build with this!

============

# Rich Messaging Features in the Twilio API for WhatsApp

Twilio supports the latest WhatsApp-specific features to make it easier for your customers to engage with you.

## Rich outbound messages with Content Template Builder

WhatsApp's latest rich features are supported using Twilio's [Content Template Builder](/docs/content/overview).

These features include:

* Formatting message text
* Messages including location information
* Card messages with images, text, and/or buttons
* List messages
* Call-to-action messages
* Messages with quick reply buttons
* Product Catalogs
* Carousels
* Flows

## Rich Inbound Features in Webhooks

Twilio supports the latest inbound metadata made available by WhatsApp. This includes the end user's profile name, click to WhatsApp ad parameters, and much more.

See [our request to your webhook URL](/docs/messaging/guides/webhook-request#whatsapp-specific-parameters) for all of the supported inbound parameters for rich messages.

## Formatting in WhatsApp Messages

WhatsApp allows text, emojis, and some formatting in messages. To format all or part of a message, use these formatting symbols:

| Formatting           | Symbol                   | Example                  |
| -------------------- | ------------------------ | ------------------------ |
| Bold                 | Asterisk (\*\*)          | Your total is *$10.50*.  |
| Italic               | Underscore (\_)          | Welcome to *WhatsApp*!   |
| Strike-through       | Tilde (\~)               | This is ~~better~~ best! |
| Code / Pre-formatted | Three backticks (\`\`\`) | `print 'Hello World';`   |

Send a formatted WhatsApp message

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    body: "🎶I am _not_ ~pushing~ throwing away my *shot*!",
    from: "whatsapp:+15005550006",
    messagingServiceSid: "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    to: "whatsapp:+14155552345",
  });

  console.log(message.body);
}

createMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.messages.create(
    from_="whatsapp:+15005550006",
    messaging_service_sid="MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    body="🎶I am _not_ ~pushing~ throwing away my *shot*!",
    to="whatsapp:+14155552345",
)

print(message.body)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            from: new Twilio.Types.PhoneNumber("whatsapp:+15005550006"),
            messagingServiceSid: "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            body: "🎶I am _not_ ~pushing~ throwing away my *shot*!",
            to: new Twilio.Types.PhoneNumber("whatsapp:+14155552345"));

        Console.WriteLine(message.Body);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.type.PhoneNumber;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message
                              .creator(new com.twilio.type.PhoneNumber("whatsapp:+14155552345"),
                                  new com.twilio.type.PhoneNumber("whatsapp:+15005550006"),
                                  "🎶I am _not_ ~pushing~ throwing away my *shot*!")
                              .setMessagingServiceSid("MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
                              .create();

        System.out.println(message.getBody());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	api "github.com/twilio/twilio-go/rest/api/v2010"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &api.CreateMessageParams{}
	params.SetFrom("whatsapp:+15005550006")
	params.SetMessagingServiceSid("MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
	params.SetBody("🎶I am _not_ ~pushing~ throwing away my *shot*!")
	params.SetTo("whatsapp:+14155552345")

	resp, err := client.Api.CreateMessage(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Body != nil {
			fmt.Println(*resp.Body)
		} else {
			fmt.Println(resp.Body)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->messages->create(
    "whatsapp:+14155552345", // To
    [
        "from" => "whatsapp:+15005550006",
        "messagingServiceSid" => "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "body" => "🎶I am _not_ ~pushing~ throwing away my *shot*!",
    ]
);

print $message->body;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .api
          .v2010
          .messages
          .create(
            from: 'whatsapp:+15005550006',
            messaging_service_sid: 'MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            body: '🎶I am _not_ ~pushing~ throwing away my *shot*!',
            to: 'whatsapp:+14155552345'
          )

puts message.body
```

```bash
EXCLAMATION_MARK='!'
# Install the twilio-cli from https://twil.io/cli

twilio api:core:messages:create \
   --from whatsapp:+15005550006 \
   --messaging-service-sid MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --body "🎶I am _not_ ~pushing~ throwing away my *shot*$EXCLAMATION_MARK" \
   --to whatsapp:+14155552345
```

```bash
EXCLAMATION_MARK='!'
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
--data-urlencode "From=whatsapp:+15005550006" \
--data-urlencode "MessagingServiceSid=MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
--data-urlencode "Body=🎶I am _not_ ~pushing~ throwing away my *shot*$EXCLAMATION_MARK" \
--data-urlencode "To=whatsapp:+14155552345" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "api_version": "2010-04-01",
  "body": "🎶I am _not_ ~pushing~ throwing away my *shot*!",
  "date_created": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_sent": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_updated": "Thu, 24 Aug 2023 05:01:45 +0000",
  "direction": "outbound-api",
  "error_code": null,
  "error_message": null,
  "from": "whatsapp:+15005550006",
  "num_media": "0",
  "num_segments": "1",
  "price": null,
  "price_unit": null,
  "messaging_service_sid": "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "queued",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json"
  },
  "to": "whatsapp:+14155552345",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

![WhatsApp message with music note emoji, text 'I am not pushing throwing away my shot!' showing italics, strikethrough, and bold.](https://docs-resources.prod.twilio.com/a41e3fcfad1b954f49bf44c313f9a9cdaa3e01182cd77d23f29701fcbe0ab392.jpg)

## Location Messages with WhatsApp

The Twilio API for WhatsApp supports sending and receiving GPS location data in messages to and from WhatsApp users.

> \[!WARNING]
>
> Facebook does not support location messaging in [WhatsApp message
> templates](/docs/whatsapp/key-concepts#message-templates)
> at this time. Twilio Conversations also does not support location messaging
> functionality at this time. To send and receive location messages with
> WhatsApp, you'll need to use session messages leveraging the API or Twilio's
> SDKs.

### Send outbound location messages

Sending outbound location messages over WhatsApp is similar to sending a text-based message, with the addition of the `PersistentAction` parameter in your Twilio API requests. Outbound location messages must include the following information:

* `Body={name}`
* `PersistentAction=geo:{latitude},{longitude}` OR
* `PersistentAction=geo:{latitude},{longitude}|{label}`

| Name      | Type   | Required                    | Description                                                                                                                       |
| --------- | ------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| name      | String | Yes (for outbound messages) | The name of the location being sent.(Location must exist in Google maps for the hyperlink to work on Mac/Windows WhatsApp client) |
| latitude  | Number | Yes                         | Latitude of the location being sent                                                                                               |
| longitude | Number | Yes                         | Longitude of the location being sent                                                                                              |
| label     | String | No                          | Optional free-form text to display under the location `name`                                                                      |

Send a WhatsApp message with location information

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    body: "This is one of the Twilio office locations",
    messagingServiceSid: "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    persistentAction: ["geo:37.787890,-122.391664|375 Beale St"],
    to: "whatsapp:+15005550006",
  });

  console.log(message.body);
}

createMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.messages.create(
    to="whatsapp:+15005550006",
    messaging_service_sid="MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    body="This is one of the Twilio office locations",
    persistent_action=["geo:37.787890,-122.391664|375 Beale St"],
)

print(message.body)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using System.Threading.Tasks;
using System.Collections.Generic;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            to: new Twilio.Types.PhoneNumber("whatsapp:+15005550006"),
            messagingServiceSid: "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            body: "This is one of the Twilio office locations",
            persistentAction: new List<string> { "geo:37.787890,-122.391664|375 Beale St" });

        Console.WriteLine(message.Body);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.type.PhoneNumber;
import java.util.Arrays;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message
                              .creator(new com.twilio.type.PhoneNumber("whatsapp:+15005550006"),
                                  "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                                  "This is one of the Twilio office locations")
                              .setPersistentAction(Arrays.asList("geo:37.787890,-122.391664|375 Beale St"))
                              .create();

        System.out.println(message.getBody());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	api "github.com/twilio/twilio-go/rest/api/v2010"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &api.CreateMessageParams{}
	params.SetTo("whatsapp:+15005550006")
	params.SetMessagingServiceSid("MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
	params.SetBody("This is one of the Twilio office locations")
	params.SetPersistentAction([]string{
		"geo:37.787890,-122.391664|375 Beale St",
	})

	resp, err := client.Api.CreateMessage(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Body != nil {
			fmt.Println(*resp.Body)
		} else {
			fmt.Println(resp.Body)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->messages->create(
    "whatsapp:+15005550006", // To
    [
        "messagingServiceSid" => "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "body" => "This is one of the Twilio office locations",
        "persistentAction" => ["geo:37.787890,-122.391664|375 Beale St"],
    ]
);

print $message->body;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .api
          .v2010
          .messages
          .create(
            to: 'whatsapp:+15005550006',
            messaging_service_sid: 'MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            body: 'This is one of the Twilio office locations',
            persistent_action: [
              'geo:37.787890,-122.391664|375 Beale St'
            ]
          )

puts message.body
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:core:messages:create \
   --to whatsapp:+15005550006 \
   --messaging-service-sid MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --body "This is one of the Twilio office locations" \
   --persistent-action "geo:37.787890,-122.391664|375 Beale St"
```

```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
--data-urlencode "To=whatsapp:+15005550006" \
--data-urlencode "MessagingServiceSid=MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
--data-urlencode "Body=This is one of the Twilio office locations" \
--data-urlencode "PersistentAction=geo:37.787890,-122.391664|375 Beale St" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "api_version": "2010-04-01",
  "body": "This is one of the Twilio office locations",
  "date_created": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_sent": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_updated": "Thu, 24 Aug 2023 05:01:45 +0000",
  "direction": "outbound-api",
  "error_code": null,
  "error_message": null,
  "from": "+14155552345",
  "num_media": "0",
  "num_segments": "1",
  "price": null,
  "price_unit": null,
  "messaging_service_sid": "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "queued",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json"
  },
  "to": "whatsapp:+15005550006",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

Your user should receive a message that looks like this:

![WhatsApp message showing Twilio API link preview with logo and description.](https://docs-resources.prod.twilio.com/5c511cb07a9daf7e05522cea3a89a949abf573f2c17a9637afab7b3139a789d8.jpg)

### Receive inbound location messages

You can also receive inbound location messages with the Twilio API for WhatsApp.

Locations do not appear in [the Twilio Console](https://www.twilio.com/console) at this time. However, your web application will receive the location data in the `POST` request that Twilio sends. This data will be included in the HTTP `POST` request for the incoming message that we send to your webhook.

You will be able to access the following parameters in the `POST` request values Twilio sends to your application when you receive a WhatsApp location message:

* `Latitude`
* `Longitude`
* `Address`
* `Label`

#### Location Message Types

There are two types of location that users can send with WhatsApp: **Current Location** and Live Location. *Live Location is not currently supported by the WhatsApp Business API.*

*Current Location* is a static type of content, similar to a timestamp. This means the location information you receive from a user indicates where the user was in that particular moment in time when they triggered the "send location" action.

Below is a sample payload containing location information. The `Body={name}` parameter is not required for inbound messages.

```bash
Latitude=37.7879277&Longitude=-122.3937508&Address=375+Beale+St%2C+San+Francisco%2C+CA+94105&SmsMessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&NumMedia=0&SmsSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&Label=Twilio+Inc&Body=&To=whatsapp%3A%2B14155238886&NumSegments=1&MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&AccountSid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&From=whatsapp%3A%2B12345678900&ApiVersion=2010-04-01
```

## Preview weblinks in freeform WhatsApp messages

When you are within the [24-hour session](/docs/whatsapp/api#conversational-messaging-on-whatsapp) (initiated by a customer sending your business a message), you can send freeform, non-templated messages with a customer. During this 24-hour window, WhatsApp messages that contain web links display a web page snippet preview on the WhatsApp client. WhatsApp does not currently support URL previews in templated messages.

![WhatsApp message with link that also displays a preview of the link.](https://docs-resources.prod.twilio.com/f21fa04e389d17d098b0582a3e6a71ffb03df0c6da7444090e8103310c86385d.jpg)

## Start conversations with deep links

Customers can initiate a conversation with you on WhatsApp through URL deep links, such as on your website. If end users have WhatsApp installed on their devices, clicking the deep link opens a conversation with your business inside of WhatsApp.

**Deep link format** : `https://wa.me/<e164 number>&text=Hello!`

Deep links can be embedded in web or mobile apps, advertised on the web, or placed in other visible locations. They are an effective way to start conversations without using [WhatsApp message templates](/docs/whatsapp/key-concepts#message-templates).

Send a message containing a link

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    body: "Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp",
    messagingServiceSid: "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    to: "whatsapp:+15005550006",
  });

  console.log(message.body);
}

createMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.messages.create(
    to="whatsapp:+15005550006",
    messaging_service_sid="MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    body="Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp",
)

print(message.body)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            to: new Twilio.Types.PhoneNumber("whatsapp:+15005550006"),
            messagingServiceSid: "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            body: "Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp");

        Console.WriteLine(message.Body);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.type.PhoneNumber;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message
                              .creator(new com.twilio.type.PhoneNumber("whatsapp:+15005550006"),
                                  "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                                  "Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp")
                              .create();

        System.out.println(message.getBody());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	api "github.com/twilio/twilio-go/rest/api/v2010"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &api.CreateMessageParams{}
	params.SetTo("whatsapp:+15005550006")
	params.SetMessagingServiceSid("MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
	params.SetBody("Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp")

	resp, err := client.Api.CreateMessage(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Body != nil {
			fmt.Println(*resp.Body)
		} else {
			fmt.Println(resp.Body)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->messages->create(
    "whatsapp:+15005550006", // To
    [
        "messagingServiceSid" => "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "body" =>
            "Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp",
    ]
);

print $message->body;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .api
          .v2010
          .messages
          .create(
            to: 'whatsapp:+15005550006',
            messaging_service_sid: 'MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            body: 'Let\'s build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp'
          )

puts message.body
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:core:messages:create \
   --to whatsapp:+15005550006 \
   --messaging-service-sid MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --body "Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp"
```

```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
--data-urlencode "To=whatsapp:+15005550006" \
--data-urlencode "MessagingServiceSid=MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
--data-urlencode "Body=Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "api_version": "2010-04-01",
  "body": "Let's build something amazing with WhatsApp: https://www.twilio.com/docs/whatsapp",
  "date_created": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_sent": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_updated": "Thu, 24 Aug 2023 05:01:45 +0000",
  "direction": "outbound-api",
  "error_code": null,
  "error_message": null,
  "from": "+14155552345",
  "num_media": "0",
  "num_segments": "1",
  "price": null,
  "price_unit": null,
  "messaging_service_sid": "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "queued",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json"
  },
  "to": "whatsapp:+15005550006",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

## QR Codes and Short Links

QR codes and short links enable consumers to initiate a conversation with a business without adding a new contact in their phone!

### What are QR codes?

A QR ("Quick Response") code is a type of barcode that you can use to open up a new WhatsApp conversation. Your end uses can scan your business' [QR code](https://developers.facebook.com/docs/whatsapp/business-management-api/qr-codes), and the WhatsApp business profile will automatically load, with a pre-filled message that your business can define.

Here's an example of a QR Code:

![QR code with WhatsApp logo for scanning.](https://docs-resources.prod.twilio.com/7b2254b05dce2de30691fab3eea5e8f3a9ab05f422657d6c07ae810ca2b36300.png)

### What are Short links?

Businesses can generate short links that, when clicked, load pre-filled messages. You can edit or delete these links at any time. Short links mask phone numbers so that only a random code appears in the URL.

### How can businesses use QR codes and short links?

* **Get in touch with more users.** Businesses can place QR codes on product packaging, receipts/invoices, at your storefront and other physical or digital surfaces. These can be used to respond to customer-initiated questions, such as pre-sales inquiries or post-purchase support.
* **Collect opt-in**. Businesses can collect opt-in for notifications via QR codes and/or short links.

### How can I get a QR code or short link?

To get a WhatsApp QR code or short link, open a support ticket and provide the WhatsApp Sender (Phone Number) and the message you would like to have embedded in the QR code or short link.

## What's Next?

Ready to send feature-rich messages to your end users over WhatsApp? Check out some of these resources to get started (or keep) building:

* [The WhatsApp API Overview](/docs/whatsapp/api)
* [Learn key concepts and terms for building with WhatsApp and Twilio](/docs/whatsapp/key-concepts)
* [Register a WhatsApp sender](/docs/whatsapp#whatsapp-sender-registration)


============

# Using Buttons In WhatsApp

## What are WhatsApp buttons?

WhatsApp lets you add buttons to [message templates](/docs/whatsapp/key-concepts#message-templates). There are two types of buttons: **Quick replies** and **Call to action** buttons. These buttons open up many opportunities for businesses worldwide to engage with their customers on WhatsApp, one of the most popular messaging applications.

Quick replies let businesses define buttons that users can tap to respond. When a Quick reply is tapped, a message containing the button text is sent in the conversation.

Call to action buttons trigger a phone call or open a website when tapped. At this time, WhatsApp does not support deep links.

To use buttons, you need to submit them as part of a message template to WhatsApp. Once approved, templates containing buttons can be sent by sending the message text in your API request.

## Creating templates with buttons

To use buttons, you need to submit a template that contains the buttons. Go to the Twilio console, navigate to **[Messaging > Content Template Builder](/console/sms/content-template-builder)**, and click the **Create new** button. Here, you need to submit a message template containing buttons.

The content types that can contain buttons are:

* Call to action
* Quick reply
* Card
* Carousel
* WhatsApp Card

The following buttons are available:

* Quick reply
* URL
* Phone Call
* WhatsApp Voip call
* Copy Coupon Code

All buttons can be used in session without approval except copy coupon code. Coupons always need approval.

For more information, see [Sending Notifications with Templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates#set-up-whatsapp-message-templates-in-your-twilio-account) and [Content Types Overview](/docs/content/content-types-overview).

![WhatsApp button template with options for call to action, visit website, and phone number.](https://docs-resources.prod.twilio.com/fc00ea613c6c3aa39f055732a7d7ed5f1bbe44b9f661f17498a0acda5a81ea3e.png)

## Sending templates with buttons

Once your template with buttons has been approved, you can send buttons as part of your WhatsApp messages. To send a button, send the template like any other Content Template. To see how to send Content Templates, see [Send Templates Created with Content Template Builder](/docs/content/send-templates-created-with-the-content-template-builder).

| ![WhatsApp chat with Perspective Coffee showing order confirmation and call-to-action buttons for payment.](https://docs-resources.prod.twilio.com/19665efddd53aa00027d790f33a503d0fc679663a836079b65e7fa68e1457300.png) | ![WhatsApp chat showing Twilio passcode 1112223 with encryption notice.](https://docs-resources.prod.twilio.com/18ad792a63342b5c0ebc01bf03017b79e4b373d86ed9aeaf22424f61b164b290.png) |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| *Call to action buttons*                                                                                                                                                                                                 | *Quick reply button*                                                                                                                                                                  |

> \[!NOTE]
>
> Quick reply buttons can be sent without approval within [a 24 hour session](/docs/whatsapp/key-concepts#the-24-hour-window-or-24-hour-session). To send quick reply buttons, create the template but do not submit it for approval. You can then send the quick reply template directly without approval in a 24 hour session.

Sending Content Templates

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    contentSid: "HXXXXXXXXX",
    contentVariables: JSON.stringify({ 1: "Name" }),
    from: "whatsapp:+15551234567",
    messagingServiceSid: "MGXXXXXXXX",
    to: "whatsapp:+18551234567",
  });

  console.log(message.body);
}

createMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client
import json

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.messages.create(
    content_sid="HXXXXXXXXX",
    to="whatsapp:+18551234567",
    from_="whatsapp:+15551234567",
    content_variables=json.dumps({"1": "Name"}),
    messaging_service_sid="MGXXXXXXXX",
)

print(message.body)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using System.Threading.Tasks;
using System.Collections.Generic;
using Newtonsoft.Json;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            contentSid: "HXXXXXXXXX",
            to: new Twilio.Types.PhoneNumber("whatsapp:+18551234567"),
            from: new Twilio.Types.PhoneNumber("whatsapp:+15551234567"),
            contentVariables: JsonConvert.SerializeObject(
                new Dictionary<string, Object>() { { "1", "Name" } }, Formatting.Indented),
            messagingServiceSid: "MGXXXXXXXX");

        Console.WriteLine(message.Body);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.type.PhoneNumber;
import java.util.HashMap;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import org.json.JSONObject;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message
                              .creator(new com.twilio.type.PhoneNumber("whatsapp:+18551234567"),
                                  new com.twilio.type.PhoneNumber("whatsapp:+15551234567"),
                                  "HXXXXXXXXX")
                              .setContentVariables(new JSONObject(new HashMap<String, Object>() {
                                  {
                                      put("1", "Name");
                                  }
                              }).toString())
                              .setMessagingServiceSid("MGXXXXXXXX")
                              .create();

        System.out.println(message.getBody());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"encoding/json"
	"fmt"
	"github.com/twilio/twilio-go"
	api "github.com/twilio/twilio-go/rest/api/v2010"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	ContentVariables, ContentVariablesError := json.Marshal(map[string]interface{}{
		"1": "Name",
	})

	if ContentVariablesError != nil {
		fmt.Println(ContentVariablesError)
		os.Exit(1)
	}

	params := &api.CreateMessageParams{}
	params.SetContentSid("HXXXXXXXXX")
	params.SetTo("whatsapp:+18551234567")
	params.SetFrom("whatsapp:+15551234567")
	params.SetContentVariables(string(ContentVariables))
	params.SetMessagingServiceSid("MGXXXXXXXX")

	resp, err := client.Api.CreateMessage(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Body != nil {
			fmt.Println(*resp.Body)
		} else {
			fmt.Println(resp.Body)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->messages->create(
    "whatsapp:+18551234567", // To
    [
        "contentSid" => "HXXXXXXXXX",
        "from" => "whatsapp:+15551234567",
        "contentVariables" => json_encode([
            "1" => "Name",
        ]),
        "messagingServiceSid" => "MGXXXXXXXX",
    ]
);

print $message->body;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .api
          .v2010
          .messages
          .create(
            content_sid: 'HXXXXXXXXX',
            to: 'whatsapp:+18551234567',
            from: 'whatsapp:+15551234567',
            content_variables: {
                '1' => 'Name'
              }.to_json,
            messaging_service_sid: 'MGXXXXXXXX'
          )

puts message.body
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:core:messages:create \
   --content-sid HXXXXXXXXX \
   --to whatsapp:+18551234567 \
   --from whatsapp:+15551234567 \
   --content-variables {\"1\":\"Name\"} \
   --messaging-service-sid MGXXXXXXXX
```

```bash
CONTENT_VARIABLES_OBJ=$(cat << EOF
{
  "1": "Name"
}
EOF
)
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
--data-urlencode "ContentSid=HXXXXXXXXX" \
--data-urlencode "To=whatsapp:+18551234567" \
--data-urlencode "From=whatsapp:+15551234567" \
--data-urlencode "ContentVariables=$CONTENT_VARIABLES_OBJ" \
--data-urlencode "MessagingServiceSid=MGXXXXXXXX" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACXXXXXXXXX",
  "api_version": "2010-04-01",
  "body": "Hello! 👍",
  "date_created": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_sent": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_updated": "Thu, 24 Aug 2023 05:01:45 +0000",
  "direction": "outbound-api",
  "error_code": null,
  "error_message": null,
  "from": "whatsapp:+15551234567",
  "num_media": "0",
  "num_segments": "1",
  "price": null,
  "price_unit": null,
  "messaging_service_sid": "MGXXXXXXXX",
  "sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "queued",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json"
  },
  "to": "whatsapp:+18551234567",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

## Receiving Quick replies

When end-users tap on one of your Quick replies, this automatically triggers a message that is sent to your business with the button text. If you have a webhook configured for incoming messages to the WhatsApp sender that the Quick reply was sent to, then you can get the text of the button tapped in the `ButtonText` parameter from the callback. Additionally you can set and get the unique identifier for each quick reply button using the id field. For more information, see [Twilio's Webhook Requests](/docs/messaging/guides/webhook-request#whatsapp-specific-parameters).

## Additional information

* Message templates with buttons incur standard [template charges](https://developers.facebook.com/docs/whatsapp/pricing/) wherever applicable.
* The Conversations API, Flex, and Studio support buttons.

  * To include a button in all cases except WhatsApp, send a message using the Content SID.
  * To include a buttons made with a WhatsApp Template, send a message with a text body that matches the corresponding template with buttons.

=============

# Using WhatsApp with Conversations

WhatsApp is increasingly the world's #1 conversational messaging platform as well as an absolutely critical engagement tool across South America, Middle East, Africa and many parts of Europe and Asia. Twilio Conversations supports WhatsApp out of the box and can help you address a number of patterns:

* **Delivery Coordination:** Let your drivers reach out to the customer to make sure the last 100 yards of each delivery are successful.
* **Clienteling:** Allow your employees to have long-term relationships (e.g. personal shoppers, wealth managers, or real estate agents) with your customers without using their personal devices.
* **Masked Communication:** Facilitate communication between your employees and your customers without sharing private numbers.

This guide will show you how to set up a few common patterns that pair WhatsApp with other channels.

## Prerequisites

> \[!NOTE]
>
> WhatsApp onboarding generally takes 1-2 weeks. WhatsApp has a thorough vetting process that requires business verification in the Meta Business Manager in order to protect the WhatsApp ecosystem.
>
> We advise planning accordingly when setting up your WhatsApp Sender for Twilio. For more information, see [Register WhatsApp senders using Self Sign-up](/docs/whatsapp/self-sign-up) or [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program).

WhatsApp is a highly-regulated channel, requiring documentation and approval from Meta to get your business started. See [Register WhatsApp senders using Self Sign-up](/docs/whatsapp/self-sign-up) or [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program).

### Get your WhatsApp templates approved

> \[!NOTE]
>
> The last section of the tutorial uses templates to initiate contact between
> two separate WhatsApp participants. If you follow the steps chronologically,
> you will still be able to complete the tutorial because you will have opted
> into the WhatsApp's 24-hour window. However, the screenshots will looks
> lightly different from what you see in the WhatsApp interface.

Depending on your use-case, you may need to secure some [approved WhatsApp templates](/docs/whatsapp/key-concepts#message-templates). This is specifically required if you want to *send* a message to a new user on WhatsApp, or *send* a message more than 24 hours after the last response.

**Note:** If your use case can function such that you *always receive WhatsApp messages first* from your customers, you can skip the template registration step.

Now, you're ready to go!

## Cross-Channel Masking: Connecting WhatsApp to SMS

SMS is the easiest channel to connect to WhatsApp in a Twilio Conversation. To do this we'll use:

* A Twilio SMS-capable phone number (hereafter "TWI-SMS-NUMBER")
* Your Twilio WhatsApp number (hereafter "TWI-WA-NUMBER")
* The [Twilio CLI](/docs/twilio-cli/quickstart)

We recommend the Twilio CLI for experimenting, but these guides will work in any language in Twilio. Pick your favorite on the right and follow along.

Let's get down to it; our SMS-to-WhatsApp conversation will take four steps to set up.

### Step 1. Create a Conversation

Create a Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversation() {
  const conversation = await client.conversations.v1.conversations.create({
    friendlyName: "SMS-to-WhatsApp Example",
  });

  console.log(conversation.sid);
}

createConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations.create(
    friendly_name="SMS-to-WhatsApp Example"
)

print(conversation.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation =
            await ConversationResource.CreateAsync(friendlyName: "SMS-to-WhatsApp Example");

        Console.WriteLine(conversation.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation = Conversation.creator().setFriendlyName("SMS-to-WhatsApp Example").create();

        System.out.println(conversation.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParams{}
	params.SetFriendlyName("SMS-to-WhatsApp Example")

	resp, err := client.ConversationsV1.CreateConversation(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1->conversations->create([
    "friendlyName" => "SMS-to-WhatsApp Example",
]);

print $conversation->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations
               .create(friendly_name: 'SMS-to-WhatsApp Example')

puts conversation.sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:create \
   --friendly-name "SMS-to-WhatsApp Example"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations" \
--data-urlencode "FriendlyName=SMS-to-WhatsApp Example" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "friendly_name": "SMS-to-WhatsApp Example",
  "unique_name": "unique_name",
  "attributes": "{ \"topic\": \"feedback\" }",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "state": "inactive",
  "timers": {
    "date_inactive": "2015-12-16T22:19:38Z",
    "date_closed": "2015-12-16T22:28:38Z"
  },
  "bindings": {},
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks",
    "export": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Export"
  }
}
```

### Step 2: Create the WhatsApp Participant

Create the WhatsApp Participant

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("CHxxxx")
    .participants.create({
      "messagingBinding.address": "whatsapp:YOUR_WHATSAPP_NUMBER",
      "messagingBinding.proxyAddress": "whatsapp:TWI_WA_NUMBER",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "CHxxxx"
).participants.create(
    messaging_binding_address="whatsapp:YOUR_WHATSAPP_NUMBER",
    messaging_binding_proxy_address="whatsapp:TWI_WA_NUMBER",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "whatsapp:YOUR_WHATSAPP_NUMBER",
            messagingBindingProxyAddress: "whatsapp:TWI_WA_NUMBER",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("CHxxxx")
                                      .setMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
                                      .setMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
	params.SetMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")

	resp, err := client.ConversationsV1.CreateConversationParticipant("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->participants->create([
        "messagingBindingAddress" => "whatsapp:YOUR_WHATSAPP_NUMBER",
        "messagingBindingProxyAddress" => "whatsapp:TWI_WA_NUMBER",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('CHxxxx')
              .participants
              .create(
                messaging_binding_address: 'whatsapp:YOUR_WHATSAPP_NUMBER',
                messaging_binding_proxy_address: 'whatsapp:TWI_WA_NUMBER'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid CHxxxx \
   --messaging-binding.address whatsapp:YOUR_WHATSAPP_NUMBER \
   --messaging-binding.proxy-address whatsapp:TWI_WA_NUMBER
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Participants" \
--data-urlencode "MessagingBinding.Address=whatsapp:YOUR_WHATSAPP_NUMBER" \
--data-urlencode "MessagingBinding.ProxyAddress=whatsapp:TWI_WA_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{ \"role\": \"driver\" }",
  "messaging_binding": {
    "type": "sms",
    "address": "+15558675310",
    "proxy_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 3: Create the SMS Participant

Create the SMS Participant

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("CHxxxx")
    .participants.create({
      "messagingBinding.address": "YOUR_SMS_NUMBER",
      "messagingBinding.proxyAddress": "TWI_SMS_NUMBER",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "CHxxxx"
).participants.create(
    messaging_binding_address="YOUR_SMS_NUMBER",
    messaging_binding_proxy_address="TWI_SMS_NUMBER",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "YOUR_SMS_NUMBER",
            messagingBindingProxyAddress: "TWI_SMS_NUMBER",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("CHxxxx")
                                      .setMessagingBindingAddress("YOUR_SMS_NUMBER")
                                      .setMessagingBindingProxyAddress("TWI_SMS_NUMBER")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("YOUR_SMS_NUMBER")
	params.SetMessagingBindingProxyAddress("TWI_SMS_NUMBER")

	resp, err := client.ConversationsV1.CreateConversationParticipant("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->participants->create([
        "messagingBindingAddress" => "YOUR_SMS_NUMBER",
        "messagingBindingProxyAddress" => "TWI_SMS_NUMBER",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('CHxxxx')
              .participants
              .create(
                messaging_binding_address: 'YOUR_SMS_NUMBER',
                messaging_binding_proxy_address: 'TWI_SMS_NUMBER'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid CHxxxx \
   --messaging-binding.address YOUR_SMS_NUMBER \
   --messaging-binding.proxy-address TWI_SMS_NUMBER
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Participants" \
--data-urlencode "MessagingBinding.Address=YOUR_SMS_NUMBER" \
--data-urlencode "MessagingBinding.ProxyAddress=TWI_SMS_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{ \"role\": \"driver\" }",
  "messaging_binding": {
    "type": "sms",
    "address": "+15558675310",
    "proxy_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 4: Send a message from WhatsApp

Because you've set up this conversation to proxy with SMS, you'll see the messages flowing back and forth automatically between your two channels.

**Note**: The WhatsApp user kicks off this conversation by sending the first message. By starting from an inbound WhatsApp message, we've avoided any need to use WhatsApp Templates to start the Conversation. These messages and media will flow just fine for the next 24 hours.

![Comparison of WhatsApp and SMS messages with identical content and .](https://docs-resources.prod.twilio.com/fa093fc9213816f009c06439e2322c500e25cdddc8e39b875ab3f7b18ccc15d6.png)

## Masked Communication: Connecting Two WhatsApp Participants

When you connect two WhatsApp participants, you'll have to solve two business problems:

1. **Who is speaking with whom?**\
   This is probably the bread-and-butter of your business idea: if you're a two-sided marketplace, you're probably connecting a buyer and a seller (or a passenger and a rider). The buyer is the most critical personality: the brand they see in WhatsApp is important and must establish enough trust to proceed with the conversation. When you create your WhatsApp Business Profile, keep that buyer personality in mind first.
2. **How will you get opt-in from both participants?**\
   Unsolicited outbound messages to WhatsApp are highly restricted. Until your customer replies, you can only send messages conforming to approved templates. In this scenario, both sides are on WhatsApp, so we will need to use one of those templates to get the conversation moving.

We'll start by setting up the Conversation and later show how to use templates to improve the customer experience.

### Setting Up the Conversation

We'll need the following to set up our WhatsApp-to-WhatsApp Conversation:

1. A Twilio WhatsApp number; we'll call this "TWI\_WA\_NUMBER." You could use more than one, but it's not necessary.
2. Two consumer WhatsApp accounts. Choose yourself and a friend who won't mind. These are typically your personal device numbers.
3. [The Twilio CLI](https://twil.io/cli).

> \[!WARNING]
>
> If you're going through this guide in chronological order and re-using your WhatsApp numbers to test out all of the use cases, you should remove the previous Conversation first. Each number pair (twilio+personal) can only appear in one conversation at a time.
>
> ```bash
> twilio api:conversations:v1:conversations:remove --sid CHxxxx
> ```

With that, connecting two WhatsApp participants in a Conversation will take five steps:

Step 1: Create the Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversation() {
  const conversation = await client.conversations.v1.conversations.create();

  console.log(conversation.sid);
}

createConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations.create()

print(conversation.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation = await ConversationResource.CreateAsync();

        Console.WriteLine(conversation.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation = Conversation.creator().create();

        System.out.println(conversation.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParams{}

	resp, err := client.ConversationsV1.CreateConversation(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1->conversations->create();

print $conversation->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations
               .create

puts conversation.sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:create
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "friendly_name": "friendly_name",
  "unique_name": "unique_name",
  "attributes": "{ \"topic\": \"feedback\" }",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "state": "inactive",
  "timers": {
    "date_inactive": "2015-12-16T22:19:38Z",
    "date_closed": "2015-12-16T22:28:38Z"
  },
  "bindings": {},
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks",
    "export": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Export"
  }
}
```

Steps 2 and 3: Add two different WhatsApp Participants

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("CHxxxx")
    .participants.create({
      "messagingBinding.address": "whatsapp:YOUR_WHATSAPP_NUMBER",
      "messagingBinding.proxyAddress": "whatsapp:TWI_WA_NUMBER",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "CHxxxx"
).participants.create(
    messaging_binding_address="whatsapp:YOUR_WHATSAPP_NUMBER",
    messaging_binding_proxy_address="whatsapp:TWI_WA_NUMBER",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "whatsapp:YOUR_WHATSAPP_NUMBER",
            messagingBindingProxyAddress: "whatsapp:TWI_WA_NUMBER",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("CHxxxx")
                                      .setMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
                                      .setMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
	params.SetMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")

	resp, err := client.ConversationsV1.CreateConversationParticipant("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->participants->create([
        "messagingBindingAddress" => "whatsapp:YOUR_WHATSAPP_NUMBER",
        "messagingBindingProxyAddress" => "whatsapp:TWI_WA_NUMBER",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('CHxxxx')
              .participants
              .create(
                messaging_binding_address: 'whatsapp:YOUR_WHATSAPP_NUMBER',
                messaging_binding_proxy_address: 'whatsapp:TWI_WA_NUMBER'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid CHxxxx \
   --messaging-binding.address whatsapp:YOUR_WHATSAPP_NUMBER \
   --messaging-binding.proxy-address whatsapp:TWI_WA_NUMBER
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Participants" \
--data-urlencode "MessagingBinding.Address=whatsapp:YOUR_WHATSAPP_NUMBER" \
--data-urlencode "MessagingBinding.ProxyAddress=whatsapp:TWI_WA_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{ \"role\": \"driver\" }",
  "messaging_binding": {
    "type": "sms",
    "address": "+15558675310",
    "proxy_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

#### Step 4: Send a message from one side

From your phone, send the first message in WhatsApp. Send the message to your TWI\_WA\_NUMBER (not directly to your friend's number.)

#### Step 5: Send a message from the other side

Have your good-natured friend send a message to your TWI\_WA\_NUMBER (not directly to your phone number).

![WhatsApp chat showing late opt-in for courier communication.](https://docs-resources.prod.twilio.com/7ae51b88203d52a2c108f6d0c843cc15a4063ee6e2b7c73f3203b9a3e31e6b4e.png)

Congratulations, it's working!

… Mostly. You may notice that after steps four and five, you have two *different* conversations ongoing. After this awkward introduction, everything proceeds as expected, but that's not the professional experience we want.

In this scenario, both WhatsApp-based parties must reply before the Twilio can send outbound messages to both parties. Receiving an incoming message from both Conversation participants kicks off the "24-hour session" in which Twilio can send outbound free-form WhatsApp messages.

### Starting More Professionally: Using Template Messages

> \[!WARNING]
>
> WhatsApp templates need to be submitted and approved before they are effective. Before you proceed to below, learn how to [create WhatsApp templates and submit them for approval.](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates#creating-message-templates-and-submitting-them-for-approval) Once your templates are approved, use the appropriate body text in the steps below.
>
> **Note**: Without approved WhatsApp templates, these outbound messages will be swallowed by the system.
>
> If you have followed the tutorial chronologically, you can complete the tutorial because you and your good-natured friend have opted into receiving WhatsApp messages for 24 hours. However, the screenshots will differ from what you see in the WhatsApp interface.

Let's carry the example above a little further, and use approved [WhatsApp Template Messages](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates) to make it happen. We're going to pick two template messages that we've already gotten approved:

* A templated message that our food courier will understand
* A templated message that will invite the customer to opt into the contact.

```csharp
TEMPLATE 1:
Hello {{1}}, your food delivery is almost there but {{2}} (your rider) needs help finding your door. Are you willing to chat with them?

TEMPLATE 2:
Your customer has agreed to chat over WhatsApp to get this delivery sorted. You're now connected. Say hello!
```

We'll send these messages one after another, waiting for a response from the first before sending the second.

Using templates to smooth out our customer experience, let's follow two more steps:

Step 6: Invite the Customer to Engage.

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationMessage() {
  const message = await client.conversations.v1
    .conversations("CHxxxx")
    .messages.create({
      author: "whatsapp:COURIER_WA_NUMBER",
      body: "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
    });

  console.log(message.accountSid);
}

createConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.conversations.v1.conversations("CHxxxx").messages.create(
    author="whatsapp:COURIER_WA_NUMBER",
    body="Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
)

print(message.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            author: "whatsapp:COURIER_WA_NUMBER",
            body: "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(message.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message.creator("CHxxxx")
                              .setAuthor("whatsapp:COURIER_WA_NUMBER")
                              .setBody("Hello Robert, your food delivery is almost there but Alicia (your rider) needs "
                                       + "help finding your door. Are you willing to chat with them?")
                              .create();

        System.out.println(message.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationMessageParams{}
	params.SetAuthor("whatsapp:COURIER_WA_NUMBER")
	params.SetBody("Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?")

	resp, err := client.ConversationsV1.CreateConversationMessage("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->messages->create([
        "author" => "whatsapp:COURIER_WA_NUMBER",
        "body" =>
            "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
    ]);

print $message->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('CHxxxx')
          .messages
          .create(
            author: 'whatsapp:COURIER_WA_NUMBER',
            body: 'Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?'
          )

puts message.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:create \
   --conversation-sid CHxxxx \
   --author whatsapp:COURIER_WA_NUMBER \
   --body "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Messages" \
--data-urlencode "Author=whatsapp:COURIER_WA_NUMBER" \
--data-urlencode "Body=Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "body": "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
  "media": null,
  "author": "whatsapp:COURIER_WA_NUMBER",
  "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "attributes": "{ \"importance\": \"high\" }",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

The following is what the customer will see after you send the first templated message as the courier/rider:

![Chat confirming food delivery and connecting customer with rider for assistance.](https://docs-resources.prod.twilio.com/b8c226db096ccf7f3290de93ebf314c40c2babd751df2fd50ad050aaa8f47efd.png)

You'll notice when you do this that the customer receives a message, but the courier does not. We're using the rules of WhatsApp's 24-hour opt-in window in our favor: securing one participant's opt-in (from the customer) before we reach out to the other (the courier).

In the picture above, you notice that we included an automated reply: "Great! Just a moment…" This picture is a step ahead. To actually execute this — and at the same time to opt-in our courier — we're going to need a Twilio function and a Conversations webhook.

#### Create a Twilio Function to send the templates

Let's start with the former.

First, navigate to the [Twilio Functions section of the Console](https://www.twilio.com/console/functions/) and click on "**Configure**." Confirm that the version listed for the [twilio NPM module is up-to-date](https://www.npmjs.com/package/twilio), such as `3.66.1` or higher.

![Twilio Functions environment variables and npm dependencies with Twilio version 3.66.1 highlighted.](https://docs-resources.prod.twilio.com/46c1be173d59523d19a047c5f40dd7cacab36b6ffaddbd4940adae5315f4480c.png)

Next, [create a Twilio Function in the console](https://www.twilio.com/console/functions/manage) with the following code, which will set us up to capture [the onMessageAdded event](/docs/conversations/conversations-webhooks).

```javascript
exports.handler = function (context, event, callback) {
  const customer = event.Author;
  let thisConversation = context
    .getTwilioClient()
    .conversations.v1.conversations.get(event.ConversationSid);

  // This system message will reach the customer, but our rider
  // will still need to be opted-in.
  let justAMoment = thisConversation.messages.create({
    body: "Great! Just a moment while we connect you…",
  });

  // Use Template #2 for the rider.
  let riderOptIn = thisConversation.messages.create({
    author: customer,
    body: "Your customer has agreed to chat over WhatsApp to get this delivery sorted. You're now connected. Say hello!",
  });

  // Remove all scoped webhooks; we only want this once.
  let webhooks = [];
  thisConversation.webhooks.each((hook) => webhooks.push(hook.remove()));

  // Critically important: wait for the messages to resolve.
  Promise.all([justAMoment, riderOptIn, ...webhooks]).finally(() =>
    callback(null)
  );
};
```

To power this, we'll add a [Conversation Scoped webhook](/docs/conversations/api/conversation-scoped-webhook-resource) that we can remove later.

Step 7: Set up a Conversation Scoped Webhook to field the reply.

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationScopedWebhook() {
  const webhook = await client.conversations.v1
    .conversations("CHxxxx")
    .webhooks.create({
      "configuration.filters": ["onMessageAdded"],
      "configuration.method": "get",
      "configuration.url": "http://funny-dunkin-3838.twil.io/customer-optin",
      target: "webhook",
    });

  console.log(webhook.sid);
}

createConversationScopedWebhook();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

webhook = client.conversations.v1.conversations("CHxxxx").webhooks.create(
    target="webhook",
    configuration_url="http://funny-dunkin-3838.twil.io/customer-optin",
    configuration_method="get",
    configuration_filters=["onMessageAdded"],
)

print(webhook.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;
using System.Collections.Generic;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var webhook = await WebhookResource.CreateAsync(
            target: WebhookResource.TargetEnum.Webhook,
            configurationUrl: "http://funny-dunkin-3838.twil.io/customer-optin",
            configurationMethod: WebhookResource.MethodEnum.Get,
            configurationFilters: new List<string> { "onMessageAdded" },
            pathConversationSid: "CHxxxx");

        Console.WriteLine(webhook.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import java.util.Arrays;
import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Webhook;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Webhook webhook = Webhook.creator("CHxxxx", Webhook.Target.WEBHOOK)
                              .setConfigurationUrl("http://funny-dunkin-3838.twil.io/customer-optin")
                              .setConfigurationMethod(Webhook.Method.GET)
                              .setConfigurationFilters(Arrays.asList("onMessageAdded"))
                              .create();

        System.out.println(webhook.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationScopedWebhookParams{}
	params.SetTarget("webhook")
	params.SetConfigurationUrl("http://funny-dunkin-3838.twil.io/customer-optin")
	params.SetConfigurationMethod("get")
	params.SetConfigurationFilters([]string{
		"onMessageAdded",
	})

	resp, err := client.ConversationsV1.CreateConversationScopedWebhook("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$webhook = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->webhooks->create(
        "webhook", // Target
        [
            "configurationUrl" =>
                "http://funny-dunkin-3838.twil.io/customer-optin",
            "configurationMethod" => "get",
            "configurationFilters" => ["onMessageAdded"],
        ]
    );

print $webhook->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

webhook = @client
          .conversations
          .v1
          .conversations('CHxxxx')
          .webhooks
          .create(
            target: 'webhook',
            configuration_url: 'http://funny-dunkin-3838.twil.io/customer-optin',
            configuration_method: 'get',
            configuration_filters: [
              'onMessageAdded'
            ]
          )

puts webhook.sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:webhooks:create \
   --conversation-sid CHxxxx \
   --target webhook \
   --configuration.url http://funny-dunkin-3838.twil.io/customer-optin \
   --configuration.method get \
   --configuration.filters onMessageAdded
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Webhooks" \
--data-urlencode "Target=webhook" \
--data-urlencode "Configuration.Url=http://funny-dunkin-3838.twil.io/customer-optin" \
--data-urlencode "Configuration.Method=get" \
--data-urlencode "Configuration.Filters=onMessageAdded" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "WHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "target": "webhook",
  "configuration": {
    "url": "https://example.com",
    "method": "get",
    "filters": [
      "onMessageSent",
      "onConversationDestroyed"
    ]
  },
  "date_created": "2016-03-24T21:05:50Z",
  "date_updated": "2016-03-24T21:05:50Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks/WHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

Now let's start again by sending the initial opt-in message to test the whole flow.

![WhatsApp chat between customer and rider coordinating delivery location.](https://docs-resources.prod.twilio.com/0e56933ca85f83ccf14d9a3ce8ee78a0da80048dc80da4a1876eb63741b5faf7.png)

With all this setup, we've created the ideal experience for two-sided WhatsApp Conversations. Notice how system messaging manages expectations while we're still opting-in the second party. And after the initial setup, notice that we're not forwarding messages one-by-one among the parties: all of that happens automatically via Twilio Conversations platform. It only ends if/when you `DELETE` the conversation later on.

**Note:** Our templates fit neatly in [WhatsApp's guidelines](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates): they are not promotional, but rather they facilitate an active transaction. By following these patterns, your business could benefit from the same pattern.

## What's Next

Ready to learn more about Conversations and WhatsApp? Learn more with the following resources:

* [Send WhatsApp Notification Messages with Templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates)
* [Register WhatsApp senders using Self Sign-up](/docs/whatsapp/self-sign-up)
* [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program)
* [The Conversations API Reference](/docs/conversations/api)
* [The Conversations Scoped Webhook Resource](/docs/conversations/api/conversation-scoped-webhook-resource)


===============

# States and Timers in Conversations

States and Timers help automatically manage the lifecycle of your application's conversations. They keep your users focused on ongoing *active* conversations, while closing out older *inactive* conversations to make sure you're not exceeding the [Conversations per user limit](/docs/conversations/conversations-limits#maximum-channelsconversations-per-identity) of 1,000.

A conversation's state indicates whether a conversation is active, inactive, or closed. You can use timers to automatically transition conversations across these states. Both `state` and `timers` are properties of the [Conversation Resource](/docs/conversations/api/conversation-resource#conversation-properties).

This guide provides an overview of states and timers and how to configure them.

## Conversation States

A Conversation can be one of four states:

* `active`: The conversation is currently in use. This is the default state for a newly created conversation.
* `inactive`: The conversation is not in use, but you can reactivate it if needed.
* `closed`: The conversation is no longer in use and you can't reactivate it.
* `initializing`: Twilio is setting up the conversation and you can't edit it yet. This state is only used shortly when a conversation is created through the [ConversationsWithParticipants](/docs/conversations/api/conversation-with-participants-resource) resource.

Update a Conversation's state

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function updateConversation() {
  const conversation = await client.conversations.v1
    .conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .update({ state: "inactive" });

  console.log(conversation.accountSid);
}

updateConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations(
    "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
).update(state="inactive")

print(conversation.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation = await ConversationResource.UpdateAsync(
            state: ConversationResource.StateEnum.Inactive,
            pathSid: "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

        Console.WriteLine(conversation.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation =
            Conversation.updater("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX").setState(Conversation.State.INACTIVE).update();

        System.out.println(conversation.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.UpdateConversationParams{}
	params.SetState("inactive")

	resp, err := client.ConversationsV1.UpdateConversation("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1
    ->conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ->update(["state" => "inactive"]);

print $conversation->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations('CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
               .update(state: 'inactive')

puts conversation.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:update \
   --sid CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --state inactive
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
--data-urlencode "State=inactive" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab",
  "friendly_name": "friendly_name",
  "unique_name": "unique_name",
  "attributes": "{ \"topic\": \"feedback\" }",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "state": "inactive",
  "timers": {
    "date_inactive": "2015-12-16T22:19:38Z",
    "date_closed": "2015-12-16T22:28:38Z"
  },
  "bindings": {},
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks",
    "export": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Export"
  }
}
```

### State Transition Table

A conversation can be transitioned between these states by updating the conversation directly, by a configured timer, and automatically by the system. The following table summarizes the possible transitions:

| From State     | To State   | Behavior                                                                                                                                               |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `active`       | `inactive` | Transitioned by timer or API.                                                                                                                          |
| `active`       | `closed`   | Transitioned by timer or API.                                                                                                                          |
| `inactive`     | `active`   | Automatically transitioned when a new message is added to the conversation, or by API.                                                                 |
| `inactive`     | `closed`   | Transitioned by timer or API.                                                                                                                          |
| `closed`       | N/A        | Closed state is final.                                                                                                                                 |
| `initializing` | `active`   | Automatically transitioned when the [ConversationsWithParticipants](/docs/conversations/api/conversation-with-participants-resource) process finishes. |
| `initializing` | `closed`   | Automatically transitioned the if conversation with participants process fails.                                                                        |

### Active and Inactive Conversations

A conversation can be set from active to inactive and vice versa at any time.

As described in the [State Transition Table](#state-transition-table):

* A conversation can only be transitioned to inactive by using a configured timer or by making an API call.
* A conversation is automatically transitioned from inactive to active when a new message is added to the conversation.

> \[!NOTE]
>
> Active and inactive conversations both count towards the [Conversations per User limit](/docs/conversations/conversations-limits#maximum-channelsconversations-per-identity).

### Closed Conversations

Once a conversation closes, it becomes read-only and you can't add new participants or messages to it.
Closing a conversation is permanent, and you can't transition it back to the `active` or `inactive` state.

Closed conversations don't count towards the [Conversations per user limit](/docs/conversations/conversations-limits#maximum-channelsconversations-per-identity).

## Conversations Timers

Timers allow you to set a timeframe of inactivity after which a conversation automatically transitions between states. Timers are optional, but we highly recommend enabling them to manage conversations efficiently and avoid distruptions from the [Conversations per user limit](/docs/conversations/conversations-limits#maximum-channelsconversations-per-identity).

You can set up timers in two ways:

1. **Global Defaults**: Set up default timers for all conversations created in your account. You can set up global defaults from the Conversations Defaults page in the
   Twilio Console.
2. **For Each Conversation**: Set up a timer for a specific Conversation using the REST API.

There are two configurable timers to transition between conversation states:

* **Inactive Timer**: Transitions a conversation from active to inactive. It counts down from when the last message added was in the conversation.
* **Closed Timer**: Transitions a conversation to closed.
  * If it's the only timer, it counts down from when the last message was added in the conversation.
  * If there is also an inactive timer, it counts down from when the conversation becomes inactive.

Timers are set in [ISO 8601 duration](https://en.wikipedia.org/wiki/ISO_8601#Durations) format (`PT10M` for 10 minutes).

> \[!NOTE]
>
> **Note**: When configuring timers, durations must be specified in days or smaller units (hours, minutes, seconds).
> Using months `P6M` or years `P1Y` will result in an invalid format error. For instance, to set a timer for 6 months,
> use `P180D` (assuming an average month has 30 days), and for 1 year, use `P365D`

Configure timers for a Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function updateConversation() {
  const conversation = await client.conversations.v1
    .conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .update({
      "timers.closed": "PT60000S",
      "timers.inactive": "PT5M",
    });

  console.log(conversation.accountSid);
}

updateConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations(
    "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
).update(timers_inactive="PT5M", timers_closed="PT60000S")

print(conversation.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation = await ConversationResource.UpdateAsync(
            timersInactive: "PT5M",
            timersClosed: "PT60000S",
            pathSid: "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

        Console.WriteLine(conversation.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation = Conversation.updater("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
                                        .setTimersInactive("PT5M")
                                        .setTimersClosed("PT60000S")
                                        .update();

        System.out.println(conversation.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.UpdateConversationParams{}
	params.SetTimersInactive("PT5M")
	params.SetTimersClosed("PT60000S")

	resp, err := client.ConversationsV1.UpdateConversation("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1
    ->conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ->update([
        "timersInactive" => "PT5M",
        "timersClosed" => "PT60000S",
    ]);

print $conversation->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations('CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
               .update(
                 timers_inactive: 'PT5M',
                 timers_closed: 'PT60000S'
               )

puts conversation.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:update \
   --sid CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --timers.inactive PT5M \
   --timers.closed PT60000S
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
--data-urlencode "Timers.Inactive=PT5M" \
--data-urlencode "Timers.Closed=PT60000S" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

Once set, the timers property of the Conversation resource displays the date and time when the timer will elapse in [ISO 8601 date and time](https://en.wikipedia.org/wiki/ISO_8601#Durations) in UTC.

```json
"timers": {
    "date_inactive": "2025-04-16T22:19:38Z",
    "date_closed": "2025-04-16TT22:28:38Z"
}
```

When the inactive timer lapses or you manually set the conversation to inactive, the `date_inactive` property stops returning in the Conversation resources. However, the inactive timer configuration is still retained, and the timer resets if you set the conversation back to `active` again. **To disable a timer entirely, set it to `PT0S`.**

Some other things to be aware of when configuring timers:

* Timers have a precision of 1 second.
* The minimum time for the inactive timer is 60 seconds. For a closed timer, the minimum time is 600 seconds (10 minutes).
* If both timers are set, the closed timer will automatically update based on the inactive timer.
* When a conversation is closed, all timers are removed.

### Timer scenarios

| Inactive Timer | Closed Timer    | Behavior                                                                                                                                                     |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| none           | none            | Conversations is `active` until you change it manually.                                                                                                      |
| Set to 1 hour  | Set to 24 hours | The conversation transitions to `inactive` after 1 hour of inactivity. Then, after an additional 24 hours of inactivity, it transitions to `closed`.         |
| 1 hour         | none            | The conversation transitions to `inactive` after 1 hour of inactivity. It stays in that state until a new message is added or you manually change the state. |
| none           | Set to 24 hours | The conversation transitions to `closed` after 24 hours of inactivity.                                                                                       |


==============

# Delivery Receipts in Conversations

With Delivery Receipts in Twilio Conversations, you gain visibility into the messages sent to your Participants in non-Chat channels, specifically SMS and WhatsApp. You can automatically keep track of whether a message in a Conversation has been delivered to a non-Chat Participant.

This guide provides an overview of Delivery Receipts in Conversations as well as how to set them up to keep track of the status of your messages.

## Why use Delivery Receipts in Conversations?

You can use Delivery Receipts to check the Message Status of the Conversations Messages. This information is a quick way to gauge if your messages reach your end users. If the delivery receipt indicates that the message wasn't delivered, you'll know to look into carrier disruptions or issues with mobile connectivity or availability.

Unlike the Message Status of [individual SMS and WhatsApp messages](/docs/messaging/guides/track-outbound-message-status), Delivery Receipts in Conversations correlate the Message Status information with your Conversation SID as well as relevant error code information. Rather than tracking individual messages, you can see both aggregated delivery information as well as the most recent status for messages in a particular Conversation.

## What are the possible message statuses?

Delivery Receipts in Conversations support the following message statuses:

* **sent**: Twilio has sent the message
* **delivered**: Twilio has received confirmation of message delivery from the carrier (and, where available, the destination handset). See below for more information.
* **read**: The user has opened the message on their device, and the *read* status has been reported back to Twilio. This applies only to over-the-top, or OTT, channels, such as WhatsApp.
* **failed**: The message could not be sent.
* **undelivered**: Twilio has received a delivery receipt indicating that the message was not delivered.
* **null:** The message has been created, but it's still within Twilio.

For *failed* and *undelivered* statuses, Twilio provides an [error code](/docs/api/errors) with the reason that the Message was not delivered.

### Delivery Status for SMS Messages in Conversations

**Note**: SMS statuses received via Delivery Receipts are tentative. (Read more on [SMS-specific message statuses](https://help.twilio.com/hc/en-us/articles/360038982313-SMS-messages-show-the-status-Delivered-but-aren-t-showing-up).) For SMS, the last possible status is "delivered," which indicates that the carrier has accepted the SMS message as sent from Twilio. If the carrier has not yet accepted the Message, its status remains "sent."

### Delivery Status for WhatsApp Messages in Conversations

Delivery Receipts for WhatsApp messages are more granular. A "delivered" status indicates that the WhatsApp application has accepted the message. Otherwise, the status remains as "sent," for example if the mobile device is off. WhatsApp messages can also have the "read" status, indicating that the recipient has consumed the message on their device.

## How to get Delivery Receipts information in Conversations

There are two ways that you can consume Delivery Receipts information:

### Use the Conversations REST API to get Delivery Receipts

Delivery Receipts information is available at two levels: a summary with aggregated totals for a given Message and a detailed view, broken down by recipient for a given Message.

#### Get a summary of delivery information from the Conversation Message Resource

The Delivery property of the [Conversations Message resource](/docs/conversations/api/conversation-message-resource) contains an aggregated summary delivery information. This provides a high-level overview of the Message Status information for the Conversation, including count breakdowns by status of the Conversational messages.

Fetch Aggregated Delivery Receipts Information for a Conversation Message

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function fetchConversationMessage() {
  const message = await client.conversations.v1
    .conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .messages("IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .fetch();

  console.log(message.delivery);
}

fetchConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = (
    client.conversations.v1.conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .messages("IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .fetch()
)

print(message.delivery)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.FetchAsync(
            pathConversationSid: "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            pathSid: "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

        Console.WriteLine(message.Delivery);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message =
            Message.fetcher("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").fetch();

        System.out.println(message.getDelivery());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	resp, err := client.ConversationsV1.FetchConversationMessage("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		"IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Delivery != nil {
			fmt.Println(*resp.Delivery)
		} else {
			fmt.Println(resp.Delivery)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ->messages("IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ->fetch();

print $message->delivery;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
          .messages('IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
          .fetch

puts message.delivery
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:fetch \
   --conversation-sid CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --sid IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

```bash
curl -X GET "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "body": "Welcome!",
  "media": null,
  "author": "system",
  "participant_sid": null,
  "attributes": "{ \"importance\": \"high\" }",
  "date_created": "2016-03-24T20:37:57Z",
  "date_updated": "2016-03-24T20:37:57Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

For example, imagine the following sample `delivery` object returned as part of a fetched Message:

```bash
"delivery": {
    "total": 5,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
}
```

This information indicates that of the five delivery receipts for a given message, the message was *sent* to all of the Participants. Some messages are *delivered*, indicating that Twilio has received delivery confirmation from a carrier. The *some* next to *read* indicates that some of the messages--those sent over an OTT channel--have been opened or read by the Participants. No messages have the *failed* or *undelivered* status.

For a more granular view of message delivery status, you can make a request to the Receipts resource, described below.

#### Get detailed information from the Receipts Resource

A request to the [Delivery Receipt resource](/docs/conversations/delivery-receipts) returns individual statuses for each Message, by each recipient. This is a more detailed view of Message Status information; it includes Channel SIDs for the Conversation Participants.

Retrieve detailed Delivery Receipt Information for a Conversation Message

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function listConversationMessageReceipt() {
  const deliveryReceipts = await client.conversations.v1
    .conversations("ConversationSid")
    .messages("IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .deliveryReceipts.list({ limit: 20 });

  deliveryReceipts.forEach((d) => console.log(d.accountSid));
}

listConversationMessageReceipt();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

delivery_receipts = (
    client.conversations.v1.conversations("ConversationSid")
    .messages("IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .delivery_receipts.list(limit=20)
)

for record in delivery_receipts:
    print(record.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation.Message;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var deliveryReceipts = await DeliveryReceiptResource.ReadAsync(
            pathConversationSid: "ConversationSid",
            pathMessageSid: "IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            limit: 20);

        foreach (var record in deliveryReceipts) {
            Console.WriteLine(record.AccountSid);
        }
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.message.DeliveryReceipt;
import com.twilio.base.ResourceSet;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        ResourceSet<DeliveryReceipt> deliveryReceipts =
            DeliveryReceipt.reader("ConversationSid", "IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX").limit(20).read();

        for (DeliveryReceipt record : deliveryReceipts) {
            System.out.println(record.getAccountSid());
        }
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.ListConversationMessageReceiptParams{}
	params.SetLimit(20)

	resp, err := client.ConversationsV1.ListConversationMessageReceipt("ConversationSid",
		"IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		for record := range resp {
			if resp[record].AccountSid != nil {
				fmt.Println(*resp[record].AccountSid)
			} else {
				fmt.Println(resp[record].AccountSid)
			}
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$deliveryReceipts = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->messages("IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ->deliveryReceipts->read(20);

foreach ($deliveryReceipts as $record) {
    print $record->accountSid;
}
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

delivery_receipts = @client
                    .conversations
                    .v1
                    .conversations('ConversationSid')
                    .messages('IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
                    .delivery_receipts
                    .list(limit: 20)

delivery_receipts.each do |record|
   puts record.account_sid
end
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:receipts:list \
   --conversation-sid ConversationSid \
   --message-sid IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

```bash
curl -X GET "https://conversations.twilio.com/v1/Conversations/ConversationSid/Messages/IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Receipts?PageSize=20" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "meta": {
    "page": 0,
    "page_size": 50,
    "first_page_url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts?PageSize=50&Page=0",
    "previous_page_url": null,
    "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts?PageSize=50&Page=0",
    "next_page_url": null,
    "key": "delivery_receipts"
  },
  "delivery_receipts": [
    {
      "sid": "DYaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "conversation_sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "message_sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "channel_message_sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "status": "failed",
      "error_code": 3000,
      "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "date_created": "2016-03-24T20:37:57Z",
      "date_updated": "2016-03-24T20:37:57Z",
      "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts/DYaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "sid": "DYaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "conversation_sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "message_sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "channel_message_sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "status": "failed",
      "error_code": 3000,
      "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "date_created": "2016-03-24T20:37:57Z",
      "date_updated": "2016-03-24T20:37:57Z",
      "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts/DYaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    {
      "sid": "DYaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "conversation_sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "message_sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "channel_message_sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "status": "failed",
      "error_code": 3000,
      "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "date_created": "2016-03-24T20:37:57Z",
      "date_updated": "2016-03-24T20:37:57Z",
      "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts/DYaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  ]
}
```

In the response, `delivery_receipts` is a list of individual statuses for each Message that was sent to an individual recipient or Participant in the Conversation.

For example, if a Chat user is corresponding with one SMS Participant and one WhatsApp Participant, `delivery_receipts` will contain two different objects, one for each Message sent to a specific Participant:

```bash
{
   "delivery_receipts" : [
         {
            "sid": "DYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "message_sid": "IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "channel_message_sid": "SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "participant_sid": "MBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "status": "sent",
            "error_code": null,
            "date_created": "2020-03-23T18:45:17Z",
            "date_updated": "2020-03-23T18:45:17Z"
         },
         {
            "sid": "DYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "message_sid": "IMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "channel_message_sid": "WAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "participant_sid": "MBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "status": "read",
            "error_code": null,
            "date_created": "2020-03-23T19:45:17Z",
            "date_updated": "2020-03-23T18:45:17Z"
         }
     ]
}

```

In the sample output, we see that for the Message for the SMS Participant (the SMXXX Channel SID), the most recent status is *sent*, meaning that Twilio has passed the message on to the appropriate carrier. However, for the WhatsApp Participant, the most recent status is *read*, indicating that the Participant has consumed the message in their WhatsApp application.

> \[!NOTE]
>
> The information returned from the Delivery Receipt resource does *not* include historic data; the most recent status information overrides the previous status. For example, if a WhatsApp Message has been sent, delivered, and read, a request to this resource will display only the "read" status for that specific message. Likewise, the "undelivered" status of a message overrides the previous "sent" status once the message delivery fails.
>
> To see the dates for *all* status events (i.e., the changes between sent, delivered, and read statuses), you must set up Webhooks, which we'll cover in the next section.

## What is a Webhook?

Webhooks are user-defined [HTTP](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol) callbacks. Some event, such as receiving an SMS message or an incoming phone call, triggers them. When that event occurs, Twilio makes an HTTP request (usually a [`POST` or a `GET`](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods)) to the URL configured for the webhook.

To handle a webhook, you only need to build a small web application that can accept the HTTP requests. Most server-side programming languages offer some framework for you to do this. Examples across languages include [ASP.NET MVC](https://www.asp.net/) for C#, [Servlets](https://en.wikipedia.org/wiki/Java_servlet) and [Spark](https://github.com/perwendel/spark) for Java, [Express](https://expressjs.com/) for Node.js, [Django](https://www.djangoproject.com/) and [Flask](http://flask.pocoo.org/) for Python, and [Rails](https://rubyonrails.org/) and [Sinatra](http://www.sinatrarb.com/) for Ruby. [PHP](https://secure.php.net/) has its own web app framework built in, although frameworks like [Laravel](https://laravel.com/), [Symfony](https://symfony.com/) and [Yii](https://www.yiiframework.com/) are also popular.

Whichever framework and language you choose, webhooks function the same for every Twilio application. They will make an HTTP request to a URI that you provide to Twilio. Your application performs whatever logic you feel necessary - read/write from a database, integrate with another API or perform some computation - then replies to Twilio with a TwiML response with the instructions you want Twilio to perform.

### Set up Webhooks for Delivery Receipts

As mentioned above, the information retrieved via the REST API and the *Delivery Receipt* Resource displays the last or most recent update for a given Message. However, what if you want automatic updates on a message's status, as it passes through Twilio's systems and onto the carrier or OTT application? For this, you'll set up your webhook URL.

Each Delivery Receipt event that you receive on your webhook URL represents a status change for a given message.

A new post-webhook event called *onDeliveryUpdated* is executed for every delivery receipt notification received by Twilio. For every delivery receipt event, Twilio will send a request to your post-event URL that you have configured for Conversations. (Read more about using [Webhooks in Conversations](/docs/conversations/conversations-webhooks).)

Twilio sends the same information found in the *Receipt* resource to your post-event URL for every *onDeliveryUpdated* event.

You can turn on webhooks and configure the post-event URL for Delivery Receipts using the Conversations REST API:

Update the onDeliveryUpdated Webhook URL

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/Webhooks" \
--data-urlencode "PostWebhookUrl=https://www.example.com/postWebhook" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "pre_webhook_url": "https://example.com/pre",
  "post_webhook_url": "https://www.example.com/postWebhook",
  "method": "GET",
  "filters": [
    "onConversationUpdated"
  ],
  "target": "webhook",
  "url": "https://conversations.twilio.com/v1/Conversations/Webhooks"
}
```

You can also configure the *onDeliveryUpdated* webhook through the [Twilio Console](https://twilio.com/console) in the **Conversations** section. (Read more about [Conversations Webhooks and how to configure them](/docs/conversations/conversations-webhooks).)

## Use case examples for Delivery Receipts

Delivery Receipts in Conversations provide visibility into the statuses of messages sent across different channels. Let's look at two common use cases for Delivery Receipts.

### Example 1: An Agent on Chat and an SMS or WhatsApp End User

The primary use case for Delivery Receipts involves an agent on a Chat interface sending messages to an SMS or WhatsApp end user. In this case, the agent on Chat wants to know if their message has been received by the SMS user or read by the WhatsApp (OTT) user.

First, use the aggregated status on the Message resource to get a quick overview of the situation. This aggregated view is often sufficient to see that all of the messages have the *delivered* status. Twilio works with carriers to ensure a high rate of message deliverability, so you can use `delivered: "all"` as a quick indicator that the messages are reaching your end users successfully.

If necessary, you can take a deeper dive into the Message status for a specific Participant in the Conversation. An example of this would be the aggregated `delivery` object indicating that only *some* or *none* of the messages were delivered.

In this case, you can utilize Webhooks or the *Receipts* resource to examine individual message statuses. Make a request to the [Receipts resource](/docs/conversations/delivery-receipts) to find the SIDs and error codes for specific Messages that have *undelivered* or *failed* statuses.

### Example 2: Tracking non-Chat Message Statuses

It is also possible to track the status of any message sent between non-Chat Participants in a Conversation. In other words, you can use Delivery Receipts to answer the question "Where is the message between two SMS Participants in my Conversation?"

For example, imagine a Conversation between an Agent on Chat and two SMS Participants (end users). You can verify that a message sent from one SMS end user reached the other. These details are available through Webhooks (as a *onDeliveryUpdated* event) or via the Conversations REST API.

## Limitations for Delivery Receipts in Conversations

### No Delivery Receipts for Messages originating from Chat Participants

When a Message is delivered to another Chat Participant, it does not emit any Delivery Receipt information. Therefore, Delivery Receipts information is only available for messages sent to non-Chat (SMS or WhatsApp) Participants.

> \[!NOTE]
>
> Because messages sent to Chat Participants do *not* emit delivery information, the default status for these Messages is always *delivered*. Thus, messages to Chat Participants do *not* affect the `all` value in the aggregated `deliveries` property of a Message Resource.
>
> Messages sent to Chat Participants *do not* appear in the `delivery_receipts` sub-resource.

### Statuses for SMS Messages are tentative

SMS delivery statuses have limited reliability, and Twilio cannot guarantee against last-leg disruptions from the carrier. This is the same reliability as seen in [SMS status callbacks](/docs/messaging/guides/track-outbound-message-status). In most cases, these statuses are accurate.

In addition, SMS statuses in Delivery Receipts do not reveal whether the end user's mobile handset is turned on or off. If the end user's mobile device is switched off, the status of this SMS message is *delivered*.

Barring any carrier disruptions, the message will be delivered when the end user's handset is switched on and can once again receive messages. For example, a handset would be able to receive messages again upon re-entering a coverage area or turning off Airplane Mode.

## What's Next?

In this guide, we covered using Delivery Receipts to check the status of messages in Conversations.

Check out the following resources to continue building rich conversational experiences for your customers:

* [The Conversations Quickstart](/docs/conversations/quickstart)
* [Setting up Webhooks in Conversations](/docs/conversations/conversations-webhooks)
* [Configuring WhatsApp and Conversations](/docs/conversations/using-whatsapp-conversations)
* [Message Statuses for SMS Messages](/docs/messaging/guides/track-outbound-message-status)


=============

# Group Texting in Conversations

Using Twilio Conversations, you can build rich conversations between more than two parties over multiple channels, such as SMS and Chat.

In high-value interactions, such as buying a house, financial advising, and coordinating deliveries, customers expect communication involving a group of participants to be seamless. Good news! Twilio Conversations natively supports Group MMS for you to build these experiences for your end-users.

In this guide, we'll walk you through creating a Conversation that supports group texting.

## What is Group Texting?

Group texting, or more specifically Group MMS, uses the [MMS (Multimedia Messaging Service)](/docs/glossary/what-is-mms) protocol to exchange ordinary text messages among a group of three or more people, rather than as a one-to-one interaction.

In a Twilio-powered group texting Conversation, all of the Participants are visible, and each Participant can see the author of each message. In other words, each message can be displayed with the person who sent it to the group text. This is the type of functionality that many users already expect from applications such as WhatsApp, Slack, and iMessage.

Even if you have Participants joining across different channels, Twilio Conversations does all of the message routing and media handling.

## Leveraging Group MMS in Conversations for group texting

If you're operating in the US or Canada (Group MMS only works on `+1` numbers), you can send messages from a projected address to create group texts. This number becomes that Participant's address — the *projection* of that Participant — into a group MMS Conversation.

You can have the following types of Participants in a group text:

* A Participant joining from their native texting experience with a messaging address (their personal mobile number).
* A Chat participant, who has a Chat Identity (like a username) and a projected address (Twilio phone number).
* An unattached Projected Address (Twilio phone number) with no backing Chat Identity. In this case, the projected address acts like a "gateway" number for a customer to participate in the group text.

> \[!WARNING]
>
> Group Texting is **only** supported on +1 (US+Canada) **long code numbers.** Toll-free numbers and short codes cannot exchange group texts from Twilio.

> \[!NOTE]
>
> There is a limit of 10 total Participants in a Group MMS Conversation.

## Projected Addresses vs. Proxy Addresses

If you have built a one-to-one Conversation (like in our [Conversations Quickstart](/docs/conversations/quickstart)), you are probably familiar with the term *proxy address*: the Twilio phone number that routes all of the messages to the native SMS conversation. The proxy address "sticks" to the mobile-based participant on SMS. You can think of it as their window into the Conversation, which may include another SMS or Chat participant. Notably, the SMS participant receives *all* of the messages through one proxy address number and doesn't know how many people it represents.

To set up Group texting with Conversations, you should instead use a *projected address* to represent every Participant who does not join the Conversation through a native channel such as SMS. You can think of the projected address as the "avatar" of a Chat participant in the MMS conversation. The projected address "sticks" to the Chat participant, so in the group text, every Participant can see who said what by way of the attached phone number. The projected address, often used to represent an employee or company representative, is the number that you might put on your business card, for example.

For example, in the following screenshot, you can see the interaction of three unique Participants:

* The first SMS Participant(1), interacting through the native SMS app on their mobile device.
* The Projected Address(1), representing a Chat participant.
* The second SMS Participant(2), represents a different SMS participant and interacts through the native SMS app on their mobile device.

  ![Conversation between 1 Chat Participant with projected address and two SMS Participants joining with their mobile number.](https://docs-resources.prod.twilio.com/af469afd77ed358e70e5906c11cb29f3e0a60fdde99456e0e85c69e6e3648339.png)

### Sharing a Projected Address in group texts

You can share one Projected Address between multiple participants in the group text Conversation and update the backing identity as necessary. This functionality supports use cases such as transferring between support agents representing a business in a group text.

For example, let's say you need to create a group text with one Projected Address that will represent your business, staffed by multiple agents on Chat. In this case, you add a standalone Projected Address as a Participant and update it with the identity of the first agent. Later, when that agent escalates the issue to their supervisor, you update the Projected Address to the supervisor's Chat identity. From the end-user's viewpoint, they are still communicating with the same phone number (Projected Address) that represents your business.

### Using standalone Projected Addresses in group texts

A Projected Address that has no backing Chat identity can still be part of your Conversation.

You can use a standalone Projected Address if you want to send and receive messages in the group text Conversation only through the [Twilio Conversations REST API](/docs/conversations/api). In this case, when you [send messages using the REST API](/docs/conversations/api/conversation-message-resource), you'll need to specify the projected address itself as the `author` parameter.

## Conversation autocreation with Group Texting

The Conversations API automatically creates a new [Conversation](/docs/conversations/api/conversation-resource) when a group message reaches a projected address *and* there is no existing Conversation with the same group of Participants.

Please see our guide to [inbound messaging handling and autocreation in Conversations](/docs/conversations/inbound-autocreation) for more details.

For example, a real estate agent and prospective homebuyer are chatting one-on-one about prospective homes. The homebuyer, wanting to include their partner in the discussion, sends a message to their partner's mobile number as well as the real estate agent, whose avatar in the Conversation is a projected address/Twilio number. No Conversation yet exists between these three numbers, so this creates a new Conversation with all three numbers as separate Participants. In this newly created Conversation, all members see the original message from the homebuyer to the second homebuyer and the real estate agent as the first message.

## Walkthrough of two Group Texting examples

Now that we've covered the concepts of group texting, let's take a look at how we'd set it up for two common scenarios.

> \[!NOTE]
>
> Twilio Conversations is built on top of several Twilio products. It may be useful to pull up a document or sticky note to keep track of the various values that you'll need throughout this documentation. For the examples requiring two SMS Participants, we recommend keeping a friend (or just their phone) handy for testing.

### Get started: Acquire an MMS-capable Twilio Phone Number

If you haven't already done so, you'll want to purchase a Twilio Phone Number to complete the rest of this guide. If you have a Twilio Phone Number already, you can skip to the next section.

[In the Twilio console](https://www.twilio.com/console/phone-numbers/search), search for and purchase an available phone number capable of sending MMS. This Phone Number will serve as the *projected address* for the Chat participant.

![buy-number-mms-capability.](https://docs-resources.prod.twilio.com/b853ce2a718581c39b25c4f656903891f037f5d833ff1de200afeee9f6d80390.png)

## Scenario 1: Set up a group message with one Chat participant and two SMS participants

This is a common scenario in real estate, where the purchase of a single-family home is often a family decision. We will set up group texting for three Participants:

* The real estate agent, chatting from within a dedicated real estate customer relations management application.
* Homebuyer 1, over SMS.
* Homebuyer 2, over SMS.

To do this, you'll need a Twilio Phone Number and you'll need access to the REST API. We have included code samples in supported programming languages, as well as *curl* and the [Twilio CLI](/docs/twilio-cli), which makes experimenting a snap.

### Step 1: Create the Conversation

First, we need to create the Conversation by making a request to the Twilio REST API.

Create a Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversation() {
  const conversation = await client.conversations.v1.conversations.create({
    friendlyName: "Home-buying journey",
  });

  console.log(conversation.accountSid);
}

createConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations.create(
    friendly_name="Home-buying journey"
)

print(conversation.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation =
            await ConversationResource.CreateAsync(friendlyName: "Home-buying journey");

        Console.WriteLine(conversation.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation = Conversation.creator().setFriendlyName("Home-buying journey").create();

        System.out.println(conversation.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParams{}
	params.SetFriendlyName("Home-buying journey")

	resp, err := client.ConversationsV1.CreateConversation(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1->conversations->create([
    "friendlyName" => "Home-buying journey",
]);

print $conversation->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations
               .create(friendly_name: 'Home-buying journey')

puts conversation.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:create \
   --friendly-name "Home-buying journey"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations" \
--data-urlencode "FriendlyName=Home-buying journey" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "friendly_name": "Home-buying journey",
  "unique_name": null,
  "attributes": "{}",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "state": "active",
  "timers": {},
  "bindings": {},
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks",
    "export": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Export"
  }
}
```

### Step 2: Add the real estate agent

Now that we have the Conversation, we can add the real estate agent as a Participant. In this guide, we are representing the Chat Participant's messages with the Conversations REST API to get up and running. At the end of this guide, we'll provide links to documentation to get you started on building a custom CRM.

Add a Chat Participant (Real Estate Agent)

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("ConversationSid")
    .participants.create({
      identity: "realEstateAgent",
      "messagingBinding.projectedAddress": "+15017122661",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "ConversationSid"
).participants.create(
    identity="realEstateAgent",
    messaging_binding_projected_address="+15017122661",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            identity: "realEstateAgent",
            messagingBindingProjectedAddress: "+15017122661",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("ConversationSid")
                                      .setIdentity("realEstateAgent")
                                      .setMessagingBindingProjectedAddress("+15017122661")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetIdentity("realEstateAgent")
	params.SetMessagingBindingProjectedAddress("+15017122661")

	resp, err := client.ConversationsV1.CreateConversationParticipant("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->participants->create([
        "identity" => "realEstateAgent",
        "messagingBindingProjectedAddress" => "+15017122661",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('ConversationSid')
              .participants
              .create(
                identity: 'realEstateAgent',
                messaging_binding_projected_address: '+15017122661'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid ConversationSid \
   --identity realEstateAgent \
   --messaging-binding.projected-address +15017122661
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Participants" \
--data-urlencode "Identity=realEstateAgent" \
--data-urlencode "MessagingBinding.ProjectedAddress=+15017122661" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": "realEstateAgent",
  "attributes": "{}",
  "messaging_binding": {
    "type": "sms",
    "projected_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 3: Add the first homebuyer

The Chat participant (the real estate agent) has been added to the Conversation, but it's pretty lonely in there with no clients. Next, we need to add the first homebuyer, who joins via the native texting (SMS) app on their phone.

> \[!NOTE]
>
> You only have to specify the SMS participant's own personal phone number in `MessagingBinding.Address`. When using group texting, you won't need to specify proxy addresses.

Add an SMS participant (Homebuyer 1)

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("ConversationSid")
    .participants.create({ "messagingBinding.address": "+15558675310" });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "ConversationSid"
).participants.create(messaging_binding_address="+15558675310")

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "+15558675310", pathConversationSid: "ConversationSid");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant =
            Participant.creator("ConversationSid").setMessagingBindingAddress("+15558675310").create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("+15558675310")

	resp, err := client.ConversationsV1.CreateConversationParticipant("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->participants->create(["messagingBindingAddress" => "+15558675310"]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('ConversationSid')
              .participants
              .create(messaging_binding_address: '+15558675310')

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid ConversationSid \
   --messaging-binding.address +15558675310
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Participants" \
--data-urlencode "MessagingBinding.Address=+15558675310" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{}",
  "messaging_binding": {
    "type": "sms",
    "address": "+15017122661"
  },
  "role_sid": null,
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 4: Send a 1:1 message

Before our third Participant joins, we can start by sending messages between the two connected Participants. Let's send a message from the agent to the homebuyer using the REST API.

Send a Conversational Message

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationMessage() {
  const message = await client.conversations.v1
    .conversations("ConversationSid")
    .messages.create({
      author: "realEstateAgent",
      body: "Hi there. What did you think of the listing I sent?",
    });

  console.log(message.accountSid);
}

createConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.conversations.v1.conversations(
    "ConversationSid"
).messages.create(
    body="Hi there. What did you think of the listing I sent?",
    author="realEstateAgent",
)

print(message.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            body: "Hi there. What did you think of the listing I sent?",
            author: "realEstateAgent",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(message.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message.creator("ConversationSid")
                              .setBody("Hi there. What did you think of the listing I sent?")
                              .setAuthor("realEstateAgent")
                              .create();

        System.out.println(message.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationMessageParams{}
	params.SetBody("Hi there. What did you think of the listing I sent?")
	params.SetAuthor("realEstateAgent")

	resp, err := client.ConversationsV1.CreateConversationMessage("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->messages->create([
        "body" => "Hi there. What did you think of the listing I sent?",
        "author" => "realEstateAgent",
    ]);

print $message->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('ConversationSid')
          .messages
          .create(
            body: 'Hi there. What did you think of the listing I sent?',
            author: 'realEstateAgent'
          )

puts message.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:create \
   --conversation-sid ConversationSid \
   --body "Hi there. What did you think of the listing I sent?" \
   --author realEstateAgent
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Messages" \
--data-urlencode "Body=Hi there. What did you think of the listing I sent?" \
--data-urlencode "Author=realEstateAgent" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "body": "Hi there. What did you think of the listing I sent?",
  "media": null,
  "author": "realEstateAgent",
  "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "attributes": "{}",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

Once the homebuyer receives the message, you'll be able to verify that from the REST API. Using [Conversations Webhooks](/docs/conversations/conversations-webhooks), you can also capture those responses for whatever you need, such as logging or adding helpful chatbots. If you've built an app out of our [Chat SDK](/docs/chat/sdk-download-install), you'll get those messages in real time via Twilio's secure WebSocket gateways.

### Step 5: Add the second homebuyer to the group text

Now it's time to turn this into a true group texting experience by adding the second homebuyer. Just like when we added the first homebuyer to the Conversation, we'll add the second using a REST API call.

Add a second SMS participant to the group text (Homebuyer 2)

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("ConversationSid")
    .participants.create({ "messagingBinding.address": "+15558675310" });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "ConversationSid"
).participants.create(messaging_binding_address="+15558675310")

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "+15558675310", pathConversationSid: "ConversationSid");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant =
            Participant.creator("ConversationSid").setMessagingBindingAddress("+15558675310").create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("+15558675310")

	resp, err := client.ConversationsV1.CreateConversationParticipant("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->participants->create(["messagingBindingAddress" => "+15558675310"]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('ConversationSid')
              .participants
              .create(messaging_binding_address: '+15558675310')

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid ConversationSid \
   --messaging-binding.address +15558675310
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Participants" \
--data-urlencode "MessagingBinding.Address=+15558675310" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{}",
  "messaging_binding": {
    "type": "sms",
    "address": "+15017122661"
  },
  "role_sid": null,
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 6: Send another message

Let's welcome the second homebuyer to the group text with one more message from the real estate agent.

Send a second Conversational Message

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationMessage() {
  const message = await client.conversations.v1
    .conversations("ConversationSid")
    .messages.create({
      author: "realEstateAgent",
      body: "Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well.",
    });

  console.log(message.accountSid);
}

createConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.conversations.v1.conversations(
    "ConversationSid"
).messages.create(
    body="Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well.",
    author="realEstateAgent",
)

print(message.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            body: "Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well.",
            author: "realEstateAgent",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(message.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message.creator("ConversationSid")
                              .setBody("Glad you could join us, homebuyer 2. I really love these granite countertops "
                                       + "and think you will as well.")
                              .setAuthor("realEstateAgent")
                              .create();

        System.out.println(message.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationMessageParams{}
	params.SetBody("Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well.")
	params.SetAuthor("realEstateAgent")

	resp, err := client.ConversationsV1.CreateConversationMessage("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->messages->create([
        "body" =>
            "Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well.",
        "author" => "realEstateAgent",
    ]);

print $message->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('ConversationSid')
          .messages
          .create(
            body: 'Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well.',
            author: 'realEstateAgent'
          )

puts message.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:create \
   --conversation-sid ConversationSid \
   --body "Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well." \
   --author realEstateAgent
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Messages" \
--data-urlencode "Body=Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well." \
--data-urlencode "Author=realEstateAgent" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "body": "Glad you could join us, homebuyer 2. I really love these granite countertops and think you will as well.",
  "media": null,
  "author": "realEstateAgent",
  "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "attributes": "{}",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

Now you can see that all three Participants (the real estate agent and the two homebuyers) are part of the Conversation representing our group text. We've been simulating the Chat participant (the real estate agent) using the REST API. However, notice that you and the second homebuyer (or your friend) can use your native texting application to participate in the Conversation as well. The messages flow freely back and forth:

![conversations\_group\_mms\_real\_estate.](https://docs-resources.prod.twilio.com/4fd1b077ca295c6cd72fb4feee231783464deb8399ffe8c828926a9262c33371.jpg)

## Scenario 2: Set up a group message with two Chat and one SMS participants

In the first scenario, we created a group texting Conversation between one real estate agent on Chat participant and two SMS participants.

The second scenario is more common when you have one end-user and two employees, as you may see in financial consultations. For this example, we'll set up a Conversation for:

* The financial advisor, joining from a dedicated application built with Chat.
* The assistant, also chatting from the same application.
* The end-user/client, connecting to the Conversation via SMS.

Because this group text involves two different Chat Participants—the financial advisor and the assistant—we will need two projected addresses, one for each of them. If you haven't already done so, purchase an additional Twilio phone number to use as the second projected address.

### Use one projected address to transfer between agents

In this scenario, we include one assistant on Chat, who is represented with a Projected Address in the Conversation. If you need to transfer seamlessly, you can update the Projected Address's backing Chat identity to the new assistant. The end-user/client will consistently see the same Projected Address (Twilio Phone Number), even if the assistant on Chat changes behind the scenes.

### Optional: Clean up the first Conversation

If you continue to the second example in this guide, you'll need two Twilio Phone Numbers. To free up the number you've already purchased, we can delete the Conversation from the first example.

Alternatively, you can purchase two new Twilio Phone Numbers to use as projected addresses in this second example.

Delete the Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function deleteConversation() {
  await client.conversations.v1
    .conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .remove();
}

deleteConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

client.conversations.v1.conversations(
    "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
).delete()
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        await ConversationResource.DeleteAsync(pathSid: "CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation.deleter("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX").delete();
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.DeleteConversationParams{}

	err := client.ConversationsV1.DeleteConversation("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$twilio->conversations->v1
    ->conversations("CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ->delete();
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

@client
  .conversations
  .v1
  .conversations('CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
  .delete
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:remove \
   --sid CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

```bash
curl -X DELETE "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

### Step 1: Create the Conversation \[#step-1--create-the-conversation-2]

We'll begin this example by making a request to the Twilio REST API to create a new Conversation for the financial consultation.

Create a Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversation() {
  const conversation = await client.conversations.v1.conversations.create({
    friendlyName: "Your Wealth Management Options",
  });

  console.log(conversation.accountSid);
}

createConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations.create(
    friendly_name="Your Wealth Management Options"
)

print(conversation.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation =
            await ConversationResource.CreateAsync(friendlyName: "Your Wealth Management Options");

        Console.WriteLine(conversation.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation = Conversation.creator().setFriendlyName("Your Wealth Management Options").create();

        System.out.println(conversation.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParams{}
	params.SetFriendlyName("Your Wealth Management Options")

	resp, err := client.ConversationsV1.CreateConversation(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1->conversations->create([
    "friendlyName" => "Your Wealth Management Options",
]);

print $conversation->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations
               .create(friendly_name: 'Your Wealth Management Options')

puts conversation.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:create \
   --friendly-name "Your Wealth Management Options"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations" \
--data-urlencode "FriendlyName=Your Wealth Management Options" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "friendly_name": "Your Wealth Management Options",
  "unique_name": null,
  "attributes": "{}",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "state": "active",
  "timers": {},
  "bindings": {},
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks",
    "export": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Export"
  }
}
```

### Step 2: Add the financial advisor

With the Conversation created, we'll next add the financial advisor. This will be a Chat participant, so we need to assign them a projected address. Use one of your Twilio Phone Numbers for this.

Add a Chat Participant (Financial Advisor)

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("ConversationSid")
    .participants.create({
      identity: "YourFinancialAdvisor",
      "messagingBinding.projectedAddress": "+15017122661",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "ConversationSid"
).participants.create(
    identity="YourFinancialAdvisor",
    messaging_binding_projected_address="+15017122661",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            identity: "YourFinancialAdvisor",
            messagingBindingProjectedAddress: "+15017122661",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("ConversationSid")
                                      .setIdentity("YourFinancialAdvisor")
                                      .setMessagingBindingProjectedAddress("+15017122661")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetIdentity("YourFinancialAdvisor")
	params.SetMessagingBindingProjectedAddress("+15017122661")

	resp, err := client.ConversationsV1.CreateConversationParticipant("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->participants->create([
        "identity" => "YourFinancialAdvisor",
        "messagingBindingProjectedAddress" => "+15017122661",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('ConversationSid')
              .participants
              .create(
                identity: 'YourFinancialAdvisor',
                messaging_binding_projected_address: '+15017122661'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid ConversationSid \
   --identity YourFinancialAdvisor \
   --messaging-binding.projected-address +15017122661
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Participants" \
--data-urlencode "Identity=YourFinancialAdvisor" \
--data-urlencode "MessagingBinding.ProjectedAddress=+15017122661" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": "YourFinancialAdvisor",
  "attributes": "{}",
  "messaging_binding": {
    "type": "sms",
    "projected_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 3: Add the end-user (the advisee) by SMS

In this example, we will be adding the end-user (the client being advised) to the group texting experience by making another REST API call.

Because this Participant is joining via the native SMS experience on their device, we'll use their mobile number as the Messaging Binding Address.

Add an SMS Participant (Advisee)

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("ConversationSid")
    .participants.create({ "messagingBinding.address": "+141586753093" });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "ConversationSid"
).participants.create(messaging_binding_address="+141586753093")

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "+141586753093", pathConversationSid: "ConversationSid");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant =
            Participant.creator("ConversationSid").setMessagingBindingAddress("+141586753093").create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("+141586753093")

	resp, err := client.ConversationsV1.CreateConversationParticipant("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->participants->create(["messagingBindingAddress" => "+141586753093"]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('ConversationSid')
              .participants
              .create(messaging_binding_address: '+141586753093')

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid ConversationSid \
   --messaging-binding.address +141586753093
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Participants" \
--data-urlencode "MessagingBinding.Address=+141586753093" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{}",
  "messaging_binding": {
    "type": "sms",
    "address": "+15017122661"
  },
  "role_sid": null,
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 4: Send a 1:1 message \[#step-4--send-a-1-1-message-2]

Before we add our third Participant to the Conversation, we can make sure the two Participants are connected. We'll use the Conversations REST API to send a message from the Chat-based Financial Advisor to the SMS-based advisee.

Send a Message to the Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationMessage() {
  const message = await client.conversations.v1
    .conversations("ConversationSid")
    .messages.create({
      author: "YourFinancialAdvisor",
      body: "Hello, what questions did you have about your portfolio?",
    });

  console.log(message.accountSid);
}

createConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.conversations.v1.conversations(
    "ConversationSid"
).messages.create(
    body="Hello, what questions did you have about your portfolio?",
    author="YourFinancialAdvisor",
)

print(message.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            body: "Hello, what questions did you have about your portfolio?",
            author: "YourFinancialAdvisor",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(message.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message.creator("ConversationSid")
                              .setBody("Hello, what questions did you have about your portfolio?")
                              .setAuthor("YourFinancialAdvisor")
                              .create();

        System.out.println(message.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationMessageParams{}
	params.SetBody("Hello, what questions did you have about your portfolio?")
	params.SetAuthor("YourFinancialAdvisor")

	resp, err := client.ConversationsV1.CreateConversationMessage("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->messages->create([
        "body" => "Hello, what questions did you have about your portfolio?",
        "author" => "YourFinancialAdvisor",
    ]);

print $message->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('ConversationSid')
          .messages
          .create(
            body: 'Hello, what questions did you have about your portfolio?',
            author: 'YourFinancialAdvisor'
          )

puts message.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:create \
   --conversation-sid ConversationSid \
   --body "Hello, what questions did you have about your portfolio?" \
   --author YourFinancialAdvisor
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Messages" \
--data-urlencode "Body=Hello, what questions did you have about your portfolio?" \
--data-urlencode "Author=YourFinancialAdvisor" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "body": "Hello, what questions did you have about your portfolio?",
  "media": null,
  "author": "YourFinancialAdvisor",
  "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "attributes": "{}",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

### Step 5: Add the assistant to the group text

It's time to add the assistant to the group text as a Chat participant. Recall that every non-SMS participant needs a projected address to join in on the group texting fun.

> \[!NOTE]
>
> In this case, we're adding the projected address with an attached Chat Participant all at once, but you could also create the Conversation with an unattached or "gateway" projected address. When you're reading for the assistant to jump into the group text, you can update the projected address by attaching the assistant's chat identity.

Add a second Chat Participant (Assistant)

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("ConversationSid")
    .participants.create({
      identity: "theAssistant",
      "messagingBinding.projectedAddress": "+15017122661",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "ConversationSid"
).participants.create(
    identity="theAssistant", messaging_binding_projected_address="+15017122661"
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            identity: "theAssistant",
            messagingBindingProjectedAddress: "+15017122661",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("ConversationSid")
                                      .setIdentity("theAssistant")
                                      .setMessagingBindingProjectedAddress("+15017122661")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetIdentity("theAssistant")
	params.SetMessagingBindingProjectedAddress("+15017122661")

	resp, err := client.ConversationsV1.CreateConversationParticipant("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->participants->create([
        "identity" => "theAssistant",
        "messagingBindingProjectedAddress" => "+15017122661",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('ConversationSid')
              .participants
              .create(
                identity: 'theAssistant',
                messaging_binding_projected_address: '+15017122661'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid ConversationSid \
   --identity theAssistant \
   --messaging-binding.projected-address +15017122661
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Participants" \
--data-urlencode "Identity=theAssistant" \
--data-urlencode "MessagingBinding.ProjectedAddress=+15017122661" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": "theAssistant",
  "attributes": "{}",
  "messaging_binding": {
    "type": "sms",
    "projected_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 6: Send a group text message

Now that all of the Participants are in our Conversation, we'll send one more message, this time from the assistant to the rest of the group.

Send another message to the Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationMessage() {
  const message = await client.conversations.v1
    .conversations("ConversationSid")
    .messages.create({
      author: "theAssistant",
      body: "I've just emailed you some documents. Could you please review them?",
    });

  console.log(message.accountSid);
}

createConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.conversations.v1.conversations(
    "ConversationSid"
).messages.create(
    author="theAssistant",
    body="I've just emailed you some documents. Could you please review them?",
)

print(message.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            author: "theAssistant",
            body: "I've just emailed you some documents. Could you please review them?",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(message.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message.creator("ConversationSid")
                              .setAuthor("theAssistant")
                              .setBody("I've just emailed you some documents. Could you please review them?")
                              .create();

        System.out.println(message.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationMessageParams{}
	params.SetAuthor("theAssistant")
	params.SetBody("I've just emailed you some documents. Could you please review them?")

	resp, err := client.ConversationsV1.CreateConversationMessage("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->messages->create([
        "author" => "theAssistant",
        "body" =>
            "I've just emailed you some documents. Could you please review them?",
    ]);

print $message->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('ConversationSid')
          .messages
          .create(
            author: 'theAssistant',
            body: 'I\'ve just emailed you some documents. Could you please review them?'
          )

puts message.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:create \
   --conversation-sid ConversationSid \
   --author theAssistant \
   --body "I've just emailed you some documents. Could you please review them?"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Messages" \
--data-urlencode "Author=theAssistant" \
--data-urlencode "Body=I've just emailed you some documents. Could you please review them?" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "body": "I've just emailed you some documents. Could you please review them?",
  "media": null,
  "author": "theAssistant",
  "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "attributes": "{}",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

At this point, you should have received a message from two separate Twilio phone numbers, each representing a Chat participant in the group text. It may look like a 1:1 Conversation, but when you send messages back and forth, you can see that all parties are uniquely identified.

* Try sending an SMS back from your personal device as the advisee.
* Send another message from the Financial Advisor using the REST API to see all three Participants in the Conversation.

Send one more Conversational Message

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationMessage() {
  const message = await client.conversations.v1
    .conversations("ConversationSid")
    .messages.create({
      author: "YourFinancialAdvisor",
      body: "Excellent. We both look forward to working with you.",
    });

  console.log(message.accountSid);
}

createConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.conversations.v1.conversations(
    "ConversationSid"
).messages.create(
    author="YourFinancialAdvisor",
    body="Excellent. We both look forward to working with you.",
)

print(message.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            author: "YourFinancialAdvisor",
            body: "Excellent. We both look forward to working with you.",
            pathConversationSid: "ConversationSid");

        Console.WriteLine(message.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message.creator("ConversationSid")
                              .setAuthor("YourFinancialAdvisor")
                              .setBody("Excellent. We both look forward to working with you.")
                              .create();

        System.out.println(message.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationMessageParams{}
	params.SetAuthor("YourFinancialAdvisor")
	params.SetBody("Excellent. We both look forward to working with you.")

	resp, err := client.ConversationsV1.CreateConversationMessage("ConversationSid",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("ConversationSid")
    ->messages->create([
        "author" => "YourFinancialAdvisor",
        "body" => "Excellent. We both look forward to working with you.",
    ]);

print $message->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('ConversationSid')
          .messages
          .create(
            author: 'YourFinancialAdvisor',
            body: 'Excellent. We both look forward to working with you.'
          )

puts message.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:create \
   --conversation-sid ConversationSid \
   --author YourFinancialAdvisor \
   --body "Excellent. We both look forward to working with you."
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/ConversationSid/Messages" \
--data-urlencode "Author=YourFinancialAdvisor" \
--data-urlencode "Body=Excellent. We both look forward to working with you." \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "ConversationSid",
  "body": "Excellent. We both look forward to working with you.",
  "media": null,
  "author": "YourFinancialAdvisor",
  "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "attributes": "{}",
  "date_created": "2020-07-01T22:18:37Z",
  "date_updated": "2020-07-01T22:18:37Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

![conversation\_group\_mms\_finance.](https://docs-resources.prod.twilio.com/87fd11375496803cca6ce81a271f7789cf5b34bb5d9b34f6fde6a5713ea22c4b.jpg)

## What next?

Twilio Conversations' native support of group MMS allows you to create rich, multi-channel interactions with your users. In this guide, we walked through creating two different group texting scenarios with different ratios of SMS and Chat participants using the projected address.

Now that you can create group texting experiences for your customers, you can also take advantage of the other features in Twilio Conversations:

* [Review how to create 1-1 interactions with the Conversations Quickstart](/docs/conversations/quickstart).
* [Explore the Chat SDKs for building custom applications](/docs/chat/tutorials).
* [Connect WhatsApp to Conversations](/docs/conversations/using-whatsapp-conversations).
* [Configure Webhooks to monitor and modify Conversations](/docs/conversations/conversations-webhooks).


=============

# Inbound Message Handling & Autocreation

Twilio Conversations is built for two-way messaging, so handling inbound messages is critical for your end-user experience. This guide describes the rules that determine where an inbound message goes, as well as how you can use the [Conversations API](/docs/conversations) to change that outcome.

## Key Principle: the To/From number pair

In all supported messaging channels (SMS, MMS, WhatsApp), a [Participant](/docs/conversations/api/conversation-participant-resource) in a [Conversation](/docs/conversations/api/conversation-resource) is defined by their **number pair**. This is essentially the To/From pair on the [Message](/docs/conversations/api/conversation-message-resource):

* the sender, or **From** number, corresponds to a `MessagingBinding.Address` (a consumer's number)
* the receiver, or **To** number, corresponds to a `ProxyAddress` (a Twilio number)

You can think of a `ProxyAddress` as a Participant's window into a given Conversation, which may include another SMS or chat Participant. The sender sends Messages *from* their mobile number to the Twilio number in order to participate in the Conversation. Notably, the SMS Participant receives *all* of the messages through that one proxy address number, and they don't know how many people it represents.

**Note**: Only one Conversation — that is, one Participant in an Active Conversation — can bind a number pair together. In other words, a Participant's to/from number pair can only be in one active Conversation at the same time.

Because that number pair is unique, it determines the Conversation where an inbound SMS or WhatsApp Message goes. And this constraint applies to the entire pair, meaning:

* The same consumer can be in contact with multiple Twilio numbers (different Participants, and different Conversations). For example, a consumer can be part of different Conversations by binding their personal mobile number to different ProxyAddresses (one ProxyAddress for each Conversation).
* The same Twilio number can be in contact with any number of consumers. For example, a single Twilio Proxy number can represent multiple customer service agents, each chatting with different end users in separate Conversations.

Once a Participant is created, that number-pair is bound together until one of the following happens:

* that Participant is removed,
* the Conversation is deleted, or
* the Conversation [State](/docs/conversations/states-timers) is set to `closed`.

## Conversations vs. Programmable Messaging Inbound

If you're already familiar with [Twilio Programmable Messaging](https://www.twilio.com/en-us/messaging), Conversations also uses [webhooks](/docs/glossary/what-is-a-webhook) to trigger actions. You can use [Conversations webhooks](/docs/conversations/conversations-webhooks) to do things like add chatbots, add automatic replies, and implement spam filtering. However, Conversations has one significant difference: it does **not** send *incoming SMS* webhooks like Programmable Messaging does. Those webhooks fire independently.

There are two things determining how Conversations handles inbound messages. The first is the "to/from number pair" principle described above.

The second key factor is a rule: **If the Message belongs in a Conversation, the Conversation captures it first.**

Specifically, if the number-pair matches a Participant in an active Conversation, that Message is delivered to the Conversation. This triggers Conversations Webhooks and commits that Message to the [Conversation Messages](/docs/conversations/api/conversation-message-resource) list. The message will also appear in the Programmable Messaging logs and will be processed as a normal SMS.

## **Inbound Autocreation**

![Flowchart of Twilio inbound message auto-creation process with decision points for API and messaging service.](https://docs-resources.prod.twilio.com/a99465133338f7503bc85e9a8d33462fbd206396b42c205f4ece169d33d1aae1.png)

*A Console redesign is planned to allow selecting both the Programmable Messaging webhook and the Conversations Autocreation feature as per the flowchart above. Currently, you can select only one or the other.*

If the Message does not belong to a Conversation, one of two things could happen. Either:

1. The ordinary Programmable Messaging webhooks are invoked (with the [Incoming Message Webhook](/docs/usage/webhooks/messaging-webhooks#incoming-message-webhook)) or
2. **Conversation Autocreation is invoked**

For the second option, you can use the [Address Configuration API](/docs/conversations/api/address-configuration-resource) to enable the Conversation Autocreation feature, or you can set the configuration in your Messaging Service. The latter **takes effect for any Message to any numbers in that Messaging Service**. For that reason, there's a separate opt-in switch in the Conversations console that you need to "unlock" first.

If the phone number's own webhook is set, it will always fire regardless of whether the number is tied to any Conversation.

### Settings for enabling Autocreation in Conversations

You can enable Autocreation through either the Address Configuration API or the Twilio Console.

#### Enabling Autocreation through the Address Configuration API

You can now use the [Address Configuration API](/docs/conversations/api/address-configuration-resource) to specify which unique address (i.e. WhatsApp or SMS phone number) should enable the Conversations Autocreation feature upon receiving an inbound message, independent of the usage of the Messaging Service. With this API, you can enable and configure inbound messaging for individual addresses to support your use case.

#### Enabling Autocreation through the Twilio Console

You can also configure Autocreation for your Messaging Service in the Twilio Console so that any Message that does not already belong to a Conversation (as identified by the number-pair) will automatically have one created.

First, in the Messaging Service, the *Handle Inbound Messages with Conversations* option should be toggled to **Unlocked**.

![Messaging Features section with 'Unlocked' toggle for handling inbound messages with Conversations.](https://docs-resources.prod.twilio.com/e24c836e70d3fa7fb631d6c41ff766b1a9aff4ec7b53a7c0ecf8110dc3650872.png)

Second, in the **Integration** Section of Programmable Messaging in the Console, the **Autocreate a Conversation** option should be selected. (You can select **Autocreate a Conversation** only if the **Handle Inbound Messages with Conversations** toggle is set to **Unlocked**.)

![Autocreate a Conversation' selected for handling inbound messages in Messaging Service integration.](https://docs-resources.prod.twilio.com/1972bd7e29e86c1423302dc145d75db454decd864677aed35eed81e2f495abba.png)

Make sure to click **Save** to implement your changes!

> \[!WARNING]
>
> After enabling or disabling Autocreation in the Twilio Console, your changes
> may take up to 60 seconds to take effect. During these 60 seconds, the
> previous setting will be in effect.

### Webhooks on Autocreation

Autocreation creates several resources in rapid succession, all of which produce [webhooks](/docs/conversations/api/webhook-configuration-resource):

* **onConversationAdd** (pre-action webhook) will fire, containing the Message body and the complete number pair. You can either accept this Conversation (triggering the remaining webhooks) or reject this request to prevent Conversation autocreation. If you reject this, the Message will be dropped, as specified for this webhook.

![EventType onConversationAdd with message 'Greetings! This message triggered auto-creation.'.](https://docs-resources.prod.twilio.com/01aebcdb6248e627fcb271e0337e51938fa144402cd0b9bf604d55c03754a4be.png)

If your server code responds with `200 OK`:

* **onConversationAdded** will fire, indicating the successful creation of a new Conversation.
* **onParticipantAdded** will fire, describing the number pair above.
* **onMessageAdded** will fire, describing the Message body.

**Note**: `onParticipantAdd` and `onMessageAdd`*do not fire* during autocreation. The only opportunity to reject this Message is upon the creation of the Conversation itself. In other words, with Autocreation enabled, you can only reject a Conversation Message by stopping the entire creation of the Conversation.

> \[!NOTE]
>
> Webhooks will not fire if you disable them globally or at the service level.
> If a webhook is not firing as expected, check your **Webhook Filtering**
> settings in the Twilio Console at the global level or Conversation Service
> level to make sure that the relevant webhooks are enabled.

#### Example: How Webhooks and Conversation Participants interact

Let's say that you have already purchased a Twilio Phone Number and have set up the incoming SMS URL to point to your web application, as described in [the SMS documentation](/docs/messaging/tutorials/how-to-receive-and-reply). At this point, when you receive incoming SMS Messages on your Twilio Phone Number, Twilio will send a request to the webhook URL that you specified.

Next, suppose you create a [Conversation Participant](/docs/conversations/api/conversation-participant-resource) (with a to/from number pair, as described above) that binds a mobile number A to your Twilio Phone Number. That particular to/from number pair (and *only* that pair) is now bound to Conversations, but Messages from any other mobile numbers (B, C, D) remain unbound and continue to trigger webhooks to the SMS URL that you set above.

Effectively, you've moved a single relationship (mobile number A to your Twilio Phone Number) onto Conversations, but the rest of your customers (mobile numbers B, C, and D) remain on the pre-established setup.

As soon as you delete that Conversation Participant (mobile number A and Twilio Phone number), you start getting incoming SMS webhooks again, rather than having the Messages routed to Conversations.

### Guidance for migrating to Conversations with Autocreate

With Twilio Conversations, you can automatically create new Conversations for inbound messages. If you are already using Programmable Messaging to process inbound messages, we recommend that your switch to Conversations follow the following pattern.

#### 1. Create Conversations explicitly via REST

Initially, you should leave Autocreate disabled and migrate one Conversation at a time, creating those Conversations using the Conversations REST API. The rules described above work in your favor here: Your existing Programmable Messaging logic (i.e., your *incoming SMS* webhook) will hold for all inbound Messages *except* those for which you create a Conversation Participant that binds to that number pair.\
By doing this, you can test your logic on individual Conversations, which likely means one consumer-agent relationship at a time. Those migrated Conversations immediately receive full support from the browser and mobile SDKs, and Conversations webhooks fire specifically for those Conversations. This keeps risk low while you explore and develop.

#### 2. Start with an empty Messaging Service, then enable Autocreation

Usually, to handle inbound Messages in customer service use-cases (where consumers reach out unsolicited), you'll want to [enable Autocreation](/docs/conversations/inbound-autocreation#settings-for-enabling-autocreation-in-conversations). In order to mitigate risk while migrating from Programmable Messaging, we recommend starting from an empty [Messaging Service](/docs/messaging/services), i.e. remove all Senders from the Conversations Messaging Service. After doing so, it will be safe to enable Autocreation for Conversations.\
With an empty Messaging Service sender pool attached to a Conversation, you can enable Autocreate without affecting your existing SMS applications and Phone Number webhook logic.

#### 3. Migrate one Phone Number at a Time

At this point, your logic is in place, so you can begin moving over Phone Numbers to your Conversations Messaging Service slowly, ensuring that the logic is correct.\
One at a time, add your Twilio Phone Numbers to the Conversations Messaging Service. Autocreate will immediately take hold for those numbers that you add to the sender pool — and *only* those numbers. We recommend observing and spot-testing between the first migrations, looking for any incidental errors.

#### 4. Use the REST API to complete the migration

Once it's clear that no bugs are emerging, you can accelerate your migration by using the Messaging Service REST API to [add phone numbers to your Messaging Service](/docs/messaging/api/phonenumber-resource#create-a-phonenumber-resource-add-a-phone-number-to-a-messaging-service) from a script. Once all the numbers are on the Messaging Service, Autocreation applies immediately to the full set of numbers in the Service's Sender Pool.

## How Group MMS handles inbound messages

If you're using our public-beta Group MMS support (from the US or Canada) the same rules apply as above: if the Message is destined for a Conversation, the Conversations API will deliver it to the correct Conversation, as well as fire the appropriate webhooks.

Otherwise, as above, either inbound Autocreation or ordinary (non-Conversations) Programmable Messaging webhooks take hold. (**Note** that Twilio Programmable Messaging does not support Group MMS). The switch to enable Autocreation for Group MMS is exactly the same.

### Autocreation in Group MMS

However, there are a few differences in inbound handling and Autocreation for Group MMS.

#### The "Number Pair" becomes the "Number Group"

When managing 1:1 Conversations, it generally makes sense to use Address+ProxyAddress number pairs, with both numbers (the Twilio Phone Number and the personal mobile number) assigned to the SMS Participant in question. This is what we saw above.

In Group MMS Conversations, Participants look different:

* Participants on SMS only have Address (**no**`ProxyAddress`).
* Application-side Participants ("chat" Participants) will have a `ProjectedAddress`.
* You may have up to twenty (20) total Addresses and ProjectedAddresses in a Group MMS Conversation.

Therefore, for Group MMS, the "number pair" principle described above no longer applies. Instead, the inbound target of a Group MMS Message is the "number group." To arrive at a Conversation, the sorted set of all senders (`From`=) and receivers (`To`=) on the Message *must* match the sorted set of Addresses and ProjectedAddresses on some existing Conversation.

#### **Autocreation Webhooks for Group Texts**

When autocreating a Group MMS Conversation, the order of webhooks has two important nuances:

First, **onConversationAdd** contains a complete list of all Participants across `MessagingBinding.Address` (the receivers) and `MessagingBinding.AuthorAddress` (the sender).

Second, the state of the Conversation remains at `initializing` — meaning that the Conversation cannot be changed except to accept or reject changes — until the **onConversationStateUpdated** webhook indicates that all the resources have been created.

## What's Next?

With inbound message handling and autocreation, you can create seamless conversational messaging for your end users. Check out some of our other resources to continue building with Twilio Conversations:

* [Group Texting in Conversations](/docs/conversations/group-texting)
* [Migrating to Conversations from Programmable Chat](/docs/conversations/migrating-chat-conversations)
* [Using WhatsApp with Conversations](/docs/conversations/using-whatsapp-conversations)


=============

# Push Notification Configuration for Conversations

Using push notifications with your Conversations implementation drives your customers to re-engage with your app. With Twilio Conversations, you can configure pushes for:

* New Messages
* New Media Messages (new since October 2021)
* Conversations you've joined
* Conversations you've left

Conversations integrates Apple Push Notifications (iOS) and Firebase Cloud Messaging (Android and browsers) using the Push credentials configured on your Twilio account. The content and payload of your push notifications will be different depending on the event that precipitates them.

Conversations Service instances provide some configuration options that allow push notification configuration on a per Service instance basis. These options allow for:

* Selecting which of the eligible Conversations events should trigger push notifications
* Specifying the payload template for each message type (overriding the default template)

**Table of Contents**

* [Push Notification Types](#push-types)
* [Push Notification Templates](#push-templates)
* [Configuring Push Notifications](#push-configuring)

## Push Notification Types \[#push-types]

The following push notifications can be configured for a Conversations Service instance:

| Push Notification Type    | Description                                                                                                                                            |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Message               | This is sent to each chat [participant](/docs/conversations/api/conversation-participant-resource) in a Conversation whenever a new Message is posted. |
| New Media Message         | This is sent to each chat participant in a Conversation whenever a new message is posted with Media (instead of text).                                 |
| Added to Conversation     | This is sent to chat participants that have been added to a Conversation                                                                               |
| Removed from Conversation | This is sent to chat participants that have been removed from a Conversation                                                                           |

> \[!NOTE]
>
> The default `enabled` flag for new Service instances for all push
> notifications is `false`. This means that push notifications will be disabled
> until you explicitly set the flag to `true`.

## Push Notification Templates \[#push-templates]

Each of the push notification types has a default template for the payload (or notification body). Each of these templates can be overridden per Service instance via the push notification configuration. The templating employs markup for a limited set of variables:

### Template Variables

| Template Variable               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${PARTICIPANT}`                | Will be replaced with the `FriendlyName` of the Participant's underlying User who triggered the push notification (if any). The User's `Identity` will be used if no `FriendlyName` has been set. For Proxy Participants engaged via a non-chat channel, the `MessagingBinding.Address` will be used instead. When [group texting](/docs/conversations/group-texting), the `MessagingBinding.Address` will be used, or the `MessagingBinding.ProjectedAddress` if the Participant uses a Twilio phone number and has no underlying User. |
| `${PARTICIPANT_FRIENDLY_NAME}`  | Synonym of `${PARTICIPANT}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `${PARTICIPANT_IDENTITY}`       | Synonym of `${PARTICIPANT}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `${PARTICIPANT_SID}`            | Will be replaced with the `Sid` of the Participant who triggered the push notification (if any). The Participant's `Identity` will be used if no `Sid` is available.                                                                                                                                                                                                                                                                                                                                                                     |
| `${CONVERSATION}`               | Will be replaced with the `UniqueName`, `FriendlyName` or `ConversationSid` (if they exist, in that order of priority). These properties are tied to the Conversation related to the push notification.                                                                                                                                                                                                                                                                                                                                  |
| `${CONVERSATION_FRIENDLY_NAME}` | Will be replaced with the `FriendlyName`, `UniqueName` or `ConversationSid` (if they exist, in that order of priority). These properties are tied to the Conversation related to the push notification.                                                                                                                                                                                                                                                                                                                                  |
| `${CONVERSATION_SID}`           | Will be replaced with the `ConversationSid`. This property is tied to the Conversation related to the push notification.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `${CONVERSATION_UNIQUE_NAME}`   | Will be replaced with the `UniqueName`, or the `FriendlyName`, or `ConversationSid` (in that order) of the conversation to which this push pertains.                                                                                                                                                                                                                                                                                                                                                                                     |
| `${MESSAGE}`                    | Will be replaced with the body of the actual Message. Only used for notifications of type: **New Message**                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `${MEDIA_COUNT}`                | Sent exclusively for **New Media Message** pushes; counts the number of media files included. Presently, this will never be higher than 1; support for multiple media on the same message is coming soon.                                                                                                                                                                                                                                                                                                                                |
| `${MEDIA}`                      | Sent exclusively for **New Media Message** pushes; presents the filename of the first media attached to the message.                                                                                                                                                                                                                                                                                                                                                                                                                     |

> \[!NOTE]
>
> The maximum length of the entire notification payload is **178 characters**.
> This limit is applied after the notification payload is constructed and the
> variable data is applied. Thus, freeform text and the variable data are
> compiled into a string and the first **178 characters** are then used as the
> notification payload.

> \[!NOTE]
>
> Variables can be used multiple times within a template, but each variable will
> contribute to the maximum number of available characters.

### Default Templates

| Push Notification Type    | Default Template                                                                      |
| :------------------------ | :------------------------------------------------------------------------------------ |
| New Message               | `${CONVERSATION}:${PARTICIPANT}: ${MESSAGE}`                                          |
| New Media Message         | `You have a new message in ${CONVERSATION} with ${MEDIA_COUNT} media files: ${MEDIA}` |
| Added to Conversation     | `You have been added to the conversation ${CONVERSATION} by ${PARTICIPANT}`           |
| Removed from Conversation | `${PARTICIPANT} has removed you from the conversation ${CONVERSATION}`                |

## Configure Push Notifications \[#push-configuring]

Each push notification type can be configured for a Service instance. The configuration allows each notification type to be `enabled` or `disabled`. This also handles custom template configuration as per the templating mechanism described above.

The following are the eligible notification `type` names:

* `NewMessage`
* `AddedToConversation`
* `RemovedFromConversation`

The following are the configuration parameters used:

| parameter name                | description                                                                                                                                                                                                                                         |
| :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \[type].Enabled               | Set `true` to send this type of push notification. Default: `false`                                                                                                                                                                                 |
| \[type].Template              | The customer template string for the notification type.                                                                                                                                                                                             |
| \[type].Sound                 | The `sound` push payload parameter that will be set for this notification type, appropriately to the target platform.                                                                                                                               |
| NewMessage.BadgeCountEnabled  | `true` if the `NewMessage` notification type should send a [badge count value](#badge-count) in the push payload. *This parameter is only applicable to the `NewMessage` type.* This is currently only used by the iOS APNS push notification type. |
| NewMessage.WithMedia.Enabled  | Set `true` to send pushes for media messages. Default: `false`.                                                                                                                                                                                     |
| NewMessage.WithMedia.Template | A specific template for new media message pushes, different and independent of `NewMessage.Template`.                                                                                                                                               |

### Badge Count

Badge count refers to a counter on an app's icon that displays how many unread notifications there are for that app. Currently, only APNS push notifications for iOS will use this and include the `badge` property in the payload.

The badge count setting applies only to the `NewMessage` notification type. If enabled, the value of this property will represent the count of one-to-one Conversations the User participates in where there are *unread* Messages for the User.

If `NewMessage.BadgeCountEnabled` is set to `true`, decrements to the count of Conversations with unread messages will be sent to all registered iOS endpoints for that User.

Configure New Message Push Notifications

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function updateServiceNotification() {
  const notification = await client.conversations.v1
    .services("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .configuration.notifications()
    .update({
      "addedToConversation.enabled": true,
      "addedToConversation.sound": "default",
      "addedToConversation.template":
        "There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}",
    });

  console.log(notification.addedToConversation);
}

updateServiceNotification();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

service_notification = (
    client.conversations.v1.services("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .configuration.notifications()
    .update(
        added_to_conversation_enabled=True,
        added_to_conversation_sound="default",
        added_to_conversation_template="There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}",
    )
)

print(service_notification.added_to_conversation)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Service.Configuration;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var notification = await NotificationResource.UpdateAsync(
            addedToConversationEnabled: true,
            addedToConversationSound: "default",
            addedToConversationTemplate: "There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}",
            pathChatServiceSid: "ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

        Console.WriteLine(notification.AddedToConversation);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.service.configuration.Notification;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Notification notification = Notification.updater("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
                                        .setAddedToConversationEnabled(true)
                                        .setAddedToConversationSound("default")
                                        .setAddedToConversationTemplate(
                                            "There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}")
                                        .update();

        System.out.println(notification.getAddedToConversation());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.UpdateServiceNotificationParams{}
	params.SetAddedToConversationEnabled(true)
	params.SetAddedToConversationSound("default")
	params.SetAddedToConversationTemplate("There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}")

	resp, err := client.ConversationsV1.UpdateServiceNotification("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AddedToConversation != nil {
			fmt.Println(*resp.AddedToConversation)
		} else {
			fmt.Println(resp.AddedToConversation)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$service_notification = $twilio->conversations->v1
    ->services("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ->configuration->notifications()
    ->update([
        "addedToConversationEnabled" => true,
        "addedToConversationSound" => "default",
        "addedToConversationTemplate" => "There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}",
    ]);

print $service_notification->addedToConversation;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

notification = @client
               .conversations
               .v1
               .services('ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
               .configuration
               .notifications
               .update(
                 added_to_conversation_enabled: true,
                 added_to_conversation_sound: 'default',
                 added_to_conversation_template: 'There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}'
               )

puts notification.added_to_conversation
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:services:configuration:notifications:update \
   --chat-service-sid ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --added-to-conversation.enabled \
   --added-to-conversation.sound default \
   --added-to-conversation.template "There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Services/ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Configuration/Notifications" \
--data-urlencode "AddedToConversation.Enabled=true" \
--data-urlencode "AddedToConversation.Sound=default" \
--data-urlencode "AddedToConversation.Template=There is a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "log_enabled": true,
  "added_to_conversation": {
    "enabled": false,
    "template": "You have been added to a Conversation: ${CONVERSATION}",
    "sound": "ring"
  },
  "new_message": {
    "enabled": false,
    "template": "You have a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}",
    "badge_count_enabled": true,
    "sound": "ring",
    "with_media": {
      "enabled": false,
      "template": "You have a new message in ${CONVERSATION} with ${MEDIA_COUNT} media files: ${MEDIA}"
    }
  },
  "removed_from_conversation": {
    "enabled": false,
    "template": "You have been removed from a Conversation: ${CONVERSATION}",
    "sound": "ring"
  },
  "url": "https://conversations.twilio.com/v1/Services/ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Configuration/Notifications"
}
```

Enable Media Pushes

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function updateServiceNotification() {
  const notification = await client.conversations.v1
    .services("ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .configuration.notifications()
    .update({
      "newMessage.withMedia.enabled": true,
      "newMessage.withMedia.template":
        "${PARTICIPANT} sent you a file: ${MEDIA}",
    });

  console.log(notification.newMessage);
}

updateServiceNotification();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

service_notification = (
    client.conversations.v1.services("ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .configuration.notifications()
    .update(
        new_message_with_media_enabled=True,
        new_message_with_media_template="${PARTICIPANT} sent you a file: ${MEDIA}",
    )
)

print(service_notification.new_message)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Service.Configuration;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var notification = await NotificationResource.UpdateAsync(
            newMessageWithMediaEnabled: true,
            newMessageWithMediaTemplate: "${PARTICIPANT} sent you a file: ${MEDIA}",
            pathChatServiceSid: "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

        Console.WriteLine(notification.NewMessage);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.service.configuration.Notification;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Notification notification = Notification.updater("ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
                                        .setNewMessageWithMediaEnabled(true)
                                        .setNewMessageWithMediaTemplate("${PARTICIPANT} sent you a file: ${MEDIA}")
                                        .update();

        System.out.println(notification.getNewMessage());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.UpdateServiceNotificationParams{}
	params.SetNewMessageWithMediaEnabled(true)
	params.SetNewMessageWithMediaTemplate("${PARTICIPANT} sent you a file: ${MEDIA}")

	resp, err := client.ConversationsV1.UpdateServiceNotification("ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.NewMessage != nil {
			fmt.Println(*resp.NewMessage)
		} else {
			fmt.Println(resp.NewMessage)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$service_notification = $twilio->conversations->v1
    ->services("ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ->configuration->notifications()
    ->update([
        "newMessageWithMediaEnabled" => true,
        "newMessageWithMediaTemplate" => "${PARTICIPANT} sent you a file: ${MEDIA}",
    ]);

print $service_notification->newMessage;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

notification = @client
               .conversations
               .v1
               .services('ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
               .configuration
               .notifications
               .update(
                 new_message_with_media_enabled: true,
                 new_message_with_media_template: '${PARTICIPANT} sent you a file: ${MEDIA}'
               )

puts notification.new_message
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:services:configuration:notifications:update \
   --chat-service-sid ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
   --new-message.with-media.enabled \
   --new-message.with-media.template "${PARTICIPANT} sent you a file: ${MEDIA}"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Services/ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Configuration/Notifications" \
--data-urlencode "NewMessage.WithMedia.Enabled=true" \
--data-urlencode "NewMessage.WithMedia.Template=${PARTICIPANT} sent you a file: ${MEDIA}" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "log_enabled": true,
  "added_to_conversation": {
    "enabled": false,
    "template": "You have been added to a Conversation: ${CONVERSATION}",
    "sound": "ring"
  },
  "new_message": {
    "enabled": false,
    "template": "You have a new message in ${CONVERSATION} from ${PARTICIPANT}: ${MESSAGE}",
    "badge_count_enabled": true,
    "sound": "ring",
    "with_media": {
      "enabled": false,
      "template": "You have a new message in ${CONVERSATION} with ${MEDIA_COUNT} media files: ${MEDIA}"
    }
  },
  "removed_from_conversation": {
    "enabled": false,
    "template": "You have been removed from a Conversation: ${CONVERSATION}",
    "sound": "ring"
  },
  "url": "https://conversations.twilio.com/v1/Services/ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Configuration/Notifications"
}
```

Setting additional notification types requires including them in your configuration request. For instance, to include the `AddedToConversation` push notification type, you can add the following 3 rows to your `curl` request.

```bash
'AddedToConversation.Enabled=true'
'AddedToConversation.Template=You are now a participant of ${CONVERSATION}!  Added by ${PARTICIPANT}'
'AddedToConversation.Sound=default'
```


==============

# Push Notifications on Android for Conversations

Your end users can get push notifications when another participant in a conversation sends a message, joins the conversation, or leaves the conversation. You can configure which of these events send push notifications, as well as the message template used and any sound that plays.

Twilio uses the Firebase Cloud Messaging (FCM) service to send push notifications. You need to set up your Android app to use push notifications if you have not done so already. You also need to share an FCM API key with Twilio so that push notifications can be sent to your application.

## Step 1: Enable push notifications for your Service instance

**IMPORTANT:** The default enabled flag for new Service instances for all Push Notifications is `false`. This means that push notifications will be disabled until you explicitly enable them. Follow [this guide](/docs/conversations/push-notification-configuration) to do so.

## Step 2: Create a configuration file

The Firebase Cloud Messaging (FCM) library looks for a file named `google-services.json` in your Android app to identify push configuration details. Google provides a web interface for generating this file that you can find in the [Firebase Console](https://console.firebase.google.com/).

Copy the `google-services.json` file you download in the step below into the `app/` directory of your Android Studio project.

![Firebase console showing options to create or import a project with recent projects listed.](https://docs-resources.prod.twilio.com/3692b6c3762064521e113d66953c22a3ada75d8b9fcfe0802aa6e0d6a08b0db0.gif)

Once you've entered your app credentials, you can download the generated file to your desktop. Save the API Key that is displayed on the last page, as you will need it in a later step.

## Step 3: Set up your Android app with Firebase

As the version numbers for the Firebase libraries are always changing, please refer to the [Add Firebase to your Android project](https://firebase.google.com/docs/android/setup) documentation guide for setup instructions. You can add Firebase manually to Gradle, or use the Firebase Assistant in the Android Studio IDE.

## Step 4: Add Firebase Cloud Messaging to your Android application

Adding Firebase Cloud Messaging is described in the [Set up a Firebase Cloud Messaging client app on Android](https://firebase.google.com/docs/cloud-messaging/android/client) guide on the Firebase site. Be sure to add the `com.google.firebase:firebase-messaging` library to your dependencies.

Be sure to follow the steps to modify the app's `AndroidManifest.xml` file, and add the Java or Kotlin code to [Access the device token](https://firebase.google.com/docs/cloud-messaging/android/client#sample-register). You will need to send that device token to Twilio, which we describe in a later step of this guide.

As a quick check at this point, you can send a push notification through Firebase Cloud Messaging to your app using the Firebase Web Console. Verify that you have Firebase Cloud Messaging working correctly with your server and that you can retrieve a device token before proceeding with the Twilio integration steps in this guide.

## Step 5: Upload your API Key to Twilio

Now that you have your app configured to receive push notifications, upload your API Key by creating a Credential resource. Visit the [Push Credentials Creation](https://console.twilio.com/us1/account/keys-credentials/push-credentials?frameUrl=/console/project/credentials/push-credentials) page to generate a FCM credential SID using the API key. You can also get to the Credentials page by clicking on the **Account** dropdown in the top left corner of the Twilio Console and then clicking on **Credentials** from the dropdown Account menu. Once on the Credentials page, click the **Push Credentials** tab.

On the Push Credentials Page, create a new Push Credential. Give the credential a name and make sure the credential's type is "FCM Push Credentials". Under "FCM Secret", paste your API Key from the end of Step 2. Then, click **Create**.

The next screen you see after creating the credential includes the new push credential's SID. Keep that credential SID handy for the next step.

## Step 6: Pass the Push Credential Sid in your Access Token

For this step, you will modify your server application to add the push credential SID from the previous step into your server's [Access Token generation](/docs/conversations/create-tokens).

Your Access Token needs to include the Push Credential SID that you got in Step 5. See below for examples in each Twilio server-side SDK of how to generate an Access Token with a ChatGrant that contains a Push Credential SID.

Creating an Access Token (Chat) with Push Credentials

```js
const AccessToken = require('twilio').jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;

// Used when generating any kind of tokens
// To set up environmental variables, see http://twil.io/secure
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioApiKey = process.env.TWILIO_API_KEY;
const twilioApiSecret = process.env.TWILIO_API_SECRET;

// Used specifically for creating Chat tokens
const serviceSid = process.env.TWILIO_CHAT_SERVICE_SID;
const pushCredentialSid = process.env.TWILIO_PUSH_CREDENTIAL_SID;
const identity = 'user@example.com';

// Create a "grant" which enables a client to use Chat as a given user,
// on a given device
const chatGrant = new ChatGrant({
  serviceSid: serviceSid,
  push_credential_sid: pushCredentialSid
});

// Create an access token which we will sign and return to the client,
// containing the grant we just created
const token = new AccessToken(
  twilioAccountSid,
  twilioApiKey,
  twilioApiSecret,
  {identity: identity}
);

token.addGrant(chatGrant);

// Serialize the token to a JWT string
console.log(token.toJwt());
```

```py
import os
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import ChatGrant

# required for all twilio access tokens
# To set up environmental variables, see http://twil.io/secure
account_sid = os.environ['TWILIO_ACCOUNT_SID']
api_key = os.environ['TWILIO_API_KEY']
api_secret = os.environ['TWILIO_API_KEY_SECRET']

# required for Chat grants
service_sid = 'ISxxxxxxxxxxxx'
push_credential_sid = 'CRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
identity = 'user@example.com'

# Create access token with credentials
token = AccessToken(account_sid, api_key, api_secret, identity=identity)

# Create an Chat grant and add to token
chat_grant = ChatGrant(service_sid=service_sid, push_credential_sid=push_credential_sid)
token.add_grant(chat_grant)

# Return token info as JSON
print(token.to_jwt())
```

```cs
using System;
using System.Collections.Generic;
using Twilio.Jwt.AccessToken;

class Example
{
    static void Main(string[] args)
    {
        // These values are necessary for any access token
        // To set up environmental variables, see http://twil.io/secure
        const string twilioAccountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        const string twilioApiKey = Environment.GetEnvironmentVariable("TWILIO_API_KEY");
        const string twilioApiSecret = Environment.GetEnvironmentVariable("TWILIO_API_SECRET");

        // These are specific to Chat
        const string serviceSid = Environment.GetEnvironmentVariable("TWILIO_SERVICE_SID");
        const string pushCredentialSid = Environment.GetEnvironmentVariable("TWILIO_PUSH_CREDENTIAL_SID");
        const string identity = "user@example.com";

        // Create an Chat grant for this token

        var grant = new ChatGrant
        {
          ServiceSid = serviceSid,
          PushCredentialSid = pushCredentialSid
        };

        var grants = new HashSet<IGrant>
        {
            { grant }
        };

        // Create an Access Token generator
        var token = new Token(
            twilioAccountSid,
            twilioApiKey,
            twilioApiSecret,
            identity,
            grants: grants);

        Console.WriteLine(token.ToJwt());
    }
}
```

```java
import com.twilio.jwt.accesstoken.AccessToken;
import com.twilio.jwt.accesstoken.ChatGrant;

public class Example {
  public static void main(String[] args) {
    // Get your Account SID from https://twilio.com/console
    // To set up environment variables, see http://twil.io/secure
    // Required for all types of tokens
    String twilioAccountSid = System.getenv("TWILIO_ACCOUNT_SID");
    String twilioApiKey = System.getenv("TWILIO_API_KEY");
    String twilioApiSecret = System.getenv("TWILIO_API_SECRET");

    String serviceSid = System.getenv("TWILIO_SERVICE_SID");
    String pushCredentialSid = System.getenv("TWILIO_PUSH_CREDENTIAL_SID");
    String identity = "user@example.com";

    ChatGrant grant = new ChatGrant();
    grant.setServiceSid(serviceSid);
    grant.setPushCredentialSid(pushCredentialSid);

    AccessToken token = new AccessToken.Builder(twilioAccountSid, twilioApiKey, twilioApiSecret)
        .identity(identity).grant(grant).build();

    System.out.println(token.toJwt());
  }
}
```

```go
package main

import (
	"fmt"
	"os"

	"github.com/twilio/twilio-go/client/jwt"
)

func main() {
	// Get your Account SID from https://twilio.com/console
	// To set up environment variables, see http://twil.io/secure
	// Required for all types of tokens
	var twilioAccountSid string = os.Getenv("TWILIO_ACCOUNT_SID")
	var twilioApiKey string = os.Getenv("TWILIO_API_KEY")
	var twilioApiSecret string = os.Getenv("TWILIO_API_SECRET")

	params := jwt.AccessTokenParams{
		AccountSid:    twilioAccountSid,
		SigningKeySid: twilioApiKey,
		Secret:        twilioApiSecret,
		Identity:      "user@example.com",
	}

	jwtToken := jwt.CreateAccessToken(params)
	chatGrant := &jwt.ChatGrant{
		ServiceSid:        "ISxxxxxxxxxxxx",
		PushCredentialSid: "CRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
	}

	jwtToken.AddGrant(chatGrant)
	token, err := jwtToken.ToJwt()

	if err != nil {
		error := fmt.Errorf("error: %q", err)
		fmt.Println(error.Error())
	}

	fmt.Println(token)
}
```

```php
<?php
// Get the PHP helper library from https://twilio.com/docs/libraries/php
require_once '/path/to/vendor/autoload.php'; // Loads the library
use Twilio\Jwt\AccessToken;
use Twilio\Jwt\Grants\ChatGrant;

// Required for all Twilio access tokens
// To set up environmental variables, see http://twil.io/secure
$twilioAccountSid = getenv('TWILIO_ACCOUNT_SID');
$twilioApiKey = getenv('TWILIO_API_KEY');
$twilioApiSecret = getenv('TWILIO_API_KEY_SECRET');

// Required for Chat grant
$serviceSid = 'ISxxxxxxxxxxxx';
$pushCredentialSid = 'CRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
// choose a random username for the connecting user
$identity = "john_doe";

// Create access token, which we will serialize and send to the client
$token = new AccessToken(
    $twilioAccountSid,
    $twilioApiKey,
    $twilioApiSecret,
    3600,
    $identity
);

// Create Chat grant
$chatGrant = new ChatGrant();
$chatGrant->setServiceSid($serviceSid);
$chatGrant->setPushCredentialSid($pushCredentialSid);

// Add grant to token
$token->addGrant($chatGrant);

// render token to string
echo $token->toJWT();
```

```rb
require 'twilio-ruby'

# Required for any Twilio Access Token
# To set up environmental variables, see http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
api_key = ENV['TWILIO_API_KEY']
api_secret = ENV['TWILIO_API_KEY_SECRET']

# Required for Chat
service_sid = 'ISxxxxxxxxxxxx'
push_credential_sid = 'CRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
identity = 'user@example.com'

# Create Chat grant for our token
grant = Twilio::JWT::AccessToken::ChatGrant.new
grant.service_sid = service_sid
grant.push_credential_sid = push_credential_sid

# Create an Access Token
token = Twilio::JWT::AccessToken.new(
  account_sid,
  api_key,
  api_secret,
  [grant],
  identity: identity
)

# Generate the token
puts token.to_jwt
```

## Step 7: Use the Registration API in the Twilio ConversationsClient

You will need to call the `ConversationsClient` API methods, `registerFCMToken` and `unregisterFCMToken`, to send the individual Android device's FCM token to Twilio, so that Twilio can send push notifications to the right device. See the [Twilio Conversations Android SDK documentation](https://media.twiliocdn.com/sdk/android/conversations/latest/docs/) for details.

Nice! That's all you need to do to make sure the Conversations Client can use Firebase Cloud Messaging to send push notifications.


=============

# Push Notifications on iOS for Conversations

Your iOS app users can receive push notifications from Twilio Conversations when important events occur, such as a new message in the conversation.

You will need to do some configuration and integration to get push notifications working with your app, and this guide will walk you through the necessary steps:

1. Your Twilio Conversations Service
2. The Apple Push Notification Service credential
3. Your Conversations Access Token server
4. Your iOS application

## Enable push notifications for your Service instance

**IMPORTANT:** The default enabled flag for new Service instances for all Push Notifications is `false`. This means that Push will be disabled until you explicitly enable it. To do so, please follow our [Push Notification Configuration Guide](/docs/conversations/push-notification-configuration).

**Note:** You will need to configure the `sound` setting value for each push notification type you want the `sound` payload parameter to present for, with required value. More information can be found in the previously mentioned [Push Notification Configuration Guide](/docs/conversations/push-notification-configuration).

## Managing your push credentials

Managing your push credentials will be necessary, as your device token is required for the Conversations SDK to be able to send any notifications through APNS. Let's go through the process of managing your push credentials.

Your iOS project's `AppDelegate` class contains a series of application lifecycle methods. These methods include event listeners such as your app moving to the background or foreground.

When working with push notifications in your iOS application, it is quite likely you will find yourself needing to process push registrations or received events prior to the initialization of your Conversations client. For this reason, we recommend you create a spot to store any registrations or push messages your application receives prior to the client being fully initialized.

The best option for this is to store the registrations or push messages in an instance of a helper class. This way, your Conversations client can process these values post-initialization if necessary or real-time otherwise. If you are doing a quick proof of concept, you could even define these on the application delegate itself but we recommend you refrain from doing this as storing state on the application delegate is not considered a best practice on iOS.

We will assume that you have defined the following properties in a way that makes them accessible to your application delegate method and Conversations client initialization:

Conversations Push State Variables

```objective-c
@property (nonatomic, strong) NSData *updatedPushToken;
@property (nonatomic, strong) NSDictionary *receivedNotification;
@property (nonatomic, strong) TwilioConversationsClient *conversationsClient;
```

```swift
var updatedPushToken: Data?
var receivedNotification: [AnyHashable: Any]?
var conversationsClient: TwilioConversationsClient?
```

Your users can choose to authorize notifications or not - if they have authorized notifications, you can register the application for remote notifications from Twilio. Typically, you would do this in `AppDelegate.swift` in the `didFinishLaunchingWithOptions` function.

User Notification Settings

```objective-c
// Add this to the didFinishLaunchingWithOptions function or a similar place
// once you get granted permissions
UNUserNotificationCenter *currentNotificationCenter = [UNUserNotificationCenter currentNotificationCenter];
[currentNotificationCenter getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
    if (settings.authorizationStatus == UNAuthorizationStatusAuthorized) {
        [UIApplication.sharedApplication registerForRemoteNotifications];
    }
}];
```

```swift
let center = UNUserNotificationCenter.current()
center.getNotificationSettings { (settings) in
    if settings.authorizationStatus == .authorized {
        DispatchQueue.main.async {
        UIApplication.shared.registerForRemoteNotifications()
        }
    }
}
```

After successfully registering for remote notifications, the Apple Push Notification Service (APNS) will send back a unique device token that identifies this app installation on this device. The Twilio Conversations Client will take that device token (as a `Data` object), and pass it to Twilio's servers to use to send push notifications to this device.

Store Registration

```objective-c
- (void)application:(UIApplication*)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData*)deviceToken {
    if (self.conversationsClient && self.conversationsClient.user) {
        [self.conversationsClient registerWithNotificationToken:deviceToken
                                            completion:^(TCHResult *result) {
                                                if (![result isSuccessful]) {
                                                    // try registration again or verify token
                                                }
                                            }];
    } else {
        self.updatedPushToken = deviceToken;
    }
}

- (void)application:(UIApplication*)application didFailToRegisterForRemoteNotificationsWithError:(NSError*)error {
    NSLog(@"Failed to get token, error: %@", error);
    self.updatedPushToken = nil;
}
```

```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    print("Received device token")
    if let conversationsClient = conversationsClient, conversationsClient.user != nil {
        conversationsClient.register(withNotificationToken: deviceToken) { (result) in
            if !result.isSuccessful() {
                // try registration again or verify token
            }
        }
    } else {
        updatedPushToken = deviceToken
    }
}

func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("Failed to get token, error: %@", error)
    updatedPushToken = nil
}
```

We print an error if it fails, but if it succeeds, we either update the Conversations client directly or save the token for later use.

## Provisioning Apple Developer credentials for APN Pushes

Make sure you have created an "Apple Push Notification service SSL (Sandbox & Production)" certificate on the [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list) for your application first.

We're going to need to export both a certificate and a private key from Keychain Access:

1. Start the "Keychain Access" application on your Mac
2. Pick the "My Certificates" Category in the left hand sidebar
3. Right-click the "Apple Development iOS Push Services" certificate for your application's bundle identifier
4. In the popup menu choose "Export…"
5. Save it as "cred.p12" without protecting it with password (leave the password blank)
6. Extract the certificate from "cred.p12" into a "cert.pem" file - run the following command in terminal:

```bash
openssl pkcs12 -in cred.p12 -nokeys -out cert.pem -nodes
```

7. In the cert.pem file, strip anything outside of "-----BEGIN CERTIFICATE-----" and "-----END CERTIFICATE-----" boundaries, such as the "Bag Attributes"
8. Extract your private key from the "cred.p12" (PKCS#12) into the "key.pem" (PKCS#1) file using the following command in terminal

```bash
openssl pkcs12 -in cred.p12 -nocerts -out key.pem -nodes
```

The resulting file should contain "-----BEGIN RSA PRIVATE KEY-----". If the file contains "-----BEGIN PRIVATE KEY-----" and run the following command:

```bash
openssl rsa -in key.pem -out key.pem
```

Strip anything outside of "-----BEGIN RSA PRIVATE KEY-----" and "-----END RSA PRIVATE KEY-----" boundaries and upload your credentials into the Twilio Platform through the Console.

To store your Credential, visit your [Credentials Page](https://console.twilio.com/us1/account/keys-credentials/credentials?frameUrl=/console/project/credentials/push-credentials) and click on the `Create New Credential` button.

The Credential SID for your new Credential is in the detail page labeled 'Credential SID.'

When you create your access token for the iOS clients, be sure to add your credential SID to the chat grant.

Each of the Twilio server-side SDKs makes provisions to add the `push_credential_sid.` Please see the relevant documentation for your preferred server-side SDK for details.

```js
var chatGrant = new ChatGrant({
    serviceSid: ChatServiceSid,
    pushCredentialSid: APNCredentialSid,
});
```

This is all of the integration you need on the server side to make push notifications work with Twilio Conversations. The next step is to set up your iOS application.

## Integrating Push Notifications

Let's go through the process for integrating push notifications into your iOS app.

The `AppDelegate` class contains a series of application lifecycle methods. Many important events that occur like your app moving to the background or foreground have event listeners in this class. One of those is the `applicationDidFinishLaunchingWithOptions` method.

Did Finish Launching

```objective-c
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
```

```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions
                 launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool
```

In this method, we're going to want to integrate push notifications for our app

Notification Types

```objective-c
UNUserNotificationCenter *currentNotificationCenter = [UNUserNotificationCenter currentNotificationCenter];
[currentCenter requestAuthorizationWithOptions:UNAuthorizationOptionBadge | UNAuthorizationOptionAlert | UNAuthorizationOptionSound
                                completionHandler:^(BOOL granted, NSError *error) {
    // Add here your handling of granted or not granted permissions
}];
currentNotificationCenter.delegate = self;
```

```swift
let center = UNUserNotificationCenter.current()
center.requestAuthorization(options: [.alert, .badge, .sound]) { (granted, error) in
    print("User allowed notifications:", granted)
    if granted {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    } else {
        if error {
            print(error.localizedDescription)
        }
    }
}
```

The above code snippet asks the user's permission for notifications, and if granted, registers for remote (push) notifications. That's it! We're now registered for notifications.

## Receiving Notifications

Receiving notifications in our app lets us react to whatever event just occurred. It can trigger our app to update a view, change a status, or even send data to a server. Whenever the app receives a notification, the method `didReceiveRemoteNotification` is fired

Did Receive Notification

```objective-c
// Do not forget to set up a delegate for UNUserNotificationCenter
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
    NSDictionary *userInfo = response.notification.request.content.userInfo;
    // If your application supports multiple types of push notifications, 
    // you may wish to limit which ones you send to the TwilioConversationsClient here
    if (self.conversationsClient) {
        // If your reference to the Conversations client exists and is initialized, 
        // send the notification to it
        [self.conversationsClient handleNotification:userInfo completion:^(TCHResult *result) {
            if (![result isSuccessful]) {
                // Handling of notification was not successful, retry?
            }
        }];
    } else {
         // Store the notification for later handling
         self.receivedNotification = userInfo;
     }
}
```

```swift
// Do not forget to set up a delegate for UNUserNotificationCenter
func userNotificationCenter(_ center: UNUserNotificationCenter,
                 didReceive response: UNNotificationResponse,
      withCompletionHandler completionHandler: @escaping () -> Void) {
   let userInfo = response.notification.request.content.userInfo
   if let conversationsClient = conversationsClient, conversationsClient.user != nil {
       // If your reference to the Conversations client exists 
       // and is initialized, send the notification to it
       conversationsClient.handleNotification(userInfo) { (result) in
           if !result.isSuccessful() {
               // Handling of notification was not successful, retry?
           }
       }
   } else {
       // Store the notification for later handling
       receivedNotification = userInfo
   }
}
```

We will pass the notification directly on to the Conversations client if it is initialized or store the event for later processing if not.

The userInfo parameter contains the data that the notification passes in from APNS. We can update our Conversations client by passing it into the singleton via the `receivedNotification` method. The manager wraps the Conversations client methods that process the notifications appropriately.

## Integration upon client startup

Once your Conversations client is up and available, you can provide the push token your application received:

Register Notifications

```objective-c
if (self.updatedPushToken) {
    [self.conversationsClient registerWithNotificationToken:self.updatedPushToken
                                                 completion:^(TCHResult *result) {
        if (![result isSuccessful]) {
            // try registration again or verify token
        }
    }];
}

if (self.receivedNotification) {
    [self.conversationsClient handleNotification:self.receivedNotification
                                      completion:^(TCHResult *result) {
        if (![result isSuccessful]) {
            // Handling of notification was not successful, retry?
        }
    }];
}
```

```swift
if let updatedPushToken = updatedPushToken {
  conversationsClient.register(withNotificationToken: updatedPushToken) { (result) in
    if !result.isSuccessful() {
        // try registration again or verify token
    }
  }
}

if let receivedNotification = receivedNotification {
  conversationsClient.handleNotification(receivedNotification) { (result) in
    if !result.isSuccessful() {
        // Handling of notification was not successful, retry?
    }
  }
}
```

## Update badge count

To update badge count on an application icon, you should pass badge count from the Conversations Client delegate to the application:

Update Badge Count

```objective-c
- (void)conversationsClient:(TwilioConversationsClient *)client notificationUpdatedBadgeCount:(NSUInteger)badgeCount {
    [UIApplication.currentApplication setApplicationIconBadgeNumber:badgeCount];
}
```

```swift
func conversationsClient(_ client: TwilioConversationsClient, notificationUpdatedBadgeCount badgeCount: UInt) {
    UIApplication.shared.applicationIconBadgeNumber = Int(badgeCount)
}
```

============

# Push Notifications on the Web for Conversations

## Push Notifications on the Web

Push notifications are an important part of the web experience. Users have grown accustomed to push notifications being part of virtually every app that they use. The Twilio Conversations JavaScript SDK can integrate Firebase Cloud Messaging (FCM) for push notifications.

Managing your push credentials is necessary, as your registration token is required for the Conversations SDK to be able to send any notifications through FCM. Let's go through the process of managing your push credentials.

## Step 1 - Enable push notifications for your Service instance

The default enabled flag for new Service instances for all Push Notifications is `false`. This means that Push will be disabled until you explicitly enable it. You can follow [this guide](/docs/conversations/push-notification-configuration) to do so.

## Step 2 - Configure Firebase

The developer must configure Firebase Cloud Messaging (FCM) before configuring notifications. Google provides a [Firebase Console](https://console.firebase.google.com/) to manage Firebase services and configurations.

### Create a project on Firebase

To use push notifications for your JavaScript app, you will need to create a project on the [Firebase Console](https://console.firebase.google.com/):

![Prompt to enter a project name with example 'my-awesome-project-id'.](https://docs-resources.prod.twilio.com/2c1c4be7d8c0c5f8d1d2f57ce8e65f2c61fae704faaf574bb92a1d2e4dd3b638.jpg)

### Get the project's configuration

The Firebase Cloud Messaging (FCM) requires configuration to initialize. The Firebase console has a way to create this configuration.

After you create a Firebase project, you can select the option to add Firebase to your web app. From the project overview page, under the text *"Get started by adding Firebase to your app"*, select the Web icon.

![Get started by adding Firebase to your app with icons for iOS, Android, web, and Unity.](https://docs-resources.prod.twilio.com/ea8fbcb964c1209aa45e55770ce672af261e56342106f3f8d5dac0427dc616da.jpg)

As a next step, register your app. Give the app a nickname and click the **Register app** button.

![Firebase setup step 1, register app with nickname 'My web app' and optional hosting setup.](https://docs-resources.prod.twilio.com/9a9da2a2363e54108ee603d6f32586d6709e83419efa45deae52db878a1da29b.png)

Once the app is registered, a customized code snippet will be displayed.

![Instructions for adding Firebase SDK using npm with example configuration code.](https://docs-resources.prod.twilio.com/60cc3d963c707e0ad364adae52192cf4a32752b2673e2fa2050e11e0ee8c5fd7.jpg)

This dialog contains sample JavaScript code with filled-in parameters that you can use in your newly created project.

Save this sample code with configuration - we will use it later in this guide.

## Step 3 - Upload your API Key to Twilio

Now that we have our app configured to receive push notifications, let's upload our API Key by creating a [Credential resource.](/docs/notify/api/credential-resource) Check out [the Credentials page in the Twilio console](https://www.twilio.com/console/notify/credentials/create) page to generate a credential SID using your API key. Click the **Create** button.

![Form to create new credential with fields for friendly name, type, and FCM secret.](https://docs-resources.prod.twilio.com/ffa3fbb40b808bd25ea91c15f7e72ea28c9424861c70c2124eb1672cd37627e7.png)

## Step 4 - Pass the API Credential Sid in your Access Token

This step is to ensure that your Conversations JS SDK client [Access Token](/docs/iam/access-tokens#token-anatomy) includes the correct `credential_sid` - the one you created in Step 3 above. Each of the Twilio server-side SDKs enables you to add the `push_credential_sid`. You can see the relevant documentation for your preferred server-side SDK for the details. Here is an example using the Node.js Twilio SDK:

```javascript
const chatGrant = new ChatGrant({ 
 serviceSid: ConversationServiceSid, 
 pushCredentialSid: FCM_Credential_Sid 
});

```

## Step 5 - Initialize Firebase in your web app

Now it's time to initialize the Firebase with the sample code from Step 2 above.

In your web app's early initialization sequence, use the sample code (and do not forget to include/import the Firebase library provided by Google). We recommend including an additional check for the correct import of the Firebase libraries.

```javascript
  // Initialize Firebase
  var config = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  };
  if (firebase) {
    firebase.initializeApp(config);
  }
```

## Step 6 - Request push permissions from the user and get your FCM token

In this step, we are requesting permission from the user to subscribe to and to display notifications. We recommend adding checks for the correct initialization of Firebase.

```javascript
 if (firebase && firebase.messaging()) {
      // requesting permission to use push notifications
      firebase.messaging().requestPermission().then(() => {
        // getting FCM token
        firebase.messaging().getToken().then((fcmToken) => {
          // continue with Step 7 here 
          // ... 
          // ... 
        }).catch((err) => {
          // can't get token
        });
      }).catch((err) => {
        // can't request permission or permission hasn't been granted to the web app by the user
      });
    } else {
      // no Firebase library imported or Firebase library wasn't correctly initialized
    }
```

## Step 7 - Pass the FCM token to the Conversations JS SDK and register an event listener for new push arrival

If you got to this step, then you have Firebase correctly configured and an FCM token ready to be registered with Conversations SDK.

This step assumes that you have Conversation's Client created with the correct Access Token from Step 4.

```javascript
// passing FCM token to the `conversationClientInstance` to register for push notifications
conversationClientInstance.setPushRegistrationId('fcm', fcmToken);

// registering event listener on new message from Firebase to pass it to the Conversations SDK for parsing
firebase.messaging().onMessage(payload => {
    conversationClientInstance.handlePushNotification(payload);
});
```

=============

# A2P 10DLC Registration in Conversations

In this guide, you will find answers to common questions about A2P 10DLC and how it relates to Twilio Conversations in the U.S.

Note that this regulation applies **only** to messaging sent from 10DLC numbers to receiving numbers in the U.S. 10DLC format means a 'local' number such as (415) 123-4567, which is a format found only in the United States and Canada. 10DLC **excludes Toll-Free** numbers, which are subject to [a different set of regulations](https://help.twilio.com/hc/en-us/articles/5377174717595-Toll-Free-Message-Verification-for-US-Canada), as well as **short-code** SMS numbers.

[A2P has no impact on WhatsApp](https://help.twilio.com/hc/en-us/articles/1260800720410-What-is-A2P-10DLC-#h_01EX7H0TSED3KV7ZQJ0DJS63M3) or any other Messaging channel, so those channels don't require A2P registration.

## What is A2P 10DLC?

U.S. Application-to-Person 10-digit long code (A2P 10DLC) messaging is the latest offering from U.S. carriers to help support the growing ecosystem of businesses texting their customers while protecting end users from unwanted messages. 10-digit long codes have traditionally been designed for Person-to-Person (P2P) traffic only, causing businesses to be constrained by limited throughput and heightened filtering.

**The launch and support of A2P 10DLC across all carriers in the United States provides good actors with increased deliverability and throughput, but also requires additional registration to build trust with carriers**. There are associated fees with this registration process and also per-message carrier fees.

The major U.S. carriers, acting through an entity called The Campaign Registry (TCR), have formalized regulations to make explicit throughput allowances, and to reduce filtering rates in exchange for pre-registration and compliance by customers.

Please see this [A2P 10DLC Registration overview document](/docs/messaging/compliance/a2p-10dlc), which contains links to specific registration procedures based on your customer type or use case.

As a Twilio Conversations user, A2P 10DLC applies to you if you are sending Conversations messages from a 10DLC phone number to a U.S. cell phone number.

Is Conversations traffic subject to A2P governance?

Yes! As of September 1, 2023, any A2P messaging traffic to U.S. recipients using Twilio 10DLC numbers that has not been appropriately registered will be blocked.

### I think I'm a "small" use-case that doesn't need to register. Would carriers agree?

**No they would not**. All SMS messages sent from a Twilio 10DLC number to US cell phone numbers are subject to the A2P regulations, regardless of volume. However, The Campaign Registry had defined different registration tiers or Brand types based on volume: **Sole Proprietor Brand**, **Low-Volume Standard Brand** and **Standard Brand**. See our [Overview](/docs/messaging/compliance/a2p-10dlc#determine-your-customer-type) for details on these three tiers/brand types.

How do I map my Conversations to A2P Campaigns?

For A2P registration, you will register a **Brand** (Sole Proprietor, LVS or Standard) and then one or more **Campaigns** for that Brand, where each Campaign is defined around a single use case, and is associated with a single **Messaging Service**.

Add any 10DLC numbers from your Conversations implementation to the A2P Campaign's Messaging Service. This can be done before or after the Brand and Campaign are submitted for approval by TCR. Again, see the [overview document](/docs/messaging/compliance/a2p-10dlc) for detailed walkthroughs of this registration process.

Once the Brand and Campaign have been approved, all 10DLC phone numbers in that Messaging Service are considered registered for A2P with The Campaign Registry. At this point the relevant carriers (such as T-Mobile) will be notified to add such numbers to their A2P whitelist; this process can take a few more days but does not require any further customer action (use the Console tool [documented here](/docs/messaging/compliance/a2p-10dlc/troubleshooting-a2p-brands#troubleshoot-campaign-phone-number-registration-issues) to check the current status of your phone numbers).

Once the individual numbers in the Campaign's Messaging Service have been registered with the carriers, the new A2P Campaign is ready for use. For each outbound message, the A2P Campaign is selected based on your Twilio Number's Sender Pool membership. Newly created conversations will be assigned to the default Messaging Service configured in your project, as well as any auto-created conversations.


===============

# Reachability Indicator

Your Conversations applications can display a chat user's online or offline status to other users of the application. This feature is called the Reachability Indicator, and the Conversations service automatically manages the online or offline state for each user if it is activated.

This feature also provides the User's reachability by Push Notification within the Conversations Service instance.

The reachability state is automatically updated and synchronized by the Conversations service, provided the feature is enabled. The feature is enabled on a "per Service instance" basis.

**Note:** It is important to note that Users exist within the scope of a Conversations Service instance. Thus, the Reachability indicators are also within the same scope.

## Enable the Reachability Indicator

Each Service instance can have Reachability enabled or disabled. The default is **disabled**. The reachability state will not be updated if the feature is disabled for a given Service instance. Once enabled, the state will update and synchronize.

You must set the `ReachabilityEnabled` property using the `Service Configuration` [REST resource](/docs/conversations/api/service-configuration-resource) to configure the Reachability Indicator feature.

Enable the Reachability Indicator

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function updateServiceConfiguration() {
  const configuration = await client.conversations.v1
    .services("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .configuration()
    .update({ reachabilityEnabled: true });

  console.log(configuration.chatServiceSid);
}

updateServiceConfiguration();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

service_configuration = (
    client.conversations.v1.services("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .configuration()
    .update(reachability_enabled=True)
)

print(service_configuration.chat_service_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Service;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var configuration = await ConfigurationResource.UpdateAsync(
            reachabilityEnabled: true, pathChatServiceSid: "ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

        Console.WriteLine(configuration.ChatServiceSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.service.Configuration;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Configuration configuration =
            Configuration.updater("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX").setReachabilityEnabled(true).update();

        System.out.println(configuration.getChatServiceSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.UpdateServiceConfigurationParams{}
	params.SetReachabilityEnabled(true)

	resp, err := client.ConversationsV1.UpdateServiceConfiguration("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.ChatServiceSid != nil {
			fmt.Println(*resp.ChatServiceSid)
		} else {
			fmt.Println(resp.ChatServiceSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$service_configuration = $twilio->conversations->v1
    ->services("ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    ->configuration()
    ->update(["reachabilityEnabled" => true]);

print $service_configuration->chatServiceSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

configuration = @client
                .conversations
                .v1
                .services('ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
                .configuration
                .update(reachability_enabled: true)

puts configuration.chat_service_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:services:configuration:update \
   --chat-service-sid ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
   --reachability-enabled
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Services/ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Configuration" \
--data-urlencode "ReachabilityEnabled=true" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "chat_service_sid": "ISXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "default_conversation_creator_role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "default_conversation_role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "default_chat_service_role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "reachability_enabled": true,
  "url": "https://conversations.twilio.com/v1/Services/ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Configuration",
  "links": {
    "notifications": "https://conversations.twilio.com/v1/Services/ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Configuration/Notifications",
    "webhooks": "https://conversations.twilio.com/v1/Services/ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Configuration/Webhooks"
  }
}
```

If you choose to enable Reachability Indicators and later wish to return to `disabled`, set the `ReachabilityEnabled` property back to `false.`

## User Reachability Properties

The Reachability indicators are exposed for Users in two places:

* REST API - [Users resource](/docs/conversations/api/user-resource)
* Client SDKs - User objects

### REST API

The following *read-only* properties within the [Users REST resource](/docs/conversations/api/user-resource#user-properties) provide Reachability information for Users:

* `is_online`
* `is_notifiable`

These properties are set by the Conversations system if the Reachability Indicator feature is enabled for a User's [Service](/docs/conversations/fundamentals#conversation-services-and-messaging-services-in-conversations) instance.

**Note:** These properties can be `null` under the following conditions:

* The Reachability Indicator feature is *disabled* for the Service Instance
* The User has not been online since the Reachability indicator has been *enabled*
* `LIST GET` resource representations only have a `true` or `false` value for specific `GET` requests

Please see the REST [Users resource](/docs/conversations/api/user-resource) documentation for more information.

### Client SDKs

Within the Conversations Client SDKs, the Reachability Indicator properties are exposed in the `User` objects.

Real-time updates to other Users' Reachability Indicator states are communicated via the `update` event mechanism for subscribed User objects. Please see the specific SDK API documentation for details, as each SDK/platform handles this `update` a little differently.

An indicator of your Service instance's Reachability status (`reachability_enabled` ) is also exposed at the SDK client level.

The *read only* client SDK properties exposed are:

* `ConversationsClient.reachabilityEnabled`
* `User.isOnline`
* `User.isNotifiable`

**Note:** The above are representations. The specifics of how these properties are accessed are distinct for each language/SDK.

**Note:** These user properties are `read only` and cannot be set. Conversations will update these settings and synchronize them as necessary. The Service Configuration REST resource manages the Service-level Reachability feature from the back-end code.

```js title="Handle Reachability updates" description="Handle an UpdateReason change and process the Reachability Indicators"
// function called after client init to set up event handlers
function registerEventHandlers() {
  user = conversationsClient.user;
  // Register User updated event handler
  user.on('updated', function(event) {
    handleUserUpdate(event.user, event.updateReasons)
  });
}

// function to handle User updates
function handleUserUpdate(user, updateReasons) {
  // loop over each reason and check for reachability change
  updateReasons.forEach(function(reason) {
    if (reason == 'online') {
      //do something
    }
  });
}
```

=================

# Send Rich Content Messages with Conversations

## Overview

In this tutorial, you will learn how to send rich messages to WhatsApp using Conversations and the [Content Template Builder](/docs/content). The Content Template Builder lets users build rich content templates programmatically through an API or with no code in a graphical user interface in the console. "Rich content" or "Rich messaging" refers to messages with additional visual or interactive elements such as buttons or selectable lists.

### The Content Template Builder

With Twilio's [Content Template Builder](/docs/content), you can create message templates to send over any Twilio-supported messaging channel. It supports text and media as well as richer content types like location, quick-replies, and list-pickers. The templates also support variables, so you can leverage the same content across multiple conversations while personalizing each message.

Below is an overview of the content types currently supported by Conversations. See the individual content type documentation for additional details about each type's parameters and input requirements.

| **Content Type**                                             | **Data parameter**    | **Type**           | **Description**                                                                                                                                                                                                 |
| ------------------------------------------------------------ | --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [twilio/text](/docs/content/twilio-text)                     | body \[required]      | string             | The text of the message you want to send. Maximum 1,600 characters.                                                                                                                                             |
| [twilio/media](/docs/content/twilio-media)                   | body \[required]      | string             | The text of the message you want to send. Maximum 1,600 characters.                                                                                                                                             |
|                                                              | media \[optional]     | string\[]          | The URL of the media you want to send. - The URL must resolve to a publicly accessible media file. - The media URL must contain a [valid file type](/docs/content/content-types-overview#supported-mime-types). |
| [twilio/location](/docs/content/twilio-location)             | longitude \[required] | numbers            | The longitude value of the location pin you want to send.                                                                                                                                                       |
|                                                              | latitude \[required]  | numbers            | The latitude value of the location pin you want to send.                                                                                                                                                        |
|                                                              | label \[optional]     | string             | Label to be displayed alongside the location pin.                                                                                                                                                               |
| [twilio/quick-reply](/docs/content/twilio-quick-reply)       | body \[required]      | string             | The text of the message you want to send. Maximum 1,024 characters.                                                                                                                                             |
|                                                              | actions \[required]   | array\[actions]    | Predefined buttons that a customer could use as the response. It needs the "type", "title", and "id" fields.                                                                                                    |
| [twilio/call-to-action](/docs/content/twilio-call-to-action) | body \[required]      | string             | The text of the message you want to send. Maximum 640 characters.                                                                                                                                               |
|                                                              | actions \[required]   | array\[actions]    | Buttons that recipients can tap to act on the message. It requires the "type" and "title" actions.                                                                                                              |
| [twilio/list-picker](/docs/content/twiliolist-picker)        | body \[required]      | string             | The text of the message you want to send. Maximum 1,024 characters.                                                                                                                                             |
|                                                              | button \[required]    | string             | Display value for the primary button.                                                                                                                                                                           |
|                                                              | items \[required]     | array\[list items] | Array of list item objects.                                                                                                                                                                                     |
| [twilio/card](/docs/content/twiliocard)                      | title \[required]     | string             | Title of the card. Maximum 1,024 characters.                                                                                                                                                                    |
|                                                              | subtitle \[optional]  | string             | Subtitle of the card. Maximum 60 characters.                                                                                                                                                                    |
|                                                              | media \[optional]     | string\[]          | The URL of the media to send with the message.                                                                                                                                                                  |
|                                                              | actions \[optional]   | array\[actions]    | Buttons that recipients can tap on to act on the message.                                                                                                                                                       |

## Step 1: Create Content Template via Content API

> \[!NOTE]
>
> The Content Template Builder supports an unlimited number of templates,
> however, WhatsApp limits users to 6000 approved templates across all
> languages.

To send a rich message, you'll first need to [create a content template](/docs/content/content-api-resources#create-templates) using the [Content Template Builder](/docs/content).

In the following example, we'll use the ["quick-reply" template](/docs/content/twilio-quick-reply), which allows the recipient to respond by clicking on one of the options that you pre-define in the template. To see how the template layout looks, go to [Step 4](#step-4-send-a-rich-message-via-the-conversations-api).

After creating your template, take note of the ContentSid `(HXXXXXX)` found in the response as we'll be using that SID throughout this tutorial.

### POST API

Request:

```bash
curl -X POST 'https://content.twilio.com/v1/Content' \
-H 'Content-Type: application/json' \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN \
-d '{
    "friendly_name": "flight_replies",
    "language": "en",
    "variables": {"1":"name"},
    "types": {
        "twilio/quick-reply": {
                    "body": "Hi, {{ 1 }}. \n Thanks for contacting Owl Air Support. How can I help?",
                    "actions": [
                        {
                            "title": "Check flight status",
                            "id": "flightid1"
                        },
                        {
                            "title": "Check gate number",
                            "id": "gateid1"
                        },
                        {
                            "title": "Speak with an agent",
                            "id": "agentid1"
                        }
                    ]
                },
        "twilio/text": {
            "body": "Hi, {{ 1 }}. \n Thanks for contacting Owl Air Support. How can I help?."
        }
    }
}'

```

Response:

```json
{
  "language": "en",
  "date_updated": "2022-08-29T10:43:20Z",
  "variables": {
    "1": "name"
  },
  "friendly_name": "flight_replies",
  "account_sid": "ACXXXXXXXXXXXXXXXXXXX",
  "url": "https://content.twilio.com/v1/Content/HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "sid": "HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "date_created": "2022-08-29T10:43:20Z",
  "types": {
    "twilio/text": {
      "body": "Hi, {{ 1 }}. \n Thanks for contacting Owl Air Support. How can I help?."
    },
    "twilio/quick-reply": {
      "body": "Hi, {{ 1 }}. \n Thanks for contacting Owl Air Support. How can I help?",
      "actions": [
        {
          "id": "flightid1",
          "title": "Check flight status"
        },
        {
          "id": "gateid1",
          "title": "Check gate number"
        },
        {
          "id": "agentid1",
          "title": "Speak with an agent"
        }
      ]
    }
  },
  "links": {
    "approval_fetch": "https://content.twilio.com/v1/Content/HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/ApprovalRequests",
    "approval_create": "https://content.twilio.com/v1/Content/HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/ApprovalRequests/whatsapp"
  }
}
```

### Optional: Retrieve a Content Template SID from the Content Template Builder

You can make a `GET` request to the Content API to fetch a list of all the content templates that you have created.

#### GET API

Request:

```bash
curl -X GET "https://content.twilio.com/v1/Content?PageSize=2" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

Response:

```json
{
  "meta": {
    "page": 0,
    "page_size": 2,
    "first_page_url": "https://content.twilio.com/v1/Content?PageSize=2&Page=0",
    "previous_page_url": null,
    "url": "https://content.twilio.com/v1/Content?PageSize=2&Page=0",
    "next_page_url": "https://content.twilio.com/v1/Content?PageSize=2&Page=1&PageToken=PAHXXXXXXXXXXXX",
    "key": "contents"
  },
  "contents": [
    {
      "language": "en",
      "date_updated": "2023-03-07T14:46:13Z",
      "variables": {
        "1": "flight_number",
        "3": "departure_time",
        "2": "arrival_city",
        "5": "url_suffix",
        "4": "gate_number"
      },
      "friendly_name": "flight_departure_update",
      "account_sid": "ACXXXXXXXXXX",
      "url": "https://content.twilio.com/v1/Content/HXXXXXXXXXXXXX",
      "sid": "HXXXXXXXXXXXX",
      "date_created": "2023-03-07T14:46:13Z",
      "types": {
        "twilio/call-to-action": {
          "body": "Owl Air: We will see you soon! Flight {{ 1 }} to {{ 2 }} departs at {{ 3 }} from Gate {{ 4 }}.",
          "actions": [
            {
              "url": "https://owlair.com/{{ 5 }}",
              "type": "URL",
              "title": "Check Flight Status"
            },
            {
              "phone": "+18005551234",
              "type": "PHONE_NUMBER",
              "title": "Call Support"
            }
          ]
        }
      },
      "links": {
        "approval_fetch": "https://content.twilio.com/v1/Content/HXXXXXXXXXXXX/ApprovalRequests",
        "approval_create": "https://content.twilio.com/v1/Content/HXXXXXXXXXXX/ApprovalRequests/whatsapp"
      }
    },
    {
      "language": "en",
      "date_updated": "2023-02-24T14:25:37Z",
      "variables": {
        "1": "name"
      },
      "friendly_name": "flight_replies",
      "account_sid": "ACXXXXXXXXXX",
      "url": "https://content.twilio.com/v1/Content/HXXXXXXXXXX",
      "sid": "HXXXXXXXXXXX",
      "date_created": "2023-02-24T14:25:37Z",
      "types": {
        "twilio/text": {
          "body": "Hi, {{ 1 }}. \n Thanks for contacting Owl Air Support. How can I help?."
        },
        "twilio/quick-reply": {
          "body": "Hi, {{ 1 }}. \n Thanks for contacting Owl Air Support. How can I help?",
          "actions": [
            {
              "id": "flightid1",
              "title": "Check flight status"
            },
            {
              "id": "gateid1",
              "title": "Check gate number"
            },
            {
              "id": "agentid1",
              "title": "Speak with an agent"
            }
          ]
        }
      },
      "links": {
        "approval_fetch": "https://content.twilio.com/v1/Content/HXXXXXXXXXXX/ApprovalRequests",
        "approval_create": "https://content.twilio.com/v1/Content/HXXXXXXXXXXX/ApprovalRequests/whatsapp"
      }
    }
  ]
}
```

## Step 2: Create a Conversation

Now, let's create a [Conversation](/docs/conversations/api/conversation-resource) that we'll use in the next step to send a rich content message. In the sample code below, replace the Account SID and Auth Token with the values from your Twilio Console. Copy down the Conversation SID (It starts with `CHXXXXX`). We'll be using this value in the next step when we add a WhatsApp participant to the Conversation you just created.

### POST API

Request:

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations" \
--data-urlencode "FriendlyName=Send Rich content messages with Conversations" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

Response:

```json
{
  "unique_name": null,
  "date_updated": "2023-02-13T12:31:50Z",
  "friendly_name": "Send rich content messages with Conversations",
  "timers": {},
  "account_sid": "ACXXXXXXXXXXXXX",
  "url": "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXX",
  "state": "active",
  "date_created": "2023-02-13T12:31:50Z",
  "messaging_service_sid": "MGXXXXXXXXXXXX",
  "sid": "CHXXXXXXXXXXXXX",
  "attributes": "{}",
  "bindings": null,
  "chat_service_sid": "ISXXXXXXXXXX",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXX/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXX/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXX/Webhooks"
  }
}
```

## Step 3: Add a WhatsApp Participant to the Conversation

Let's add a WhatsApp Participant to the Conversation. For the code sample below, replace the placeholder values for:

* `CHXXXXXXX`: use the Conversation SID you just copied
* `YOUR_WHATSAPP_NUMBER`: your WhatsApp phone number, in [E.164 format](/docs/glossary/what-e164)
* `TWI_WA_NUMBER`: Your Twilio enabled WhatsApp phone number, in [E.164 format](/docs/glossary/what-e164)
* `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
* `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token

### POST API

Request:

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Participants" \
--data-urlencode "MessagingBinding.Address=whatsapp:YOUR_WHATSAPP_NUMBER" \
--data-urlencode "MessagingBinding.ProxyAddress=whatsapp:TWI_WA_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

Response:

```json
{
  "last_read_message_index": null,
  "date_updated": "2023-02-17T16:45:32Z",
  "last_read_timestamp": null,
  "conversation_sid": "CHXXXXXXXXX",
  "account_sid": "ACXXXXXXXXXX",
  "url": "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXX/Participants/MBXXXXXXXXX",
  "date_created": "2023-02-17T16:45:32Z",
  "role_sid": "RLXXXXXXXXXX",
  "sid": "MBXXXXXXXXXXX",
  "attributes": "{}",
  "identity": null,
  "messaging_binding": {
    "proxy_address": "whatsapp:TWI_WA_NUMBER",
    "type": "whatsapp",
    "address": "whatsapp:YOUR_WHATSAPP_NUMBER"
  }
}
```

## Step 4: Send a Rich Message via the Conversations API

> \[!NOTE]
>
> If the customer representative wants to send rich content messages prior to
> the end user messaging them on WhatsApp, then this content template will need
> to be approved before it can be sent out. Some [content
> types](/docs/content/content-types-overview#whatsapp-approval-requirements)
> (e.g., Cards and CTA buttons) require prior approval regardless of whether the
> template is sent in the context of a session or not.

So far you've created a content template, and a Conversation with a WhatsApp participant. Now we're ready to send a rich message to the participant. This example uses the Conversations API, but content templates are also available through the [Conversations SDKs for JavaScript, Android, and iOS.](/docs/conversations/sdk-download-install)

In our `POST` request example, you'll pass the [ContentVariables parameter](/docs/content/using-variables-with-content-api) (optional), which allows you to customize the message content with dynamic values. For this example, "name" will be replaced with the value ("Alice").

Replace:

* `CHXXXXXXXXXXXXXXXXXXX` with the Conversation SID in the request URL
* `HXXXXXXXXXXXXXXXXXXXX` value in the Content SID parameter

Request parameters:

| **Parameter**    | **Required** | **Description**                                                                                                                                                             |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ContentSid       | Yes          | The unique ID of the multi-channel Content template, required for template-generated message. Note that if this field is set, the Body and MediaSid parameters are ignored. |
| ContentVariables | Optional     | A structurally valid JSON string that contains values to determine Content template variables.                                                                              |

### POST API

Request:

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXXXXXXXXX/Messages" \
--data-urlencode 'ContentSid=HXXXXXXXXXXXXXXXXXXXX' \
--data-urlencode 'ContentVariables={ "1": "Alice" }' \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN

```

Response:

```json
{
  "body": "Hi, Alice. \n Thanks for contacting Owl Air Support. How can I help?",
  "index": 0,
  "author": "system",
  "date_updated": "2023-02-09T17:44:30Z",
  "media": null,
  "participant_sid": null,
  "conversation_sid": "CHXXXXXXXXXXXXXXXXXXX",
  "account_sid": "ACXXXXXXXXXXXXXXXXXXX",
  "delivery": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXXXXXXXXX0/Messages/IMXXXXXXXXXXXXXXXXXXX",
  "date_created": "2023-02-09T17:44:30Z",
  "content_sid": "HXXXXXXXXXXXXXXXXXXXX",
  "sid": "IMXXXXXXXXXXXXXXXXXXX",
  "attributes": "{}",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHXXXXXXXXXXXXXXXXXXX/Messages/IMXXXXXXXXXXXXXXXXXXX/Receipts"
  }
}
```

![WhatsApp chat with Owl Air offering options to check flight status, gate number, or speak with an agent.](https://docs-resources.prod.twilio.com/8047361b11a80a1e251d4594f0b6471c66634d6f2324379e72f4bdac955c60bf.jpg)

Well done! You've successfully sent your first rich content message to your WhatsApp Participant using Twilio Conversations.

## What's Next?

As a following step, you can:

* Check out our [Conversations Quickstart](/docs/conversations/quickstart)
* Learn more about the [Content Template Builder](/docs/content)

=============

