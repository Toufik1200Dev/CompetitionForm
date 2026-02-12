# نظام تسجيل مسابقات الكليستينيكس

نظام تسجيل للرياضيين في مسابقات الكليستينيكس في الجزائر

## المميزات

- نموذج تسجيل شامل باللغة العربية
- التحقق من تعارض تواريخ المسابقات
- واجهة مستخدم حديثة وسهلة الاستخدام
- دعم RTL للغة العربية
- متوافق مع الأجهزة المحمولة

## التقنيات المستخدمة

### Frontend
- React 18
- React Router
- Firebase SDK (Firestore)
- CSS3

### Backend & Database
- Firebase Firestore (مباشرة من الواجهة الأمامية)
- Cloudinary (لرفع الصور الشخصية)
- لا حاجة لخادم منفصل - Firebase و Cloudinary هما الخادم

## التثبيت

### 1. تثبيت التبعيات

```bash
npm run install-all
```

### 2. إعداد Firebase

التطبيق يستخدم Firebase SDK الموجود في `frontend/src/firebase/config.js` مع بيانات الاعتماد المحددة مسبقاً.

### 3. تشغيل التطبيق

```bash
npm start
```

أو

```bash
cd frontend && npm start
```

## الصفحات

- `/athlete-registration` - صفحة تسجيل الرياضيين

## كيفية العمل

- التطبيق يستخدم **Firebase Firestore** مباشرة من الواجهة الأمامية
- جميع البيانات تُحفظ في مجموعة `athletes` في Firestore
- التحقق من صحة البيانات يتم في الواجهة الأمامية قبل الحفظ

## هيكل المشروع

```
CompetitionForm/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   │   └── AthleteRegistration.js
│   │   ├── firebase/
│   │   │   └── config.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── utils/
│   │   │   └── competitionCategories.js
│   │   ├── data/
│   │   │   └── competitionSchedule.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
└── package.json
```

## التحقق من البيانات

- جميع الحقول مطلوبة
- لا يمكن اختيار ولايتين لهما نفس تاريخ المنافسة
- يمكن اختيار ولايات متعددة بشرط أن تكون تواريخها مختلفة

## الترخيص

ISC
