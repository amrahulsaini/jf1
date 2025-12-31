'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Student } from '@/lib/database.types'

type MediaMeta = {
  photoUrl?: string
  signatureUrl?: string
  photoPath?: string
  signaturePath?: string
  error?: string
}

type UpdatesDb = Record<string, { photo: number; signature: number; lastUpdatedAt: string }>

export default function MediaMasterPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [updates, setUpdates] = useState<UpdatesDb>({})
  const [mediaByRoll, setMediaByRoll] = useState<Record<string, MediaMeta>>({})
  const [busyRolls, setBusyRolls] = useState<Record<string, boolean>>({})
  const [cacheBustByRoll, setCacheBustByRoll] = useState<Record<string, number>>({})

  const [showFilters, setShowFilters] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true)

        // Load students (paged)
        const pageSize = 1000
        let from = 0
        const allStudents: Student[] = []
        while (true) {
          const { data, error } = await supabase
            .from('firstyear')
            .select('*')
            .order('roll_no', { ascending: true })
            .range(from, from + pageSize - 1)
          if (error) throw error
          const page = (data || []) as Student[]
          allStudents.push(...page)
          if (page.length < pageSize) break
          from += pageSize
        }
        setStudents(allStudents)

        // Extract unique branches/sections for filters
        const uniqueBranches = [...new Set(allStudents.map(s => s.branch).filter(Boolean) as string[])]
        setBranches(uniqueBranches)
        const uniqueSections = [...new Set(allStudents.map(s => s.student_section).filter(Boolean) as string[])]
        setSections(uniqueSections)

        // Load local update counts
        const res = await fetch('/api/media-updates')
        const json = await res.json()
        if (json?.success && json?.data) setUpdates(json.data as UpdatesDb)
      } catch (e) {
        console.error(e)
        alert('Failed to load master data. Check console.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const total = students.length

  const fetchRtuForStudent = async (student: Student) => {
    const roll = (student.roll_no || '').toUpperCase()
    if (!roll) return

    setBusyRolls(prev => ({ ...prev, [roll]: true }))
    try {
      const resp = await fetch('/api/rtu-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollNo: roll,
          studentName: student.student_name || '',
          fatherName: (student as any).father_name || (student as any).fatherName || '',
          branch: student.branch || 'Computer Science & Engg.',
        })
      })

      const json = await resp.json()
      const record = json?.data?.students?.[0]

      if (!resp.ok || !record) {
        setMediaByRoll(prev => ({
          ...prev,
          [roll]: { error: json?.error || json?.message || 'RTU fetch failed' }
        }))
        return
      }

      setMediaByRoll(prev => ({
        ...prev,
        [roll]: {
          photoUrl: record.photoUrl,
          signatureUrl: record.signatureUrl,
          photoPath: record.photoPath,
          signaturePath: record.signaturePath,
        }
      }))

      // Force <img> reload even if the URL path is unchanged.
      setCacheBustByRoll(prev => ({ ...prev, [roll]: Date.now() }))
    } catch (e) {
      setMediaByRoll(prev => ({
        ...prev,
        [roll]: { error: e instanceof Error ? e.message : 'Unknown error' }
      }))
    } finally {
      setBusyRolls(prev => ({ ...prev, [roll]: false }))
    }
  }

  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const filtered = students.filter(s => {
      const matchesSearch =
        !term ||
        (s.roll_no || '').toLowerCase().includes(term) ||
        (s.student_name || '').toLowerCase().includes(term) ||
        (s.enrollment_no || '').toLowerCase().includes(term)

      const matchesBranch = !branchFilter || (s.branch || '') === branchFilter
      const matchesSection = !sectionFilter || (s.student_section || '') === sectionFilter

      return matchesSearch && matchesBranch && matchesSection
    })

    return filtered.map(s => {
      const roll = (s.roll_no || '').toUpperCase()
      const meta = mediaByRoll[roll]
      const count = updates[roll]
      const buster = cacheBustByRoll[roll] || (count?.lastUpdatedAt ? new Date(count.lastUpdatedAt).getTime() : 0)
      return { s, roll, meta, count, buster }
    })
  }, [students, mediaByRoll, updates, cacheBustByRoll, searchTerm, branchFilter, sectionFilter])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading Media Master...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">RTU Media Master</h1>
            <p className="text-gray-600">
              Students: <span className="font-semibold text-blue-600">{total}</span>
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Uses RTU “secret” data (photo/signature + filenames). Click “Load RTU” per student.
            </p>
          </div>
          <Link
            href="/students"
            className="shrink-0 inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Back to Students
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {showFilters ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Name, Roll, Enrollment"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Sections</option>
                  {sections.map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Roll</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Photo</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Signature</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">RTU Filenames</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Update Count</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map(({ s, roll, meta, count, buster }) => (
                  <tr key={s.s_no} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{roll || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 min-w-[220px]">{s.student_name || 'N/A'}</td>

                    <td className="px-4 py-3">
                      {meta?.photoUrl ? (
                        <img
                          key={`p:${roll}:${buster}`}
                          src={`${meta.photoUrl}${meta.photoUrl.includes('?') ? '&' : '?'}t=${buster}`}
                          alt="RTU Photo"
                          className="h-14 w-14 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-500">
                          {meta?.error ? 'Error' : 'Not loaded'}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {meta?.signatureUrl ? (
                        <img
                          key={`s:${roll}:${buster}`}
                          src={`${meta.signatureUrl}${meta.signatureUrl.includes('?') ? '&' : '?'}t=${buster}`}
                          alt="RTU Signature"
                          className="h-14 w-14 rounded-lg object-cover border border-gray-200 bg-white"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-500">
                          {meta?.error ? 'Error' : 'Not loaded'}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700">
                      <div className="space-y-1">
                        <div>
                          <span className="font-semibold">P:</span> {meta?.photoPath || '—'}
                        </div>
                        <div>
                          <span className="font-semibold">S:</span> {meta?.signaturePath || '—'}
                        </div>
                        {meta?.error ? (
                          <div className="text-red-600">{meta.error}</div>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      <div className="space-y-1">
                        <div><span className="font-semibold">Photo:</span> {count?.photo ?? 0}</div>
                        <div><span className="font-semibold">Sign:</span> {count?.signature ?? 0}</div>
                        <div className="text-gray-500">
                          <span className="font-semibold">Last:</span> {count?.lastUpdatedAt ? new Date(count.lastUpdatedAt).toLocaleString() : '—'}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => fetchRtuForStudent(s)}
                        disabled={!roll || !!busyRolls[roll]}
                        className="inline-flex items-center justify-center bg-blue-600 disabled:bg-blue-300 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
                      >
                        {busyRolls[roll] ? 'Loading…' : 'Load RTU'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
