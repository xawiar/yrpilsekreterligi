import React from 'react';
import ApiService from '../utils/ApiService';
import GenericInstitutionSettings from './GenericInstitutionSettings';

const STKSettings = () => {
  return (
    <GenericInstitutionSettings
      entityType="stk"
      labels={{
        singular: 'STK',
        plural: "STK'lar",
        emptyMessage: 'Henuz STK eklenmemis',
        visitIdKey: 'stk_id',
      }}
      apiMethods={{
        getAll: ApiService.getSTKs,
        create: ApiService.createSTK,
        update: ApiService.updateSTK,
        delete: ApiService.deleteSTK,
        getVisitCounts: ApiService.getAllVisitCounts,
        getVisitsForLocation: ApiService.getVisitsForLocation,
      }}
      badgeColor="purple"
    />
  );
};

export default STKSettings;
