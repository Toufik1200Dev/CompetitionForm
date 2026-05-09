import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMergedPublicProfileByUid } from '../services/api';
import './PublicUserProfile.css';

const QR_SIZE = 200;

const getQrUrl = (targetUrl) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(targetUrl)}`;

const show = (value, fallback = '—') => (value == null || value === '' ? fallback : value);

const formatDate = (value) => {
  if (!value) return '—';
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('ar-DZ');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return show(value);
  return date.toLocaleDateString('ar-DZ');
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return show(value);
  return date.toLocaleString('ar-DZ');
};

const mapCompetitionType = (value) => {
  if (!value) return '—';
  if (value === 'freestyle') return 'الأسلوب الحر';
  if (value === 'power_lifting') return 'القوة';
  if (value === 'strength_endurance') return 'التحمل';
  return value;
};

const mapGender = (value) => {
  if (!value) return '—';
  if (value === 'male') return 'ذكر';
  if (value === 'female') return 'أنثى';
  return value;
};

const mapWeightCategory = (value) => {
  if (!value) return '—';
  const v = String(value).toLowerCase();
  if (v === 'light') return 'خفيف';
  if (v === 'medium') return 'متوسط';
  if (v === 'heavy') return 'ثقيل';
  if (v === 'open') return 'مطلقة';
  return value;
};

const mapAgeCategory = (value) => {
  if (!value) return '—';
  if (value === 'regular') return 'عادي';
  if (value === 'veteran') return 'محارب قديم';
  return value;
};

const mapRegistrationType = (value) => {
  if (!value) return '—';
  if (value === 'regional_championship') return 'بطولة ولائية';
  if (value === 'national_championship') return 'البطولة الوطنية';
  return value;
};

const TRAINING_VENUE_LABELS = {
  hall: 'قاعة',
  outdoor_track: 'مضمار خارجي'
};

const ACTIVITY_MODE_LABELS = {
  amateur_club: 'نادي هاوي (جمعية رياضية)',
  private_gym: 'قاعة خاصة',
  independent: 'حر'
};

const COACH_SPECIALTY_LABELS = {
  freestyle: 'فردي (Freestyle)',
  strength: 'قوة (Strength)',
  power: 'التحمل (Power)'
};

const mapTrainingVenue = (v) => TRAINING_VENUE_LABELS[v] || show(v);
const mapActivityMode = (v) => ACTIVITY_MODE_LABELS[v] || show(v);

const isEmptyVal = (v) =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0);

const mergeArraysUnique = (a, b) => {
  const out = [...(Array.isArray(a) ? a : [])];
  const seen = new Set(out.map((x) => JSON.stringify(x)));
  for (const item of Array.isArray(b) ? b : []) {
    const s = JSON.stringify(item);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(item);
    }
  }
  return out;
};

/** Merge multiple Firestore docs (newest first): newest wins for scalars; arrays merged uniquely */
const mergeFirestoreEntries = (entries) => {
  if (!entries?.length) return {};
  const sorted = [...entries].sort((a, b) => {
    const da = new Date(a.data?.registrationDate || a.data?.createdAt || 0).getTime();
    const db = new Date(b.data?.registrationDate || b.data?.createdAt || 0).getTime();
    return db - da;
  });
  const merged = { ...sorted[0].data };

  const arrayKeys = new Set(['competitionTypes', 'competitions', 'honoraryCompetitions', 'trainingSpecialties', 'certificateUrls']);

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i].data || {};
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (isEmptyVal(v)) continue;
      if (arrayKeys.has(k)) {
        merged[k] = mergeArraysUnique(merged[k], v).filter((x) => x !== '' && x != null);
        continue;
      }
      if (isEmptyVal(merged[k])) merged[k] = v;
    }
  }

  return merged;
};

const formatCompetitionRow = (c) => {
  if (c == null) return '—';
  if (typeof c === 'string') return c;
  const wilaya = c.wilaya || '';
  const dateStr = c.date ? formatDate(c.date) : '';
  const loc = c.location ? ` — ${c.location}` : '';
  const type = c.type === 'main' ? ' (رئيسي)' : c.type === 'honorary' ? ' (شرف)' : '';
  if (!wilaya && !dateStr) return '—';
  return `${wilaya}${dateStr ? ` — ${dateStr}` : ''}${loc}${type}`;
};

const athleteHasBirthDate = (athlete) => {
  const v = athlete?.birthDate;
  if (v == null || v === '') return false;
  if (typeof v.toDate === 'function') {
    const d = v.toDate();
    return !Number.isNaN(d.getTime());
  }
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
};

const athleteHasTshirtSize = (athlete) => {
  const v = athlete?.tshirtSize;
  return v != null && String(v).trim() !== '';
};

const PublicUserProfile = () => {
  const { uid } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await fetchMergedPublicProfileByUid(uid);
        if (mounted) {
          setProfile(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err?.message === 'PROFILE_NOT_FOUND' ? 'لم يتم العثور على هذا المستخدم' : 'حدث خطأ أثناء تحميل الملف');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [uid]);

  const mergedAthlete = useMemo(
    () => mergeFirestoreEntries(profile?.athleteEntries),
    [profile]
  );
  const mergedCoach = useMemo(() => mergeFirestoreEntries(profile?.coachingEntries), [profile]);

  const competitionTypesLabel = useMemo(() => {
    const types = (mergedAthlete.competitionTypes || []).filter(Boolean);
    if (types.length === 0) {
      return mapCompetitionType(mergedAthlete.competitionType);
    }
    return types.map(mapCompetitionType).join('، ');
  }, [mergedAthlete.competitionTypes, mergedAthlete.competitionType]);

  const coachingSpecialtiesLabel = useMemo(() => {
    const ids = mergedCoach.trainingSpecialties || [];
    if (!ids.length) return '—';
    return ids.map((id) => COACH_SPECIALTY_LABELS[id] || id).join('، ');
  }, [mergedCoach.trainingSpecialties]);

  const competitionsList = useMemo(() => {
    const raw = mergedAthlete.competitions;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map(formatCompetitionRow).filter((line) => line && line !== '—');
  }, [mergedAthlete.competitions]);

  const honoraryList = useMemo(() => {
    const h = mergedAthlete.honoraryCompetitions;
    if (!Array.isArray(h) || h.length === 0) return [];
    return h.filter(Boolean);
  }, [mergedAthlete.honoraryCompetitions]);

  const profileRoles = useMemo(() => {
    const hasAthlete = (profile?.athleteEntries?.length || 0) > 0;
    const hasCoach = (profile?.coachingEntries?.length || 0) > 0;
    const roles = [];
    if (hasAthlete) roles.push('لاعب');
    if (hasCoach) roles.push('مدرب');
    if (roles.length === 0) roles.push('ملف عام');
    return roles;
  }, [profile]);

  const showCoachBirthInTraining = useMemo(
    () => !athleteHasBirthDate(mergedAthlete),
    [mergedAthlete]
  );
  const showCoachTshirtInTraining = useMemo(
    () => !athleteHasTshirtSize(mergedAthlete),
    [mergedAthlete]
  );

  if (loading) {
    return <div className="public-profile-status">جاري التحميل...</div>;
  }

  if (error) {
    return (
      <div className="public-profile-status public-profile-status--error">
        <p>{error}</p>
        <Link to="/" className="public-profile-back">العودة للرئيسية</Link>
      </div>
    );
  }

  if (!profile) return null;

  const personalImage = mergedAthlete.personalPictureUrl || '';
  const profileNotes = [
    mergedAthlete.disease ? `الحالة الصحية: ${mergedAthlete.disease}` : '',
    mergedCoach.achievementsTournaments ? `الإنجازات: ${mergedCoach.achievementsTournaments}` : ''
  ]
    .filter(Boolean)
    .join(' | ');

  const qrSrc = getQrUrl(profile.publicUrl);
  const certUrls = Array.isArray(mergedCoach.certificateUrls) ? mergedCoach.certificateUrls.filter(Boolean) : [];

  return (
    <div className="public-profile-page" dir="rtl">
      <div className="public-profile-print-bar no-print">
        <button type="button" className="public-print-btn" onClick={() => window.print()}>
          طباعة الملف
        </button>
      </div>

      <div className="public-profile-shell">
        <header className="public-qr-hero">
          <div className="public-qr-hero__qr">
            <img src={qrSrc} alt="رمز الاستجابة السريعة" width={QR_SIZE} height={QR_SIZE} />
          </div>
          <div className="public-qr-hero__text">
            <h1 className="public-qr-hero__title">{show(profile.displayName)}</h1>
            <p className="public-qr-hero__subtitle">امسح الرمز للوصول السريع إلى هذا الملف</p>
            <div className="public-qr-hero__roles" aria-label="نوع الملف">
              {profileRoles.map((role) => (
                <span key={role} className="public-qr-hero__role">{role}</span>
              ))}
            </div>
          </div>
        </header>

        <div className="public-identity-block">
          <div className="public-photo-block">
            <div className="public-photo-frame">
              {personalImage ? (
                <img src={personalImage} alt="الصورة الشخصية" />
              ) : (
                <div className="public-photo-placeholder">بدون صورة</div>
              )}
            </div>
          </div>

          <div className="public-fields-grid public-fields-grid--identity">
            <div className="public-field">
              <label>الجنس</label>
              <div>{mapGender(mergedAthlete.gender)}</div>
            </div>
            <div className="public-field">
              <label>النادي / الفريق</label>
              <div>{show(mergedAthlete.clubName)}</div>
            </div>
            <div className="public-field">
              <label>تاريخ الميلاد</label>
              <div>{formatDate(mergedAthlete.birthDate)}</div>
            </div>
            <div className="public-field">
              <label>مكان الميلاد</label>
              <div>{show(mergedAthlete.birthPlace)}</div>
            </div>
            <div className="public-field">
              <label>يتدرب في نادي</label>
              <div>
                {mergedAthlete.trainsInClub === true ? 'نعم' : mergedAthlete.trainsInClub === false ? 'لا' : '—'}
              </div>
            </div>
            <div className="public-field">
              <label>المدينة</label>
              <div>{show(mergedCoach.city)}</div>
            </div>
          </div>
        </div>

        <div className="public-sections-grid">
          <section className="public-section">
            <h3 className="public-section__title">المعلومات الرياضية</h3>
            <div className="public-two-col">
              <div className="public-field"><label>مقاس التيشيرت</label><div>{show(mergedAthlete.tshirtSize)}</div></div>
              <div className="public-field"><label>الطول</label><div>{mergedAthlete.height ? `${mergedAthlete.height} سم` : '—'}</div></div>
              <div className="public-field"><label>الوزن</label><div>{mergedAthlete.weight ? `${mergedAthlete.weight} كجم` : '—'}</div></div>
              <div className="public-field"><label>رقم الإجازة</label><div>{show(mergedAthlete.licenseNumber)}</div></div>
              <div className="public-field"><label>أنواع المسابقة</label><div>{competitionTypesLabel}</div></div>
              <div className="public-field"><label>فئة الوزن</label><div>{mapWeightCategory(mergedAthlete.weightCategory)}</div></div>
              <div className="public-field"><label>فئة العمر</label><div>{mapAgeCategory(mergedAthlete.ageCategory)}</div></div>
            </div>
          </section>

          <section className="public-section">
            <h3 className="public-section__title">السلامة والحالة الطبية</h3>
            <div className="public-two-col">
              <div className="public-field"><label>فصيلة الدم</label><div>{show(mergedAthlete.bloodType)}</div></div>
              <div className="public-field"><label>حالة مرضية</label><div>{mergedAthlete.hasDisease ? 'نعم' : 'لا'}</div></div>
              <div className="public-field full"><label>تفاصيل الحالة</label><div>{show(mergedAthlete.disease)}</div></div>
            </div>
          </section>

          <section className="public-section">
            <h3 className="public-section__title">العنوان والإقامة</h3>
            <div className="public-two-col">
              <div className="public-field"><label>الولاية</label><div>{show(mergedAthlete.address?.wilaya || mergedCoach.wilaya)}</div></div>
              <div className="public-field"><label>البلدية</label><div>{show(mergedAthlete.address?.municipality)}</div></div>
              <div className="public-field"><label>الحي</label><div>{show(mergedAthlete.address?.neighborhood)}</div></div>
              <div className="public-field"><label>الرمز البريدي</label><div>{show(mergedAthlete.address?.zipCode)}</div></div>
            </div>
          </section>

          <section className="public-section">
            <h3 className="public-section__title">بيانات التواصل</h3>
            <div className="public-two-col">
              <div className="public-field"><label>الهاتف</label><div>{profile.phones.length ? profile.phones.join(' | ') : show(mergedAthlete.phone)}</div></div>
              <div className="public-field"><label>البريد الإلكتروني</label><div>{show(mergedAthlete.email || mergedCoach.email)}</div></div>
              <div className="public-field"><label>Instagram</label><div>{show(mergedAthlete.instagram || mergedCoach.instagram)}</div></div>
              <div className="public-field"><label>Facebook</label><div>{show(mergedAthlete.facebook || mergedCoach.facebook)}</div></div>
              <div className="public-field"><label>TikTok</label><div>{show(mergedAthlete.tiktok || mergedCoach.tiktok)}</div></div>
              <div className="public-field"><label>LinkedIn</label><div>{show(mergedCoach.linkedin)}</div></div>
            </div>
          </section>

          <section className="public-section public-section--wide">
            <h3 className="public-section__title">التسجيل والمسابقات</h3>
            <div className="public-two-col">
              <div className="public-field"><label>نوع التسجيل</label><div>{mapRegistrationType(mergedAthlete.registrationType)}</div></div>
              <div className="public-field"><label>تاريخ التسجيل</label><div>{formatDateTime(mergedAthlete.registrationDate || mergedAthlete.createdAt)}</div></div>
              <div className="public-field"><label>المسابقة الرئيسية (الولاية)</label><div>{show(mergedAthlete.firstCompetition)}</div></div>
            </div>
            {competitionsList.length > 0 && (
              <div className="public-field full public-field--list">
                <label>المسابقات المختارة</label>
                <ul className="public-data-list">
                  {competitionsList.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {honoraryList.length > 0 && (
              <div className="public-field full public-field--list">
                <label>مسابقات الشرف</label>
                <ul className="public-data-list">
                  {honoraryList.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="public-section">
            <h3 className="public-section__title">بيانات التدريب</h3>
            <div className="public-two-col">
              {showCoachBirthInTraining && (
                <div className="public-field"><label>تاريخ الميلاد</label><div>{formatDate(mergedCoach.birthDate)}</div></div>
              )}
              {showCoachTshirtInTraining && (
                <div className="public-field"><label>مقاس التيشيرت</label><div>{show(mergedCoach.tshirtSize)}</div></div>
              )}
              <div className="public-field"><label>هل مدرب</label><div>{mergedCoach.isTrainer === 'yes' ? 'نعم' : mergedCoach.isTrainer === 'no' ? 'لا' : '—'}</div></div>
              <div className="public-field"><label>عدد الرياضيين</label><div>{show(mergedCoach.athleteCount)}</div></div>
              <div className="public-field"><label>سنوات ممارسة الرياضة</label><div>{show(mergedCoach.yearsSports)}</div></div>
              <div className="public-field"><label>سنوات التدريب</label><div>{show(mergedCoach.yearsCoaching)}</div></div>
              <div className="public-field"><label>فضاء التدريب</label><div>{mapTrainingVenue(mergedCoach.trainingVenue)}</div></div>
              <div className="public-field"><label>نمط النشاط</label><div>{mapActivityMode(mergedCoach.activityMode)}</div></div>
              <div className="public-field full"><label>التخصصات التدريبية</label><div>{coachingSpecialtiesLabel}</div></div>
              <div className="public-field full"><label>الإنجازات والبطولات</label><div>{show(mergedCoach.achievementsTournaments)}</div></div>
            </div>
            {certUrls.length > 0 && (
              <div className="public-field full public-field--certs">
                <label>الشهادات</label>
                <div className="public-cert-links">
                  {certUrls.map((url, idx) => (
                    <a key={url + idx} href={url} target="_blank" rel="noopener noreferrer">
                      شهادة {idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="public-section public-section--full">
          <h3 className="public-section__title">ملاحظات</h3>
          <div className="public-field full">
            <div>{show(profileNotes, 'لا توجد ملاحظات إضافية')}</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PublicUserProfile;
