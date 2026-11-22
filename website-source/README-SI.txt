APLEX MOVIES — Automatic Catalogue Update (සිංහල Setup Guide)
================================================================

මෙම version එකේ public movie library එක manually database එකට add කළ movies මත රඳා නොපවතී. TMDB API එකෙන් Movies සහ TV Shows ස්වයංක්‍රීයව load වෙයි. ඒ නිසා website එකේ පෙන්වන්න වෙන වෙනම movie add/publish කරන්න අවශ්‍ය නැහැ. පැරණි Supabase movie records database එකේ ඉතිරි වුණත් public catalogue එක ඒවා භාවිතා නොකරයි.

ප්‍රධාන files:
- index.html                 TMDB Movies/TV Shows, search, compact filter dialog, pagination
- movie.html                 TMDB title details, embedded player, seasons/episodes, trailer, screenshots, cast
- admin.html                 Supabase login, global seasonal theme picker සහ player Download button manager
- js/config.js               Supabase settings සහ TMDB v3 API key
- js/tmdb.js                 TMDB read API helpers — public catalogue එක Supabase එකෙන් වෙන් කර ඇත
- js/home.js                 TMDB discover/search, genre/year/language filters, actor credits, load more
- js/movie.js                Movie/TV details, EmbedMaster player URLs, YouTube trailer, images/cast
- js/downloads.js            Player page සඳහා theme-matched download buttons load කරයි
- js/admin.js                Global seasonal themes, download buttons සහ අවසර ලත් title-specific magnet links manage කරයි
- js/theme.js                APLEX opening animation සහ Supabase global theme loading
- assets/styles.css          Responsive mobile/desktop layout
- supabase-setup.sql         Fresh Supabase project setup, admin access, theme settings and download-button table
- supabase-theme-migration.sql  Existing project-க்கு global theme setting enable කරයි
- supabase-clean-ads.sql      Existing project-ல் பழைய ad table/data-ஐ நீக்கி download links மட்டும் வைத்திருக்கும் migration
- supabase-title-magnet-migration.sql  Movie/TV title ID අනුව අවසර ලත් magnet links සුරකින database migration
- supabase-title-direct-links-migration.sql  TMDB ID අනුව 480p/720p/1080p/4K direct URL links සුරකින migration
- _redirects                 Netlify clean /admin route

1. TMDB API KEY එක සකස් කිරීම
-----------------------------
1. `js/config.js` විවෘත කර `TMDB_API_KEY` අගය ඔබගේ TMDB v3 read API key එක බව තහවුරු කරන්න.
2. මෙය static website එකක් නිසා read-only API key එක browser request එකේ දැකිය හැකියි. TMDB read API key එක පමණක් භාවිතා කරන්න; account password හෝ වෙනත් secret එකක් මෙහි දාන්න එපා.

වැදගත්: TMDB catalogue එක විශාල නිසා සියලු records එකම API request එකකින් browser එකට ලබාදීම ප්‍රායෝගික නැහැ. Website එක `/discover/movie` සහ `/discover/tv` endpoints හරහා page-by-page load කරයි. TV Shows පෙරනිමියෙන් first-air date අනුව newest-first වේ. “Load more titles” click කළ විට ඊළඟ page එක ලැබේ.

2. Movies/TV Shows browser එක
-----------------------------
- Movies සහ TV Shows tabs අතර මාරු වෙන්න පුළුවන්.
- Search box එකට title එක type කර Enter (mobile keyboard Enter ඇතුළුව) ඔබන්න. Search එක submit වූ විට keyboard එක blur/hide කරයි.
- Genre/Category, Release Year සහ Original Language filters සියල්ල “Filters” button එක තුළ ඇත. ඒවා මුල් screen එක පුරා නොපෙන්වන නිසා mobile layout එක පිරිසිදුයි.
- TV Shows tab එක TMDB `/discover/tv` endpoint එක භාවිතා කරයි. වෙනම `Popular on TMDB` හෝ `New releases` tabs නැත. TV Shows සඳහා පෙරනිමි sort එක newest first (`first_air_date.desc`) වන අතර results TMDB API එකෙන් page-by-page ලබාගනී.
- TMDB API එකෙන් metadata සහ poster image ලබාගනී. Results සහ අනුපිළිවෙළ TMDB data, තෝරා ඇති sort option සහ filters අනුව වෙනස් වේ.

