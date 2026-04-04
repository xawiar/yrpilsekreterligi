import React from 'react';
import EventFormBase from './EventFormBase';

const EventForm = ({ event, onClose, onEventSaved, members }) => (
  <EventFormBase mode="edit" event={event} onClose={onClose} onSuccess={onEventSaved} members={members} />
);

export default EventForm;
