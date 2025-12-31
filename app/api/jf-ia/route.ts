import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '@/lib/supabase'
import type { Student } from '@/lib/database.types'

export const runtime = 'nodejs'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ClientContext = {
  lastMatches?: Array<{ rollNo: string; name?: string | null; branch?: string | null; section?: string | null }>
  lastSelectedRollNo?: string
  lastStudent?: any
}

type ViewHints = {
  showStudentCard?: boolean
}

type PlannerResult =
  | { type: 'answer'; response: string }
  | {
      type: 'search_students'
      args: { query: string; branch?: string; section?: string; limit?: number }
      response?: string
    }
  | { type: 'get_student'; args: { rollNo: string }; response?: string }
  | { type: 'db_stats'; args?: {}; response?: string }
  | {
      type: 'get_rtu_info'
      args: { rollNo: string }
      response?: string
    }
  | {
      type: 'propose_upload'
      args: { rollNo: string; media: 'photo' | 'signature' | 'both' }
      response?: string
    }

function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid JSON' }
  }
}

function summarizeStudent(s: Student) {
  return {
    rollNo: s.roll_no,
    name: s.student_name,
    enrollmentNo: s.enrollment_no,
    branch: s.branch,
    section: s.student_section,
  }
}

function safeStudentDetails(s: Student) {
  return {
    rollNo: s.roll_no,
    name: s.student_name,
    enrollmentNo: s.enrollment_no,
    branch: s.branch,
    section: s.student_section,
    sex: s.sex,
    fatherName: s.father_name,
    motherName: s.mother_name,
    mobile: s.mobile_no,
    email: s.student_emailid,
  }
}

function formatStudentDetails(d: any) {
  const lines: string[] = []
  const name = d?.name || 'N/A'
  const roll = d?.rollNo || 'N/A'
  lines.push(`${name} (${roll})`)
  if (d?.enrollmentNo) lines.push(`Enrollment: ${d.enrollmentNo}`)
  if (d?.branch || d?.section) lines.push(`Branch/Section: ${(d?.branch || 'N/A')} • ${(d?.section || 'N/A')}`)
  if (d?.mobile) lines.push(`Mobile: ${d.mobile}`)
  if (d?.email) lines.push(`Email: ${d.email}`)
  if (d?.fatherName) lines.push(`Father: ${d.fatherName}`)
  if (d?.motherName) lines.push(`Mother: ${d.motherName}`)
  return lines.join('\n')
}

function looksLikeSectionQuestion(message: string) {
  const m = (message || '').toLowerCase()
  if (!m) return false
  // examples: "section of rajat kumar", "tell section", "just tell section"
  return m.includes('section') && !m.includes('rtu')
}

function extractNameAfterSection(message: string): string | null {
  const t = (message || '').trim()
  const m = t.match(/section\s+(of\s+)?(.+)/i)
  if (!m) return null
  const name = (m[2] || '').trim()
  if (!name) return null
  // If they actually typed a roll number, don't treat as name.
  if (extractRollNo(name)) return null
  return name
}

function extractNameAfterOfOrFor(message: string): string | null {
  const t = (message || '').trim()
  // Examples: "photo of rajat kumar", "show image for rajat kumar"
  const m = t.match(/\b(of|for)\b\s+(.+)/i)
  if (!m) return null
  const name = (m[2] || '').trim()
  if (!name) return null
  // If they actually typed a roll number, don't treat as name.
  if (extractRollNo(name)) return null
  return name
}

function extractRollNo(text: string): string | null {
  const t = (text || '').toUpperCase()
  // Typical patterns: 24EJCCS721, 24EJCIT138, 24EJCCA163
  const m = t.match(/\b\d{2}[A-Z]{2}[A-Z]{2,4}[A-Z0-9]{2,5}\b/)
  return m ? m[0] : null
}

function pickRollFromContext(message: string, ctx: ClientContext | null | undefined): string | null {
  const lower = (message || '').trim().toLowerCase()
  const matches = Array.isArray(ctx?.lastMatches) ? ctx!.lastMatches! : []

  if (extractRollNo(message)) return extractRollNo(message)
  if (ctx?.lastSelectedRollNo) return String(ctx.lastSelectedRollNo).toUpperCase()

  if (matches.length === 1) return String(matches[0].rollNo).toUpperCase()

  if (matches.length > 1) {
    // Allow “first”, “second”, “3rd”, etc.
    const ord: Record<string, number> = {
      first: 1,
      1: 1,
      one: 1,
      second: 2,
      2: 2,
      two: 2,
      third: 3,
      3: 3,
      three: 3,
      fourth: 4,
      4: 4,
      four: 4,
      fifth: 5,
      5: 5,
      five: 5,
    }

    for (const [k, idx] of Object.entries(ord)) {
      if (lower.includes(k)) {
        const item = matches[idx - 1]
        if (item?.rollNo) return String(item.rollNo).toUpperCase()
      }
    }
  }

  return null
}

async function fetchAllStudentsBySearch(args: {
  query: string
  branch?: string
  section?: string
  limit?: number
}): Promise<Student[]> {
  const q = args.query.trim()
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)

  // If it looks like a roll number, prioritize exact match.
  const normalized = q.toUpperCase()

  // Build a broad query: roll/enrollment/name ilike
  let queryBuilder = supabase
    .from('firstyear')
    .select('*')
    .or(
      [
        `roll_no.ilike.%${q}%`,
        `enrollment_no.ilike.%${q}%`,
        `student_name.ilike.%${q}%`,
      ].join(',')
    )
    .order('roll_no', { ascending: true })
    .limit(limit)

  if (args.branch) queryBuilder = queryBuilder.eq('branch', args.branch)
  if (args.section) queryBuilder = queryBuilder.eq('student_section', args.section)

  const { data, error } = await queryBuilder
  if (error) throw error

  const results = (data || []) as Student[]

  // If user typed full roll, surface that first.
  const exact = results.find(s => (s.roll_no || '').toUpperCase() === normalized)
  if (exact) {
    return [exact, ...results.filter(s => s !== exact)]
  }

  return results
}

async function fetchStudentByRoll(rollNo: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from('firstyear')
    .select('*')
    .eq('roll_no', rollNo)
    .maybeSingle()

  if (error) throw error
  return (data as Student | null) ?? null
}

