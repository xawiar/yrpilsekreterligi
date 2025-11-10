import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const PollVotingComponent = ({ poll, memberId, onVote }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if member has already voted
    checkVoteStatus();
  }, [poll.id, memberId]);

  const checkVoteStatus = async () => {
    try {
      const results = await ApiService.getPollResults(poll.id);
      if (results && results.results) {
        // Check if member has voted (we can't directly check, but we can try to vote and see if it's an update)
        // For now, we'll just allow voting
        setHasVoted(false);
      }
    } catch (err) {
      console.error('Error checking vote status:', err);
    }
  };

  const handleVote = async () => {
    if (selectedOption === null) {
      setError('Lütfen bir seçenek seçin');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await ApiService.voteOnPoll(poll.id, selectedOption, memberId);
      setHasVoted(true);
      alert('Oyunuz başarıyla kaydedildi');
      if (onVote) {
        onVote();
      }
    } catch (err) {
      console.error('Error voting:', err);
      setError(err.message || 'Oy verme sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (hasVoted) {
    return (
      <div className="text-center py-4">
        <p className="text-green-600 dark:text-green-400 font-medium">
          ✓ Oyunuz kaydedildi. Teşekkürler!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {poll.options && poll.options.map((option, index) => (
          <label
            key={index}
            className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
              selectedOption === index
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900'
                : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-700'
            }`}
          >
            <input
              type="radio"
              name={`poll-${poll.id}`}
              value={index}
              checked={selectedOption === index}
              onChange={() => setSelectedOption(index)}
              className="mr-3 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-900 dark:text-gray-100 flex-1">{option}</span>
          </label>
        ))}
      </div>
      
      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
      )}
      
      <button
        onClick={handleVote}
        disabled={loading || selectedOption === null}
        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
          loading || selectedOption === null
            ? 'bg-gray-400 cursor-not-allowed text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        {loading ? 'Kaydediliyor...' : 'Oy Ver'}
      </button>
    </div>
  );
};

export default PollVotingComponent;

