import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const debugLogs: string[] = []
  const log = (message: string, data?: any) => {
    const logMessage = data ? `${message}: ${JSON.stringify(data)}` : message
    console.log(logMessage)
    debugLogs.push(logMessage)
  }

  try {
    const { rollNo, studentName, fatherName, branch } = await request.json()

    log('Request data', { rollNo, studentName, fatherName, branch })

    // Use session cookies from environment variables
    const sessionId = process.env.RTU_SESSION_ID
    const authToken = process.env.RTU_AUTH_TOKEN

    if (!sessionId || !authToken) {
      return NextResponse.json({
        success: false,
        error: 'RTU session cookies not configured. Please update .env.local with your RTU session cookies.',
        data: { found: false, students: [] },
        debugLogs
      }, { status: 400 })
    }

    log('Using session cookies from environment')

    // Map branch to subject code
    const branchToSubject: { [key: string]: string } = {
      'Artificial Intelligence And Data Science': '50',
      'Computer Science & Engg.': '7',
      'Computer Science & Engineering': '7',
      'Electronics & Comm. Engg.': '8',
      'Electronics & Communication Engg.': '8',
      'Mechanical Engineering': '15',
      'Civil Engineering': '4',
      'Electrical Engineering': '9',
      'Electrical Engg.': '10',
      'Information Technology': '12',
      'IT': '12',
      'Automobile Engineering': '3',
      'Chemical Engineering': '5',
      'Biotechnology': '99',
      'Robotics & Artificial Intelligence': '128',
      'Computer Science & Design': '83',
    }

    let subjectCode = branchToSubject[branch]
    if (!subjectCode) {
      const branchLower = branch.toLowerCase()
      for (const [key, value] of Object.entries(branchToSubject)) {
        if (key.toLowerCase().includes(branchLower) || branchLower.includes(key.toLowerCase())) {
          subjectCode = value
          break
        }
      }
      if (!subjectCode) {
        subjectCode = '7' // Default to Computer Science
      }
    }

    console.log('Branch:', branch, '-> Subject Code:', subjectCode)

    // Build cookie string
    const cookies = `ASP.NET_SessionId=${sessionId}; AuthToken=${authToken}`
    console.log('Cookie string prepared')

    // Step 1: GET the page to extract ViewState
    console.log('Step 1: Getting student document page...')
    const initialResponse = await fetch('https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookies
      }
    })

    console.log('Initial response status:', initialResponse.status)
    const initialHtml = await initialResponse.text()
    console.log('Initial HTML length:', initialHtml.length)
    console.log('Is logged in (check for logout):', initialHtml.toLowerCase().includes('logout'))
    
    if (initialHtml.toLowerCase().includes('logout.aspx?state=invalid')) {
      return NextResponse.json({
        success: false,
        error: 'RTU session expired. Please update cookies in .env.local:\n1. Log into RTU portal\n2. Get new cookies from DevTools\n3. Update RTU_SESSION_ID and RTU_AUTH_TOKEN\n4. Restart dev server',
        data: { found: false, students: [] }
      }, { status: 401 })
    }

    // Extract ViewState values from the initial HTML
    const viewStateMatch = initialHtml.match(/id="__VIEWSTATE"[^>]*value="([^"]*)"/)
    const viewStateGeneratorMatch = initialHtml.match(/id="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/)
    const eventValidationMatch = initialHtml.match(/id="__EVENTVALIDATION"[^>]*value="([^"]*)"/)

    const viewState = viewStateMatch ? viewStateMatch[1] : ''
    const viewStateGenerator = viewStateGeneratorMatch ? viewStateGeneratorMatch[1] : ''
    const eventValidation = eventValidationMatch ? eventValidationMatch[1] : ''

    log('ViewState found', { found: !!viewState, length: viewState.length })
    log('ViewStateGenerator', viewStateGenerator)
    log('EventValidation found', { found: !!eventValidation, length: eventValidation.length })

    if (!viewState || !eventValidation) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to extract ViewState from RTU portal',
        data: { found: false, students: [] },
        debugLogs,
        htmlSample: initialHtml.substring(0, 2000)
      })
    }

    // Extract academic session from roll number (first 2 digits)
    // e.g., 24EJCCS002 -> year 24 -> dropdown value 22 (2025-2026 session)
    const rollYear = rollNo.match(/^(\d{2})/)?.[1] || '22'
    // Map roll number year to dropdown value: 24→22, 25→23, 23→9, 22→8, etc.
    const sessionMap: Record<string, string> = {
      '25': '23',  // 2026-2027
      '24': '22',  // 2025-2026 (corrected from 21)
      '23': '9',   // 2023-2024
      '22': '8',   // 2022-2023
      '21': '7',   // 2021-2022
      '20': '6',   // 2020-2021
    }
    const academicSession = sessionMap[rollYear] || '22'
    log('Academic session from roll number', { rollYear, dropdownValue: academicSession })

    // Sequential AJAX calls to simulate cascading dropdown behavior
    let currentViewState = viewState
    let currentViewStateGenerator = viewStateGenerator
    let currentEventValidation = eventValidation

    // Step 1: Select Academic Session
    log('Step 1: Selecting Academic Session')
    let formData = new URLSearchParams({
      '__LASTFOCUS': '',
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddlAcadminSession',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': currentViewState,
      '__VIEWSTATEGENERATOR': currentViewStateGenerator,
      '__VIEWSTATEENCRYPTED': '',
      '__EVENTVALIDATION': currentEventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '0',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
      'ctl00$ContentPlaceHolder1$ddlDegreeCycle': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': '',
      'ctl00$ContentPlaceHolder1$txtStudentName': '',
      'ctl00$ContentPlaceHolder1$txtFName': ''
    })

    let response = await fetch('https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
        'Referer': 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx',
        'Cookie': cookies,
        'Origin': 'https://rtu.sumsraj.com',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    })

    let html = await response.text()
    
    // Extract updated ViewState after academic session selection
    const vsMatch1 = html.match(/__VIEWSTATE[^>]+value="([^"]+)"/)
    const vsgMatch1 = html.match(/__VIEWSTATEGENERATOR[^>]+value="([^"]+)"/)
    const evMatch1 = html.match(/__EVENTVALIDATION[^>]+value="([^"]+)"/)
    
    if (vsMatch1) currentViewState = vsMatch1[1]
    if (vsgMatch1) currentViewStateGenerator = vsgMatch1[1]
    if (evMatch1) currentEventValidation = evMatch1[1]
    
    log('After Academic Session', { viewStateLength: currentViewState.length })

    // Step 2: Select Category
    log('Step 2: Selecting Category')
    formData = new URLSearchParams({
      '__LASTFOCUS': '',
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddlStuCategory',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': currentViewState,
      '__VIEWSTATEGENERATOR': currentViewStateGenerator,
      '__VIEWSTATEENCRYPTED': '',
      '__EVENTVALIDATION': currentEventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
      'ctl00$ContentPlaceHolder1$ddlDegreeCycle': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': '',
      'ctl00$ContentPlaceHolder1$txtStudentName': '',
      'ctl00$ContentPlaceHolder1$txtFName': ''
    })

    response = await fetch('https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
        'Referer': 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx',
        'Cookie': cookies,
        'Origin': 'https://rtu.sumsraj.com',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    })

    html = await response.text()
    
    const vsMatch2 = html.match(/__VIEWSTATE[^>]+value="([^"]+)"/)
    const vsgMatch2 = html.match(/__VIEWSTATEGENERATOR[^>]+value="([^"]+)"/)
    const evMatch2 = html.match(/__EVENTVALIDATION[^>]+value="([^"]+)"/)
    
    if (vsMatch2) currentViewState = vsMatch2[1]
    if (vsgMatch2) currentViewStateGenerator = vsgMatch2[1]
    if (evMatch2) currentEventValidation = evMatch2[1]
    
    log('After Category', { viewStateLength: currentViewState.length })

    // Step 3: Select College
    log('Step 3: Selecting College')
    formData = new URLSearchParams({
      '__LASTFOCUS': '',
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$D_ddlCollege',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': currentViewState,
      '__VIEWSTATEGENERATOR': currentViewStateGenerator,
      '__VIEWSTATEENCRYPTED': '',
      '__EVENTVALIDATION': currentEventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
      'ctl00$ContentPlaceHolder1$ddlDegreeCycle': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': '',
      'ctl00$ContentPlaceHolder1$txtStudentName': '',
      'ctl00$ContentPlaceHolder1$txtFName': ''
    })

    response = await fetch('https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
        'Referer': 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx',
        'Cookie': cookies,
        'Origin': 'https://rtu.sumsraj.com',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    })

    html = await response.text()
    
    const vsMatch3 = html.match(/__VIEWSTATE[^>]+value="([^"]+)"/)
    const vsgMatch3 = html.match(/__VIEWSTATEGENERATOR[^>]+value="([^"]+)"/)
    const evMatch3 = html.match(/__EVENTVALIDATION[^>]+value="([^"]+)"/)
    
    if (vsMatch3) currentViewState = vsMatch3[1]
    if (vsgMatch3) currentViewStateGenerator = vsgMatch3[1]
    if (evMatch3) currentEventValidation = evMatch3[1]
    
    log('After College', { viewStateLength: currentViewState.length })

    // Step 4: Select Degree
    log('Step 4: Selecting Degree')
    formData = new URLSearchParams({
      '__LASTFOCUS': '',
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddlDegree',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': currentViewState,
      '__VIEWSTATEGENERATOR': currentViewStateGenerator,
      '__VIEWSTATEENCRYPTED': '',
      '__EVENTVALIDATION': currentEventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '1',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
      'ctl00$ContentPlaceHolder1$ddlDegreeCycle': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': '',
      'ctl00$ContentPlaceHolder1$txtStudentName': '',
      'ctl00$ContentPlaceHolder1$txtFName': ''
    })

    response = await fetch('https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
        'Referer': 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx',
        'Cookie': cookies,
        'Origin': 'https://rtu.sumsraj.com',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    })

    html = await response.text()
    
    const vsMatch4 = html.match(/__VIEWSTATE[^>]+value="([^"]+)"/)
    const vsgMatch4 = html.match(/__VIEWSTATEGENERATOR[^>]+value="([^"]+)"/)
    const evMatch4 = html.match(/__EVENTVALIDATION[^>]+value="([^"]+)"/)
    
    if (vsMatch4) currentViewState = vsMatch4[1]
    if (vsgMatch4) currentViewStateGenerator = vsgMatch4[1]
    if (evMatch4) currentEventValidation = evMatch4[1]
    
    log('After Degree', { viewStateLength: currentViewState.length })

    // Step 5: Select Subject (using subjectCode from earlier mapping)
    const subjectValue = subjectCode // Already mapped at the top of the function

    log('Step 5: Selecting Subject', { branch, subjectValue })
    formData = new URLSearchParams({
      '__LASTFOCUS': '',
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$D_ddlSubject',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': currentViewState,
      '__VIEWSTATEGENERATOR': currentViewStateGenerator,
      '__VIEWSTATEENCRYPTED': '',
      '__EVENTVALIDATION': currentEventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '1',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': subjectValue,
      'ctl00$ContentPlaceHolder1$ddlDegreeCycle': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': '',
      'ctl00$ContentPlaceHolder1$txtStudentName': '',
      'ctl00$ContentPlaceHolder1$txtFName': ''
    })

    response = await fetch('https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
        'Referer': 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx',
        'Cookie': cookies,
        'Origin': 'https://rtu.sumsraj.com',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    })

    html = await response.text()
    
    const vsMatch5 = html.match(/__VIEWSTATE[^>]+value="([^"]+)"/)
    const vsgMatch5 = html.match(/__VIEWSTATEGENERATOR[^>]+value="([^"]+)"/)
    const evMatch5 = html.match(/__EVENTVALIDATION[^>]+value="([^"]+)"/)
    
    if (vsMatch5) currentViewState = vsMatch5[1]
    if (vsgMatch5) currentViewStateGenerator = vsgMatch5[1]
    if (evMatch5) currentEventValidation = evMatch5[1]
    
    log('After Subject', { viewStateLength: currentViewState.length })

    // Try multiple search variations - prioritize roll number
    const searchVariations = [
      { regNo: rollNo, name: '', father: '' },
      { regNo: rollNo, name: studentName, father: fatherName },
      { regNo: '', name: studentName, father: fatherName },
      { regNo: '', name: studentName, father: '' },
      { regNo: '', name: '', father: fatherName },
    ]

    let studentData: any = { found: false }
    let lastHtmlSample = ''

    for (const variation of searchVariations) {
      log('Trying search variation', variation)

      // Final step: Submit search with all fields properly set
      formData = new URLSearchParams({
        '__LASTFOCUS': '',
        '__EVENTTARGET': '',
        '__EVENTARGUMENT': '',
        '__VIEWSTATE': currentViewState,
        '__VIEWSTATEGENERATOR': currentViewStateGenerator,
        '__VIEWSTATEENCRYPTED': '',
        '__EVENTVALIDATION': currentEventValidation,
        'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
        'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
        'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
        'ctl00$ContentPlaceHolder1$ddlDegree': '1',
        'ctl00$ContentPlaceHolder1$D_ddlSubject': subjectValue,
        'ctl00$ContentPlaceHolder1$ddlDegreeCycle': '0',
        'ctl00$ContentPlaceHolder1$txtRegNo': variation.regNo,
        'ctl00$ContentPlaceHolder1$txtStudentName': variation.name,
        'ctl00$ContentPlaceHolder1$txtFName': variation.father,
        'ctl00$ContentPlaceHolder1$btnViewStudentDetails': 'VIEW STUDENT LIST'
      })

      log('Form data prepared', { regNo: variation.regNo, nameLength: variation.name.length, fatherLength: variation.father.length })

      // Make final POST request with all cascading selections completed
      response = await fetch('https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
          'Referer': 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx',
          'Cookie': cookies,
          'Origin': 'https://rtu.sumsraj.com',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        body: formData.toString()
      })

      log('RTU Response Status', response.status)

      const html = await response.text()
      
      log('HTML response', { 
        length: html.length, 
        hasGridView: html.includes('GridView1'),
        hasTable: html.includes('<table'),
        hasNoRecord: html.includes('No Record Found')
      })

      lastHtmlSample = html

      // Parse the HTML to extract student data
      studentData = parseStudentData(html, subjectValue, academicSession)
      
      log('Parsed data', { found: studentData.found, studentCount: studentData.students?.length || 0 })

      if (studentData.found && studentData.students && studentData.students.length > 0 && Object.keys(studentData.students[0]).length > 0) {
        log('Success with variation', variation)
        break
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: studentData,
      debugLogs,
      htmlSample: lastHtmlSample
    })
  } catch (error) {
    console.error('Error fetching RTU data:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch data from RTU portal',
        errorDetails: error instanceof Error ? error.message : String(error),
        debugLogs
      },
      { status: 500 }
    )
  }
}

