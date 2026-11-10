# APLEX Movies — Android App (Capacitor)

මෙම project එක ඔබ upload කළ APLEX Movies website එක Android app එකක් ලෙස install කළ හැකි APK එකක් බවට build කිරීමට සකස් කර ඇත.

## මෙහි තාක්ෂණය

- Capacitor 8 — Android native shell / WebView
- ඔබේ මුල් HTML, CSS සහ JavaScript — `www/` තුළම bundle කර ඇත
- TMDB — movie/TV metadata සහ posters
- Supabase — admin settings, themes සහ download buttons
- GitHub Actions — GitHub වෙත push කළ විට Android APK එක build කර artifact එකක් ලෙස ලබාදෙයි

**වැදගත්:** මෙය remote website URL එකක් පමණක් load කරන wrapper එකක් නොවේ. වෙබ් පිටු app එක තුළ ඇතුළත් කර ඇත. නමුත් TMDB, Supabase, images සහ player provider සඳහා internet connection අවශ්‍ය වේ. App එක offlineව සම්පූර්ණ movie catalogue එක ලබාදෙන්නේ නැත.

## 1. GitHub වෙත project එක upload කිරීම

1. GitHub account එකට sign in වෙන්න: https://github.com
2. `New repository` තෝරන්න.
3. Repository name එක `aplex-movies-android` ලෙස දෙන්න. `Private` ලෙස තැබීම සුදුසුයි.
4. `Create repository` ඔබන්න.
5. මේ ZIP එක extract කරලා, ඇතුළේ තිබෙන සියලු files සහ folders repository root එකට upload කරන්න. ZIP ගොනුව පමණක් upload කිරීම ප්‍රමාණවත් නැහැ — extract කළ files upload කරන්න.
6. `Commit changes` කරන්න. ප්‍රධාන branch එක `main` ලෙස තබන්න.

## 2. APK එක GitHub හරහා build කිරීම

1. Repository එකේ `Actions` tab එකට යන්න.
2. `Build APLEX Movies Android APK` workflow එක තෝරන්න.
3. පළමු upload/commit එකෙන් workflow එක automaticව පටන් ගනී. නැවත build කිරීමට `Run workflow` තෝරන්න.
4. Build එක අවසන් වූ විට green check mark එකක් පෙන්වයි.
5. එම workflow run එක open කර පහළ ඇති `Artifacts` කොටසෙන් `APLEX-Movies-Android-APK` download කරන්න.
6. Download වූ ZIP එක extract කර `app-debug.apk` file එක Android phone එකෙන් open කර install කරන්න. Android විසින් browser/file manager එකට “Install unknown apps” permission ඉල්ලුවොත් ඔබ විශ්වාස කරන app එකට පමණක් එය අවසර දෙන්න.

## 3. App එකේ නම සහ package ID

`capacitor.config.ts` file එකේ:

- App name: `APLEX Movies`
- Package ID: `com.aplexmovies.app`

Google Play release එකකට යාමට පෙර package ID එක ඔබට අයිති unique ID එකක් ලෙස ස්ථිර කරන්න. Play Store එකට යැවීමට release signing key එකක් සහ signed AAB එකක් අවශ්‍ය වේ; මේ workflow එක දැන් පළමු install/test කිරීම සඳහා debug APK එකක් නිපදවයි.

## 4. Website එක update කළ පසු Android app එක update කිරීම

App එකේ web files `www/` තුළ තිබෙන නිසා:

1. වෙනස් කළ HTML/CSS/JS files අදාළ `www/` folder එකේ update කරන්න.
2. GitHub වෙත commit/push කරන්න.
3. GitHub Actions අලුත් APK එක build කරයි.
4. අලුත් APK එක download කර install කරන්න.

වෙබ්සයිට් එකේ පමණක් වෙනස්කම් කරලා app APK එක rebuild නොකළොත්, app එක ඇතුළේ bundled UI එක ස්වයංක්‍රීයව වෙනස් වෙන්නේ නැහැ.

## 5. Local Android Studio build එකක් (PC එකකින්)

Node.js 22 හෝ ඊට ඉහළ, Android Studio, Android SDK සහ Java 21 සකස් කරලා project folder එකේ terminal එකෙන්:

```bash
npm install
npm run build:bridge
npx cap add android
python3 scripts/generate-android-icons.py
npx cap sync android
npx cap open android
```

Android Studio තුළ Gradle sync අවසන් වූ පසු `Build > Build Bundle(s) / APK(s) > Build APK(s)` තෝරන්න.

## 6. App bridge එකෙන් ලැබෙන පහසුකම්

- Android hardware back button එකෙන් පෙර පිටුවට යාම; open dialog එකක් තිබේ නම් එය පළමුව වසා දමයි.
- `target="_blank"` external links සඳහා Capacitor in-app browser භාවිතා කිරීම.
- APLEX dark cinema look එකට ගැළපෙන status bar style.
- Android launcher එකේ APLEX icon.
- Movie share links `https://aplexmovies.vercel.app/share/...` ලෙස නිවැරදි production site එකට යොමු වීම.

## 7. සීමාවන් සහ පරීක්ෂා කළ යුතු දේ

- Movie/TV data, Supabase, posters සහ player embeds සඳහා internet අවශ්‍ය වේ.
- Vercel `api/` functions සහ `vercel.json` Android app එක තුළ server ලෙස ක්‍රියාත්මක නොවේ. Website share-preview routes Vercel hosting තුළම පවතී; app එක share කරන්නේ ඒ production routes වෙතය.
- Android player iframe/embed provider එකේ playback permission, compatibility සහ availability මත රඳා පවතී.
- මෙම ZIP එකේ HTML/JS config තුළ browser-side Supabase public/publishable key සහ TMDB read key තිබේ. ඒවා service-role/secret keys නොවිය යුතුය. Secret/service-role key එකක් කිසිවිටෙක `www/` තුළ නොදමන්න.
- පළමු APK එක test APK එකකි. Google Play publish කිරීමට signed release AAB, privacy policy සහ store listing සකස් කිරීම වෙනම අවශ්‍ය වේ.

## Original website backend reference

`website-source/` තුළ Vercel API routes, `vercel.json`, `_redirects`, SQL setup/migrations සහ මුල් README තබා ඇත. ඒවා Vercel website backend එකට අදාලය; Android build workflow එකේදී ඒවා server-side ලෙස ධාවනය නොවේ.
