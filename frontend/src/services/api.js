import { collection, addDoc, updateDoc, doc, deleteDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { hasDateConflict } from '../data/competitionSchedule';
import { CLOUDINARY_UPLOAD_URL, cloudinaryConfig } from '../config/cloudinary';
import { buildPublicProfileUrl } from '../config/publicSite';

// Validate athlete data before saving
const validateAthleteData = (athleteData) => {
  const errors = [];

  // Personal information validation
  if (!athleteData.firstName || !athleteData.firstName.trim()) {
    errors.push('الاسم مطلوب');
  }

  if (!athleteData.lastName || !athleteData.lastName.trim()) {
    errors.push('اللقب مطلوب');
  }

  if (!athleteData.birthDate) {
    errors.push('تاريخ الميلاد مطلوب');
  }

  if (!athleteData.birthPlace || !athleteData.birthPlace.trim()) {
    errors.push('مكان الميلاد مطلوب');
  }

  if (!athleteData.clubName || !athleteData.clubName.trim()) {
    errors.push('اسم النادي مطلوب');
  }

  // License number is optional

  // Competition details validation
  if (!athleteData.gender) {
    errors.push('الجنس مطلوب');
  }

  if (!athleteData.weight || parseFloat(athleteData.weight) <= 0) {
    errors.push('الوزن مطلوب');
  }

  if (!athleteData.height || parseFloat(athleteData.height) <= 0) {
    errors.push('الطول مطلوب');
  }

  if (!athleteData.tshirtSize) {
    errors.push('مقاس التيشيرت مطلوب');
  }

  if (!athleteData.bloodType) {
    errors.push('فصيلة الدم مطلوبة');
  }

  // Disease validation - if hasDisease is true, disease is required
  if (athleteData.hasDisease && (!athleteData.disease || !athleteData.disease.trim())) {
    errors.push('يجب ذكر المرض أو الحالة الطبية');
  }

  if (!athleteData.competitionType && (!athleteData.competitionTypes || athleteData.competitionTypes.length === 0 || !athleteData.competitionTypes[0])) {
    errors.push('نوع المسابقة الأول مطلوب');
  }

  if (!athleteData.weightCategory) {
    errors.push('فئة الوزن مطلوبة');
  }

  // Address validation
  if (!athleteData.address) {
    errors.push('العنوان مطلوب');
  } else {
    if (!athleteData.address.neighborhood || !athleteData.address.neighborhood.trim()) {
      errors.push('الحي مطلوب');
    }
    if (!athleteData.address.municipality || !athleteData.address.municipality.trim()) {
      errors.push('البلدية مطلوبة');
    }
    if (!athleteData.address.wilaya || !athleteData.address.wilaya.trim()) {
      errors.push('الولاية مطلوبة');
    }
  }

  // Competitions validation - only for provincial championships
  if (athleteData.registrationType !== 'national_championship') {
    if (!athleteData.competitions || athleteData.competitions.length === 0) {
      errors.push('يجب اختيار ولاية واحدة على الأقل للمنافسة');
    } else {
      // Check for date conflicts
      if (hasDateConflict) {
        const selectedWilayas = athleteData.competitions.map(comp => comp.wilaya);
        if (selectedWilayas.length > 1 && hasDateConflict(selectedWilayas)) {
          errors.push('لا يمكنك اختيار ولايتين لهما نفس تاريخ المنافسة');
        }
      }
    }
  }

  // National Championship specific validation
  if (athleteData.registrationType === 'national_championship') {
    if (!athleteData.qualificationCriteria) {
      errors.push('معيار التأهيل مطلوب');
    }
    if (!athleteData.phone || !athleteData.phone.trim()) {
      errors.push('رقم الهاتف مطلوب');
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }
};

// Upload image to Cloudinary using unsigned uploads
const uploadImage = async (file, athleteId) => {
  if (!file) {
    return null;
  }
  
  try {
    // Validate config before attempting upload
    if (!cloudinaryConfig.cloudName || !cloudinaryConfig.uploadPreset) {
      throw new Error('Cloudinary configuration is missing. Check your .env file or fallback values.');
    }
    
    if (!CLOUDINARY_UPLOAD_URL) {
      throw new Error('Cloudinary upload URL is not configured');
    }
    
    // Create FormData for Cloudinary unsigned upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    // Note: folder and public_id might not work with unsigned uploads
    // depending on preset configuration. Removing them to avoid errors.
    // If your preset is configured to allow these, you can add them back:
    // formData.append('folder', 'personal_pictures');
    // formData.append('public_id', `athlete_${athleteId}_${Date.now()}`);
    
    // Add timeout for upload (30 seconds)
    const uploadPromise = fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData
      // Note: Don't set Content-Type header - browser will set it with boundary for FormData
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('انتهت مهلة رفع الصورة (30 ثانية)')), 30000)
    );
    
    const response = await Promise.race([uploadPromise, timeoutPromise]);
    
    if (!response.ok) {
      const errorText = await response.text();
      
      // Try to parse as JSON for better error message
      let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {
        // Not JSON, use raw text
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Return the secure URL
    const imageUrl = data.secure_url || data.url;
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      throw new Error('No valid image URL returned from Cloudinary');
    }
    
    return imageUrl.trim();
  } catch (error) {
    // Return null instead of throwing - let the registration complete
    // The error will be logged but won't block registration
    return null;
  }
};

