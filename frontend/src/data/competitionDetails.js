export const competitionDetails = {
  "الجزائر العاصمة": {
    date: "2026-02-13, 2026-02-12",
    responsibleName: "عماد الدين سكر",
    instagram: "https://www.instagram.com/gymclub.usthb/",
    phone: "0554956508",
    address: "skate park bab ezzouar ",
    googleMapsLink: "https://maps.app.goo.gl/MNLn4KjeE8PFyP9Y7"
  },
  "بومرداس": {
    date: "2026-02-14",
    responsibleName: "مروش سيد علي",
    instagram: "https://www.instagram.com/sidali_fitworkout/",
    phone: "0540975190",
    address: " Fit park gym",
    googleMapsLink: "https://maps.app.goo.gl/mQ7ps7NTWpSUwCC37?g_st=ic"
  },
  "تيزي وزو": {
    date: "2026-02-06",
    responsibleName: "محمد القبي",
    instagram: "https://www.instagram.com/izem.calisthenics?igsh=a2s2djU4cHRtbzd4&utm_source=qr",
    phone: "0675455912",
    address: "الفضاء الرياضي حروزة بلدية حروزة",
    googleMapsLink: "https://maps.app.goo.gl/x27dwaRQnfaWP5M6A?g_st=com.google.maps.preview.copy"
  },
  "البويرة": {
    date: "2026-02-14",
    responsibleName: "مسعودان نبيل (قاسي)",
    instagram: "https://www.instagram.com/wolfsbarbouira?igsh=MTJ4anM3cmk3MTJueQ==",
    phone: "0655768501",
    address: "غابة الريش",
    googleMapsLink: "https://maps.app.goo.gl/hXNt2oMEaZFVPaHT9"
  },
  "المسيلة": {
    date: "2026-02-13",
    responsibleName: "العمري أيوب",
    instagram: "https://www.instagram.com/lamri_ayoub_mm?igsh=cGs4a2dubzBoNDRt&utm_source=qr",
    phone: "0559329541",
    address: "salle bar lion وسط الولاية",
    googleMapsLink: "https://maps.app.goo.gl/1w5ZHnUd7ewDKGUk7?g_st=ic"
  },
  "سعيدة": {
    date: "2026-02-05",
    responsibleName: " حسين ",
    instagram: "https://www.instagram.com/rabie_sw/",
    phone: "0798918533 , 0697729493 ",
    address: "حي البدر وسط الولاية",
    googleMapsLink: "https://maps.app.goo.gl/uaUDZsrqQpTQosom7?g_st=aw"
  },
  "بسكرة": {
    date: "2026-01-23",
    responsibleName: "قصوري محمد امين",
    instagram: "https://www.instagram.com/djameleddinechettouh?igsh=MTdjYnB3Ymd3OGQxZg==",
    phone: "0675455912",
    address: "",
    googleMapsLink: "https://maps.app.goo.gl/8vzWJm9R8CFctZ3e9?g_st=afm"
  },
  "قسنطينة": {
    date: "2026-02-14",
    responsibleName: "بخوش محمد",
    instagram: "https://www.instagram.com/bibeche_callisthenics?igsh=czVucmRsanMyd2xk&utm_source=qr0781817467",
    phone: "0781817467",
    address: "salle the guts club",
    googleMapsLink: "https://maps.app.goo.gl/iVoH65gaAS3jypch8?g_st=iwb"
  },
  "ورقلة": {
    date: "2026-02-14",
    responsibleName: "ليتيم هشام",
    instagram: "",
    phone: "",
    address: "",
    googleMapsLink: ""
  },
  "تيارت": {
    date: "2026-02-13",
    responsibleName: "جلالي ابراهيم الخليل",
    instagram: "https://www.instagram.com/sw3iboo?igsh=dnZoc2s0dTVrZjg3",
    phone: "0663303337",
    address: "غابة ردار وسط الولاية",
    googleMapsLink: "https://maps.app.goo.gl/UjTYXqu8suUYgCwt7"
  }
};

export const getCompetitionDetails = (wilaya) => {
  return competitionDetails[wilaya] || null;
};

export const getResponsibleName = (wilaya) => {
  const details = getCompetitionDetails(wilaya);
  return details ? details.responsibleName : null;
};

export const getInstagramAccount = (wilaya) => {
  const details = getCompetitionDetails(wilaya);
  return details ? details.instagram : null;
};

export const getPhoneNumber = (wilaya) => {
  const details = getCompetitionDetails(wilaya);
  return details ? details.phone : null;
};

export const getCompetitionAddress = (wilaya) => {
  const details = getCompetitionDetails(wilaya);
  return details ? details.address : null;
};

export const getGoogleMapsLink = (wilaya) => {
  const details = getCompetitionDetails(wilaya);
  return details ? details.googleMapsLink : null;
};