function parseStudentData(html: string, subjectCode: string, academicSession: string) {
  console.log('parseStudentData called, HTML length:', html.length)
  
  // Extract data from the HTML response
  const data: any = {
    found: false,
    students: []
  }

  try {
    // Check if table exists (looking for gvEnrolGenerated table, not GridView1)
    console.log('Looking for gvEnrolGenerated table...')
    if (!html.includes('gvEnrolGenerated')) {
      console.log('No gvEnrolGenerated found in HTML')
      console.log('Checking for "No Record Found" message:', html.includes('No Record Found'))
      const anyTableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
      console.log('Any table found:', !!anyTableMatch)
      if (anyTableMatch) {
        console.log('Table sample:', anyTableMatch[0].substring(0, 500))
      }
      return data
    }
    
    console.log('gvEnrolGenerated found, parsing table...')
    if (html.includes('table-grid-view')) {
      data.found = true

      // Create a student object from the parsed data
      const student: any = {}

      // Extract roll number - matches: id="ctl00_ContentPlaceHolder1_gvEnrolGenerated_ctl02_lblRegNo">24EJCCS002</span>
      const rollNoMatch = html.match(/gvEnrolGenerated[^>]*lblRegNo">([^<]+)</)
      if (rollNoMatch) student.rollNo = rollNoMatch[1]

      // Extract student name - matches: id="...lblName">AAKASH YADAV</span>
      const nameMatch = html.match(/gvEnrolGenerated[^>]*lblName">([^<]+)</)
      if (nameMatch) student.studentName = nameMatch[1]

      // Extract Hindi name - matches: name="...txt_fullname_h" ... value="आकाश यादव"
      const hindiNameMatch = html.match(/txt_fullname_h"[^>]*value="([^"]+)"/)
      if (hindiNameMatch) student.hindiName = hindiNameMatch[1]

      // Extract DOB - matches: name="...txt_DOB" ... value="04/06/2008"
      const dobMatch = html.match(/txt_DOB"[^>]*value="([^"]+)"/)
      if (dobMatch) student.dob = dobMatch[1]

      // Extract email - matches: name="...txt_C_Email" ... value="raoaakash1008@gmail.com"
      const emailMatch = html.match(/txt_C_Email"[^>]*value="([^"]+)"/)
      if (emailMatch) student.email = emailMatch[1]

      // Extract mobile - matches: name="...txt_C_Mobile" ... value="9057337071"
      const mobileMatch = html.match(/txt_C_Mobile"[^>]*value="([^"]+)"/)
      if (mobileMatch) student.mobile = mobileMatch[1]

      // Extract enrollment number - matches: id="...lblEnrollmentNo">24E1JCCSM30P002</span>
      const enrollmentMatch = html.match(/lblEnrollmentNo">([^<]+)</)
      if (enrollmentMatch) student.enrollmentNo = enrollmentMatch[1]

      // Extract photo path - matches: name="...hdn_flA" ... value="16945_rp.jpg"
      const photoMatch = html.match(/hdn_flA"[^>]*value="([^"]+)"/)
      if (photoMatch) student.photoPath = photoMatch[1]

      // Extract signature path - matches: name="...hdn_flA1" ... value="16945_rs.jpg"
      const signatureMatch = html.match(/hdn_flA1"[^>]*value="([^"]+)"/)
      if (signatureMatch) student.signaturePath = signatureMatch[1]

      // Photo and signature URLs - use proxy endpoint with rollNo for postback
      if (student.photoPath) {
        student.photoUrl = `/api/rtu-image?rollNo=${encodeURIComponent(student.rollNo)}&type=photo&subject=${encodeURIComponent(subjectCode)}&session=${encodeURIComponent(academicSession)}`
      }
      if (student.signaturePath) {
        student.signatureUrl = `/api/rtu-image?rollNo=${encodeURIComponent(student.rollNo)}&type=signature&subject=${encodeURIComponent(subjectCode)}&session=${encodeURIComponent(academicSession)}`
      }

      // Add student to array
      data.students.push(student)
      console.log('Student data extracted:', student)
    }
  } catch (error) {
    console.error('Error parsing student data:', error)
  }

  return data
}
