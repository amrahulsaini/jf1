'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type ProposedAction = {
  type: 'upload_media'
  rollNo: string
  media: 'photo' | 'signature' | 'both'
  requiresConfirmation: true
  title: string
}

type ApiResponse = {
  success: boolean
  assistant?: string
  error?: string
  data?: any
  proposedAction?: ProposedAction | null
}

type ChatItem = {
  role: 'user' | 'assistant'
  text: string
  data?: any
}

type ChatContext = {
  lastMatches?: Array<{ rollNo: string; name?: string | null; branch?: string | null; section?: string | null }>
  lastSelectedRollNo?: string
  lastStudent?: any
}

export default function JfIaPage() {
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      role: 'assistant',
      text:
        'Hi! Ask me about students (name/roll/enrollment), DB stats, RTU photo/signature for <roll no>, or ask me to generate beautiful images like "generate a beach scene" or "create a sunset over mountains"!',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposedAction, setProposedAction] = useState<ProposedAction | null>(null)
  const [chatContext, setChatContext] = useState<ChatContext>({})

  const [uploadTarget, setUploadTarget] = useState<{ rollNo: string; media: 'photo' | 'signature' | 'both' } | null>(null)
  const [uploadPhoto, setUploadPhoto] = useState<File | null>(null)
  const [uploadSignature, setUploadSignature] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState(() => Date.now())

  const lastRtu = useMemo(() => {
    // Find the most recent assistant message that contains RTU data
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      const rtuStudent = m.data?.rtu?.student
      if (rtuStudent?.photoUrl || rtuStudent?.signatureUrl) return rtuStudent
    }
    return null
  }, [messages])

  const send = async (text: string) => {
    const value = text.trim()
    if (!value) return

    setUploadStatus(null)
    setUploadTarget(null)
    setProposedAction(null)

    const nextMessages: ChatItem[] = [...messages, { role: 'user', text: value }]
    setMessages(nextMessages)
    setInput('')

    setLoading(true)
    try {
      const res = await fetch('/api/jf-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: value,
          messages: nextMessages.map(m => ({ role: m.role, content: m.text })),
          context: chatContext,
        }),
      })

      const json = (await res.json()) as ApiResponse

      if (!res.ok || !json.success) {
        const err = json.error || `Request failed (${res.status})`
        setMessages(prev => [...prev, { role: 'assistant', text: err }])
        return
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: json.assistant || 'OK', data: json.data },
      ])

      setProposedAction(json.proposedAction || null)

      // Update lightweight conversational context
      if (Array.isArray(json.data?.students)) {
        setChatContext(prev => ({
          ...prev,
          lastMatches: json.data.students,
        }))
      }

      if (json.data?.student?.rollNo) {
        setChatContext(prev => ({
          ...prev,
          lastSelectedRollNo: String(json.data.student.rollNo).toUpperCase(),
          lastStudent: json.data.student,
        }))
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: e?.message || 'Network error' }])
    } finally {
      setLoading(false)
    }
  }

  const confirmAction = async (action: ProposedAction) => {
    setLoading(true)
    setUploadStatus(null)

    try {
      const res = await fetch('/api/jf-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedAction: { type: action.type, rollNo: action.rollNo, media: action.media },
        }),
      })

      const json = (await res.json()) as ApiResponse
      if (!res.ok || !json.success) {
        setMessages(prev => [...prev, { role: 'assistant', text: json.error || 'Failed to confirm action.' }])
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', text: json.assistant || 'Confirmed.' }])
      setProposedAction(null)
      setUploadTarget({ rollNo: action.rollNo, media: action.media })
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: e?.message || 'Network error' }])
    } finally {
      setLoading(false)
    }
  }

  const doUpload = async () => {
    if (!uploadTarget?.rollNo) {
      setUploadStatus('Ask first: “upload photo/signature for <roll>” and confirm.')
      return
    }

    setLoading(true)
    setUploadStatus(null)

    try {
      const fd = new FormData()
      fd.set('rollNo', uploadTarget.rollNo)
      if (uploadPhoto) fd.set('photo', uploadPhoto)
      if (uploadSignature) fd.set('signature', uploadSignature)

      const res = await fetch('/api/rtu-upload', {
        method: 'POST',
        body: fd,
      })

      const json = await res.json()

      if (!res.ok) {
        setUploadStatus(json?.error || `Upload failed (${res.status})`)
        return
      }

      setUploadStatus(json?.message || 'Upload completed.')

      // Encourage user to refresh RTU images.
      setMessages(prev => [...prev, { role: 'assistant', text: 'Upload done. If needed, ask: “show RTU photo/signature for <roll>” to refresh.' }])
    } catch (e: any) {
      setUploadStatus(e?.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">JF-IA</h1>
              <p className="text-gray-600 text-sm">Conversational assistant for DB + RTU media</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow border border-blue-200"
            >
              Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="text-sm text-gray-600">Chat</div>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-auto">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={
                    m.role === 'user'
                      ? 'flex justify-end'
                      : 'flex justify-start'
                  }
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] bg-blue-600 text-white rounded-2xl px-4 py-2'
                        : 'max-w-[85%] bg-gray-100 text-gray-900 rounded-2xl px-4 py-2'
                    }
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>

                    {m.role === 'assistant' && m.data?.students?.length ? (
                      <div className="mt-3">
                        <div className="text-xs text-gray-600 mb-2">Matches</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {m.data.students.map((s: any) => (
                            <div key={s.rollNo} className="border border-gray-200 rounded-lg p-3 bg-white">
                              <div className="font-semibold text-sm text-gray-900">{s.name || 'N/A'}</div>
                              <div className="text-xs text-gray-600">{s.rollNo}</div>
                              <div className="text-xs text-gray-600">{s.branch || 'N/A'} • {s.section || 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                          Tip: Ask “RTU photo/signature for &lt;roll&gt;” to preview.
                        </div>
                      </div>
                    ) : null}

                    {m.role === 'assistant' && m.data?.student && m.data?.view?.showStudentCard ? (
                      <div className="mt-3">
                        <div className="text-xs text-gray-600 mb-2">Student Details</div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 space-y-1">
                          <div><span className="font-semibold">Name:</span> {m.data.student.name || 'N/A'}</div>
                          <div><span className="font-semibold">Roll:</span> {m.data.student.rollNo || 'N/A'}</div>
                          <div><span className="font-semibold">Enrollment:</span> {m.data.student.enrollmentNo || 'N/A'}</div>
                          <div><span className="font-semibold">Branch:</span> {m.data.student.branch || 'N/A'}</div>
                          <div><span className="font-semibold">Section:</span> {m.data.student.section || 'N/A'}</div>
                          {m.data.student.mobile ? (
                            <div><span className="font-semibold">Mobile:</span> {m.data.student.mobile}</div>
                          ) : null}
                          {m.data.student.email ? (
                            <div><span className="font-semibold">Email:</span> {m.data.student.email}</div>
                          ) : null}
                          {m.data.student.fatherName ? (
                            <div><span className="font-semibold">Father:</span> {m.data.student.fatherName}</div>
                          ) : null}
                          {m.data.student.motherName ? (
                            <div><span className="font-semibold">Mother:</span> {m.data.student.motherName}</div>
                          ) : null}
                          {m.data.student.sex ? (
                            <div><span className="font-semibold">Sex:</span> {m.data.student.sex}</div>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                          Tip: Ask “show RTU photo/signature” to preview.
                        </div>
                      </div>
                    ) : null}

                    {m.role === 'assistant' && m.data?.stats ? (
                      <div className="mt-3 text-xs text-gray-700">
                        <div className="font-semibold">DB Stats</div>
                        <div>Total: {m.data.stats.total}</div>
                      </div>
                    ) : null}

                    {m.role === 'assistant' && m.data?.rtu?.student ? (
                      <div className="mt-3 text-xs text-gray-700">
                        <div className="font-semibold">RTU</div>
                        <div>Photo: {m.data.rtu.student.photoPath || 'N/A'}</div>
                        <div>Signature: {m.data.rtu.student.signaturePath || 'N/A'}</div>
                      </div>
                    ) : null}

                    {m.role === 'assistant' && m.data?.type === 'generated_image' && m.data?.generatedImage ? (
                      <div className="mt-3">
                        <div className="text-xs text-gray-600 mb-2 font-semibold">Generated Image</div>
                        <div className="rounded-lg overflow-hidden border border-gray-200 shadow-md">
                          <img 
                            src={m.data.generatedImage} 
                            alt="AI generated scene" 
                            className="w-full h-auto"
                          />
                        </div>
                        <div className="mt-2 text-xs text-gray-500 italic">
                          Enhanced prompt: {m.data.prompt}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200">
              {proposedAction ? (
                <div className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <div className="text-sm font-semibold text-amber-900">Confirmation required</div>
                  <div className="text-sm text-amber-800 mt-1">{proposedAction.title}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmAction(proposedAction)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 px-4 rounded-lg"
                      disabled={loading}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setProposedAction(null)}
                      className="bg-white hover:bg-gray-50 text-amber-700 text-sm font-medium py-2 px-4 rounded-lg border border-amber-200"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input)
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder='e.g. "Find students named Rahul", "RTU photo for 24EJCCS722", or "generate a beach at sunset"'
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 rounded-lg"
                  disabled={loading}
                >
                  {loading ? '...' : 'Send'}
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-5">
            <h2 className="text-lg font-semibold text-gray-800">RTU Preview</h2>
            <p className="text-sm text-gray-600 mt-1">Shows the most recent RTU photo/signature loaded in chat.</p>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setPreviewToken(Date.now())}
                className="bg-white hover:bg-gray-50 text-blue-700 text-sm font-semibold py-2 px-3 rounded-lg border border-blue-200"
              >
                Refresh preview
              </button>
            </div>

            {lastRtu ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-800">Photo</div>
                  {lastRtu.photoUrl ? (
                    <img
                      src={`${lastRtu.photoUrl}${lastRtu.photoUrl.includes('?') ? '&' : '?'}t=${previewToken}`}
                      alt="RTU photo"
                      className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50"
                    />
                  ) : (
                    <div className="mt-2 text-sm text-gray-500">No photo URL</div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-800">Signature</div>
                  {lastRtu.signatureUrl ? (
                    <img
                      src={`${lastRtu.signatureUrl}${lastRtu.signatureUrl.includes('?') ? '&' : '?'}t=${previewToken}`}
                      alt="RTU signature"
                      className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50"
                    />
                  ) : (
                    <div className="mt-2 text-sm text-gray-500">No signature URL</div>
                  )}
                </div>

                <div className="text-xs text-gray-500">Refresh by reloading the page, or ask again in chat.</div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-gray-500">No RTU data yet.</div>
            )}

            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-800">Upload (RTU)</h3>
              <p className="text-xs text-gray-600 mt-1">
                Ask: “upload photo for &lt;roll&gt;” → confirm → select file(s) below.
              </p>

              <div className="mt-3 space-y-3">
                {uploadTarget ? (
                  <div className="text-sm text-gray-800">
                    Upload target: <span className="font-semibold">{uploadTarget.rollNo}</span> ({uploadTarget.media})
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">
                    No confirmed upload target.
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Photo (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm"
                    onChange={(e) => setUploadPhoto(e.target.files?.[0] || null)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Signature (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm"
                    onChange={(e) => setUploadSignature(e.target.files?.[0] || null)}
                    disabled={loading}
                  />
                </div>

                <button
                  type="button"
                  onClick={doUpload}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg"
                  disabled={loading || !uploadTarget}
                >
                  Upload to RTU
                </button>

                {uploadStatus ? (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{uploadStatus}</div>
                ) : null}

                <div className="text-xs text-gray-500">
                  Note: this uploads user-selected files only.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
