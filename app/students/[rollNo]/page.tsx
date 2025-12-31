'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Student } from '@/lib/database.types'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function StudentDetailPage() {
  const params = useParams()
  const rollNo = params.rollNo as string
  
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [rtuData, setRtuData] = useState<any>(null)
  const [loadingRtu, setLoadingRtu] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())
  const [showChangePfpModal, setShowChangePfpModal] = useState(false)
  const [uploadingPfp, setUploadingPfp] = useState(false)
  const [photoMappings, setPhotoMappings] = useState<{ originalPhoto?: string, originalSignature?: string } | null>(null)

  useEffect(() => {
    if (rollNo) {
      fetchStudent()
      fetchPhotoMappings()
    }
  }, [rollNo])

  const fetchPhotoMappings = async () => {
    try {
      const response = await fetch(`/api/get-photo-mappings?rollNo=${rollNo}`)
      const result = await response.json()
      if (result.success && result.mapping) {
        setPhotoMappings(result.mapping)
      }
    } catch (error) {
      console.error('Error fetching photo mappings:', error)
    }
  }

  const fetchStudent = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('firstyear')
        .select('*')
        .eq('roll_no', rollNo)
        .single()

      if (error) throw error
      setStudent(data)
    } catch (error) {
      console.error('Error fetching student:', error)
      alert('Error loading student details.')
    } finally {
      setLoading(false)
    }
  }

  const handleViewSecretInfo = async (student: Student) => {
    try {
      setLoadingRtu(true)
      setShowModal(true)
      
      const response = await fetch('/api/rtu-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rollNo: student.roll_no,
          studentName: student.student_name,
          fatherName: student.father_name,
          branch: student.branch
        })
      })

      const result = await response.json()
      
      // Show ALL response data for debugging
      setRtuData({
        ...result,
        fullResponse: result,
        debugInfo: true
      })

    } catch (error) {
      console.error('Error fetching RTU data:', error)
      setRtuData({
        error: 'Failed to fetch data from RTU portal',
        errorDetails: error,
        debugInfo: true
      })
    } finally {
      setLoadingRtu(false)
    }
  }

  const handleChangePfp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fileInput = form.elements.namedItem('photo') as HTMLInputElement
    const photo = fileInput?.files?.[0]

    if (!photo) {
      alert('Please select a photo')
      return
    }

    // Validate file size (max 5MB)
    if (photo.size > 5 * 1024 * 1024) {
      alert('Photo size must be less than 5MB')
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(photo.type)) {
      alert('Photo must be JPG, JPEG or PNG')
      return
    }

    setUploadingPfp(true)

    try {
      const formData = new FormData()
      formData.append('rollNo', rollNo)
      formData.append('photo', photo)

      const response = await fetch('/api/save-photo', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        alert(`✅ Profile photo updated successfully!\n\nThe new photo will appear in admit cards and other documents.`)
        form.reset()
        setShowChangePfpModal(false)
        // Refresh the photo display and mappings
        setImageTimestamp(Date.now())
        fetchPhotoMappings()
      } else {
        alert(`❌ Failed to update photo\n\n${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`❌ Failed to update photo\n\n${error instanceof Error ? error.message : 'Network error'}`)
    } finally {
      setUploadingPfp(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading student details...</p>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Student Not Found</h2>
          <Link href="/students" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Students List
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <Link 
          href="/students" 
          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Students List
        </Link>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              {student.student_name || 'N/A'}
            </h1>
            <div className="flex flex-wrap gap-4 text-blue-100">
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                Roll No: {student.roll_no}
              </span>
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Enrollment: {student.enrollment_no || 'N/A'}
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-600">
                  Personal Information
                </h2>
                
                <InfoRow label="Full Name" value={student.student_name} />
                <InfoRow label="Father's Name" value={student.father_name} />
                <InfoRow label="Mother's Name" value={student.mother_name} />
                <InfoRow label="Sex" value={student.sex} />
                <InfoRow label="ABC ID" value={student.abc_id} />
              </div>

              {/* Academic Information */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-600">
                  Academic Information
                </h2>
                
                <InfoRow label="Branch" value={student.branch} />
                <InfoRow label="Section" value={student.student_section} />
                <InfoRow label="Group" value={student.student_group} />
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-600">
                  Contact Information
                </h2>
                
                <InfoRow label="Mobile No" value={student.mobile_no} />
                <InfoRow label="Email ID" value={student.student_emailid} />
                <InfoRow 
                  label="OTP Verified" 
                  value={student.otp_verified ? 'Yes' : 'No'}
                  valueColor={student.otp_verified ? 'text-green-600' : 'text-red-600'}
                />
              </div>

              {/* Documents */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-600">
                  Documents
                </h2>
                
                <InfoRow label="Photo Path" value={student.photo_path} />
                <InfoRow label="Admit Card Path" value={student.admit_card_path} />
                
                {photoMappings && (
                  <>
                    <div className="bg-purple-50 border border-purple-300 rounded-lg p-3 mt-3">
                      <p className="text-xs font-semibold text-purple-800 mb-2">📁 Original RTU Filenames:</p>
                      {photoMappings.originalPhoto && (
                        <p className="text-xs text-purple-700">
                          Photo: <span className="font-mono bg-white px-2 py-1 rounded">{photoMappings.originalPhoto}</span>
                        </p>
                      )}
                      {photoMappings.originalSignature && (
                        <p className="text-xs text-purple-700 mt-1">
                          Signature: <span className="font-mono bg-white px-2 py-1 rounded">{photoMappings.originalSignature}</span>
                        </p>
                      )}
                      {!photoMappings.originalPhoto && !photoMappings.originalSignature && (
                        <p className="text-xs text-purple-600">No original filenames saved yet</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap gap-4">
              <button 
                onClick={() => setShowChangePfpModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Change Profile Photo
              </button>
              
              <button 
                onClick={() => handleViewSecretInfo(student)}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                View Secret Info (RTU Portal)
              </button>
              
              <button 
                onClick={async () => {
                  try {
                    // Get photo URL from Supabase Storage
                    const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/student-photos/photo_${student.roll_no}.jpg`
                    const link = document.createElement('a')
                    link.href = photoUrl
                    link.download = `photo_${student.roll_no}.jpg`
                    link.target = '_blank'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  } catch (error) {
                    console.error('Error downloading photo:', error)
                    alert('Failed to download photo')
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Photo
              </button>
              
              <button 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/generate-admit-card', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ rollNo: student.roll_no })
                    })

                    if (response.ok) {
                      const html = await response.text()
                      const newWindow = window.open('', '_blank')
                      if (newWindow) {
                        newWindow.document.write(html)
                        newWindow.document.close()
                      }
                    } else {
                      alert('Failed to generate admit card')
                    }
                  } catch (error) {
                    alert('Error generating admit card')
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Admit Card
              </button>

              <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Email
              </button>
            </div>
          </div>
        </div>

        {/* RTU Secret Info Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  RTU Portal Secret Information
                </h2>
                <button 
                  onClick={() => {
                    setShowModal(false)
                    setRtuData(null)
                  }}
                  className="text-white hover:text-red-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {loadingRtu ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 text-lg">Fetching secret information from RTU Portal...</p>
                  </div>
                ) : rtuData ? (
                  <div className="space-y-6">
                    {/* DEBUG: Show server logs */}
                    {rtuData.debugLogs && (
                      <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-blue-800 mb-3">📋 Server Console Logs</h3>
                        <div className="text-xs bg-white p-4 rounded max-h-60 overflow-y-auto font-mono space-y-1">
                          {rtuData.debugLogs.map((log: string, i: number) => (
                            <div key={i} className="text-gray-700">{log}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* DEBUG: Show HTML sample */}
                    {rtuData.htmlSample && (
                      <div className="bg-purple-50 border-2 border-purple-400 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-purple-800 mb-3">📄 HTML Response Sample</h3>
                        <pre className="text-xs bg-white p-4 rounded max-h-60 overflow-y-auto font-mono whitespace-pre-wrap">
                          {rtuData.htmlSample}
                        </pre>
                      </div>
                    )}

                    {/* DEBUG: Show full API response */}
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                      <h3 className="text-lg font-bold text-yellow-800 mb-3">🔍 DEBUG - Full API Response</h3>
                      <pre className="text-xs bg-white p-4 rounded overflow-x-auto max-h-96 overflow-y-auto font-mono">
                        {JSON.stringify(rtuData, null, 2)}
                      </pre>
                    </div>

                    {rtuData.data?.found && rtuData.data?.students?.length > 0 ? (
                      <>
                        {rtuData.data.students.map((student: any, index: number) => (
                          <div key={index} className="space-y-6">
                            {/* Student Information */}
                            <div className="bg-white border-2 border-green-400 rounded-lg p-6">
                              <h3 className="font-bold text-green-800 mb-4 text-xl">✅ Student Information from RTU Portal</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <RtuInfoRow label="Roll Number" value={student.rollNo} />
                                <RtuInfoRow label="Student Name" value={student.studentName} />
                                <RtuInfoRow label="Hindi Name" value={student.hindiName} />
                                <RtuInfoRow label="Enrollment No" value={student.enrollmentNo} />
                                <RtuInfoRow label="Date of Birth" value={student.dob} />
                                <RtuInfoRow label="Email" value={student.email} />
                                <RtuInfoRow label="Mobile" value={student.mobile} />
                              </div>
                            </div>

                            {/* Photos Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                              {student.photoUrl && (
                                <div className="border-2 border-gray-200 rounded-lg p-4">
                                  <h3 className="font-bold text-gray-800 mb-3 text-center">Student Photo</h3>
                                  <div className="bg-gray-100 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
                                    <img 
                                      src={`${student.photoUrl}${student.photoUrl.includes('?') ? '&' : '?'}t=${imageTimestamp}`}
                                      alt="Student Photo" 
                                      className="w-full h-auto max-w-[300px] mx-auto"
                                      onError={(e) => {
                                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3EImage unavailable%3C/text%3E%3C/svg%3E'
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2 text-center">{student.photoPath}</p>
                                </div>
                              )}

                              {student.signatureUrl && (
                                <div className="border-2 border-gray-200 rounded-lg p-4">
                                  <h3 className="font-bold text-gray-800 mb-3 text-center">Student Signature</h3>
                                  <div className="bg-gray-100 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
                                    <img 
                                      src={`${student.signatureUrl}${student.signatureUrl.includes('?') ? '&' : '?'}t=${imageTimestamp}`}
                                      alt="Student Signature" 
                                      className="w-full h-auto max-w-[300px] mx-auto"
                                      onError={(e) => {
                                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="100"%3E%3Crect fill="%23ddd" width="200" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3EImage unavailable%3C/text%3E%3C/svg%3E'
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2 text-center">{student.signaturePath}</p>
                                </div>
                              )}
                            </div>

                            {/* Image Controls */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4 flex items-center justify-between">
                              <p className="text-sm text-blue-800">
                                ⏳ Images are fetched directly from RTU portal. First load may take a few seconds...
                              </p>
                              <button
                                onClick={() => setImageTimestamp(Date.now())}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh Images
                              </button>
                            </div>

                            {/* Upload Photo/Signature Section */}
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-400 rounded-lg p-6 mt-6">
                              <h3 className="font-bold text-purple-800 mb-4 text-xl flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Upload Photo & Signature to RTU Portal
                              </h3>

                              <form onSubmit={async (e) => {
                                e.preventDefault()
                                const form = e.currentTarget
                                const formData = new FormData(form)
                                formData.append('rollNo', student.rollNo)

                                const photo = formData.get('photo') as File
                                const signature = formData.get('signature') as File

                                // Removed validation - allow uploading just one file
                                // The backend will handle fetching the existing file for the missing one

                                if (photo && photo.size > 200 * 1024) {
                                  alert('Photo size must be less than 200 KB!')
                                  return
                                }

                                if (signature && signature.size > 200 * 1024) {
                                  alert('Signature size must be less than 200 KB!')
                                  return
                                }

                                const uploadBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement
                                const originalText = uploadBtn.innerHTML
                                uploadBtn.disabled = true
                                uploadBtn.innerHTML = '⏳ Uploading to RTU Portal...'

                                try {
                                  const response = await fetch('/api/rtu-upload', {
                                    method: 'POST',
                                    body: formData
                                  })

                                  const result = await response.json()

                                  if (result.success) {
                                    alert(`✅ Success!\n\n${result.message}\n\nPhoto: ${result.uploadedPhoto ? 'Uploaded' : 'Not uploaded'}\nSignature: ${result.uploadedSignature ? 'Uploaded' : 'Not uploaded'}\n\n👉 Click the "Refresh Images" button above to see your updated photos!`)
                                    form.reset()
                                    // Auto-refresh images after successful upload
                                    setImageTimestamp(Date.now())
                                  } else {
                                    alert(`❌ Upload failed\n\n${result.error || 'Unknown error'}`)
                                  }
                                } catch (error) {
                                  alert(`❌ Upload failed\n\n${error instanceof Error ? error.message : 'Network error'}`)
                                } finally {
                                  uploadBtn.disabled = false
                                  uploadBtn.innerHTML = originalText
                                }
                              }} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Photo Upload */}
                                  <div className="space-y-2">
                                    <label className="block font-semibold text-gray-700">
                                      📷 Student Photo (Max 200 KB)
                                    </label>
                                    <input 
                                      type="file" 
                                      name="photo" 
                                      accept="image/jpeg,image/jpg,image/png"
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                                    />
                                    <p className="text-xs text-gray-500">JPG, JPEG or PNG format</p>
                                  </div>

                                  {/* Signature Upload */}
                                  <div className="space-y-2">
                                    <label className="block font-semibold text-gray-700">
                                      ✍️ Student Signature (Max 200 KB)
                                    </label>
                                    <input 
                                      type="file" 
                                      name="signature" 
                                      accept="image/jpeg,image/jpg,image/png"
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                                    />
                                    <p className="text-xs text-gray-500">JPG, JPEG or PNG format</p>
                                  </div>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                                  <p className="text-sm text-yellow-800">
                                    ⚠️ <strong>Note:</strong> Files will be uploaded directly to RTU Portal server. Make sure images are clear and within size limit.
                                  </p>
                                </div>

                                <div className="flex justify-center">
                                  <button 
                                    type="submit"
                                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Upload to RTU Portal
                                  </button>
                                </div>
                              </form>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="bg-red-50 border-2 border-red-400 rounded-lg p-6 text-center">
                        <p className="text-red-700 text-lg font-bold">⚠️ No data found</p>
                        <p className="text-red-600 mt-2">{rtuData.error || 'Student not found in RTU Portal'}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No data</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Change Profile Photo Modal */}
        {showChangePfpModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex justify-between items-center rounded-t-lg">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Change Profile Photo
                </h2>
                <button 
                  onClick={() => setShowChangePfpModal(false)}
                  className="text-white hover:text-purple-200 transition-colors"
                  disabled={uploadingPfp}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {/* Current Photo Preview */}
                <div className="mb-6 text-center">
                  <p className="text-sm font-medium text-gray-600 mb-3">Current Photo:</p>
                  <div className="flex justify-center">
                    <img 
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/student-photos/photo_${rollNo}.jpg?t=${imageTimestamp}`}
                      alt="Current photo"
                      className="w-32 h-32 rounded-lg object-cover border-4 border-gray-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student?.student_name || rollNo)}&size=128&background=6366f1&color=fff`
                      }}
                    />
                  </div>
                </div>

                <form onSubmit={handleChangePfp} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block font-semibold text-gray-700">
                      📷 Select New Photo
                    </label>
                    <input 
                      type="file" 
                      name="photo" 
                      accept="image/jpeg,image/jpg,image/png"
                      required
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                      disabled={uploadingPfp}
                    />
                    <p className="text-xs text-gray-500">JPG, JPEG or PNG format (Max 5MB)</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Info:</strong> This will update the profile photo used in admit cards and other documents. The photo will be saved as photo_{rollNo}.jpg
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button 
                      type="button"
                      onClick={() => setShowChangePfpModal(false)}
                      className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                      disabled={uploadingPfp}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={uploadingPfp}
                    >
                      {uploadingPfp ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Update Photo
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RtuInfoRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
      <span className="text-base text-gray-800 font-medium">
        {value || 'N/A'}
      </span>
    </div>
  )
}

function InfoRow({ 
  label, 
  value, 
  valueColor = 'text-gray-800' 
}: { 
  label: string
  value: string | null | undefined
  valueColor?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
      <span className={`text-base ${valueColor} font-medium`}>
        {value || 'N/A'}
      </span>
    </div>
  )
}