// Register athlete directly to Firestore
export const registerAthlete = async (athleteData) => {
  try {
    // Validate data before saving
    validateAthleteData(athleteData);
    
    // Extract image file from athleteData (we'll save it separately)
    const imageFile = athleteData.personalPicture;
    const { personalPicture, ...dataWithoutImage } = athleteData;
    
    // Prepare data with timestamps
    let athleteDataWithTimestamp = {
      ...dataWithoutImage,
      weight: parseFloat(athleteData.weight),
      height: athleteData.height ? parseFloat(athleteData.height) : null,
      registrationTimestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    };

    // Save to Firestore - use different collections based on registration type
    let collectionName = 'athletes';
    if (athleteData.registrationType === 'national_championship') {
      collectionName = 'national_championship_registrations';
    } else if (athleteData.registrationType === 'regional_championship') {
      collectionName = 'regional_registrations';
    }

    const firstName = (athleteData.firstName || '').trim();
    const lastName = (athleteData.lastName || '').trim();

    // Check if same name is already registered: if so, replace (update) instead of creating new
    const existingQuery = query(
      collection(db, collectionName),
      where('firstName', '==', firstName),
      where('lastName', '==', lastName)
    );
    const existingSnapshot = await getDocs(existingQuery);
    const existingDoc = existingSnapshot.docs[0];

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('الطلب استغرق وقتاً طويلاً جداً. يرجى التحقق من اتصال الإنترنت أو قواعد البيانات.')), 10000)
    );

    let docId;

    if (existingDoc) {
      // Replace previous registration with new data
      docId = existingDoc.id;
      const docRef = doc(db, collectionName, docId);
      const updateData = {
        ...athleteDataWithTimestamp,
        registrationDate: new Date().toISOString(),
        registrationTimestamp: serverTimestamp()
      };
      const updatePromise = updateDoc(docRef, updateData);
      await Promise.race([updatePromise, timeoutPromise]);

      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, docId);
        if (imageUrl && imageUrl.trim() && imageUrl.startsWith('http')) {
          try {
            await updateDoc(docRef, { personalPictureUrl: imageUrl.trim() });
          } catch (updateError) {}
        }
      }

      return {
        success: true,
        message: 'تم تحديث التسجيل السابق بنجاح (نفس الاسم كان مسجلاً مسبقاً)',
        athleteId: docId
      };
    }

    // No existing registration with this name: create new document
    const savePromise = addDoc(collection(db, collectionName), athleteDataWithTimestamp);
    const docRef = await Promise.race([savePromise, timeoutPromise]);
    docId = docRef.id;

    if (imageFile) {
      const imageUrl = await uploadImage(imageFile, docId);
      if (imageUrl && imageUrl.trim() && imageUrl.startsWith('http')) {
        try {
          await updateDoc(doc(db, collectionName, docId), {
            personalPictureUrl: imageUrl.trim()
          });
        } catch (updateError) {}
      }
    }

    return {
      success: true,
      message: 'تم التسجيل بنجاح',
      athleteId: docId
    };
  } catch (error) {
    throw error;
  }
};

