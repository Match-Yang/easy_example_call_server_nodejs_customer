#!/bin/bash
if [ $# != 2 ]
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
    yarn install
    ZEGO_APP_ID=$1 ZEGO_SERVER_SECRET=$2 node index.js 
fi
