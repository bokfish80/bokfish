
export type AttendanceStatus = 'late' | 'absent' | 'violation';

export type ReflectionStatus = 'none' | 'assigned' | 'collected';

export interface AttendanceEntry {
  type: AttendanceStatus;
  time?: string; // e.g., "08:30"
  violationType?: string; // e.g., "복장규정 위반"
  reflection1?: ReflectionStatus;
  reflection2?: ReflectionStatus;
}

export interface Student {
  id: string;
  name: string;
  studentNumber: string;
  year: number;
  classGroup: number;
}

export interface AttendanceState {
  [date: string]: Record<string, AttendanceEntry>;
}

export interface ViolationOption {
  id: string;
  label: string;
}
