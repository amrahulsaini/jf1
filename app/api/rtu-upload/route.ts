import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { incrementMediaUpdate } from '@/lib/media-updates'
import { uploadToStorage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const sessionId = process.env.RTU_SESSION_ID
  const authToken = process.env.RTU_AUTH_TOKEN

  if (!sessionId || !authToken) {
    return NextResponse.json({ error: 'RTU credentials not configured' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const rollNo = formData.get('rollNo') as string
    const rawPhoto = formData.get('photo') as File | null
    const rawSignature = formData.get('signature') as File | null

    // Browsers often send an "empty" File even when nothing is selected.
    const normalizeUpload = (file: File | null): File | null => {
      if (!file) return null
      if (file.size <= 0) return null
      if (!file.name) return null
      return file
    }

    const photo = normalizeUpload(rawPhoto)
    const signature = normalizeUpload(rawSignature)

    const recordCountsAndReturn = async (payload: any, status?: number) => {
      try {
        if (payload?.success) {
          console.log(`[RTU Upload] ========== STARTING SUPABASE STORAGE UPLOAD ==========`)
          console.log(`[RTU Upload] Roll No: ${rollNo}`)
          console.log(`[RTU Upload] Photo provided: ${!!photo}, Signature provided: ${!!signature}`)
          console.log(`[RTU Upload] Existing photo name from RTU: ${existingPhotoName || 'NONE'}`)
          console.log(`[RTU Upload] Existing signature name from RTU: ${existingSignatureName || 'NONE'}`)
          
          if (photo) await incrementMediaUpdate(rollNo, 'photo')
          if (signature) await incrementMediaUpdate(rollNo, 'signature')
          
          // Upload photos to Supabase Storage
          if (photo) {
            try {
              const photoExtension = photo.type === 'image/png' ? 'png' : 'jpg'
              const standardFilename = `photo_${rollNo}.${photoExtension}`
              
              // Upload with standardized name
              const uploadResult = await uploadToStorage(photo, standardFilename)
              if (uploadResult.success) {
                console.log(`[RTU Upload] Uploaded standardized photo: ${standardFilename}`)
              } else {
                console.error(`[RTU Upload] Failed to upload photo: ${uploadResult.error}`)
              }
              
              // Upload with original filename and save mapping
              const originalPhotoName = existingPhotoName || photo.name
              console.log(`[RTU Upload] Photo - Original: ${originalPhotoName}, Standard: ${standardFilename}`)
              
              if (originalPhotoName && originalPhotoName !== standardFilename) {
                await uploadToStorage(photo, originalPhotoName)
                console.log(`[RTU Upload] Uploaded original photo: ${originalPhotoName}`)
                
                // Save mapping in database
                console.log(`[RTU Upload] Saving photo mapping to database: roll_no=${rollNo}`)
                const { data, error: dbError } = await (supabase
                  .from('photo_mappings') as any)
                  .upsert({
                    roll_no: rollNo.toUpperCase(),
                    original_photo: originalPhotoName,
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'roll_no'
                  })
                
                if (dbError) {
                  console.error('[RTU Upload] ❌ Failed to save photo mapping:', dbError)
                } else {
                  console.log('[RTU Upload] ✅ Successfully saved photo mapping')
                }
              } else {
                console.log(`[RTU Upload] ⚠️ Skipping photo mapping - names match`)
              }
            } catch (saveError) {
              console.error('[RTU Upload] Failed to upload photo:', saveError)
            }
          }
          
          if (signature) {
            try {
              const signatureExtension = signature.type === 'image/png' ? 'png' : 'jpg'
              const standardFilename = `signature_${rollNo}.${signatureExtension}`
              
              // Upload with standardized name
              const uploadResult = await uploadToStorage(signature, standardFilename)
              if (uploadResult.success) {
                console.log(`[RTU Upload] Uploaded standardized signature: ${standardFilename}`)
              } else {
                console.error(`[RTU Upload] Failed to upload signature: ${uploadResult.error}`)
              }
              
              // Upload with original filename and save mapping
              const originalSignatureName = existingSignatureName || signature.name
              console.log(`[RTU Upload] Signature - Original: ${originalSignatureName}, Standard: ${standardFilename}`)
              
              if (originalSignatureName && originalSignatureName !== standardFilename) {
                await uploadToStorage(signature, originalSignatureName)
                console.log(`[RTU Upload] Uploaded original signature: ${originalSignatureName}`)
                
                // Save mapping in database
                console.log(`[RTU Upload] Saving signature mapping to database: roll_no=${rollNo}`)
                const { data, error: dbError } = await (supabase
                  .from('photo_mappings') as any)
                  .upsert({
                    roll_no: rollNo.toUpperCase(),
                    original_signature: originalSignatureName,
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'roll_no'
                  })
                
                if (dbError) {
                  console.error('[RTU Upload] ❌ Failed to save signature mapping:', dbError)
                } else {
                  console.log('[RTU Upload] ✅ Successfully saved signature mapping')
                }
              } else {
                console.log(`[RTU Upload] ⚠️ Skipping signature mapping - names match`)
              }
            } catch (saveError) {
              console.error('[RTU Upload] Failed to upload signature:', saveError)
            }
          }
        }
      } catch (e) {
        console.log('[RTU Upload] Failed to record update counts:', e)
      }
      return NextResponse.json(payload, status ? { status } : undefined)
    }

    if (!rollNo) {
      return NextResponse.json({ error: 'Roll number required' }, { status: 400 })
    }

    if (!photo && !signature) {
      return NextResponse.json({ error: 'At least one file (photo or signature) required' }, { status: 400 })
    }

    console.log(`[RTU Upload] Starting upload for roll ${rollNo}`)
    console.log(`[RTU Upload] Photo: ${photo ? photo.name : 'WILL FETCH EXISTING'}, Signature: ${signature ? signature.name : 'WILL FETCH EXISTING'}`)

    const baseUrl = 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx'
    const cookieString = `ASP.NET_SessionId=${sessionId}; AuthToken=${authToken}`

    // Step 1: Get initial page
    console.log('[RTU Upload] Step 1: Loading initial page...')
    const initialResponse = await fetch(baseUrl, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    })

    let html = await initialResponse.text()
    let $ = cheerio.load(html)

    let viewState = $('#__VIEWSTATE').val() as string
    let viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() as string
    let eventValidation = $('#__EVENTVALIDATION').val() as string

    const rollYear = rollNo.substring(0, 2)
    const academicSession = rollYear === '24' ? '22' : '22'

    // Step 2-6: Sequential AJAX (same as image fetch)
    console.log('[RTU Upload] Step 2-6: Performing sequential form submissions...')
    
    // Academic Session
    let formBody = new URLSearchParams({
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddlAcadminSession',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '0',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
    })

    let response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Referer': baseUrl
      },
      body: formBody.toString()
    })

    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Category
    formBody = new URLSearchParams({
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddlStuCategory',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
    })

    response = await fetch(baseUrl, { method: 'POST', headers: { 'Cookie': cookieString, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': baseUrl }, body: formBody.toString() })
    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // College
    formBody = new URLSearchParams({
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$D_ddlCollege',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
    })

    response = await fetch(baseUrl, { method: 'POST', headers: { 'Cookie': cookieString, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': baseUrl }, body: formBody.toString() })
    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Degree
    formBody = new URLSearchParams({
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddlDegree',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '1',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
    })

    response = await fetch(baseUrl, { method: 'POST', headers: { 'Cookie': cookieString, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': baseUrl }, body: formBody.toString() })
    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Search student
    console.log('[RTU Upload] Step 7: Searching for student...')
    formBody = new URLSearchParams({
      '__EVENTTARGET': '',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '1',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '7',
      'ctl00$ContentPlaceHolder1$ddlDegreeCycle': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': rollNo.toUpperCase(),
      'ctl00$ContentPlaceHolder1$txtStudentName': '',
      'ctl00$ContentPlaceHolder1$txtFName': '',
      'ctl00$ContentPlaceHolder1$btnViewStudentDetails': 'VIEW STUDENT LIST',
    })

    response = await fetch(baseUrl, { method: 'POST', headers: { 'Cookie': cookieString, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': baseUrl }, body: formBody.toString() })
    html = await response.text()
    $ = cheerio.load(html)

    // Check if student found
    const studentTable = $('#ctl00_ContentPlaceHolder1_gvEnrolGenerated')
    if (studentTable.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Extract all form data from student row
    console.log('[RTU Upload] Step 8: Preparing upload with files...')
    const hindiName = $('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_fullname_h"]').val() as string
    const dob = $('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_DOB"]').val() as string
    const email = $('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_C_Email"]').val() as string
    const mobile = $('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_C_Mobile"]').val() as string

    // Hidden existing filenames (RTU uses these to retain existing files)
    const existingPhotoName = $('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$hdn_flA"]').val() as string
    const existingSignatureName = $('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$hdn_flA1"]').val() as string

    console.log('[RTU Upload] Extracted data - Hindi Name:', hindiName || 'EMPTY', ', DOB:', dob || 'EMPTY', ', Email:', email || 'EMPTY', ', Mobile:', mobile || 'EMPTY')

    // RTU throws 500 unless BOTH file fields are present. If user uploads only one,
    // fetch the current other image via the same postback mechanism used by /api/rtu-image.
    const fetchExistingImageFromThisPage = async (type: 'photo' | 'signature') => {
      const rowIndex = '02'
      const viewTarget = type === 'photo'
        ? `ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl${rowIndex}$lnkView`
        : `ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl${rowIndex}$lnkView1`

      console.log(`[RTU Upload] Fetching existing ${type} via postback: ${viewTarget}`)

      const formFields: Record<string, string> = {
        '__EVENTTARGET': viewTarget,
        '__EVENTARGUMENT': '',
        '__VIEWSTATE': viewState,
        '__VIEWSTATEGENERATOR': viewStateGenerator,
        '__EVENTVALIDATION': eventValidation,
      }

      $('input[type="hidden"], input[type="text"], select').each((_, elem) => {
        const name = $(elem).attr('name')
        const value = $(elem).val() as string | string[] | undefined
        if (!name) return
        if (name.startsWith('__')) return
        if (Array.isArray(value)) {
          if (value.length > 0) formFields[name] = value[0] ?? ''
          return
        }
        if (typeof value === 'string' && value.length > 0) {
          formFields[name] = value
        }
      })

      const postbackBody = new URLSearchParams(formFields)
      const imageResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Cookie': cookieString,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': baseUrl,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        body: postbackBody.toString(),
        redirect: 'manual'
      })

      const contentType = imageResponse.headers.get('content-type') || ''
      if (!(contentType.includes('image') || contentType.includes('octet-stream'))) {
        const preview = await imageResponse.text()
        throw new Error(`Existing ${type} fetch failed: status=${imageResponse.status}, contentType=${contentType}, preview=${preview.substring(0, 200)}`)
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const bytes = new Uint8Array(imageBuffer)
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47

      if (!isJPEG && !isPNG) {
        throw new Error(`Existing ${type} response is not an image. First bytes: ${Array.from(bytes.slice(0, 10)).map(b => b.toString(16)).join(' ')}`)
      }

      const inferredType = isPNG ? 'image/png' : 'image/jpeg'
      const fallbackName = type === 'photo' ? 'existing_photo.jpg' : 'existing_signature.jpg'
      const preferredName = (type === 'photo' ? existingPhotoName : existingSignatureName) || fallbackName
      const safeName = preferredName.includes('.') ? preferredName : fallbackName
      return new File([imageBuffer], safeName, { type: inferredType })
    }

    let photoToUpload: File | null = photo
    let signatureToUpload: File | null = signature

    if (!photoToUpload) {
      try {
        photoToUpload = await fetchExistingImageFromThisPage('photo')
        console.log(`[RTU Upload] Using existing photo (${photoToUpload.size} bytes, ${photoToUpload.name})`)
      } catch (e) {
        console.log('[RTU Upload] Failed to fetch existing photo:', e)
      }
    }

    if (!signatureToUpload) {
      try {
        signatureToUpload = await fetchExistingImageFromThisPage('signature')
        console.log(`[RTU Upload] Using existing signature (${signatureToUpload.size} bytes, ${signatureToUpload.name})`)
      } catch (e) {
        console.log('[RTU Upload] Failed to fetch existing signature:', e)
      }
    }

    if (!photoToUpload || !signatureToUpload) {
      return NextResponse.json({
        success: false,
        error: 'RTU requires both Photo and Signature in one upload. Auto-fetch of the missing image failed; please select BOTH files and try again.'
      }, { status: 400 })
    }

    // If any required field is empty, try alternative selectors
    if (!hindiName || !dob || !email || !mobile) {
      console.log('[RTU Upload] Some fields empty, checking alternative selectors...')
      console.log('[RTU Upload] Available input fields:')
      $('input[id*="gvEnrolGenerated"]').each((i, elem) => {
        const name = $(elem).attr('name')
        const value = $(elem).val()
        console.log(`  - ${name}: ${value}`)
      })
    }

    // Create multipart form data for upload
    const uploadFormData = new FormData()
    uploadFormData.append('__EVENTTARGET', '')
    uploadFormData.append('__EVENTARGUMENT', '')
    uploadFormData.append('__VIEWSTATE', viewState)
    uploadFormData.append('__VIEWSTATEGENERATOR', viewStateGenerator)
    uploadFormData.append('__EVENTVALIDATION', eventValidation)
    uploadFormData.append('ctl00$ContentPlaceHolder1$ddlAcadminSession', academicSession)
    uploadFormData.append('ctl00$ContentPlaceHolder1$ddlStuCategory', '1')
    uploadFormData.append('ctl00$ContentPlaceHolder1$D_ddlCollege', '140')
    uploadFormData.append('ctl00$ContentPlaceHolder1$ddlDegree', '1')
    uploadFormData.append('ctl00$ContentPlaceHolder1$D_ddlSubject', '7')
    uploadFormData.append('ctl00$ContentPlaceHolder1$ddlDegreeCycle', '0')
    uploadFormData.append('ctl00$ContentPlaceHolder1$txtRegNo', rollNo.toUpperCase())
    uploadFormData.append('ctl00$ContentPlaceHolder1$txtStudentName', '')
    uploadFormData.append('ctl00$ContentPlaceHolder1$txtFName', '')
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_fullname_h', hindiName || '')
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_DOB', dob || '')
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_C_Email', email || '')
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$txt_C_Mobile', mobile || '')

    // Preserve existing filenames (important when updating only one)
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$hdn_flA', existingPhotoName || '')
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$hdn_flA1', existingSignatureName || '')

    // RTU requires both file fields in the upload.
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$flA', photoToUpload, photoToUpload.name)
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$flA1', signatureToUpload, signatureToUpload.name)
    console.log(`[RTU Upload] Added photo part: ${photoToUpload.name} (${photoToUpload.size} bytes)${photo ? ' [NEW]' : ' [EXISTING]'}`)
    console.log(`[RTU Upload] Added signature part: ${signatureToUpload.name} (${signatureToUpload.size} bytes)${signature ? ' [NEW]' : ' [EXISTING]'}`)

    // Click upload button
    uploadFormData.append('ctl00$ContentPlaceHolder1$btnGenrateEnrollment', 'CLICK TO UPLOAD DOCUMENT')
    uploadFormData.append('ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$chkDetails', 'on')

    console.log('[RTU Upload] Step 9: Submitting upload...')
    const uploadResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      body: uploadFormData
    })

    const uploadHtml = await uploadResponse.text()
    console.log('[RTU Upload] Upload response status:', uploadResponse.status)
    console.log('[RTU Upload] Response HTML length:', uploadHtml.length)
    
    // Check for success/error messages
    const $result = cheerio.load(uploadHtml)
    
    // Look for alert messages - but IGNORE "Hi" and "already running" (these are false positives)
    const alertScripts = $result('script:contains("alert")').toArray()
    console.log('[RTU Upload] Found', alertScripts.length, 'alert scripts')
    
    let ignoredAlerts: string[] = []
    let realAlerts: string[] = []
    
    for (const script of alertScripts) {
      const scriptText = $result(script).html() || ''
      
      // Match alert with various quote styles
      const alertMatches = scriptText.match(/alert\s*\(\s*['"]([^'"]+)['"]\s*\)/g)
      if (alertMatches) {
        for (const match of alertMatches) {
          const msg = match.match(/alert\s*\(\s*['"]([^'"]+)['"]\s*\)/)?.[1]
          if (msg) {
            // Ignore common false positive alerts
            if (msg === 'Hi' || msg.includes('already running') || msg.includes('another Tab')) {
              ignoredAlerts.push(msg)
              console.log('[RTU Upload] Ignoring alert:', msg)
              continue
            }
            
            realAlerts.push(msg)
            console.log('[RTU Upload] Real alert found:', msg)
            
            // Check if it's a success message (look for "Uploaded Successfully")
            if (msg.toLowerCase().includes('uploaded successfully') || 
                msg.toLowerCase().includes('upload') && msg.toLowerCase().includes('success')) {
              return recordCountsAndReturn({ 
                success: true, 
                message: msg,
                uploadedPhoto: !!photo,
                uploadedSignature: !!signature
              })
            }
            
            // Ignore "Please select Record" - it's a false positive
            if (msg.includes('Please select Record') || msg.includes('select Record')) {
              ignoredAlerts.push(msg)
              console.log('[RTU Upload] Ignoring alert:', msg)
              continue
            }
            
            // Check if it's an actual error
            if (msg.toLowerCase().includes('error') || 
                msg.toLowerCase().includes('failed') || 
                msg.toLowerCase().includes('invalid')) {
              return recordCountsAndReturn({ success: false, error: msg }, 400)
            }
          }
        }
      }
    }
    
    console.log('[RTU Upload] Ignored alerts:', ignoredAlerts.join(', '))
    console.log('[RTU Upload] Real alerts:', realAlerts.length > 0 ? realAlerts.join(', ') : 'None')
    
    // Look for various success indicators in HTML
    const successMsg = $result('span[id*="lbl"], div:contains("successfully"), span:contains("uploaded"), span:contains("Successfully"), span:contains("success")').first().text().trim()
    
    // Look for error messages in spans
    const errorMsg = $result('span[id*="lbl"]:contains("error"), span[id*="lbl"]:contains("Error"), span:contains("failed"), span:contains("Failed"), span:contains("invalid"), span:contains("Invalid")').first().text().trim()

    // Check if the form still has the student data (which means upload succeeded)
    const stillHasStudentRow = $result('#ctl00_ContentPlaceHolder1_gvEnrolGenerated tr').length > 1
    console.log('[RTU Upload] Student row still present:', stillHasStudentRow)
    
    // Check for file upload success by looking at the input fields state
    const photoInput = $result('input[name*="flA"]').length
    const signatureInput = $result('input[name*="flA1"]').length
    console.log('[RTU Upload] Photo input present:', photoInput, ', Signature input present:', signatureInput)
    
    // Look for any success indicators
    const pageText = $result('body').text().toLowerCase()
    const hasSuccessKeyword = pageText.includes('upload') && (pageText.includes('success') || pageText.includes('complete'))
    console.log('[RTU Upload] Page has success keywords:', hasSuccessKeyword)
    
    if (successMsg && successMsg.length > 5) {
      console.log('[RTU Upload] ✅ SUCCESS:', successMsg)
      return recordCountsAndReturn({ 
        success: true, 
        message: successMsg,
        uploadedPhoto: !!photo,
        uploadedSignature: !!signature
      })
    } else if (errorMsg && errorMsg.length > 5) {
      console.log('[RTU Upload] ❌ ERROR:', errorMsg)
      return recordCountsAndReturn({ success: false, error: errorMsg }, 400)
    } else if (uploadResponse.status === 200 && stillHasStudentRow && realAlerts.length === 0) {
      // If status is 200, student row is present, and no real error alerts, assume success
      console.log('[RTU Upload] ✅ Upload likely succeeded (200 OK, student row present, no error alerts)')
      return recordCountsAndReturn({ 
        success: true, 
        message: 'Files uploaded to RTU portal successfully. Please verify in the portal.',
        uploadedPhoto: !!photo,
        uploadedSignature: !!signature
      })
    } else if (uploadResponse.status === 500) {
      // RTU server error - log response preview
      console.log('[RTU Upload] ❌ RTU Server Error (500)')
      console.log('[RTU Upload] Response preview:', uploadHtml.substring(0, 500))
      return recordCountsAndReturn({
        success: false,
        error: 'RTU Portal server error. The files may be too large, wrong format, or missing required data. Please ensure photo/signature are JPG/PNG under 200KB.',
        statusCode: 500,
        hint: 'Check file size and format'
      }, 400)
    } else {
      console.log('[RTU Upload] Response received, assuming success (status:', uploadResponse.status, ')')
      // If we got here and status is 200, likely successful
      return recordCountsAndReturn({
        success: uploadResponse.status === 200,
        message: uploadResponse.status === 200 ? 'Upload completed. Please verify in RTU portal.' : 'Upload status unclear',
        uploadedPhoto: !!photo,
        uploadedSignature: !!signature,
        statusCode: uploadResponse.status
      })
    }

  } catch (error) {
    console.error('[RTU Upload] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to upload to RTU portal',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
