import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkPhotoExists } from '@/lib/storage'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { rollNo } = await request.json()

    if (!rollNo) {
      return NextResponse.json({ error: 'Roll number required' }, { status: 400 })
    }

    // Fetch student data from Supabase
    const { data: student, error } = await supabase
      .from('firstyear')
      .select('*')
      .eq('roll_no', rollNo)
      .single()

    if (error || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Check if photo exists in Supabase Storage
    const photoCheck = await checkPhotoExists(rollNo)
    
    let photoUrl = photoCheck.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.student_name || rollNo)}&size=200&background=6366f1&color=fff`

    // Generate HTML admit card
    const admitCardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admit Card - ${student.student_name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .admit-card {
      background: white;
      width: 800px;
      max-width: 100%;
      border-radius: 15px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .header h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .header p {
      font-size: 16px;
      opacity: 0.9;
    }
    
    .content {
      padding: 40px;
    }
    
    .student-info {
      display: grid;
      grid-template-columns: 1fr 200px;
      gap: 30px;
      margin-bottom: 30px;
    }
    
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .info-field {
      margin-bottom: 15px;
    }
    
    .info-label {
      font-size: 12px;
      color: #666;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .info-value {
      font-size: 16px;
      color: #333;
      font-weight: 500;
    }
    
    .photo-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    
    .photo {
      width: 180px;
      height: 180px;
      border-radius: 10px;
      object-fit: cover;
      border: 4px solid #667eea;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    }
    
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
      margin: 30px 0 15px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px 40px;
      border-top: 2px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .signature-box {
      text-align: center;
      padding: 10px;
    }
    
    .signature-line {
      width: 200px;
      border-top: 2px solid #333;
      margin-top: 50px;
    }
    
    .signature-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    
    .instructions {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
    }
    
    .instructions h3 {
      font-size: 14px;
      color: #856404;
      margin-bottom: 10px;
    }
    
    .instructions ul {
      font-size: 12px;
      color: #856404;
      padding-left: 20px;
    }
    
    .instructions li {
      margin-bottom: 5px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .admit-card {
        box-shadow: none;
      }
      
      @page {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="admit-card">
    <div class="header">
      <h1>🎓 ENGINEERING COLLEGE JHALAWAR</h1>
      <h2>ADMIT CARD</h2>
      <p>First Year Engineering - Academic Session 2024-25</p>
    </div>
    
    <div class="content">
      <div class="student-info">
        <div class="info-section">
          <div class="info-field">
            <div class="info-label">Student Name</div>
            <div class="info-value">${student.student_name || 'N/A'}</div>
          </div>
          
          <div class="info-field">
            <div class="info-label">Roll Number</div>
            <div class="info-value">${student.roll_no}</div>
          </div>
          
          <div class="info-field">
            <div class="info-label">Enrollment No</div>
            <div class="info-value">${student.enrollment_no || 'N/A'}</div>
          </div>
          
          <div class="info-field">
            <div class="info-label">Father's Name</div>
            <div class="info-value">${student.father_name || 'N/A'}</div>
          </div>
          
          <div class="info-field">
            <div class="info-label">Mother's Name</div>
            <div class="info-value">${student.mother_name || 'N/A'}</div>
          </div>
          
          <div class="info-field">
            <div class="info-label">Branch</div>
            <div class="info-value">${student.branch || 'N/A'}</div>
          </div>
          
          <div class="info-field">
            <div class="info-label">Section</div>
            <div class="info-value">${student.student_section || 'N/A'}</div>
          </div>
          
          <div class="info-field">
            <div class="info-label">Mobile No</div>
            <div class="info-value">${student.mobile_no || 'N/A'}</div>
          </div>
        </div>
        
        <div class="photo-container">
          <img src="${photoUrl.startsWith('http') ? photoUrl : 'http://localhost:3000' + photoUrl}" alt="Student Photo" class="photo" />
        </div>
      </div>
      
      <div class="section-title">📋 Examination Details</div>
      <div class="info-section">
        <div class="info-field">
          <div class="info-label">Examination</div>
          <div class="info-value">First Year Engineering</div>
        </div>
        
        <div class="info-field">
          <div class="info-label">Exam Date</div>
          <div class="info-value">As per Schedule</div>
        </div>
        
        <div class="info-field">
          <div class="info-label">Reporting Time</div>
          <div class="info-value">30 minutes before exam</div>
        </div>
        
        <div class="info-field">
          <div class="info-label">Exam Center</div>
          <div class="info-value">Engineering College Jhalawar</div>
        </div>
      </div>
      
      <div class="instructions">
        <h3>⚠️ Important Instructions</h3>
        <ul>
          <li>Students must bring this admit card to the examination hall</li>
          <li>Admit card should be preserved till the declaration of result</li>
          <li>Entry to examination hall will not be allowed without admit card</li>
          <li>Students must carry a valid ID proof along with the admit card</li>
          <li>Mobile phones and electronic devices are strictly prohibited</li>
        </ul>
      </div>
    </div>
    
    <div class="footer">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Student Signature</div>
      </div>
      
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Authorized Signatory</div>
      </div>
    </div>
  </div>
  
  <script>
    // Auto print when opened
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `

    return new NextResponse(admitCardHtml, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="admit_card_${rollNo}.html"`
      }
    })

  } catch (error) {
    console.error('[Generate Admit Card] Error:', error)
    return NextResponse.json({
      error: 'Failed to generate admit card',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