3. Movie / TV detail page
-------------------------
- Movie player URL: https://embedmaster.link/movie/{TMDB_ID}
- TV episode player URL: https://embedmaster.link/tv/{TMDB_ID}/{SEASON}/{EPISODE}
- TV show එකක් විවෘත කළ පසු Season සහ Episode dropdown භාවිතා කර episode තෝරන්න. Play now click කළ විට embedded player එක load වෙයි. Player එකෙන් පිටතට යන “Open player in new tab” button එක ඉවත් කර ඇත.
- TMDB videos endpoint එකේ YouTube Trailer/Teaser තිබේ නම් trailer එක ස්වයංක්‍රීයව embed වෙයි. සෑම title එකකටම trailer එකක් තිබීම සහතික නැහැ.
- TMDB image data එකේ backdrops කුඩා horizontal swipe carousel එකක පෙන්වයි. Image එක click කළාම website එක ඇතුළේ image viewer එක open වෙයි; TMDB page එකකට navigate වෙන්නේ නැහැ.
- Cast profiles සඳහා TMDB actor photos සහ character names පෙන්වයි. Cast member එකක් click කළ විට එම පුද්ගලයාගේ movie/TV credits ලැයිස්තුවට යයි.
- Share button එකෙන් mobile share menu එක විවෘත කරන්න හෝ title link එක copy කරන්න පුළුවන්.

Playback link එක external provider එකකින් ලබාදෙන නිසා එහි uptime, embedding permission, availability සහ අන්තර්ගතයට ප්‍රවේශ වීමට ඇති අයිතිය වෙනම කරුණු වේ. ඔබට access/share කිරීමට අවසර ඇති content පමණක් භාවිත කරන්න.

4. Supabase setup / Website Settings
-----------------------------------
අලුත් Supabase project එකක්:
1. https://supabase.com හි project එකක් හදන්න.
2. SQL Editor එකේ update කළ `supabase-setup.sql` සම්පූර්ණයෙන් Run කරන්න. මෙහි global seasonal theme setting table එකත් ඇතුළත්ය.
3. Authentication → Users තුළ email/password admin user එකක් create කර UID එක copy කරන්න.
4. SQL Editor එකේ `insert into public.site_admins (user_id) values ('PASTE_AUTH_USER_UID_HERE');` query එකේ UID එක replace කර Run කරන්න.
5. `js/config.js` තුළ Supabase URL, public anon/publishable key සහ TMDB API key නිවැරදිව සකස් කරන්න. Service role/secret key එක browser file එකකට දාන්න එපා.
6. SQL Editor එකේ `supabase-title-magnet-migration.sql` එකත් Run කරන්න; එවිට title-specific magnet links සඳහා table සහ security policies සකස් වෙයි.

Ad-free update: නව setup එකේ popup/banner/provider ad-code field එකක් නැත. Existing project එකක පැරණි `site_ads` table එකේ ad rows/code තිබේ නම් `supabase-clean-ads.sql` එක run කරන්න; එය normal download buttons පමණක් තබා පැරණි ad table එක ඉවත් කරයි.

දැනට තිබෙන Supabase project එකක්:
- Theme setting එකට `supabase-theme-migration.sql` එකවර Run කරන්න.
- `supabase-clean-ads.sql` එක Supabase SQL Editor එකේ Run කරන්න. මෙය පැරණි banner/popup/ad-code records ඉවත් කර, නිවැරදි download links පමණක් `site_download_buttons` table එකට මාරු කරයි.
- `site_admins` table එකේ ඔබේ admin user UID එක තිබෙන බව තහවුරු කරන්න.
- `supabase-title-magnet-migration.sql` එක Supabase SQL Editor එකේ Run කරන්න; මෙය දැනට ඇති tables වෙනස් නොකර title-specific magnet links table එක පමණක් එකතු කරයි.

5. Admin panel: Season themes + Download buttons + Title magnet links
------------------------------------------------
1. Website URL එකේ `/admin` open කර authorized admin account එකෙන් sign in වෙන්න.
2. `Seasonal website theme` එකෙන් Classic Ruby, Ocean, Violet, Emerald, Halloween, Christmas, Valentine’s Day, New Year, Easter/Spring හෝ Summer තෝරන්න. `Save` click කරන්න අවශ්‍ය නැහැ; theme එක Supabase global setting එකට auto-save වෙයි.
3. `Download buttons` → `Add download button` click කරන්න. Internal name, visitor button text, valid `https://` download URL, display order දාලා `Save button` click කරන්න.
4. Button එක enable/disable, edit හෝ delete කරන්නත් පුළුවන්. Enabled download buttons movie/TV detail page එකේ player එකට පහළින් පෙන්වයි; button colour eka selected website theme ekata match wenawa.
5. `Title-specific magnet links` කොටසේ TMDB ID, media type සහ title එක ඇතුළත් කරන්න. Movie සඳහා `Search YTS matches` click කර title/year හරියට ගැළපෙන torrent quality එක තෝරන්න; එසේ නොමැතිනම් අවසර ඇති `magnet:?xt=urn:btih:...` URI එකක් paste කරන්න. TV-show magnets YTS movie API එකෙන් නොලැබෙන නිසා අවසර ඇති source එකකින් ලබාගත් URI එකක් manually දාන්න.
6. “I own this content or have permission to distribute it” checkbox එක tick කර `Save title download` click කරන්න. එම TMDB ID/type එකේ detail page එකේ `Download via Magnet` button එක ස්වයංක්‍රීයව පෙන්වයි. Link එකක් නොමැති/disabled නම් button එක නොපෙන්වයි. YTS API search result එකක් තිබීම බෙදාහැරීමේ අවසරයක් බව අදහස් නොකරයි.

