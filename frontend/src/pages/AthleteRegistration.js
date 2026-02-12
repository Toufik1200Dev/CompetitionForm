import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { competitionSchedule, getAllWilayas, hasDateConflict, getConflictingWilayas } from '../data/competitionSchedule';
import { registerAthlete } from '../services/api';
import {
  GENDER,
  COMPETITION_TYPES,
  getWeightCategory,
  getWeightCategoryLabel,
  getCompetitionTypeLabel,
  calculateAge,
  isVeteranEligible,
  getAgeCategory
} from '../utils/competitionCategories';
import './AthleteRegistration.css';

const AthleteRegistration = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    birthPlace: '',
    gender: '',
    weight: '',
    competitionType: '',
    ageCategory: '',
    weightCategory: '',
    address: {
      neighborhood: '',
      municipality: '',
      wilaya: ''
    },
    competitions: []
  });

  const [selectedWilayas, setSelectedWilayas] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [dateConflictError, setDateConflictError] = useState('');

  const allWilayas = getAllWilayas();

  // Calculate age and weight category when relevant fields change
  useEffect(() => {
    if (formData.birthDate) {
      const age = calculateAge(formData.birthDate);
      if (age !== null && formData.competitionType) {
        const isVeteran = isVeteranEligible(age, formData.competitionType);
        const ageCat = getAgeCategory(age, formData.competitionType, isVeteran);
        setFormData(prev => ({ ...prev, ageCategory: ageCat || '' }));
      }
    }

    if (formData.gender && formData.weight && formData.competitionType) {
      const weightCat = getWeightCategory(
        formData.gender,
        formData.weight,
        formData.competitionType
      );
      setFormData(prev => ({ ...prev, weightCategory: weightCat || '' }));
    }
  }, [formData.birthDate, formData.gender, formData.weight, formData.competitionType]);

  // Validate date conflicts when selectedWilayas changes
  useEffect(() => {
    if (selectedWilayas.length > 1) {
      if (hasDateConflict(selectedWilayas)) {
        setDateConflictError('لا يمكنك اختيار ولايتين لهما نفس تاريخ المنافسة');
      } else {
        setDateConflictError('');
      }
    } else {
      setDateConflictError('');
    }
  }, [selectedWilayas]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleWilayaToggle = (wilaya) => {
    setSelectedWilayas(prev => {
      const isSelected = prev.includes(wilaya);
      
      if (isSelected) {
        // Remove wilaya
        const newSelection = prev.filter(w => w !== wilaya);
        return newSelection;
      } else {
        // Add wilaya
        const newSelection = [...prev, wilaya];
        
        // Check for conflicts before adding
        if (newSelection.length > 1 && hasDateConflict(newSelection)) {
          setDateConflictError('لا يمكنك اختيار ولايتين لهما نفس تاريخ المنافسة');
        } else {
          setDateConflictError('');
        }
        
        return newSelection;
      }
    });
  };

  const scrollToFirstError = (errorKeys) => {
    if (errorKeys.length === 0) return;
    const firstErrorKey = errorKeys[0];
    let element = null;
    if (firstErrorKey.includes('.')) {
      element = document.getElementById(firstErrorKey) || document.querySelector(`[name="${firstErrorKey}"]`);
    } else if (firstErrorKey === 'competitions') {
      const section = document.querySelector('.wilaya-selection') || document.querySelector('.form-section:last-of-type');
      element = section;
    } else {
      element = document.getElementById(firstErrorKey) || document.querySelector(`[name="${firstErrorKey}"]`);
    }
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        if (element.focus && typeof element.focus === 'function') element.focus();
        const formGroup = element.closest('.form-group');
        if (formGroup) {
          formGroup.style.animation = 'none';
          setTimeout(() => {
            formGroup.style.animation = 'shake 0.5s ease-in-out';
            formGroup.style.outline = '2px solid #f44336';
            formGroup.style.outlineOffset = '4px';
            setTimeout(() => {
              formGroup.style.outline = '';
              formGroup.style.outlineOffset = '';
            }, 2000);
          }, 10);
        }
      }, 400);
    } else {
      const firstErrorMsg = document.querySelector('.error-message');
      if (firstErrorMsg) firstErrorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'الاسم مطلوب';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'اللقب مطلوب';
    }

    if (!formData.birthDate) {
      newErrors.birthDate = 'تاريخ الميلاد مطلوب';
    }

    if (!formData.birthPlace.trim()) {
      newErrors.birthPlace = 'مكان الميلاد مطلوب';
    }

    if (!formData.gender) {
      newErrors.gender = 'الجنس مطلوب';
    }

    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      newErrors.weight = 'الوزن مطلوب';
    }

    if (!formData.competitionType) {
      newErrors.competitionType = 'نوع المسابقة مطلوب';
    }

    // Validate age (must be 18+)
    if (formData.birthDate) {
      const age = calculateAge(formData.birthDate);
      if (age !== null && age < 18) {
        newErrors.birthDate = 'يجب أن يكون العمر 18 سنة أو أكثر';
      }
    }

    // Validate veteran requirements
    if (formData.ageCategory === 'veteran') {
      // Note: Video requirement is handled via notice, not validation
    }

    if (!formData.address.neighborhood.trim()) {
      newErrors['address.neighborhood'] = 'الحي مطلوب';
    }

    if (!formData.address.municipality.trim()) {
      newErrors['address.municipality'] = 'البلدية مطلوبة';
    }

    if (!formData.address.wilaya.trim()) {
      newErrors['address.wilaya'] = 'الولاية مطلوبة';
    }

    if (selectedWilayas.length === 0) {
      newErrors.competitions = 'يجب اختيار ولاية واحدة على الأقل';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => scrollToFirstError(Object.keys(newErrors)), 100);
    }
    return Object.keys(newErrors).length === 0 && !dateConflictError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (dateConflictError) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Build competitions array with dates
      const competitions = selectedWilayas.map(wilaya => {
        const competition = competitionSchedule.find(item => item.wilaya === wilaya);
        return {
          wilaya: wilaya,
          date: competition ? competition.date : null,
          location: competition ? competition.location : null
        };
      });

      const athleteData = {
        ...formData,
        competitions: competitions
      };

      // Save directly to Firebase Firestore
      await registerAthlete(athleteData);

      setSubmitSuccess(true);
      setFormData({
        firstName: '',
        lastName: '',
        birthDate: '',
        birthPlace: '',
        gender: '',
        weight: '',
        competitionType: '',
        ageCategory: '',
        weightCategory: '',
        address: {
          neighborhood: '',
          municipality: '',
          wilaya: ''
        },
        competitions: []
      });
      setSelectedWilayas([]);
      setDateConflictError('');
    } catch (error) {
      const errorMessage = error.message || 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = () => {
    return (
      isSubmitting || 
      dateConflictError !== '' || 
      selectedWilayas.length === 0 ||
      !formData.gender ||
      !formData.weight ||
      !formData.competitionType ||
      !formData.weightCategory
    );
  };

  return (
    <div className="athlete-registration">
      <div className="registration-container">
        <div className="header">
          <h1>وزارة الرياضة</h1>
          <h2>الاتحادية الوطنية للرياضة للجميع</h2>
          <h3>اللجنة الوطنية للكليستينيكس</h3>
          <h4>نموذج تسجيل الرياضيين - البطولات الولائية</h4>
          <p className="header-note">
            الفائزون في البطولات الولائية (المراكز 1-5) يتأهلون للبطولة الوطنية في الجزائر العاصمة (26-28 مارس 2026)
          </p>
          <p className="registration-dates">
            <strong>فترة التسجيل:</strong> من 01 جانفي 2026 إلى 25 فبراير 2026
          </p>
        </div>

        {submitSuccess && createPortal(
          <div className="success-popup-overlay" onClick={() => setSubmitSuccess(false)}>
            <div className="success-popup" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="success-popup-close"
                onClick={() => setSubmitSuccess(false)}
                aria-label="إغلاق"
              >
                ×
              </button>
              <div className="success-popup-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <h2 className="success-popup-title">تم التسجيل بنجاح!</h2>
              <p className="success-popup-message">تم استلام طلبك بنجاح.</p>
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
          {/* Personal Information Section */}
          <section className="form-section">
            <h3 className="section-title">المعلومات الشخصية</h3>
            
            <div className="form-group">
              <label htmlFor="firstName">الاسم *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={errors.firstName ? 'error' : ''}
                required
              />
              {errors.firstName && <span className="error-message">{errors.firstName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">اللقب *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={errors.lastName ? 'error' : ''}
                required
              />
              {errors.lastName && <span className="error-message">{errors.lastName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="birthDate">تاريخ الميلاد *</label>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleInputChange}
                className={errors.birthDate ? 'error' : ''}
                required
              />
              {errors.birthDate && <span className="error-message">{errors.birthDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="birthPlace">مكان الميلاد *</label>
              <input
                type="text"
                id="birthPlace"
                name="birthPlace"
                value={formData.birthPlace}
                onChange={handleInputChange}
                className={errors.birthPlace ? 'error' : ''}
                required
              />
              {errors.birthPlace && <span className="error-message">{errors.birthPlace}</span>}
            </div>
          </section>

          {/* Competition Details Section */}
          <section className="form-section">
            <h3 className="section-title">تفاصيل المسابقة</h3>
            
            <div className="form-group">
              <label htmlFor="gender">الجنس *</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className={errors.gender ? 'error' : ''}
                required
              >
                <option value="">اختر الجنس</option>
                <option value={GENDER.MALE}>رجال</option>
                <option value={GENDER.FEMALE}>نساء</option>
              </select>
              {errors.gender && <span className="error-message">{errors.gender}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="weight">الوزن (كجم) *</label>
              <input
                type="number"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                min="0"
                step="0.1"
                className={errors.weight ? 'error' : ''}
                required
              />
              {errors.weight && <span className="error-message">{errors.weight}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="competitionType">نوع المسابقة *</label>
              <select
                id="competitionType"
                name="competitionType"
                value={formData.competitionType}
                onChange={handleInputChange}
                className={errors.competitionType ? 'error' : ''}
                required
              >
                <option value="">اختر نوع المسابقة</option>
                <option value={COMPETITION_TYPES.FREESTYLE}>
                  {getCompetitionTypeLabel(COMPETITION_TYPES.FREESTYLE)}
                </option>
                <option value={COMPETITION_TYPES.POWER_LIFTING}>
                  {getCompetitionTypeLabel(COMPETITION_TYPES.POWER_LIFTING)}
                </option>
                <option value={COMPETITION_TYPES.STRENGTH_ENDURANCE}>
                  {getCompetitionTypeLabel(COMPETITION_TYPES.STRENGTH_ENDURANCE)}
                </option>
              </select>
              {errors.competitionType && <span className="error-message">{errors.competitionType}</span>}
            </div>

            {formData.weightCategory && (
              <div className="form-group info-display">
                <label>فئة الوزن:</label>
                <div className="info-value">
                  {getWeightCategoryLabel(
                    formData.weightCategory,
                    formData.gender,
                    formData.competitionType
                  )}
                </div>
              </div>
            )}

            {formData.gender && formData.competitionType && !formData.weightCategory && (
              <div className="weight-info-box">
                <strong>فئات الوزن:</strong>
                {formData.competitionType === COMPETITION_TYPES.FREESTYLE ? (
                  formData.gender === GENDER.MALE ? (
                    <ul>
                      <li>خفيف: أقل من 68 كجم</li>
                      <li>متوسط: 68 - 80 كجم</li>
                      <li>ثقيل: أكثر من 80 كجم</li>
                    </ul>
                  ) : (
                    <ul>
                      <li>خفيف: أقل من 50 كجم</li>
                      <li>متوسط: 50 - 60 كجم</li>
                      <li>ثقيل: أكثر من 60 كجم</li>
                    </ul>
                  )
                ) : (
                  formData.gender === GENDER.MALE ? (
                    <ul>
                      <li>خفيف: أقل من 80 كجم</li>
                      <li>متوسط: 80 - 90 كجم</li>
                      <li>ثقيل: أكثر من 90 كجم</li>
                    </ul>
                  ) : (
                    <ul>
                      <li>فئة مطلقة (بدون تقسيم أوزان)</li>
                    </ul>
                  )
                )}
              </div>
            )}

            {formData.ageCategory && (
              <div className="form-group info-display">
                <label>الفئة العمرية:</label>
                <div className="info-value">
                  {formData.ageCategory === 'veteran' ? 'محارب قديم (Veteran)' : 'عادي'}
                </div>
              </div>
            )}

            {formData.ageCategory === 'veteran' && (
              <div className="veteran-notice">
                <strong>ملاحظة للمحاربين القدامى:</strong>
                <p>
                  يجب إرسال فيديو للأداء (دقيقتين كحد أقصى) إلى البريد الإلكتروني للمراجعة قبل التسجيل الرسمي.
                </p>
              </div>
            )}

            {formData.birthDate && calculateAge(formData.birthDate) !== null && (
              <div className="form-group info-display">
                <label>العمر:</label>
                <div className="info-value">
                  {calculateAge(formData.birthDate)} سنة
                </div>
              </div>
            )}
          </section>

          {/* Address Section */}
          <section className="form-section">
            <h3 className="section-title">العنوان</h3>
            
            <div className="form-group">
              <label htmlFor="address.neighborhood">الحي *</label>
              <input
                type="text"
                id="address.neighborhood"
                name="address.neighborhood"
                value={formData.address.neighborhood}
                onChange={handleInputChange}
                className={errors['address.neighborhood'] ? 'error' : ''}
                required
              />
              {errors['address.neighborhood'] && (
                <span className="error-message">{errors['address.neighborhood']}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="address.municipality">البلدية *</label>
              <input
                type="text"
                id="address.municipality"
                name="address.municipality"
                value={formData.address.municipality}
                onChange={handleInputChange}
                className={errors['address.municipality'] ? 'error' : ''}
                required
              />
              {errors['address.municipality'] && (
                <span className="error-message">{errors['address.municipality']}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="address.wilaya">الولاية *</label>
              <input
                type="text"
                id="address.wilaya"
                name="address.wilaya"
                value={formData.address.wilaya}
                onChange={handleInputChange}
                className={errors['address.wilaya'] ? 'error' : ''}
                required
              />
              {errors['address.wilaya'] && (
                <span className="error-message">{errors['address.wilaya']}</span>
              )}
            </div>
          </section>

          {/* Competition Selection Section */}
          <section className="form-section">
            <h3 className="section-title">اختيار المسابقات</h3>
            <p className="section-description">
              اختر الولاية / الولايات التي تريد المنافسة فيها
            </p>

            <div className="wilaya-selection">
              {allWilayas.map(wilaya => {
                const competition = competitionSchedule.find(item => item.wilaya === wilaya);
                const isSelected = selectedWilayas.includes(wilaya);
                const conflictingWilayas = getConflictingWilayas(selectedWilayas);
                const isConflicting = conflictingWilayas.includes(wilaya);
                
                return (
                  <div key={wilaya} className="wilaya-option">
                    <label className={`wilaya-checkbox ${isSelected ? 'selected' : ''} ${isConflicting ? 'conflicting' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleWilayaToggle(wilaya)}
                      />
                      <span className="wilaya-name">{wilaya}</span>
                      {competition && competition.date && (
                        <span className="competition-date">
                          ({new Date(competition.date).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })})
                        </span>
                      )}
                      {competition && !competition.date && (
                        <span className="no-date">(تاريخ غير محدد)</span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>

            {dateConflictError && (
              <div className="error-message conflict-error">{dateConflictError}</div>
            )}

            {errors.competitions && (
              <div className="error-message">{errors.competitions}</div>
            )}
          </section>

          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitDisabled()}
            >
              {isSubmitting ? 'جاري التسجيل...' : 'تسجيل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AthleteRegistration;
