'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Student } from '@/lib/database.types'
import Link from 'next/link'

function getInitials(name?: string | null) {
  const value = (name || '').trim()
  if (!value) return 'NA'
  const parts = value.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || 'N'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : ''
  return (first + last).toUpperCase()
}

function StudentPhoto({ rollNo, name }: { rollNo?: string | null; name?: string | null }) {
  const [attempt, setAttempt] = useState(0)
  const safeRoll = (rollNo || '').trim()
  const candidates = safeRoll
    ? [
        `/student_photos/photo_${encodeURIComponent(safeRoll)}.jpg`,
        `/student_photos/photo_${encodeURIComponent(safeRoll)}.jpeg`,
        `/student_photos/photo_${encodeURIComponent(safeRoll)}.png`,
      ]
    : []

  const src = candidates[attempt]

  if (!src) {
    return (
      <div className="h-12 w-12 rounded-full bg-white/20 ring-2 ring-white/30 flex items-center justify-center text-white font-bold text-sm">
        {getInitials(name)}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name ? `${name} photo` : 'Student photo'}
      loading="lazy"
      className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30 bg-white/10"
      onError={() => {
        if (attempt < candidates.length - 1) setAttempt(a => a + 1)
      }}
    />
  )
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  const [branches, setBranches] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      setLoading(true)
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

      // Extract unique branches
      const uniqueBranches = [...new Set(allStudents.map(s => s.branch).filter(Boolean) as string[])]
      setBranches(uniqueBranches)

      // Extract unique sections
      const uniqueSections = [...new Set(allStudents.map(s => s.student_section).filter(Boolean) as string[])]
      setSections(uniqueSections)
    } catch (error) {
      console.error('Error fetching students:', error)
      alert('Error loading students. Please check your Supabase configuration.')
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.roll_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.enrollment_no?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesBranch = branchFilter === '' || student.branch === branchFilter

    const matchesSection =
      sectionFilter === '' ||
      (student.student_section || '') === sectionFilter

    return matchesSearch && matchesBranch && matchesSection
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading students...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Student Database
          </h1>
          <p className="text-gray-600">
            Total Students: <span className="font-semibold text-blue-600">{filteredStudents.length}</span>
          </p>
        </div>

        {/* Filters */}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Name, Roll No, Enrollment No"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Section
                </label>
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

        {/* Student Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <Link 
              key={student.s_no} 
              href={`/students/${student.roll_no}`}
              className="block group"
            >
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer h-full group-hover:-translate-y-0.5">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                  <div className="flex items-center gap-3">
                    <StudentPhoto rollNo={student.roll_no} name={student.student_name} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-bold text-lg truncate">
                        {student.student_name || 'N/A'}
                      </h3>
                      <p className="text-blue-100 text-sm truncate">{student.roll_no}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm font-medium w-28">Enrollment</span>
                      <span className="text-gray-800 text-sm flex-1 break-words">{student.enrollment_no || 'N/A'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm font-medium w-28">Branch</span>
                      <span className="text-gray-800 text-sm flex-1 line-clamp-2">{student.branch || 'N/A'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm font-medium w-28">Section</span>
                      <span className="text-gray-800 text-sm">{student.student_section || 'N/A'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm font-medium w-28">Sex</span>
                      <span className="text-gray-800 text-sm">{student.sex || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-200">
                    <div className="w-full bg-blue-600 group-hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 text-center">
                      View Details →
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No students found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
}
