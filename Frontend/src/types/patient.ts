export interface Patient {
  id: string;
  researchId: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  diagnoses: string[];
  labs: Lab[];
  medications: string[];
  dataCompleteness: number;
}

export interface Lab {
  name: string;
  value: string | number;
  unit: string;
  date: string;
}
