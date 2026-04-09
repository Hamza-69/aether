#!/bin/bash
set -e

PASS=$1

if [ -z "$PASS" ]; then
  echo "Usage: ./build.sh <keystore_password>"
  exit 1
fi

npx expo prebuild --platform android --clean

# Move keystore
mv my-upload-key.keystore android/app/my-upload-key.keystore

# Append signing vars and arch constraints (JVM args already in /root/.gradle/gradle.properties)
cat >> android/gradle.properties <<EOF
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=${PASS}
MYAPP_UPLOAD_KEY_PASSWORD=${PASS}
reactNativeArchitectures=arm64-v8a,x86_64
EOF

# Patch signing config in build.gradle
python3 - <<PYEOF
with open('android/app/build.gradle', 'r') as f:
    content = f.read()

old = '''    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
        }
    }'''

new = '''    signingConfigs {
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            shrinkResources false
        }
    }'''

if old not in content:
    print("ERROR: Could not find signing config block in build.gradle")
    exit(1)

content = content.replace(old, new)

with open('android/app/build.gradle', 'w') as f:
    f.write(content)

print("build.gradle updated successfully")
PYEOF

# Build — daemon disabled globally, parallel + build-cache on to hit the warmed cache
cd android
./gradlew assembleRelease --no-daemon --parallel --build-cache