import React from 'react';
import EventFormBase from './EventFormBase';

const CreateEventForm = ({ onClose, onEventCreated, members }) => (
  <EventFormBase mode="create" onClose={onClose} onSuccess={onEventCreated} members={members} />
);

export default CreateEventForm;
