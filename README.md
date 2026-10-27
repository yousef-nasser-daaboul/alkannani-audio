# alkannani-audio

ملفات الأذان والإعدادات البعيدة لتطبيق **الكنّاني** (تطبيق مواقيت الصلاة). يقرأ التطبيق هذه الملفات عبر jsDelivr مثبَّتةً على وسم (tag) من وسوم git، فكل وسم هو إصدار منشور.

> **الملفات المنشورة ثابتة لا تتغيّر.** بعد وسم أي إصدار، لا تُعِد تسمية ملف منشور ولا تُعِد ترميزه ولا تحذفه: التطبيق يحفظ معرّفات العناصر (`id`) في إعدادات المستخدم، و`manifest.json` القديم يشير إلى وسوم قديمة. لاستبدال صوت، أضِف ملفاً جديداً بمعرّف جديد.

## بنية المستودع

```
audio/adhan/<muezzin-id>/<kind>[-<maqam-id>].mp3   kind = regular | fajr ; maqam optional (absent = غير محدد)
audio/reminders/<muezzin-id>/<name>.mp3                listed in catalog.json "reminders" with its prayer
catalog.json      أسماء المؤذنين والمقامات المعروضة، وصلاة كل تذكير (يُحرَّر يدوياً)
manifest.json     مولَّد — لا يُحرَّر يدوياً
corrections.json  تصحيحات الأوقات
scripts/generate-manifest.mjs
```

الملفات الحالية:

| المسار | الوصف |
| --- | --- |
| `audio/adhan/bilal-abdulaziz/regular-jiharkah.mp3` | أذان عادي، مقام جهركاه |
| `audio/adhan/bilal-abdulaziz/regular-rasd.mp3` | أذان عادي، مقام رصد (v1.1.0) |
| `audio/adhan/bilal-abdulaziz/fajr.mp3` | أذان فجر، مقام غير محدد |
| `audio/adhan/marrashli/regular.mp3` | أذان عادي، مقام غير محدد (v1.1.0) |
| `audio/adhan/marrashli/fajr.mp3` | أذان فجر، مقام غير محدد (v1.1.0) |
| `audio/adhan/saad/regular.mp3` | أذان عادي، مقام غير محدد (v1.1.0) |
| `audio/reminders/bilal-abdulaziz/tazkeer.mp3` | تذكير العشاء |
| `audio/reminders/marrashli/fajr-1.mp3` | تذكير الفجر «تذكير المرعشلي 1» (v1.1.0) |
| `audio/reminders/marrashli/fajr-2.mp3` | تذكير الفجر «تذكير المرعشلي 2» (v1.1.0) |
| `audio/reminders/marrashli/isha.mp3` | تذكير العشاء (v1.1.0) |

كل الملفات MP3 أحادية (mono)، ‏44.1kHz، بمعدّل 51–69kbps. ارفع الملفات الجديدة مضغوطةً بالمثل، فالسكربت لا يعيد الترميز أبداً.

## `catalog.json`

```json
{
  "muezzins": { "<id>": { "name": "..." } },
  "maqamat":  { "<id>": { "name": "..." } },
  "reminders": { "<muezzin-id>/<name>": { "prayer": "fajr" | "isha", "name": "..." } }
}
```

المعرّفات بحروف صغيرة مفصولة بشرطات (kebab): `[a-z0-9-]+`، وهي نفسها أسماء المجلدات والمقاطع في مسارات الصوت.

كل ملف تذكير يجب أن يُذكر في `reminders` بمفتاح `<muezzin-id>/<name>` (مساره بدون `audio/reminders/` و`.mp3`):
- `prayer` (إلزامي): الصلاة التي يسبقها التذكير، `fajr` أو `isha`. يعرض التطبيق لكل صلاة تذكيراتها فقط.
- `name` (اختياري): الاسم المعروض، حين يكون للمؤذن أكثر من تذكير للصلاة نفسها (مثل «تذكير المرعشلي 1»). الافتراضي `"تذكير " + اسم المؤذن`.

