#!/bin/bash
if [ $# != 8 ]
then
    echo "Usage: $0 AppID ServerSecret"
    echo "About how to retrieve AppID ServerSecret Check README.md"
    exit
fi

if [ -z `which npm` ]; then
    echo '***************************************'
    echo "node is not found"
    echo "Download node from https://nodejs.org/dist/v4.5.0/node-v4.5.0.pkg and install it" 
    echo "Then Run this again"
    echo '***************************************'
    wget https://nodejs.org/dist/v4.5.0/node-v4.5.0.pkg && open node-v4.5.0.pkg
    exit
else
    npm install
    ZEGO_APP_ID=$1 ZEGO_SERVER_SECRET=$2 FA_PROJECT_ID=$3 FA_PRIVATE_KEY_ID=$4 FA_PRIVATE_KEY=$5 FA_CLIENT_EMAIL=$6 FA_CLIENT_ID=$7 FA_CLIENT_X509_CERT_URL=$8 node index.js 
fi
