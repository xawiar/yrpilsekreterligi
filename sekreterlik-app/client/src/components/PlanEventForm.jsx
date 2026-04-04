import React from 'react';
import EventFormBase from './EventFormBase';

const PlanEventForm = ({ onClose, onEventPlanned, members }) => (
  <EventFormBase mode="plan" onClose={onClose} onSuccess={onEventPlanned} members={members} />
);

export default PlanEventForm;