## `manifest.json` (مولَّد)

الحقول على المستوى الأعلى:

- `schemaVersion`: حالياً `1`. لا يُرفع إلا عند تغيير غير متوافق في البنية، ويساوي دائماً الرقم الأكبر (major) للوسم: الوسوم `v1.x.y` تحمل المخطط `1`. السكربت يرفض أي وسم آخر.
- `version`: الوسم، مثل `v1.0.0`.
- `adhans[]` و`reminders[]`: مرتّبتان حسب `id`.

عنصر الأذان:

| الحقل | المعنى |
| --- | --- |
| `id` | المسار بدون `audio/` و`.mp3`، مثل `adhan/bilal-abdulaziz/regular-jiharkah` |
| `kind` | `regular` أو `fajr` |
| `muezzin` | `{ "id", "name" }` |
| `maqam` | `{ "id", "name" }` أو `null` |
| `displayName` | اسم المؤذن |
| `url` | رابط jsDelivr مطلق مثبَّت على `version` |
| `sizeBytes` | الحجم بالبايت |
| `durationMs` | المدة بالميلي ثانية |

عنصر التذكير: `id`، `prayer` (`fajr` أو `isha`، من `catalog.json`، منذ v1.1.0)، `muezzin`، `displayName` (`name` من `catalog.json`، وإلا `"تذكير " + muezzin.name`)، `url`، `sizeBytes`، `durationMs`.

إضافة `prayer` في v1.1.0 متوافقة مع المخطط `1`: نسخ التطبيق الأقدم تتجاهل الحقل وتعرض كل التذكيرات للصلاتين.

يعرض التطبيق الأذان بصيغة `<المؤذن> – <المقام>` حين لا يكون `maqam` يساوي `null`، وإلا يكتفي باسم المؤذن.

التوليد حتمي: الملفات نفسها مع الإصدار نفسه تنتج البايتات نفسها تماماً.

## `corrections.json`

طبقة تصحيح بعيدة لأوقات الصلاة. تُحسب الأوقات على الجهاز بمكتبة `adhan`، ثم يطبّق التطبيق بالترتيب: الإعدادات الافتراضية لكل دولة ← `corrections.json` ← تعديل المستخدم اليدوي (±دقائق).

```json
{
  "schemaVersion": 1,
  "countries": {
    "SY": {
      "method": "MuslimWorldLeague",
      "madhab": "shafi",
      "offsetsMinutes": { "asr": 2, "maghrib": 2 },
      "cities": {}
    }
  }
}
```

- `schemaVersion`: عدد صحيح. يرفض التطبيق أي إصدار لا يفهمه ويبقي على آخر نسخة صالحة لديه.
- مفاتيح `countries`: رموز ISO 3166-1 alpha-2.
- `method` (اختياري): مفتاح من `CalculationMethod` في مكتبة `adhan`، مثل `MuslimWorldLeague`، `Egyptian`، `UmmAlQura`.
- `madhab` (اختياري): `"shafi"` أو `"hanafi"` (قيم `Madhab` في `adhan`).
- `offsetsMinutes` (اختياري): دقائق صحيحة لكل صلاة. المفاتيح المسموحة: `fajr`، `sunrise`، `dhuhr`، `asr`، `maghrib`، `isha`. المفتاح الغائب يعني `0`.
- `cities`: خريطة من معرّف المدينة المضمَّن في التطبيق (يُعرَّف في قائمة مدن التطبيق، في تذكرة لاحقة) إلى عنصر بالحقول الاختيارية نفسها: `method`، `madhab`، `offsetsMinutes`.

**الأخصّ يغلب، حقلاً بحقل:** إذا وُجد الحقل على مستوى المدينة حلّ محلّ حقل الدولة كاملاً. كائن `offsetsMinutes` يُستبدل كاملاً ولا يُدمج ولا يُجمع. الحقول الغائبة عن المدينة تُؤخذ من الدولة.

