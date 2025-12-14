import React from 'react';
import FirestoreDataDiagnostic from '@/components/diagnostic/FirestoreDataDiagnostic';

/**
 * Diagnostic page for troubleshooting Firestore data issues
 * Accessible for users experiencing missing player data
 */
const DataDiagnosticPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🔧 Data Diagnostic Tool
          </h1>
          <p className="text-gray-600 text-lg">
            This tool helps diagnose and troubleshoot issues with missing player data in your ScoutZero application.
            Use this if you&apos;re seeing empty player lists or only partial data in your collections.
          </p>
        </div>
        
        <FirestoreDataDiagnostic />
        
        <div className="mt-8 p-6 bg-gray-100 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">🛠️ Common Solutions</h3>
          <div className="space-y-3 text-sm">
            <div>
              <strong>No players found:</strong>
              <code className="ml-2 bg-gray-200 px-2 py-1 rounded">npm run data:populate-main</code>
            </div>
            <div>
              <strong>Missing 2026 season data:</strong>
              <code className="ml-2 bg-gray-200 px-2 py-1 rounded">npm run data:populate-season 2026</code>
            </div>
            <div>
              <strong>Complete season setup:</strong>
              <code className="ml-2 bg-gray-200 px-2 py-1 rounded">npm run season:transition</code>
            </div>
            <div>
              <strong>Validate after changes:</strong>
              <code className="ml-2 bg-gray-200 px-2 py-1 rounded">npm run season:validate</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataDiagnosticPage;