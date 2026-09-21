export interface FieldMapping {
  [key: string]: {
    siField: string;
    blField: string;
    description: string;
  };
}

export const FIELD_MAPPINGS: FieldMapping = {
  // Shipper field mappings
  shipper: {
    siField: 'shipper',
    blField: 'shipper',
    description: 'Shipper / Consignor name'
  },
  'Shipper Name': {
    siField: 'shipper',
    blField: 'shipper',
    description: 'Shipper name'
  },
  'Consignor': {
    siField: 'shipper',
    blField: 'shipper',
    description: 'Consignor / Shipper'
  },
  'Consignor Name': {
    siField: 'shipper',
    blField: 'shipper',
    description: 'Consignor name'
  },
  
  // Consignee field mappings
  consignee: {
    siField: 'consignee',
    blField: 'consignee',
    description: 'Consignee'
  },
  'Consignee Name': {
    siField: 'consignee',
    blField: 'consignee',
    description: 'Consignee name'
  },
  'Consignee': {
    siField: 'consignee',
    blField: 'consignee',
    description: 'Consignee'
  },
  
  // Notify party field mappings
  notifyParty: {
    siField: 'notifyParty',
    blField: 'notifyParty',
    description: 'Notify party name'
  },
  'Notify Party': {
    siField: 'notifyParty',
    blField: 'notifyParty',
    description: 'Notify party name'
  },
  'Notify Party Name': {
    siField: 'notifyParty',
    blField: 'notifyParty',
    description: 'Notify party name'
  },
  'Notification Party': {
    siField: 'notifyParty',
    blField: 'notifyParty',
    description: 'Notification party'
  },
  
  // Port of loading field mappings
  portOfLoading: {
    siField: 'portOfLoading',
    blField: 'portOfLoading',
    description: 'Port of loading'
  },
  'Port of Loading': {
    siField: 'portOfLoading',
    blField: 'portOfLoading',
    description: 'Port of loading'
  },
  'Load Port': {
    siField: 'portOfLoading',
    blField: 'portOfLoading',
    description: 'Load port / Port of loading'
  },
  'POL': {
    siField: 'portOfLoading',
    blField: 'portOfLoading',
    description: 'POL abbreviation'
  },
  'Place of Receipt': {
    siField: 'portOfLoading',
    blField: 'portOfLoading',
    description: 'Place of receipt / Loading port'
  },
  
  // Port of discharge field mappings
  portOfDischarge: {
    siField: 'portOfDischarge',
    blField: 'portOfDischarge',
    description: 'Port of discharge'
  },
  'Port of Discharge': {
    siField: 'portOfDischarge',
    blField: 'portOfDischarge',
    description: 'Port of discharge'
  },
  'Discharge Port': {
    siField: 'portOfDischarge',
    blField: 'portOfDischarge',
    description: 'Discharge port'
  },
  'POD': {
    siField: 'portOfDischarge',
    blField: 'portOfDischarge',
    description: 'POD abbreviation'
  },
  'Destination': {
    siField: 'portOfDischarge',
    blField: 'portOfDischarge',
    description: 'Destination / Discharge port'
  },
  
  // Container count field mappings
  containerCount: {
    siField: 'containerCount',
    blField: 'containerCount',
    description: 'Container quantity'
  },
  'No. of Containers': {
    siField: 'containerCount',
    blField: 'containerCount',
    description: 'Number of containers'
  },
  'Container Count': {
    siField: 'containerCount',
    blField: 'containerCount',
    description: 'Container count'
  },
  'Container No.': {
    siField: 'containerCount',
    blField: 'containerCount',
    description: 'Container number'
  },
  'Containers': {
    siField: 'containerCount',
    blField: 'containerCount',
    description: 'Container quantity'
  },
  
  // Gross weight field mappings
  grossWeightKG: {
    siField: 'grossWeightKG',
    blField: 'grossWeightKG',
    description: 'Gross weight in kilograms'
  },
  'Gross Weight': {
    siField: 'grossWeightKG',
    blField: 'grossWeightKG',
    description: 'Gross weight'
  },
  'Gross Weight (KG)': {
    siField: 'grossWeightKG',
    blField: 'grossWeightKG',
    description: 'Gross weight in KG'
  },
  'Total Weight': {
    siField: 'grossWeightKG',
    blField: 'grossWeightKG',
    description: 'Total weight'
  },
  'Weight (KG)': {
    siField: 'grossWeightKG',
    blField: 'grossWeightKG',
    description: 'Weight in KG'
  },
  'Gross Mass': {
    siField: 'grossWeightKG',
    blField: 'grossWeightKG',
    description: 'Gross mass'
  }
};

export interface ComparisonConfig {
  requiredFields: string[];
  optionalFields: string[];
  ignoreFields: string[];
}

export const COMPARISON_CONFIG: ComparisonConfig = {
  requiredFields: [
    'shipper',
    'consignee',
    'notifyParty',
    'portOfLoading',
    'portOfDischarge',
    'containerCount',
    'grossWeightKG'
  ],
  optionalFields: [],
  ignoreFields: [
    'invoiceNumber',
    'referenceNumber',
    'date',
    'sealNumber',
    'remarks'
  ]
};