**سبب إعداد سوريا:** يطابق تطبيق وزارة الأوقاف السورية الرسمي «مسجدك» (المسجد المرجعي: مسجد التل الكبير): رابطة العالم الإسلامي (الفجر 18°، العشاء 17°)، عصر شافعي، و+2 دقيقة للعصر والمغرب (احتياط).

## روابط jsDelivr

النمط:

```
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@<tag>/<path>
```

أمثلة للإصدار `v1.0.0`:

```
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/manifest.json
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/corrections.json
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/audio/adhan/bilal-abdulaziz/regular-jiharkah.mp3
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/audio/adhan/bilal-abdulaziz/fajr.mp3
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/audio/reminders/bilal-abdulaziz/tazkeer.mp3
```

### كيف يصل الإصدار الجديد إلى التطبيق دون تحديثه

يقرأ التطبيق `manifest.json` و`corrections.json` من **نطاق الإصدار الأكبر** `@1`، وهو يشير دائماً إلى أحدث وسم `v1.x.y`:

```
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@1/manifest.json
https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@1/corrections.json
```

- روابط الصوت داخل الـ manifest مثبَّتة على وسم كامل (`@v1.0.0`)، فهي ثابتة لا تتغيّر أبداً.
- تغيير غير متوافق في البنية يعني `schemaVersion: 2` ووسوم `v2.x.y`، فلا يصل إلى التطبيقات القديمة التي تقرأ `@1`.
- يخزّن jsDelivr نتيجة `@1` مؤقتاً (حتى 12 ساعة تقريباً)، لذلك امسح الكاش بعد كل وسم جديد (الخطوة 6 أدناه).
- لا تستخدم `@main` ولا `@latest`.
- المحتوى المثبَّت على وسم كامل ثابت على jsDelivr، لذلك لا تنقل وسماً منشوراً ولا تُعِد استخدامه.

## إضافة مؤذن جديد

1. ضع ملف MP3 في المسار الصحيح، مثل `audio/adhan/<muezzin-id>/regular-<maqam-id>.mp3` أو `audio/adhan/<muezzin-id>/fajr.mp3` أو `audio/reminders/<muezzin-id>/<name>.mp3`.
2. إن كان المؤذن أو المقام جديداً، أضِفه إلى `catalog.json`. ولكل تذكير جديد أضِف عنصره في `reminders` مع صلاته.
3. ولّد الـ manifest بالوسم التالي (semver ضمن `v1`: صوت جديد = رفع minor، تصحيح أوقات = رفع patch):
   ```bash
   npm install            # first time only
   npm run manifest -- vX.Y.Z
   ```
4. شغّل الاختبارات:
   ```bash
   npm test
   ```
5. ارفع ووسِم:
   ```bash
   git add -A && git commit -m "..." && git tag vX.Y.Z && git push origin main --tags
   ```
6. امسح كاش النطاق `@1` كي يلتقط التطبيق الإصدار فوراً، ثم تحقّق:
   ```bash
   curl https://purge.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@1/manifest.json
   curl https://purge.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@1/corrections.json
   curl -s https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@1/manifest.json | grep '"version"'   # must print vX.Y.Z
   ```

يفشل السكربت بوضوح (قبل كتابة أي شيء) إذا وجد مؤذناً أو مقاماً أو تذكيراً غير موجود في `catalog.json` أو ملفاً مسمّى بشكل خاطئ.

## تعديل التصحيحات

1. عدّل `corrections.json`.
2. شغّل `npm run manifest -- vX.Y.Z` رغم عدم تغيّر الصوت، كي تطابق `version` والروابط في `manifest.json` الوسم الجديد.
3. `npm test`، ثم commit ووسِم وادفع وامسح الكاش كما في الخطوتين 5 و6 أعلاه.
