import React from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import nccLogo from '../imgs/nccNewlogo.png';
import logo1 from '../imgs/logo1.png';
import sportpourtoutes from '../imgs/sportpourtouteLOGO.png';

const LicenseCard = ({ participant, onClose }) => {
  const cardRef = React.useRef(null);
  const [cardBackgroundColor, setCardBackgroundColor] = React.useState('#ffffff');
  const [opacity, setOpacity] = React.useState(1);

  // Convert hex color and opacity to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const rgbaBackgroundColor = hexToRgba(cardBackgroundColor, opacity);

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      // Wait for fonts to load, especially Cairo font for Arabic text
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      // Wait a bit to ensure all images and fonts are fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: rgbaBackgroundColor,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
        windowWidth: cardRef.current.scrollWidth,
        windowHeight: cardRef.current.scrollHeight,
        allowTaint: true,
        removeContainer: false,
        onclone: (clonedDoc) => {
          // Ensure fonts are applied in the cloned document
          const clonedElement = clonedDoc.body.querySelector('div[style*="148mm"]');
          if (clonedElement) {
            clonedElement.style.fontFamily = 'Cairo, sans-serif';
            // Ensure title has proper font
            const titleElement = clonedElement.querySelector('h2');
            if (titleElement) {
              titleElement.style.fontFamily = 'Cairo, sans-serif';
              titleElement.style.letterSpacing = 'normal';
              titleElement.style.wordSpacing = 'normal';
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('landscape', 'mm', [148, 85]); // ID card size (A6 landscape)
      
      const pdfWidth = 148;
      const pdfHeight = 85;
      
      // Calculate dimensions to fit the content
      const imgAspectRatio = canvas.width / canvas.height;
      const pdfAspectRatio = pdfWidth / pdfHeight;
      
      let finalWidth, finalHeight;
      
      if (imgAspectRatio > pdfAspectRatio) {
        // Image is wider - fit to width
        finalWidth = pdfWidth;
        finalHeight = pdfWidth / imgAspectRatio;
      } else {
        // Image is taller - fit to height
        finalHeight = pdfHeight;
        finalWidth = pdfHeight * imgAspectRatio;
      }
      
      // Center the image if it doesn't fill the entire page
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
      pdf.save(`license_${participant.firstName}_${participant.lastName}.pdf`);
    } catch (error) {
      alert('حدث خطأ أثناء تحميل البطاقة');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'غير محدد';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'غير محدد';
      }
      // Format as: dd/mm/yyyy
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return 'غير محدد';
    }
  };

  const getAddress = () => {
    const addr = participant.address;
    if (!addr) return 'غير محدد';
    const parts = [];
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.municipality) parts.push(addr.municipality);
    if (addr.wilaya) parts.push(addr.wilaya);
    return parts.join('، ') || 'غير محدد';
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '20px', maxWidth: '90%', maxHeight: '90%', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>بطاقة الترخيص</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>لون الخلفية:</label>
                <input
                  type="color"
                  value={cardBackgroundColor}
                  onChange={(e) => setCardBackgroundColor(e.target.value)}
                  style={{
                    width: '50px',
                    height: '40px',
                    border: '2px solid #ddd',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', whiteSpace: 'nowrap' }}>الشفافية:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  style={{
                    width: '80px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '12px', color: '#666', minWidth: '35px' }}>{Math.round(opacity * 100)}%</span>
              </div>
            </div>
            <button onClick={handleDownload} style={{ padding: '10px 20px', backgroundColor: '#ff8c00', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              <i className="fas fa-download"></i> تحميل PDF
            </button>
            <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              إغلاق
            </button>
          </div>
        </div>
        
        <div ref={cardRef} style={{ 
          width: '148mm', 
          height: '85mm', 
          backgroundColor: rgbaBackgroundColor, 
          border: '2px solid #000',
          padding: '10px',
          boxSizing: 'border-box',
          direction: 'rtl',
          fontFamily: 'Cairo, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          {/* Header - Logos Row */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '6px',
            paddingBottom: '6px',
            borderBottom: '2px solid #000'
          }}>
            {/* Left Logo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
              <img src={sportpourtoutes} alt="Federation" style={{ height: '25px', width: 'auto', objectFit: 'contain' }} />
              <span style={{ fontSize: '7px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.1' }}>الاتحادية الوطنية للرياضة للجميع</span>
            </div>
            
            {/* Middle Logo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
              <img src={logo1} alt="Ministry" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
              <span style={{ fontSize: '7px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.1' }}>وزارة الرياضة</span>
            </div>
            
            {/* Right Logo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
              <img src={nccLogo} alt="NCC" style={{ height: '35px', width: 'auto', objectFit: 'contain' }} />
              <span style={{ fontSize: '7px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.1' }}>اللجنة الوطنية للكلسثنكس</span>
            </div>
          </div>

          {/* Main Title */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '4px',
            paddingBottom: '4px',
            borderBottom: '1px solid #ccc'
          }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '22px', 
              fontWeight: 'bold', 
              color: '#000', 
              whiteSpace: 'nowrap',
              fontFamily: 'Cairo, sans-serif',
              textRendering: 'optimizeLegibility',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            }}>
              الاجازة الرياضية
            </h2>
          </div>

          {/* Main Content - Horizontal Layout */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            alignItems: 'flex-start',
            flex: '1',
            marginBottom: '2px'
          }}>
            {/* Left Side - Profile Picture */}
            <div style={{ flexShrink: 0, marginLeft: '0' }}>
              {(participant.personalPictureUrl || participant.personalPicture) ? (
                <img 
                  src={participant.personalPictureUrl || participant.personalPicture} 
                  alt="Athlete" 
                  crossOrigin="anonymous"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'flex';
                    }
                  }}
                  style={{ 
                    width: '90px', 
                    height: '110px', 
                    objectFit: 'cover',
                    borderRadius: '3px'
                  }} 
                />
              ) : (
                <div style={{ width: '90px', height: '110px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                  <span style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>لا توجد صورة</span>
                </div>
              )}
              <div style={{ display: 'none', width: '90px', height: '110px', borderRadius: '3px', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                <span style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>لا يمكن تحميل الصورة</span>
              </div>
            </div>

            {/* Middle Section - Name and Address */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'flex-start' }}>
              <div style={{ fontSize: '16px', lineHeight: '1.5' }}>
                <strong>الاسم:</strong> {participant.firstName}
              </div>
              <div style={{ fontSize: '16px', lineHeight: '1.5' }}>
                <strong>اللقب:</strong> {participant.lastName}
              </div>
              <div style={{ fontSize: '16px', lineHeight: '1.5' }}>
                <strong>العنوان:</strong> {getAddress()}
              </div>
            </div>

            {/* Right Side - Date, License Number, Blood Type */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
              <div style={{ fontSize: '16px', lineHeight: '1.5', textAlign: 'right' }}>
                <strong>تاريخ الميلاد:</strong> {formatDate(participant.birthDate)}
              </div>
              <div style={{ fontSize: '16px', lineHeight: '1.5', textAlign: 'right' }}>
                <strong>رقم اجازة:</strong> {participant.licenseNumber || 'غير محدد'}
              </div>
              <div style={{ fontSize: '16px', lineHeight: '1.5', textAlign: 'right' }}>
                <strong>فصيلة الدم:</strong> {participant.bloodType || 'غير محدد'}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            marginTop: '2px',
            paddingTop: '4px',
            borderTop: '1px solid #ccc',
            fontSize: '11px',
            textAlign: 'center',
            color: '#333',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <span><strong>Email:</strong> nccdz.office@gmail.com</span>
              <span><strong>Numéro de téléphone:</strong> +213 773 14 67 91</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseCard;
