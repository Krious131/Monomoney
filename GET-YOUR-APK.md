# Get your Monopoly Banker APK (no installs required)

This project is fully converted and ready to build. Your computer can't
compile Android apps without the Android SDK and internet access, so
instead this repo builds the APK for you automatically in the cloud,
for free, using GitHub Actions.

## Steps (about 5 minutes, one time)

1. Go to https://github.com/new, create a free account if you don't have
   one, and create a new **public or private** repository (any name).
2. On the new repo's page, click **"uploading an existing file"** and
   drag in every file/folder from this project (including the hidden
   `.github` folder — if your browser hides it, use
   `git init && git add . && git commit -m "init" && git push` instead
   from a terminal, or the GitHub Desktop app).
3. Click the **Actions** tab in your repo. A workflow called
   **"Build Monopoly Banker APK"** will already be running (it starts
   automatically on the first push). Wait for the green checkmark
   (3-6 minutes).
4. Click into the finished run, scroll to **Artifacts**, and download
   **Monopoly-Banker-APK**. Unzip it — that's your `app-debug.apk`.
5. Send that APK to your Android phone (email, Drive, USB, etc.), open
   it, allow "install from this source" if asked, and install.

You now have a real, installable Monopoly Banker Android app that runs
fully offline.
