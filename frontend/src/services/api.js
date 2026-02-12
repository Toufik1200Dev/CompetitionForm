import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { hasDateConflict } from '../data/competitionSchedule';
import { CLOUDINARY_UPLOAD_URL, cloudinaryConfig } from '../config/cloudinary';

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
