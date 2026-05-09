import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import LicenseCard from '../components/LicenseCard';
import {
  updateAthlete,
  deleteAthlete,
  updateAthleteWeightCategory,
  updateCoachingRegistration,
  deleteCoachingRegistration
} from '../services/api';
import { competitionDetails } from '../data/competitionDetails';
import { WILAYAS } from '../data/wilayas';
import { COMPETITION_TYPES, getCompetitionTypeLabel, getWeightCategory } from '../utils/competitionCategories';
import { buildPublicProfileUrl } from '../config/publicSite';
import './AdminPanel.css';

const WEIGHT_CATEGORIES = [
  { value: 'light', label: 'خفيف' },
  { value: 'medium', label: 'متوسط' },
  { value: 'heavy', label: 'ثقيل' },
  { value: 'open', label: 'مطلقة' }
];

const WILAYA_OPTIONS = Object.keys(competitionDetails).sort((a, b) => a.localeCompare(b, 'ar'));

const TRAINING_VENUE_LABELS = {
  hall: 'قاعة',
  outdoor_track: 'مضمار خارجي'
};

const ACTIVITY_MODE_LABELS = {
  amateur_club: 'نادي هاوي (جمعية رياضية)',
  private_gym: 'قاعة خاصة',
  independent: 'حر'
};

const SPECIALTY_LABELS = {
  freestyle: 'Freestyle (فردي)',
  strength: 'Strength (قوة)',
  power: 'Power (التحمل)'
};

const COACHING_SPECIALTY_IDS = ['freestyle', 'strength', 'power'];

const COACHING_EXPORT_HEADERS = [
  'Full Name',
  'Is Coach',
  'Phone Number',
  'Birth Date',
  'Tshirt Size',
  'Wilaya',
  'Email',
  'Years of Training',
  'Years of Coaching',
  'Athletes Coached'
];

const AdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [showLicenseCard, setShowLicenseCard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [mainTitle, setMainTitle] = useState('التسجيل في البطولات الولائية 2026');
  const [subTitle, setSubTitle] = useState('البطولات المؤهلة للبطولة الوطنية');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCompetitionType, setFilterCompetitionType] = useState('');
  const [filterWeightCategory, setFilterWeightCategory] = useState('');
  const [filterWilaya, setFilterWilaya] = useState('');
  const [isUpdatingWeightCategories, setIsUpdatingWeightCategories] = useState(false);
  const [adminTab, setAdminTab] = useState('athletes');
  const [coachingList, setCoachingList] = useState([]);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingSearch, setCoachingSearch] = useState('');
  const [publicSearch, setPublicSearch] = useState('');
  const [selectedCoaching, setSelectedCoaching] = useState(null);
  const [coachingPage, setCoachingPage] = useState(1);
  const [filterCoachingTrainer, setFilterCoachingTrainer] = useState('');
  const [filterCoachingWilaya, setFilterCoachingWilaya] = useState('');
  const [editingCoaching, setEditingCoaching] = useState(null);
  const [editCoachingFormData, setEditCoachingFormData] = useState({});
  const [isDeletingCoaching, setIsDeletingCoaching] = useState(false);
  const [coachingSaveLoading, setCoachingSaveLoading] = useState(false);
  const [coachingRegEnabled, setCoachingRegEnabled] = useState(true);
  const [coachingRegStatusMessage, setCoachingRegStatusMessage] = useState('');
  const [coachingRegMainTitle, setCoachingRegMainTitle] = useState(
    'تسجيل المدربين والتأهيل التدريبي'
  );
  const [coachingRegSubTitle, setCoachingRegSubTitle] = useState('');

  const ITEMS_PER_PAGE = 20;
  const ADMIN_EMAIL = 'rayaclub.dz@gmail.com';
  const ADMIN_PASSWORD = 'Calisthenics1200@';

  // Check localStorage on component mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
      fetchParticipants();
      loadRegistrationSettings();
    }
  }, []);

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCompetitionType, filterWeightCategory, filterWilaya]);

  useEffect(() => {
    setCoachingPage(1);
  }, [coachingSearch, filterCoachingTrainer, filterCoachingWilaya]);

  const fetchCoachingRegistrations = async () => {
    try {
      setCoachingLoading(true);
      const q = query(
        collection(db, 'coaching_registrations'),
        orderBy('registrationDate', 'desc')
      );
      const snap = await getDocs(q);
      setCoachingList(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }))
      );
      setCoachingPage(1);
    } catch (err) {
      console.error(err);
      alert('تعذر تحميل تسجيلات التدريب.');
    } finally {
      setCoachingLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && adminTab === 'coaching') {
      fetchCoachingRegistrations();
      loadCoachingRegistrationSettings();
    }
  }, [isAuthenticated, adminTab]);

  useEffect(() => {
    if (!isAuthenticated || adminTab !== 'public') return;
    if (participants.length === 0) {
      fetchParticipants();
    }
    if (coachingList.length === 0) {
      fetchCoachingRegistrations();
    }
  }, [isAuthenticated, adminTab, participants.length, coachingList.length]);

  const filteredCoaching = useMemo(() => {
    let list = coachingList;
    const s = coachingSearch.trim().toLowerCase();
    if (s) {
      list = list.filter((c) => {
        const hay = [
          c.fullLegalName,
          c.phone,
          c.email,
          c.city,
          c.wilaya,
          (c.trainingSpecialties || []).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(s);
      });
    }
    if (filterCoachingTrainer) {
      list = list.filter((c) => c.isTrainer === filterCoachingTrainer);
    }
    if (filterCoachingWilaya) {
      list = list.filter((c) => (c.wilaya || '') === filterCoachingWilaya);
    }
    return list;
  }, [
    coachingList,
    coachingSearch,
    filterCoachingTrainer,
    filterCoachingWilaya
  ]);

  const formatCoachingBirthForExport = (c) => {
    if (!c.birthDate) return '';
    try {
      const d = c.birthDate.toDate ? c.birthDate.toDate() : new Date(c.birthDate);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('ar-DZ');
    } catch {
      return '';
    }
  };

  const getCoachingExportRow = (c) => {
    const isCoach =
      c.isTrainer === 'yes' ? 'Yes' : c.isTrainer === 'no' ? 'No' : '';
    const athletesCoached =
      c.isTrainer === 'yes' && c.athleteCount != null && c.athleteCount !== ''
        ? String(c.athleteCount)
        : '';
    return {
      'Full Name': c.fullLegalName || '',
      'Is Coach': isCoach,
      'Phone Number': c.phone || '',
      'Birth Date': formatCoachingBirthForExport(c),
      'Tshirt Size': c.tshirtSize || '',
      Wilaya: c.wilaya || '',
      Email: c.email || '',
      'Years of Training': c.yearsSports != null ? c.yearsSports : '',
      'Years of Coaching': c.yearsCoaching != null ? c.yearsCoaching : '',
      'Athletes Coached': athletesCoached
    };
  };

  const exportCoachingToExcel = () => {
    const list = filteredCoaching;
    if (list.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }
    const headers = COACHING_EXPORT_HEADERS;
    const rows = list.map((c) => getCoachingExportRow(c));
    const tableRows = rows
      .map(
        (r) =>
          '<tr>' +
          headers.map((h) => `<td>${escapeHtml(r[h])}</td>`).join('') +
          '</tr>'
      )
      .join('');
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Coaching</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:6px 8px;text-align:right;} th{background:#1a237e;color:#fff;}</style>
</head>
<body>
<table>
<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
</body>
</html>`;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coaching-list-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCoachingToWord = () => {
    const list = filteredCoaching;
    if (list.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }
    const headers = COACHING_EXPORT_HEADERS;
    const rows = list.map((c) => getCoachingExportRow(c));
    const tableRows = rows
      .map(
        (r) =>
          '<tr>' +
          headers.map((h) => `<td>${escapeHtml(r[h])}</td>`).join('') +
          '</tr>'
      )
      .join('');
    const colCount = headers.length;
    const colgroup =
      '<colgroup>' +
      Array(colCount).fill('<col style="min-width:80px"/>').join('') +
      '</colgroup>';
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Coaching List</title>
<style>table{border-collapse:collapse;width:100%;table-layout:fixed;font-family:Cairo,Arial,sans-serif;} th,td{border:1px solid #333;padding:8px;text-align:right;} th{background:#1a237e;color:#fff;}</style>
</head>
<body>
<h1>قائمة التدريب</h1>
<p>تاريخ التصدير: ${new Date().toLocaleDateString('ar-DZ')} — عدد: ${list.length}</p>
<table>
${colgroup}
<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
</body>
</html>`;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coaching-list-${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditCoaching = (c) => {
    setSelectedCoaching(null);
    setEditingCoaching(c);
    let coachingBirthDate = '';
    if (c.birthDate) {
      try {
        const date = c.birthDate.toDate ? c.birthDate.toDate() : new Date(c.birthDate);
        if (!Number.isNaN(date.getTime())) {
          coachingBirthDate = date.toISOString().split('T')[0];
        }
      } catch {
        if (typeof c.birthDate === 'string' && c.birthDate.includes('-')) {
          coachingBirthDate = c.birthDate.split('T')[0];
        }
      }
    }
    setEditCoachingFormData({
      fullLegalName: c.fullLegalName || '',
      phone: c.phone || '',
      birthDate: coachingBirthDate,
      tshirtSize: c.tshirtSize || '',
      email: c.email || '',
      instagram: c.instagram || '',
      facebook: c.facebook || '',
      tiktok: c.tiktok || '',
      linkedin: c.linkedin || '',
      city: c.city || '',
      wilaya: c.wilaya || '',
      isTrainer: c.isTrainer || '',
      athleteCount: c.athleteCount != null ? String(c.athleteCount) : '',
      trainingVenue: c.trainingVenue || '',
      activityMode: c.activityMode || '',
      trainingSpecialties: Array.isArray(c.trainingSpecialties)
        ? [...c.trainingSpecialties]
        : [],
      yearsSports: c.yearsSports != null ? String(c.yearsSports) : '',
      yearsCoaching: c.yearsCoaching != null ? String(c.yearsCoaching) : '',
      achievementsTournaments: c.achievementsTournaments || ''
    });
  };

  const toggleCoachingEditSpecialty = (id) => {
    setEditCoachingFormData((prev) => {
      const arr = prev.trainingSpecialties || [];
      const has = arr.includes(id);
      const trainingSpecialties = has
        ? arr.filter((x) => x !== id)
        : [...arr, id];
      return { ...prev, trainingSpecialties };
    });
  };

  const handleUpdateCoaching = async () => {
    if (!editingCoaching) return;
    try {
      setCoachingSaveLoading(true);
      await updateCoachingRegistration(editingCoaching.id, editCoachingFormData);
      await fetchCoachingRegistrations();
      setEditingCoaching(null);
      setEditCoachingFormData({});
      alert('تم التحديث بنجاح');
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء التحديث');
    } finally {
      setCoachingSaveLoading(false);
    }
  };

  const handleDeleteCoaching = async (c) => {
    if (
      !window.confirm(
        `هل أنت متأكد من حذف التسجيل: ${c.fullLegalName || c.phone || c.id}؟`
      )
    ) {
      return;
    }
    try {
      setIsDeletingCoaching(true);
      await deleteCoachingRegistration(c.id);
      await fetchCoachingRegistrations();
      if (selectedCoaching?.id === c.id) setSelectedCoaching(null);
      if (editingCoaching?.id === c.id) {
        setEditingCoaching(null);
        setEditCoachingFormData({});
      }
      alert('تم الحذف بنجاح');
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء الحذف');
    } finally {
      setIsDeletingCoaching(false);
    }
  };

  const coachingTotalPages = Math.ceil(filteredCoaching.length / ITEMS_PER_PAGE) || 1;
  const coachingEffectivePage = Math.min(coachingPage, coachingTotalPages);
  const coachingSlice = filteredCoaching.slice(
    (coachingEffectivePage - 1) * ITEMS_PER_PAGE,
    coachingEffectivePage * ITEMS_PER_PAGE
  );

  const formatBirthday = (birthDate) => {
    if (!birthDate) return 'غير محدد';
    try {
      const d = birthDate?.toDate ? birthDate.toDate() : new Date(birthDate);
      if (isNaN(d.getTime())) return 'غير محدد';
      return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
      return typeof birthDate === 'string' ? birthDate : 'غير محدد';
    }
  };

  // Export columns: same as dashboard table + weight, height, blood type, phone number, birthday
  const getExportRow = (p, index, total) => {
    const rowNum = total - index;
    return {
      '#': rowNum,
      'License Number': p.licenseNumber || 'غير محدد',
      'Full Name': `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      'Birthday': formatBirthday(p.birthDate),
      'Club Name': p.clubName || 'غير محدد',
      'Weight': p.weight != null && p.weight !== '' ? p.weight : 'غير محدد',
      'Height': p.height != null && p.height !== '' ? p.height : 'غير محدد',
      'Tshirt Size': p.tshirtSize || 'غير محدد',
      'Blood Type': p.bloodType || 'غير محدد',
      'Phone Number': p.phone || 'غير محدد',
      'Competition Category': p.competitionType || 'غير محدد',
      'Weight Category': p.weightCategory || 'غير محدد',
      'Wilaya Selected': p.firstCompetition || p.address?.wilaya || 'غير محدد'
    };
  };

  const escapeHtml = (val) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const exportToCSVExcel = () => {
    const list = filteredParticipants;
    if (list.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }
    const headers = ['#', 'License Number', 'Full Name', 'Birthday', 'Club Name', 'Tshirt Size', 'Competition Category', 'Weight Category', 'Wilaya Selected', 'Weight', 'Height', 'Blood Type', 'Phone Number'];
    const rows = list.map((p, i) => getExportRow(p, i, list.length));
    // Export as HTML spreadsheet (.xls) so Excel opens it with correct Arabic encoding
    const tableRows = rows.map(
      r => '<tr>' + headers.map(h => `<td>${escapeHtml(r[h])}</td>`).join('') + '</tr>'
    ).join('');
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Athletes</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:6px 8px;text-align:right;} th{background:#1a237e;color:#fff;}</style>
</head>
<body>
<table>
<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
</body>
</html>`;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athletes-list-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToWord = () => {
    const list = filteredParticipants;
    if (list.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }
    const headers = ['#', 'License Number', 'Full Name', 'Birthday', 'Club Name', 'Tshirt Size', 'Competition Category', 'Weight Category', 'Wilaya Selected', 'Weight', 'Height', 'Blood Type', 'Phone Number'];
    const rows = list.map((p, i) => getExportRow(p, i, list.length));
    const tableRows = rows.map(
      r => '<tr>' + headers.map(h => `<td>${escapeHtml(r[h])}</td>`).join('') + '</tr>'
    ).join('');
    const colCount = headers.length;
    const colgroup = '<colgroup>' + Array(colCount).fill('<col style="min-width:80px"/>').join('') + '</colgroup>';
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>Athletes List</title>
<style>table{border-collapse:collapse;width:100%;table-layout:fixed;font-family:Cairo,Arial,sans-serif;} th,td{border:1px solid #333;padding:8px;text-align:right;} th{background:#1a237e;color:#fff;}</style>
</head>
<body>
<h1>قائمة الرياضيين</h1>
<p>تاريخ التصدير: ${new Date().toLocaleDateString('ar-DZ')} — عدد: ${list.length}</p>
<table>
${colgroup}
<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
</body>
</html>`;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athletes-list-${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const licenseNumber = (p.licenseNumber || '').toLowerCase();
      const clubName = (p.clubName || '').toLowerCase();
      const tshirtSize = (p.tshirtSize || '').toLowerCase();
      const competitionCategory = (p.competitionType || '').toLowerCase();
      const weightCategory = (p.weightCategory || '').toLowerCase();
      const wilayaSelected = (p.firstCompetition || p.address?.wilaya || '');
      const search = searchTerm.toLowerCase();
      const matchesSearch = !search ||
        fullName.includes(search) ||
        licenseNumber.includes(search) ||
        clubName.includes(search) ||
        tshirtSize.includes(search) ||
        competitionCategory.includes(search) ||
        weightCategory.includes(search) ||
        wilayaSelected.toLowerCase().includes(search);
      const matchesCompetition = !filterCompetitionType || (p.competitionType || '') === filterCompetitionType;
      const matchesWeight = !filterWeightCategory || (p.weightCategory || '') === filterWeightCategory;
      const matchesWilaya = !filterWilaya || wilayaSelected === filterWilaya;
      return matchesSearch && matchesCompetition && matchesWeight && matchesWilaya;
    });
  }, [participants, searchTerm, filterCompetitionType, filterWeightCategory, filterWilaya]);

  const loadRegistrationSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'registration'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setRegistrationEnabled(data.enabled !== false); // Default to true if not set
        setStatusMessage(data.statusMessage || '');
        setMainTitle(data.mainTitle || 'التسجيل في البطولات الولائية 2026');
        setSubTitle(data.subTitle || 'البطولات المؤهلة للبطولة الوطنية');
      }
    } catch (error) {
      console.error('Error loading registration settings:', error);
    }
  };

  const saveRegistrationSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'registration'), {
        enabled: registrationEnabled,
        statusMessage: statusMessage,
        mainTitle: mainTitle,
        subTitle: subTitle,
        updatedAt: new Date().toISOString()
      });
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      alert('حدث خطأ أثناء حفظ الإعدادات: ' + error.message);
    }
  };

  const loadCoachingRegistrationSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'coaching_registration'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setCoachingRegEnabled(data.enabled !== false);
        setCoachingRegStatusMessage(data.statusMessage || '');
        setCoachingRegMainTitle(
          data.mainTitle || 'تسجيل المدربين والتأهيل التدريبي'
        );
        setCoachingRegSubTitle(data.subTitle || '');
      }
    } catch (error) {
      console.error('Error loading coaching registration settings:', error);
    }
  };

  const saveCoachingRegistrationSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'coaching_registration'), {
        enabled: coachingRegEnabled,
        statusMessage: coachingRegStatusMessage,
        mainTitle: coachingRegMainTitle,
        subTitle: coachingRegSubTitle,
        updatedAt: new Date().toISOString()
      });
      alert('تم حفظ إعدادات تسجيل التدريب بنجاح');
    } catch (error) {
      alert('حدث خطأ أثناء حفظ الإعدادات: ' + error.message);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      // Save authentication to localStorage
      localStorage.setItem('adminAuth', 'true');
      fetchParticipants();
      loadRegistrationSettings();
    } else {
      setError('Invalid email or password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    // Clear authentication from localStorage
    localStorage.removeItem('adminAuth');
  };

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'regional_registrations'), orderBy('registrationDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setParticipants(data);
      setCurrentPage(1);
    } catch (err) {
      setError('Failed to load participants data.');
    } finally {
      setLoading(false);
    }
  };

  const recalculateWeightCategories = async () => {
    if (!window.confirm('تحديث فئات الأوزان لجميع المسجلين حسب القواعد الجديدة؟ سيتم تعديل البيانات في قاعدة البيانات.')) {
      return;
    }
    setIsUpdatingWeightCategories(true);
    try {
      let updated = 0;
      let skipped = 0;
      for (const p of participants) {
        const competitionType = p.competitionType || p.competitionTypes?.[0];
        if (!p.gender || !p.weight || !competitionType) {
          skipped++;
          continue;
        }
        const newCategory = getWeightCategory(p.gender, p.weight, competitionType);
        if (!newCategory) {
          skipped++;
          continue;
        }
        const current = (p.weightCategory || '').trim().toLowerCase();
        if (current === newCategory.toLowerCase()) continue;
        await updateAthleteWeightCategory(p.id, newCategory, 'regional_registrations');
        updated++;
      }
      await fetchParticipants();
      alert(`تم التحديث: ${updated} سجل.\nتم تخطي (بيانات ناقصة أو فئة مفتوحة): ${skipped}.`);
    } catch (err) {
      alert('حدث خطأ أثناء التحديث: ' + (err.message || err));
    } finally {
      setIsUpdatingWeightCategories(false);
    }
  };

  const openModal = (participant) => {
    setSelectedParticipant(participant);
  };

  const closeModal = () => {
    setSelectedParticipant(null);
    setEditingParticipant(null);
    setEditFormData({});
  };

  const handleEdit = (participant) => {
    setEditingParticipant(participant);
    // Format birthDate for date input (YYYY-MM-DD)
    let formattedBirthDate = '';
    if (participant.birthDate) {
      try {
        const date = participant.birthDate.toDate ? participant.birthDate.toDate() : new Date(participant.birthDate);
        if (!isNaN(date.getTime())) {
          formattedBirthDate = date.toISOString().split('T')[0];
        }
      } catch (e) {
        // If it's already a string in YYYY-MM-DD format
        if (typeof participant.birthDate === 'string' && participant.birthDate.includes('-')) {
          formattedBirthDate = participant.birthDate.split('T')[0];
        }
      }
    }
    
    setEditFormData({
      firstName: participant.firstName || '',
      lastName: participant.lastName || '',
      birthDate: formattedBirthDate,
      birthPlace: participant.birthPlace || '',
      gender: participant.gender || '',
      weight: participant.weight || '',
      height: participant.height || '',
      tshirtSize: participant.tshirtSize || '',
      competitionType: participant.competitionType || '',
      weightCategory: participant.weightCategory || '',
      bloodType: participant.bloodType || '',
      hasDisease: participant.hasDisease || false,
      disease: participant.disease || '',
      phone: participant.phone || '',
      clubName: participant.clubName || '',
      licenseNumber: participant.licenseNumber || '',
      address: {
        neighborhood: participant.address?.neighborhood || '',
        municipality: participant.address?.municipality || '',
        wilaya: participant.address?.wilaya || '',
        zipCode: participant.address?.zipCode || ''
      }
    });
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);
      await updateAthlete(editingParticipant.id, editFormData, 'regional_registrations');
      await fetchParticipants();
      setEditingParticipant(null);
      setEditFormData({});
      setSelectedParticipant(null);
      alert('تم التحديث بنجاح');
    } catch (error) {
      alert('حدث خطأ أثناء التحديث: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (participant) => {
    if (!window.confirm(`هل أنت متأكد من حذف ${participant.firstName} ${participant.lastName}؟`)) {
      return;
    }
    
    try {
      setIsDeleting(true);
      await deleteAthlete(participant.id, 'regional_registrations');
      await fetchParticipants();
      if (selectedParticipant && selectedParticipant.id === participant.id) {
        setSelectedParticipant(null);
      }
      alert('تم الحذف بنجاح');
    } catch (error) {
      alert('حدث خطأ أثناء الحذف: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getQrCodeImageUrl = (uid, size = 140) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(buildPublicProfileUrl(uid))}`;

  const normalizePhone = (value) =>
    (value || '').toString().replace(/\D+/g, '');

  const normalizeName = (value) =>
    (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const publicProfiles = useMemo(() => {
    const source = [
      ...participants.map((p) => ({
        id: p.id,
        kind: 'athlete',
        name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        phone: p.phone || '',
        data: p
      })),
      ...coachingList.map((c) => ({
        id: c.id,
        kind: 'coach',
        name: c.fullLegalName || '',
        phone: c.phone || '',
        data: c
      }))
    ];

    const groups = [];
    for (const item of source) {
      const itemPhone = normalizePhone(item.phone);
      const itemName = normalizeName(item.name);
      const found = groups.find(
        (g) =>
          (itemPhone && g.phones.has(itemPhone)) ||
          (itemName && g.names.has(itemName))
      );

      if (found) {
        found.items.push(item);
        if (itemPhone) found.phones.add(itemPhone);
        if (itemName) found.names.add(itemName);
      } else {
        groups.push({
          items: [item],
          phones: new Set(itemPhone ? [itemPhone] : []),
          names: new Set(itemName ? [itemName] : [])
        });
      }
    }

    const mapped = groups.map((g) => {
      const preferred = g.items.find((i) => i.kind === 'athlete') || g.items[0];
      const athletes = g.items.filter((i) => i.kind === 'athlete');
      const coaches = g.items.filter((i) => i.kind === 'coach');
      return {
        uid: preferred?.id,
        displayName:
          preferred?.name ||
          (Array.from(g.names)[0] ? Array.from(g.names)[0] : 'بدون اسم'),
        phones: Array.from(g.phones),
        athletes,
        coaches
      };
    });

    const term = publicSearch.trim().toLowerCase();
    if (!term) return mapped;
    return mapped.filter((p) => {
      const hay = [
        p.displayName,
        p.phones.join(' '),
        ...p.athletes.map((x) => x.name),
        ...p.coaches.map((x) => x.name)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [participants, coachingList, publicSearch]);

  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <div className="login-card">
          <h2>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="login-btn">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Admin Panel</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      <div className="admin-body-with-sidebar">
        <aside className="admin-tab-sidebar" aria-label="Admin sections">
          <button
            type="button"
            className={`admin-tab-sidebar-btn${adminTab === 'athletes' ? ' active' : ''}`}
            onClick={() => setAdminTab('athletes')}
          >
            Athletes form
          </button>
          <button
            type="button"
            className={`admin-tab-sidebar-btn${adminTab === 'coaching' ? ' active' : ''}`}
            onClick={() => setAdminTab('coaching')}
          >
            Coaching form
          </button>
          <button
            type="button"
            className={`admin-tab-sidebar-btn${adminTab === 'public' ? ' active' : ''}`}
            onClick={() => setAdminTab('public')}
          >
            Public profiles
          </button>
        </aside>
        <div className="admin-tab-main">
          {adminTab === 'athletes' && (
      <div className="dashboard-content">
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ color: '#1a237e', fontSize: '22px', margin: '0 0 8px' }}>Athletes form</h2>
          <p style={{ color: '#555', margin: 0, fontSize: '15px' }}>
            إعدادات تسجيل البطولات والمشاركين المسجلين
          </p>
        </div>
        {/* Registration Settings Section */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginBottom: '20px', color: '#1a237e', fontSize: '20px' }}>إعدادات التسجيل</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>
                <input 
                  type="checkbox" 
                  checked={registrationEnabled} 
                  onChange={(e) => setRegistrationEnabled(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <span>تفعيل التسجيل</span>
              </label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                العنوان الرئيسي:
              </label>
              <input
                type="text"
                value={mainTitle}
                onChange={(e) => setMainTitle(e.target.value)}
                placeholder="التسجيل في البطولات الولائية 2026"
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '2px solid #ddd', 
                  borderRadius: '6px', 
                  fontSize: '15px',
                  fontFamily: 'Cairo, sans-serif'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                العنوان الفرعي:
              </label>
              <input
                type="text"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                placeholder="البطولات المؤهلة للبطولة الوطنية"
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '2px solid #ddd', 
                  borderRadius: '6px', 
                  fontSize: '15px',
                  fontFamily: 'Cairo, sans-serif'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                رسالة الحالة (ستظهر للمستخدمين):
              </label>
              <textarea
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="أدخل رسالة الحالة..."
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '2px solid #ddd', 
                  borderRadius: '6px', 
                  fontSize: '15px',
                  fontFamily: 'Cairo, sans-serif',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>
            <button 
              onClick={saveRegistrationSettings}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '15px',
                alignSelf: 'flex-start'
              }}
            >
              حفظ الإعدادات
            </button>
          </div>
        </div>

        <div className="dashboard-actions">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input 
              type="text" 
              placeholder="Search by name, license number, club name, tshirt size..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="admin-filters">
            <select
              className="admin-filter-select"
              value={filterCompetitionType}
              onChange={(e) => setFilterCompetitionType(e.target.value)}
              title="Competition type"
            >
              <option value="">نوع المسابقة (الكل)</option>
              <option value={COMPETITION_TYPES.FREESTYLE}>{getCompetitionTypeLabel(COMPETITION_TYPES.FREESTYLE)}</option>
              <option value={COMPETITION_TYPES.POWER_LIFTING}>{getCompetitionTypeLabel(COMPETITION_TYPES.POWER_LIFTING)}</option>
              <option value={COMPETITION_TYPES.STRENGTH_ENDURANCE}>{getCompetitionTypeLabel(COMPETITION_TYPES.STRENGTH_ENDURANCE)}</option>
            </select>
            <select
              className="admin-filter-select"
              value={filterWeightCategory}
              onChange={(e) => setFilterWeightCategory(e.target.value)}
              title="Weight category"
            >
              <option value="">فئة الوزن (الكل)</option>
              {WEIGHT_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              className="admin-filter-select"
              value={filterWilaya}
              onChange={(e) => setFilterWilaya(e.target.value)}
              title="Wilaya"
            >
              <option value="">الولاية (الكل)</option>
              {WILAYA_OPTIONS.map((wilaya) => (
                <option key={wilaya} value={wilaya}>{wilaya}</option>
              ))}
            </select>
          </div>
          <div className="admin-export-buttons">
            <button type="button" className="admin-export-btn export-excel" onClick={exportToCSVExcel} title="Export to Excel (CSV)">
              <i className="fas fa-file-excel"></i>
              <span>تصدير إلى Excel</span>
            </button>
            <button type="button" className="admin-export-btn export-word" onClick={exportToWord} title="Export to Word">
              <i className="fas fa-file-word"></i>
              <span>تصدير إلى Word</span>
            </button>
            <button
              type="button"
              className="admin-export-btn export-weight-categories"
              onClick={recalculateWeightCategories}
              disabled={isUpdatingWeightCategories || participants.length === 0}
              title="Update weight categories for all athletes (e.g. 80 kg freestyle = heavy)"
            >
              <i className="fas fa-balance-scale"></i>
              <span>{isUpdatingWeightCategories ? 'جاري التحديث...' : 'تحديث فئات الأوزان'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loader">Loading...</div>
        ) : (
          <>
            <div className="table-container">
              <table className="participants-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>License Number</th>
                    <th>Full Name</th>
                    <th>Club Name</th>
                    <th>Tshirt Size</th>
                    <th>Competition Category</th>
                    <th>Weight Category</th>
                    <th>Wilaya Selected</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = filteredParticipants;
                    const totalFiltered = filtered.length;
                    const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE) || 1;
                    const effectivePage = Math.min(currentPage, totalPages);
                    const startIndex = (effectivePage - 1) * ITEMS_PER_PAGE;
                    const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                    return paginated.map((p, index) => {
                      const rowNumber = totalFiltered - startIndex - index;
                      return (
                        <tr key={p.id}>
                          <td>{rowNumber}</td>
                          <td>{p.licenseNumber || 'غير محدد'}</td>
                          <td>{p.firstName} {p.lastName}</td>
                          <td>{p.clubName || 'غير محدد'}</td>
                          <td>{p.tshirtSize || 'غير محدد'}</td>
                          <td>{p.competitionType || 'غير محدد'}</td>
                          <td>{p.weightCategory || 'غير محدد'}</td>
                          <td>{p.firstCompetition || p.address?.wilaya || 'غير محدد'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button onClick={() => openModal(p)} className="details-btn">View All</button>
                              <button
                                type="button"
                                onClick={() => window.open(buildPublicProfileUrl(p.id), '_blank', 'noopener,noreferrer')}
                                style={{ padding: '6px 14px', background: '#673ab7', border: 'none', color: 'white', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Public
                              </button>
                              <button 
                                onClick={() => handleEdit(p)} 
                                className="edit-btn"
                                style={{ padding: '6px 14px', background: '#4caf50', border: 'none', color: 'white', borderRadius: '4px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDelete(p)} 
                                className="delete-btn"
                                disabled={isDeleting}
                                style={{ padding: '6px 14px', background: '#f44336', border: 'none', color: 'white', borderRadius: '4px', fontWeight: '700', cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1 }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            {(() => {
              const filtered = filteredParticipants;
              const totalFiltered = filtered.length;
              const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE) || 1;
              const effectivePage = Math.min(currentPage, totalPages);
              if (totalPages <= 1 && totalFiltered <= ITEMS_PER_PAGE) return null;
              return (
                <div className="pagination-controls">
                  <span className="pagination-info">
                    عرض {((effectivePage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(effectivePage * ITEMS_PER_PAGE, totalFiltered)} من {totalFiltered}
                  </span>
                  <div className="pagination-buttons">
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={effectivePage === 1}
                    >
                      السابق
                    </button>
                    <span className="pagination-page">
                      صفحة {effectivePage} من {totalPages}
                    </span>
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={effectivePage === totalPages}
                    >
                      التالي
                    </button>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
          )}

          {adminTab === 'coaching' && (
            <div className="dashboard-content">
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ color: '#1a237e', fontSize: '22px', margin: '0 0 8px' }}>Coaching form</h2>
                <p style={{ color: '#555', margin: 0, fontSize: '15px' }}>
                  إعدادات صفحة تسجيل التدريب وقائمة الطلبات
                </p>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <h2 style={{ marginBottom: '20px', color: '#1a237e', fontSize: '20px' }}>إعدادات التسجيل (التدريب)</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>
                      <input
                        type="checkbox"
                        checked={coachingRegEnabled}
                        onChange={(e) => setCoachingRegEnabled(e.target.checked)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                      <span>تفعيل التسجيل</span>
                    </label>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                      العنوان الرئيسي:
                    </label>
                    <input
                      type="text"
                      value={coachingRegMainTitle}
                      onChange={(e) => setCoachingRegMainTitle(e.target.value)}
                      placeholder="تسجيل المدربين والتأهيل التدريبي"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontFamily: 'Cairo, sans-serif'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                      العنوان الفرعي:
                    </label>
                    <input
                      type="text"
                      value={coachingRegSubTitle}
                      onChange={(e) => setCoachingRegSubTitle(e.target.value)}
                      placeholder="يظهر تحت العنوان الرئيسي في صفحة التدريب"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontFamily: 'Cairo, sans-serif'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                      رسالة الحالة (ستظهر للمستخدمين):
                    </label>
                    <textarea
                      value={coachingRegStatusMessage}
                      onChange={(e) => setCoachingRegStatusMessage(e.target.value)}
                      placeholder="مثال: التسجيل غير متاح"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '15px',
                        fontFamily: 'Cairo, sans-serif',
                        minHeight: '80px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveCoachingRegistrationSettings}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '15px',
                      alignSelf: 'flex-start'
                    }}
                  >
                    حفظ الإعدادات
                  </button>
                </div>
              </div>
              <h3 style={{ color: '#1a237e', fontSize: '18px', margin: '0 0 16px' }}>قائمة الطلبات</h3>
              <div className="dashboard-actions" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="search-box">
                  <i className="fas fa-search" />
                  <input
                    type="text"
                    placeholder="بحث بالاسم، الهاتف، البريد، المدينة، الولاية..."
                    value={coachingSearch}
                    onChange={(e) => setCoachingSearch(e.target.value)}
                  />
                </div>
                <div className="admin-filters">
                  <select
                    className="admin-filter-select"
                    value={filterCoachingTrainer}
                    onChange={(e) => setFilterCoachingTrainer(e.target.value)}
                    title="مدرب؟"
                  >
                    <option value="">هل مدرب؟ (الكل)</option>
                    <option value="yes">نعم</option>
                    <option value="no">لا</option>
                  </select>
                  <select
                    className="admin-filter-select"
                    value={filterCoachingWilaya}
                    onChange={(e) => setFilterCoachingWilaya(e.target.value)}
                    title="الولاية"
                  >
                    <option value="">الولاية (الكل)</option>
                    {WILAYAS.map((w) => (
                      <option key={w.number} value={w.name}>
                        {String(w.number).padStart(2, '0')} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-export-buttons">
                  <button
                    type="button"
                    className="admin-export-btn export-excel"
                    onClick={exportCoachingToExcel}
                    disabled={coachingLoading || filteredCoaching.length === 0}
                    title="تصدير البيانات المعروضة (بعد التصفية)"
                  >
                    <i className="fas fa-file-excel" />
                    <span>تصدير إلى Excel</span>
                  </button>
                  <button
                    type="button"
                    className="admin-export-btn export-word"
                    onClick={exportCoachingToWord}
                    disabled={coachingLoading || filteredCoaching.length === 0}
                    title="تصدير البيانات المعروضة (بعد التصفية)"
                  >
                    <i className="fas fa-file-word" />
                    <span>تصدير إلى Word</span>
                  </button>
                  <button
                    type="button"
                    className="admin-export-btn export-excel"
                    onClick={fetchCoachingRegistrations}
                    disabled={coachingLoading}
                    title="تحديث من الخادم"
                  >
                    <i className="fas fa-arrows-rotate" />
                    <span>{coachingLoading ? 'جاري التحديث...' : 'تحديث القائمة'}</span>
                  </button>
                </div>
              </div>
              {coachingLoading ? (
                <div className="loader">Loading...</div>
              ) : (
                <>
                  <div className="table-container">
                    <table className="participants-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>الاسم الكامل</th>
                          <th>الهاتف</th>
                          <th>المدينة</th>
                          <th>الولاية</th>
                          <th>مدرب؟</th>
                          <th>تاريخ التسجيل</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coachingSlice.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                              لا توجد تسجيلات
                            </td>
                          </tr>
                        ) : (
                          coachingSlice.map((c, index) => {
                            const rowNum =
                              filteredCoaching.length -
                              (coachingEffectivePage - 1) * ITEMS_PER_PAGE -
                              index;
                            return (
                              <tr key={c.id}>
                                <td>{rowNum}</td>
                                <td>{c.fullLegalName || '—'}</td>
                                <td>{c.phone || '—'}</td>
                                <td>{c.city || '—'}</td>
                                <td>{c.wilaya || '—'}</td>
                                <td>
                                  {c.isTrainer === 'yes'
                                    ? 'نعم'
                                    : c.isTrainer === 'no'
                                      ? 'لا'
                                      : '—'}
                                </td>
                                <td>
                                  {c.registrationDate
                                    ? new Date(c.registrationDate).toLocaleString('ar-DZ')
                                    : '—'}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCoaching(c)}
                                      className="details-btn"
                                    >
                                      View All
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => window.open(buildPublicProfileUrl(c.id), '_blank', 'noopener,noreferrer')}
                                      style={{
                                        padding: '6px 14px',
                                        background: '#673ab7',
                                        border: 'none',
                                        color: 'white',
                                        borderRadius: '4px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Public
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditCoaching(c)}
                                      className="edit-btn"
                                      style={{
                                        padding: '6px 14px',
                                        background: '#4caf50',
                                        border: 'none',
                                        color: 'white',
                                        borderRadius: '4px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCoaching(c)}
                                      className="delete-btn"
                                      disabled={isDeletingCoaching}
                                      style={{
                                        padding: '6px 14px',
                                        background: '#f44336',
                                        border: 'none',
                                        color: 'white',
                                        borderRadius: '4px',
                                        fontWeight: '700',
                                        cursor: isDeletingCoaching ? 'not-allowed' : 'pointer',
                                        opacity: isDeletingCoaching ? 0.6 : 1
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {coachingTotalPages > 1 && (
                    <div className="pagination-controls">
                      <span className="pagination-info">
                        عرض {(coachingEffectivePage - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(
                          coachingEffectivePage * ITEMS_PER_PAGE,
                          filteredCoaching.length
                        )}{' '}
                        من {filteredCoaching.length}
                      </span>
                      <div className="pagination-buttons">
                        <button
                          type="button"
                          className="pagination-btn"
                          onClick={() => setCoachingPage((p) => Math.max(1, p - 1))}
                          disabled={coachingEffectivePage === 1}
                        >
                          السابق
                        </button>
                        <span className="pagination-page">
                          صفحة {coachingEffectivePage} من {coachingTotalPages}
                        </span>
                        <button
                          type="button"
                          className="pagination-btn"
                          onClick={() =>
                            setCoachingPage((p) =>
                              Math.min(coachingTotalPages, p + 1)
                            )
                          }
                          disabled={coachingEffectivePage === coachingTotalPages}
                        >
                          التالي
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {adminTab === 'public' && (
            <div className="dashboard-content">
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ color: '#1a237e', fontSize: '22px', margin: '0 0 8px' }}>Public profiles</h2>
                <p style={{ color: '#555', margin: 0, fontSize: '15px' }}>
                  ملفات موحدة للرياضيين والمدربين مع QR لكل ملف عام
                </p>
              </div>
              <div className="dashboard-actions" style={{ marginBottom: '20px' }}>
                <div className="search-box">
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="بحث بالاسم أو الهاتف..."
                    value={publicSearch}
                    onChange={(e) => setPublicSearch(e.target.value)}
                  />
                </div>
                <div className="admin-export-buttons">
                  <button
                    type="button"
                    className="admin-export-btn export-word"
                    onClick={() => window.print()}
                    title="Print visible cards"
                  >
                    <i className="fas fa-print"></i>
                    <span>طباعة بطاقات QR</span>
                  </button>
                </div>
              </div>

              {coachingLoading && participants.length === 0 ? (
                <div className="loader">Loading...</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px'
                  }}
                >
                  {publicProfiles.length === 0 ? (
                    <div style={{ color: '#666' }}>لا توجد ملفات عامة مطابقة للبحث.</div>
                  ) : (
                    publicProfiles.map((profile) => (
                      <div
                        key={profile.uid}
                        style={{
                          background: 'white',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                          padding: '16px'
                        }}
                      >
                        <h3 style={{ margin: '0 0 8px', color: '#1a237e' }}>{profile.displayName}</h3>
                        <div style={{ marginBottom: '8px', color: '#555', fontSize: '14px' }}>
                          الهاتف: {profile.phones.length ? profile.phones.join(' | ') : 'غير محدد'}
                        </div>
                        <div style={{ marginBottom: '6px', fontSize: '14px' }}>
                          <strong>سجلات اللاعب:</strong> {profile.athletes.length}
                        </div>
                        <div style={{ marginBottom: '12px', fontSize: '14px' }}>
                          <strong>سجلات التدريب:</strong> {profile.coaches.length}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <img
                            src={getQrCodeImageUrl(profile.uid, 170)}
                            alt="public profile qr"
                            width={170}
                            height={170}
                            style={{ border: '1px solid #ddd', borderRadius: '10px' }}
                          />
                        </div>
                        <a
                          href={buildPublicProfileUrl(profile.uid)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'block',
                            marginTop: '10px',
                            fontSize: '12px',
                            color: '#673ab7',
                            wordBreak: 'break-all'
                          }}
                        >
                          {buildPublicProfileUrl(profile.uid)}
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editingParticipant && (
        <div className="modal-overlay" onClick={() => { setEditingParticipant(null); setEditFormData({}); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <button className="close-btn" onClick={() => { setEditingParticipant(null); setEditFormData({}); }}>&times;</button>
            <h2 style={{ marginBottom: '20px' }}>تعديل بيانات المشارك</h2>
            <div className="details-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="input-group">
                <label>الاسم:</label>
                <input 
                  type="text" 
                  value={editFormData.firstName || ''} 
                  onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>اللقب:</label>
                <input 
                  type="text" 
                  value={editFormData.lastName || ''} 
                  onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>تاريخ الميلاد:</label>
                <input 
                  type="date" 
                  value={editFormData.birthDate || ''} 
                  onChange={(e) => setEditFormData({...editFormData, birthDate: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>مكان الميلاد:</label>
                <input 
                  type="text" 
                  value={editFormData.birthPlace || ''} 
                  onChange={(e) => setEditFormData({...editFormData, birthPlace: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>الجنس:</label>
                <select 
                  value={editFormData.gender || ''} 
                  onChange={(e) => setEditFormData({...editFormData, gender: e.target.value})}
                >
                  <option value="">اختر الجنس</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
              <div className="input-group">
                <label>الوزن:</label>
                <input 
                  type="number" 
                  value={editFormData.weight || ''} 
                  onChange={(e) => setEditFormData({...editFormData, weight: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>الطول:</label>
                <input 
                  type="number" 
                  value={editFormData.height || ''} 
                  onChange={(e) => setEditFormData({...editFormData, height: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>مقاس التيشيرت:</label>
                <input 
                  type="text" 
                  value={editFormData.tshirtSize || ''} 
                  onChange={(e) => setEditFormData({...editFormData, tshirtSize: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>فصيلة الدم:</label>
                <input 
                  type="text" 
                  value={editFormData.bloodType || ''} 
                  onChange={(e) => setEditFormData({...editFormData, bloodType: e.target.value})}
                />
              </div>
              <div className="input-group full-width">
                <div className="custom-checkbox-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: editFormData.hasDisease ? '10px' : '0' }}>
                  <label className="custom-checkbox-label" htmlFor="editHasDisease" style={{ margin: 0, cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={`custom-checkbox ${editFormData.hasDisease ? 'checked' : ''}`}>
                      <input 
                        type="checkbox" 
                        id="editHasDisease" 
                        checked={editFormData.hasDisease} 
                        onChange={(e) => setEditFormData({
                          ...editFormData, 
                          hasDisease: e.target.checked,
                          disease: e.target.checked ? editFormData.disease : ''
                        })}
                        className="custom-checkbox-input"
                      />
                      {editFormData.hasDisease && (
                        <i className="fas fa-check custom-checkbox-icon"></i>
                      )}
                    </div>
                    <span>هل يعاني من اي مرض؟</span>
                  </label>
                </div>
                {editFormData.hasDisease && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>المرض أو الحالة الطبية:</label>
                    <input 
                      type="text" 
                      value={editFormData.disease || ''} 
                      onChange={(e) => setEditFormData({...editFormData, disease: e.target.value})}
                      placeholder="اذكر المرض أو الحالة الطبية"
                    />
                  </div>
                )}
              </div>
              <div className="input-group">
                <label>رقم الهاتف:</label>
                <input 
                  type="text" 
                  value={editFormData.phone || ''} 
                  onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>النادي:</label>
                <input 
                  type="text" 
                  value={editFormData.clubName || ''} 
                  onChange={(e) => setEditFormData({...editFormData, clubName: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>رقم الإجازة:</label>
                <input 
                  type="text" 
                  value={editFormData.licenseNumber || ''} 
                  onChange={(e) => setEditFormData({...editFormData, licenseNumber: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label>الحي:</label>
                <input 
                  type="text" 
                  value={editFormData.address?.neighborhood || ''} 
                  onChange={(e) => setEditFormData({...editFormData, address: {...editFormData.address, neighborhood: e.target.value}})}
                />
              </div>
              <div className="input-group">
                <label>البلدية:</label>
                <input 
                  type="text" 
                  value={editFormData.address?.municipality || ''} 
                  onChange={(e) => setEditFormData({...editFormData, address: {...editFormData.address, municipality: e.target.value}})}
                />
              </div>
              <div className="input-group">
                <label>الولاية:</label>
                <input 
                  type="text" 
                  value={editFormData.address?.wilaya || ''} 
                  onChange={(e) => setEditFormData({...editFormData, address: {...editFormData.address, wilaya: e.target.value}})}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleUpdate}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
              <button 
                onClick={() => { setEditingParticipant(null); setEditFormData({}); }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedParticipant && !editingParticipant && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeModal}>&times;</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>تفاصيل المشارك</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => handleEdit(selectedParticipant)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fas fa-edit"></i> تعديل
                </button>
                <button 
                  onClick={() => setShowLicenseCard(true)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#ff8c00',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fas fa-id-card"></i> تحميل بطاقة الترخيص
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      buildPublicProfileUrl(selectedParticipant.id),
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#673ab7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  <i className="fas fa-up-right-from-square"></i> الملف العام
                </button>
              </div>
            </div>
            <div className="details-grid">
              <div className="detail-item full-width" style={{ textAlign: 'center', background: '#f6f1ff' }}>
                <strong>QR الملف العام:</strong>
                <div style={{ marginTop: '10px' }}>
                  <img
                    src={getQrCodeImageUrl(selectedParticipant.id)}
                    alt="public profile qr"
                    width={140}
                    height={140}
                    style={{ borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
                <a
                  href={buildPublicProfileUrl(selectedParticipant.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', wordBreak: 'break-all' }}
                >
                  {buildPublicProfileUrl(selectedParticipant.id)}
                </a>
              </div>
              {/* Always show image section, even if URL doesn't exist */}
              <div className="detail-item full-width" style={{ textAlign: 'center', marginBottom: '20px' }}>
                <strong>الصورة الشخصية:</strong>
                <div style={{ marginTop: '10px' }}>
                  {selectedParticipant.personalPictureUrl ? (
                    <img 
                      src={selectedParticipant.personalPictureUrl} 
                      alt="الصورة الشخصية" 
                      crossOrigin="anonymous"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'block';
                        }
                      }}
                      style={{ 
                        maxWidth: '300px', 
                        maxHeight: '300px', 
                        borderRadius: '8px',
                        border: '2px solid #ddd',
                        objectFit: 'cover'
                      }} 
                    />
                  ) : null}
                  {!selectedParticipant.personalPictureUrl && (
                    <div style={{ padding: '20px', color: '#666', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f5f5f5' }}>
                      لا توجد صورة متاحة
                      <div style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>
                        (URL: {selectedParticipant.personalPictureUrl || 'غير موجود'})
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'none', padding: '20px', color: '#666', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff3cd' }}>
                    لا يمكن تحميل الصورة - تحقق من الرابط
                  </div>
                </div>
              </div>
              <div className="detail-item"><strong>الاسم:</strong> {selectedParticipant.firstName}</div>
              <div className="detail-item"><strong>اللقب:</strong> {selectedParticipant.lastName}</div>
              <div className="detail-item"><strong>تاريخ الميلاد:</strong> {selectedParticipant.birthDate ? new Date(selectedParticipant.birthDate).toLocaleDateString('ar-DZ') : 'غير محدد'}</div>
              <div className="detail-item"><strong>مكان الميلاد:</strong> {selectedParticipant.birthPlace || 'غير محدد'}</div>
              <div className="detail-item"><strong>الجنس:</strong> {selectedParticipant.gender === 'male' ? 'ذكر' : selectedParticipant.gender === 'female' ? 'أنثى' : selectedParticipant.gender}</div>
              <div className="detail-item"><strong>الوزن:</strong> {selectedParticipant.weight ? `${selectedParticipant.weight} كجم` : 'غير محدد'}</div>
              <div className="detail-item"><strong>الطول:</strong> {selectedParticipant.height ? `${selectedParticipant.height} سم` : 'غير محدد'}</div>
              <div className="detail-item"><strong>مقاس التيشيرت:</strong> {selectedParticipant.tshirtSize || 'غير محدد'}</div>
              {selectedParticipant.competitionTypes && selectedParticipant.competitionTypes.length > 0 ? (
                <div className="detail-item full-width">
                  <strong>أنواع المسابقات:</strong>
                  <ul style={{ marginTop: '10px', paddingRight: '20px', direction: 'rtl' }}>
                    {selectedParticipant.competitionTypes.map((type, idx) => {
                      const typeLabel = type === 'freestyle' ? 'الأسلوب الحر' : 
                                       type === 'power_lifting' ? 'القوة' : 
                                       type === 'strength_endurance' ? 'التحمل' : type;
                      return (
                        <li key={idx}>{typeLabel} {idx === 0 ? '(رئيسي)' : '(إضافي)'}</li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="detail-item">
                  <strong>نوع المسابقة:</strong> {
                    selectedParticipant.competitionType === 'freestyle' ? 'الأسلوب الحر' : 
                    selectedParticipant.competitionType === 'power_lifting' ? 'القوة' : 
                    selectedParticipant.competitionType === 'strength_endurance' ? 'التحمل' : 
                    selectedParticipant.competitionType || 'غير محدد'
                  }
                </div>
              )}
              <div className="detail-item"><strong>فئة العمر:</strong> {
                selectedParticipant.ageCategory === 'regular' ? 'عادي' :
                selectedParticipant.ageCategory === 'veteran' ? 'محارب قديم' :
                selectedParticipant.ageCategory || 'غير محدد'
              }</div>
              <div className="detail-item"><strong>فئة الوزن:</strong> {
                selectedParticipant.weightCategory === 'light' ? 'خفيف' :
                selectedParticipant.weightCategory === 'medium' ? 'متوسط' :
                selectedParticipant.weightCategory === 'heavy' ? 'ثقيل' :
                selectedParticipant.weightCategory === 'open' ? 'مطلقة' :
                selectedParticipant.weightCategory || 'غير محدد'
              }</div>
              <div className="detail-item"><strong>فصيلة الدم:</strong> {selectedParticipant.bloodType || 'غير محدد'}</div>
              <div className="detail-item">
                <strong>هل يعاني من مرض:</strong> {selectedParticipant.hasDisease ? 'نعم' : 'لا'}
              </div>
              {selectedParticipant.hasDisease && selectedParticipant.disease && (
                <div className="detail-item"><strong>المرض أو الحالة الطبية:</strong> {selectedParticipant.disease}</div>
              )}
              <div className="detail-item"><strong>رقم الهاتف:</strong> {selectedParticipant.phone || 'غير محدد'}</div>
              <div className="detail-item"><strong>النادي:</strong> {selectedParticipant.clubName || 'غير محدد'}</div>
              <div className="detail-item"><strong>رقم الإجازة:</strong> {selectedParticipant.licenseNumber || 'غير محدد'}</div>
              <div className="detail-item"><strong>نوع التسجيل:</strong> {
                selectedParticipant.registrationType === 'regional_championship' ? 'بطولة وطنية' :
                selectedParticipant.registrationType || 'غير محدد'
              }</div>
              {selectedParticipant.competitions && selectedParticipant.competitions.length > 0 ? (
                <>
                  {selectedParticipant.competitions.filter(c => c.type === 'main').map((comp, idx) => (
                    <div key={idx} className="detail-item">
                      <strong>المسابقة الرئيسية:</strong> {comp.wilaya} ({comp.date ? new Date(comp.date).toLocaleDateString('ar-DZ') : 'غير محدد'})
                    </div>
                  ))}
                  {selectedParticipant.competitions.filter(c => c.type === 'honorary').length > 0 && (
                    <div className="detail-item full-width">
                      <strong>مشاركات الشرف:</strong>
                      <ul style={{ marginTop: '10px', paddingRight: '20px', direction: 'rtl' }}>
                        {selectedParticipant.competitions.filter(c => c.type === 'honorary').map((comp, idx) => (
                          <li key={idx}>{comp.wilaya} ({comp.date ? new Date(comp.date).toLocaleDateString('ar-DZ') : 'غير محدد'})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="detail-item"><strong>المسابقة الرئيسية:</strong> {selectedParticipant.firstCompetition || 'غير محدد'}</div>
                  {selectedParticipant.honoraryCompetitions && selectedParticipant.honoraryCompetitions.length > 0 && (
                    <div className="detail-item full-width">
                      <strong>مشاركات الشرف:</strong>
                      <ul style={{ marginTop: '10px', paddingRight: '20px', direction: 'rtl' }}>
                        {selectedParticipant.honoraryCompetitions.map((comp, idx) => (
                          <li key={idx}>{comp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <div className="detail-item"><strong>الولاية:</strong> {selectedParticipant.address?.wilaya || 'غير محدد'}</div>
              <div className="detail-item"><strong>البلدية:</strong> {selectedParticipant.address?.municipality || 'غير محدد'}</div>
              <div className="detail-item"><strong>الحي:</strong> {selectedParticipant.address?.neighborhood || 'غير محدد'}</div>
              <div className="detail-item"><strong>الرمز البريدي:</strong> {selectedParticipant.address?.zipCode || 'غير محدد'}</div>
              {selectedParticipant.instagram && (
                <div className="detail-item"><strong>Instagram:</strong> {selectedParticipant.instagram}</div>
              )}
              {selectedParticipant.facebook && (
                <div className="detail-item"><strong>Facebook:</strong> {selectedParticipant.facebook}</div>
              )}
              {selectedParticipant.tiktok && (
                <div className="detail-item"><strong>TikTok:</strong> {selectedParticipant.tiktok}</div>
              )}
              {selectedParticipant.email && (
                <div className="detail-item"><strong>Email:</strong> {selectedParticipant.email}</div>
              )}
              <div className="detail-item"><strong>تاريخ التسجيل:</strong> {selectedParticipant.registrationDate ? new Date(selectedParticipant.registrationDate).toLocaleString('ar-DZ') : 'غير محدد'}</div>
            </div>
          </div>
        </div>
      )}

      {showLicenseCard && selectedParticipant && (
        <LicenseCard 
          participant={selectedParticipant} 
          onClose={() => setShowLicenseCard(false)} 
        />
      )}

      {editingCoaching && (
        <div
          className="modal-overlay"
          onClick={() => {
            setEditingCoaching(null);
            setEditCoachingFormData({});
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', maxHeight: '90vh' }}
          >
            <button
              type="button"
              className="close-btn"
              onClick={() => {
                setEditingCoaching(null);
                setEditCoachingFormData({});
              }}
            >
              &times;
            </button>
            <h2 style={{ marginBottom: '20px' }}>تعديل بيانات التدريب</h2>
            <div className="details-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="input-group">
                <label>الاسم الكامل:</label>
                <input
                  type="text"
                  value={editCoachingFormData.fullLegalName || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      fullLegalName: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>رقم الهاتف:</label>
                <input
                  type="tel"
                  value={editCoachingFormData.phone || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      phone: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>تاريخ الميلاد:</label>
                <input
                  type="date"
                  value={editCoachingFormData.birthDate || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      birthDate: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>مقاس التيشيرت:</label>
                <select
                  value={editCoachingFormData.tshirtSize || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      tshirtSize: e.target.value
                    })
                  }
                >
                  <option value="">اختر المقاس</option>
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                </select>
              </div>
              <div className="input-group">
                <label>البريد الإلكتروني:</label>
                <input
                  type="email"
                  value={editCoachingFormData.email || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      email: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>Instagram:</label>
                <input
                  type="text"
                  value={editCoachingFormData.instagram || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      instagram: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>Facebook:</label>
                <input
                  type="text"
                  value={editCoachingFormData.facebook || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      facebook: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>TikTok:</label>
                <input
                  type="text"
                  value={editCoachingFormData.tiktok || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      tiktok: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>LinkedIn:</label>
                <input
                  type="text"
                  value={editCoachingFormData.linkedin || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      linkedin: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>المدينة:</label>
                <input
                  type="text"
                  value={editCoachingFormData.city || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      city: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>الولاية:</label>
                <select
                  value={editCoachingFormData.wilaya || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      wilaya: e.target.value
                    })
                  }
                >
                  <option value="">اختر الولاية</option>
                  {WILAYAS.map((w) => (
                    <option key={w.number} value={w.name}>
                      {String(w.number).padStart(2, '0')} - {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>هل أنت مدرب؟</label>
                <select
                  value={editCoachingFormData.isTrainer || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditCoachingFormData((prev) => ({
                      ...prev,
                      isTrainer: v,
                      ...(v !== 'yes' ? { athleteCount: '' } : {})
                    }));
                  }}
                >
                  <option value="">اختر</option>
                  <option value="yes">نعم</option>
                  <option value="no">لا</option>
                </select>
              </div>
              {editCoachingFormData.isTrainer === 'yes' && (
                <div className="input-group">
                  <label>عدد الرياضيين:</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editCoachingFormData.athleteCount || ''}
                    onChange={(e) =>
                      setEditCoachingFormData({
                        ...editCoachingFormData,
                        athleteCount: e.target.value
                      })
                    }
                  />
                </div>
              )}
              <div className="input-group">
                <label>فضاء التدريب:</label>
                <select
                  value={editCoachingFormData.trainingVenue || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      trainingVenue: e.target.value
                    })
                  }
                >
                  <option value="">اختر</option>
                  <option value="hall">قاعة</option>
                  <option value="outdoor_track">مضمار خارجي</option>
                </select>
              </div>
              <div className="input-group">
                <label>كيفية النشاط:</label>
                <select
                  value={editCoachingFormData.activityMode || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      activityMode: e.target.value
                    })
                  }
                >
                  <option value="">اختر</option>
                  <option value="amateur_club">نادي هاوي (جمعية رياضية)</option>
                  <option value="private_gym">قاعة خاصة</option>
                  <option value="independent">حر</option>
                </select>
              </div>
              <div className="input-group full-width">
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  التخصص التدريبي:
                </label>
                {COACHING_SPECIALTY_IDS.map((sid) => (
                  <div
                    key={sid}
                    className="custom-checkbox-wrapper"
                    style={{ marginBottom: '10px' }}
                  >
                    <label
                      className="custom-checkbox-label"
                      htmlFor={`coaching-edit-spec-${sid}`}
                    >
                      <div
                        className={`custom-checkbox ${
                          (editCoachingFormData.trainingSpecialties || []).includes(
                            sid
                          )
                            ? 'checked'
                            : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`coaching-edit-spec-${sid}`}
                          className="custom-checkbox-input"
                          checked={(
                            editCoachingFormData.trainingSpecialties || []
                          ).includes(sid)}
                          onChange={() => toggleCoachingEditSpecialty(sid)}
                        />
                        {(editCoachingFormData.trainingSpecialties || []).includes(
                          sid
                        ) && (
                          <i className="fas fa-check custom-checkbox-icon" />
                        )}
                      </div>
                      <span>{SPECIALTY_LABELS[sid]}</span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="input-group">
                <label>سنوات ممارسة الرياضة:</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editCoachingFormData.yearsSports || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      yearsSports: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group">
                <label>سنوات ممارسة التدريب:</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editCoachingFormData.yearsCoaching || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      yearsCoaching: e.target.value
                    })
                  }
                />
              </div>
              <div className="input-group full-width">
                <label>الإنجازات والبطولات:</label>
                <textarea
                  rows={4}
                  value={editCoachingFormData.achievementsTournaments || ''}
                  onChange={(e) =>
                    setEditCoachingFormData({
                      ...editCoachingFormData,
                      achievementsTournaments: e.target.value
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontFamily: 'Cairo, sans-serif',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {Array.isArray(editingCoaching.certificateUrls) &&
                editingCoaching.certificateUrls.length > 0 && (
                  <div className="input-group full-width">
                    <label>الشهادات المرفوعة (عرض فقط):</label>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        marginTop: '8px'
                      }}
                    >
                      {editingCoaching.certificateUrls.map((url, idx) => (
                        <a
                          key={url + idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={url}
                            alt=""
                            style={{
                              maxWidth: '100px',
                              maxHeight: '100px',
                              borderRadius: '6px',
                              border: '1px solid #ddd'
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '20px',
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                onClick={handleUpdateCoaching}
                disabled={coachingSaveLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: coachingSaveLoading ? 'not-allowed' : 'pointer',
                  opacity: coachingSaveLoading ? 0.6 : 1
                }}
              >
                {coachingSaveLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCoaching(null);
                  setEditCoachingFormData({});
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCoaching && (
        <div className="modal-overlay" onClick={() => setSelectedCoaching(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="close-btn"
              onClick={() => setSelectedCoaching(null)}
            >
              &times;
            </button>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px'
              }}
            >
              <h2 style={{ margin: 0 }}>تفاصيل طلب التدريب</h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => openEditCoaching(selectedCoaching)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  <i className="fas fa-edit" /> تعديل
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      buildPublicProfileUrl(selectedCoaching.id),
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#673ab7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  <i className="fas fa-up-right-from-square" /> الملف العام
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCoaching(selectedCoaching)}
                  disabled={isDeletingCoaching}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isDeletingCoaching ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: isDeletingCoaching ? 0.6 : 1
                  }}
                >
                  <i className="fas fa-trash" /> حذف
                </button>
              </div>
            </div>
            <div className="details-grid" style={{ marginTop: '24px' }}>
              <div className="detail-item full-width" style={{ textAlign: 'center', background: '#f6f1ff' }}>
                <strong>QR الملف العام:</strong>
                <div style={{ marginTop: '10px' }}>
                  <img
                    src={getQrCodeImageUrl(selectedCoaching.id)}
                    alt="public profile qr"
                    width={140}
                    height={140}
                    style={{ borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
                <a
                  href={buildPublicProfileUrl(selectedCoaching.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', wordBreak: 'break-all' }}
                >
                  {buildPublicProfileUrl(selectedCoaching.id)}
                </a>
              </div>
              <div className="detail-item">
                <strong>الاسم الكامل:</strong> {selectedCoaching.fullLegalName || '—'}
              </div>
              <div className="detail-item">
                <strong>الهاتف:</strong> {selectedCoaching.phone || '—'}
              </div>
              <div className="detail-item">
                <strong>تاريخ الميلاد:</strong>{' '}
                {(() => {
                  if (!selectedCoaching.birthDate) return '—';
                  try {
                    const d = selectedCoaching.birthDate.toDate
                      ? selectedCoaching.birthDate.toDate()
                      : new Date(selectedCoaching.birthDate);
                    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ar-DZ');
                  } catch {
                    return '—';
                  }
                })()}
              </div>
              <div className="detail-item">
                <strong>مقاس التيشيرت:</strong> {selectedCoaching.tshirtSize || '—'}
              </div>
              <div className="detail-item">
                <strong>البريد:</strong> {selectedCoaching.email || '—'}
              </div>
              <div className="detail-item">
                <strong>Instagram:</strong> {selectedCoaching.instagram || '—'}
              </div>
              <div className="detail-item">
                <strong>Facebook:</strong> {selectedCoaching.facebook || '—'}
              </div>
              <div className="detail-item">
                <strong>TikTok:</strong> {selectedCoaching.tiktok || '—'}
              </div>
              <div className="detail-item">
                <strong>LinkedIn:</strong> {selectedCoaching.linkedin || '—'}
              </div>
              <div className="detail-item">
                <strong>المدينة:</strong> {selectedCoaching.city || '—'}
              </div>
              <div className="detail-item">
                <strong>الولاية:</strong> {selectedCoaching.wilaya || '—'}
              </div>
              <div className="detail-item">
                <strong>هل أنت مدرب؟</strong>{' '}
                {selectedCoaching.isTrainer === 'yes'
                  ? 'نعم'
                  : selectedCoaching.isTrainer === 'no'
                    ? 'لا'
                    : '—'}
              </div>
              {selectedCoaching.isTrainer === 'yes' && (
                <div className="detail-item">
                  <strong>عدد الرياضيين:</strong>{' '}
                  {selectedCoaching.athleteCount != null
                    ? selectedCoaching.athleteCount
                    : '—'}
                </div>
              )}
              <div className="detail-item">
                <strong>فضاء التدريب:</strong>{' '}
                {TRAINING_VENUE_LABELS[selectedCoaching.trainingVenue] ||
                  selectedCoaching.trainingVenue ||
                  '—'}
              </div>
              <div className="detail-item">
                <strong>كيفية النشاط:</strong>{' '}
                {ACTIVITY_MODE_LABELS[selectedCoaching.activityMode] ||
                  selectedCoaching.activityMode ||
                  '—'}
              </div>
              <div className="detail-item full-width">
                <strong>التخصص التدريبي:</strong>{' '}
                {(selectedCoaching.trainingSpecialties || [])
                  .map((s) => SPECIALTY_LABELS[s] || s)
                  .join('، ') || '—'}
              </div>
              <div className="detail-item">
                <strong>سنوات ممارسة الرياضة:</strong>{' '}
                {selectedCoaching.yearsSports != null
                  ? selectedCoaching.yearsSports
                  : '—'}
              </div>
              <div className="detail-item">
                <strong>سنوات ممارسة التدريب:</strong>{' '}
                {selectedCoaching.yearsCoaching != null
                  ? selectedCoaching.yearsCoaching
                  : '—'}
              </div>
              <div className="detail-item full-width">
                <strong>الإنجازات والبطولات:</strong>{' '}
                {selectedCoaching.achievementsTournaments?.trim() || '—'}
              </div>
              <div className="detail-item full-width">
                <strong>تاريخ التسجيل:</strong>{' '}
                {selectedCoaching.registrationDate
                  ? new Date(selectedCoaching.registrationDate).toLocaleString(
                      'ar-DZ'
                    )
                  : '—'}
              </div>
              <div className="detail-item full-width">
                <strong>الشهادات (روابط):</strong>
                {Array.isArray(selectedCoaching.certificateUrls) &&
                selectedCoaching.certificateUrls.length > 0 ? (
                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    {selectedCoaching.certificateUrls.map((url, idx) => (
                      <a
                        key={url + idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block' }}
                      >
                        <img
                          src={url}
                          alt={`شهادة ${idx + 1}`}
                          style={{
                            maxWidth: '160px',
                            maxHeight: '160px',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            objectFit: 'cover'
                          }}
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span> لا توجد مرفقات</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;