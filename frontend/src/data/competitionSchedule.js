// Competition Schedule Data with wilaya numbers
export const competitionSchedule = [
  { wilaya: "الجزائر العاصمة", wilayaNumber: 16, date: "2026-02-13" },
  { wilaya: "بومرداس", wilayaNumber: 35, date: "2026-02-14" },
  { wilaya: "تيزي وزو", wilayaNumber: 15, date: "2026-02-06" },
  { wilaya: "البويرة", wilayaNumber: 10, date: "2026-02-07" },
  { wilaya: "المسيلة", wilayaNumber: 28, date: "2026-01-31" },
  { wilaya: "سعيدة", wilayaNumber: 20, date: "2026-02-05" },
  { wilaya: "بسكرة", wilayaNumber: 7, date: "2026-01-23" },
  { wilaya: "قسنطينة", wilayaNumber: 25, date: "2026-02-14" },
  { wilaya: "ورقلة", wilayaNumber: 30, date: "2026-02-14" },
  { wilaya: "تيارت", wilayaNumber: 14, date: "2026-02-13" }
].sort((a, b) => a.wilayaNumber - b.wilayaNumber);

// Get all wilayas
export const getAllWilayas = () => {
  return competitionSchedule.map(item => item.wilaya);
};

// Get competition date for a wilaya
export const getCompetitionDate = (wilaya) => {
  const competition = competitionSchedule.find(item => item.wilaya === wilaya);
  return competition ? competition.date : null;
};

// Check if two wilayas have conflicting dates
export const hasDateConflict = (selectedWilayas) => {
  const dates = selectedWilayas
    .map(wilaya => getCompetitionDate(wilaya))
    .filter(date => date !== null); // Ignore null dates
  
  // Check for duplicates
  const uniqueDates = new Set(dates);
  return dates.length !== uniqueDates.size;
};

// Get conflicting wilayas
export const getConflictingWilayas = (selectedWilayas) => {
  const dateMap = {};
  const conflicts = [];
  
  selectedWilayas.forEach(wilaya => {
    const date = getCompetitionDate(wilaya);
    if (date !== null) {
      if (dateMap[date]) {
        conflicts.push(...dateMap[date], wilaya);
        dateMap[date].push(wilaya);
      } else {
        dateMap[date] = [wilaya];
      }
    }
  });
  
  return [...new Set(conflicts)];
};
