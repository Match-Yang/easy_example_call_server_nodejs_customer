# EasyExample Call Server - NodeJS

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ZEGOCLOUD/easy_example_call_server_nodejs)

This repository is use for deploy a backend service for obtain ZEGO auth token and sending FCM messages to device as call invitation.

For now, we use it for the project as shown below:
- [easy_example_flutter](https://github.com/ZEGOCLOUD/easy_example_flutter)
- [easy_example_react_native](https://github.com/ZEGOCLOUD/easy_example_react_native)
- [easy_example_web](https://github.com/ZEGOCLOUD/easy_example_web)
- [easy_example_android](https://github.com/ZEGOCLOUD/easy_example_android)
- [easy_example_ios](https://github.com/ZEGOCLOUD/easy_example_ios)

## Getting started

### Create ZEGOCLOUD project

Create project on [ZEGOCLOUD Console](https://console.zegocloud.com), then get the required info as shown below:

- Get your AppID from ZEGOCLOUD Console [My Projects](https://console.zegocloud.com/project)

- Get your ServerSecret from ZEGOCLOUD Console [My Projects -> project's Edit -> Basic Configurations](https://console.zegocloud.com/project)

### Create Firebase project

We use [Firebase FCM](https://firebase.google.com/docs/cloud-messaging) for notification service.

1. Go to [Firebase Console](https://console.firebase.google.com/) and create new project if you don't have one.

2. Generate `Firebase Admin SDK Private Key`

![Generate Key](docs/images/fcm_admin_sdk_key.gif)

### Deploy service

1. Click this deploy button at the top of this page to start deploy your service.
![](docs/images/deploy_to_heroku.jpg)
2. Pick your Heroku app-name and fill in the input box.
3. Open the `Firebase Admin SDK Private Key` you just obtain at the above step, and fill in the content to the `Config Vars` parameter input box.
4. Press `Deploy App` button, wait for the depoly process completed.
5. Once done you will get an url for your instance, try accessing `https://<heroku url>/access_token?uid=1234` to check if it works.

## Note

Token valid in 3600 seconds by default. If you want to change the expired time, request with the `expired_ts` parameter. e.g. `https://<heroku url>/access_token?uid=1234&expired_ts=7200`

## About us

https://www.zegocloud.com/

## License
The MIT License (MIT).
