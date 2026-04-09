#!/bin/sh
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore release.keystore \
  -alias release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$1" \
  -keypass "$2" \
  -dname "CN=$3, OU=$4, O=$5, L=$6, S=$7, C=${8}"