6. TV Shows gallery
-------------------
- TV Shows සඳහා එකම library list එකක් ඇත; `Popular on TMDB` සහ `New releases` tabs ඉවත් කර ඇත.
- Results TMDB `/discover/tv` endpoint එකෙන් ගන්නා අතර පෙරනිමි අනුපිළිවෙළ newest first (`first_air_date.desc`) වේ.
- TMDB API pagination අනුව “Load more titles” භාවිතයෙන් තවත් results ලබාගත හැක.

Deploy කිරීම:
1. ZIP එක extract කරන්න.
2. `js/config.js` update කරන්න.
3. Contents සම්පූර්ණයෙන් Netlify/Vercel/static host එකේ root එකට upload කරන්න. `index.html`, `movie.html`, `admin.html`, `js/`, `assets/` සහ `_redirects` එකම site root එකේ තිබිය යුතුයි.
4. Website එක open කර movie/TV cards load වන බව පරීක්ෂා කරන්න. Admin settings සඳහා `/admin` open කරන්න.

TMDB attribution:
This product uses the TMDB API but is not endorsed or certified by TMDB. Movie and TV metadata, posters, stills, and cast metadata are supplied by TMDB, subject to TMDB's terms and branding requirements.


============================================================
WHATSAPP SHARE PREVIEW + APLEX CINEMA REDESIGN (2026)
============================================================

1. ZIP එකේ සියලු files Vercel project එකේ root directory එකට upload/commit කර redeploy කරන්න. api/ folder එක සහ vercel.json අනිවාර්යයෙන්ම root එකේම තිබිය යුතුය. Homepage එක home.html ලෙස නම් කරලා තියෙන්නේ root URL එකේ crawler metadata rewrite එක filesystem එකෙන් shadow නොවීමටයි; vercel.json මඟින් / සහ පැරණි /index.html links හරි page එකට යොමු කරයි.
2. Movie/TV detail page එකේ “Share title” බොත්තමෙන් share කරන්න. එය /share/movie/TMDB_ID හෝ /share/tv/TMDB_ID link එකක් භාවිතා කරයි.
3. WhatsApp/Facebook වැනි preview crawler එකට title එක, synopsis එක සහ TMDB backdrop/poster image එක initial HTML meta tags ලෙස ලැබේ. සාමාන්‍ය visitor කෙනෙකු link එක click කළ විට movie.html detail page එකට redirect වේ.
4. Homepage එක share කළ විට APLEX Movies social preview artwork එක පෙන්වීමට Vercel crawler rewrite එකක් ද ඇතුළත් කර ඇත. Browser tab එකට SVG favicon එකත්, supported devices සඳහා PNG touch icon එකත් තියේ.
5. TMDB API key එක js/config.js තුළ තිබෙන public key එකෙන් fallback ලෙස භාවිතා කරයි. කැමති නම් Vercel Project Settings → Environment Variables හි TMDB_API_KEY set කළ හැක.
6. CSS-ийг Home, Movie/TV detail සහ Admin pages හරහා එකම responsive cinema theme එකට update කර ඇත.

TESTING NOTES
- Local syntax/JSON/ZIP checks කරන්න පුළුවන් නමුත් WhatsApp preview cache කිරීම සහ deployed Vercel rewrite behavior production deploy එකේදී පරීක්ෂා කළ යුතුය.
- WhatsApp පැරණි preview එකක් cache කර තිබුණොත් අලුත් URL එකක් (එකම title එකට share route එක නැවත සෑදීම අවශ්‍ය නොවේ; query parameter එකක් එක්කර test කරන්න) යොදා test කළ හැක.


6. TMDB ID අනුව Direct Download Links
-------------------------------------
1. Supabase SQL Editor එකේ website-source/supabase-title-direct-links-migration.sql file එකේ සම්පූර්ණ SQL එක Run කරන්න.
2. /admin වෙත ගොස් Direct download links කොටසට යන්න.
3. TMDB ID, Movie/TV type, title, quality සහ ඔබට බෙදාහැරීමට අවසර ඇති direct HTTPS URL එක ඇතුළත් කරන්න.
4. Rights confirmation එක tick කර Save direct link කරන්න.
5. එම TMDB ID එකේ detail page එක විවෘත කළ විට active quality buttons පෙන්වයි. Link එක නැත්නම් section එක සඟවයි.
