import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          Student Portal
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          JAIPUR ENGINEERING COLLEGE & RESEARCH CENTRE
        </p>
        <Link 
          href="/students"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          View Student Database →
        </Link>

        <div className="mt-4">
          <Link
            href="/media-master"
            className="inline-block bg-white hover:bg-gray-50 text-blue-700 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl border border-blue-200"
          >
            RTU Media Master →
          </Link>
        </div>

        <div className="mt-4">
          <Link
            href="/jf-ia"
            className="inline-block bg-white hover:bg-gray-50 text-blue-700 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl border border-blue-200"
          >
            JF-IA (AI Assistant) →
          </Link>
        </div>
        <div className="mt-12 text-gray-500 text-sm">
          <p>First Year Students Database</p>
          <p>Academic Year 2024-2025</p>
        </div>
      </div>
    </div>
  );
}