const normalizeCoachingBirthDate = (raw) => {
  if (!raw || !String(raw).trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const validateCoachingData = (d) => {
  const errors = [];
  if (!d.fullLegalName || !d.fullLegalName.trim()) {
    errors.push('الاسم الكامل مطلوب');
  }
  if (!d.phone || !d.phone.trim()) {
    errors.push('رقم الهاتف مطلوب');
  }
  if (!d.birthDate || !String(d.birthDate).trim()) {
    errors.push('تاريخ الميلاد مطلوب');
  } else if (!normalizeCoachingBirthDate(d.birthDate)) {
    errors.push('تاريخ الميلاد غير صالح');
  }
  if (!d.tshirtSize || !String(d.tshirtSize).trim()) {
    errors.push('مقاس التيشيرت مطلوب');
  }
  if (d.email && d.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(d.email.trim())) {
      errors.push('صيغة البريد الإلكتروني غير صحيحة');
    }
  }
  if (!d.city || !d.city.trim()) {
    errors.push('المدينة مطلوبة');
  }
  if (!d.wilaya || !d.wilaya.trim()) {
    errors.push('الولاية مطلوبة');
  }
  if (!d.isTrainer) {
    errors.push('يرجى الإجابة: هل أنت مدرب؟');
  }
  if (d.isTrainer === 'yes') {
    const n = parseInt(d.athleteCount, 10);
    if (d.athleteCount === '' || d.athleteCount === undefined || Number.isNaN(n) || n < 0) {
      errors.push('عدد الرياضيين مطلوب (رقم صحيح)');
    }
  }
  if (!d.trainingVenue) {
    errors.push('فضاء التدريب مطلوب');
  }
  if (!d.activityMode) {
    errors.push('كيفية النشاط مطلوبة');
  }
  const specs = d.trainingSpecialties || [];
  if (!Array.isArray(specs) || specs.length === 0) {
    errors.push('اختر تخصصاً تدريبياً واحداً على الأقل');
  }
  const ys = parseFloat(d.yearsSports);
  const yc = parseFloat(d.yearsCoaching);
  if (d.yearsSports === '' || d.yearsSports === undefined || Number.isNaN(ys) || ys < 0) {
    errors.push('سنوات ممارسة الرياضة مطلوبة');
  }
  if (d.yearsCoaching === '' || d.yearsCoaching === undefined || Number.isNaN(yc) || yc < 0) {
    errors.push('سنوات ممارسة التدريب مطلوبة');
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }
};

export const registerCoachingRegistration = async (payload) => {
  try {
    validateCoachingData(payload);
    const certificateFiles = Array.isArray(payload.certificateFiles)
      ? payload.certificateFiles.filter((f) => f instanceof File)
      : [];
    const { certificateFiles: _cf, ...dataWithoutFiles } = payload;

    const phone = (payload.phone || '').trim();
    const docBody = {
      ...dataWithoutFiles,
      phone,
      birthDate: normalizeCoachingBirthDate(payload.birthDate),
      tshirtSize: (payload.tshirtSize || '').trim(),
      trainingSpecialties: payload.trainingSpecialties || [],
      yearsSports: parseFloat(payload.yearsSports),
      yearsCoaching: parseFloat(payload.yearsCoaching),
      athleteCount:
        payload.isTrainer === 'yes' ? parseInt(payload.athleteCount, 10) : null,
      registrationType: 'coaching',
      registrationTimestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      registrationDate: new Date().toISOString()
    };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'الطلب استغرق وقتاً طويلاً جداً. يرجى التحقق من اتصال الإنترنت أو قواعد البيانات.'
            )
          ),
        10000
      )
    );

    const existingQuery = query(
      collection(db, 'coaching_registrations'),
      where('phone', '==', phone)
    );
    const existingSnapshot = await getDocs(existingQuery);
    const existingDoc = existingSnapshot.docs[0];

    let docId;
    let docRef;

    if (existingDoc) {
      docId = existingDoc.id;
      docRef = doc(db, 'coaching_registrations', docId);
      const prevUrls = existingDoc.data().certificateUrls;
      const mergedUrls = Array.isArray(prevUrls) ? [...prevUrls] : [];
      await Promise.race([updateDoc(docRef, docBody), timeoutPromise]);
      for (let i = 0; i < certificateFiles.length; i++) {
        const url = await uploadImage(certificateFiles[i], `${docId}_cert_${i}_${Date.now()}`);
        if (url && url.startsWith('http')) {
          mergedUrls.push(url);
        }
      }
      if (certificateFiles.length > 0) {
        await updateDoc(docRef, { certificateUrls: mergedUrls });
      }
      return {
        success: true,
        message: 'تم تحديث طلب التدريب السابق (نفس رقم الهاتف)',
        id: docId
      };
    }

    const savePromise = addDoc(collection(db, 'coaching_registrations'), docBody);
    const created = await Promise.race([savePromise, timeoutPromise]);
    docId = created.id;
    docRef = doc(db, 'coaching_registrations', docId);

    const urls = [];
    for (let i = 0; i < certificateFiles.length; i++) {
      const url = await uploadImage(certificateFiles[i], `${docId}_cert_${i}`);
      if (url && url.startsWith('http')) {
        urls.push(url);
      }
    }
    if (urls.length > 0) {
      await updateDoc(docRef, { certificateUrls: urls });
    }

    return {
      success: true,
      message: 'تم إرسال طلب التدريب بنجاح',
      id: docId
    };
  } catch (error) {
    throw error;
  }
};

