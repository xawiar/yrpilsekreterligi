import React from 'react';
import ApiService from '../utils/ApiService';
import GenericInstitutionSettings from './GenericInstitutionSettings';

const PublicInstitutionSettings = () => {
  return (
    <GenericInstitutionSettings
      entityType="public_institution"
      labels={{
        singular: 'Kamu Kurumu',
        plural: 'Kamu Kurumlari',
        emptyMessage: 'Henuz kamu kurumu eklenmemis',
        visitIdKey: 'public_institution_id',
      }}
      apiMethods={{
        getAll: ApiService.getPublicInstitutions,
        create: ApiService.createPublicInstitution,
        update: ApiService.updatePublicInstitution,
        delete: ApiService.deletePublicInstitution,
        getVisitCounts: ApiService.getAllVisitCounts,
        getVisitsForLocation: ApiService.getVisitsForLocation,
      }}
      badgeColor="blue"
    />
  );
};

export default PublicInstitutionSettings;
