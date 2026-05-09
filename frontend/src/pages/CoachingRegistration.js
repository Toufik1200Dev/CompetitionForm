import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { registerCoachingRegistration } from '../services/api';
import { WILAYAS } from '../data/wilayas';
import logo1 from '../imgs/logo1.png';
import sportpourtoutes from '../imgs/sportpourtouteLOGO.png';
import nccLogo from '../imgs/nccNewlogo.png';
import './NationalChampionshipRegistration.css';

const SPECIALTIES = [
  { id: 'freestyle', label: 'فردي (Freestyle)' },
  { id: 'strength', label: 'قوة (Strength)' },
  { id: 'power', label: 'التحمل / Power' }
];

const TSHIRT_SIZES = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' }
];

const initialForm = {
  fullLegalName: '',
  phone: '',
  birthDate: '',
  tshirtSize: '',
  email: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  linkedin: '',
  city: '',
  wilaya: '',
  isTrainer: '',
  athleteCount: '',
  trainingVenue: '',
  activityMode: '',
  trainingSpecialties: [],
  yearsSports: '',
  yearsCoaching: '',
  achievementsTournaments: '',
  certificateFiles: []
};

const CoachingRegistration = () => {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [coachingRegEnabled, setCoachingRegEnabled] = useState(true);
  const [coachingRegStatusMessage, setCoachingRegStatusMessage] = useState('');
  const [coachingRegMainTitle, setCoachingRegMainTitle] = useState(
    'تسجيل المدربين والتأهيل التدريبي'
  );
  const [coachingRegSubTitle, setCoachingRegSubTitle] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const settingsDoc = await getDoc(
          doc(db, 'settings', 'coaching_registration')
        );
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setCoachingRegEnabled(data.enabled !== false);
          setCoachingRegStatusMessage(data.statusMessage || '');
          setCoachingRegMainTitle(
            data.mainTitle || 'تسجيل المدربين والتأهيل التدريبي'
          );
          setCoachingRegSubTitle(data.subTitle || '');
        }
      } catch (e) {
        console.error('Error loading coaching registration settings:', e);
      }
    };
    load();
  }, []);

  const clearFieldError = (name) => {
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'isTrainer' && value !== 'yes' ? { athleteCount: '' } : {})
    }));
    clearFieldError(name);
  };

  const toggleSpecialty = (id) => {
    setFormData((prev) => {
      const has = prev.trainingSpecialties.includes(id);
      const trainingSpecialties = has
        ? prev.trainingSpecialties.filter((s) => s !== id)
        : [...prev.trainingSpecialties, id];
      return { ...prev, trainingSpecialties };
    });
    clearFieldError('trainingSpecialties');
  };

  const handleCertificatesChange = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const valid = [];
    for (const file of picked) {
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({
          ...prev,
          certificateFiles: 'يجب أن تكون الملفات صوراً (PNG، JPEG، …)'
        }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          certificateFiles: 'كل صورة يجب أن تقل عن 5 ميجابايت'
        }));
        return;
      }
      valid.push(file);
    }
    setFormData((prev) => ({
      ...prev,
      certificateFiles: [...prev.certificateFiles, ...valid]
    }));
    setErrors((prev) => ({ ...prev, certificateFiles: '' }));
  };

  const removeCertificate = (index) => {
    setFormData((prev) => ({
      ...prev,
      certificateFiles: prev.certificateFiles.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.fullLegalName.trim()) {
      newErrors.fullLegalName = 'الاسم الكامل مطلوب';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'رقم الهاتف مطلوب';
    }
    if (!formData.birthDate) {
      newErrors.birthDate = 'تاريخ الميلاد مطلوب';
    }
    if (!formData.tshirtSize) {
      newErrors.tshirtSize = 'مقاس التيشيرت مطلوب';
    }
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'صيغة البريد الإلكتروني غير صحيحة';
      }
    }
    if (!formData.city.trim()) {
      newErrors.city = 'المدينة مطلوبة';
    }
    if (!formData.wilaya.trim()) {
      newErrors.wilaya = 'الولاية مطلوبة';
    }
    if (!formData.isTrainer) {
      newErrors.isTrainer = 'يرجى الإجابة: هل أنت مدرب؟';
    }
    if (formData.isTrainer === 'yes') {
      const n = parseInt(formData.athleteCount, 10);
      if (
        formData.athleteCount === '' ||
        Number.isNaN(n) ||
        n < 0
      ) {
        newErrors.athleteCount = 'عدد الرياضيين مطلوب (رقم صحيح)';
      }
    }
    if (!formData.trainingVenue) {
      newErrors.trainingVenue = 'فضاء التدريب مطلوب';
    }
    if (!formData.activityMode) {
      newErrors.activityMode = 'كيفية النشاط مطلوبة';
    }
    if (!formData.trainingSpecialties.length) {
      newErrors.trainingSpecialties = 'اختر تخصصاً واحداً على الأقل';
    }
    const ys = parseFloat(formData.yearsSports);
    const yc = parseFloat(formData.yearsCoaching);
    if (
      formData.yearsSports === '' ||
      Number.isNaN(ys) ||
      ys < 0
    ) {
      newErrors.yearsSports = 'سنوات ممارسة الرياضة مطلوبة';
    }
    if (
      formData.yearsCoaching === '' ||
      Number.isNaN(yc) ||
      yc < 0
    ) {
      newErrors.yearsCoaching = 'سنوات ممارسة التدريب مطلوبة';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coachingRegEnabled) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});
    try {
      await registerCoachingRegistration({
        ...formData,
        certificateFiles: formData.certificateFiles
      });
      setSubmitSuccess(true);
      setFormData(initialForm);
    } catch (err) {
      setErrors({
        submit: err.message || 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="national-championship-registration">
      <div className="glass-overlay" />
      <div className="registration-container">
        <header className="form-header">
          <div className="header-logos-row">
            <div className="header-logo-item">
              <img src={sportpourtoutes} alt="" className="header-logo" />
              <div className="federation-title">الاتحادية الوطنية للرياضة للجميع</div>
            </div>
            <div className="header-logo-item">
              <img src={logo1} alt="" className="header-logo" />
              <div className="ministry-title">وزارة الرياضة</div>
            </div>
            <div className="header-logo-item">
              <img src={nccLogo} alt="" className="header-logo ncc-logo" />
              <div className="ncc-title">اللجنة الوطنية للكلسثنكس</div>
            </div>
          </div>
          <div className="main-title-box">
            <h1 className="main-title">{coachingRegMainTitle}</h1>
            {coachingRegSubTitle.trim() ? (
              <div className="location-tag">{coachingRegSubTitle}</div>
            ) : null}
            {coachingRegStatusMessage ? (
              <div
                style={{
                  marginTop: '15px',
                  padding: '12px 20px',
                  background: coachingRegEnabled
                    ? 'rgba(105, 240, 174, 0.2)'
                    : 'rgba(255, 82, 82, 0.2)',
                  border: `2px solid ${coachingRegEnabled ? '#69f0ae' : '#ff5252'}`,
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '600',
                  textAlign: 'center'
                }}
              >
                {coachingRegStatusMessage}
              </div>
            ) : null}
          </div>
        </header>

        {submitSuccess &&
          createPortal(
            <div
              className="success-popup-overlay"
              onClick={() => setSubmitSuccess(false)}
            >
              <div
                className="success-popup"
                onClick={(ev) => ev.stopPropagation()}
              >
                <button
                  type="button"
                  className="success-popup-close"
                  onClick={() => setSubmitSuccess(false)}
                  aria-label="إغلاق"
                >
                  ×
                </button>
                <div className="success-popup-icon">
                  <i className="fas fa-check-circle" />
                </div>
                <h2 className="success-popup-title">تم إرسال الاستمارة بنجاح!</h2>
                <p className="success-popup-message">
                  سيتم مراجعة معلوماتك والاتصال بك عند الحاجة.
                </p>
                <button
                  type="button"
                  className="success-popup-button"
                  onClick={() => setSubmitSuccess(false)}
                >
                  موافق
                </button>
              </div>
            </div>,
            document.body
          )}

        <form onSubmit={handleSubmit} className="registration-form">
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">01</span>
              <h2 className="section-title">المعلومات الشخصية والأساسية</h2>
            </div>

            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-id-card subsection-icon" />
                <h3 className="subsection-title">الهوية والتواصل</h3>
              </div>
              <p className="subsection-desc">
                الاسم الكامل كما يظهر في بطاقة الهوية أو الجواز، ومعلومات التواصل
                المهنية.
              </p>
              <div className="input-grid">
                <div className="input-group full-width">
                  <label>الاسم الكامل *</label>
                  <input
                    type="text"
                    name="fullLegalName"
                    value={formData.fullLegalName}
                    onChange={handleInputChange}
                    placeholder="كما في الهوية أو الجواز"
                  />
                  {errors.fullLegalName && (
                    <span className="error-msg">{errors.fullLegalName}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>رقم الهاتف *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="0XXXXXXXXX"
                  />
                  {errors.phone && (
                    <span className="error-msg">{errors.phone}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>تاريخ الميلاد *</label>
                  <input
                    type="date"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleInputChange}
                  />
                  {errors.birthDate && (
                    <span className="error-msg">{errors.birthDate}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>مقاس التيشيرت *</label>
                  <select
                    name="tshirtSize"
                    value={formData.tshirtSize}
                    onChange={handleInputChange}
                  >
                    <option value="">اختر المقاس</option>
                    {TSHIRT_SIZES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.tshirtSize && (
                    <span className="error-msg">{errors.tshirtSize}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>البريد الإلكتروني</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@example.com"
                  />
                  {errors.email && (
                    <span className="error-msg">{errors.email}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>Instagram</label>
                  <input
                    type="text"
                    name="instagram"
                    value={formData.instagram}
                    onChange={handleInputChange}
                    placeholder="@username"
                  />
                </div>
                <div className="input-group">
                  <label>Facebook</label>
                  <input
                    type="text"
                    name="facebook"
                    value={formData.facebook}
                    onChange={handleInputChange}
                    placeholder="حساب أو رابط"
                  />
                </div>
                <div className="input-group">
                  <label>TikTok</label>
                  <input
                    type="text"
                    name="tiktok"
                    value={formData.tiktok}
                    onChange={handleInputChange}
                    placeholder="@username"
                  />
                </div>
                <div className="input-group">
                  <label>LinkedIn (اختياري)</label>
                  <input
                    type="text"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleInputChange}
                    placeholder="رابط الملف المهني"
                  />
                </div>
              </div>
            </div>

            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-map-marker-alt subsection-icon" />
                <h3 className="subsection-title">العنوان</h3>
              </div>
              <div className="input-grid">
                <div className="input-group">
                  <label>المدينة *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="المدينة"
                  />
                  {errors.city && (
                    <span className="error-msg">{errors.city}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>الولاية *</label>
                  <select
                    name="wilaya"
                    value={formData.wilaya}
                    onChange={handleInputChange}
                  >
                    <option value="">اختر الولاية</option>
                    {WILAYAS.map((w) => (
                      <option key={w.number} value={w.name}>
                        {String(w.number).padStart(2, '0')} - {w.name}
                      </option>
                    ))}
                  </select>
                  {errors.wilaya && (
                    <span className="error-msg">{errors.wilaya}</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-header">
              <span className="section-number">02</span>
              <h2 className="section-title">المؤهلات والاعتمادات التقنية</h2>
            </div>

            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-chalkboard-teacher subsection-icon" />
                <h3 className="subsection-title">صفة التدريب</h3>
              </div>
              <div className="input-grid">
                <div className="input-group">
                  <label>هل أنت مدرب؟ *</label>
                  <select
                    name="isTrainer"
                    value={formData.isTrainer}
                    onChange={handleInputChange}
                  >
                    <option value="">اختر</option>
                    <option value="yes">نعم</option>
                    <option value="no">لا</option>
                  </select>
                  {errors.isTrainer && (
                    <span className="error-msg">{errors.isTrainer}</span>
                  )}
                </div>
                {formData.isTrainer === 'yes' && (
                  <div className="input-group">
                    <label>عدد الرياضيين *</label>
                    <input
                      type="number"
                      name="athleteCount"
                      min="0"
                      step="1"
                      value={formData.athleteCount}
                      onChange={handleInputChange}
                      placeholder="العدد"
                    />
                    {errors.athleteCount && (
                      <span className="error-msg">{errors.athleteCount}</span>
                    )}
                  </div>
                )}
                <div className="input-group">
                  <label>فضاء التدريب *</label>
                  <select
                    name="trainingVenue"
                    value={formData.trainingVenue}
                    onChange={handleInputChange}
                  >
                    <option value="">اختر</option>
                    <option value="hall">قاعة</option>
                    <option value="outdoor_track">مضمار خارجي</option>
                  </select>
                  {errors.trainingVenue && (
                    <span className="error-msg">{errors.trainingVenue}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>كيفية النشاط *</label>
                  <select
                    name="activityMode"
                    value={formData.activityMode}
                    onChange={handleInputChange}
                  >
                    <option value="">اختر</option>
                    <option value="amateur_club">
                      نادي هاوي (جمعية رياضية)
                    </option>
                    <option value="private_gym">قاعة خاصة</option>
                    <option value="independent">حر</option>
                  </select>
                  {errors.activityMode && (
                    <span className="error-msg">{errors.activityMode}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-certificate subsection-icon" />
                <h3 className="subsection-title">الشهادات التدريبية</h3>
              </div>
              <p className="subsection-desc">
                تحميل نسخ ضوئية من الشهادات (وطنية أو دولية) — صور PNG أو JPEG،
                حتى 5 ميجابايت لكل ملف.
              </p>
              <div className="input-grid">
                <div className="input-group full-width">
                  <label>رفع الشهادات</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleCertificatesChange}
                    style={{ padding: '8px' }}
                  />
                  {errors.certificateFiles && (
                    <span className="error-msg">{errors.certificateFiles}</span>
                  )}
                  {formData.certificateFiles.length > 0 && (
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: '12px 0 0',
                        color: 'var(--text-dim)'
                      }}
                    >
                      {formData.certificateFiles.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            marginBottom: '8px',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '8px 12px',
                            borderRadius: '8px'
                          }}
                        >
                          <span>{f.name}</span>
                          <button
                            type="button"
                            onClick={() => removeCertificate(i)}
                            className="remove-btn"
                            style={{
                              padding: '6px 12px',
                              background: '#ff5252',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px'
                            }}
                          >
                            حذف
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-bullseye subsection-icon" />
                <h3 className="subsection-title">التخصص التدريبي *</h3>
              </div>
              <p className="subsection-desc">يمكن اختيار أكثر من تخصص.</p>
              <div
                className="input-grid"
                style={{ gridTemplateColumns: '1fr' }}
              >
                <div className="input-group full-width">
                  {SPECIALTIES.map((s) => (
                    <div
                      key={s.id}
                      className="custom-checkbox-wrapper"
                      style={{ marginBottom: '12px' }}
                    >
                      <label
                        className="custom-checkbox-label"
                        htmlFor={`spec-${s.id}`}
                      >
                        <div
                          className={`custom-checkbox ${
                            formData.trainingSpecialties.includes(s.id)
                              ? 'checked'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={`spec-${s.id}`}
                            className="custom-checkbox-input"
                            checked={formData.trainingSpecialties.includes(s.id)}
                            onChange={() => toggleSpecialty(s.id)}
                          />
                          {formData.trainingSpecialties.includes(s.id) && (
                            <i className="fas fa-check custom-checkbox-icon" />
                          )}
                        </div>
                        <span>{s.label}</span>
                      </label>
                    </div>
                  ))}
                  {errors.trainingSpecialties && (
                    <span className="error-msg">
                      {errors.trainingSpecialties}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-hourglass-half subsection-icon" />
                <h3 className="subsection-title">سنوات الخبرة</h3>
              </div>
              <div className="input-grid">
                <div className="input-group">
                  <label>سنوات ممارسة الرياضة *</label>
                  <input
                    type="number"
                    name="yearsSports"
                    min="0"
                    step="0.5"
                    value={formData.yearsSports}
                    onChange={handleInputChange}
                    placeholder="مثال: 5"
                  />
                  {errors.yearsSports && (
                    <span className="error-msg">{errors.yearsSports}</span>
                  )}
                </div>
                <div className="input-group">
                  <label>سنوات ممارسة التدريب *</label>
                  <input
                    type="number"
                    name="yearsCoaching"
                    min="0"
                    step="0.5"
                    value={formData.yearsCoaching}
                    onChange={handleInputChange}
                    placeholder="مثال: 2"
                  />
                  {errors.yearsCoaching && (
                    <span className="error-msg">{errors.yearsCoaching}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-trophy subsection-icon" />
                <h3 className="subsection-title">الإنجازات الرياضية</h3>
              </div>
              <p className="subsection-desc">
                هل شاركت في بطولات وطنية أو دولية؟ ما هي المراكز أو الإنجازات؟
              </p>
              <div className="input-grid">
                <div className="input-group full-width">
                  <textarea
                    name="achievementsTournaments"
                    value={formData.achievementsTournaments}
                    onChange={handleInputChange}
                    placeholder="صف مشاركاتك والمراكز (اختياري)"
                  />
                </div>
              </div>
            </div>
          </section>

          {errors.submit && (
            <div className="alert alert-danger">{errors.submit}</div>
          )}

          <div className="form-footer">
            <button
              type="submit"
              className="btn-submit"
              disabled={isSubmitting || !coachingRegEnabled}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" /> جاري الإرسال...
                </>
              ) : (
                'إرسال استمارة التدريب'
              )}
            </button>
          </div>
        </form>
      </div>
      <footer className="page-footer">
        <div className="footer-content">
          <p>اللجنة الوطنية للكليستينيكس © 2026 - جميع الحقوق محفوظة</p>
          <div className="developer-info">
            <span>
              Developed by <strong>Toufik Rahmani</strong>
            </span>
            <a
              href="https://www.instagram.com/toufik_titouu/?hl=fr"
              target="_blank"
              rel="noopener noreferrer"
              className="insta-link"
            >
              <i className="fab fa-instagram" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CoachingRegistration;
