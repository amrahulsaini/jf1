import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
// @ts-ignore - exif-parser has no types
import ExifParser from 'exif-parser'

export async function GET(request: NextRequest) {
  const sessionId = process.env.RTU_SESSION_ID
  const authToken = process.env.RTU_AUTH_TOKEN

  if (!sessionId || !authToken) {
    return NextResponse.json({ error: 'RTU credentials not configured' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const rollNo = searchParams.get('rollNo')
  const type = searchParams.get('type') // 'photo' or 'signature'
  const rowIndex = searchParams.get('row') || '02' // Default to row 02
  const subjectParam = searchParams.get('subject')
  const sessionParam = searchParams.get('session')

  if (!rollNo || !type) {
    return NextResponse.json({ error: 'rollNo and type parameters required' }, { status: 400 })
  }

  console.log(`[RTU Image] Starting ${type} fetch for roll ${rollNo}`)

  try {
    const baseUrl = 'https://rtu.sumsraj.com/CollegePortal/Student_Document_Upload.aspx'
    const cookieString = `ASP.NET_SessionId=${sessionId}; AuthToken=${authToken}`

    const fetchWithCookies = async (url: string) => {
      return fetch(url, {
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': baseUrl,
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        redirect: 'manual'
      })
    }

    const tryReturnImageResponse = async (resp: Response) => {
      const ct = resp.headers.get('content-type') || ''
      if (!(ct.includes('image') || ct.includes('octet-stream'))) return null
      const imageBuffer = await resp.arrayBuffer()
      const dataView = new Uint8Array(imageBuffer)
      const isJPEG = dataView[0] === 0xFF && dataView[1] === 0xD8 && dataView[2] === 0xFF
      const isPNG = dataView[0] === 0x89 && dataView[1] === 0x50 && dataView[2] === 0x4E && dataView[3] === 0x47
      if (!isJPEG && !isPNG) return null
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': isJPEG ? 'image/jpeg' : 'image/png',
          // keep caching but allow cache-bust query param to work
          'Cache-Control': 'public, max-age=86400',
        }
      })
    }

    const extractCandidateUrlsFromHtml = (htmlText: string) => {
      const urls = new Set<string>()
      const $h = cheerio.load(htmlText)

      // Any <img src> that looks like an image
      $h('img').each((_, el) => {
        const src = $h(el).attr('src')
        if (!src) return
        if (/\.(jpe?g|png)(\?.*)?$/i.test(src) || /\.(ashx)(\?.*)?$/i.test(src)) {
          urls.add(src)
        }
      })

      // Some pages render it as a link (only keep likely image/handler links)
      $h('a').each((_, el) => {
        const href = $h(el).attr('href')
        if (!href) return
        if (/\.(jpe?g|png)(\?.*)?$/i.test(href) || /\.(ashx)(\?.*)?$/i.test(href)) {
          urls.add(href)
        }
      })

      // Also check iframes/objects (sometimes image is shown in a frame)
      $h('iframe, object').each((_, el) => {
        const src = $h(el).attr('src') || $h(el).attr('data')
        if (!src) return
        if (/\.(jpe?g|png)(\?.*)?$/i.test(src) || /\.(ashx)(\?.*)?$/i.test(src)) {
          urls.add(src)
        }
      })

      // Script-based references (window.open, location, etc.)
      const scriptText = $h('script').text() || ''
      const re = /['"]([^'"]+\.(?:jpe?g|png|ashx)(?:\?[^'"]*)?)['"]/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(scriptText))) {
        urls.add(m[1])
      }

      return Array.from(urls)
    }

    // Step 1: Get the student list page with all form data
    const rollYear = rollNo.match(/^(\d{2})/)?.[1] || '22'
    const sessionMap: Record<string, string> = {
      '25': '23',
      '24': '22',
      '23': '9',
      '22': '8',
      '21': '7',
      '20': '6',
    }
    const academicSession = sessionParam || sessionMap[rollYear] || '22'

    const subjectCode = subjectParam || '7'
    console.log('[RTU Image] Using session/subject:', { academicSession, subjectCode })

    // First, load the page to get initial ViewState
    console.log('[RTU Image] Step 1: Loading initial page...')
    const initialResponse = await fetch(baseUrl, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    })

    if (!initialResponse.ok) {
      throw new Error(`Initial page load failed: ${initialResponse.status}`)
    }

    let html = await initialResponse.text()
    let $ = cheerio.load(html)

    // Extract form state
    let viewState = $('#__VIEWSTATE').val() as string
    let viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() as string
    let eventValidation = $('#__EVENTVALIDATION').val() as string

    console.log('[RTU Image] Step 2: Setting up form and searching for student...')
    
    // 🔍 CHECK HTML SOURCE FOR PATH CLUES
    console.log('[RTU Image] 🔍 Searching HTML for hidden clues...')
    
    // Check for JavaScript configuration
    const jsConfig = html.match(/var\s+(imageServer|photoPath|uploadPath|basePath|rootPath)\s*=\s*["']([^"']+)["']/gi)
    if (jsConfig) {
      console.log('[RTU Image] 💡 JavaScript config found:', jsConfig)
    }
    
    // Check for ASP.NET application settings
    const aspxSettings = html.match(/ConfigurationManager\.AppSettings\["([^"]+)"\]/gi)
    if (aspxSettings) {
      console.log('[RTU Image] 💡 ASP.NET settings references:', aspxSettings)
    }
    
    // Check for server-side comments (developers sometimes leave these)
    const serverComments = html.match(/<%--[\s\S]*?--%>/g)
    if (serverComments && serverComments.length > 0) {
      console.log('[RTU Image] 💡 Server-side comments found:', serverComments.slice(0, 3))
    }
    
    // Look for any hardcoded paths
    const paths = html.match(/[A-Z]:\\[^"'<>\s]+/g)
    if (paths && paths.length > 0) {
      console.log('[RTU Image] 💡💡💡 HARDCODED WINDOWS PATHS FOUND:', [...new Set(paths)])
    }
    
    // Check for virtual directory references
    const virtualPaths = html.match(/~[/\\][A-Za-z_]+[/\\][A-Za-z_]+/g)
    if (virtualPaths) {
      console.log('[RTU Image] 💡 Virtual paths found:', [...new Set(virtualPaths)])
    }

    // Now we need to do the same sequence as in rtu-info route to get to the student
    // Step 1: Select Academic Session
    let formData = new URLSearchParams({
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
      'ctl00$ContentPlaceHolder1$txtRegNo': rollNo
    })

    let response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl
      },
      body: formData.toString()
    })

    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Step 2: Select Category
    formData = new URLSearchParams({
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$ddlStuCategory',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': rollNo
    })

    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl
      },
      body: formData.toString()
    })

    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Step 3: Select College
    formData = new URLSearchParams({
      '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$D_ddlCollege',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '0',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': '0',
      'ctl00$ContentPlaceHolder1$txtRegNo': rollNo
    })

    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl
      },
      body: formData.toString()
    })

    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Step 4: Select Degree
    formData = new URLSearchParams({
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
      'ctl00$ContentPlaceHolder1$txtRegNo': rollNo
    })

    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl
      },
      body: formData.toString()
    })

    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    // Step 5: Search for student
    formData = new URLSearchParams({
      '__EVENTTARGET': '',
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
      'ctl00$ContentPlaceHolder1$ddlAcadminSession': academicSession,
      'ctl00$ContentPlaceHolder1$ddlStuCategory': '1',
      'ctl00$ContentPlaceHolder1$D_ddlCollege': '140',
      'ctl00$ContentPlaceHolder1$ddlDegree': '1',
      'ctl00$ContentPlaceHolder1$D_ddlSubject': subjectCode,
      'ctl00$ContentPlaceHolder1$txtRegNo': rollNo,
      'ctl00$ContentPlaceHolder1$btnViewStudentDetails': 'VIEW STUDENT LIST'
    })

    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl
      },
      body: formData.toString()
    })

    html = await response.text()
    $ = cheerio.load(html)
    viewState = $('#__VIEWSTATE').val() as string
    eventValidation = $('#__EVENTVALIDATION').val() as string

    console.log('[RTU Image] Step 3: Student found, now clicking VIEW button...')

    // Now click the VIEW button for photo or signature
    const viewTarget = type === 'photo' 
      ? `ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl${rowIndex}$lnkView`
      : `ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl${rowIndex}$lnkView1`

    console.log(`[RTU Image] Clicking: ${viewTarget}`)

    // Get all form fields from the student list page
    const formFields: Record<string, string> = {
      '__EVENTTARGET': viewTarget,
      '__EVENTARGUMENT': '',
      '__VIEWSTATE': viewState,
      '__VIEWSTATEGENERATOR': viewStateGenerator,
      '__EVENTVALIDATION': eventValidation,
    }

    // Add all other form fields
    $('input[type="hidden"], input[type="text"], select').each((_, elem) => {
      const name = $(elem).attr('name')
      const value = $(elem).val() as string
      if (name && !name.startsWith('__') && value) {
        formFields[name] = value
      }
    })

    formData = new URLSearchParams(formFields)

    // Click the VIEW button
    const imageResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      body: formData.toString(),
      redirect: 'manual'
    })

    console.log(`[RTU Image] Response status: ${imageResponse.status}`)
    const contentType = imageResponse.headers.get('content-type') || ''
    console.log(`[RTU Image] Content-Type: ${contentType},${imageResponse.status}`)
    
    // 🔍 CHECK ALL HEADERS FOR PATH CLUES
    console.log('[RTU Image] 🔍 ALL RESPONSE HEADERS:')
    imageResponse.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`)
    })
    
    // Check for Content-Disposition (might have filename/path)
    const contentDisposition = imageResponse.headers.get('content-disposition')
    if (contentDisposition) {
      console.log(`[RTU Image] 💡 Content-Disposition found: ${contentDisposition}`)
    }

    // Fast-path: if response is actually an image
    const direct = await tryReturnImageResponse(imageResponse)
    if (direct) {
      console.log('[RTU Image] SUCCESS! Got image directly from postback')
      return direct
    }

    // Otherwise, it might have returned HTML that references the image.
    {
      // Check for redirect or different response
      const location = imageResponse.headers.get('location')
      if (location) {
        console.log(`[RTU Image] Got redirect to: ${location}`)
        // Follow the redirect
        const finalResponse = await fetchWithCookies(location)
        const redirected = await tryReturnImageResponse(finalResponse)
        if (redirected) {
          console.log('[RTU Image] SUCCESS after redirect!')
          return redirected
        }
      }
      
      // If still no image, parse HTML for a real resource URL/filename and fetch it.
      const responseText = await imageResponse.text()
      console.log('[RTU Image] Response preview:', responseText.substring(0, 500))

      // 1) Some RTU variants embed the image as a base64 data URI in HTML
      const dataUriMatch = responseText.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)/i)
      if (dataUriMatch) {
        const format = dataUriMatch[1].toLowerCase()
        const base64 = dataUriMatch[2].replace(/\s+/g, '')
        const buf = Buffer.from(base64, 'base64')
        console.log(`[RTU Image] SUCCESS! Found embedded base64 ${format} (${buf.byteLength} bytes)`)
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': format === 'png' ? 'image/png' : 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          }
        })
      }

      // Try to extract hidden filename from the current page HTML (common pattern)
      const $r = cheerio.load(responseText)
      const hiddenName = type === 'photo'
        ? ((
            ($r('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$hdn_flA"]').val() as string) ||
            ($r('#ctl00_ContentPlaceHolder1_gvEnrolGenerated_ctl02_hdn_flA').val() as string)
          ) || '')
        : ((
            ($r('input[name="ctl00$ContentPlaceHolder1$gvEnrolGenerated$ctl02$hdn_flA1"]').val() as string) ||
            ($r('#ctl00_ContentPlaceHolder1_gvEnrolGenerated_ctl02_hdn_flA1').val() as string)
          ) || '')
      if (hiddenName) {
        console.log(`[RTU Image] Hidden filename detected: ${hiddenName}`)
      }

      const candidates = extractCandidateUrlsFromHtml(responseText)
      if (hiddenName) {
        candidates.push(hiddenName)
      }

      // Heuristics: try a few likely base paths if we only have a filename.
      const guessUrlsFromFilename = (filename: string) => {
        const guesses = [
          `/CollegePortal/${filename}`,
          `/CollegePortal/Uploads/${filename}`,
          `/CollegePortal/Upload/${filename}`,
          `/CollegePortal/UploadedFiles/${filename}`,
          `/CollegePortal/UploadFiles/${filename}`,
          `/CollegePortal/Upload_Docs/${filename}`,
          `/CollegePortal/StudentPhoto/${filename}`,
          `/CollegePortal/StudentSignature/${filename}`,
          `/CollegePortal/images/${filename}`,
          `/CollegePortal/Images/${filename}`,
          `/${filename}`
        ]
        return guesses.map(g => new URL(g, 'https://rtu.sumsraj.com').toString())
      }

      const expanded = new Set<string>()
      for (const c of candidates) {
        if (!c) continue
        if (/^https?:\/\//i.test(c)) {
          expanded.add(c)
          continue
        }
        // If it's a bare filename, try common folders
        if (!c.includes('/') && /\.(jpe?g|png)$/i.test(c)) {
          for (const g of guessUrlsFromFilename(c)) expanded.add(g)
          continue
        }
        expanded.add(new URL(c, baseUrl).toString())
      }

      // Final filter: only try obvious image/handler URLs
      const finalUrls = Array.from(expanded).filter(u => /\.(jpe?g|png)(\?|$)/i.test(u) || /\.ashx(\?|$)/i.test(u))

      for (const url of finalUrls) {
        try {
          console.log(`[RTU Image] Trying candidate URL: ${url}`)
          const candidateResp = await fetchWithCookies(url)
          const candidateImage = await tryReturnImageResponse(candidateResp)
          if (candidateImage) {
            console.log('[RTU Image] SUCCESS! Fetched image via candidate URL')
            return candidateImage
          }
        } catch (e) {
          console.log('[RTU Image] Candidate fetch failed:', e)
        }
      }

      return NextResponse.json({
        error: 'Image not found in response (postback returned HTML)',
        status: imageResponse.status,
        contentType,
        hiddenName: hiddenName || null,
        candidateCount: finalUrls.length,
        preview: responseText.substring(0, 300)
      }, { status: 404 })
    }

  } catch (error) {
    console.error('[RTU Image] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