async function fetchDbStats(): Promise<{ total: number; byBranch: Record<string, number> }> {
  // Dataset is small (~1.3k), so this is fine.
  const pageSize = 1000
  let from = 0
  const all: Student[] = []

  while (true) {
    const { data, error } = await supabase
      .from('firstyear')
      .select('branch')
      .order('roll_no', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const page = (data || []) as Pick<Student, 'branch'>[]
    all.push(...(page as any))
    if (page.length < pageSize) break
    from += pageSize
  }

  const byBranch: Record<string, number> = {}
  for (const row of all) {
    const key = (row.branch || 'Unknown').trim() || 'Unknown'
    byBranch[key] = (byBranch[key] || 0) + 1
  }

  return { total: all.length, byBranch }
}

async function fetchRtuInfoFromLocalApi(baseUrl: string, student: Student) {
  const payload = {
    rollNo: student.roll_no,
    studentName: student.student_name || '',
    fatherName: student.father_name || '',
    branch: student.branch || '',
  }

  const res = await fetch(new URL('/api/rtu-info', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const json = await res.json()
  if (!res.ok) {
    return { ok: false as const, status: res.status, json }
  }

  return { ok: true as const, json }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: string
      messages?: ChatMessage[]
      context?: ClientContext
      confirmedAction?: {
        type: 'upload_media'
        rollNo: string
        media: 'photo' | 'signature' | 'both'
      }
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing GEMINI_API_KEY. Add it to .env.local and restart the dev server.',
        },
        { status: 500 }
      )
    }

    // Confirmation path: only “plan” uploads; actual upload requires user-provided files
    if (body.confirmedAction) {
      const { rollNo, media } = body.confirmedAction
      return NextResponse.json({
        success: true,
        assistant:
          `Confirmed. To upload ${media} for ${rollNo}, please attach the image file(s) in the UI (I can’t auto-generate identity photos).`,
        proposedAction: null,
      })
    }

    const userMessage = (body.message || '').trim()
    const history = Array.isArray(body.messages) ? body.messages : []
    const clientContext = body.context


    if (!userMessage && history.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No message provided.' },
        { status: 400 }
      )
    }

    // Quick deterministic handling for common conversational intents.
    const lower = userMessage.toLowerCase()
    if (lower && ['hi', 'hello', 'hey'].includes(lower)) {
      return NextResponse.json({
        success: true,
        assistant:
          'Hi! Tell me a name/roll/enrollment, ask for RTU photo/signature, ask for DB stats, or request beautiful images like "generate a beach scene" or "create mountains at sunrise"!',
        proposedAction: null,
      })
    }

    const inferredRoll = pickRollFromContext(userMessage, clientContext)

    // If user asks for a student's photo/image by name (without a roll), search and return matches.
    if (!inferredRoll && /(photo|image|picture)/i.test(userMessage) && extractNameAfterOfOrFor(userMessage)) {
      const name = extractNameAfterOfOrFor(userMessage)!
      const matches = await fetchAllStudentsBySearch({ query: name, limit: 10 })

      if (matches.length === 0) {
        return NextResponse.json({ success: true, assistant: `No student found for "${name}".`, proposedAction: null })
      }

      if (matches.length === 1) {
        const details = safeStudentDetails(matches[0])
        return NextResponse.json({
          success: true,
          assistant: `${details.name || details.rollNo} is ${details.rollNo}. Say “show RTU photo/signature” to preview.`,
          data: { student: details, view: { showStudentCard: false } },
          proposedAction: null,
        })
      }

      return NextResponse.json({
        success: true,
        assistant: `I found multiple students for "${name}". Which roll number should I use?`,
        data: { students: matches.map(summarizeStudent), view: { showStudentCard: false } },
        proposedAction: null,
      })
    }

    // Section-only questions: respond with just the section (keep student in data for context).
    if (looksLikeSectionQuestion(userMessage)) {
      const explicitName = extractNameAfterSection(userMessage)

      if (explicitName) {
        const matches = await fetchAllStudentsBySearch({ query: explicitName, limit: 10 })
        if (matches.length === 0) {
          return NextResponse.json({ success: true, assistant: `No student found for "${explicitName}".`, proposedAction: null })
        }
        if (matches.length === 1) {
          const details = safeStudentDetails(matches[0])
          const view: ViewHints = { showStudentCard: false }
          return NextResponse.json({
            success: true,
            assistant: `${details.name || details.rollNo} is in section ${details.section || 'N/A'}.`,
            data: { student: details, view },
            proposedAction: null,
          })
        }

        return NextResponse.json({
          success: true,
          assistant: `I found multiple students named like "${explicitName}". Which roll number?`,
          data: { students: matches.map(summarizeStudent), view: { showStudentCard: false } },
          proposedAction: null,
        })
      }

      // No explicit name: use context roll/student.
      const last = clientContext?.lastStudent
      if (last?.rollNo) {
        return NextResponse.json({
          success: true,
          assistant: `${last.name || last.rollNo} is in section ${last.section || 'N/A'}.`,
          data: { student: last, view: { showStudentCard: false } },
          proposedAction: null,
        })
      }

      if (inferredRoll) {
        const student = await fetchStudentByRoll(inferredRoll)
        if (!student) {
          return NextResponse.json({ success: true, assistant: `No student found for roll no ${inferredRoll}.`, proposedAction: null })
        }
        const details = safeStudentDetails(student)
        return NextResponse.json({
          success: true,
          assistant: `${details.name || details.rollNo} is in section ${details.section || 'N/A'}.`,
          data: { student: details, view: { showStudentCard: false } },
          proposedAction: null,
        })
      }

      return NextResponse.json({
        success: true,
        assistant: 'Which student? Tell me the name or roll number.',
        proposedAction: null,
      })
    }

    // Handle very short follow-ups like "where?" using the last student context.
    const short = userMessage.replace(/[?!.]+/g, '').trim().toLowerCase()
    if (short && ['where', 'where is she', 'where is he', 'where is this', 'where is the student'].includes(short)) {
      const last = clientContext?.lastStudent
      if (last?.rollNo) {
        const msg = `Branch/Section: ${(last.branch || 'N/A')} • ${(last.section || 'N/A')}`
        return NextResponse.json({ success: true, assistant: msg, data: { student: last }, proposedAction: null })
      }
      if (inferredRoll) {
        const student = await fetchStudentByRoll(inferredRoll)
        if (!student) return NextResponse.json({ success: true, assistant: `No student found for roll no ${inferredRoll}.`, proposedAction: null })
        const details = safeStudentDetails(student)
        return NextResponse.json({ success: true, assistant: `Branch/Section: ${(details.branch || 'N/A')} • ${(details.section || 'N/A')}`, data: { student: details }, proposedAction: null })
      }
      return NextResponse.json({ success: true, assistant: 'Which student are you asking about? Tell me the name or roll number.', proposedAction: null })
    }

    // Natural “change/upload photo” without requiring special syntax.
    if (/(change|update|upload)\s+.*(photo|image)/i.test(userMessage) && inferredRoll) {
      return NextResponse.json({
        success: true,
        assistant: `I can help change the photo for ${inferredRoll}. Please confirm, then choose the new photo file to upload.`,
        proposedAction: {
          type: 'upload_media',
          rollNo: inferredRoll,
          media: 'photo',
          requiresConfirmation: true,
          title: `Upload photo for ${inferredRoll}`,
        },
      })
    }

    if (/(change|update|upload)\s+.*signature/i.test(userMessage) && inferredRoll) {
      return NextResponse.json({
        success: true,
        assistant: `I can help change the signature for ${inferredRoll}. Please confirm, then choose the new signature file to upload.`,
        proposedAction: {
          type: 'upload_media',
          rollNo: inferredRoll,
          media: 'signature',
          requiresConfirmation: true,
          title: `Upload signature for ${inferredRoll}`,
        },
      })
    }

    // If user provides a roll number, treat “tell me about” as details.
    if (inferredRoll && /(tell me|about|details|detail|info|information)/i.test(userMessage) && !/rtu/i.test(userMessage)) {
      const student = await fetchStudentByRoll(inferredRoll)
      if (!student) {
        return NextResponse.json({ success: true, assistant: `No student found for roll no ${inferredRoll}.`, proposedAction: null })
      }
      const details = safeStudentDetails(student)
      return NextResponse.json({
        success: true,
        assistant: formatStudentDetails(details),
        data: { student: details, view: { showStudentCard: true } satisfies ViewHints },
        proposedAction: null,
      })
    }

    const ai = new GoogleGenAI({ apiKey })

    const toolPrompt = `You are JF-IA, a smart, conversational assistant for a student portal.

You can either answer directly, or request one action via JSON.

Return ONLY valid JSON, no markdown.

Schema:
{
  "type": "answer" | "search_students" | "get_student" | "db_stats" | "get_rtu_info" | "propose_upload",
  "args": { ... },
  "response": "short helper text for the user"
}

Rules:
- Use "search_students" when user asks to find students by name/roll/enrollment.
  args: {"query": string, "branch"?: string, "section"?: string, "limit"?: number}
- Use "get_student" when user gives a specific roll number.
  args: {"rollNo": string}
- Use "db_stats" for totals / counts by branch.
- Use "get_rtu_info" when user asks for RTU photo/signature or "secret info".
  args: {"rollNo": string}
- Use "propose_upload" when user asks to upload/change photo/signature.
  args: {"rollNo": string, "media": "photo"|"signature"|"both"}
- Never claim you uploaded unless the user explicitly provided files.
- Do NOT generate or alter identity photos.

Conversation rules:
- Use the chat history and context to resolve follow-ups like “this one”, “same student”, “first one”.
- If multiple students match a name, ask which roll number (and provide the matches in your response).
- Be natural; the user will type normal sentences (no special slash commands).
`

    const recentHistory = history.slice(-12).map(m => ({ role: m.role, content: m.content }))

    const plannerInput =
      toolPrompt +
      '\nContext (may be empty): ' +
      JSON.stringify(clientContext || {}) +
      '\nRecent conversation: ' +
      JSON.stringify(recentHistory) +
      '\nLatest user message: ' +
      JSON.stringify(userMessage || history[history.length - 1]?.content || '')

    const plannerResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: plannerInput,
    })

    const plannerText = (plannerResponse.text || '').trim()
    const parsed = safeJsonParse<PlannerResult>(plannerText)

    if (!parsed.ok) {
      // If the model didn't comply with strict JSON, fall back to plain text.
      return NextResponse.json({
        success: true,
        assistant: plannerText || 'Sorry — I could not generate a response.',
        proposedAction: null,
        debug: { parseError: parsed.error },
      })
    }

    const plan = parsed.value

    if (plan.type === 'answer') {
      return NextResponse.json({
        success: true,
        assistant: plan.response,
        proposedAction: null,
      })
    }

    if (plan.type === 'db_stats') {
      const stats = await fetchDbStats()
      const topBranches = Object.entries(stats.byBranch)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)

      const summary =
        `Total students: ${stats.total}.\n` +
        `Top branches: ` +
        topBranches.map(([b, c]) => `${b} (${c})`).join(', ')

      return NextResponse.json({
        success: true,
        assistant: plan.response ? `${plan.response}\n\n${summary}` : summary,
        data: { stats },
        proposedAction: null,
      })
    }

    if (plan.type === 'search_students') {
      const results = await fetchAllStudentsBySearch(plan.args)

      const wantsDetails = /(tell me|about|details|detail|info|information)/i.test(userMessage)

      if (wantsDetails && results.length === 1) {
        const details = safeStudentDetails(results[0])
        return NextResponse.json({
          success: true,
          assistant: formatStudentDetails(details),
          data: { student: details },
          proposedAction: null,
        })
      }

      if (wantsDetails && results.length > 1) {
        return NextResponse.json({
          success: true,
          assistant:
            plan.response ||
            `I found multiple students for "${plan.args.query}". Which roll number should I use?`,
          data: { students: results.map(summarizeStudent) },
          proposedAction: null,
        })
      }

      return NextResponse.json({
        success: true,
        assistant: plan.response || `Found ${results.length} student(s) matching "${plan.args.query}".`,
        data: { students: results.map(summarizeStudent) },
        proposedAction: null,
      })
    }

    if (plan.type === 'get_student') {
      const rollNo = (plan.args.rollNo || '').trim()
      const student = await fetchStudentByRoll(rollNo)
      if (!student) {
        return NextResponse.json({
          success: true,
          assistant: plan.response || `No student found for roll no ${rollNo}.`,
          proposedAction: null,
        })
      }

      const details = safeStudentDetails(student)
      return NextResponse.json({
        success: true,
        assistant: formatStudentDetails(details),
        data: { student: details },
        proposedAction: null,
      })
    }

    if (plan.type === 'get_rtu_info') {
      const rollNo = (plan.args.rollNo || '').trim()
      const student = await fetchStudentByRoll(rollNo)
      if (!student) {
        return NextResponse.json({
          success: true,
          assistant: `No student found in DB for roll no ${rollNo}.`,
          proposedAction: null,
        })
      }

      const baseUrl = request.url
      const rtu = await fetchRtuInfoFromLocalApi(baseUrl, student)

      if (!rtu.ok) {
        return NextResponse.json({
          success: true,
          assistant:
            `RTU request failed (${rtu.status}). Your RTU cookies may be expired.`,
          data: { rtu: rtu.json },
          proposedAction: null,
        })
      }

      const data = rtu.json?.data
      const s0 = Array.isArray(data?.students) ? data.students[0] : null

      return NextResponse.json({
        success: true,
        assistant:
          plan.response ||
          `RTU info loaded for ${student.roll_no}. Photo/signature URLs are available.`,
        data: {
          student: summarizeStudent(student),
          rtu: {
            found: data?.found,
            student: s0,
          },
        },
        proposedAction: null,
      })
    }

    if (plan.type === 'propose_upload') {
      const rollNo = (plan.args.rollNo || '').trim()
      const media = plan.args.media

      return NextResponse.json({
        success: true,
        assistant:
          plan.response ||
          `I can help you upload ${media} for ${rollNo}. Please confirm, then attach the image file(s).`,
        proposedAction: {
          type: 'upload_media',
          rollNo,
          media,
          requiresConfirmation: true,
          title: `Upload ${media} for ${rollNo}`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      assistant: 'Unsupported action type.',
      proposedAction: null,
    })
  } catch (error: any) {
    console.error('jf-ia error', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
