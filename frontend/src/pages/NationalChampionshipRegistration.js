import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { registerAthlete } from '../services/api';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
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
import { getAllWilayas, getCompetitionDate, hasDateConflict, getConflictingWilayas, competitionSchedule } from '../data/competitionSchedule';
import { getCompetitionDetails } from '../data/competitionDetails';
import logo1 from '../imgs/logo1.png';
import sportpourtoutes from '../imgs/sportpourtouteLOGO.png';
import nccLogo from '../imgs/nccNewlogo.png';
import './NationalChampionshipRegistration.css';

// Registration period
const REGISTRATION_START = new Date('2026-01-01');
const REGISTRATION_END = new Date('2026-02-25');

// All Algerian wilayas in Arabic, sorted by wilaya number
const WILAYAS = [
  { number: 1, name: "أدرار" },
  { number: 2, name: "الشلف" },
  { number: 3, name: "الأغواط" },
  { number: 4, name: "أم البواقي" },
  { number: 5, name: "باتنة" },
  { number: 6, name: "بجاية" },
  { number: 7, name: "بسكرة" },
  { number: 8, name: "بشار" },
  { number: 9, name: "البليدة" },
  { number: 10, name: "البويرة" },
  { number: 11, name: "تمنراست" },
  { number: 12, name: "تبسة" },
  { number: 13, name: "تلمسان" },
  { number: 14, name: "تيارت" },
  { number: 15, name: "تيزي وزو" },
  { number: 16, name: "الجزائر العاصمة" },
  { number: 17, name: "الجلفة" },
  { number: 18, name: "جيجل" },
  { number: 19, name: "سطيف" },
  { number: 20, name: "سعيدة" },
  { number: 21, name: "سكيكدة" },
  { number: 22, name: "سيدي بلعباس" },
  { number: 23, name: "عنابة" },
  { number: 24, name: "قالمة" },
  { number: 25, name: "قسنطينة" },
  { number: 26, name: "المدية" },
  { number: 27, name: "مستغانم" },
  { number: 28, name: "المسيلة" },
  { number: 29, name: "معسكر" },
  { number: 30, name: "ورقلة" },
  { number: 31, name: "وهران" },
  { number: 32, name: "البيض" },
  { number: 33, name: "إيليزي" },
  { number: 34, name: "برج بوعريريج" },
  { number: 35, name: "بومرداس" },
  { number: 36, name: "الطارف" },
  { number: 37, name: "تندوف" },
  { number: 38, name: "تيسمسيلت" },
  { number: 39, name: "الوادي" },
  { number: 40, name: "خنشلة" },
  { number: 41, name: "سوق أهراس" },
  { number: 42, name: "تيبازة" },
  { number: 43, name: "ميلة" },
  { number: 44, name: "عين الدفلى" },
  { number: 45, name: "النعامة" },
  { number: 46, name: "عين تيموشنت" },
  { number: 47, name: "غرداية" },
  { number: 48, name: "غليزان" },
  { number: 49, name: "تيميمون" },
  { number: 50, name: "برج باجي مختار" },
  { number: 51, name: "أولاد جلال" },
  { number: 52, name: "بني عباس" },
  { number: 53, name: "عين صالح" },
  { number: 54, name: "عين قزام" },
  { number: 55, name: "تقرت" },
  { number: 56, name: "جانت" },
  { number: 57, name: "المغير" },
  { number: 58, name: "المنيعة" }
].sort((a, b) => a.number - b.number); 