export const updateCoachingRegistration = async (coachingId, payload) => {
  validateCoachingData({
    fullLegalName: payload.fullLegalName,
    phone: payload.phone,
    birthDate: payload.birthDate,
    tshirtSize: payload.tshirtSize,
    email: payload.email,
    city: payload.city,
    wilaya: payload.wilaya,
    isTrainer: payload.isTrainer,
    athleteCount: payload.athleteCount,
    trainingVenue: payload.trainingVenue,
    activityMode: payload.activityMode,
    trainingSpecialties: payload.trainingSpecialties,
    yearsSports: payload.yearsSports,
    yearsCoaching: payload.yearsCoaching
  });
  const docRef = doc(db, 'coaching_registrations', coachingId);
  await updateDoc(docRef, {
    fullLegalName: (payload.fullLegalName || '').trim(),
    phone: (payload.phone || '').trim(),
    birthDate: normalizeCoachingBirthDate(payload.birthDate),
    tshirtSize: (payload.tshirtSize || '').trim(),
    email: (payload.email || '').trim(),
    instagram: (payload.instagram || '').trim(),
    facebook: (payload.facebook || '').trim(),
    tiktok: (payload.tiktok || '').trim(),
    linkedin: (payload.linkedin || '').trim(),
    city: (payload.city || '').trim(),
    wilaya: (payload.wilaya || '').trim(),
    isTrainer: payload.isTrainer,
    athleteCount:
      payload.isTrainer === 'yes' ? parseInt(payload.athleteCount, 10) : null,
    trainingVenue: payload.trainingVenue,
    activityMode: payload.activityMode,
    trainingSpecialties: Array.isArray(payload.trainingSpecialties)
      ? payload.trainingSpecialties
      : [],
    yearsSports: parseFloat(payload.yearsSports),
    yearsCoaching: parseFloat(payload.yearsCoaching),
    achievementsTournaments: (payload.achievementsTournaments || '').trim(),
    updatedAt: new Date().toISOString()
  });
  return { success: true };
};

export const deleteCoachingRegistration = async (coachingId) => {
  const docRef = doc(db, 'coaching_registrations', coachingId);
  await deleteDoc(docRef);
  return { success: true, message: 'تم الحذف بنجاح' };
};

// Update athlete data
export const updateAthlete = async (athleteId, athleteData, collectionName = 'regional_registrations') => {
  try {
    // Extract image file from athleteData (we'll save it separately)
    const imageFile = athleteData.personalPicture;
    const { personalPicture, ...dataWithoutImage } = athleteData;
    
    // Prepare data with timestamps
    let athleteDataWithTimestamp = {
      ...dataWithoutImage,
      weight: athleteData.weight ? parseFloat(athleteData.weight) : null,
      height: athleteData.height ? parseFloat(athleteData.height) : null,
      updatedAt: new Date().toISOString()
    };
    
    // Ensure birthDate is in proper format (ISO string)
    if (athleteData.birthDate) {
      // If it's already a string in YYYY-MM-DD format, convert to ISO
      if (typeof athleteData.birthDate === 'string' && athleteData.birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        athleteDataWithTimestamp.birthDate = new Date(athleteData.birthDate).toISOString();
      } else if (typeof athleteData.birthDate === 'string' && athleteData.birthDate.includes('T')) {
        // Already in ISO format
        athleteDataWithTimestamp.birthDate = athleteData.birthDate;
      } else if (typeof athleteData.birthDate === 'string') {
        athleteDataWithTimestamp.birthDate = new Date(athleteData.birthDate).toISOString();
      } else {
        athleteDataWithTimestamp.birthDate = new Date(athleteData.birthDate).toISOString();
      }
    }

    // Update the document
    const docRef = doc(db, collectionName, athleteId);
    await updateDoc(docRef, athleteDataWithTimestamp);
    
    // Upload image if provided (non-blocking)
    if (imageFile) {
      const imageUrl = await uploadImage(imageFile, athleteId);
      
      if (imageUrl && imageUrl.trim() && imageUrl.startsWith('http')) {
        try {
          // Update the document with the image URL
          await updateDoc(docRef, {
            personalPictureUrl: imageUrl.trim()
          });
        } catch (updateError) {
          // Update still succeeded, just image URL wasn't saved
        }
      }
    }
    
    return {
      success: true,
      message: 'تم التحديث بنجاح',
      athleteId: athleteId
    };
  } catch (error) {
    throw error;
  }
};

