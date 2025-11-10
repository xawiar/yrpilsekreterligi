import React from 'react';
import ShowMemberButton from './ShowMemberButton';
import EditMemberButton from './EditMemberButton';
import ArchiveMemberButton from './ArchiveMemberButton';

const MemberActions = ({ member, memberId, onShowMember, onEditMember, onArchiveMember }) => {
  // Prefer member object if available, otherwise use memberId
  const memberToUse = member || memberId;
  
  return (
    <div className="flex space-x-1">
      <ShowMemberButton onClick={() => onShowMember(memberToUse)} />
      <EditMemberButton onClick={() => onEditMember(memberToUse)} />
      <ArchiveMemberButton onClick={() => onArchiveMember(memberToUse)} />
    </div>
  );
};

export default MemberActions;