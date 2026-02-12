import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import LicenseCard from '../components/LicenseCard';
import { updateAthlete, deleteAthlete, updateAthleteWeightCategory } from '../services/api';
import { competitionDetails } from '../data/competitionDetails';
import { COMPETITION_TYPES, getCompetitionTypeLabel, getWeightCategory } from '../utils/competitionCategories';
import './AdminPanel.css';

const WEIGHT_CATEGORIES = [
  { value: 'light', label: 'خفيف' },
  { value: 'medium', label: 'متوسط' },
  { value: 'heavy', label: 'ثقيل' },
  { value: 'open', label: 'مطلقة' }
];

const WILAYA_OPTIONS = Object.keys(competitionDetails).sort((a, b) => a.localeCompare(b, 'ar'));

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
        <h1>Admin Panel - Participants List</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      <div className="dashboard-content">
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
              </div>
            </div>
            <div className="details-grid">
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

    </div>
  );
};

export default AdminPanel;