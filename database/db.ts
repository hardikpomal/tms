import Dexie, { type EntityTable } from 'dexie';
import { AttendanceRecord, TaskRecord } from '../types';

/**
 * TMS Database — Uses IndexedDB via Dexie
 * Schema v2: attendance + tasks tables
 */
const db = new Dexie('TMSDatabase') as Dexie & {
  attendance: EntityTable<AttendanceRecord, 'id'>;
  tasks: EntityTable<TaskRecord, 'id'>;
};

db.version(2).stores({
  attendance: '++id, date, attendanceStatus',
  tasks: '++id, attendanceId, project, status, startTime',
});

export { db };
