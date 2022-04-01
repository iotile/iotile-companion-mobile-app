#!/bin/bash
export_version() {
    # Extract version number from config.xml and append build number
    export IOTILEMBASEVERSION=`grep -oP 'version="\K([0-9]+\.[0-9]+\.[0-9]+)' ./config.xml | tr -d '\n'`
    export IOTILEBUILD=`git rev-list --count HEAD | tr -d '\n'`
    export IOTILEMVERSION=${IOTILEMBASEVERSION}.${IOTILEBUILD}
}

run_ios() {
    npm run build
    cordova run ios
}

build_ios() {
    npm run build
    cordova build ios --release
}

prepare_ios() {
    npm run build
    cordova prepare ios --release
}

build_android() {
    npm run build-android
}

clean_build_android() {
    # By default CodeShip does a shallow clone, so our rev-list will be incomplete
    # We need to do a full fetch but our ssh key needs to be updated first
    # Our deploy key is stored securely on s3
    mkdir -p ~/.ssh
    aws s3 cp ${ANDROID_S3_DEPLOY_KEY_PATH} ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa

    ssh-keyscan github.com >> ~/.ssh/known_hosts
    if [ -f .git/shallow ]; then git fetch --unshallow; fi

    npm run build

    cordova platform add android
    cordova build --release android
    cordova build --debug android
}

upload_android() {
    # upload release and debug apks to s3 (must be run from CodeShip CI or equivalent docker)
    set -e

    export_version

    APK_RELEASE_S3_KEY=${CI_BRANCH}/${IOTILEMBASEVERSION}/${IOTILEBUILD}/'android-release-unsigned.apk'
    APK_SIGNED_S3_KEY=${CI_BRANCH}/${IOTILEMBASEVERSION}/${IOTILEBUILD}/'android-release-signed.apk'
    APK_DEBUG_S3_KEY=${CI_BRANCH}/${IOTILEMBASEVERSION}/${IOTILEBUILD}/'android-debug.apk'

    # Retrieve our signing key and sign the release apk
    aws s3 cp ${ANDROID_S3_KEY_PATH} android-signing-key.keystore
    cp platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk android-release-unaligned.apk
    jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -storepass ${ANDROID_S3_KEY_PASSWORD} -keystore android-signing-key.keystore android-release-unaligned.apk arch_iotile
    ${ANDROID_HOME}/build-tools/25.0.3/zipalign -v 4 android-release-unaligned.apk android-release-aligned.apk
    rm android-signing-key.keystore

    aws s3 cp platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk ${AWS_S3_UPLOAD_PATH}/${APK_RELEASE_S3_KEY}
    aws s3 cp android-release-aligned.apk ${AWS_S3_UPLOAD_PATH}/${APK_SIGNED_S3_KEY}
    aws s3 cp platforms/android/app/build/outputs/apk/debug/app-debug.apk ${AWS_S3_UPLOAD_PATH}/${APK_DEBUG_S3_KEY}
}

sign_android() {
    # http://ionicframework.com/docs/guide/publishing.html
    echo 'Signing APK File:'
    export_version
    echo release/android-releases-${IOTILEMVERSION}.apk
    cp platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk releases/android-release-unaligned-${IOTILEMVERSION}.apk
    jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore my-release-key.keystore releases/android-release-unaligned-${IOTILEMVERSION}.apk arch_iotile
    zipalign -v 4 releases/android-release-unaligned-${IOTILEMVERSION}.apk releases/android-release-${IOTILEMVERSION}.apk
    rm releases/android-release-unaligned-${IOTILEMVERSION}.apk
}

watch_production() {
    npm run watch
}

watch_stage() {
    npm run watch -- --env stage
}

alias runios=run_ios
alias runandroid=run_android
alias buildios=build_ios
alias mockios=build_mock_ios
alias buildandroid=build_android
alias watchp=watch_production
alias watchs=watch_stage
alias watchd=watch_local
alias signandroid=sign_android
alias mockandroid=mock_android
