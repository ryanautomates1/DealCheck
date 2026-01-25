'use client'

// Debug page to check environment variable status
// Remove this page before going to production with real users

export default function DebugPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Environment Debug</h1>
      
      <div className="space-y-4 max-w-xl">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">NEXT_PUBLIC_SUPABASE_URL</h2>
          <p className={supabaseUrl ? 'text-green-400' : 'text-red-400'}>
            {supabaseUrl ? `SET: ${supabaseUrl.substring(0, 30)}...` : 'NOT SET'}
          </p>
        </div>
        
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">NEXT_PUBLIC_SUPABASE_ANON_KEY</h2>
          <p className={supabaseKey ? 'text-green-400' : 'text-red-400'}>
            {supabaseKey ? `SET: ${supabaseKey.substring(0, 20)}...` : 'NOT SET'}
          </p>
        </div>
        
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">Status</h2>
          <p className={supabaseUrl && supabaseKey ? 'text-green-400' : 'text-red-400'}>
            {supabaseUrl && supabaseKey 
              ? '✓ Supabase should be configured correctly' 
              : '✗ Environment variables missing - check AWS Amplify settings'}
          </p>
        </div>

        <div className="p-4 bg-yellow-900 rounded-lg">
          <h2 className="font-semibold mb-2">Important Notes</h2>
          <ul className="text-sm space-y-1 text-yellow-200">
            <li>• NEXT_PUBLIC_* variables are embedded at BUILD time</li>
            <li>• If you added/changed env vars, you MUST redeploy</li>
            <li>• In AWS Amplify: Hosting → Environment variables</li>
            <li>• Make sure variables are set for your branch (main)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
