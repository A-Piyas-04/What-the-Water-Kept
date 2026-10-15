#!/usr/bin/env bash
# Touch-driven playthrough of the RELEASE APK on an emulator, in airplane
# mode, with no debug hooks: only real taps and drags, as a player would.
set -u
ADB=/home/amt/.local/opt/android-sdk/platform-tools/adb
PKG=com.corranmill.whatthewaterkept
OUT=artifacts/android
export PATH=/home/amt/.local/opt/node/bin:$PATH
pause(){ timeout 60 bash -c "sleep $1"; }
shot(){ # $1 = name. Uses the emulator's own recorder (screencap misses WebView layers).
  $ADB emu screenrecord start /tmp/dp.webm >/dev/null 2>&1; pause 3; $ADB emu screenrecord stop >/dev/null 2>&1; pause 1
  node tools/webm-frame.mjs /tmp/dp.webm /tmp/dp.png 2 >/dev/null 2>&1
  python3 -I -c "
from PIL import Image
im=Image.open('/tmp/dp.png').convert('RGB').rotate(90,expand=True); im.save('$OUT/$1.png')
w,h=im.size; c=set()
for y in range(0,h,6):
  for x in range(150,w,6): c.add(im.getpixel((x,y)))
print('$1: distinct colours', len(c))"; }

$ADB wait-for-device
until [ "$($ADB shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do pause 3; done
echo "booted"
$ADB shell cmd connectivity airplane-mode enable >/dev/null 2>&1
echo "airplane_mode_on=$($ADB shell settings get global airplane_mode_on | tr -d '\r')"
$ADB uninstall $PKG >/dev/null 2>&1
echo "install: $($ADB install release/what-the-water-kept.apk | tail -1)"
echo "permissions: $($ADB shell dumpsys package $PKG | grep -c 'android.permission.INTERNET') INTERNET grants"
$ADB logcat -c
$ADB shell am start -n $PKG/.MainActivity >/dev/null; pause 9
shot 30-title
$ADB shell input tap 1239 685; pause 4                    # Begin
shot 31-opening
for i in 1 2 3 4 5; do $ADB shell input tap 1240 500; pause 1.3; done
pause 3
shot 32-shore
$ADB shell input swipe 500 700 790 700 6000                # stick right: run
pause 1
shot 33-after-run
$ADB shell input tap 2196 872; pause 2                     # lantern
for i in 1 2 3; do $ADB shell input tap 1240 500; pause 1.3; done
shot 34-lantern
# Hardware Back during play must pause, not exit.
$ADB shell input keyevent KEYCODE_BACK; pause 2
echo "after Back, focused: $($ADB shell dumpsys window | grep -o 'mCurrentFocus=[^ ]* [^ ]* [^}]*' | grep -c whatthewaterkept) (1 = still in the game)"
shot 34b-back-pauses
$ADB shell input keyevent KEYCODE_BACK; pause 2              # Back again resumes
# Background and resume: the autosave and lifecycle path.
$ADB shell input keyevent KEYCODE_HOME; pause 3
$ADB shell am start -n $PKG/.MainActivity >/dev/null; pause 4
shot 35-resumed
# Kill the process outright and relaunch: Continue must be offered.
$ADB shell am force-stop $PKG; pause 2
$ADB shell am start -n $PKG/.MainActivity >/dev/null; pause 9
shot 36-relaunch-title
echo "fatal exceptions: $($ADB logcat -d | grep -c 'FATAL EXCEPTION')"
echo "DONE"
