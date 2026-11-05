# MyLife hub fonts, kept with the app (Shane's B)

Downloaded once by claude-room on 2026-10-29 at 15:18 CT (20:18:35 UTC), under Shane's answer to the hub look card at 15:16 CT ("b": font files kept with each app; the card said choosing B is his OK to download three open-licence font files once). These are the same three families the hub's Google Fonts link loads today (v2r2, every .html line 10, test-states.html line 14). Nothing else was downloaded: not the licence texts, not other weights or scripts.

Method: Google Fonts css2 API, fetched with a Chrome user agent, then the one woff2 file its CSS names for the subset below. Checked with fontTools (name table, glyph map) and loaded from file:// pages in headless Chromium: all three report "loaded", with 0 non-file requests.

| File | Bytes | sha256 | Family, version | What it covers |
|---|---|---|---|---|
| oswald-latin-var.woff2 | 21472 | 571f3457dab507b6f2ce5394d593ca015251b69fea81ab7a546bd2368e9fc3ed | Oswald, Version 4.103; variable, wght 400-700 | Google's "latin" range (U+0000-00FF, U+2000-206F and a few more); one file serves weights 400, 500 and 700 |
| share-tech-mono-latin.woff2 | 13500 | 41e6b9f297f7d9a2df2aaa274092f76d2f72711a15ca455f7f4f4f92caf16b72 | Share Tech Mono, Version 1.003; weight 400 | Google's "latin" range |
| noto-serif-jp-900-hub-subset.woff2 | 17000 | 89b90c40d5e020d8abc68b3dedcc334cd774738ce237ac030f8db13110262760 | Noto Serif JP Black, Version 2.003-H1; weight 900 | Only the 55 Japanese characters found in v2r2's files, listed below |

Sources:
- Oswald: https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;700&display=swap, then https://fonts.gstatic.com/s/oswald/v57/TK3IWkUHHAIjg75cFRf3bXL8LICs1_Fv40pKlN4NNSeSASz7FmlWHYg.woff2
- Share Tech Mono: https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap, then https://fonts.gstatic.com/s/sharetechmono/v16/J7aHnp1uDWRBEqV98dVQztYldFcLowEF.woff2
- Noto Serif JP: https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@900&text=<the 55 characters>, then https://fonts.gstatic.com/l/font?kit=xn71YHs72GKoTvER4Gn3b5eMRtWGkp6o7MjQ2byYPebFOBKwIokYQ87vDbC-Hzsyie75hAmqdIEUCNB_CbrWsB_TuPGeSEBapZzQN7KzEe-7F4WEYoVNAmBXR9Msz0bevwhpX6K9u9n5O_jAVA_Z_JAAAhjpMltp3Dj55CGXbrAAFofgT1IQq9SCaJMwCcKQv91TJSx9KS3_DTYh5yUBuZCOI5GkgYzmeW2eKQ4rubwE-qWnS9amDEVRslroHfZggLhevIHxkeqz&skey=311bf6d07cd0b6c8&v=v34

Licence: all three are under the SIL Open Font License 1.1 (https://openfontlicense.org). Copyright lines, as each file's name table gives them:
- Oswald: Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont)
- Share Tech Mono: Copyright (c) 2012, Carrois Type Design, Ralph du Carrois (post@carrois.com www.carrois.com), with Reserved Font Name 'Share'
- Noto Serif JP: (c) 2017-2024 Adobe (http://www.adobe.com/)
Use them unmodified and keep this file with them.

The 55 Japanese characters (every CJK character in v2r2's .html, .js and .css files):
き事令休例信像凡動務受号司報定室導建待急情掲放映時書朝本査検機止況無状画番示組絶緊色表設警財送途造部錬鍛面食魔

Limits:
- A Japanese character outside that list falls back to the system font (Yu Mincho, Hiragino Mincho ProN or MS Mincho, per mylife.css --f-kanji). New Japanese text in the hub means a new subset, which would be a new download for Shane to OK.
- v2r2 also uses → ↗ ┆ ■ □ ▲ ● ✓, which none of these fonts (or today's Google link) covers; they come from system fonts, as they do now.

fonts.css: three @font-face rules naming the files above, with the family names mylife.css uses ('Oswald', 'Noto Serif JP', 'Share Tech Mono'). Tried from a file:// page in Chromium: each family loaded.