// Delete athlete
export const deleteAthlete = async (athleteId, collectionName = 'regional_registrations') => {
  try {
    const docRef = doc(db, collectionName, athleteId);
    await deleteDoc(docRef);
    
    return {
      success: true,
      message: 'تم الحذف بنجاح'
    };
  } catch (error) {
    throw error;
  }
};

// Update only weight category (used when recalculating categories for existing data)
export const updateAthleteWeightCategory = async (athleteId, weightCategory, collectionName = 'regional_registrations') => {
  try {
    const docRef = doc(db, collectionName, athleteId);
    await updateDoc(docRef, { weightCategory });
    return { success: true };
  } catch (error) {
    throw error;
  }
};

const PUBLIC_PROFILE_COLLECTIONS = [
  'regional_registrations',
  'national_championship_registrations',
  'coaching_registrations'
];

const normalizePhone = (value) => (value || '').toString().replace(/\D+/g, '');

const normalizeName = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const getDocName = (item) => {
  if (item.collection === 'coaching_registrations') {
    return normalizeName(item.data.fullLegalName);
  }
  return normalizeName(`${item.data.firstName || ''} ${item.data.lastName || ''}`);
};

const getDocPhone = (item) => normalizePhone(item.data.phone);

export const fetchMergedPublicProfileByUid = async (uid) => {
  const profileUid = (uid || '').trim();
  if (!profileUid) {
    throw new Error('UID is required');
  }

  const directMatches = await Promise.all(
    PUBLIC_PROFILE_COLLECTIONS.map(async (collectionName) => {
      const snap = await getDoc(doc(db, collectionName, profileUid));
      if (!snap.exists()) return null;
      return { id: snap.id, collection: collectionName, data: snap.data() };
    })
  );

  const seedEntries = directMatches.filter(Boolean);
  if (seedEntries.length === 0) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  const allCollections = await Promise.all(
    PUBLIC_PROFILE_COLLECTIONS.map(async (collectionName) => {
      const snap = await getDocs(collection(db, collectionName));
      return snap.docs.map((d) => ({
        id: d.id,
        collection: collectionName,
        data: d.data()
      }));
    })
  );

  const allEntries = allCollections.flat();
  const phoneSet = new Set(seedEntries.map(getDocPhone).filter(Boolean));
  const nameSet = new Set(seedEntries.map(getDocName).filter(Boolean));
  const mergedMap = new Map(seedEntries.map((entry) => [`${entry.collection}:${entry.id}`, entry]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of allEntries) {
      const key = `${item.collection}:${item.id}`;
      if (mergedMap.has(key)) continue;
      const p = getDocPhone(item);
      const n = getDocName(item);
      const isMatch = (p && phoneSet.has(p)) || (n && nameSet.has(n));
      if (!isMatch) continue;

      mergedMap.set(key, item);
      if (p && !phoneSet.has(p)) {
        phoneSet.add(p);
        changed = true;
      }
      if (n && !nameSet.has(n)) {
        nameSet.add(n);
        changed = true;
      }
    }
  }

  const entries = Array.from(mergedMap.values()).sort((a, b) => {
    const aDate = new Date(a.data.registrationDate || a.data.createdAt || 0).getTime();
    const bDate = new Date(b.data.registrationDate || b.data.createdAt || 0).getTime();
    return bDate - aDate;
  });

  const athleteEntries = entries.filter((e) => e.collection !== 'coaching_registrations');
  const coachingEntries = entries.filter((e) => e.collection === 'coaching_registrations');

  const displayName =
    seedEntries.find((e) => e.collection === 'coaching_registrations')?.data.fullLegalName ||
    `${seedEntries[0].data.firstName || ''} ${seedEntries[0].data.lastName || ''}`.trim() ||
    'User';

  const publicUrl = buildPublicProfileUrl(profileUid);

  return {
    uid: profileUid,
    displayName,
    phones: Array.from(phoneSet),
    athleteEntries,
    coachingEntries,
    entries,
    publicUrl
  };
};