const NationalChampionshipRegistration = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    birthPlace: '',
    gender: '',
    weight: '',
    competitionTypes: [''],
    ageCategory: '',
    weightCategory: '',
    address: {
      neighborhood: '',
      municipality: '',
      wilaya: '',
      zipCode: ''
    },
    clubName: '',
    trainsInClub: false,
    licenseNumber: '',
    phone: '',
    veteranVideoSent: false,
    firstCompetition: '',
    honoraryCompetitions: [],
    registrationType: 'regional_championship',
    tshirtSize: '',
    height: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    email: '',
    personalPicture: null,
    personalPictureUrl: '',
    bloodType: '',
    hasDisease: false,
    disease: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [registrationPeriodError, setRegistrationPeriodError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [mainTitle, setMainTitle] = useState('التسجيل في البطولات الولائية 2026');
  const [subTitle, setSubTitle] = useState('البطولات المؤهلة للبطولة الوطنية');
  const [isFirstCompetitionLocked, setIsFirstCompetitionLocked] = useState(false);

  const allWilayas = getAllWilayas();

  // Load registration settings from Firestore
  useEffect(() => {
    const loadRegistrationSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'registration'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setRegistrationEnabled(data.enabled !== false);
          setStatusMessage(data.statusMessage || '');
          setMainTitle(data.mainTitle || 'التسجيل في البطولات الولائية 2026');
          setSubTitle(data.subTitle || 'البطولات المؤهلة للبطولة الوطنية');
        }
      } catch (error) {
        console.error('Error loading registration settings:', error);
      }
    };
    loadRegistrationSettings();
  }, []);

  // Check registration period on component mount
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (today < REGISTRATION_START) {
      setRegistrationPeriodError('لم يفتح باب التسجيل بعد. يبدأ التسجيل في 01 جانفي 2026');
    } else if (today > REGISTRATION_END) {
      setRegistrationPeriodError('انتهت فترة التسجيل. كان آخر موعد للتسجيل 25 فبراير 2026');
    } else {
      setRegistrationPeriodError('');
    }
  }, []);

  // Calculate age and weight category when relevant fields change
  useEffect(() => {
    if (formData.birthDate && formData.competitionTypes[0]) {
      const age = calculateAge(formData.birthDate);
      if (age !== null && formData.competitionTypes[0]) {
        const isVeteran = isVeteranEligible(age, formData.competitionTypes[0]);
        const ageCat = getAgeCategory(age, formData.competitionTypes[0], isVeteran);
        setFormData(prev => ({ ...prev, ageCategory: ageCat || '' }));
      }
    }

    if (formData.gender && formData.weight && formData.competitionTypes[0]) {
      const weightCat = getWeightCategory(
        formData.gender,
        formData.weight,
        formData.competitionTypes[0]
      );
      setFormData(prev => ({ ...prev, weightCategory: weightCat || '' }));
    }
  }, [formData.birthDate, formData.gender, formData.weight, formData.competitionTypes]);

  // Auto-select and lock first competition when address wilaya has a competition
  useEffect(() => {
    if (formData.address.wilaya) {
      // Check if the address wilaya has a competition
      const hasCompetition = competitionSchedule.some(
        item => item.wilaya === formData.address.wilaya
      );
      
      if (hasCompetition) {
        // Auto-set and lock if firstCompetition is empty or different from address wilaya
        if (!formData.firstCompetition || formData.firstCompetition !== formData.address.wilaya) {
          setFormData(prev => ({
            ...prev,
            firstCompetition: formData.address.wilaya
          }));
          setIsFirstCompetitionLocked(true);
        } else if (formData.firstCompetition === formData.address.wilaya) {
          // Keep it locked if it matches
          setIsFirstCompetitionLocked(true);
        }
      } else {
        // If address wilaya doesn't have a competition, unlock it
        setIsFirstCompetitionLocked(false);
      }
    } else {
      // If no address wilaya is selected, unlock it
      setIsFirstCompetitionLocked(false);
    }
  }, [formData.address.wilaya, formData.firstCompetition]);

  const handleAddHonoraryCompetition = () => {
    setFormData(prev => ({
      ...prev,
      honoraryCompetitions: [...prev.honoraryCompetitions, '']
    }));
  };

  const handleRemoveHonoraryCompetition = (index) => {
    setFormData(prev => ({
      ...prev,
      honoraryCompetitions: prev.honoraryCompetitions.filter((_, i) => i !== index)
    }));
    // Clear error for this field
    if (errors[`honoraryCompetition_${index}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`honoraryCompetition_${index}`];
        return newErrors;
      });
    }
  };

  const handleHonoraryCompetitionChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      honoraryCompetitions: prev.honoraryCompetitions.map((comp, i) => 
        i === index ? value : comp
      )
    }));
    // Clear error for this field
    if (errors[`honoraryCompetition_${index}`]) {
      setErrors(prev => ({
        ...prev,
        [`honoraryCompetition_${index}`]: ''
      }));
    }
  };

  const handleAddCompetitionType = () => {
    setFormData(prev => ({
      ...prev,
      competitionTypes: [...prev.competitionTypes, '']
    }));
  };

  const handleRemoveCompetitionType = (index) => {
    setFormData(prev => ({
      ...prev,
      competitionTypes: prev.competitionTypes.filter((_, i) => i !== index)
    }));
    // Clear error for this field
    if (errors[`competitionType_${index}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`competitionType_${index}`];
        return newErrors;
      });
    }
  };

  const handleCompetitionTypeChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      competitionTypes: prev.competitionTypes.map((type, i) => 
        i === index ? value : type
      )
    }));
    // Clear error for this field
    if (errors[`competitionType_${index}`]) {
      setErrors(prev => ({
        ...prev,
        [`competitionType_${index}`]: ''
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked,
        // Clear disease field if checkbox is unchecked
        ...(name === 'hasDisease' && !checked ? { disease: '' } : {}),
        // Set clubName to "No club" if trainsInClub is unchecked
        ...(name === 'trainsInClub' && !checked ? { clubName: 'No club' } : {}),
        // Clear clubName if trainsInClub is checked
        ...(name === 'trainsInClub' && checked ? { clubName: '' } : {})
      }));
    } else if (type === 'file') {
      const file = files[0];
      if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setErrors(prev => ({
            ...prev,
            personalPicture: 'يجب أن يكون الملف صورة'
          }));
          return;
        }
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setErrors(prev => ({
            ...prev,
            personalPicture: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت'
          }));
          return;
        }
        setFormData(prev => ({
          ...prev,
          personalPicture: file
        }));
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
        // Clear error
        if (errors.personalPicture) {
          setErrors(prev => ({
            ...prev,
            personalPicture: ''
          }));
        }
      }
    } else if (name.startsWith('address.')) {
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

  // Function to scroll to first error field
  const scrollToFirstError = (errorKeys) => {
    if (errorKeys.length === 0) return;
    
    const firstErrorKey = errorKeys[0];
    let element = null;
    
    // Handle nested keys like 'address.wilaya'
    if (firstErrorKey.includes('.')) {
      const [parent, child] = firstErrorKey.split('.');
      element = document.querySelector(`[name="${parent}.${child}"]`);
    } else if (firstErrorKey.includes('_')) {
      // Handle keys like 'competitionType_0' or 'honoraryCompetition_0'
      const [fieldName, index] = firstErrorKey.split('_');
      if (fieldName === 'competitionType') {
        // Find the competition type select by looking for selects in the competition type section
        const form = document.querySelector('.registration-form');
        if (form) {
          // Competition type selects are usually the first ones in the form
          const competitionTypeSection = form.querySelector('.form-section:nth-of-type(2)');
          if (competitionTypeSection) {
            const selects = competitionTypeSection.querySelectorAll('select');
            if (selects[parseInt(index)]) {
              element = selects[parseInt(index)];
            }
          }
        }
      } else if (fieldName === 'honoraryCompetition') {
        const honorarySection = document.querySelector('.honorary-competitions-section');
        if (honorarySection) {
          const selects = honorarySection.querySelectorAll('select');
          if (selects[parseInt(index)]) {
            element = selects[parseInt(index)];
          }
        }
      } else if (fieldName === 'veteranVideoSent') {
        element = document.querySelector(`[name="veteranVideoSent"]`);
      }
    } else {
      element = document.querySelector(`[name="${firstErrorKey}"]`);
    }
    
    if (element) {
      // Scroll to the element
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus and highlight the element
      setTimeout(() => {
        element.focus();
        // Highlight the input group with shake animation
        const inputGroup = element.closest('.input-group');
        if (inputGroup) {
          inputGroup.style.animation = 'none';
          setTimeout(() => {
            inputGroup.style.animation = 'shake 0.5s ease-in-out';
            inputGroup.style.border = '2px solid var(--error)';
            inputGroup.style.borderRadius = '8px';
            inputGroup.style.padding = '5px';
            setTimeout(() => {
              inputGroup.style.border = '';
              inputGroup.style.padding = '';
            }, 2000);
          }, 10);
        }
      }, 500);
    } else {
      // Fallback: scroll to first error message
      const firstErrorMsg = document.querySelector('.error-msg');
      if (firstErrorMsg) {
        firstErrorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check registration period
    if (today < REGISTRATION_START || today > REGISTRATION_END) {
      return false;
    }

    // Personal & Address information validation
    if (!formData.firstName.trim()) newErrors.firstName = 'الاسم مطلوب';
    if (!formData.lastName.trim()) newErrors.lastName = 'اللقب مطلوب';
    if (!formData.birthDate) newErrors.birthDate = 'تاريخ الميلاد مطلوب';
    if (!formData.birthPlace.trim()) newErrors.birthPlace = 'مكان الميلاد مطلوب';
    if (!formData.phone.trim()) newErrors.phone = 'رقم الهاتف مطلوب';
    if (!formData.address.wilaya.trim()) newErrors['address.wilaya'] = 'الولاية مطلوبة';
    if (!formData.address.municipality.trim()) newErrors['address.municipality'] = 'البلدية مطلوبة';
    if (!formData.address.neighborhood.trim()) newErrors['address.neighborhood'] = 'العنوان مطلوب';

    // Competition details validation
    if (!formData.gender) newErrors.gender = 'الجنس مطلوب';
    if (!formData.weight || parseFloat(formData.weight) <= 0) newErrors.weight = 'الوزن مطلوب';
    if (!formData.height || parseFloat(formData.height) <= 0) newErrors.height = 'الطول مطلوب';
    if (!formData.tshirtSize) newErrors.tshirtSize = 'مقاس التيشيرت مطلوب';
    if (!formData.bloodType) newErrors.bloodType = 'فصيلة الدم مطلوبة';
    if (formData.hasDisease && !formData.disease.trim()) {
      newErrors.disease = 'يجب ذكر المرض أو الحالة الطبية';
    }
    // Email validation (optional, but if provided, must be valid format)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'صيغة البريد الإلكتروني غير صحيحة';
      }
    }
    if (!formData.competitionTypes[0] || !formData.competitionTypes[0].trim()) {
      newErrors.competitionType_0 = 'نوع المسابقة الأول مطلوب';
    }
    
    // Regional competition selection
    if (!formData.firstCompetition) newErrors.firstCompetition = 'يجب اختيار ولاية للمشاركة الرئيسية';
    
    // Validate honorary competitions
    const allSelectedCompetitions = [
      formData.firstCompetition,
      ...formData.honoraryCompetitions.filter(c => c)
    ];
    
    // Check for duplicates
    const uniqueCompetitions = new Set(allSelectedCompetitions);
    if (allSelectedCompetitions.length !== uniqueCompetitions.size) {
      formData.honoraryCompetitions.forEach((comp, index) => {
        if (comp && allSelectedCompetitions.filter(c => c === comp).length > 1) {
          newErrors[`honoraryCompetition_${index}`] = 'لا يمكن اختيار نفس الولاية مرتين';
        }
      });
    }
    
    // Check for date conflicts
    const selectedWilayas = allSelectedCompetitions.filter(c => c);
    if (selectedWilayas.length > 1) {
      if (hasDateConflict(selectedWilayas)) {
        const conflicts = getConflictingWilayas(selectedWilayas);
        formData.honoraryCompetitions.forEach((comp, index) => {
          if (conflicts.includes(comp)) {
            newErrors[`honoraryCompetition_${index}`] = 'لا يمكن اختيار ولايتين لهما نفس تاريخ المنافسة';
          }
        });
        if (conflicts.includes(formData.firstCompetition)) {
          newErrors.firstCompetition = 'لا يمكن اختيار ولايتين لهما نفس تاريخ المنافسة';
        }
      }
    }

    // Club & License info
    // Club name validation - required only if trainsInClub is true
    if (formData.trainsInClub && !formData.clubName.trim()) {
      newErrors.clubName = 'اسم النادي مطلوب';
    }
    // License number is now optional

    // Veteran video requirement
    if (formData.ageCategory === 'veteran' && !formData.veteranVideoSent) {
      newErrors.veteranVideoSent = 'يجب تأكيد إرسال الفيديو للمحاربين القدامى';
    }

    setErrors(newErrors);
    
    // Scroll to first error if validation fails
    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => {
        scrollToFirstError(Object.keys(newErrors));
      }, 100);
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }
    if (registrationPeriodError) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const competitions = [];
      if (formData.firstCompetition) {
        competitions.push({
          wilaya: formData.firstCompetition,
          date: getCompetitionDate(formData.firstCompetition),
          type: 'main'
        });
      }
      formData.honoraryCompetitions.forEach(comp => {
        if (comp) {
          competitions.push({
            wilaya: comp,
            date: getCompetitionDate(comp),
            type: 'honorary'
          });
        }
      });

      const athleteData = {
        ...formData,
        // Set clubName to "No club" if trainsInClub is false
        clubName: formData.trainsInClub ? formData.clubName : 'No club',
        competitionType: formData.competitionTypes[0], // Keep first for backward compatibility
        competitionTypes: formData.competitionTypes.filter(ct => ct && ct.trim()), // Filter out empty ones
        competitions: competitions,
        registrationDate: new Date().toISOString()
      };
      
      // Use a timeout to detect hang
      await registerAthlete(athleteData);

      setSubmitSuccess(true);
      setFormData({
        firstName: '',
        lastName: '',
        birthDate: '',
        birthPlace: '',
        gender: '',
        weight: '',
        competitionTypes: [''],
        ageCategory: '',
        weightCategory: '',
        address: {
          neighborhood: '',
          municipality: '',
          wilaya: '',
          zipCode: ''
        },
        clubName: '',
        trainsInClub: false,
        licenseNumber: '',
        phone: '',
        veteranVideoSent: false,
        firstCompetition: '',
        honoraryCompetitions: [],
        bloodType: '',
        registrationType: 'regional_championship',
        tshirtSize: '',
        height: '',
        instagram: '',
        facebook: '',
        tiktok: '',
        email: '',
        personalPicture: null,
        personalPictureUrl: '',
        hasDisease: false,
        disease: ''
      });
      setImagePreview(null);
      setErrors({});
    } catch (error) {
      setErrors({ submit: error.message || 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = () => {
      return (
        isSubmitting || 
        !registrationEnabled ||
        registrationPeriodError !== '' ||
        !formData.gender ||
        !formData.weight ||
        !formData.competitionTypes[0] ||
        !formData.firstCompetition
      );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'تاريخ غير محدد';
    const date = new Date(dateString);
    const day = date.getDate();
    const monthIndex = date.getMonth();
    
    const months = [
      'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 
      'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    return `${day} ${months[monthIndex]}`;
  };

  return (
    <div className="national-championship-registration">
      <div className="glass-overlay"></div>
      <div className="registration-container">
        <header className="form-header">
          <div className="header-logos-row">
            <div className="header-logo-item">
              <img src={sportpourtoutes} alt="Sport Pour Toutes" className="header-logo" />
              <div className="federation-title">الاتحادية الوطنية للرياضة للجميع</div>
            </div>
            <div className="header-logo-item">
              <img src={logo1} alt="Logo 1" className="header-logo" />
              <div className="ministry-title">وزارة الرياضة</div>
            </div>
            <div className="header-logo-item">
              <img src={nccLogo} alt="NCC Logo" className="header-logo ncc-logo" />
              <div className="ncc-title">اللجنة الوطنية للكلسثنكس</div>
            </div>
          </div>
          <div className="main-title-box">
            <h1 className="main-title">{mainTitle}</h1>
            <div className="location-tag">{subTitle}</div>
            {statusMessage && (
              <div style={{ 
                marginTop: '15px', 
                padding: '12px 20px', 
                background: registrationEnabled ? 'rgba(105, 240, 174, 0.2)' : 'rgba(255, 82, 82, 0.2)', 
                border: `2px solid ${registrationEnabled ? '#69f0ae' : '#ff5252'}`,
                borderRadius: '8px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                {statusMessage}
              </div>
            )}
          </div>
        </header>

        {registrationPeriodError && (
          <div className="alert alert-danger">
            <i className="fas fa-exclamation-triangle"></i> {registrationPeriodError}
          </div>
        )}

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
              <p className="success-popup-message">سيتم مراجعة طلبك والاتصال بك قريباً.</p>
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
          {/* Section 1: Personal & Address Info */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">01</span>
              <h2 className="section-title">المعلومات الشخصية والعنوان</h2>
            </div>
            
            {/* Subsection: Basic Personal Information */}
            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-user subsection-icon"></i>
                <h3 className="subsection-title">المعلومات الأساسية</h3>
              </div>
              <div className="input-grid">
                <div className="input-group">
                  <label>الاسم *</label>
                  <input type="text" name="firstName" placeholder="الاسم الأول" value={formData.firstName} onChange={handleInputChange} required />
                  {errors.firstName && <span className="error-msg">{errors.firstName}</span>}
                </div>

                <div className="input-group">
                  <label>اللقب *</label>
                  <input type="text" name="lastName" placeholder="اللقب العائلي" value={formData.lastName} onChange={handleInputChange} required />
                  {errors.lastName && <span className="error-msg">{errors.lastName}</span>}
                </div>

                <div className="input-group">
                  <label>تاريخ الميلاد *</label>
                  <input type="date" name="birthDate" value={formData.birthDate} onChange={handleInputChange} required />
                  {errors.birthDate && <span className="error-msg">{errors.birthDate}</span>}
                </div>

                <div className="input-group">
                  <label>مكان الميلاد *</label>
                  <input type="text" name="birthPlace" placeholder="البلدية، الولاية" value={formData.birthPlace} onChange={handleInputChange} required />
                  {errors.birthPlace && <span className="error-msg">{errors.birthPlace}</span>}
                </div>

                <div className="input-group">
                  <label>رقم الهاتف *</label>
                  <input type="tel" name="phone" placeholder="0XXXXXXXXX" value={formData.phone} onChange={handleInputChange} required />
                  {errors.phone && <span className="error-msg">{errors.phone}</span>}
                </div>
              </div>
            </div>

            {/* Subsection: Address Information */}
            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-map-marker-alt subsection-icon"></i>
                <h3 className="subsection-title">معلومات العنوان</h3>
              </div>
              <div className="input-grid">
                <div className="input-group">
                  <label>الولاية *</label>
                  <select name="address.wilaya" value={formData.address.wilaya} onChange={handleInputChange} required>
                    <option value="">اختر الولاية</option>
                    {WILAYAS.map(wilaya => (
                      <option key={wilaya.number} value={wilaya.name}>
                        {wilaya.number.toString().padStart(2, '0')} - {wilaya.name}
                      </option>
                    ))}
                  </select>
                  {errors['address.wilaya'] && <span className="error-msg">{errors['address.wilaya']}</span>}
                </div>

                <div className="input-group">
                  <label>البلدية *</label>
                  <input type="text" name="address.municipality" placeholder="البلدية" value={formData.address.municipality} onChange={handleInputChange} required />
                  {errors['address.municipality'] && <span className="error-msg">{errors['address.municipality']}</span>}
                </div>

                <div className="input-group full-width">
                  <label>الحي / العنوان بالتفصيل *</label>
                  <input type="text" name="address.neighborhood" placeholder="العنوان بالتفصيل" value={formData.address.neighborhood} onChange={handleInputChange} required />
                  {errors['address.neighborhood'] && <span className="error-msg">{errors['address.neighborhood']}</span>}
                </div>

                <div className="input-group">
                  <label>الرمز البريدي</label>
                  <input type="text" name="address.zipCode" placeholder="الرمز البريدي" value={formData.address.zipCode} onChange={handleInputChange} />
                  {errors['address.zipCode'] && <span className="error-msg">{errors['address.zipCode']}</span>}
                </div>
              </div>
            </div>

            {/* Subsection: Social Media (Optional) */}
            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-share-alt subsection-icon"></i>
                <h3 className="subsection-title">وسائل التواصل الاجتماعي (اختياري)</h3>
              </div>
              <p className="subsection-desc">يمكنك إضافة حساباتك على وسائل التواصل الاجتماعي</p>
              <div className="input-grid">
                <div className="input-group">
                  <label>Instagram</label>
                  <input type="text" name="instagram" placeholder="@username" value={formData.instagram} onChange={handleInputChange} />
                  {errors.instagram && <span className="error-msg">{errors.instagram}</span>}
                </div>

                <div className="input-group">
                  <label>Facebook</label>
                  <input type="text" name="facebook" placeholder="Facebook username" value={formData.facebook} onChange={handleInputChange} />
                  {errors.facebook && <span className="error-msg">{errors.facebook}</span>}
                </div>

                <div className="input-group">
                  <label>TikTok</label>
                  <input type="text" name="tiktok" placeholder="@username" value={formData.tiktok} onChange={handleInputChange} />
                  {errors.tiktok && <span className="error-msg">{errors.tiktok}</span>}
                </div>

                <div className="input-group">
                  <label>Email</label>
                  <input type="email" name="email" placeholder="email@example.com" value={formData.email} onChange={handleInputChange} />
                  {errors.email && <span className="error-msg">{errors.email}</span>}
                </div>
              </div>
            </div>

            {/* Subsection: Medical Information */}
            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-heartbeat subsection-icon"></i>
                <h3 className="subsection-title">المعلومات الطبية</h3>
              </div>
              <div className="input-grid">
                <div className="input-group">
                  <label>فصيلة الدم *</label>
                  <select name="bloodType" value={formData.bloodType} onChange={handleInputChange} required>
                    <option value="">اختر فصيلة الدم</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  {errors.bloodType && <span className="error-msg">{errors.bloodType}</span>}
                </div>

                <div className="input-group full-width">
                  <div className="custom-checkbox-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: formData.hasDisease ? '10px' : '0' }}>
                    <label className="custom-checkbox-label" htmlFor="hasDisease" style={{ margin: 0, cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className={`custom-checkbox ${formData.hasDisease ? 'checked' : ''}`}>
                        <input 
                          type="checkbox" 
                          id="hasDisease" 
                          name="hasDisease" 
                          checked={formData.hasDisease} 
                          onChange={handleInputChange}
                          className="custom-checkbox-input"
                        />
                        {formData.hasDisease && (
                          <i className="fas fa-check custom-checkbox-icon"></i>
                        )}
                      </div>
                      <span>هل تعاني من اي مرض؟</span>
                    </label>
                  </div>
                  {formData.hasDisease && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '8px' }}>اذكر المرض *</label>
                      <input 
                        type="text" 
                        name="disease" 
                        placeholder="اذكر المرض أو الحالة الطبية" 
                        value={formData.disease} 
                        onChange={handleInputChange}
                        style={{ width: '100%', padding: '14px 18px', background: 'rgba(255, 255, 255, 0.03)', border: '2px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', color: '#fff', fontSize: '16px', fontFamily: 'inherit', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxSizing: 'border-box' }}
                        required={formData.hasDisease}
                      />
                      {errors.disease && <span className="error-msg">{errors.disease}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subsection: Photo Upload */}
            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-camera subsection-icon"></i>
                <h3 className="subsection-title">الصورة الشخصية</h3>
              </div>
              <p className="subsection-desc">قم برفع صورتك الشخصية (اختياري)</p>
              <div className="input-grid">
                <div className="input-group full-width">
                  <label>رفع الصورة</label>
                  <input 
                    type="file" 
                    name="personalPicture" 
                    accept="image/*" 
                    onChange={handleInputChange}
                    style={{ padding: '8px' }}
                  />
                  {errors.personalPicture && <span className="error-msg">{errors.personalPicture}</span>}
                  {imagePreview && (
                    <div style={{ marginTop: '10px' }}>
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        style={{ 
                          maxWidth: '200px', 
                          maxHeight: '200px', 
                          borderRadius: '8px',
                          border: '2px solid #ddd'
                        }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Competition Selection */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">02</span>
              <h2 className="section-title">اختيار مكان المسابقة</h2>
            </div>
            <p className="section-desc">"يرجى العلم أن التأهل للبطولة الوطنية يتم حصراً عبر ولاية إقامة الرياضي، وفي حال عدم تنظيم بطولة فيها يمكنه المشاركة في أقرب ولاية مجاورة. كما يُسمح بالمشاركة في ولايات أخرى بصفة 'شرفية' دون احتساب النتائج للتأهل (يمكن حساب التأهل في حالات نادرة)."</p>
            
            <div className="input-grid">
              <div className="input-group">
                <label>نوع المسابقة *</label>
                {formData.competitionTypes.map((compType, index) => {
                  const availableTypes = Object.values(COMPETITION_TYPES).filter(type => 
                    !formData.competitionTypes.some((ct, i) => i !== index && ct === type)
                  );
                  
                  return (
                    <div key={index} style={{ marginBottom: index < formData.competitionTypes.length - 1 ? '15px' : '0' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <select 
                          value={compType} 
                          onChange={(e) => handleCompetitionTypeChange(index, e.target.value)}
                          required={index === 0}
                          style={{ flex: 1 }}
                        >
                          <option value="">{index === 0 ? 'اختر النوع (مطلوب)' : 'اختر النوع (اختياري)'}</option>
                          {availableTypes.map(type => (
                            <option key={type} value={type}>{getCompetitionTypeLabel(type)}</option>
                          ))}
                        </select>
                        {index > 0 && (
                          <button 
                            type="button"
                            onClick={() => handleRemoveCompetitionType(index)}
                            className="remove-btn"
                            style={{
                              padding: '8px 15px',
                              background: '#ff5252',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              flexShrink: 0
                            }}
                          >
                            <i className="fas fa-times"></i> حذف
                          </button>
                        )}
                      </div>
                      {errors[`competitionType_${index}`] && (
                        <span className="error-msg">{errors[`competitionType_${index}`]}</span>
                      )}
                    </div>
                  );
                })}
                {formData.competitionTypes.length < 3 && (
                  <button 
                    type="button"
                    onClick={handleAddCompetitionType}
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      background: 'var(--primary)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    <i className="fas fa-plus"></i> إضافة نوع مسابقة آخر
                  </button>
                )}
              </div>

              <div className="input-group">
                <label>الولاية (المسابقة الرئيسية) *</label>
                <select 
                  name="firstCompetition" 
                  value={formData.firstCompetition} 
                  onChange={handleInputChange} 
                  required
                  disabled={isFirstCompetitionLocked}
                  style={isFirstCompetitionLocked ? { 
                    backgroundColor: '#fff3cd', 
                    borderColor: '#ff8c00',
                    borderWidth: '2px',
                    cursor: 'not-allowed',
                    color: '#000',
                    fontWeight: '600',
                    opacity: 1
                  } : {}}
                >
                  <option value="">اختر الولاية</option>
                  {allWilayas.map(w => {
                    const competition = competitionSchedule.find(item => item.wilaya === w);
                    const wilayaNumber = competition ? competition.wilayaNumber : null;
                    return (
                      <option key={w} value={w}>
                        {wilayaNumber ? `${wilayaNumber.toString().padStart(2, '0')} - ` : ''}{w}
                      </option>
                    );
                  })}
                </select>
                {isFirstCompetitionLocked && (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '14px 18px',
                    fontSize: '16px', 
                    fontWeight: '700',
                    color: '#000',
                    backgroundColor: '#ff8c00',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(255, 140, 0, 0.5)',
                    border: '2px solid #e67e00'
                  }}>
                    <i className="fas fa-lock" style={{ fontSize: '18px', color: '#000' }}></i>
                    <span style={{ color: '#000', fontWeight: '700' }}>تم اختيار هذه الولاية تلقائياً بناءً على ولاية العنوان ولا يمكن تغييرها</span>
                  </div>
                )}
                {formData.firstCompetition && (() => {
                  const details = getCompetitionDetails(formData.firstCompetition);
                  const date = getCompetitionDate(formData.firstCompetition);
                  const hasAnyData = details && (details.responsibleName || details.phone || details.instagram || details.address || details.googleMapsLink);
                  
                  if (!hasAnyData) return null;
                  
                  return (
                    <div className="competition-details-card animate-pop-in" style={{ marginTop: '15px' }}>
                      <div className="competition-detail-item">
                        <i className="far fa-calendar-alt"></i>
                        <span><strong>تاريخ المسابقة:</strong> {formatDate(date)}</span>
                      </div>
                      {details && details.address && details.address.trim() !== "" && (
                        <div className="competition-detail-item">
                          <i className="fas fa-map-marker-alt"></i>
                          <span><strong>عنوان المسابقة:</strong> {details.address}</span>
                        </div>
                      )}
                      {details && details.googleMapsLink && details.googleMapsLink.trim() !== "" && (
                        <div className="competition-detail-item">
                          <i className="fab fa-google"></i>
                          <span>
                            <a 
                              href={details.googleMapsLink.startsWith('http') ? details.googleMapsLink : `https://${details.googleMapsLink}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ color: '#4285F4', textDecoration: 'none' }}
                            >
                              عرض على خرائط Google
                            </a>
                          </span>
                        </div>
                      )}
                      {details && details.responsibleName && (
                        <div className="competition-detail-item">
                          <i className="fas fa-user"></i>
                          <span><strong>المسؤول:</strong> {details.responsibleName}</span>
                        </div>
                      )}
                      {details && details.phone && details.phone.trim() !== "" && (
                        <div className="competition-detail-item">
                          <i className="fas fa-phone-alt"></i>
                          <span>
                            <a href={`tel:${details.phone}`} style={{ color: '#4CAF50', textDecoration: 'none' }}>
                              {details.phone}
                            </a>
                          </span>
                        </div>
                      )}
                      {details && details.instagram && details.instagram.trim() !== "" && (
                        <div className="competition-detail-item">
                          <i className="fab fa-instagram"></i>
                          <span>
                            <a 
                              href={details.instagram.startsWith('http') ? details.instagram : `https://instagram.com/${details.instagram.replace('@', '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ color: '#E4405F', textDecoration: 'none' }}
                            >
                              {details.instagram.includes('instagram.com/') ? details.instagram.split('instagram.com/')[1].split('?')[0] : details.instagram}
                            </a>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {errors.firstCompetition && <span className="error-msg">{errors.firstCompetition}</span>}
              </div>
            </div>

            <div className="honorary-competitions-section">
              <h3 className="honorary-title">
                <i className="fas fa-trophy"></i> المشاركات الشرفية (اختياري)
              </h3>
              <p className="honorary-desc">يمكنك إضافة مشاركات شرفية إضافية</p>
              
              {formData.honoraryCompetitions.map((comp, index) => {
                const firstCompetitionDate = formData.firstCompetition ? getCompetitionDate(formData.firstCompetition) : null;
                const availableWilayas = allWilayas.filter(w => {
                  // Exclude the first competition
                  if (w === formData.firstCompetition) return false;
                  // Exclude already selected honorary competitions
                  if (formData.honoraryCompetitions.some((c, i) => i !== index && c === w)) return false;
                  // Exclude competitions with the same date as first competition
                  if (firstCompetitionDate) {
                    const wDate = getCompetitionDate(w);
                    if (wDate && wDate === firstCompetitionDate) return false;
                  }
                  return true;
                });
                
                return (
                  <div key={index} className="honorary-competition-item">
                    <div className="input-group">
                      <label>مشاركة شرفية {index + 1}</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <select 
                          value={comp} 
                          onChange={(e) => handleHonoraryCompetitionChange(index, e.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="">اختر الولاية</option>
                          {availableWilayas.map(w => {
                            const competition = competitionSchedule.find(item => item.wilaya === w);
                            const wilayaNumber = competition ? competition.wilayaNumber : null;
                            return (
                              <option key={w} value={w}>
                                {wilayaNumber ? `${wilayaNumber.toString().padStart(2, '0')} - ` : ''}{w}
                              </option>
                            );
                          })}
                        </select>
                        <button 
                          type="button"
                          onClick={() => handleRemoveHonoraryCompetition(index)}
                          className="remove-btn"
                          style={{
                            padding: '8px 15px',
                            background: '#ff5252',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          <i className="fas fa-times"></i> حذف
                        </button>
                      </div>
                      {comp && (() => {
                        const details = getCompetitionDetails(comp);
                        const date = getCompetitionDate(comp);
                        const hasAnyData = details && (details.responsibleName || details.phone || details.instagram || details.address || details.googleMapsLink);
                        
                        if (!hasAnyData) return null;
                        
                        return (
                          <div className="competition-details-card animate-pop-in" style={{ marginTop: '10px' }}>
                            <div className="competition-detail-item">
                              <i className="far fa-calendar-alt"></i>
                              <span><strong>تاريخ المسابقة:</strong> {formatDate(date)}</span>
                            </div>
                            {details && details.address && details.address.trim() !== "" && (
                              <div className="competition-detail-item">
                                <i className="fas fa-map-marker-alt"></i>
                                <span><strong>عنوان المسابقة:</strong> {details.address}</span>
                              </div>
                            )}
                            {details && details.googleMapsLink && details.googleMapsLink.trim() !== "" && (
                              <div className="competition-detail-item">
                                <i className="fab fa-google"></i>
                                <span>
                                  <a 
                                    href={details.googleMapsLink.startsWith('http') ? details.googleMapsLink : `https://${details.googleMapsLink}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ color: '#4285F4', textDecoration: 'none' }}
                                  >
                                    عرض على خرائط Google
                                  </a>
                                </span>
                              </div>
                            )}
                            {details && details.responsibleName && details.responsibleName.trim() !== "" && (
                              <div className="competition-detail-item">
                                <i className="fas fa-user"></i>
                                <span><strong>المسؤول:</strong> {details.responsibleName}</span>
                              </div>
                            )}
                            {details && details.phone && details.phone.trim() !== "" && (
                              <div className="competition-detail-item">
                                <i className="fas fa-phone-alt"></i>
                                <span>
                                  <a href={`tel:${details.phone}`} style={{ color: '#4CAF50', textDecoration: 'none' }}>
                                    {details.phone}
                                  </a>
                                </span>
                              </div>
                            )}
                            {details && details.instagram && details.instagram.trim() !== "" && (
                              <div className="competition-detail-item">
                                <i className="fab fa-instagram"></i>
                                <span>
                                  <a 
                                    href={details.instagram.startsWith('http') ? details.instagram : `https://instagram.com/${details.instagram.replace('@', '')}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ color: '#E4405F', textDecoration: 'none' }}
                                  >
                                    {details.instagram.includes('instagram.com/') ? details.instagram.split('instagram.com/')[1].split('?')[0] : details.instagram}
                                  </a>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {errors[`honoraryCompetition_${index}`] && (
                        <span className="error-msg">{errors[`honoraryCompetition_${index}`]}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              <button 
                type="button"
                onClick={handleAddHonoraryCompetition}
                className="add-honorary-btn"
                style={{
                  marginTop: '15px',
                  padding: '12px 24px',
                  background: 'var(--primary)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fas fa-plus"></i> إضافة مشاركة شرف
              </button>
            </div>
          </section>

          {/* Section 3: Participation Details */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">03</span>
              <h2 className="section-title">تفاصيل المشاركة</h2>
            </div>
            
            {/* Subsection: Physical Details */}
            <div className="form-subsection">
              <div className="subsection-header">
                <i className="fas fa-ruler-combined subsection-icon"></i>
                <h3 className="subsection-title">القياسات الجسدية</h3>
              </div>
              <div className="input-grid">
                <div className="input-group">
                  <label>الجنس *</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                    <option value="">اختر الجنس</option>
                    <option value={GENDER.MALE}>Male (ذكر)</option>
                    <option value={GENDER.FEMALE}>Female (أنثى)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>الوزن الحالي (كجم) *</label>
                  <input type="number" name="weight" step="0.1" value={formData.weight} onChange={handleInputChange} required />
                </div>

                <div className="input-group">
                  <label>الطول (سم) *</label>
                  <input type="number" name="height" step="0.1" placeholder="الطول بالسنتيمتر" value={formData.height} onChange={handleInputChange} required />
                  {errors.height && <span className="error-msg">{errors.height}</span>}
                </div>

                <div className="input-group">
                  <label>مقاس التيشيرت *</label>
                  <select name="tshirtSize" value={formData.tshirtSize} onChange={handleInputChange} required>
                    <option value="">اختر المقاس</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                  {errors.tshirtSize && <span className="error-msg">{errors.tshirtSize}</span>}
                </div>
              </div>
            </div>

            {/* Subsection: Category Information */}
            {formData.weightCategory && formData.competitionTypes[0] && (
              <div className="form-subsection">
                <div className="subsection-header">
                  <i className="fas fa-trophy subsection-icon"></i>
                  <h3 className="subsection-title">الفئة المحددة</h3>
                </div>
                <div className="category-display animate-pop-in">
                  <div className="display-label">الفئة المختارة:</div>
                  <div className="display-value">
                    {getWeightCategoryLabel(formData.weightCategory, formData.gender, formData.competitionTypes[0])}
                  </div>
                </div>
              </div>
            )}

            {/* Subsection: Veteran Requirements */}
            {formData.ageCategory === 'veteran' && (
              <div className="form-subsection">
                <div className="subsection-header">
                  <i className="fas fa-user-shield subsection-icon"></i>
                  <h3 className="subsection-title">فئة المحاربين القدامى (Veterans)</h3>
                </div>
                <p className="subsection-desc">يجب إرسال فيديو للأداء (دقيقتين كحد أقصى) للمراجعة.</p>
                <div className="veteran-box animate-slide-up">
                  <div className="confirm-check">
                    <input type="checkbox" id="videoCheck" name="veteranVideoSent" checked={formData.veteranVideoSent} onChange={handleInputChange} />
                    <label htmlFor="videoCheck">أؤكد أنني قمت بإرسال الفيديو للمراجعة *</label>
                  </div>
                  {errors.veteranVideoSent && <span className="error-msg">{errors.veteranVideoSent}</span>}
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Club & License Info */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">04</span>
              <h2 className="section-title">معلومات النادي والترخيص</h2>
            </div>
            <div className="input-grid">
              <div className="input-group full-width">
                <div className="custom-checkbox-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: formData.trainsInClub ? '10px' : '0' }}>
                  <label className="custom-checkbox-label" htmlFor="trainsInClub" style={{ margin: 0, cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={`custom-checkbox ${formData.trainsInClub ? 'checked' : ''}`}>
                      <input 
                        type="checkbox" 
                        id="trainsInClub" 
                        name="trainsInClub" 
                        checked={formData.trainsInClub} 
                        onChange={handleInputChange}
                        className="custom-checkbox-input"
                      />
                      {formData.trainsInClub && (
                        <i className="fas fa-check custom-checkbox-icon"></i>
                      )}
                    </div>
                    <span>هل تتدرب في نادي؟</span>
                  </label>
                </div>
                {formData.trainsInClub && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>اسم النادي *</label>
                    <input 
                      type="text" 
                      name="clubName" 
                      placeholder="اسم النادي الذي تتدرب به" 
                      value={formData.clubName} 
                      onChange={handleInputChange} 
                      required={formData.trainsInClub}
                    />
                    {errors.clubName && <span className="error-msg">{errors.clubName}</span>}
                  </div>
                )}
              </div>

              <div className="input-group">
                <label>رقم الإجازة</label>
                <input type="text" name="licenseNumber" placeholder="رقم الإجازة الرياضية (اختياري)" value={formData.licenseNumber} onChange={handleInputChange} />
                {errors.licenseNumber && <span className="error-msg">{errors.licenseNumber}</span>}
              </div>
            </div>
          </section>

          {errors.submit && <div className="alert alert-danger">{errors.submit}</div>}

          <div className="form-footer">
            <button type="submit" className="btn-submit" disabled={isSubmitDisabled()}>
              {isSubmitting ? <><span className="spinner"></span> جاري المعالجة...</> : 'تأكيد التسجيل النهائي'}
            </button>
          </div>
        </form>
      </div>
      <footer className="page-footer">
        <div className="footer-content">
          <p>اللجنة الوطنية للكليستينيكس © 2026 - جميع الحقوق محفوظة</p>
          <div className="developer-info">
            <span>Developed by <strong>Toufik Rahmani</strong></span>
            <a href="https://www.instagram.com/toufik_titouu/?hl=fr" target="_blank" rel="noopener noreferrer" className="insta-link">
              <i className="fab fa-instagram"></i>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NationalChampionshipRegistration;
