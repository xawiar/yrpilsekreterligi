/**
 * Election result vote JSON parse utility.
 * Replaces repeated inline JSON.parse blocks across controllers.
 */
function parseElectionResultVotes(result) {
  return {
    ...result,
    cb_votes: result.cb_votes ? JSON.parse(result.cb_votes) : {},
    mv_votes: result.mv_votes ? JSON.parse(result.mv_votes) : {},
    mayor_votes: result.mayor_votes ? JSON.parse(result.mayor_votes) : {},
    provincial_assembly_votes: result.provincial_assembly_votes ? JSON.parse(result.provincial_assembly_votes) : {},
    municipal_council_votes: result.municipal_council_votes ? JSON.parse(result.municipal_council_votes) : {},
    referendum_votes: result.referendum_votes ? JSON.parse(result.referendum_votes) : {},
    party_votes: result.party_votes ? JSON.parse(result.party_votes) : {},
    candidate_votes: result.candidate_votes ? JSON.parse(result.candidate_votes) : {},
  };
}

module.exports = { parseElectionResultVotes };
