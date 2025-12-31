'use client'

import { useState, useEffect } from 'react'

interface PhotoMapping {
  roll_no: string
  original_photo: string | null
  original_signature: string | null
  created_at: string
  updated_at: string
}

interface StudentData {
  student_name?: string
  section?: string
}

export default function SecretPhotoHistoryPage() {
  const [mappings, setMappings] = useState<PhotoMapping[]>([])
  const [studentData, setStudentData] = useState<Record<string, StudentData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    fetchMappings()
  }, [])

  async function fetchMappings() {
    try {
      setLoading(true)
      const res = await fetch('/api/get-photo-mappings')
      const data = await res.json()

      if (data.success) {
        setMappings(data.mappings || [])
        
        // Fetch student details for each roll number
        const rollNumbers = (data.mappings || []).map((m: PhotoMapping) => m.roll_no)
        await fetchStudentDetails(rollNumbers)
      } else {
        setError(data.error || 'Failed to fetch mappings')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchStudentDetails(rollNumbers: string[]) {
    const details: Record<string, StudentData> = {}
    
    for (const rollNo of rollNumbers) {
      try {
        const res = await fetch(`/api/rtu-info?rollNo=${rollNo}`)
        const data = await res.json()
        if (data.student) {
          details[rollNo] = {
            student_name: data.student.student_name,
            section: data.student.section
          }
        }
      } catch (err) {
        console.error(`Failed to fetch details for ${rollNo}`)
      }
    }
    
    setStudentData(details)
  }

  const filteredMappings = mappings.filter(m => 
    m.roll_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    studentData[m.roll_no]?.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.original_photo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.original_signature?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPhotoUrl = (rollNo: string, filename: string | null) => {
    if (!filename) return null
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    return `${supabaseUrl}/storage/v1/object/public/student-photos/${filename}`
  }

  async function restoreOriginal(rollNo: string) {
    if (!confirm(`Restore original photo and signature for ${rollNo}?\n\nThis will replace the current files with the original ones.`)) {
      return
    }

    setRestoring(rollNo)
    try {
      const res = await fetch('/api/restore-original-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo })
      })

      const data = await res.json()

      if (data.success) {
        alert(`✅ Success!\n\nPhoto: ${data.results.photo.message}\nSignature: ${data.results.signature.message}`)
        // Refresh the list
        await fetchMappings()
      } else {
        alert(`❌ Failed to restore:\n\n${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`)
    } finally {
      setRestoring(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading photo history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">⚠️ Error</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchMappings}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔐 Secret Photo History</h1>
              <p className="text-gray-600 mt-1">
                Track all photo changes and original filenames
              </p>
            </div>
            <button
              onClick={fetchMappings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total Changes</p>
              <p className="text-2xl font-bold text-blue-600">{mappings.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Photos Changed</p>
              <p className="text-2xl font-bold text-green-600">
                {mappings.filter(m => m.original_photo).length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Signatures Changed</p>
              <p className="text-2xl font-bold text-purple-600">
                {mappings.filter(m => m.original_signature).length}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by roll number, name, or filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
          </div>
        </div>

        {/* Table */}
        {filteredMappings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No matching records found' : 'No photo changes recorded yet'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Roll No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Original Photo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Original Signature
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMappings.map((mapping) => (
                    <tr key={mapping.roll_no} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`/students/${mapping.roll_no}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {mapping.roll_no}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900">
                          {studentData[mapping.roll_no]?.student_name || '...'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-600">
                          {studentData[mapping.roll_no]?.section || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {mapping.original_photo ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700 font-mono bg-gray-100 px-2 py-1 rounded">
                              {mapping.original_photo}
                            </span>
                            <a
                              href={getPhotoUrl(mapping.roll_no, mapping.original_photo) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              View
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {mapping.original_signature ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700 font-mono bg-gray-100 px-2 py-1 rounded">
                              {mapping.original_signature}
                            </span>
                            <a
                              href={getPhotoUrl(mapping.roll_no, mapping.original_signature) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              View
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {formatDate(mapping.updated_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/students/${mapping.roll_no}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View Profile
                          </a>
                          {(mapping.original_photo || mapping.original_signature) && (
                            <button
                              onClick={() => restoreOriginal(mapping.roll_no)}
                              disabled={restoring === mapping.roll_no}
                              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                restoring === mapping.roll_no
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              {restoring === mapping.roll_no ? '⏳ Restoring...' : '🔄 Make Original'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>📌 Note:</strong> This page shows all students who have changed their photos or signatures.
            Original filenames are preserved in Supabase Storage for audit purposes.
          </p>
        </div>
      </div>
    </div>
  )
}
