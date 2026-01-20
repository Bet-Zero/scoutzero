/**
 * FILE: src/features/architect/GMDashboard/components/OfferSheetList.jsx
 * PURPOSE: Render a list of offer sheets with appropriate actions (Match/Decline/Finalize).
 */
import React from 'react';

const OfferSheetList = ({ 
  offerSheets = [], 
  title = "Offer Sheets",
  isIncoming = false,
  onMatch,
  onDecline,
  onFinalize
}) => {
  if (!offerSheets || offerSheets.length === 0) {
    return null;
  }

  const formatCurrency = (val) => {
    if (!val) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Player</th>
            <th className="py-2">{isIncoming ? 'Offering Team' : 'Target Team'}</th>
            <th className="py-2">Terms</th>
            <th className="py-2">Status</th>
            <th className="py-2">Date</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {offerSheets.map(os => (
            <tr key={os.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="py-3 font-medium">{os.playerName}</td>
              <td className="py-3">
                  {isIncoming ? os.offeringTeamCode : os.homeTeamCode}
              </td>
              <td className="py-3">
                {os.contractYears}y / {formatCurrency(os.totalValue)}
              </td>
              <td className="py-3">
                <span className={`px-2 py-1 rounded text-xs font-bold
                  ${os.status === 'MATCHED' ? 'bg-blue-100 text-blue-800' : ''}
                  ${os.status === 'DECLINED' ? 'bg-red-100 text-red-800' : ''}
                  ${os.status === 'PENDING_MATCH' ? 'bg-yellow-100 text-yellow-800' : ''}
                `}>
                  {os.status.replace('_', ' ')}
                </span>
              </td>
              <td className="py-3 text-gray-500">
                {new Date(os.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 text-right space-x-2">
                {isIncoming && os.status === 'PENDING_MATCH' && (
                    <>
                        <button 
                            onClick={() => onMatch(os.offeringTeamCode, os.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                        >
                            Match
                        </button>
                        <button 
                            onClick={() => onDecline(os.offeringTeamCode, os.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs"
                        >
                            Decline
                        </button>
                    </>
                )}
                {isIncoming && os.status === 'MATCHED' && (
                     <button 
                        onClick={() => onFinalize(os)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs"
                    >
                        Finalize Match
                    </button>
                )}
                {!isIncoming && os.status === 'DECLINED' && (
                    <button 
                        onClick={() => onFinalize(os)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs"
                    >
                        Finalize Signing
                    </button>
                )}
                {!isIncoming && os.status === 'MATCHED' && (
                    <span className="text-xs text-blue-600 font-medium">Matched by Home Team</span>
                )}
                {!isIncoming && os.status === 'PENDING_MATCH' && (
                    <span className="text-xs text-gray-400 italic">Waiting for home team...</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OfferSheetList;
