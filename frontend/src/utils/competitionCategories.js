// Competition Categories and Weight Classes

export const GENDER = {
  MALE: 'male',
  FEMALE: 'female'
};

export const COMPETITION_TYPES = {
  FREESTYLE: 'freestyle',
  POWER_LIFTING: 'power_lifting',
  STRENGTH_ENDURANCE: 'strength_endurance'
};

// Get weight category based on gender, weight, and competition type.
// Rule: if weight is equal to or over a boundary, the athlete is in the category above (e.g. 80 kg freestyle male = heavy).
// Freestyle Male: light < 68, medium 68–79.99..., heavy >= 80
// Freestyle Female: light < 50, medium 50–59.99..., heavy >= 60
// Power/Endurance Male: light < 80, medium 80–89.99..., heavy >= 90
// Power/Endurance Female: open
export const getWeightCategory = (gender, weight, competitionType) => {
  const weightNum = parseFloat(weight);

  if (isNaN(weightNum) || weightNum <= 0) {
    return null;
  }

  if (competitionType === COMPETITION_TYPES.FREESTYLE) {
    if (gender === GENDER.MALE) {
      if (weightNum < 68) return 'light';
      if (weightNum < 80) return 'medium';  // 68 <= weight < 80
      return 'heavy';                         // weight >= 80
    } else if (gender === GENDER.FEMALE) {
      if (weightNum < 50) return 'light';
      if (weightNum < 60) return 'medium';   // 50 <= weight < 60
      return 'heavy';                         // weight >= 60
    }
  } else if (competitionType === COMPETITION_TYPES.POWER_LIFTING ||
             competitionType === COMPETITION_TYPES.STRENGTH_ENDURANCE) {
    if (gender === GENDER.MALE) {
      if (weightNum < 80) return 'light';
      if (weightNum < 90) return 'medium';    // 80 <= weight < 90
      return 'heavy';                          // weight >= 90
    } else if (gender === GENDER.FEMALE) {
      return 'open'; // Women have open category (absolute) for Power/Endurance
    }
  }

  return null;
};

// Get weight category label in Arabic
export const getWeightCategoryLabel = (category, gender, competitionType) => {
  const labels = {
    light: 'خفيف',
    medium: 'متوسط',
    heavy: 'ثقيل',
    open: 'مطلقة'
  };

  return labels[category] || '';
};

// Get competition type label in Arabic
export const getCompetitionTypeLabel = (type) => {
  const labels = {
    [COMPETITION_TYPES.FREESTYLE]: 'الأسلوب الحر (Freestyle)',
    [COMPETITION_TYPES.POWER_LIFTING]: 'القوة (Power/Street Lifting)',
    [COMPETITION_TYPES.STRENGTH_ENDURANCE]: 'التحمل (Strength/Endurance)'
  };

  return labels[type] || '';
};

// Calculate age from birth date
export const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

// Check if athlete qualifies for veteran category
export const isVeteranEligible = (age, competitionType) => {
  if (!age || age < 18) return false;
  
  if (competitionType === COMPETITION_TYPES.FREESTYLE) {
    return age >= 30;
  } else if (competitionType === COMPETITION_TYPES.POWER_LIFTING || 
             competitionType === COMPETITION_TYPES.STRENGTH_ENDURANCE) {
    return age >= 35;
  }
  
  return false;
};

// Get age category
export const getAgeCategory = (age, competitionType, isVeteran) => {
  if (!age || age < 18) return null;
  
  if (isVeteran) {
    return 'veteran';
  }
  
  return 'regular';
};
